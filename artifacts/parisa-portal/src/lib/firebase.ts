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
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
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

export async function ensureFirebase(): Promise<Database> {
  if (db) return db;
  const cfg = await loadAppConfig();
  app = getApps().length > 0 ? getApp() : initializeApp(cfg.firebase);
  db = getDatabase(app);
  return db;
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
