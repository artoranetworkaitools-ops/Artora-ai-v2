// Env vars needed: GROQ_API_KEY (required), TAVILY_API_KEY (optional, for web search)

const KEY = "artora-ai-kb";

async function getKBEntries() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return [];
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["GET", KEY]),
    });
    const data = await res.json();
    return data.result ? JSON.parse(data.result) : [];
  } catch {
    return [];
  }
}

function findRelevant(entries, query) {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const scored = entries.map((e) => {
    const text = (e.title + " " + e.content).toLowerCase();
    const score = words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0);
    return { ...e, score };
  });
  return scored
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
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
    return data.results
      .map((r, i) => `[${i + 1}] ${r.title}: ${r.content}`.slice(0, 500))
      .join("\n");
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

  const entries = await getKBEntries();
  const relevant = findRelevant(entries, query);
  const kbContext = relevant.length
    ? "\n\nKnowledge base context:\n" + relevant.map((e) => `[${e.title}]\n${e.content}`).join("\n\n")
    : "";

  let searchContext = "";
  if (webSearchEnabled) {
    const results = await webSearch(query);
    if (results) {
      searchContext = "\n\nLive web search results:\n" + results;
    }
  }

  const systemPrompt =
    "You are Artora AI, a helpful assistant for Artora Network (a creative growth ecosystem: Agency, Content Creation, Community, and Freelance Marketplace) and for general business tasks. " +
    "Respond naturally in whichever language/register the user writes in (Hinglish, English, or Urdu). Be direct, practical, and concise. " +
    "Use the knowledge base and web search context below when relevant, but never mention 'knowledge base' or 'context' explicitly — answer naturally as if you simply know it." +
    kbContext +
    searchContext;

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
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
    const reply = data.choices?.[0]?.message?.content || "Maazrat, jawab nahi bana.";
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: "Server error." });
  }
}
