import { Router } from "express";
import type { Request, Response } from "express";

export const folderLockRouter = Router();

const DB_URL = () => (process.env.FIREBASE_DATABASE_URL ?? "").replace(/\/$/, "");

// Use Firebase Database Secret (?auth=) for all server-side reads/writes.
// This bypasses security rules entirely — folder_passwords stay fully private from clients.
function fbUrl(dbUrl: string, path: string): string {
  const secret = process.env.FIREBASE_DATABASE_SECRET ?? "";
  const base = `${dbUrl}/${path}.json`;
  return secret ? `${base}?auth=${secret}` : base;
}

// ── GET /api/folder-lock — list ALL folder passwords (admin) ──
folderLockRouter.get("/", async (_req: Request, res: Response): Promise<void> => {
  const dbUrl = DB_URL();
  if (!dbUrl) { res.json({}); return; }
  try {
    const r = await fetch(fbUrl(dbUrl, "folder_passwords"));
    if (!r.ok) { res.json({}); return; }
    const val = await r.json() as Record<string, { password?: string; hint?: string; name?: string }> | null;
    res.json(val ?? {});
  } catch {
    res.json({});
  }
});

// ── GET /api/folder-lock/:folderId — is this folder locked? ──
folderLockRouter.get("/:folderId", async (req: Request, res: Response): Promise<void> => {
  const folderId = req.params["folderId"] as string;
  const dbUrl = DB_URL();
  // Prevent browser from caching lock state — new locks must always be seen immediately
  res.setHeader("Cache-Control", "no-store");
  if (!dbUrl) { res.json({ locked: false }); return; }
  try {
    const r = await fetch(fbUrl(dbUrl, `folder_passwords/${encodeURIComponent(folderId)}`));
    if (!r.ok) { res.json({ locked: false }); return; }
    const val = await r.json() as { password?: string; hint?: string; name?: string } | null;
    if (val?.password) {
      res.json({ locked: true, hint: val.hint ?? null, name: val.name ?? null });
    } else {
      res.json({ locked: false });
    }
  } catch {
    res.json({ locked: false });
  }
});

// ── POST /api/folder-lock/:folderId/verify — verify password ──
folderLockRouter.post("/:folderId/verify", async (req: Request, res: Response): Promise<void> => {
  const folderId = req.params["folderId"] as string;
  const { password } = req.body as { password?: string };
  const dbUrl = DB_URL();
  if (!dbUrl) { res.json({ ok: false }); return; }
  try {
    const r = await fetch(fbUrl(dbUrl, `folder_passwords/${encodeURIComponent(folderId)}`));
    if (!r.ok) { res.json({ ok: false }); return; }
    const val = await r.json() as { password?: string } | null;
    res.json({ ok: !!val?.password && val.password === password });
  } catch {
    res.json({ ok: false });
  }
});

// ── POST /api/folder-lock/:folderId — save/set a folder password ──
folderLockRouter.post("/:folderId", async (req: Request, res: Response): Promise<void> => {
  const folderId = req.params["folderId"] as string;
  const { password, hint, name } = req.body as { password?: string; hint?: string; name?: string };
  const dbUrl = DB_URL();
  if (!dbUrl) { res.status(500).json({ ok: false, error: "No database URL" }); return; }
  if (!password?.trim()) { res.status(400).json({ ok: false, error: "Password required" }); return; }
  try {
    const data = { folderId, password: password.trim(), hint: hint?.trim() || null, name: name || folderId };
    const r = await fetch(fbUrl(dbUrl, `folder_passwords/${encodeURIComponent(folderId)}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      const text = await r.text();
      res.status(500).json({ ok: false, error: text });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ── DELETE /api/folder-lock/:folderId — remove a folder password ──
folderLockRouter.delete("/:folderId", async (req: Request, res: Response): Promise<void> => {
  const folderId = req.params["folderId"] as string;
  const dbUrl = DB_URL();
  if (!dbUrl) { res.status(500).json({ ok: false, error: "No database URL" }); return; }
  try {
    const r = await fetch(fbUrl(dbUrl, `folder_passwords/${encodeURIComponent(folderId)}`), { method: "DELETE" });
    if (!r.ok) {
      const text = await r.text();
      res.status(500).json({ ok: false, error: text });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});
