// Env vars needed: GROQ_API_KEY (required), TAVILY_API_KEY (optional)

const KB_KEY = "artora-ai-kb";
const MEMORY_KEY = "artora-ai-memory";
const MAX_MEMORY_ENTRIES = 300;

async function upstashGet(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["GET", key]),
    });
    const data = await res.json();
    return data.result ? JSON.parse(data.result) : null;
  } catch {
    return null;
  }
}

async function upstashSet(key, value) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["SET", key, JSON.stringify(value)]),
    });
  } catch {
    // silent fail — memory saving should never break the chat response
  }
}

function findRelevant(entries, query, limit) {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const scored = entries.map((e) => {
    const text = (e.title + " " + e.content).toLowerCase();
    const score = words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0);
    return { ...e, score };
  });
  return scored
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function webSearch(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, query, max_results: 4, search_depth: "basic" }),
    });
    const data = await res.json();
    if (!data.results) return null;
    return data.results.map((r, i) => `[${i + 1}] ${r.title}: ${r.content}`.slice(0, 500)).join("\n");
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method not allowed");
  }

  const { messages, webSearchEnabled } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages missing." });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return res.status(500).json({ error: "GROQ_API_KEY set nahi hai. Vercel env vars check karein." });
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUserMsg ? lastUserMsg.content : "";

  const kbEntriesRaw = (await upstashGet(KB_KEY)) || [];
  const relevantKB = findRelevant(kbEntriesRaw, query, 4);
  const kbContext = relevantKB.length
    ? "\n\nKnowledge base:\n" + relevantKB.map((e) => `[${e.title}]\n${e.content}`).join("\n\n")
    : "";

  const memoryRaw = (await upstashGet(MEMORY_KEY)) || [];
  const memoryAsEntries = memoryRaw.map((m) => ({
    title: "Past conversation",
    content: `User asked: ${m.user}\nAssistant answered: ${m.assistant}`,
  }));
  const relevantMemory = findRelevant(memoryAsEntries, query, 3);
  const memoryContext = relevantMemory.length
    ? "\n\nRelevant past conversations (for continuity, don't repeat verbatim, just use for context):\n" +
      relevantMemory.map((e) => e.content).join("\n\n")
    : "";

  let searchContext = "";
  if (webSearchEnabled) {
    const results = await webSearch(query);
    if (results) searchContext = "\n\nLive web search results:\n" + results;
  }

  const systemPrompt =
    "You are Artora AI, a helpful assistant for Artora Network (a creative growth ecosystem: Agency, Content Creation, Community, and Freelance Marketplace) and for general business tasks.\n\n" +
    "LANGUAGE RULE (very important): Always reply in the exact same language and script the user just used in their latest message:\n" +
    "- Plain English in, plain English out.\n" +
    "- Urdu script (اردو) in, Urdu script out.\n" +
    "- Roman Urdu / Hinglish in (Urdu or Hindi words spelled in English letters), Roman Urdu / Hinglish out.\n" +
    "Match their most recent message specifically, even if earlier messages were in a different language.\n\n" +
    "Be direct, practical, and concise. Use the knowledge base and past-conversation context below when relevant, but never mention 'knowledge base', 'memory', or 'context' explicitly — answer naturally as if you simply know it." +
    kbContext +
    memoryContext +
    searchContext;

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return res.status(500).json({ error: "Groq API error: " + errText.slice(0, 200) });
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a reply.";

    // Auto-save this exchange to shared memory (fire and forget, never blocks the reply)
    const updatedMemory = [
      ...memoryRaw,
      { id: Date.now().toString(), user: query, assistant: reply },
    ].slice(-MAX_MEMORY_ENTRIES);
    upstashSet(MEMORY_KEY, updatedMemory);

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: "Server error." });
  }
}
