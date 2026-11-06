/**
 * Simulated box scores for the user's team.
 * The final score is decided first by the game model; the box score then
 * distributes exactly those points (and team rebounds/assists/steals/blocks)
 * among the five starters and a generic bench, using each player's
 * era-normalised profile, minutes and the teammates he shares the ball with.
 * Invariants (tested): Σ points = team score, Σ minutes = 240 + 25·OT,
 * FGM ≤ FGA, 3PM ≤ 3PA ≤ FGA, FTM ≤ FTA, 2·FGM + 3PM + FTM = PTS.
 */
import type { Rng } from "@/lib/core/rng";
import type { BoxLine, NbaCard, NbaPos, PlayerTotals } from "@/types/nba";
import { NBA_POSITIONS } from "@/types/nba";
import { nbaFeatures } from "@/lib/ratings/nba-features";

export interface PlayerProfile {
  key: NbaPos; name: string; baseMin: number; usage: number; frac3: number; fg: number; tp: number; ft: number;
  reb: number; ast: number; stl: number; blk: number;
}
const BENCH = { usage: 0.38, frac3: 0.3, fg: 0.45, tp: 0.35, ft: 0.75, reb: 0.17, ast: 0.09, stl: 0.026, blk: 0.016 }; // per minute

export function profiles(lineup: Partial<Record<NbaPos, NbaCard>>): PlayerProfile[] {
  return NBA_POSITIONS.filter((p) => lineup[p]).map((pos) => {
    const c = lineup[pos]!;
    const f = nbaFeatures(c);
    const tpm = f.threes / f.paceAdj; // historical 3PM/g
    return {
      key: pos, name: c.name,
      baseMin: Math.max(28, Math.min(38, 30 + (c.ratings.overall - 75) * 0.33)),
      usage: Math.max(4, f.pts) * Math.pow(Math.max(4, f.pts) / 20, 0.15), // era-normalised points per 36-ish, slight star bias
      frac3: c.ppg > 0 ? Math.min(0.55, (3 * tpm) / c.ppg) : 0,
      fg: c.fgPct ?? 0.45, tp: c.tpPct && c.tpPct > 0 ? c.tpPct : 0.33, ft: c.ftPct ?? 0.72,
      reb: Math.max(1.5, f.reb), ast: Math.max(0.8, f.ast), stl: Math.max(0.3, f.stl), blk: Math.max(0.1, f.blk),
    };
  });
}

/** Split an integer total proportionally to weights (largest remainder, with noisy weights). */
function split(rng: Rng, total: number, weights: number[], noise = 0.18): number[] {
  if (total <= 0) return weights.map(() => 0);
  const w = weights.map((x) => Math.max(1e-6, x * Math.exp(rng.normal(0, noise))));
  const sum = w.reduce((s, x) => s + x, 0);
  const raw = w.map((x) => (x / sum) * total);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((s, x) => s + x, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k][1]]++;
  return out;
}

function shooting(rng: Rng, pts: number, frac3: number, fg: number, tp: number, ft: number, usageRatio: number) {
  if (pts <= 0) return { fgm: 0, fga: rng.int(3), tpm: 0, tpa: 0, ftm: 0, fta: rng.int(2) * 2 };
  // Players asked to carry more than their historical load lose some efficiency.
  const effAdj = Math.max(-0.04, Math.min(0.02, -(usageRatio - 1) * 0.04));
  let ftm = Math.round(pts * 0.19 * Math.exp(rng.normal(0, 0.35)));
  let tpm = Math.round((pts * frac3 * Math.exp(rng.normal(0, 0.3))) / 3);
  tpm = Math.max(0, Math.min(tpm, Math.floor(pts / 3)));
  ftm = Math.max(0, Math.min(ftm, pts - 3 * tpm));
  if ((pts - 3 * tpm - ftm) % 2 !== 0) ftm += ftm > 0 ? -1 : 1; // remaining 2-pt points must be even
  const twoPm = (pts - 3 * tpm - ftm) / 2;
  const fgm = twoPm + tpm;
  const fgPct = Math.max(0.28, Math.min(0.75, fg + effAdj + rng.normal(0, 0.06)));
  const tpPct = Math.max(0.15, Math.min(0.7, tp + effAdj + rng.normal(0, 0.09)));
  const tpa = tpm === 0 ? (frac3 > 0.05 ? rng.int(3) : 0) : Math.max(tpm, Math.round(tpm / tpPct));
  const fga = Math.max(fgm, tpa, Math.round(fgm / fgPct));
  const fta = ftm === 0 ? 0 : Math.max(ftm, Math.round(ftm / Math.max(0.4, Math.min(0.97, ft + rng.normal(0, 0.06)))));
  return { fgm, fga: Math.max(fga, tpa + (fgm - tpm)), tpm, tpa, ftm, fta };
}

