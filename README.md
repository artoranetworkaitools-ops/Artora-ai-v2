# Artora AI — Free standalone chatbot

Ye ek chat website hai jo apne alag URL se team access kar sakti hai
(jaise `artora-ai.vercel.app`), Claude.ai se bahar, poori tarah free.

## Kya milega
- Chat interface (Artora branding: black + cyan)
- Shared knowledge base — koi bhi team member data add kare, sabko dikhega
- Web search toggle — Google jaisi live search
- 100% free (koi credit card zaroori nahi)

---

## Step 1 — GitHub account banayein (agar nahi hai)
1. https://github.com/signup par jayein
2. Email + username + password se account bana lein

## Step 2 — Is code ko GitHub par upload karein
1. https://github.com/new par jayein, naya repo banayein: `artora-ai`
2. Us repo ke "Upload files" button se is poore folder (`artora-ai`) ke andar ki
   saari files aur folders upload kar dein (drag & drop kar sakte hain)
3. "Commit changes" dabayein

## Step 3 — Free API keys banayein (3 services, sab free)

### A) Groq (AI brain — required)
1. https://console.groq.com par jayein, Google/email se signup karein
2. Left menu se "API Keys" > "Create API Key"
3. Key copy kar lein — ye `GROQ_API_KEY` hai

### B) Upstash (shared knowledge base storage — required)
1. https://console.upstash.com par jayein, signup karein
2. "Create Database" > naam dein (artora-ai) > Region: kisi bhi nearby region (Singapore ya Mumbai)
3. Database khulne ke baad "REST API" section mein do cheezein milengi:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Dono copy kar lein

### C) Tavily (web search — optional, agar search toggle chahiye)
1. https://tavily.com par jayein, signup karein
2. Dashboard se API key copy kar lein — ye `TAVILY_API_KEY` hai
3. Agar ye skip karte hain, chatbot phir bhi kaam karega — bas "Search: On"
   toggle se koi live results nahi aayenge

## Step 4 — Vercel par deploy karein
1. https://vercel.com par jayein, "Continue with GitHub" se signup karein
2. "Add New" > "Project" > apna `artora-ai` repo select karein > "Import"
3. Deploy hone se pehle "Environment Variables" section mein ye 4 add karein:
   - `GROQ_API_KEY` → Step 3A wali key
   - `UPSTASH_REDIS_REST_URL` → Step 3B wali URL
   - `UPSTASH_REDIS_REST_TOKEN` → Step 3B wali token
   - `TAVILY_API_KEY` → Step 3C wali key (agar banayi hai)
4. "Deploy" dabayein — 1-2 minute mein live ho jayega
5. Aapko ek URL milega jaise `artora-ai-yourname.vercel.app` — yahi link
   team ko bhej dein

---

## Baad mein domain change karna ho (chat.artoranetwork.com)
Vercel project ke "Settings" > "Domains" mein jaake apna subdomain add kar
sakte hain — DNS mein ek CNAME record artoranetwork.com ke DNS provider
(jahan domain kharida tha) mein add karna hoga. Jab is stage par pahunche
to bata dein, poora step-by-step de dunga.

## Kuch masla aaye to
- Chatbot jawab na de → Vercel project > Settings > Environment Variables
  check karein, `GROQ_API_KEY` sahi hai ya nahi
- Knowledge base save na ho → Upstash URL/Token check karein
- Web search kaam na kare → Tavily key set hai ya nahi
