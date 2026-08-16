import { dbGet, dbSet } from "../../../lib/db";
import { hashPassword, signToken, setSessionCookie } from "../../../lib/auth";

const USERS_INDEX_KEY = "artora-ai-users-index";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method not allowed");
  }

  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Naam, email, aur password zaroori hain." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password kam se kam 6 characters ka hona chahiye." });
  }

  const emailKey = "user:" + email.toLowerCase().trim();
  const existing = await dbGet(emailKey);
  if (existing) {
    return res.status(400).json({ error: "Is email se pehle hi account bana hua hai. Login karein." });
  }

  const userIndex = (await dbGet(USERS_INDEX_KEY)) || [];
  const isFirstUser = userIndex.length === 0;

  const passwordHash = await hashPassword(password);
  const user = {
    id: Date.now().toString(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role: isFirstUser ? "admin" : "user",
    createdAt: new Date().toISOString(),
  };

  await dbSet(emailKey, user);
  await dbSet(USERS_INDEX_KEY, [...userIndex, emailKey]);

  const token = signToken({ id: user.id, name: user.name, email: user.email, role: user.role });
  setSessionCookie(res, token);

  return res.status(200).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
