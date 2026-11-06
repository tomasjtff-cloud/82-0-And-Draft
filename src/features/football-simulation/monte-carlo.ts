/**
 * Football Monte Carlo: runs N complete seasons (same engine as Quick Sim:
 * Poisson matches, real calendar, PL + UCL + FA Cup + Carabao, difficulty,
 * fatigue, home advantage) for a fixed XI, each with an independent,
 * reproducible seed `${seed}#fbmc${i}`. No result is precomputed.
 */
import type { Difficulty } from "@/lib/core/difficulty";
import { createSeason, plTable, simulateRest, type SeasonState, type UserTeamInput } from "./season";

export const UCL_STAGES = ["Fase liga", "Playoffs", "Octavos", "Cuartos", "Semifinal", "Final", "Campeón"] as const;
export const FA_STAGES = ["3ª ronda", "4ª ronda", "5ª ronda", "Cuartos", "Semifinal", "Final", "Campeón"] as const;
export const EFL_STAGES = ["3ª ronda", "4ª ronda", "Cuartos", "Semifinal", "Final", "Campeón"] as const;

export interface FbRunOutcome { plPos: number; pts: number; gf: number; ga: number; ucl: number; fa: number; efl: number; won: { PL: boolean; UCL: boolean; FA: boolean; EFL: boolean } }

function deepest(s: SeasonState, comp: "UCL" | "FA" | "EFL", order: string[]): number {
  const mine = s.ties.filter((t) => t.comp === comp && (t.a === s.userId || t.b === s.userId));
  if (!mine.length) return 0; // UCL: eliminated in league phase
  const idx = Math.max(...mine.map((t) => order.indexOf(t.stage)));
  const last = mine.find((t) => order.indexOf(t.stage) === idx)!;
  const base = comp === "UCL" ? idx + 1 : idx; // UCL index 0 = league phase exit
  return last.stage === "F" && last.winner === s.userId ? base + 1 : base;
}

export function simulateOne(user: UserTeamInput, difficulty: Difficulty, seed: string): FbRunOutcome {
  const s = simulateRest(createSeason(seed, difficulty, user));
  const row = plTable(s).find((r) => r.team === s.userId)!;
  const ucl = deepest(s, "UCL", ["PO", "R16", "QF", "SF", "F"]);
  const fa = deepest(s, "FA", ["R3", "R4", "R5", "QF", "SF", "F"]);
  const efl = deepest(s, "EFL", ["R3", "R4", "QF", "SF", "F"]);
  return {
    plPos: row.pos!, pts: row.pts, gf: row.gf, ga: row.ga, ucl, fa, efl,
    won: { PL: row.pos === 1, UCL: ucl === UCL_STAGES.length - 1, FA: fa === FA_STAGES.length - 1, EFL: efl === EFL_STAGES.length - 1 },
  };
}

/** Wilson score 95% interval; for k=0 the upper bound ≈ rule of three (3/n). */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [k === 0 ? 0 : Math.max(0, c - h), k === n ? 1 : Math.min(1, c + h)];
}

export interface Prob { k: number; p: number; lo: number; hi: number }
export interface FbMcSummary {
  runs: number;
  titles: { PL: Prob; UCL: Prob; FA: Prob; EFL: Prob; quadruple: Prob; anyTitle: Prob };
  avgPos: number; avgPts: number; avgGf: number; avgGa: number; sdPts: number;
  posDist: number[];         // index 0..19 → finishing 1st..20th
  uclStages: number[]; faStages: number[]; eflStages: number[]; // count of seasons whose deepest stage = i
  titleCountDist: number[];  // 0..4 trophies in a season
}

export function summarizeRuns(out: FbRunOutcome[]): FbMcSummary {
  const n = out.length;
  const prob = (k: number): Prob => { const [lo, hi] = wilson(k, n); return { k, p: n ? k / n : 0, lo, hi }; };
  const count = (f: (o: FbRunOutcome) => boolean) => out.filter(f).length;
  const mean = (f: (o: FbRunOutcome) => number) => (n ? out.reduce((s, o) => s + f(o), 0) / n : 0);
  const avgPts = mean((o) => o.pts);
  const hist = (len: number, f: (o: FbRunOutcome) => number) => { const h = new Array(len).fill(0); out.forEach((o) => h[f(o)]++); return h; };
  return {
    runs: n,
    titles: {
      PL: prob(count((o) => o.won.PL)), UCL: prob(count((o) => o.won.UCL)), FA: prob(count((o) => o.won.FA)), EFL: prob(count((o) => o.won.EFL)),
      quadruple: prob(count((o) => o.won.PL && o.won.UCL && o.won.FA && o.won.EFL)),
      anyTitle: prob(count((o) => o.won.PL || o.won.UCL || o.won.FA || o.won.EFL)),
    },
    avgPos: mean((o) => o.plPos), avgPts, avgGf: mean((o) => o.gf), avgGa: mean((o) => o.ga),
    sdPts: Math.sqrt(mean((o) => (o.pts - avgPts) ** 2)),
    posDist: hist(20, (o) => o.plPos - 1), uclStages: hist(UCL_STAGES.length, (o) => o.ucl), faStages: hist(FA_STAGES.length, (o) => o.fa), eflStages: hist(EFL_STAGES.length, (o) => o.efl),
    titleCountDist: hist(5, (o) => +o.won.PL + +o.won.UCL + +o.won.FA + +o.won.EFL),
  };
}

export const runSeed = (seed: string, i: number) => `${seed}#fbmc${i}`;
