/** Safe localStorage helpers (SSR-safe, never throws). */
export const KEYS = {
  settings: "ll:settings:v1",
  history: "ll:history:v1",
  nbaBest: "ll:nba:best:v1",
  nbaDraft: "ll:nba:draft:v1",
  nbaLast: "ll:nba:last:v1",
  fbSession: "ll:fb:session:v1",
} as const;

export function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota or private mode */ }
}

export function remove(key: string): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(key); } catch { /* noop */ }
}

export interface HistoryEntry {
  id: string;
  game: "nba" | "football";
  date: string;
  seed: string;
  difficulty: string;
  title: string;      // e.g. "76-6" or "Doblete"
  detail: string;     // lineup / trophies summary
  score: number;      // wins (nba) or trophies (football)
  /** v2+: full team snapshot (older entries don't have it and stay readable) */
  nba?: import("@/types/nba").NbaTeamSnapshot;
}

export function addHistory(e: Omit<HistoryEntry, "id" | "date">): void {
  const list = load<HistoryEntry[]>(KEYS.history, []);
  list.unshift({ ...e, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, date: new Date().toISOString() });
  save(KEYS.history, list.slice(0, 200));
}

export interface Settings { reducedMotion: boolean; fastAnimations: boolean }
export const DEFAULT_SETTINGS: Settings = { reducedMotion: false, fastAnimations: false };
