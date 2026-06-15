import { Router } from "express";
import type { Request, Response } from "express";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

export const aiRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  systemPrompt?: string;
  provider?: string;
  groqKeys?: string[];
  geminiKeys?: string[];
  openrouterKeys?: string[];
}

interface RawMsg {
  sender: string;
  message: string;
  timestamp: string;
}
interface ChatConvo {
  chat_id: string;
  platform: string;
  total_messages: number;
  messages: RawMsg[];
}
interface FlatMsg {
  chat_id: string;
  platform: string;
  sender: string;
  message: string;
  timestamp: string;
}

let FLAT_DB: FlatMsg[] = [];
try {
  const dbPath = path.join(__dirname, "../chat_database.json");
  if (existsSync(dbPath)) {
    const raw = JSON.parse(readFileSync(dbPath, "utf-8")) as ChatConvo[];
    for (const convo of raw) {
      for (const m of convo.messages) {
        FLAT_DB.push({
          chat_id: convo.chat_id,
          platform: convo.platform,
          sender: m.sender,
          message: m.message,
          timestamp: m.timestamp,
        });
      }
    }
    console.log(`✅ Chat DB loaded — ${FLAT_DB.length} messages across ${raw.length} conversations`);
  }
} catch (e) {
  console.warn("Chat DB load error:", (e as Error).message);
}

const ENGLISH_MONTHS: Record<string, string> = {
  january:"01", february:"02", march:"03", april:"04", may:"05", june:"06",
  july:"07", august:"08", september:"09", october:"10", november:"11", december:"12",
  jan:"01", feb:"02", mar:"03", apr:"04", jun:"06", jul:"07",
  aug:"08", sep:"09", oct:"10", nov:"11", dec:"12",
};
const BENGALI_MONTHS: Record<string, string> = {
  জানুয়ারি:"01", ফেব্রুয়ারি:"02", মার্চ:"03", এপ্রিল:"04",
  মে:"05", জুন:"06", জুলাই:"07", আগস্ট:"08",
  সেপ্টেম্বর:"09", অক্টোবর:"10", নভেম্বর:"11", ডিসেম্বর:"12",
};
const ALL_MONTHS = { ...ENGLISH_MONTHS, ...BENGALI_MONTHS };

const CHAT_NAME_MAP: Record<string, string[]> = {
  "nusrat_parisa":     ["nusrat_parisa", "nusrat jahan parisa", "নুসরাত পারিসা", "পারু", "পারিসা", "parisa"],
  "nusrat_jahan_parisa": ["nusrat_jahan_parisa", "নুসরাত"],
  "my_wife":           ["my_wife", "স্ত্রী", "wife"],
  "nusrat_janan_parisa": ["nusrat_janan_parisa", "messenger"],
  "telegram_chat":     ["telegram_chat", "telegram", "টেলিগ্রাম"],
  "jerin_harding":     ["jerin_harding", "jerin", "জেরিন"],
  "parisa":            ["parisa whatsapp", "parisa group"],
  "parisa_gp":         ["parisa_gp", "parisa group", "গ্রুপ"],
  "anisha_sister":     ["anisha", "আনিশা", "sister", "বোন"],
  "hafizur_rahman_uncle": ["hafizur", "uncle", "হাফিজুর", "চাচা"],
  "hafizur_rahman":    ["hafizur_rahman"],
  "fatema_jannat":     ["fatema", "ফাতেমা"],
  "tanha_islam":       ["tanha", "তানহা"],
};

