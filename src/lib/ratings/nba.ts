import type { NbaCard, NbaPlayerSeason, NbaPos, NbaRatings } from "@/types/nba";
import { leagueContext, MODERN } from "./nba-context";
import { nbaVerification } from "@/lib/data/verification";
import { designRow, nbaFeatures } from "./nba-features";
import calibration from "./nba-calibration.json";

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

/* ───────── Rating model v2 (see ARCHITECTURE.md → "NBA ratings v2") ─────────
 * 1. Impact: box-score features → linear model fitted against FiveThirtyEight
 *    RAPTOR (scripts/calibrate-nba.ts). Predictions are variance-matched
 *    (÷√R²) so they live on the same scale as real RAPTOR, then blended with
 *    the season's real RAPTOR when it exists (weight 0.5·min(1, MP/2500)).
 * 2. Impact (pts/100 above average) → OVR via documented knots.
 * 3. Production index (volume/box line) → OVR, so big statistical seasons read
 *    as a video game would. Final OVR = 0.62·impact + 0.38·production.
 */
const BETA = Object.values(calibration.coefficients) as number[];
const R2 = calibration.r2 || 0.6;
const IMPACT_MEAN = 3.0;
const KNOTS: [number, number][] = [[-3, 64], [0, 75], [2, 81], [4, 86], [6, 91], [8, 94.5], [10, 96.8], [12, 98.5], [14, 99]];
export function impactToOvr(I: number): number {
  if (I <= KNOTS[0][0]) return KNOTS[0][1] + (I - KNOTS[0][0]) * 2.5;
  for (let i = 1; i < KNOTS.length; i++) {
    if (I <= KNOTS[i][0]) { const [x0, y0] = KNOTS[i - 1], [x1, y1] = KNOTS[i]; return y0 + ((y1 - y0) * (I - x0)) / (x1 - x0); }
  }
  return 99;
}
export function impactEstimate(p: NbaPlayerSeason): { impact: number; predicted: number; raptor: number | null } {
  const f = nbaFeatures(p);
  const raw = designRow(f).reduce((s, v, i) => s + v * (BETA[i] ?? 0), 0);
  const predicted = IMPACT_MEAN + (raw - IMPACT_MEAN) / Math.sqrt(R2);
  const v = nbaVerification(p.id);
  if (v.raptor && v.raptor.mp >= 500) {
    const w = 0.5 * Math.min(1, v.raptor.mp / 2500);
    return { impact: w * v.raptor.raptorTotal + (1 - w) * predicted, predicted, raptor: v.raptor.raptorTotal };
  }
  return { impact: predicted, predicted, raptor: null };
}

