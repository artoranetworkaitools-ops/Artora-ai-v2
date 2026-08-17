import { dbGet, dbSet } from "../../lib/db";
import { getUserFromRequest } from "../../lib/auth";

const KEY = "artora-ai-kb";

export default async function handler(req, res) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Login zaroori hai." });

  try {
    if (req.method === "GET") {
      const entries = (await dbGet(KEY)) || [];
      return res.status(200).json({ entries });
    }

    // Only admins can add or delete knowledge base entries
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Sirf admin knowledge base edit kar sakta hai." });
    }

    if (req.method === "POST") {
      const { title, content } = req.body || {};
      if (!title || !content) {
        return res.status(400).json({ error: "Title aur content dono zaroori hain." });
      }
      const entries = (await dbGet(KEY)) || [];
      const entry = { id: Date.now().toString(), title: String(title).slice(0, 200), content: String(content).slice(0, 4000) };
      entries.push(entry);
      await dbSet(KEY, entries);
      return res.status(200).json({ entries });
    }

    if (req.method === "DELETE") {
      const { id } = req.body || {};
      const entries = (await dbGet(KEY)) || [];
      const updated = entries.filter((e) => e.id !== id);
      await dbSet(KEY, updated);
      return res.status(200).json({ entries: updated });
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    return res.status(405).end("Method not allowed");
  } catch (err) {
    return res.status(500).json({ error: "Server error." });
  }
}
