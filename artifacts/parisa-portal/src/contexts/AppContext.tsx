import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  ensureFirebase,
  loadAppConfig,
  ref,
  onValue,
  set as fbSet,
  push as fbPush,
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
  link_type?: "drive_folder" | "external";
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

  async function saveButton(b: DashboardButton) {
    const db = await ensureFirebase();
    // Firebase RTDB rejects undefined values — strip them first
    const clean = JSON.parse(JSON.stringify(b)) as DashboardButton;
    if (!b.id) {
      const r = await fbPush(ref(db, "buttons"), clean);
      const id = r.key!;
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
    const db = await ensureFirebase();
    const snap = await get(ref(db, `sub_buttons/${buttonId}`));
    const v = snap.val() as Record<string, SubButton> | null;
    if (!v) return [];
    return Object.values(v).sort((a, b) => a.order - b.order);
  }

  async function saveSubButton(buttonId: string, sub: SubButton) {
    const db = await ensureFirebase();
    // Firebase RTDB rejects undefined values — strip them first
    const clean = JSON.parse(JSON.stringify(sub)) as SubButton;
    if (!sub.id) {
      const r = await fbPush(ref(db, `sub_buttons/${buttonId}`), clean);
      const id = r.key!;
      await fbSet(ref(db, `sub_buttons/${buttonId}/${id}`), { ...clean, id });
    } else {
      await fbSet(ref(db, `sub_buttons/${buttonId}/${sub.id}`), clean);
    }
    const parentBtn = buttons.find((b) => b.id === buttonId);
    if (parentBtn && !parentBtn.has_sub_buttons) {
      await fbSet(ref(db, `buttons/${buttonId}/has_sub_buttons`), true);
    }
  }

  async function deleteSubButton(buttonId: string, subId: string) {
    const db = await ensureFirebase();
    await fbRemove(ref(db, `sub_buttons/${buttonId}/${subId}`));
    const snap = await get(ref(db, `sub_buttons/${buttonId}`));
    if (!snap.val()) {
      await fbSet(ref(db, `buttons/${buttonId}/has_sub_buttons`), false);
    }
  }

  const isAdmin = auth?.role === "admin";
  const logout = () => setAuth(null);

  return (
    <Ctx.Provider value={{
      config, auth, setAuth, isAdmin, logout, buttons,
      saveButton, deleteButton, reorderButtons,
      getSubButtons, saveSubButton, deleteSubButton,
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
