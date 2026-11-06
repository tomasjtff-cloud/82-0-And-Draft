/**
 * Achievement catalog + pure evaluator. Conditions read ONLY the local ledger (saved, verifiable
 * season/draft records). Unlocks are permanent: once stored they are never re-granted or revoked.
 */
import type { TrophyKind } from "@/components/common/TrophyIcon";
import type { DraftRec, FbSeasonRec, NbaSeasonRec, Progress, UnlockRec } from "./types";
import { NBA_CHEM_MAX, NBA_MIN_GP } from "./summarize";

export type Tier = "bronze" | "silver" | "gold" | "platinum";
export const TIER_POINTS: Record<Tier, number> = { bronze: 10, silver: 25, gold: 50, platinum: 100 };
export const TIER_ES: Record<Tier, string> = { bronze: "Bronce", silver: "Plata", gold: "Oro", platinum: "Platino" };
export type AchGame = "fb" | "nba" | "both";
export interface Ctx { fb: FbSeasonRec[]; nba: NbaSeasonRec[]; fbDrafts: DraftRec[]; nbaDrafts: DraftRec[] }
export interface AchProgress { cur: number; target: number; ref: string | null }
export interface AchDef { id: string; v: number; game: AchGame; tier: Tier; name: string; desc: string; icon: TrophyKind; secret?: boolean; eval: (c: Ctx) => AchProgress }

/* helpers */
const chrono = <T extends { date: string }>(xs: T[]) => [...xs].sort((a, b) => a.date.localeCompare(b.date));
/** single-record condition: progress 0/1, ref = first record that met it */
const any = <T extends { id: string; date: string }>(xs: T[], f: (x: T) => boolean): AchProgress => { const hit = chrono(xs).find(f); return { cur: hit ? 1 : 0, target: 1, ref: hit?.id ?? null }; };
/** best value of a per-record metric vs a threshold */
const best = <T extends { id: string; date: string }>(xs: T[], f: (x: T) => number, target: number): AchProgress => {
  const ys = chrono(xs); const hit = ys.find((x) => f(x) >= target);
  return { cur: Math.min(target, Math.max(0, ...ys.map(f))), target, ref: hit?.id ?? null };
};
/** cumulative count; ref = record that reached the target */
const count = <T extends { id: string; date: string }>(xs: T[], f: (x: T) => boolean, target: number): AchProgress => {
  const ys = chrono(xs).filter(f);
  return { cur: Math.min(target, ys.length), target, ref: ys[target - 1]?.id ?? null };
};
const full = (s: FbSeasonRec) => !s.legacy;
const fullN = (s: NbaSeasonRec) => !s.legacy;
const regular = (s: NbaSeasonRec) => s.players.filter((p) => p.gp >= NBA_MIN_GP);
const dd = (p: NbaSeasonRec["players"][number]) => [p.ppg, p.rpg, p.apg, p.spg, p.bpg].filter((x) => x >= 10).length;

