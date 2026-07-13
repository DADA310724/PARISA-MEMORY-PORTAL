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
    configCache = await api<AppConfig>("/config");
    if (!configCache?.firebase?.apiKey) throw new Error("empty config");
    return configCache;
  } catch {
    configCache = {
      firebase: FALLBACK_FIREBASE,
      logoUrl: "https://i.ibb.co/Z1WPYY7P/x.jpg",
      driveParentFolderId: "",
      telegramLink: "https://t.me/DADA310724",
      oauthClientId: "",
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