function parseDateFilter(q: string): string | null {
  const iso = q.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2,"0")}-${iso[3].padStart(2,"0")}`;

  const dmy = q.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;

  const yearOnly = q.match(/(\d{4})/);
  for (const [mname, mnum] of Object.entries(ALL_MONTHS)) {
    if (q.includes(mname)) {
      const dayMatch = q.match(/(\d{1,2})\s*(?:তারিখ|ই|st|nd|rd|th)?/);
      const day = dayMatch ? dayMatch[1].padStart(2,"0") : null;
      if (yearOnly && day) return `${yearOnly[1]}-${mnum}-${day}`;
      if (yearOnly) return `${yearOnly[1]}-${mnum}`;
      if (day) return `-${mnum}-${day}`;
      return `-${mnum}-`;
    }
  }

  if (yearOnly && !q.match(/\d{5,}/)) return yearOnly[1];
  return null;
}

function getContextWindow(allMsgs: FlatMsg[], matchIndex: number, window = 5): FlatMsg[] {
  const start = Math.max(0, matchIndex - window);
  const end = Math.min(allMsgs.length - 1, matchIndex + window);
  return allMsgs.slice(start, end + 1);
}

function searchChatDB(query: string): string {
  if (!FLAT_DB.length) return "";
  const q = query.toLowerCase();

  const dateFilter = parseDateFilter(q);

  let chatFilter: string | null = null;
  for (const [chatId, aliases] of Object.entries(CHAT_NAME_MAP)) {
    if (aliases.some(a => q.includes(a.toLowerCase()))) {
      chatFilter = chatId;
      break;
    }
  }
  let platformFilter: string | null = null;
  if (q.includes("whatsapp") || q.includes("ওয়াটসঅ্যাপ")) platformFilter = "whatsapp";
  else if (q.includes("messenger") || q.includes("মেসেঞ্জার") || q.includes("facebook")) platformFilter = "facebook messenger";
  else if (q.includes("telegram") || q.includes("টেলিগ্রাম")) platformFilter = "telegram";

  let pool = FLAT_DB;
  if (chatFilter) pool = pool.filter(m => m.chat_id.toLowerCase() === chatFilter);
  else if (platformFilter) pool = pool.filter(m => m.platform.toLowerCase().includes(platformFilter!));

  if (dateFilter) {
    const dated = pool.filter(m => m.timestamp.includes(dateFilter!));
    if (dated.length > 0) {
      const chatGroups = new Map<string, FlatMsg[]>();
      for (const m of pool) {
        const key = m.chat_id;
        if (!chatGroups.has(key)) chatGroups.set(key, []);
        chatGroups.get(key)!.push(m);
      }
      const results: FlatMsg[] = [];
      for (const m of dated.slice(0, 15)) {
        const group = chatGroups.get(m.chat_id) ?? [];
        const idx = group.indexOf(m);
        const ctx = getContextWindow(group, idx, 4);
        for (const c of ctx) {
          if (!results.includes(c)) results.push(c);
        }
        if (results.length >= 100) break;
      }
      return results
        .map(m => `[${m.platform}][${m.chat_id}][${m.timestamp}] ${m.sender}: ${m.message}`)
        .join("\n");
    }
  }

  const stopWords = new Set(["আমি","তুমি","আমার","তোমার","এই","সেই","কি","কে","কোন","থেকে","এবং","কিন্তু","the","is","are","was","were","and","or","but","in","on","at","to","for","of","with","a","an","না","হ্যাঁ","হয়","করা","করে","করি","যে","যা","হয়েছে"]);
  const keywords = q.split(/[\s,।!?]+/).filter(w => w.length > 2 && !stopWords.has(w)).slice(0, 8);

  if (!keywords.length) return "";

  const chatGroups = new Map<string, FlatMsg[]>();
  for (const m of pool) {
    if (!chatGroups.has(m.chat_id)) chatGroups.set(m.chat_id, []);
    chatGroups.get(m.chat_id)!.push(m);
  }

  const matches: { msg: FlatMsg; score: number; idx: number }[] = [];
  for (const [, group] of chatGroups) {
    for (let i = 0; i < group.length; i++) {
      const m = group[i];
      const text = (m.message + " " + m.sender).toLowerCase();
      const score = keywords.reduce((s, kw) => s + (text.includes(kw) ? 1 : 0), 0);
      if (score > 0) matches.push({ msg: m, score, idx: i });
    }
  }

  if (!matches.length) return "";

  matches.sort((a, b) => b.score - a.score);
  const results: FlatMsg[] = [];
  const groupMap = new Map<string, FlatMsg[]>();
  for (const [, g] of chatGroups) groupMap.set(g[0]?.chat_id ?? "", g);

  for (const { msg, idx } of matches.slice(0, 10)) {
    const group = chatGroups.get(msg.chat_id) ?? [];
    const ctx = getContextWindow(group, idx, 3);
    for (const c of ctx) if (!results.includes(c)) results.push(c);
    if (results.length >= 80) break;
  }

  return results
    .map(m => `[${m.platform}][${m.chat_id}][${m.timestamp}] ${m.sender}: ${m.message}`)
    .join("\n");
}

function getEnvKeys(envVar: string): string[] {
  const val = process.env[envVar] ?? "";
  return val
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function tryGroq(
  keys: string[],
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
  const allKeys = shuffle([...keys, ...getEnvKeys("GROQ_API_KEYS")]);
  const uniqueKeys = [...new Set(allKeys)].filter(Boolean);
  if (!uniqueKeys.length) throw new Error("No Groq keys");
  // Use smaller/faster models first to avoid 413 token limit errors
  const groqModels = ["llama-3.1-8b-instant", "llama3-8b-8192", "llama-3.3-70b-versatile"];
  // Truncate system prompt to ~5000 chars to stay within token limits
  const safePrompt = systemPrompt.length > 5000
    ? systemPrompt.slice(0, 5000) + "\n[প্রম্পট সংক্ষিপ্ত করা হয়েছে]"
    : systemPrompt;
  for (const key of uniqueKeys) {
    for (const model of groqModels) {
      try {
        const resp = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: safePrompt },
                ...messages,
              ],
              max_tokens: 1200,
              temperature: 0.85,
            }),
          },
        );
        if (!resp.ok) {
          const errBody = await resp.text().catch(() => "");
          console.warn(`Groq ${model} HTTP ${resp.status}: ${errBody.slice(0, 200)}`);
          continue;
        }
        const data = (await resp.json()) as {
          choices: Array<{ message: { content: string } }>;
        };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      } catch (e) {
        console.warn(`Groq ${model} fetch error:`, (e as Error).message);
        continue;
      }
    }
  }
  throw new Error("All Groq keys failed");
}

async function tryGemini(
  keys: string[],
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
  const allKeys = shuffle([...keys, ...getEnvKeys("GEMINI_API_KEYS")]);
  const uniqueKeys = [...new Set(allKeys)].filter(Boolean);

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const geminiModels = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash-latest"];
  for (const key of uniqueKeys) {
    for (const model of geminiModels) {
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents,
              generationConfig: { maxOutputTokens: 1500, temperature: 0.85 },
            }),
          },
        );
        if (!resp.ok) {
          const errBody = await resp.text().catch(() => "");
          console.warn(`Gemini ${model} HTTP ${resp.status}: ${errBody.slice(0, 200)}`);
          continue;
        }
        const data = (await resp.json()) as {
          candidates: Array<{
            content: { parts: Array<{ text: string }> };
          }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      } catch (e) {
        console.warn(`Gemini ${model} fetch error:`, (e as Error).message);
        continue;
      }
    }
  }
  throw new Error("All Gemini keys failed");
}

async function tryOpenRouter(
  keys: string[],
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
  const allKeys = shuffle([...keys, ...getEnvKeys("OPENROUTER_API_KEYS")]);
  const uniqueKeys = [...new Set(allKeys)].filter(Boolean);
  if (!uniqueKeys.length) throw new Error("No OpenRouter keys");
  for (const key of uniqueKeys) {
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          max_tokens: 1500,
        }),
      });
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        console.warn(`OpenRouter HTTP ${resp.status}: ${errBody.slice(0, 200)}`);
        continue;
      }
      const data = (await resp.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (e) {
      console.warn("OpenRouter fetch error:", (e as Error).message);
      continue;
    }
  }
  throw new Error("All OpenRouter keys failed");
}

aiRouter.post("/chat", async (req: Request, res: Response) => {
  const {
    messages = [],
    systemPrompt = "",
    groqKeys = [],
    geminiKeys = [],
    openrouterKeys = [],
  } = req.body as ChatRequest;

  const lastUserMsg =
    messages.filter((m) => m.role === "user").pop()?.content ?? "";
  const chatContext = searchChatDB(lastUserMsg);
  const enhancedPrompt = chatContext
    ? `${systemPrompt}\n\n=== প্রাসঙ্গিক চ্যাট হিস্টরি ===\n${chatContext}\n=== শেষ ===`
    : systemPrompt;

  const providers: Array<{
    name: string;
    fn: () => Promise<string>;
  }> = [
    {
      name: "groq",
      fn: () => tryGroq(groqKeys, messages, enhancedPrompt),
    },
    {
      name: "gemini",
      fn: () => tryGemini(geminiKeys, messages, enhancedPrompt),
    },
    {
      name: "openrouter",
      fn: () => tryOpenRouter(openrouterKeys, messages, enhancedPrompt),
    },
  ];

  for (const p of providers) {
    try {
      const text = await p.fn();
      res.json({ text, provider: p.name });
      return;
    } catch (err) {
      console.warn(`${p.name} failed:`, err);
    }
  }

  res.status(503).json({ error: "All AI providers failed" });
});