export const ACHIEVEMENTS: AchDef[] = [
  // ───── Football: progression
  { id: "fb_debut", v: 1, game: "fb", tier: "bronze", icon: "medal", name: "Debutante", desc: "Completa tu primer draft de fútbol.", eval: (c) => count(c.fbDrafts, () => true, 1) },
  { id: "fb_manager", v: 1, game: "fb", tier: "silver", icon: "medal", name: "Mánager experimentado", desc: "Completa 10 drafts de fútbol.", eval: (c) => count(c.fbDrafts, () => true, 10) },
  { id: "fb_bench_legend", v: 1, game: "fb", tier: "gold", icon: "crown", name: "Leyenda del banquillo", desc: "Completa 50 temporadas de fútbol.", eval: (c) => count(c.fb, () => true, 50) },
  // chemistry
  { id: "fb_chem33", v: 1, game: "fb", tier: "silver", icon: "star", name: "Conexión perfecta", desc: "Consigue 33/33 de química en un draft.", eval: (c) => best(c.fbDrafts, (d) => d.chem, 33) },
  { id: "fb_chem_master", v: 1, game: "fb", tier: "gold", icon: "star", name: "Maestro de la química", desc: "Termina cinco drafts distintos con 33/33.", eval: (c) => count(c.fbDrafts, (d) => d.chem >= 33, 5) },
  { id: "fb_borders", v: 1, game: "fb", tier: "bronze", icon: "medal", name: "Sin fronteras", desc: "Completa un XI con al menos seis nacionalidades diferentes.", eval: (c) => best(c.fbDrafts, (d) => d.nations ?? 0, 6) },
  // Premier League
  { id: "fb_pl", v: 1, game: "fb", tier: "silver", icon: "pl", name: "Campeones de Inglaterra", desc: "Gana la Premier League.", eval: (c) => any(c.fb, (s) => s.won.PL) },
  { id: "fb_invincibles", v: 1, game: "fb", tier: "gold", icon: "pl", name: "Invencibles", desc: "Termina la Premier League sin derrotas.", eval: (c) => any(c.fb.filter(full), (s) => s.pl.l === 0) },
  { id: "fb_100pts", v: 1, game: "fb", tier: "gold", icon: "pl", name: "Temporada histórica", desc: "Consigue 100 puntos o más en la Premier League.", eval: (c) => best(c.fb, (s) => s.pl.pts, 100) },
  { id: "fb_100goals", v: 1, game: "fb", tier: "gold", icon: "boot", name: "Ataque demoledor", desc: "Marca 100 goles o más en una Premier League.", eval: (c) => best(c.fb.filter(full), (s) => s.pl.gf, 100) },
  { id: "fb_wall", v: 1, game: "fb", tier: "silver", icon: "glove", name: "Muralla defensiva", desc: "Logra al menos 20 porterías a cero en una Premier League.", eval: (c) => best(c.fb.filter(full), (s) => s.pl.cs, 20) },
  // Champions
  { id: "fb_ucl", v: 1, game: "fb", tier: "silver", icon: "ucl", name: "Reyes de Europa", desc: "Gana la Champions League.", eval: (c) => any(c.fb, (s) => s.won.UCL) },
  { id: "fb_ucl3", v: 1, game: "fb", tier: "gold", icon: "ucl", name: "Dominio continental", desc: "Gana la Champions League tres veces en partidas distintas.", eval: (c) => count(c.fb, (s) => s.won.UCL, 3) },
  { id: "fb_ucl_night", v: 1, game: "fb", tier: "gold", icon: "ucl", name: "Noche inolvidable", desc: "Gana una final de Champions por tres o más goles de diferencia.", eval: (c) => any(c.fb.filter(full), (s) => s.finals.some((f) => f.comp === "UCL" && f.won && f.gf - f.ga >= 3)) },
  // cups
  { id: "fb_fa", v: 1, game: "fb", tier: "bronze", icon: "fa", name: "Reyes de la FA Cup", desc: "Gana la FA Cup.", eval: (c) => any(c.fb, (s) => s.won.FA) },
  { id: "fb_efl", v: 1, game: "fb", tier: "bronze", icon: "efl", name: "Reyes de la Carabao", desc: "Gana la Carabao Cup.", eval: (c) => any(c.fb, (s) => s.won.EFL) },
  { id: "fb_treble", v: 1, game: "fb", tier: "gold", icon: "crown", name: "Triplete", desc: "Gana tres de las cuatro competiciones en una temporada.", eval: (c) => best(c.fb, (s) => s.titles, 3) },
  { id: "fb_quadruple", v: 1, game: "fb", tier: "platinum", icon: "crown", name: "QUADRUPLE", desc: "Gana Premier League, Champions, FA Cup y Carabao Cup en la misma temporada.", eval: (c) => best(c.fb, (s) => s.titles, 4) },
  // players
  { id: "fb_scorer40", v: 1, game: "fb", tier: "silver", icon: "boot", name: "Goleador histórico", desc: "Un jugador marca 40 goles oficiales en una temporada (todas las competiciones).", eval: (c) => best(c.fb.filter(full), (s) => Math.max(0, ...s.players.map((p) => p.g)), 40) },
  { id: "fb_assist25", v: 1, game: "fb", tier: "gold", icon: "star", name: "El asistidor", desc: "Un jugador da 25 asistencias en una temporada.", eval: (c) => best(c.fb.filter(full), (s) => Math.max(0, ...s.players.map((p) => p.a)), 25) },
  { id: "fb_ballon", v: 1, game: "fb", tier: "gold", icon: "ballon", name: "Balón de Oro", desc: "Uno de tus jugadores gana el Balón de Oro de Legends Lab.", eval: (c) => any(c.fb, (s) => !!s.awards.ballon) },
  { id: "fb_boot", v: 1, game: "fb", tier: "silver", icon: "boot", name: "Bota de Oro", desc: "Uno de tus jugadores gana la Bota de Oro de Legends Lab (25+ goles en Premier).", eval: (c) => any(c.fb, (s) => !!s.awards.boot) },
  { id: "fb_gk25", v: 1, game: "fb", tier: "gold", icon: "glove", name: "Portero legendario", desc: "Tu portero deja 25 porterías a cero en todas las competiciones de una temporada.", eval: (c) => best(c.fb.filter(full), (s) => Math.max(0, ...s.players.filter((p) => p.pos === "GK").map((p) => p.cs)), 25) },
  // special challenges
  { id: "fb_underdog", v: 1, game: "fb", tier: "gold", icon: "pl", name: "Contra todo pronóstico", desc: "Gana la Premier League con un XI de media 80 o menos, en Normal o Difícil.", eval: (c) => any(c.fb, (s) => s.won.PL && s.team.ovr <= 80 && s.difficulty !== "EASY") },
  { id: "fb_tactics5", v: 1, game: "fb", tier: "platinum", icon: "crown", name: "El poder de la táctica", desc: "Gana al menos un título con cada uno de los cinco estilos tácticos.", eval: (c) => { const set = new Set(chrono(c.fb.filter(full)).filter((s) => s.titles > 0).map((s) => s.tactic)); return { cur: set.size, target: 5, ref: set.size >= 5 ? chrono(c.fb.filter((s) => s.titles > 0)).at(-1)?.id ?? null : null }; } },
  { id: "fb_brain", v: 1, game: "fb", tier: "silver", icon: "star", name: "Cerebro futbolístico", desc: "Gana una competición con un XI de menos de 20 puntos de química.", eval: (c) => any(c.fb, (s) => s.titles > 0 && s.team.chem < 20) },
  // secrets
  { id: "fb_s_thrash", v: 1, game: "fb", tier: "silver", icon: "boot", secret: true, name: "Festival de goles", desc: "Gana un partido por siete o más goles de diferencia.", eval: (c) => best(c.fb.filter(full), (s) => s.maxWinMargin, 7) },
  { id: "fb_s_final_hat", v: 1, game: "fb", tier: "gold", icon: "ballon", secret: true, name: "Hat-trick en la final", desc: "Un jugador marca tres goles en una final.", eval: (c) => any(c.fb.filter(full), (s) => s.finalHatTrick) },
  { id: "fb_s_pens", v: 1, game: "fb", tier: "bronze", icon: "glove", secret: true, name: "Nervios de acero", desc: "Gana una final en la tanda de penales.", eval: (c) => any(c.fb.filter(full), (s) => s.finals.some((f) => f.pens && f.won)) },

  // ───── NBA: first steps
  { id: "nba_debut", v: 1, game: "nba", tier: "bronze", icon: "medal", name: "Debut en la NBA", desc: "Completa tu primer draft NBA.", eval: (c) => count(c.nbaDrafts, () => true, 1) },
  { id: "nba_gm", v: 1, game: "nba", tier: "silver", icon: "medal", name: "General Manager", desc: "Completa 10 drafts NBA.", eval: (c) => count(c.nbaDrafts, () => true, 10) },
  { id: "nba_architect", v: 1, game: "nba", tier: "gold", icon: "crown", name: "Arquitecto de leyendas", desc: "Completa 50 temporadas NBA.", eval: (c) => count(c.nba, () => true, 50) },
  // regular season
  { id: "nba_winning", v: 1, game: "nba", tier: "bronze", icon: "medal", name: "Temporada ganadora", desc: "Termina con récord positivo.", eval: (c) => any(c.nba, (s) => s.wins > s.losses) },
  { id: "nba_50", v: 1, game: "nba", tier: "bronze", icon: "medal", name: "Contendiente", desc: "Gana 50 partidos en una temporada.", eval: (c) => best(c.nba, (s) => s.wins, 50) },
  { id: "nba_60", v: 1, game: "nba", tier: "silver", icon: "medal", name: "Equipo de élite", desc: "Gana 60 partidos.", eval: (c) => best(c.nba, (s) => s.wins, 60) },
  { id: "nba_70", v: 1, game: "nba", tier: "gold", icon: "star", name: "Nivel histórico", desc: "Gana 70 partidos.", eval: (c) => best(c.nba, (s) => s.wins, 70) },
  { id: "nba_74", v: 1, game: "nba", tier: "gold", icon: "star", name: "El récord de los Warriors", desc: "Gana al menos 74 partidos.", eval: (c) => best(c.nba, (s) => s.wins, 74) },
  { id: "nba_82", v: 1, game: "nba", tier: "platinum", icon: "crown", name: "PERFECCIÓN ABSOLUTA", desc: "Termina la temporada regular 82-0.", eval: (c) => best(c.nba, (s) => s.wins, 82) },
  // playoffs
  { id: "nba_series", v: 1, game: "nba", tier: "bronze", icon: "medal", name: "Primera serie", desc: "Gana una serie de playoffs.", eval: (c) => any(c.nba, (s) => s.seriesWon > 0 || ["conf-semis", "conf-finals", "finals", "champion"].includes(s.outcome)) },
  { id: "nba_finalist", v: 1, game: "nba", tier: "silver", icon: "nba", name: "Finalista", desc: "Llega a las NBA Finals.", eval: (c) => any(c.nba, (s) => s.outcome === "finals" || s.outcome === "champion") },
  { id: "nba_champ", v: 1, game: "nba", tier: "gold", icon: "nba", name: "CAMPEONES DE LA NBA", desc: "Gana el campeonato.", eval: (c) => any(c.nba, (s) => s.champion) },
  { id: "nba_dynasty", v: 1, game: "nba", tier: "gold", icon: "nba", name: "Dinastía", desc: "Gana tres anillos en temporadas guardadas diferentes.", eval: (c) => count(c.nba, (s) => s.champion, 3) },
  { id: "nba_perfect_po", v: 1, game: "nba", tier: "platinum", icon: "nba", name: "Playoffs perfectos", desc: "Gana el campeonato sin perder ningún partido de playoffs (16-0).", eval: (c) => any(c.nba.filter(fullN), (s) => s.champion && s.poL === 0) },
  { id: "nba_ultimate", v: 1, game: "nba", tier: "platinum", icon: "crown", name: "La temporada definitiva", desc: "Consigue 82-0 y gana el anillo en la misma temporada.", eval: (c) => any(c.nba, (s) => s.wins === 82 && s.champion) },
  // chemistry & building
  { id: "nba_chem_max", v: 1, game: "nba", tier: "silver", icon: "star", name: "Quinteto perfecto", desc: `Alcanza la química máxima del motor NBA (${NBA_CHEM_MAX}: todos los bonus de encaje y ninguna penalización).`, eval: (c) => best(c.nbaDrafts, (d) => d.chem, NBA_CHEM_MAX) },
  { id: "nba_balanced", v: 1, game: "nba", tier: "silver", icon: "star", name: "Equipo equilibrado", desc: "Juega una temporada con ataque ≥ 78, defensa ≥ 75 y creación ≥ 80.", eval: (c) => any(c.nba.filter(fullN), (s) => s.offense >= 78 && s.defense >= 75 && s.playmaking >= 80) },
  { id: "nba_legends", v: 1, game: "nba", tier: "gold", icon: "crown", name: "Legends Only", desc: "Juega una temporada con un quinteto de cinco temporadas legendarias (impacto estimado ≥ +6 por 100 posesiones).", eval: (c) => best(c.nba.filter(fullN), (s) => s.legends, 5) },
  // individual stats (regular season, ≥ 58 GP)
  { id: "nba_30ppg", v: 1, game: "nba", tier: "silver", icon: "star", name: "Máquina anotadora", desc: "Un jugador promedia al menos 30 puntos (mín. 58 partidos).", eval: (c) => best(c.nba.filter(fullN), (s) => Math.max(0, ...regular(s).map((p) => p.ppg)), 30) },
  { id: "nba_35ppg", v: 1, game: "nba", tier: "gold", icon: "star", name: "Temporada monstruosa", desc: "Un jugador promedia al menos 35 puntos (mín. 58 partidos).", eval: (c) => best(c.nba.filter(fullN), (s) => Math.max(0, ...regular(s).map((p) => p.ppg)), 35) },
  { id: "nba_15rpg", v: 1, game: "nba", tier: "gold", icon: "star", name: "Rey de los rebotes", desc: "Un jugador promedia al menos 15 rebotes (mín. 58 partidos).", eval: (c) => best(c.nba.filter(fullN), (s) => Math.max(0, ...regular(s).map((p) => p.rpg)), 15) },
  { id: "nba_12apg", v: 1, game: "nba", tier: "gold", icon: "star", name: "Director de orquesta", desc: "Un jugador promedia al menos 12 asistencias (mín. 58 partidos).", eval: (c) => best(c.nba.filter(fullN), (s) => Math.max(0, ...regular(s).map((p) => p.apg)), 12) },
  { id: "nba_dd", v: 1, game: "nba", tier: "silver", icon: "medal", name: "Doble amenaza", desc: "Un jugador promedia un doble-doble (dos categorías ≥ 10; mín. 58 partidos).", eval: (c) => best(c.nba.filter(fullN), (s) => Math.max(0, ...regular(s).map(dd)), 2) },
  { id: "nba_td", v: 1, game: "nba", tier: "platinum", icon: "crown", name: "Triple amenaza", desc: "Un jugador promedia un triple-doble (tres categorías ≥ 10; mín. 58 partidos).", eval: (c) => best(c.nba.filter(fullN), (s) => Math.max(0, ...regular(s).map(dd)), 3) },
  // special
  { id: "nba_underdog", v: 1, game: "nba", tier: "gold", icon: "nba", name: "Contra las probabilidades", desc: "Gana el anillo con un equipo cuya proyección previa del motor era de 45 victorias o menos.", eval: (c) => any(c.nba.filter(fullN), (s) => s.champion && s.expectedWins <= 45) },
  { id: "nba_legacy", v: 1, game: "nba", tier: "platinum", icon: "nba", name: "El legado", desc: "Gana diez campeonatos NBA en partidas diferentes.", eval: (c) => count(c.nba, (s) => s.champion, 10) },
  { id: "both_double_crown", v: 1, game: "both", tier: "platinum", icon: "crown", name: "Doble corona", desc: "Gana un anillo NBA y una Champions League con menos de 7 días de diferencia.", eval: (c) => {
    const rings = c.nba.filter((s) => s.champion), ucl = c.fb.filter((s) => s.won.UCL);
    for (const r of chrono(rings)) for (const u of ucl) if (Math.abs(Date.parse(r.date) - Date.parse(u.date)) <= 7 * 864e5) return { cur: 1, target: 1, ref: Date.parse(r.date) > Date.parse(u.date) ? r.id : u.id };
    return { cur: 0, target: 1, ref: null };
  } },
  // NBA secrets
  { id: "nba_s_streak", v: 1, game: "nba", tier: "gold", icon: "star", secret: true, name: "Imparables", desc: "Encadena 30 victorias seguidas en temporada regular.", eval: (c) => best(c.nba.filter(fullN), (s) => s.longestStreak, 30) },
  { id: "nba_s_game7", v: 1, game: "nba", tier: "silver", icon: "nba", secret: true, name: "Partido 7", desc: "Gana el anillo en el séptimo partido de las Finals.", eval: (c) => any(c.nba.filter(fullN), (s) => s.finalsGame7Win) },
  { id: "nba_s_fortress", v: 1, game: "nba", tier: "silver", icon: "crown", secret: true, name: "Fortaleza", desc: "Gana los 41 partidos en casa de la temporada regular.", eval: (c) => any(c.nba.filter(fullN), (s) => s.homeW === 41 && s.homeL === 0) },
];
export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export const TOTAL_POINTS = ACHIEVEMENTS.reduce((a, d) => a + TIER_POINTS[d.tier], 0);

