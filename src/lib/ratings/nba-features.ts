/**
 * Era-normalised box-score features used by the NBA rating model (v2).
 * Shared by the runtime rating and by scripts/calibrate-nba.ts so the
 * calibration and the game always use exactly the same inputs.
 */
import type { NbaPlayerSeason } from "@/types/nba";
import { leagueContext, MODERN } from "./nba-context";

/** League eFG% minus FG% by season start year (3-point era), interpolated, rounded public averages. */
const EFG_DELTA: [number, number][] = [[1979, 0.002], [1990, 0.011], [2000, 0.029], [2010, 0.039], [2015, 0.044], [2020, 0.065], [2024, 0.073]];
export function leagueEfg(startYear: number): number {
  const fg = leagueContext(startYear).fg;
  if (startYear < EFG_DELTA[0][0]) return fg;
  for (let i = 1; i < EFG_DELTA.length; i++) {
    const [y1, d1] = EFG_DELTA[i], [y0, d0] = EFG_DELTA[i - 1];
    if (startYear <= y1) return fg + d0 + ((d1 - d0) * (startYear - y0)) / (y1 - y0);
  }
  return fg + EFG_DELTA[EFG_DELTA.length - 1][1];
}

/** Estimated 3PA per game when not curated (position/percentage based; flagged as estimated upstream). */
export function threeAttempts(p: NbaPlayerSeason): number {
  if (p.startYear < 1979 || p.tpPct == null) return 0;
  if (p.tpa != null) return p.tpa;
  if (p.tpPct > 0.3) return p.positions[0] === "C" ? 1 : 3.5;
  return p.tpPct > 0 ? 1 : 0.2;
}

export interface NbaFeatures {
  pts: number; reb: number; ast: number; stl: number; blk: number;
  /** effective FG% above league average (3PM weighted), 0 when unknown */
  relEfg: number;
  /** scoring volume factor 0..1.5 */
  vol: number;
  defRep: number;
  /** era-normalised 3PM per game */
  threes: number;
  big: number; // 1 if primary C/PF
  paceAdj: number; scoreEnv: number;
  estimated: string[];
}

export function nbaFeatures(p: NbaPlayerSeason): NbaFeatures {
  const ctx = leagueContext(p.startYear);
  const paceAdj = MODERN.pace / ctx.pace;
  const scoreEnv = MODERN.ortg / ctx.ortg;
  const rebEnv = (1 - MODERN.fg) / (1 - ctx.fg);
  const big = p.positions[0] === "C" || p.positions[0] === "PF" ? 1 : 0;
  const estimated: string[] = [];
  const reb = p.rpg * paceAdj * rebEnv;
  let stl = p.spg, blk = p.bpg;
  if (stl == null) { stl = (big ? 0.8 : 1.2) + p.defRep * 0.35; estimated.push("defense"); }
  if (blk == null) { blk = big ? 0.6 + reb * 0.1 + p.defRep * 0.35 : 0.3 + p.defRep * 0.1; estimated.push("rimProtection"); }
  if (p.startYear < 1979 || p.tpPct == null) estimated.push("shooting");
  const tpm = threeAttempts(p) * (p.tpPct ?? 0);
  let relEfg = 0;
  if (p.fgPct == null) estimated.push("efficiency");
  else {
    const ftm = 0.19 * p.ppg; // typical share of points from free throws (no FTA in dataset)
    const fgm = Math.max(0.5, (p.ppg - ftm - tpm) / 2);
    const efg = p.fgPct * (1 + (0.5 * tpm) / fgm);
    relEfg = efg - leagueEfg(p.startYear);
  }
  const pts = p.ppg * paceAdj * scoreEnv;
  return {
    pts, reb, ast: p.apg * paceAdj, stl: stl * paceAdj, blk: blk * paceAdj, relEfg, vol: Math.min(1.5, pts / 20),
    defRep: p.defRep, threes: tpm * paceAdj, big, paceAdj, scoreEnv, estimated: [...new Set(estimated)],
  };
}

/** Design row for the linear impact model (order must match calibration coefficients). */
export const FEATURE_NAMES = ["intercept", "pts", "pts2", "reb", "ast", "stl", "blk", "effVol", "defRep", "threes", "bigReb"] as const;
export function designRow(f: NbaFeatures): number[] {
  return [1, f.pts, Math.max(0, f.pts - 25) ** 2 / 10, f.reb, f.ast, f.stl, f.blk, f.relEfg * 100 * f.vol, f.defRep, f.threes, f.big * f.reb];
}
