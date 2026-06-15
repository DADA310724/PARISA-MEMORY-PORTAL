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

function searchChatDB(query: string): string {
  if (!FLAT_DB.length) return "";
  const q = query.toLowerCase();

  let results: FlatMsg[] = [];

  const dateMatch = q.match(/(\d{4})[-\/\s]?(\d{1,2})[-\/\s]?(\d{1,2})?/) ||
                    q.match(/(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})/);
  if (dateMatch) {
    results = FLAT_DB.filter(m => m.timestamp.toLowerCase().includes(dateMatch[0].replace(/\s/g, ""))).slice(0, 80);
  }

  if (!results.length) {
    const keywords = q
      .split(/[\s,।]+/)
      .filter(w => w.length > 2)
      .slice(0, 5);
    if (keywords.length) {
      results = FLAT_DB.filter(m => {
        const text = (m.message + " " + m.sender).toLowerCase();
        return keywords.some(kw => text.includes(kw));
      }).slice(0, 60);
    }
  }

  if (!results.length) return "";

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
  for (const key of uniqueKeys) {
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
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: systemPrompt },
              ...messages,
            ],
            max_tokens: 1500,
            temperature: 0.85,
          }),
        },
      );
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        console.warn(`Groq HTTP ${resp.status}: ${errBody.slice(0, 200)}`);
        continue;
      }
      const data = (await resp.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (e) {
      console.warn("Groq fetch error:", (e as Error).message);
      continue;
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

  const geminiModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
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
