/**
 * Candidate comparison: projected impact of placing a card in the current slot.
 * Pure (no RNG, no draft mutation): it only reads the lineup and reuses the real
 * chemistry/ratings functions and the exact match-outcome probabilities of the engine.
 */
import { DIFFICULTY_PARAMS, type Difficulty } from "@/lib/core/difficulty";
import { leagueOf } from "@/lib/data/football/clubs";
import { PL_CLUBS } from "@/lib/data/football/world";
import { computeChemistry, previewFbPick, slotFit, teamRatings, type ChemRules, type FbPickPreview } from "@/lib/ratings/football";
import { outcomeProbs } from "@/features/football-simulation/match";
import type { FbPlayerSeason, Formation } from "@/types/football";

export interface PickImpact {
  preview: FbPickPreview;
  fit: number;
  before: { ovr: number; attack: number; midfield: number; defense: number; att: number; def: number };
  after: { ovr: number; attack: number; midfield: number; defense: number; att: number; def: number };
  /** vs the reference rival (average Premier League club at this difficulty, home, no fatigue, balanced tactic) */
  probs: { win: number; draw: number; loss: number } | null;
  placed: number;
}

/** The explicit reference rival used by every comparison. */
export function referenceRival(difficulty: Difficulty) {
  const b = DIFFICULTY_PARAMS[difficulty].fbRivalBoost;
  const avg = (f: (t: (typeof PL_CLUBS)[number]) => number) => PL_CLUBS.reduce((a, t) => a + f(t), 0) / PL_CLUBS.length;
  return { id: "REF", att: avg((t) => t.att) + b, def: avg((t) => t.def) + b };
}

export function pickImpact(formation: Formation, lineup: Record<string, FbPlayerSeason | undefined>, slotId: string, card: FbPlayerSeason, captainId: string | null, difficulty: Difficulty, rules: ChemRules): PickImpact {
  const sens = DIFFICULTY_PARAMS[difficulty].fbFitSensitivity;
  const preview = previewFbPick(formation, lineup, slotId, card, leagueOf, captainId, sens, rules.weight, rules.extended);
  const next = { ...lineup, [slotId]: card };
  const rate = (lu: typeof lineup) => {
    const chem = computeChemistry(formation, lu, leagueOf, captainId, rules.extended).total;
    const r = teamRatings(formation, lu, chem, sens, rules.weight);
    return { ovr: r.ovr, attack: r.attack, midfield: r.midfield, defense: r.defense, att: r.att, def: r.def };
  };
  const placed = Object.values(next).filter(Boolean).length;
  const after = rate(next);
  const slot = formation.slots.find((s) => s.id === slotId)!;
  const ref = referenceRival(difficulty);
  const probs = placed >= 4 ? outcomeProbs({ id: "ME", att: after.att, def: after.def }, ref, "home") : null;
  return { preview, fit: slotFit(card, slot.pos), before: rate(lineup), after, probs: probs && { win: probs.win, draw: probs.draw, loss: probs.loss }, placed };
}

const ATTR_ES: Record<string, string> = { pac: "ritmo", sho: "tiro", pas: "pase", dri: "regate", def: "defensa", phy: "físico", div: "estirada", han: "manejo", kic: "saque", ref: "reflejos", spd: "velocidad", pos: "colocación" };
/** Strengths/weaknesses of A relative to B (attributes differing by ≥3), never a "winner by OVR". */
export function contrast(a: FbPlayerSeason, b: FbPlayerSeason): { better: string[]; worse: string[] } {
  const A = (a.gk ?? a.attrs ?? {}) as Record<string, number>, B = (b.gk ?? b.attrs ?? {}) as Record<string, number>;
  const keys = Object.keys(A).filter((k) => k in B);
  const diff = keys.map((k) => ({ k, d: A[k] - B[k] })).sort((x, y) => y.d - x.d);
  return { better: diff.filter((x) => x.d >= 3).slice(0, 3).map((x) => `más ${ATTR_ES[x.k] ?? x.k} (+${x.d})`), worse: diff.filter((x) => x.d <= -3).slice(-3).reverse().map((x) => `menos ${ATTR_ES[x.k] ?? x.k} (${x.d})`) };
}