export function generateBox(rng: Rng, prof: PlayerProfile[], teamScore: number, possessions: number, overtimes: number, opts: { b2b?: boolean; margin: number; playoff?: boolean }): BoxLine[] {
  const totalMin = 240 + 25 * overtimes;
  const blowout = Math.abs(opts.margin) > 22 ? 4 : Math.abs(opts.margin) > 15 ? 2 : 0;
  const mins = prof.map((p) => {
    let m = p.baseMin + (opts.playoff ? 2 : 0) - (opts.b2b ? 1.5 : 0) - blowout + rng.normal(0, 1.5) + overtimes * 4;
    return Math.max(18, Math.min(44 + overtimes * 5, Math.round(m)));
  });
  const benchMin = totalMin - mins.reduce((s, x) => s + x, 0);
  // expected points: starters by profile × minutes/36, generic bench ≈ 0.33 pts/min
  const useW = [...prof.map((p, i) => (p.usage * mins[i]) / 36), BENCH.usage * 0.87 * benchMin];
  const pts = split(rng, teamScore, useW, 0.22);
  const lines: BoxLine[] = prof.map((p, i) => {
    // usage ratio: points asked of him tonight vs. his historical scoring for these minutes
    const sh = shooting(rng, pts[i], p.frac3, p.fg, p.tp, p.ft, pts[i] / Math.max(1, (p.usage * mins[i]) / 36));
    return { key: p.key, min: mins[i], pts: pts[i], reb: 0, ast: 0, stl: 0, blk: 0, ...sh };
  });
  const bsh = shooting(rng, pts[5], BENCH.frac3, BENCH.fg, BENCH.tp, BENCH.ft, 1);
  lines.push({ key: "BENCH", min: benchMin, pts: pts[5], reb: 0, ast: 0, stl: 0, blk: 0, ...bsh });
  const pf = possessions / 100;
  const teamFgm = lines.reduce((s, l) => s + l.fgm, 0);
  const totals = {
    reb: Math.max(25, Math.round(44 * pf + rng.normal(0, 4))),
    ast: Math.max(8, Math.min(teamFgm, Math.round(teamFgm * 0.6 + rng.normal(0, 2.5)))),
    stl: Math.max(1, Math.round(7.5 * pf + rng.normal(0, 2))),
    blk: Math.max(0, Math.round(5 * pf + rng.normal(0, 1.8))),
  };
  for (const k of ["reb", "ast", "stl", "blk"] as const) {
    const w = [...prof.map((p, i) => p[k] * mins[i]), BENCH[k] * benchMin * 36];
    const parts = split(rng, totals[k], w, 0.25);
    lines.forEach((l, i) => (l[k] = parts[i]));
  }
  return lines;
}

export function emptyTotals(key: NbaPos | "BENCH", name: string): PlayerTotals {
  return { key, name, gp: 0, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 };
}
export function accumulate(totals: Map<string, PlayerTotals>, box: BoxLine[]) {
  for (const l of box) {
    const t = totals.get(l.key);
    if (!t) continue;
    t.gp++;
    for (const k of ["min", "pts", "reb", "ast", "stl", "blk", "fgm", "fga", "tpm", "tpa", "ftm", "fta"] as const) t[k] += l[k];
  }
}
