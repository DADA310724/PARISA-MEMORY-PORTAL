/**
 * Shared Google OAuth2 token helper.
 * Generates and caches service-account tokens per scope.
 * Used by drive.ts (Drive scope) and folderLock.ts (Firebase Database scope).
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

let _serviceAccount: ServiceAccount | null = null;

function getServiceAccount(): ServiceAccount | null {
  if (_serviceAccount) return _serviceAccount;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  if (!raw) return null;
  try {
    _serviceAccount = JSON.parse(raw) as ServiceAccount;
    return _serviceAccount;
  } catch {
    return null;
  }
}

function base64url(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function signRS256(payload: string, privateKey: string): Promise<string> {
  const { createSign } = await import("node:crypto");
  const sign = createSign("RSA-SHA256");
  sign.update(payload);
  sign.end();
  return sign.sign(privateKey, "base64url");
}

// Per-scope token cache
const _tokenCaches = new Map<string, { token: string; exp: number }>();

export async function getOAuthToken(scope: string): Promise<string> {
  const cached = _tokenCaches.get(scope);
  if (cached && Date.now() < cached.exp) return cached.token;

  const sa = getServiceAccount();
  if (!sa) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claimSet}`;
  const signature = await signRS256(signingInput, sa.private_key);
  const jwt = `${signingInput}.${signature}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token exchange failed (scope=${scope}): ${text}`);
  }
  const data = (await resp.json()) as { access_token: string; expires_in: number };
  const entry = { token: data.access_token, exp: (now + data.expires_in - 60) * 1000 };
  _tokenCaches.set(scope, entry);
  return entry.token;
}

export const SCOPE_DRIVE = "https://www.googleapis.com/auth/drive";
export const SCOPE_FIREBASE_DB = "https://www.googleapis.com/auth/firebase.database";

/**
 * Generate a Firebase custom token for the frontend to sign in with.
 * This replaces signInAnonymously and works even when Firebase rules are private.
 * The token is signed with the service account private key.
 */
export async function generateFirebaseCustomToken(uid: string): Promise<string> {
  const sa = getServiceAccount();
  if (!sa) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
      iat: now,
      exp: now + 3600,
      uid,
      claims: { role: "portal_user" },
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = await signRS256(signingInput, sa.private_key);
  return `${signingInput}.${signature}`;
}

/**
 * Pre-warm both tokens so first requests are instant.
 * Retries up to 5 times (2s → 4s → 6s → 8s → 10s) to handle
 * Replit's cold-start delay where secrets inject after the process starts.
 */
export async function prewarmTokens(): Promise<void> {
  let attempt = 0;
  const tryWarm = async (): Promise<void> => {
    attempt++;
    try {
      await Promise.all([
        getOAuthToken(SCOPE_DRIVE),
        getOAuthToken(SCOPE_FIREBASE_DB),
      ]);
      console.log(`✅ Google OAuth tokens pre-warmed (attempt ${attempt})`);
    } catch (e) {
      if (attempt < 5) {
        const delayMs = attempt * 2000;
        console.warn(`⚠️  Token pre-warm attempt ${attempt} failed, retrying in ${delayMs / 1000}s:`, String(e));
        setTimeout(() => { void tryWarm(); }, delayMs);
      } else {
        console.warn("⚠️  Token pre-warm gave up after 5 attempts. Will retry on first API request.");
      }
    }
  };
  void tryWarm();
}
