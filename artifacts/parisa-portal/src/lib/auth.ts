import { api } from "./api";
import { ensureFirebase, ref, get, set, push, getFirebaseAuth, signInWithEmailAndPassword } from "./firebase";

export type Role = "user" | "admin";

export interface AuthState {
  role: Role;
  loginAt: number;
  identifier?: string;
}

const STORAGE_KEY = "parisa.auth";

export function loadAuth(): AuthState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function saveAuth(s: AuthState) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function clearAuth() {
  sessionStorage.removeItem(STORAGE_KEY);
  // Clear AI chat sessions so they don't leak to next user on shared device
  try { localStorage.removeItem("parisa_sessions"); } catch {}
}

function todayDDMMYYYY(): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const parts = fmt.formatToParts(new Date());
  const dd = parts.find((p) => p.type === "day")?.value ?? "00";
  const mm = parts.find((p) => p.type === "month")?.value ?? "00";
  const yyyy = parts.find((p) => p.type === "year")?.value ?? "0000";
  return `${dd}${mm}${yyyy}`;
}

interface AuthConfig {
  user_password_static?: string;
  user_passwords?: string[] | Record<string, string>;
}

async function getAuthConfig(): Promise<AuthConfig> {
  const db = await ensureFirebase();
  const snap = await get(ref(db, "auth_config"));
  const v = snap.val();
  if (v) return v as AuthConfig;
  const defaults: AuthConfig = { user_password_static: "310724" };
  await set(ref(db, "auth_config"), defaults);
  return defaults;
}

function collectPasswords(cfg: AuthConfig): string[] {
  const pwds = new Set<string>();
  if (cfg.user_password_static) pwds.add(cfg.user_password_static.trim());
  if (cfg.user_passwords) {
    const raw = cfg.user_passwords;
    if (Array.isArray(raw)) {
      raw.forEach((p) => p && pwds.add(p.trim()));
    } else if (typeof raw === "object") {
      Object.values(raw).forEach((p) => p && pwds.add(String(p).trim()));
    }
  }
  if (pwds.size === 0) pwds.add("310724");
  return [...pwds];
}

export async function notifyTelegram(payload: Record<string, unknown>) {
  try {
    await api("/telegram/notify", {
      method: "POST",
      body: { ...payload, userAgent: navigator.userAgent },
    });
  } catch (e) {
    console.warn("telegram notify failed", e);
  }
  try {
    const db = await ensureFirebase();
    await push(ref(db, "login_attempts"), {
      ...payload,
      ts: Date.now(),
      ua: navigator.userAgent,
    });
  } catch (e) {
    console.warn("firebase log failed", e);
  }
}

export async function loginUser(password: string, location?: string, browserInfo?: string): Promise<boolean> {
  let cfg: AuthConfig = { user_password_static: "310724" };
  try { cfg = await getAuthConfig(); } catch { /* Firebase unavailable, use default */ }
  const validPasswords = collectPasswords(cfg);
  const dynamicPwd = todayDDMMYYYY();
  const entered = password.trim();
  const ok = validPasswords.includes(entered) || entered === dynamicPwd;
  await notifyTelegram({
    event: ok ? "user_login_success" : "user_login_failed",
    role: "user",
    success: ok,
    identifier: ok ? "User" : "unknown",
    location: location ?? "",
    browserInfo: browserInfo ?? "",
    extra: ok ? "" : `ভুল পাসওয়ার্ড দেওয়া হয়েছে`,
  });
  if (ok) saveAuth({ role: "user", loginAt: Date.now(), identifier: "User" });
  return ok;
}

export async function loginAdmin(email: string, password: string, location?: string, browserInfo?: string): Promise<boolean> {
  try {
    const fbAuth = await getFirebaseAuth();
    await signInWithEmailAndPassword(fbAuth, email.trim(), password);
    await notifyTelegram({
      event: "admin_login_success",
      role: "admin",
      success: true,
      identifier: email,
      location: location ?? "",
      browserInfo: browserInfo ?? "",
    });
    saveAuth({ role: "admin", loginAt: Date.now(), identifier: email });
    return true;
  } catch (e) {
    await notifyTelegram({
      event: "admin_login_failed",
      role: "admin",
      success: false,
      identifier: email || "unknown",
      location: location ?? "",
      browserInfo: browserInfo ?? "",
      extra: "ভুল email বা password",
    });
    return false;
  }
}
