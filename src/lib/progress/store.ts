/**
 * Persistence of the progress ledger in localStorage (`ll:progress:v1`).
 * Why not IndexedDB: a season record is ~0.7 KB, the ledger is capped at 1 000 seasons per game
 * (~1.4 MB worst case) and must be read synchronously at startup; localStorage is enough and
 * keeps the code simple. Achievement toasts are broadcast with a window event.
 */
import { KEYS, load, save, type HistoryEntry } from "@/lib/storage";
import { unlockNew, type AchDef } from "./achievements";
import { emptyProgress, PROGRESS_VERSION, type DraftRec, type FbSeasonRec, type NbaSeasonRec, type Progress, type SeasonRec } from "./types";

export const PROGRESS_KEY = "ll:progress:v1";
export const MAX_SEASONS_PER_GAME = 1000;
export const MAX_DRAFTS = 3000;
export const UNLOCK_EVENT = "ll:unlocked";

const valid = (p: unknown): p is Progress => !!p && typeof p === "object" && Array.isArray((p as Progress).seasons) && Array.isArray((p as Progress).drafts) && typeof (p as Progress).achievements === "object";

/** Migrates a pre-V4 history entry (with snapshot) into a legacy record. Only facts that were saved are used. */
export function legacyFromHistory(h: HistoryEntry): SeasonRec | null {
  if (h.game === "football" && h.football?.result) {
    const f = h.football, r = f.result!;
    const won = { PL: r.trophies.includes("PL"), UCL: r.trophies.includes("UCL"), FA: r.trophies.includes("FA"), EFL: r.trophies.includes("EFL") };
    return {
      kind: "fb", id: `fb:${f.seasonSeed}`, date: h.date, difficulty: f.difficulty, mode: f.mode, tactic: f.tactic ?? "balanced", draftSeed: f.draftSeed, seasonSeed: f.seasonSeed,
      team: { name: f.clubName, formationId: f.formationId, ovr: f.ovr, chem: f.chemistry, nations: 0 },
      pl: { pos: r.plPos, pts: r.pts, w: 0, d: 0, l: 99, gf: 0, ga: 0, cs: 0 }, won, titles: Object.values(won).filter(Boolean).length,
      finals: [], maxWinMargin: 0, finalHatTrick: false, players: [], awards: {}, legacy: true,
    } satisfies FbSeasonRec;
  }
  if (h.game === "nba" && h.nba?.record) {
    const n = h.nba, label = (n.playoff ?? "").toLowerCase();
    const outcome = label.includes("campe") ? "champion" : label.includes("final") && !label.includes("conferencia") ? "finals" : "missed";
    return {
      kind: "nba", id: `nba:${n.seed}:${n.draftSeed}`, date: h.date, difficulty: n.difficulty, draftSeed: n.draftSeed, seed: n.seed, teamName: h.detail.split(" · ")[0] ?? "",
      wins: n.record!.wins, losses: n.record!.losses, outcome, champion: outcome === "champion", seriesWon: 0, poW: 0, poL: 99, expectedWins: 99,
      chemistry: n.chemistry, teamOvr: n.teamOvr, offense: 0, defense: 0, playmaking: 0, legends: 0, longestStreak: 0, homeW: 0, homeL: 99, finalsGame7Win: false,
      players: [], awards: {}, legacy: true,
    } satisfies NbaSeasonRec;
  }
  return null;
}

function cap(p: Progress): Progress {
  const fb = p.seasons.filter((s) => s.kind === "fb").sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_SEASONS_PER_GAME);
  const nba = p.seasons.filter((s) => s.kind === "nba").sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_SEASONS_PER_GAME);
  return { ...p, seasons: [...fb, ...nba], drafts: [...p.drafts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_DRAFTS) };
}

export function loadProgress(): Progress {
  const raw = load<unknown>(PROGRESS_KEY, null);
  let p: Progress = valid(raw) ? { ...emptyProgress(), ...raw } : emptyProgress();
  if (!p.migratedHistory) {
    const hist = load<HistoryEntry[]>(KEYS.history, []);
    const ids = new Set(p.seasons.map((s) => s.id));
    for (const h of hist) { const r = legacyFromHistory(h); if (r && !ids.has(r.id)) { p.seasons.push(r); ids.add(r.id); } }
    p.migratedHistory = true;
    const u = unlockNew(p);
    // retroactive unlocks keep the date of the season that earned them
    for (const a of u.unlocked) { const ref = u.achievements[a.id].ref; const src = p.seasons.find((s) => s.id === ref) ?? p.drafts.find((d) => d.id === ref); if (src) u.achievements[a.id].at = src.date; }
    p = { ...p, achievements: u.achievements };
    save(PROGRESS_KEY, cap(p));
  }
  return p;
}

function commit(p: Progress): AchDef[] {
  const u = unlockNew(p);
  const next = cap({ ...p, achievements: u.achievements, version: PROGRESS_VERSION });
  save(PROGRESS_KEY, next);
  if (u.unlocked.length && typeof window !== "undefined") window.dispatchEvent(new CustomEvent(UNLOCK_EVENT, { detail: u.unlocked.map((a) => a.id) }));
  return u.unlocked;
}

