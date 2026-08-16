// Shared knowledge base, stored in Upstash Redis (free tier).
// Env vars needed: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

const KEY = "artora-ai-kb";

async function upstash(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Upstash env vars missing");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error("Upstash request failed");
  return res.json();
}

async function getEntries() {
  const result = await upstash(["GET", KEY]);
  if (!result.result) return [];
  try {
    return JSON.parse(result.result);
  } catch {
    return [];
  }
}

async function setEntries(entries) {
  await upstash(["SET", KEY, JSON.stringify(entries)]);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const entries = await getEntries();
      return res.status(200).json({ entries });
    }

    if (req.method === "POST") {
      const { title, content } = req.body || {};
      if (!title || !content) {
        return res.status(400).json({ error: "Title aur content dono zaroori hain." });
      }
      const entries = await getEntries();
      const entry = { id: Date.now().toString(), title: String(title).slice(0, 200), content: String(content).slice(0, 4000) };
      entries.push(entry);
      await setEntries(entries);
      return res.status(200).json({ entries });
    }

    if (req.method === "DELETE") {
      const { id } = req.body || {};
      const entries = await getEntries();
      const updated = entries.filter((e) => e.id !== id);
      await setEntries(updated);
      return res.status(200).json({ entries: updated });
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    return res.status(405).end("Method not allowed");
  } catch (err) {
    return res.status(500).json({ error: "Server error. Env vars check karein (Upstash)." });
  }
}