export function rateNbaPlayer(p: NbaPlayerSeason): NbaRatings {
  const n = normalize(p);
  const f = nbaFeatures(p);
  const ptsTerm = n.pts <= 30 ? 0.9 * n.pts : 27 + 0.5 * (n.pts - 30);
  const effTerm = f.relEfg * 60 * f.vol;
  const shoot = shootingScore(p, n);
  const prodIndex = ptsTerm + 0.55 * n.reb + 1.4 * n.ast + 2.0 * n.stl + 1.4 * n.blk + effTerm + p.defRep * 2.0;
  const { impact } = impactEstimate(p);
  const overall = clamp(Math.round(0.62 * impactToOvr(impact) + 0.38 * Math.min(99, 47 + 0.85 * prodIndex)), 55, 99);

  const offense = 30 + ptsTerm * 1.55 + n.ast * 1.6 + effTerm * 1.2 + Math.max(0, shoot - 55) * 0.15;
  const defense = 30 + n.stl * 9 + n.blk * 7 + n.reb * 1.1 + p.defRep * 9;
  const playmaking = 30 + n.ast * 6.2;
  const rebounding = 28 + n.reb * 5.2;
  const rimProtection = 25 + n.blk * 20 + (p.positions.includes("C") ? 8 : 0);
  const comps = [offense, defense, playmaking, rebounding, shoot];
  const versatility = 35 + comps.filter((c) => c >= 62).length * 10 + (p.positions.length - 1) * 6;

  return {
    overall,
    offense: to100(offense), defense: to100(defense), playmaking: to100(playmaking), rebounding: to100(rebounding),
    rimProtection: to100(rimProtection), shooting: to100(shoot), versatility: to100(versatility),
    eraAdjustment: Math.round(n.paceAdj * n.scoreEnv * 100) / 100,
    impact: Math.round(impact * 10) / 10,
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

/** Team model calibration (v2): avg OVR 79 ≈ league-average team (net 0). See tests/unit/nba-calibration.test.ts. */
export const TEAM_OVR_PIVOT = 79;
export const TEAM_OVR_SLOPE = 1.0;

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
  /** Explainable fit/chemistry terms; their applied values sum to fitAdjust (before difficulty scaling). */
  fit: FitItem[];
  /** what each player brings (team-best or filling a need) */
  roles: { pos: NbaPos; name: string; brings: string[] }[];
}

export interface FitItem {
  key: "spacing" | "creator" | "rim" | "rebounding" | "ball" | "position" | "defense";
  label: string;
  status: "bonus" | "ok" | "pending" | "penalty";
  /** net-rating points applied (0 when pending/ok) */
  value: number;
  detail: string;
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

  /* Fit terms (documented in ARCHITECTURE.md → "Química NBA"). Values are net-rating points.
   * Needs that later picks could still cover are "pending" (not applied) until the lineup is complete. */
  const complete = cards.length === 5;
  const left = 5 - cards.length;
  const fitItems: FitItem[] = [];
  const shooters = cards.filter((c) => c.ratings.shooting >= 62).length;
  const need = (k: FitItem["key"], label: string, okCond: boolean, penalty: number, okText: string, badText: string, bonus?: { cond: boolean; value: number; text: string }) => {
    if (bonus?.cond) fitItems.push({ key: k, label, status: "bonus", value: bonus.value, detail: bonus.text });
    else if (okCond) fitItems.push({ key: k, label, status: "ok", value: 0, detail: okText });
    else if (!complete && cards.length > 0) fitItems.push({ key: k, label, status: "pending", value: 0, detail: `${badText} (aún quedan ${left} elección${left === 1 ? "" : "es"})` });
    else if (cards.length > 0) fitItems.push({ key: k, label, status: "penalty", value: -penalty, detail: badText });
  };
  need("spacing", "Tiro y espaciado", shooters >= 2, (2 - Math.min(2, shooters)) * 1.6,
    `${shooters} tirador(es) fiable(s) (tiro ≥ 62)`, `Solo ${shooters} tirador(es) fiable(s): la defensa se cierra`,
    { cond: shooters >= 4 || (shooters >= 3 && complete), value: shooters >= 4 ? 1 : 0.5, text: `${shooters} tiradores: espaciado ${shooters >= 4 ? "excelente" : "muy bueno"}` });
  const bestPm = max((c) => c.ratings.playmaking);
  need("creator", "Creación de juego", bestPm >= 62, 1.8, `Creador principal: ${cards.find((c) => c.ratings.playmaking === bestPm)?.name ?? "—"} (${Math.round(bestPm)})`, "Sin un creador de juego claro (creación < 62)",
    { cond: bestPm >= 85, value: 0.5, text: `Creador de élite: ${cards.find((c) => c.ratings.playmaking === bestPm)?.name} (${Math.round(bestPm)})` });
  need("rim", "Protección del aro", rimProtection >= 55, 1.8, `Protector: ${cards.find((c) => c.ratings.rimProtection === rimProtection)?.name ?? "—"} (${Math.round(rimProtection)})`, "Pintura desprotegida (aro < 55)",
    { cond: rimProtection >= 85, value: 0.5, text: `Protector de aro de élite: ${cards.find((c) => c.ratings.rimProtection === rimProtection)?.name} (${Math.round(rimProtection)})` });
  need("rebounding", "Rebote", rebounding >= 48, 1.2, `Rebote medio ${Math.round(rebounding)}`, `Rebote débil (media ${Math.round(rebounding)} < 48)`);
  const avgDef = avg((c) => c.ratings.defense);
  need("defense", "Equilibrio defensivo", avgDef >= 50, 1.2, `Defensa media ${Math.round(avgDef)}`, `Demasiados defensores débiles (defensa media ${Math.round(avgDef)} < 50)`);
  const highUsage = cards.filter((c) => c.ppg * normalizeUsage(c) >= 26);
  if (highUsage.length >= 3) fitItems.push({ key: "ball", label: "Un solo balón", status: "penalty", value: -(highUsage.length - 2) * 1.1, detail: `${highUsage.length} anotadores que necesitan el balón (≥26 pts ajustados): ${highUsage.map((c) => c.name).join(", ")}` });
  else if (cards.length) fitItems.push({ key: "ball", label: "Un solo balón", status: "ok", value: 0, detail: `${highUsage.length} anotador(es) dominante(s): reparto sostenible` });
  const offPos = entries.filter(([pos, c]) => positionPenalty(c, pos) > 0);
  if (offPos.length) fitItems.push({ key: "position", label: "Posiciones", status: "penalty", value: -0.6 * offPos.length, detail: `En posición secundaria: ${offPos.map(([pos, c]) => `${c.name} (${pos})`).join(", ")} (−0,6 c/u)` });
  else if (cards.length) fitItems.push({ key: "position", label: "Posiciones", status: "ok", value: 0, detail: "Todos en su posición natural" });

  const fit = fitItems.reduce((s, i) => s + i.value, 0);
  const notes = fitItems.filter((i) => i.status === "penalty" || i.status === "bonus").map((i) => i.detail + ".");
  const fitAdjust = Math.round(fit * fitSensitivity * 10) / 10;
  /** Chemistry 0–100 is a direct display of the fit terms: 70 + 8·Σvalue. */
  const chemistry = Math.round(clamp(70 + fit * 8, 0, 100));
  const roles = entries.map(([pos, c]) => {
    const brings: string[] = [];
    const isBest = (f: (x: NbaCard) => number) => cards.length > 1 && f(c) === max(f);
    if (isBest((x) => x.ratings.offense)) brings.push("principal anotador");
    if (c.ratings.playmaking >= 62 && isBest((x) => x.ratings.playmaking)) brings.push("creador");
    if (c.ratings.shooting >= 62) brings.push("tirador");
    if (c.ratings.rimProtection >= 55 && isBest((x) => x.ratings.rimProtection)) brings.push("protector del aro");
    if (isBest((x) => x.ratings.rebounding)) brings.push("reboteador");
    if (c.ratings.defense >= 70) brings.push("defensor");
    return { pos, name: c.name, brings };
  });

  const base = (overall - TEAM_OVR_PIVOT) * TEAM_OVR_SLOPE + (offense - 80) * 0.06 + (defense - 65) * 0.06;
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
    shooting: Math.round(shooting), versatility: Math.round(versatility), chemistry, net, fitAdjust, strengths, weaknesses, notes, fit: fitItems, roles,
  };
}

