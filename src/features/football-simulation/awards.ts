/**
 * Individual awards of Legends Lab — "Mi equipo". Only the user's XI has simulated
 * individual stats, so every award is an internal recognition of the user's team and is
 * labelled as such (never a world/league award). Inputs are the simulated events only.
 *
 * Position-neutral performance: z = (avg match rating − BASE[group]) / SD[group], where BASE/SD
 * were measured on 60 simulated seasons (AWARDS.md). This stops forwards (whose ratings include
 * goals) from winning by default: an outstanding defender or keeper can top the ranking.
 */
import type { FbPos } from "@/types/football";
import { aggregatePlayerStats, userMatches, type FbStatRow } from "./player-stats";
import { summarize, type SeasonState } from "./season";
import { BENCH_KEY } from "./events";

export type PosGroup = "GK" | "DEF" | "MID" | "ATT";
export const groupOf = (p: FbPos | "SUB"): PosGroup => (p === "GK" ? "GK" : ["CB", "LB", "RB", "LWB", "RWB"].includes(p) ? "DEF" : ["CDM", "CM", "CAM", "LM", "RM"].includes(p) ? "MID" : "ATT");
export const RATING_BASE: Record<PosGroup, { mean: number; sd: number }> = {
  GK: { mean: 6.84, sd: 0.13 }, DEF: { mean: 6.32, sd: 0.15 }, MID: { mean: 6.74, sd: 0.2 }, ATT: { mean: 7.19, sd: 0.29 },
};
/** Thresholds borrowed from real-world benchmarks (documented): */
export const BOOT_PL_GOALS = 25;     // Premier League Golden Boot winners usually score 22–32
export const GLOVE_PL_CS = 15;       // Premier League Golden Glove winners usually keep 15–21
export const BALLON_MIN_Z = 1.0;     // ≥ 1 SD above an average player of his position…
                                     // …and at least one major title (Premier League or Champions)

export interface AwardWinner { key: string; cardId: string; name: string; pos: FbPos; stats: string; reason: string; score?: number }
export interface FbSeasonAwards {
  version: 1;
  playerOfSeason?: AwardWinner;      // always (if individual stats exist)
  ballonDor?: AwardWinner;           // only when the bar is met
  goldenBoot?: AwardWinner;          // ≥ BOOT_PL_GOALS in the Premier League
  goldenGlove?: AwardWinner;         // ≥ GLOVE_PL_CS clean sheets in the Premier League
  bestDefender?: AwardWinner; bestMidfielder?: AwardWinner; bestForward?: AwardWinner; bestUcl?: AwardWinner;
  leaders: { plGoals?: AwardWinner; uclGoals?: AwardWinner; allGoals?: AwardWinner; assists?: AwardWinner };
  notes: string[];
}

const z = (r: FbStatRow) => (r.rating - RATING_BASE[groupOf(r.pos)].mean) / RATING_BASE[groupOf(r.pos)].sd;
const fmt = (x: number, d = 2) => x.toFixed(d).replace(".", ",");

