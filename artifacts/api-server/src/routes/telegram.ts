import { Router } from "express";
import type { Request, Response } from "express";

export const telegramRouter = Router();

function dhaka(): string {
  return new Date().toLocaleString("bn-BD", {
    timeZone: "Asia/Dhaka",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const LOGIN_EVENTS = new Set([
  "user_login_success", "user_login_failed",
  "admin_login_success", "admin_login_failed",
]);

function parseBrowserInfo(raw: string) {
  const parts = raw.split("|");
  return {
    browser:   parts[0] ?? "",
    os:        parts[1] ?? "",
    device:    parts[2] ?? "",
    screen:    parts[3] ?? "",
    viewport:  parts[4] ?? "",
    lang:      parts[5] ?? "",
    tz:        parts[6] ?? "",
    network:   parts[7] ?? "",
    cores:     parts[8] ?? "",
    mem:       parts[9] ?? "",
  };
}

function formatLoginMessage(payload: Record<string, unknown>): string {
  const event    = String(payload.event ?? "");
  const isSuccess = String(payload.success) === "true";
  const role     = String(payload.role ?? "user").toUpperCase();
  const location = String(payload.location ?? "").trim();
  const rawBrowser = String(payload.browserInfo ?? "");
  const extra    = String(payload.extra ?? "").trim();
  const ua       = String(payload.userAgent ?? "").trim();

  const header = isSuccess
    ? `🔓 *লগইন সফল — ${role}*`
    : `🚨 *লগইন ব্যর্থ — ${role}*`;

  const lines: string[] = [header, "━━━━━━━━━━━━━━━━━━━━"];

  const identifier = String(payload.identifier ?? "").trim();
  if (identifier && identifier !== "unknown") {
    lines.push(`👤 *পরিচয়*: ${identifier}`);
  }

  if (location) {
    lines.push(`📍 *লোকেশন*: ${location}`);
  } else {
    lines.push(`📍 *লোকেশন*: অনুমতি দেওয়া হয়নি`);
  }

  if (rawBrowser) {
    const b = parseBrowserInfo(rawBrowser);
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push(`🌐 *ব্রাউজার*: ${b.browser}`);
    lines.push(`💻 *অপারেটিং সিস্টেম*: ${b.os}`);
    lines.push(`📱 *ডিভাইস*: ${b.device}`);
    if (b.screen)   lines.push(`🖥️ *স্ক্রিন রেজোলিউশন*: ${b.screen}`);
    if (b.viewport) lines.push(`🪟 *ভিউপোর্ট*: ${b.viewport}`);
    if (b.lang)     lines.push(`🗣️ *ভাষা*: ${b.lang}`);
    if (b.tz)       lines.push(`⏰ *টাইমজোন*: ${b.tz}`);
    if (b.network)  lines.push(`📶 *নেটওয়ার্ক*: ${b.network}`);
    if (b.cores)    lines.push(`⚙️ *প্রসেসর*: ${b.cores}`);
    if (b.mem)      lines.push(`🧠 *মেমরি*: ${b.mem}`);
  }

  if (ua) {
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push(`🔍 *User Agent*:\n\`${ua.slice(0, 300)}\``);
  }

  if (extra) {
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push(`⚠️ *বিবরণ*: ${extra}`);
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push(`🕐 *সময়*: ${dhaka()}`);

  return lines.join("\n");
}

const EMOJI: Record<string, string> = {
  folder_opened:    "📂",
  file_opened:      "👁️",
  file_closed:      "⏱️",
  ai_chat:          "🤖",
  ai_chat_message:  "🤖",
  file_viewed:      "📄",
  portal_opened:    "🌐",
};

function formatGenericMessage(payload: Record<string, unknown>): string {
  const event = String(payload.event ?? "notify");
  const emoji = EMOJI[event] ?? "📨";
  const lines: string[] = [`${emoji} *PARISA PORTAL — ${event.toUpperCase()}*`];
  const skip = new Set(["event", "browserInfo"]);
  for (const [k, v] of Object.entries(payload)) {
    if (skip.has(k) || v === undefined || v === null || v === "") continue;
    lines.push(`*${k}*: ${String(v).slice(0, 400)}`);
  }
  lines.push(`*সময়*: ${dhaka()}`);
  return lines.join("\n");
}

telegramRouter.post("/notify", async (req: Request, res: Response) => {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    res.json({ ok: false, reason: "telegram not configured" });
    return;
  }

  try {
    const payload = req.body as Record<string, unknown>;
    const event   = String(payload.event ?? "");
    const text    = LOGIN_EVENTS.has(event)
      ? formatLoginMessage(payload)
      : formatGenericMessage(payload);

    const resp = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
      },
    );
    const data = await resp.json() as { ok: boolean };
    res.json({ ok: data.ok });
  } catch (err) {
    console.error("Telegram notify error", err);
    res.json({ ok: false, error: String(err) });
  }
});
