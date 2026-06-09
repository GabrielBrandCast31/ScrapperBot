// Cliente HTTP do backend Flask.
// Em dev, /api/* eh proxiado pra `api:5000` (vite.config.ts).
// Em SSR, src/server.ts proxia. No browser, basta path relativo.

const isServer = typeof window === "undefined";

function baseUrl(): string {
  if (!isServer) return "";
  return process.env.VITE_API_TARGET || "http://api:5000";
}

export interface ApiOk<T> { ok: true; data: T }
export interface ApiErr { ok: false; erro: string }
export type ApiResponse<T> = ApiOk<T> | ApiErr;

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${baseUrl()}/api${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    ...init,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} em GET ${path}`);
  const json = (await r.json()) as ApiResponse<T>;
  if (!json.ok) throw new Error(json.erro || "Erro desconhecido");
  return json.data;
}

export async function apiPost<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const r = await fetch(`${baseUrl()}/api${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...init,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} em POST ${path}`);
  const json = (await r.json()) as ApiResponse<T>;
  if (!json.ok) throw new Error(json.erro || "Erro desconhecido");
  return json.data as T;
}

export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const r = await fetch(`${baseUrl()}/api${path}`, { method: "POST", body: form });
  if (!r.ok) throw new Error(`HTTP ${r.status} em POST ${path}`);
  const json = (await r.json()) as ApiResponse<T>;
  if (!json.ok) throw new Error(json.erro || "Erro desconhecido");
  return json.data as T;
}

export function apiAssetUrl(path: string): string {
  return `${baseUrl()}/api${path}`;
}
