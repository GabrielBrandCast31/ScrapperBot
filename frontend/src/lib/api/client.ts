// Cliente HTTP do backend Flask.
//
// Em dev, /api/* eh proxiado para o container `api` (ver vite.config.ts).
// Em SSR (TanStack Start renderiza no servidor), precisamos de URL absoluta —
// o proxy do Vite so funciona pra requests do browser. Por isso resolvemos
// a base URL diferente quando rodamos no servidor.

const isServer = typeof window === "undefined";

function baseUrl(): string {
  if (!isServer) return ""; // browser usa o proxy do Vite
  // SSR: chama Flask direto via service name no docker network
  return process.env.VITE_API_TARGET || "http://api:5000";
}

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiErr {
  ok: false;
  erro: string;
}

export type ApiResponse<T> = ApiOk<T> | ApiErr;

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${baseUrl()}/api${path}`;
  const r = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    ...init,
  });
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} em GET ${path}`);
  }
  const json = (await r.json()) as ApiResponse<T>;
  if (!json.ok) {
    throw new Error(json.erro || "Erro desconhecido");
  }
  return json.data;
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const url = `${baseUrl()}/api${path}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...init,
  });
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} em POST ${path}`);
  }
  const json = (await r.json()) as ApiResponse<T>;
  if (!json.ok) {
    throw new Error(json.erro || "Erro desconhecido");
  }
  return json.data as T;
}

export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const url = `${baseUrl()}/api${path}`;
  const r = await fetch(url, { method: "POST", body: form });
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} em POST ${path}`);
  }
  const json = (await r.json()) as ApiResponse<T>;
  if (!json.ok) {
    throw new Error(json.erro || "Erro desconhecido");
  }
  return json.data as T;
}

// URL absoluta pra usar em <img src> (QR code, etc.)
export function apiAssetUrl(path: string): string {
  return `${baseUrl()}/api${path}`;
}