function normalizeUsage(c: NbaCard): number {
  const ctx = leagueContext(c.startYear);
  return (MODERN.pace / ctx.pace) * (MODERN.ortg / ctx.ortg);
}


export interface PickPreview { before: NbaTeamEval; after: NbaTeamEval; deltaNet: number; deltaChem: number; messages: { tone: "good" | "bad" | "neutral"; text: string }[] }

/** What adding `card` at `pos` would do to the team — computed with the same model the simulator uses. */
export function previewPick(lineup: Partial<Record<NbaPos, NbaCard>>, card: NbaCard, pos: NbaPos, fitSensitivity = 1): PickPreview {
  const before = evaluateNbaTeam(lineup, fitSensitivity);
  const after = evaluateNbaTeam({ ...lineup, [pos]: card }, fitSensitivity);
  const messages: PickPreview["messages"] = [];
  const empty = Object.values(lineup).filter(Boolean).length === 0;
  const cat: [keyof NbaTeamEval, string, string][] = [
    ["shooting", "tu tiro exterior", "tu tiro exterior"], ["playmaking", "la creación de juego", "la creación de juego"],
    ["defense", "la defensa", "el equilibrio defensivo"], ["rimProtection", "la protección del aro", "la protección del aro"],
    ["rebounding", "el rebote", "el rebote"], ["offense", "el ataque", "el ataque"],
  ];
  if (!empty) for (const [k, up, down] of cat) {
    const d = (after[k] as number) - (before[k] as number);
    if (d >= 2) messages.push({ tone: "good", text: `Mejora ${up} (+${Math.round(d)})` });
    else if (d <= -2) messages.push({ tone: "bad", text: `Reduce ${down} (${Math.round(d)})` });
  }
  const statusOf = (e: NbaTeamEval, k: FitItem["key"]) => e.fit.find((i) => i.key === k);
  for (const k of ["spacing", "creator", "rim", "rebounding", "defense", "ball", "position"] as FitItem["key"][]) {
    const b = statusOf(before, k), a = statusOf(after, k);
    if (!a) continue;
    if ((a.status === "penalty" || a.status === "bonus") && (a.value !== (b?.value ?? 0))) messages.push({ tone: a.value > (b?.value ?? 0) ? "good" : "bad", text: `${a.label}: ${a.detail} (${a.value > 0 ? "+" : ""}${a.value.toFixed(1)} net)` });
    else if (b && (b.status === "pending" || b.status === "penalty") && a.status === "ok") messages.push({ tone: "good", text: `Cubre una necesidad: ${a.label.toLowerCase()} — ${a.detail}` });
  }
  if (!messages.length) messages.push({ tone: "neutral", text: "Encaje neutro: no cambia el equilibrio del equipo." });
  return { before, after, deltaNet: Math.round((after.net - before.net) * 10) / 10, deltaChem: after.chemistry - before.chemistry, messages };
}
