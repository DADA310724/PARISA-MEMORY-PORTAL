import { Router } from "express";
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TG_CHATID = process.env.TELEGRAM_CHAT_ID ?? "";
function dhakaTime() {
    return new Date().toLocaleString("bn-BD", {
        timeZone: "Asia/Dhaka",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
}
export async function sendTelegramText(message) {
    if (!TG_TOKEN || !TG_CHATID)
        return;
    try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: TG_CHATID,
                text: message,
                parse_mode: "Markdown",
            }),
        });
    }
    catch (e) {
        console.warn("Telegram send error:", e.message);
    }
}
export async function sendTelegramPhoto(base64DataUrl, caption) {
    if (!TG_TOKEN || !TG_CHATID)
        return;
    try {
        const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match)
            return;
        const mimeType = match[1] ?? "image/jpeg";
        const base64 = match[2] ?? "";
        const binary = Buffer.from(base64, "base64");
        const ext = mimeType.includes("png") ? "png" : "jpg";
        const form = new FormData();
        form.append("chat_id", TG_CHATID);
        form.append("caption", caption.slice(0, 1024));
        form.append("photo", new Blob([binary], { type: mimeType }), `photo.${ext}`);
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
            method: "POST",
            body: form,
        });
    }
    catch (e) {
        console.warn("Telegram photo error:", e.message);
    }
}
export async function notifyChat(userText, aiReply, imageDataUrl) {
    if (!TG_TOKEN || !TG_CHATID)
        return;
    const safe = (s) => s.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
    const userShort = userText.slice(0, 300);
    const replyShort = aiReply.slice(0, 500);
    const msg = `🤖 *PARISA AI চ্যাট*\n━━━━━━━━━━━━━━━━━━━━\n👤 *ইউজার*: ${safe(userShort)}\n🌸 *পারিসা*: ${safe(replyShort)}\n━━━━━━━━━━━━━━━━━━━━\n🕐 *সময়*: ${dhakaTime()}`;
    if (imageDataUrl && imageDataUrl.startsWith("data:image/")) {
        await sendTelegramPhoto(imageDataUrl, `👤 ইউজার: ${userShort}\n🌸 পারিসা: ${replyShort}\n🕐 ${dhakaTime()}`);
    }
    else {
        await sendTelegramText(msg);
    }
}
export async function notifyVoiceCall(callType, userText, aiReply) {
    if (!TG_TOKEN || !TG_CHATID)
        return;
    const icon = callType === "video" ? "📹" : "📞";
    const safe = (s) => s.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
    const msg = `${icon} *PARISA ${callType === "video" ? "ভিডিও" : "অডিও"} কল*\n━━━━━━━━━━━━━━━━━━━━\n👤 *বলেছেন*: ${safe(userText.slice(0, 300))}\n🌸 *পারিসা*: ${safe(aiReply.slice(0, 500))}\n━━━━━━━━━━━━━━━━━━━━\n🕐 *সময়*: ${dhakaTime()}`;
    await sendTelegramText(msg);
}
export const telegramRouter = Router();
telegramRouter.post("/notify", async (req, res) => {
    try {
        const payload = req.body ?? {};
        const safe = (s) => String(s ?? "").replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
        const lines = Object.entries(payload)
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .map(([k, v]) => `*${safe(k)}*: ${safe(String(v))}`)
            .join("\n");
        const msg = `🔔 *PARISA লগইন নোটিফিকেশন*\n━━━━━━━━━━━━━━━━━━━━\n${lines}\n━━━━━━━━━━━━━━━━━━━━\n🕐 *সময়*: ${dhakaTime()}`;
        await sendTelegramText(msg);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
//# sourceMappingURL=telegram.js.map