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

/** Pre-warm both tokens so first requests are instant */
export async function prewarmTokens(): Promise<void> {
  try {
    await Promise.all([
      getOAuthToken(SCOPE_DRIVE),
      getOAuthToken(SCOPE_FIREBASE_DB),
    ]);
    console.log("✅ Google OAuth tokens pre-warmed (Drive + Firebase DB)");
  } catch (e) {
    console.warn("⚠️  Token pre-warm failed (will retry on first request):", String(e));
  }
}
