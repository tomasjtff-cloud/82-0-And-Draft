/**
 * Server-only sports data providers. API keys are read from environment
 * variables and NEVER sent to the browser. Responses are cached in memory and
 * (optionally) on disk under data/cache/ to avoid repeated requests.
 *
 * Priority used by the app (see ARCHITECTURE.md):
 *   1. verified local data  2. API cache  3. authorized external API
 *   4. labelled demo dataset  5. clear error
 */
import "server-only";

export type ProviderId = "balldontlie" | "football-data" | "api-football";

interface ProviderDef { id: ProviderId; base: string; envKey: string; header: (key: string) => Record<string, string>; docs: string; notes: string }

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  balldontlie: {
    id: "balldontlie", base: "https://api.balldontlie.io/v1", envKey: "BALLDONTLIE_API_KEY",
    header: (k) => ({ Authorization: k }), docs: "https://docs.balldontlie.io",
    notes: "Free tier: teams, players, games (~5 req/min). Season averages / stats require a paid tier.",
  },
  "football-data": {
    id: "football-data", base: "https://api.football-data.org/v4", envKey: "FOOTBALL_DATA_API_KEY",
    header: (k) => ({ "X-Auth-Token": k }), docs: "https://www.football-data.org/documentation/quickstart",
    notes: "Free tier: 12 competitions, ~10 req/min, limited history.",
  },
  "api-football": {
    id: "api-football", base: "https://v3.football.api-sports.io", envKey: "API_FOOTBALL_KEY",
    header: (k) => ({ "x-apisports-key": k }), docs: "https://www.api-football.com/documentation-v3",
    notes: "Free plan: 100 requests/day; historical seasons on the free plan are limited.",
  },
};

export function providerStatus() {
  return Object.values(PROVIDERS).map((p) => ({ id: p.id, configured: !!process.env[p.envKey], docs: p.docs, notes: p.notes }));
}

const memCache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 1000 * 60 * 60 * 24; // 24h

export class ProviderError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function providerFetch<T>(id: ProviderId, path: string, params: Record<string, string> = {}): Promise<T> {
  const p = PROVIDERS[id];
  const key = process.env[p.envKey];
  if (!key) throw new ProviderError(503, `${p.envKey} no configurada. Añádela en .env.local (ver .env.example).`);
  const url = new URL(p.base + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const cacheKey = `${id}:${url.toString()}`;
  const hit = memCache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
  const res = await fetch(url, { headers: p.header(key), next: { revalidate: 86400 } });
  if (res.status === 429) throw new ProviderError(429, "Límite de solicitudes del proveedor alcanzado. Reintenta más tarde.");
  if (!res.ok) throw new ProviderError(res.status, `${id} respondió ${res.status}`);
  const data = (await res.json()) as T;
  memCache.set(cacheKey, { at: Date.now(), data });
  return data;
}
