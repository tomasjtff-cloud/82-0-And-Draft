import type { NbaCard, NbaPlayerSeason, NbaPos, NbaRatings } from "@/types/nba";
import { leagueContext, MODERN } from "./nba-context";
import { nbaVerification } from "@/lib/data/verification";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const to100 = (x: number) => Math.round(clamp(x, 25, 99));

export interface Normalized {
  pts: number; reb: number; ast: number; stl: number; blk: number;
  relFg: number; tpPct: number | null; tpa: number | null; ft: number | null;
  paceAdj: number; scoreEnv: number; estimated: string[];
}

/**
 * Translate a season's per-game box score into the MODERN environment
 * (pace + scoring environment + rebound availability). This is the era
 * adjustment: raw PPG from 1962 and 2016 are never compared directly.
 */
export function normalize(p: NbaPlayerSeason): Normalized {
  const ctx = leagueContext(p.startYear);
  const paceAdj = MODERN.pace / ctx.pace;
  const scoreEnv = MODERN.ortg / ctx.ortg;
  const rebEnv = (1 - MODERN.fg) / (1 - ctx.fg);
  const estimated: string[] = [];
  const big = p.positions[0] === "C" || p.positions[0] === "PF";
  const rebM = p.rpg * paceAdj * rebEnv;
  let stl = p.spg, blk = p.bpg;
  if (stl == null) { stl = (big ? 0.8 : 1.2) + p.defRep * 0.35; estimated.push("defense"); }
  if (blk == null) { blk = big ? 0.6 + rebM * 0.1 + p.defRep * 0.35 : 0.3 + p.defRep * 0.1; estimated.push("rimProtection"); }
  let relFg = 0;
  if (p.fgPct == null) estimated.push("efficiency"); else relFg = p.fgPct - ctx.fg;
  if (p.tpPct == null && p.startYear >= 1979) estimated.push("shooting");
  if (p.startYear < 1979) estimated.push("shooting");
  return {
    pts: p.ppg * paceAdj * scoreEnv, reb: rebM, ast: p.apg * paceAdj,
    stl: stl * paceAdj, blk: blk * paceAdj, relFg, tpPct: p.tpPct, tpa: p.tpa, ft: p.ftPct,
    paceAdj, scoreEnv, estimated: [...new Set(estimated)],
  };
}

function shootingScore(p: NbaPlayerSeason, n: Normalized): number {
  const ft = n.ft ?? 0.72;
  if (p.startYear < 1979) {
    // No 3pt line: shooting estimated from FT% (best available proxy of touch).
    return 30 + (ft - 0.6) * 160 + Math.min(n.pts, 30) * 0.4;
  }
  const tp = n.tpPct ?? 0;
  // volume: 3PA when known, else infer from position / percentage
  let vol = n.tpa;
  if (vol == null) vol = tp > 0.3 ? (p.positions[0] === "C" ? 1 : 3.5) : tp > 0 ? 1 : 0.2;
  const volFactor = Math.min(1, vol / 6);
  const threeQ = (tp - 0.33) * 260 * Math.sqrt(volFactor) + volFactor * 22;
  return 38 + threeQ + (ft - 0.75) * 70;
}

export function rateNbaPlayer(p: NbaPlayerSeason): NbaRatings {
  const n = normalize(p);
  const ptsTerm = n.pts <= 30 ? 0.9 * n.pts : 27 + 0.5 * (n.pts - 30);
  const vol = Math.min(1, n.pts / 20);
  const effTerm = n.relFg * 60 * vol;
  const index =
    ptsTerm + 0.55 * n.reb + 1.4 * n.ast + 2.0 * n.stl + 1.4 * n.blk + effTerm + p.defRep * 2.0 +
    Math.max(0, shootingScore(p, n) - 60) * 0.14;

  const offense = 30 + ptsTerm * 1.55 + n.ast * 1.6 + effTerm * 1.2 + Math.max(0, shootingScore(p, n) - 55) * 0.15;
  const defense = 30 + n.stl * 9 + n.blk * 7 + n.reb * 1.1 + p.defRep * 9;
  const playmaking = 30 + n.ast * 6.2;
  const rebounding = 28 + n.reb * 5.2;
  const rimProtection = 25 + n.blk * 20 + (p.positions.includes("C") ? 8 : 0);
  const shooting = shootingScore(p, n);
  const comps = [offense, defense, playmaking, rebounding, shooting];
  const versatility = 35 + comps.filter((c) => c >= 62).length * 10 + (p.positions.length - 1) * 6;
  const overall = clamp(Math.round(43 + index * 0.85), 55, 99);

  return {
    overall,
    offense: to100(offense),
    defense: to100(defense),
    playmaking: to100(playmaking),
    rebounding: to100(rebounding),
    rimProtection: to100(rimProtection),
    shooting: to100(shooting),
    versatility: to100(versatility),
    eraAdjustment: Math.round(n.paceAdj * n.scoreEnv * 100) / 100,
    estimated: n.estimated,
  };
}

