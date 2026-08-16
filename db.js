// Shared helper for talking to Upstash Redis REST API

async function upstash(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Upstash env vars missing");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error("Upstash request failed");
  return res.json();
}

export async function dbGet(key) {
  try {
    const result = await upstash(["GET", key]);
    return result.result ? JSON.parse(result.result) : null;
  } catch {
    return null;
  }
}

export async function dbSet(key, value) {
  try {
    await upstash(["SET", key, JSON.stringify(value)]);
    return true;
  } catch {
    return false;
  }
}

export async function dbDel(key) {
  try {
    await upstash(["DEL", key]);
    return true;
  } catch {
    return false;
  }
}
