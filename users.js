import { dbGet } from "../../../lib/db";
import { getUserFromRequest } from "../../../lib/auth";

const USERS_INDEX_KEY = "artora-ai-users-index";

export default async function handler(req, res) {
  const admin = getUserFromRequest(req);
  if (!admin) return res.status(401).json({ error: "Login zaroori hai." });
  if (admin.role !== "admin") return res.status(403).json({ error: "Sirf admin dekh sakta hai." });

  try {
    const userKeys = (await dbGet(USERS_INDEX_KEY)) || [];
    const users = [];
    for (const key of userKeys) {
      const u = await dbGet(key);
      if (u) {
        users.push({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt });
      }
    }
    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ users });
  } catch {
    return res.status(500).json({ error: "Server error." });
  }
}
