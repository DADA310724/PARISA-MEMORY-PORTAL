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

  // Retry /api/config up to 6 times with increasing delays.
  // API server may be cold-starting and secrets not yet injected — keep retrying
  // until we get a full config (apiKey + databaseURL both present).
  const retryDelays = [0, 1500, 2500, 3500, 5000, 7000];
  let lastRemote: AppConfig | null = null;

  for (let i = 0; i < retryDelays.length; i++) {
    if (retryDelays[i] > 0) {
      await new Promise<void>(r => setTimeout(r, retryDelays[i]));
    }
    try {
      const remote = await api<AppConfig>("/config");
      if (remote?.firebase?.apiKey && remote?.firebase?.databaseURL) {
        configCache = remote;
        return configCache;
      }
      lastRemote = remote ?? lastRemote;
    } catch { /* network error — retry */ }
  }

  // All retries exhausted. Build the best config we can:
  // 1. Last API response values (may be partial)
  // 2. Baked-in FALLBACK (compiled at build time when secrets ARE available in Replit)
  configCache = {
    firebase: {
      apiKey:            lastRemote?.firebase?.apiKey            || FALLBACK_FIREBASE.apiKey,
      authDomain:        lastRemote?.firebase?.authDomain        || FALLBACK_FIREBASE.authDomain,
      databaseURL:       lastRemote?.firebase?.databaseURL       || FALLBACK_FIREBASE.databaseURL,
      projectId:         lastRemote?.firebase?.projectId         || FALLBACK_FIREBASE.projectId,
      storageBucket:     lastRemote?.firebase?.storageBucket     || FALLBACK_FIREBASE.storageBucket,
      messagingSenderId: lastRemote?.firebase?.messagingSenderId || FALLBACK_FIREBASE.messagingSenderId,
      appId:             lastRemote?.firebase?.appId             || FALLBACK_FIREBASE.appId,
      measurementId:     lastRemote?.firebase?.measurementId     || FALLBACK_FIREBASE.measurementId,
    },
    logoUrl:             lastRemote?.logoUrl             || "https://i.ibb.co/Z1WPYY7P/x.jpg",
    driveParentFolderId: lastRemote?.driveParentFolderId || "",
    telegramLink:        lastRemote?.telegramLink         || "https://t.me/DADA310724",
    oauthClientId:       lastRemote?.oauthClientId       || "",
  };
  return configCache;
}

// Single shared promise — all concurrent callers wait for the same init.
// This prevents a race where db is set before auth completes, causing a
// second caller to receive an unauthenticated db and trigger PERMISSION_DENIED.
async function _initFirebase(): Promise<Database> {
  const cfg = await loadAppConfig();

  // Guard: if databaseURL is still empty after all retries, Firebase getDatabase()
  // throws a FATAL non-recoverable error that crashes the entire SDK.
  // Avoid calling it — callers will handle the missing db gracefully.
  if (!cfg.firebase.databaseURL) {
    throw new Error("Firebase databaseURL not available — server not ready");
  }

  app = getApps().length > 0 ? getApp() : initializeApp(cfg.firebase);
  const database = getDatabase(app);

  // Authenticate using Anonymous Auth so Firebase private rules (auth != null) are satisfied.
  // onAuthStateChanged fires once immediately when the SDK has restored any persisted
  // session from localStorage — so we reuse cached anonymous users instead of
  // creating a new one every page load.
  try {
    const auth = getAuth(app);
    await new Promise<void>((resolve) => {
      const unsub = onAuthStateChanged(auth, () => { unsub(); resolve(); });
    });
    if (!auth.currentUser) {
      await signInAnonymously(auth);
      // Brief pause so the new auth token propagates to the database WebSocket
      // connection before callers set up onValue listeners.
      await new Promise<void>((r) => setTimeout(r, 300));
    }
  } catch {
    // Auth failed entirely — continue without auth
  }
  db = database;
  return database;
}

export function ensureFirebase(): Promise<Database> {
  if (!initPromise) {
    initPromise = _initFirebase().catch(err => {
      // Clear so next caller retries — avoids permanently locked failed promise.
      initPromise = null;
      throw err;
    });
  }
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