const cache = new Map<string, NbaCard>();
export function toCard(p: NbaPlayerSeason): NbaCard {
  let c = cache.get(p.id);
  if (!c) { c = { ...p, ratings: rateNbaPlayer(p), check: nbaVerification(p.id) }; cache.set(p.id, c); }
  return c;
}

/* ───────────── Team evaluation ───────────── */

export interface NbaTeamEval {
  overall: number;
  offense: number;
  defense: number;
  playmaking: number;
  rebounding: number;
  rimProtection: number;
  shooting: number;
  versatility: number;
  chemistry: number;
  /** points per 100 possessions vs a league-average team (before opponent/difficulty) */
  net: number;
  fitAdjust: number;
  strengths: string[];
  weaknesses: string[];
  notes: string[];
}

/** Penalty for playing a card at a listed secondary position. */
export function positionPenalty(card: NbaCard, pos: NbaPos): number {
  const i = card.positions.indexOf(pos);
  if (i < 0) return Infinity;
  return i === 0 ? 0 : 0.6;
}

export function evaluateNbaTeam(lineup: Partial<Record<NbaPos, NbaCard>>, fitSensitivity = 1): NbaTeamEval {
  const entries = Object.entries(lineup).filter(([, c]) => !!c) as [NbaPos, NbaCard][];
  const cards = entries.map(([, c]) => c);
  const avg = (f: (c: NbaCard) => number) => (cards.length ? cards.reduce((s, c) => s + f(c), 0) / cards.length : 0);
  const max = (f: (c: NbaCard) => number) => (cards.length ? Math.max(...cards.map(f)) : 0);

  const overall = avg((c) => c.ratings.overall);
  // Diminishing returns on offense: only one ball. Sort by offense, weight decays.
  const offSorted = cards.map((c) => c.ratings.offense).sort((a, b) => b - a);
  const offW = [1, 0.85, 0.7, 0.58, 0.48];
  const offense = offSorted.reduce((s, v, i) => s + v * offW[i], 0) / Math.max(1e-9, offW.slice(0, offSorted.length).reduce((s, w) => s + w, 0));
  const defense = avg((c) => c.ratings.defense) * 0.7 + max((c) => c.ratings.rimProtection) * 0.3;
  const playmaking = max((c) => c.ratings.playmaking) * 0.6 + avg((c) => c.ratings.playmaking) * 0.4;
  const rebounding = avg((c) => c.ratings.rebounding);
  const rimProtection = max((c) => c.ratings.rimProtection);
  const shooting = avg((c) => c.ratings.shooting);
  const versatility = avg((c) => c.ratings.versatility);

  const notes: string[] = [];
  let fit = 0;
  const shooters = cards.filter((c) => c.ratings.shooting >= 62).length;
  if (cards.length === 5) {
    if (shooters < 2) { fit -= (2 - shooters) * 1.6; notes.push("Poco espaciado: menos de dos tiradores fiables."); }
    if (shooters >= 4) { fit += 1; notes.push("Espaciado excelente."); }
    if (max((c) => c.ratings.playmaking) < 62) { fit -= 1.8; notes.push("Sin un creador de juego claro."); }
    if (rimProtection < 55) { fit -= 1.8; notes.push("Pintura desprotegida: sin protector de aro."); }
    if (rebounding < 48) { fit -= 1.2; notes.push("Rebote débil."); }
    const highUsage = cards.filter((c) => c.ppg * normalizeUsage(c) >= 26).length;
    if (highUsage >= 3) { fit -= (highUsage - 2) * 1.1; notes.push("Demasiados anotadores dominantes: un solo balón."); }
    const offPos = entries.reduce((s, [pos, c]) => s + positionPenalty(c, pos), 0);
    if (offPos > 0) { fit -= offPos; notes.push("Algún jugador en su posición secundaria."); }
  }
  const fitAdjust = Math.round(fit * fitSensitivity * 10) / 10;
  const chemistry = Math.round(clamp(70 + fit * 6 + (shooters >= 3 ? 6 : 0), 0, 100));

  const base = (overall - 71.5) * 0.83 + (offense - 80) * 0.08 + (defense - 65) * 0.08;
  const net = Math.round((base + fitAdjust) * 10) / 10;

  const labeled: [string, number][] = [
    ["Ataque", offense], ["Defensa", defense], ["Creación", playmaking], ["Rebote", rebounding],
    ["Protección de aro", rimProtection], ["Tiro", shooting], ["Versatilidad", versatility],
  ];
  const strengths = labeled.filter(([, v]) => v >= 78).map(([k]) => k);
  const weaknesses = labeled.filter(([, v]) => v < 55).map(([k]) => k);

  return {
    overall: Math.round(overall), offense: Math.round(offense), defense: Math.round(defense),
    playmaking: Math.round(playmaking), rebounding: Math.round(rebounding), rimProtection: Math.round(rimProtection),
    shooting: Math.round(shooting), versatility: Math.round(versatility), chemistry, net, fitAdjust, strengths, weaknesses, notes,
  };
}

function normalizeUsage(c: NbaCard): number {
  const ctx = leagueContext(c.startYear);
  return (MODERN.pace / ctx.pace) * (MODERN.ortg / ctx.ortg);
}
