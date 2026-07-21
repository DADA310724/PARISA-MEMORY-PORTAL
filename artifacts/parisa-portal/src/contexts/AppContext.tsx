import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import {
  ensureFirebase,
  loadAppConfig,
  ref,
  onValue,
  set as fbSet,
  remove as fbRemove,
  get,
  type AppConfig,
} from "@/lib/firebase";
import { loadAuth, clearAuth, type AuthState } from "@/lib/auth";

export interface SubButton {
  id: string;
  label: string;
  description?: string;
  logo_key?: string;
  icon?: string;
  link_type?: "drive_folder" | "external" | "html";
  drive_folder_id?: string;
  link_value?: string;
  order: number;
  last_message?: string;
  badge?: number;
  updated_at?: number;
  file_count?: number;
}

export interface DashboardButton {
  id: string;
  label: string;
  icon: string;
  logo_key?: string;
  color?: string;
  drive_folder_id?: string;
  link_type?: "drive_folder" | "external" | "screenshot" | "html";
  link_value?: string;
  order: number;
  description?: string;
  file_count?: number;
  has_sub_buttons?: boolean;
}

interface AppCtx {
  config: AppConfig | null;
  auth: AuthState | null;
  setAuth: (a: AuthState | null) => void;
  isAdmin: boolean;
  logout: () => void;
  buttons: DashboardButton[];
  saveButton: (b: DashboardButton) => Promise<void>;
  deleteButton: (id: string) => Promise<void>;
  reorderButtons: (ids: string[]) => Promise<void>;
  getSubButtons: (buttonId: string) => Promise<SubButton[]>;
  saveSubButton: (buttonId: string, sub: SubButton) => Promise<void>;
  deleteSubButton: (buttonId: string, subId: string) => Promise<void>;
  reorderSubButtons: (buttonId: string, ids: string[]) => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<AppCtx | null>(null);

// Real Google Drive folder IDs
// Folder IDs are stored ONLY in Firebase (not hardcoded in JS bundle for privacy).
// Admin sets them via AdminSettings → Drive tab, and they persist in Firebase.
const KNOWN_FOLDER_IDS: Record<string, string> = {};

const DEFAULT_BUTTONS: Omit<DashboardButton, "id">[] = [
  { label: "WhatsApp",    icon: "whatsapp", logo_key: "whatsapp", color: "emerald", link_type: "drive_folder", drive_folder_id: KNOWN_FOLDER_IDS["WhatsApp"],    order: 1, description: "All Chats & Media", file_count: 0 },
  { label: "Messenger",   icon: "messenger", logo_key: "messenger", color: "sky",   link_type: "drive_folder", drive_folder_id: KNOWN_FOLDER_IDS["Messenger"],   order: 2, description: "Messages & Files",  file_count: 0 },
  { label: "Telegram",    icon: "telegram", logo_key: "telegram", color: "cyan",    link_type: "drive_folder", drive_folder_id: KNOWN_FOLDER_IDS["Telegram"],    order: 3, description: "Chats & Channels",  file_count: 0 },
  { label: "Photos",      icon: "photos",   logo_key: "photos",   color: "rose",    link_type: "drive_folder", drive_folder_id: KNOWN_FOLDER_IDS["Photos"],      order: 4, description: "Images & Gallery",  file_count: 0 },
  { label: "Videos",      icon: "videos",   logo_key: "videos",   color: "indigo",  link_type: "drive_folder", drive_folder_id: KNOWN_FOLDER_IDS["Videos"],      order: 5, description: "All Video Files",   file_count: 0 },
  { label: "Audio",       icon: "audio",    logo_key: "audio",    color: "amber",   link_type: "drive_folder", drive_folder_id: KNOWN_FOLDER_IDS["Audio"],       order: 6, description: "Voice & Audio Files", file_count: 0 },
  { label: "Black Magic", icon: "magic",    logo_key: "magic",    color: "violet",  link_type: "drive_folder", drive_folder_id: KNOWN_FOLDER_IDS["Black Magic"], order: 7, description: "Special & Hidden Area", file_count: 0 },
];

const FOLDER_NAME_MAP: Record<string, string> = {
  "WhatsApp":    "WhatsApp",
  "Messenger":   "Messenger",
  "Telegram":    "Telegram",
  "Photos":      "Photos",
  "Videos":      "Videos",
  "Audio":       "Audio",
  "Black Magic": "BlackMagic",
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [auth, setAuthState] = useState<AuthState | null>(loadAuth());
  const [buttons, setButtons] = useState<DashboardButton[]>([]);
  const [loading, setLoading] = useState(true);
  const subCache = useRef<Record<string, SubButton[]>>({});

  function setAuth(a: AuthState | null) {
    if (a) sessionStorage.setItem("parisa.auth", JSON.stringify(a));
    else clearAuth();
    setAuthState(a);
  }

  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const cfg = await loadAppConfig();
        setConfig(cfg);
        const db = await ensureFirebase();
        const buttonsRef = ref(db, "buttons");
        unsub = onValue(buttonsRef, async (snap) => {
          const v = snap.val() as Record<string, DashboardButton> | null;
          if (!v) {
            // First time: seed buttons with real folder IDs
            const { listFolder } = await import("@/lib/drive");
            let driveChildren: { name: string; id: string }[] = [];
            try {
              if (cfg.driveParentFolderId) {
                const r = await listFolder(cfg.driveParentFolderId);
                driveChildren = r.files
                  .filter((f) => f.mimeType === "application/vnd.google-apps.folder")
                  .map((f) => ({ name: f.name, id: f.id }));
              }
            } catch (e) {
              console.warn("drive seed list failed", e);
            }
            const seeded: Record<string, DashboardButton> = {};
            for (const def of DEFAULT_BUTTONS) {
              const id = crypto.randomUUID();
              const matchName = FOLDER_NAME_MAP[def.label];
              const match = matchName
                ? driveChildren.find((c) => c.name.toLowerCase() === matchName.toLowerCase())
                : undefined;
              // Use drive match, or known folder ID, or empty
              const folderId = match?.id ?? def.drive_folder_id ?? "";
              seeded[id] = { ...def, id, drive_folder_id: folderId };
            }
            await fbSet(buttonsRef, seeded);
            return;
          }
          // Migration: fill in known folder IDs for buttons that have empty drive_folder_id
          const needsMigration = Object.values(v).filter(
            (b) => b.link_type === "drive_folder" && !b.drive_folder_id && KNOWN_FOLDER_IDS[b.label]
          );
          if (needsMigration.length > 0) {
            for (const b of needsMigration) {
              const folderId = KNOWN_FOLDER_IDS[b.label];
              if (folderId) {
                await fbSet(ref(db, `buttons/${b.id}/drive_folder_id`), folderId);
              }
            }
          }
          const list = Object.values(v)
            .filter(b => b.id && b.label && b.label.trim().length > 0)
            .sort((a, b) => a.order - b.order);
          setButtons(list);
          setLoading(false);

          // Background auto-sync: update Drive file counts (skip if synced < 5 min ago)
          const driveBtns = list.filter(
            b => b.link_type === "drive_folder" && b.drive_folder_id,
          );
          if (driveBtns.length > 0) {
            const now = Date.now();
            const FIVE_MIN = 5 * 60 * 1000;
            const lastSync = Number(sessionStorage.getItem("drive_count_sync") ?? "0");
            if (now - lastSync > FIVE_MIN) {
              sessionStorage.setItem("drive_count_sync", String(now));
              (async () => {
                try {
                  const folderIds = driveBtns.map(b => b.drive_folder_id!);
                  const res = await fetch("/api/drive/count-folders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ folderIds }),
                  });
                  if (!res.ok) return;
                  const { counts } = await res.json() as { counts: Record<string, number> };
                  await Promise.all(
                    driveBtns.map(async b => {
                      const count = counts[b.drive_folder_id!];
                      if (typeof count === "number" && count !== b.file_count) {
                        await fbSet(ref(db, `buttons/${b.id}/file_count`), count);
                      }
                    }),
                  );
                } catch (e) {
                  console.warn("Drive count sync failed", e);
                }
              })();
            }
          }
        });
      } catch (e) {
        console.error("AppContext init failed", e);
        setLoading(false);
      }
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  // ── Global background media prefetch — runs on every page, not just Dashboard ──
  useEffect(() => {
    if (loading || buttons.length === 0) return;
    const folderIds = buttons
      .filter(b => b.link_type === "drive_folder" && b.drive_folder_id)
      .map(b => b.drive_folder_id as string);
    if (folderIds.length === 0) return;

    // Only run once per session to avoid re-fetching on every navigation
    if (sessionStorage.getItem("media_prefetch_done") === "1") return;

    let cancelled = false;
    const proxyUrls: string[] = [];

    const prefetchFolder = async (folderId: string) => {
      try {
        const resp = await fetch(`/api/drive/list?folderId=${encodeURIComponent(folderId)}`);
        if (!resp.ok || cancelled) return;
        const data = await resp.json() as { files?: Array<{ id: string; mimeType?: string }> };
        const mediaFiles = (data.files || []).filter(f =>
          (f.mimeType || "").startsWith("video/") || (f.mimeType || "").startsWith("audio/")
        ).slice(0, 8); // up to 8 per folder
        for (const f of mediaFiles) {
          if (cancelled) return;
          const url = `/api/drive/proxy/${f.id}`;
          proxyUrls.push(url);
          try { await fetch(`/api/drive/prefetch/${f.id}`); } catch {}
          await new Promise<void>(r => setTimeout(r, 300));
        }
      } catch {}
    };

    const run = async () => {
      for (let i = 0; i < folderIds.length && !cancelled; i++) {
        await prefetchFolder(folderIds[i]);
        if (i < folderIds.length - 1 && !cancelled) await new Promise<void>(r => setTimeout(r, 600));
      }
      if (!cancelled && proxyUrls.length > 0 && navigator.serviceWorker?.controller) {
        // Tell service worker to cache all proxy URLs for offline use
        navigator.serviceWorker.controller.postMessage({ type: "PREFETCH_MEDIA", urls: proxyUrls });
      }
      sessionStorage.setItem("media_prefetch_done", "1");
    };

    const timer = setTimeout(run, 3000); // 3s delay so app loads first
    return () => { cancelled = true; clearTimeout(timer); };
  }, [buttons, loading]);

  async function saveButton(b: DashboardButton) {
    const db = await ensureFirebase();
    // Firebase RTDB rejects undefined values — strip them first
    const clean = JSON.parse(JSON.stringify(b)) as DashboardButton;
    if (!b.id) {
      // Use a single atomic write with a client-generated ID (avoids two-step push+set race)
      const id = crypto.randomUUID();
      await fbSet(ref(db, `buttons/${id}`), { ...clean, id });
    } else {
      await fbSet(ref(db, `buttons/${b.id}`), clean);
    }
  }

  async function deleteButton(id: string) {
    const db = await ensureFirebase();
    await fbRemove(ref(db, `buttons/${id}`));
  }

  async function reorderButtons(ids: string[]) {
    const db = await ensureFirebase();
    await Promise.all(
      ids.map((id, i) => fbSet(ref(db, `buttons/${id}/order`), i + 1)),
    );
  }

  async function getSubButtons(buttonId: string): Promise<SubButton[]> {
    // Return cache immediately if available, refresh in background
    if (subCache.current[buttonId]) {
      const cached = subCache.current[buttonId];
      (async () => {
        try {
          const db = await ensureFirebase();
          const snap = await get(ref(db, `sub_buttons/${buttonId}`));
          const v = snap.val() as Record<string, SubButton> | null;
          subCache.current[buttonId] = v ? Object.values(v).sort((a, b) => a.order - b.order) : [];
        } catch {}
      })();
      return cached;
    }
    const db = await ensureFirebase();
    const snap = await get(ref(db, `sub_buttons/${buttonId}`));
    const v = snap.val() as Record<string, SubButton> | null;
    const result = v ? Object.values(v).sort((a, b) => a.order - b.order) : [];
    subCache.current[buttonId] = result;
    return result;
  }

  async function saveSubButton(buttonId: string, sub: SubButton) {
    const db = await ensureFirebase();
    // Firebase RTDB rejects undefined values — strip them first
    const clean = JSON.parse(JSON.stringify(sub)) as SubButton;
    if (!sub.id) {
      const id = crypto.randomUUID();
      await fbSet(ref(db, `sub_buttons/${buttonId}/${id}`), { ...clean, id });
    } else {
      await fbSet(ref(db, `sub_buttons/${buttonId}/${sub.id}`), clean);
    }
    // Invalidate cache so next load gets fresh data
    delete subCache.current[buttonId];
    const parentBtn = buttons.find((b) => b.id === buttonId);
    if (parentBtn && !parentBtn.has_sub_buttons) {
      await fbSet(ref(db, `buttons/${buttonId}/has_sub_buttons`), true);
    }
  }

  async function deleteSubButton(buttonId: string, subId: string) {
    const db = await ensureFirebase();
    await fbRemove(ref(db, `sub_buttons/${buttonId}/${subId}`));
    // Invalidate cache
    delete subCache.current[buttonId];
    const snap = await get(ref(db, `sub_buttons/${buttonId}`));
    if (!snap.val()) {
      await fbSet(ref(db, `buttons/${buttonId}/has_sub_buttons`), false);
    }
  }

  async function reorderSubButtons(buttonId: string, ids: string[]) {
    const db = await ensureFirebase();
    await Promise.all(
      ids.map((id, i) => fbSet(ref(db, `sub_buttons/${buttonId}/${id}/order`), i + 1)),
    );
    delete subCache.current[buttonId];
  }

  const isAdmin = auth?.role === "admin";
  const logout = () => setAuth(null);

  return (
    <Ctx.Provider value={{
      config, auth, setAuth, isAdmin, logout, buttons,
      saveButton, deleteButton, reorderButtons,
      getSubButtons, saveSubButton, deleteSubButton, reorderSubButtons,
      loading,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}
