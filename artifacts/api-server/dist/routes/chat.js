import { Router } from "express";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const chatRouter = Router();
let _db = null;
function getDb() {
    if (_db)
        return _db;
    try {
        // In dist/routes/chat.js, __dirname = dist/routes/ → go up one level
        const fp = path.join(__dirname, "../chat_database.json");
        _db = JSON.parse(fs.readFileSync(fp, "utf8"));
        return _db;
    }
    catch {
        // Fallback: try same directory (dev mode src/routes/)
        try {
            const fp2 = path.join(__dirname, "chat_database.json");
            _db = JSON.parse(fs.readFileSync(fp2, "utf8"));
            return _db;
        }
        catch {
            return [];
        }
    }
}
function normConv(s) { return s.toLowerCase().replace(/[\s_\-\.]/g, ""); }
chatRouter.post("/search", (req, res) => {
    const { date, // YYYY, YYYY-MM, or YYYY-MM-DD
    keyword, // text to search in message body
    conversation, // conversation chat_id (partial match ok)
    limit = 200, } = req.body;
    if (!date && !keyword && !conversation) {
        res.json({ results: "", total: 0 });
        return;
    }
    const db = getDb();
    const lines = [];
    const kwLow = (keyword || "").toLowerCase().trim();
    const convNorm = conversation ? normConv(conversation) : "";
    for (const conv of db) {
        if (convNorm) {
            const idNorm = normConv(conv.chat_id);
            if (!idNorm.includes(convNorm) && !convNorm.includes(idNorm))
                continue;
        }
        const convLabel = `[${conv.chat_id} / ${conv.platform}]`;
        let added = 0;
        for (const msg of conv.messages) {
            if (date && !msg.timestamp.startsWith(date))
                continue;
            if (kwLow) {
                const mLow = (msg.message || "").toLowerCase();
                if (!mLow.includes(kwLow))
                    continue;
            }
            if (added === 0)
                lines.push(`\n--- ${convLabel} ---`);
            lines.push(`[${msg.timestamp}] ${msg.sender}: ${msg.message}`);
            added++;
            if (lines.length >= limit)
                break;
        }
        if (lines.length >= limit)
            break;
    }
    res.json({ results: lines.join("\n"), total: lines.length });
});
chatRouter.get("/conversations", (_req, res) => {
    const db = getDb();
    res.json(db.map(c => ({
        id: c.chat_id, platform: c.platform, total: c.total_messages,
        first: c.messages[0]?.timestamp, last: c.messages[c.messages.length - 1]?.timestamp,
    })));
});
//# sourceMappingURL=chat.js.map