export function seasonAwards(s: SeasonState): FbSeasonAwards | null {
  if (!s.squad) return null;
  const all = aggregatePlayerStats(s, "ALL").filter((r) => r.key !== BENCH_KEY && r.gp > 0);
  if (!all.length) return null;
  const pl = aggregatePlayerStats(s, "PL"), ucl = aggregatePlayerStats(s, "UCL");
  const card = (key: string) => s.squad!.find((m) => m.slotId === key)!;
  const teamMin = userMatches(s).reduce((a, m) => a + (m.et ? 120 : 90), 0) || 1;
  const share = (r: FbStatRow) => Math.min(1, r.min / (0.7 * teamMin));
  const sum = summarize(s);
  const titles = sum.trophies.filter((t) => t.status === "won").length;
  const major = sum.trophies.some((t) => (t.comp === "PL" || t.comp === "UCL") && t.status === "won");
  // finals: rating in finals counts extra ("actuaciones importantes")
  const finals = userMatches(s).filter((m) => m.stage === "F");
  const finalBonus = (key: string) => finals.reduce((a, m) => { const l = m.detail?.lines.find((x) => x.key === key); if (!l || !l.min) return a; const p = card(key).pos; const g = RATING_BASE[groupOf(p)]; return a + 0.3 * ((l.rating - g.mean) / g.sd); }, 0);
  const score = (r: FbStatRow) => z(r) * share(r) + 0.15 * titles * share(r) + finalBonus(r.key);
  const W = (r: FbStatRow, stats: string, reason: string, sc?: number): AwardWinner => ({ key: r.key, cardId: card(r.key).cardId, name: r.name, pos: card(r.key).pos, stats, reason, score: sc });
  const line = (r: FbStatRow) => `${r.gp} PJ · ${r.goals} G · ${r.assists} A · nota ${fmt(r.rating)}`;
  const ranked = [...all].filter((r) => share(r) >= 0.4).sort((a, b) => score(b) - score(a));
  const out: FbSeasonAwards = { version: 1, leaders: {}, notes: [] };
  const best = ranked[0];
  if (best) {
    out.playerOfSeason = W(best, line(best), `Mejor rendimiento relativo a su posición (${fmt(z(best), 1)} desv. sobre la media de su puesto) con ${Math.round(share(best) * 100)} % de disponibilidad${titles ? ` y ${titles} título${titles > 1 ? "s" : ""}` : ""}.`, Math.round(score(best) * 100) / 100);
    if (z(best) >= BALLON_MIN_Z && major) out.ballonDor = { ...out.playerOfSeason, reason: `${out.playerOfSeason.reason} Supera el listón del Balón de Oro de Legends Lab (≥ ${fmt(BALLON_MIN_Z, 1)} desv. y un título mayor).` };
    else out.notes.push(z(best) < BALLON_MIN_Z ? "Balón de Oro desierto: nadie superó con claridad el nivel medio de su posición." : "Balón de Oro desierto: hace falta ganar la Premier League o la Champions.");
  }
  const groupBest = (g: PosGroup) => [...all].filter((r) => groupOf(r.pos) === g && share(r) >= 0.4).sort((a, b) => z(b) - z(a))[0];
  const d = groupBest("DEF"), m = groupBest("MID"), f = groupBest("ATT");
  if (d) out.bestDefender = W(d, line(d), "Mejor defensor por nota relativa a su posición.");
  if (m) out.bestMidfielder = W(m, line(m), "Mejor mediocampista por nota relativa a su posición.");
  if (f) out.bestForward = W(f, line(f), "Mejor atacante por nota relativa a su posición.");
  const top = (rows: FbStatRow[], k: "goals" | "assists") => [...rows].filter((r) => r.key !== BENCH_KEY && r[k] > 0).sort((a, b) => b[k] - a[k] || a.min - b.min)[0];
  const plTop = top(pl, "goals"), uclTop = top(ucl, "goals"), allTop = top(all, "goals"), astTop = top(all, "assists");
  if (plTop) out.leaders.plGoals = W(plTop, `${plTop.goals} goles en Premier League`, "Máximo goleador de mi equipo en la Premier League.");
  if (uclTop) out.leaders.uclGoals = W(uclTop, `${uclTop.goals} goles en Champions`, "Máximo goleador de mi equipo en la Champions League.");
  if (allTop) out.leaders.allGoals = W(allTop, `${allTop.goals} goles en todas las competiciones`, "Máximo goleador de mi equipo.");
  if (astTop) out.leaders.assists = W(astTop, `${astTop.assists} asistencias`, "Máximo asistidor de mi equipo.");
  if (plTop && plTop.goals >= BOOT_PL_GOALS) out.goldenBoot = W(plTop, `${plTop.goals} goles en Premier League (${plTop.min} min)`, `Máximo goleador de mi equipo en la Premier League con al menos ${BOOT_PL_GOALS} goles.`);
  else out.notes.push(`Bota de Oro desierta: hacen falta ${BOOT_PL_GOALS} goles en la Premier League.`);
  const gk = pl.find((r) => r.pos === "GK" && r.gp > 0);
  if (gk && gk.cleanSheets >= GLOVE_PL_CS) {
    const sv = gk.saves + gk.conceded ? Math.round((gk.saves / (gk.saves + gk.conceded)) * 100) : 0;
    out.goldenGlove = W(gk, `${gk.cleanSheets} porterías a cero · ${gk.conceded} goles recibidos · ${sv} % paradas`, `Al menos ${GLOVE_PL_CS} porterías a cero en la Premier League.`);
  } else out.notes.push(`Guante de Oro desierto: hacen falta ${GLOVE_PL_CS} porterías a cero en la Premier League.`);
  const uclBest = [...ucl].filter((r) => r.key !== BENCH_KEY && r.gp >= 4).sort((a, b) => z(b) - z(a))[0];
  if (uclBest) out.bestUcl = W(uclBest, `${uclBest.gp} PJ · ${uclBest.goals} G · ${uclBest.assists} A · nota ${fmt(uclBest.rating)}`, "Mejor rendimiento relativo a su posición en la Champions League (mín. 4 partidos).");
  out.notes.push("Mejor jugador joven: no disponible (el dataset no incluye fechas de nacimiento).");
  return out;
}
