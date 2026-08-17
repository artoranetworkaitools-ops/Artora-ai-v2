import { dbGet } from "../../../lib/db";
import { getUserFromRequest } from "../../../lib/auth";

const MEMORY_KEY = "artora-ai-memory";

export default async function handler(req, res) {
  const admin = getUserFromRequest(req);
  if (!admin) return res.status(401).json({ error: "Login zaroori hai." });
  if (admin.role !== "admin") return res.status(403).json({ error: "Sirf admin dekh sakta hai." });

  try {
    const history = (await dbGet(MEMORY_KEY)) || [];
    return res.status(200).json({ history: [...history].reverse().slice(0, 150) });
  } catch {
    return res.status(500).json({ error: "Server error." });
  }
}
