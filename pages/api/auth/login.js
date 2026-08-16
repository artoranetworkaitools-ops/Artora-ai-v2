import { dbGet } from "../../../lib/db";
import { comparePassword, signToken, setSessionCookie } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method not allowed");
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email aur password zaroori hain." });
  }

  const emailKey = "user:" + email.toLowerCase().trim();
  const user = await dbGet(emailKey);
  if (!user) {
    return res.status(401).json({ error: "Ye email register nahi hai. Pehle signup karein." });
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Password ghalat hai." });
  }

  const token = signToken({ id: user.id, name: user.name, email: user.email, role: user.role });
  setSessionCookie(res, token);

  return res.status(200).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
