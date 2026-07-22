import { Router } from "express";
import type { Request, Response } from "express";

export const folderLockRouter = Router();

const DB_URL = () => (process.env.FIREBASE_DATABASE_URL ?? "").replace(/\/$/, "");

// ── GET /api/folder-lock/:folderId — is this folder locked? (public REST) ──
folderLockRouter.get("/:folderId", async (req: Request, res: Response): Promise<void> => {
  const folderId = req.params["folderId"] as string;
  const dbUrl = DB_URL();
  if (!dbUrl) { res.json({ locked: false }); return; }
  try {
    const r = await fetch(`${dbUrl}/folder_passwords/${encodeURIComponent(folderId)}.json`);
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

// ── POST /api/folder-lock/:folderId/verify — verify password (public REST) ─
folderLockRouter.post("/:folderId/verify", async (req: Request, res: Response): Promise<void> => {
  const folderId = req.params["folderId"] as string;
  const { password } = req.body as { password?: string };
  const dbUrl = DB_URL();
  if (!dbUrl) { res.json({ ok: false }); return; }
  try {
    const r = await fetch(`${dbUrl}/folder_passwords/${encodeURIComponent(folderId)}.json`);
    if (!r.ok) { res.json({ ok: false }); return; }
    const val = await r.json() as { password?: string } | null;
    res.json({ ok: !!val?.password && val.password === password });
  } catch {
    res.json({ ok: false });
  }
});