/** Adds a finished season once (dedupe by id: re-opening or replaying never re-counts). */
export function recordSeason(rec: SeasonRec): AchDef[] {
  const p = loadProgress();
  if (p.seasons.some((s) => s.id === rec.id)) return [];
  return commit({ ...p, seasons: [...p.seasons, rec] });
}
/** Adds a completed draft once (dedupe by game + draft seed). */
export function recordDraft(d: DraftRec): AchDef[] {
  const p = loadProgress();
  const old = p.drafts.find((x) => x.game === d.game && x.id === d.id);
  if (old && old.chem >= d.chem && (old.nations ?? 0) >= (d.nations ?? 0)) return [];
  // same draft re-arranged later (swaps/formation): keep one entry, with the best chemistry reached
  const drafts = old ? p.drafts.map((x) => (x === old ? { ...x, chem: Math.max(x.chem, d.chem), nations: Math.max(x.nations ?? 0, d.nations ?? 0) } : x)) : [...p.drafts, d];
  return commit({ ...p, drafts });
}
export function setProfileName(name: string): void {
  const p = loadProgress();
  save(PROGRESS_KEY, { ...p, profileName: name.replace(/[<>{}\[\]\\`$]/g, "").trim().slice(0, 24) });
}

/* ───────── Export / import ───────── */
export const EXPORT_FORMAT = "legends-lab-progress";
export interface ExportFile { format: typeof EXPORT_FORMAT; version: 1; exportedAt: string; data: { progress: Progress; history: HistoryEntry[]; settings: unknown; nbaIdentity: unknown; nbaBest: unknown } }

export function buildExport(): ExportFile {
  return { format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), data: { progress: loadProgress(), history: load<HistoryEntry[]>(KEYS.history, []), settings: load(KEYS.settings, null), nbaIdentity: load(KEYS.nbaIdentity, null), nbaBest: load(KEYS.nbaBest, null) } };
}

const isStr = (x: unknown) => typeof x === "string";
/** Strict structural validation; returns a sanitized copy or an error. Nothing from the file is executed. */
export function parseImport(text: string): { ok: true; file: ExportFile } | { ok: false; error: string } {
  if (text.length > 8_000_000) return { ok: false, error: "El archivo es demasiado grande." };
  let j: unknown;
  try { j = JSON.parse(text); } catch { return { ok: false, error: "El archivo no es un JSON válido." }; }
  const f = j as ExportFile;
  if (!f || f.format !== EXPORT_FORMAT) return { ok: false, error: "No es un archivo de progreso de Legends Lab." };
  if (f.version !== 1) return { ok: false, error: `Versión de archivo no compatible (${String(f.version)}).` };
  const p = f.data?.progress;
  if (!valid(p)) return { ok: false, error: "El progreso del archivo está incompleto o dañado." };
  const seasons = p.seasons.filter((s) => s && (s.kind === "fb" || s.kind === "nba") && isStr(s.id) && isStr(s.date) && !Number.isNaN(Date.parse(s.date)));
  const drafts = p.drafts.filter((d) => d && (d.game === "fb" || d.game === "nba") && isStr(d.id) && isStr(d.date) && typeof d.chem === "number");
  const achievements: Progress["achievements"] = {};
  for (const [k, v] of Object.entries(p.achievements ?? {})) if (/^[a-z0-9_]{2,40}$/.test(k) && v && isStr(v.at)) achievements[k] = { at: v.at, ref: isStr(v.ref) ? v.ref : null, v: typeof v.v === "number" ? v.v : 1 };
  const history = Array.isArray(f.data.history) ? f.data.history.filter((h) => h && isStr(h.id) && (h.game === "nba" || h.game === "football") && isStr(h.date)) : [];
  return { ok: true, file: { ...f, data: { ...f.data, history, progress: { ...emptyProgress(), profileName: isStr(p.profileName) ? p.profileName.slice(0, 24) : "", seasons, drafts, achievements, migratedHistory: true } } } };
}

/** merge: union by id (no duplicates; earliest unlock date wins). replace: the file becomes the new state. */
export function applyImport(file: ExportFile, mode: "merge" | "replace"): { seasons: number; achievements: number } {
  const cur = loadProgress(), inc = file.data.progress;
  let p: Progress;
  if (mode === "replace") p = { ...inc, version: PROGRESS_VERSION, migratedHistory: true };
  else {
    const ids = new Set(cur.seasons.map((s) => s.id)), dids = new Set(cur.drafts.map((d) => `${d.game}:${d.id}`));
    const ach = { ...cur.achievements };
    for (const [k, v] of Object.entries(inc.achievements)) if (!ach[k] || v.at < ach[k].at) ach[k] = v;
    p = { ...cur, profileName: cur.profileName || inc.profileName, seasons: [...cur.seasons, ...inc.seasons.filter((s) => !ids.has(s.id))], drafts: [...cur.drafts, ...inc.drafts.filter((d) => !dids.has(`${d.game}:${d.id}`))], achievements: ach };
  }
  const hist = mode === "replace" ? file.data.history : (() => { const h = load<HistoryEntry[]>(KEYS.history, []); const ids = new Set(h.map((x) => x.id)); return [...h, ...file.data.history.filter((x) => !ids.has(x.id))].sort((a, b) => b.date.localeCompare(a.date)); })();
  save(KEYS.history, hist.slice(0, 200));
  if (mode === "replace") { if (file.data.settings) save(KEYS.settings, file.data.settings); if (file.data.nbaIdentity) save(KEYS.nbaIdentity, file.data.nbaIdentity); if (file.data.nbaBest) save(KEYS.nbaBest, file.data.nbaBest); }
  const u = unlockNew(p);
  const next = cap({ ...p, achievements: u.achievements });
  save(PROGRESS_KEY, next);
  return { seasons: next.seasons.length, achievements: Object.keys(next.achievements).length };
}
