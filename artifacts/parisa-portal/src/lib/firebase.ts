import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getDatabase,
  type Database,
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
} from "firebase/database";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { api } from "./api";

export interface AppConfig {
  firebase: {
    apiKey: string;
    authDomain: string;
    databaseURL: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
  logoUrl: string;
  driveParentFolderId: string;
  telegramLink: string;
  oauthClientId: string;
}

let app: FirebaseApp | null = null;
let db: Database | null = null;
let initPromise: Promise<Database> | null = null;
let configCache: AppConfig | null = null;

const FALLBACK_FIREBASE = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
};

export async function loadAppConfig(): Promise<AppConfig> {
  if (configCache) return configCache;
  try {
    const remote = await api<AppConfig>("/config");
    // Require BOTH apiKey and databaseURL — if either is missing fall through to fallback
    if (!remote?.firebase?.apiKey || !remote?.firebase?.databaseURL) throw new Error("incomplete config");
    configCache = remote;
    return configCache;
  } catch {
    // Merge: use api values where available, baked-in FALLBACK for anything missing (especially databaseURL)
    let partial: AppConfig | null = null;
    try { partial = await api<AppConfig>("/config"); } catch { /* ignore */ }
    configCache = {
      firebase: {
        apiKey:            partial?.firebase?.apiKey            || FALLBACK_FIREBASE.apiKey,
        authDomain:        partial?.firebase?.authDomain        || FALLBACK_FIREBASE.authDomain,
        databaseURL:       FALLBACK_FIREBASE.databaseURL        || partial?.firebase?.databaseURL || "",
        projectId:         partial?.firebase?.projectId         || FALLBACK_FIREBASE.projectId,
        storageBucket:     partial?.firebase?.storageBucket     || FALLBACK_FIREBASE.storageBucket,
        messagingSenderId: partial?.firebase?.messagingSenderId || FALLBACK_FIREBASE.messagingSenderId,
        appId:             partial?.firebase?.appId             || FALLBACK_FIREBASE.appId,
        measurementId:     partial?.firebase?.measurementId     || FALLBACK_FIREBASE.measurementId,
      },
      logoUrl:             partial?.logoUrl             || "https://i.ibb.co/Z1WPYY7P/x.jpg",
      driveParentFolderId: partial?.driveParentFolderId || "",
      telegramLink:        partial?.telegramLink         || "https://t.me/DADA310724",
      oauthClientId:       partial?.oauthClientId       || "",
    };
    return configCache;
  }
}

// Single shared promise — all concurrent callers wait for the same init.
// This prevents a race where db is set before auth completes, causing a
// second caller to receive an unauthenticated db and trigger PERMISSION_DENIED.
async function _initFirebase(): Promise<Database> {
  const cfg = await loadAppConfig();
  app = getApps().length > 0 ? getApp() : initializeApp(cfg.firebase);
  const database = getDatabase(app);

  // Authenticate so Firebase private rules (auth != null) are satisfied.
  // We use the server-issued custom token first (works even if Anonymous Auth
  // is disabled in Firebase Console). Falls back to signInAnonymously if the
  // token endpoint is unavailable. onAuthStateChanged fires once immediately
  // when the SDK has restored any persisted session from localStorage — so we
  // reuse cached sessions instead of creating a new auth request every load.
  try {
    const auth = getAuth(app);
    await new Promise<void>((resolve) => {
      const unsub = onAuthStateChanged(auth, () => { unsub(); resolve(); });
    });
    if (!auth.currentUser) {
      // 1️⃣ Try server custom token (preferred — independent of Anonymous Auth setting)
      let authenticated = false;
      try {
        const res = await fetch("/api/firebase/token");
        if (res.ok) {
          const { token } = await res.json() as { token: string };
          await signInWithCustomToken(auth, token);
          authenticated = true;
        }
      } catch { /* fall through */ }

      // 2️⃣ Fallback: anonymous auth
      if (!authenticated) {
        await signInAnonymously(auth);
      }

      // Brief pause so the new auth token propagates to the database WebSocket
      // connection before callers set up onValue listeners.
      await new Promise<void>((r) => setTimeout(r, 300));
    }
  } catch {
    // Auth failed entirely — continue without auth (read-only public data still works
    // if rules allow it; writes will fail which is acceptable as a degraded state)
  }
  db = database;
  return database;
}

export function ensureFirebase(): Promise<Database> {
  if (!initPromise) initPromise = _initFirebase();
  return initPromise;
}

export async function getFirebaseAuth() {
  if (!app) await ensureFirebase();
  return getAuth(app!);
}

export {
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  signInWithEmailAndPassword,
};
