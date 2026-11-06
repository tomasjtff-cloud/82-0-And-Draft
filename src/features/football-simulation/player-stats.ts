/**
 * Aggregation of SIMULATED individual stats (from Match.detail events) per
 * competition, team awards and season records. Never mixes in the real
 * historical numbers shown on the cards.
 */
import type { CompId, FbPos, Match, SquadMember } from "@/types/football";
import type { SeasonState } from "./season";
import { BENCH_KEY } from "./events";

export type StatScope = CompId | "ALL";
export interface FbStatRow {
  key: string; name: string; pos: FbPos | "SUB"; gp: number; starts: number; min: number;
  goals: number; assists: number; shots: number; sot: number; passes: number; passesOk: number; yellow: number; red: number;
  rating: number; impact: number; xg: number; xa: number; g90: number; a90: number;
  saves: number; conceded: number; cleanSheets: number;
}

export const userMatches = (s: SeasonState, scope: StatScope = "ALL") =>
  s.matches.filter((m) => (m.home === s.userId || m.away === s.userId) && (scope === "ALL" || m.comp === scope)).sort((a, b) => a.date.localeCompare(b.date));

export function aggregatePlayerStats(s: SeasonState, scope: StatScope = "ALL"): FbStatRow[] {
  const squad: SquadMember[] = s.squad ?? [];
  const rows = new Map<string, FbStatRow & { ratingSum: number }>();
  const mk = (key: string, name: string, pos: FbStatRow["pos"]) => ({ key, name, pos, gp: 0, starts: 0, min: 0, goals: 0, assists: 0, shots: 0, sot: 0, passes: 0, passesOk: 0, yellow: 0, red: 0, rating: 0, impact: 0, xg: 0, xa: 0, g90: 0, a90: 0, saves: 0, conceded: 0, cleanSheets: 0, ratingSum: 0 });
  for (const m of squad) rows.set(m.slotId, mk(m.slotId, m.name, m.pos));
  rows.set(BENCH_KEY, mk(BENCH_KEY, "Suplentes", "SUB"));
  for (const match of userMatches(s, scope)) {
    for (const l of match.detail?.lines ?? []) {
      const r = rows.get(l.key);
      if (!r || l.min <= 0) continue;
      r.gp++; if (l.started) r.starts++;
      r.min += l.min; r.goals += l.goals; r.assists += l.assists; r.shots += l.shots; r.sot += l.sot; r.passes += l.passes; r.passesOk += l.passesOk;
      r.yellow += l.yellow; r.red += l.red; r.xg += l.xg; r.xa += l.xa; r.saves += l.saves ?? 0; r.conceded += l.conceded ?? 0; r.cleanSheets += l.cleanSheet ? 1 : 0;
      if (l.key !== BENCH_KEY) { r.ratingSum += l.rating; r.impact += l.rating - 6; }
    }
  }
  return [...rows.values()].map(({ ratingSum, ...r }) => ({
    ...r, rating: r.gp && r.key !== BENCH_KEY ? Math.round((ratingSum / r.gp) * 100) / 100 : 0, impact: Math.round(r.impact * 10) / 10,
    xg: Math.round(r.xg * 10) / 10, xa: Math.round(r.xa * 10) / 10,
    g90: r.min ? Math.round((r.goals / r.min) * 90 * 100) / 100 : 0, a90: r.min ? Math.round((r.assists / r.min) * 90 * 100) / 100 : 0,
  }));
}

export interface FbAwards { topScorer?: FbStatRow; topAssister?: FbStatRow; bestPlayer?: FbStatRow; bestGk?: FbStatRow; mvp?: FbStatRow }
/** Awards from simulated results only. MVP = largest Σ(match rating − 6) (rewards quality × availability). */
export function teamAwards(rows: FbStatRow[], matchesPlayed: number): FbAwards {
  const players = rows.filter((r) => r.key !== BENCH_KEY && r.gp > 0);
  const by = (f: (r: FbStatRow) => number, pool = players) => [...pool].sort((a, b) => f(b) - f(a) || b.rating - a.rating)[0];
  const regulars = players.filter((r) => r.gp >= Math.max(3, Math.ceil(matchesPlayed * 0.4)));
  return {
    topScorer: by((r) => r.goals * 1000 + r.assists), topAssister: by((r) => r.assists * 1000 + r.goals),
    bestPlayer: by((r) => r.rating, regulars.length ? regulars : players), bestGk: players.find((r) => r.pos === "GK"),
    mvp: by((r) => r.impact),
  };
}

export interface SeasonRecords { biggestWin?: Match; heaviestDefeat?: Match; winStreak: number; unbeatenStreak: number; hatTricks: { key: string; match: Match; goals: number }[]; cleanSheets: number; goalsFor: number; goalsAgainst: number }
export function seasonRecords(s: SeasonState): SeasonRecords {
  const ms = userMatches(s);
  const diff = (m: Match) => { const h = m.hg + (m.et?.hg ?? 0), a = m.ag + (m.et?.ag ?? 0); return m.home === s.userId ? h - a : a - h; };
  const forA = (m: Match) => (m.home === s.userId ? [m.hg + (m.et?.hg ?? 0), m.ag + (m.et?.ag ?? 0)] : [m.ag + (m.et?.ag ?? 0), m.hg + (m.et?.hg ?? 0)]);
  let ws = 0, us = 0, bw = 0, bu = 0;
  for (const m of ms) {
    const d = diff(m), won = d > 0 || (d === 0 && !!m.pens && (m.home === s.userId) === (m.pens.h > m.pens.a));
    ws = won ? ws + 1 : 0; us = d >= 0 ? us + 1 : 0; bw = Math.max(bw, ws); bu = Math.max(bu, us);
  }
  const hatTricks = ms.flatMap((m) => (m.detail?.lines ?? []).filter((l) => l.goals >= 3 && l.key !== BENCH_KEY).map((l) => ({ key: l.key, match: m, goals: l.goals })));
  const sorted = [...ms].sort((a, b) => diff(b) - diff(a));
  return {
    biggestWin: sorted[0] && diff(sorted[0]) > 0 ? sorted[0] : undefined, heaviestDefeat: sorted.at(-1) && diff(sorted.at(-1)!) < 0 ? sorted.at(-1) : undefined,
    winStreak: bw, unbeatenStreak: bu, hatTricks, cleanSheets: ms.filter((m) => forA(m)[1] === 0).length,
    goalsFor: ms.reduce((a, m) => a + forA(m)[0], 0), goalsAgainst: ms.reduce((a, m) => a + forA(m)[1], 0),
  };
}
