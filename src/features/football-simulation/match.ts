/**
 * Match engine: independent Poisson goals with expected goals
 *   λ = base · exp(k·(ATT_team − DEF_opp) + homeAdvantage)
 * Ratings are inputs, never outcomes. A per-match form term adds variance so
 * strong teams win more often but can lose, and weak teams can surprise.
 */
import type { Rng } from "@/lib/core/rng";
import type { CompId, Match } from "@/types/football";

export const BASE_GOALS = 1.36;
export const K = 0.042;
export const HOME_ADV = 0.12;
export const FORM_SD = 1.6;

export interface Side { id: string; att: number; def: number }

export function expectedGoals(a: Side, b: Side, venue: "home" | "away" | "neutral"): number {
  const adv = venue === "home" ? HOME_ADV : venue === "away" ? -HOME_ADV : 0;
  return BASE_GOALS * Math.exp(K * (a.att - b.def) + adv);
}

function goals(rng: Rng, lambda: number): number {
  return Math.min(9, rng.poisson(Math.max(0.05, lambda)));
}

export function penalties(rng: Rng, a: Side, b: Side): { h: number; a: number } {
  const pA = Math.max(0.62, Math.min(0.88, 0.76 + (a.att - b.def) * 0.003));
  const pB = Math.max(0.62, Math.min(0.88, 0.76 + (b.att - a.def) * 0.003));
  let h = 0, w = 0;
  for (let i = 0; i < 5; i++) {
    if (rng.next() < pA) h++;
    if (h > w + (5 - i)) break;
    if (rng.next() < pB) w++;
    if (w > h + (4 - i)) break;
  }
  let guard = 0;
  while (h === w && guard++ < 30) {
    const x = rng.next() < pA ? 1 : 0, y = rng.next() < pB ? 1 : 0;
    h += x; w += y;
  }
  if (h === w) h++; // unreachable in practice; keeps result valid
  return { h, a: w };
}

export type Decider = "none" | "pens" | "et+pens";

export interface PlayOpts {
  id: string; comp: CompId; stage: string; date: string; neutral?: boolean; decider: Decider;
  /** two-legged second leg: aggregate goals before this match (home team of THIS leg first) */
  aggregateBefore?: { home: number; away: number };
  tieId?: string; leg?: 1 | 2;
}

export function playMatch(rng: Rng, home: Side, away: Side, o: PlayOpts): Match {
  const fh = rng.normal(0, FORM_SD), fa = rng.normal(0, FORM_SD);
  const H = { ...home, att: home.att + fh, def: home.def + fh };
  const A = { ...away, att: away.att + fa, def: away.def + fa };
  const lh = expectedGoals(H, A, o.neutral ? "neutral" : "home");
  const la = expectedGoals(A, H, o.neutral ? "neutral" : "away");
  const hg = goals(rng, lh), ag = goals(rng, la);
  const m: Match = { id: o.id, comp: o.comp, stage: o.stage, date: o.date, home: home.id, away: away.id, hg, ag, neutral: !!o.neutral, tieId: o.tieId, leg: o.leg, et: null, pens: null, xg: { h: lh, a: la } };
  if (o.decider === "none") return m;
  const aggH = (o.aggregateBefore?.home ?? 0) + hg;
  const aggA = (o.aggregateBefore?.away ?? 0) + ag;
  if (aggH !== aggA) return m;
  if (o.decider === "et+pens") {
    const eh = goals(rng, lh / 3), ea = goals(rng, la / 3);
    m.et = { hg: eh, ag: ea };
    m.xg = { h: lh * (4 / 3), a: la * (4 / 3) };
    if (aggH + eh !== aggA + ea) return m;
  }
  m.pens = penalties(rng, H, A);
  return m;
}

/** Winner of a single match or of the deciding leg (needs aggregate for two-legged ties). */
export function decidedWinner(m: Match, aggregateBefore?: { home: number; away: number }): string {
  const h = (aggregateBefore?.home ?? 0) + m.hg + (m.et?.hg ?? 0);
  const a = (aggregateBefore?.away ?? 0) + m.ag + (m.et?.ag ?? 0);
  if (h > a) return m.home;
  if (a > h) return m.away;
  if (!m.pens) throw new Error(`Match ${m.id} level without penalties`);
  return m.pens.h > m.pens.a ? m.home : m.away;
}

export function scoreline(m: Match): string {
  let s = `${m.hg}-${m.ag}`;
  if (m.et) s += ` (pró. ${m.hg + m.et.hg}-${m.ag + m.et.ag})`;
  if (m.pens) s += ` · pen. ${m.pens.h}-${m.pens.a}`;
  return s;
}

/* ───────── Exact outcome probabilities (no RNG) ───────── */
const poissonPmf = (l: number): number[] => {
  const out: number[] = []; let p = Math.exp(-l), acc = 0;
  for (let k = 0; k < 9; k++) { out.push(p); acc += p; p *= l / (k + 1); }
  out.push(Math.max(0, 1 - acc)); // goals are capped at 9 by the engine
  return out;
};
/**
 * Win/draw/loss probabilities of a single 90' match under the SAME model as playMatch:
 * Poisson goals with λ from expectedGoals and the per-match form terms integrated out
 * (form difference d = f_a − f_b ~ N(0, FORM_SD·√2), 41-point quadrature). Pure, deterministic, ~0.1 ms.
 */
export function outcomeProbs(a: Side, b: Side, venue: "home" | "away" | "neutral"): { win: number; draw: number; loss: number; xgFor: number; xgAgainst: number } {
  const adv = venue === "home" ? HOME_ADV : venue === "away" ? -HOME_ADV : 0;
  const sd = FORM_SD * Math.SQRT2;
  let win = 0, draw = 0, loss = 0, wsum = 0, xf = 0, xa = 0;
  for (let i = -20; i <= 20; i++) {
    const z = (i / 20) * 4, w = Math.exp(-0.5 * z * z), d = z * sd;
    const la = Math.max(0.05, BASE_GOALS * Math.exp(K * (a.att - b.def + d) + adv));
    const lb = Math.max(0.05, BASE_GOALS * Math.exp(K * (b.att - a.def - d) - adv));
    const pa = poissonPmf(la), pb = poissonPmf(lb);
    let W = 0, D = 0;
    for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) { const q = pa[x] * pb[y]; if (x > y) W += q; else if (x === y) D += q; }
    win += w * W; draw += w * D; loss += w * (1 - W - D); wsum += w; xf += w * la; xa += w * lb;
  }
  return { win: win / wsum, draw: draw / wsum, loss: loss / wsum, xgFor: xf / wsum, xgAgainst: xa / wsum };
}