export const ctxOf = (p: Progress): Ctx => ({
  fb: p.seasons.filter((s): s is FbSeasonRec => s.kind === "fb"), nba: p.seasons.filter((s): s is NbaSeasonRec => s.kind === "nba"),
  fbDrafts: p.drafts.filter((d) => d.game === "fb"), nbaDrafts: p.drafts.filter((d) => d.game === "nba"),
});
export function evaluateAll(p: Progress): Record<string, AchProgress> {
  const c = ctxOf(p);
  return Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a.eval(c)]));
}
/** Returns the newly unlocked definitions and the updated unlock map (pure). Stored unlocks are never removed. */
export function unlockNew(p: Progress, now = new Date().toISOString()): { unlocked: AchDef[]; achievements: Record<string, UnlockRec> } {
  const ev = evaluateAll(p), out = { ...p.achievements }, unlocked: AchDef[] = [];
  for (const a of ACHIEVEMENTS) if (!out[a.id] && ev[a.id].cur >= ev[a.id].target) { out[a.id] = { at: now, ref: ev[a.id].ref, v: a.v }; unlocked.push(a); }
  return { unlocked, achievements: out };
}
export function profilePoints(p: Progress): number { return Object.keys(p.achievements).reduce((a, id) => a + (ACH_BY_ID[id] ? TIER_POINTS[ACH_BY_ID[id].tier] : 0), 0); }
export const LEVELS: [number, string][] = [[0, "Novato"], [50, "Promesa"], [150, "Profesional"], [350, "Estrella"], [700, "Superestrella"], [1200, "Leyenda"], [1900, "Ícono de Legends Lab"]];
export function levelOf(points: number): { name: string; idx: number; next: number | null } {
  let idx = 0; LEVELS.forEach(([t], i) => { if (points >= t) idx = i; });
  return { name: LEVELS[idx][1], idx, next: LEVELS[idx + 1]?.[0] ?? null };
}
