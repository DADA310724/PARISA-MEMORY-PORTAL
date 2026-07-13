const BASE = "/api";

export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  raw?: boolean;
}

export async function api<T = unknown>(
  path: string,
  opts: ApiOptions = {},
): Promise<T> {
  const { body, raw, headers, ...rest } = opts;
  const init: RequestInit = { ...rest };
  const h = new Headers(headers as HeadersInit);
  if (body !== undefined && !(body instanceof FormData)) {
    if (!h.has("Content-Type")) h.set("Content-Type", "application/json");
    init.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    init.body = body;
  }
  init.headers = h;
  const resp = await fetch(`${BASE}${path}`, init);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API ${path} ${resp.status}: ${text}`);
  }
  if (raw) return resp as unknown as T;
  return (await resp.json()) as T;
}

export const driveProxyUrl = (id: string) => `${BASE}/drive/proxy/${id}`;
