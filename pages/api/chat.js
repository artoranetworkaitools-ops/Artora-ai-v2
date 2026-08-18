import { dbGet, dbSet } from "../../lib/db";
import { getUserFromRequest } from "../../lib/auth";

const KB_KEY = "artora-ai-kb";
const MEMORY_KEY = "artora-ai-memory";
const MAX_MEMORY_ENTRIES = 300;

function findRelevant(entries, query, limit) {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const scored = entries.map((e) => {
    const text = (e.title + " " + e.content).toLowerCase();
    const score = words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0);
    return { ...e, score };
  });
  return scored.filter((e) => e.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

async function serperSearch(query) {
  const key = process.env.SERPER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 8 }),
    });
    const data = await res.json();
    const organic = data.organic || [];
    if (organic.length === 0) return null;
    return organic
      .slice(0, 8)
      .map((r, i) => `[${i + 1}] ${r.title}: ${r.snippet || ""}`.slice(0, 400))
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

  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Login zaroori hai." });

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return res.status(500).json({ error: "GROQ_API_KEY set nahi hai. Vercel env vars check karein." });
  }

  const { messages, webSearchEnabled, deepResearch } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages missing." });
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUserMsg ? lastUserMsg.content : "";
  // Only send the most recent messages to keep each request light on tokens
  // (free-tier rate limits are per-minute, so trimming avoids hitting them).
  const trimmedMessages = messages.slice(-12);

  const kbEntriesRaw = (await dbGet(KB_KEY)) || [];
  const relevantKB = findRelevant(kbEntriesRaw, query, 4);
  const kbContext = relevantKB.length
    ? "\n\nKnowledge base:\n" + relevantKB.map((e) => `[${e.title}]\n${e.content}`).join("\n\n")
    : "";

  const memoryRaw = (await dbGet(MEMORY_KEY)) || [];
  const memoryAsEntries = memoryRaw.map((m) => ({
    title: "Past conversation",
    content: `User asked: ${m.user}\nAssistant answered: ${m.assistant}`,
  }));
  const relevantMemory = findRelevant(memoryAsEntries, query, 3);
  const memoryContext = relevantMemory.length
    ? "\n\nRelevant past conversations (for continuity, don't repeat verbatim):\n" +
      relevantMemory.map((e) => e.content).join("\n\n")
    : "";

  // Deep research mode always searches, regardless of the search toggle,
  // and asks the model to reason more carefully before answering.
  let searchContext = "";
  const shouldSearch = webSearchEnabled || deepResearch;
  if (shouldSearch) {
    const results = await serperSearch(query);
    if (results) searchContext = "\n\nWeb search results:\n" + results;
  }

  const researchInstruction = deepResearch
    ? "\n\nDEEP RESEARCH MODE: Think through this carefully before answering. Consider multiple angles, cross-check facts against the web search results above, and give a thorough, well-structured answer. It is fine to take a bit longer to be accurate and complete rather than fast."
    : "";

  const systemPrompt =
    "You are Artora AI, a helpful assistant for Artora Network (a creative growth ecosystem: Agency, Content Creation, Community, and Freelance Marketplace) and for general business tasks.\n\n" +
    "LANGUAGE RULE (very important): Always reply in the exact same language and script the user just used in their latest message:\n" +
    "- Plain English in, plain English out.\n" +
    "- Urdu script (اردو) in, Urdu script out.\n" +
    "- Roman Urdu / Hinglish in, Roman Urdu / Hinglish out.\n" +
    "Match their most recent message specifically, even if earlier messages were in a different language.\n\n" +
    "Be direct and practical. Use the knowledge base and past-conversation context below when relevant, but never mention 'knowledge base', 'memory', or 'context' explicitly." +
    kbContext +
    memoryContext +
    searchContext +
    researchInstruction;

  try {
    const modelsToTry = ["openai/gpt-oss-20b", "qwen/qwen3.6-27b", "llama-3.1-8b-instant"];
    let groqRes = null;
    let lastErrText = "";

    for (const model of modelsToTry) {
      groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...trimmedMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
          max_tokens: deepResearch ? 2000 : 1000,
          temperature: deepResearch ? 0.4 : 0.7,
        }),
      });

      if (groqRes.ok) break;

      // Rate limit or model unavailable — silently try the next model in the list.
      lastErrText = await groqRes.text();
      const shouldFallback = groqRes.status === 429 || groqRes.status === 404 || /model_not_found|rate.?limit/i.test(lastErrText);
      if (!shouldFallback) break;
      groqRes = null;
    }

    if (!groqRes || !groqRes.ok) {
      return res.status(500).json({ error: "Sab AI models is waqt busy hain. Thodi der mein dobara try karein. (" + lastErrText.slice(0, 150) + ")" });
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a reply.";

    const updatedMemory = [...memoryRaw, { id: Date.now().toString(), user: query, assistant: reply }].slice(
      -MAX_MEMORY_ENTRIES
    );
    dbSet(MEMORY_KEY, updatedMemory);

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: "Server error." });
  }
}
