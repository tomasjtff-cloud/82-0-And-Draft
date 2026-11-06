/**
 * Tactics (fixed for the whole season). They act ONLY on the user's side, inside the same
 * Poisson model, as offsets in ATT/DEF units (1 unit ≈ ±4.2 % expected goals) plus a fatigue
 * multiplier. Each offset depends on:
 *   - fit f ∈ [−1, 1]: how well the XI's (estimated) attributes suit the tactic;
 *   - r ∈ [−1, 1]: relative strength of the opponent ((opp − user rating)/8, + = stronger rival).
 * "Equilibrado" is exactly the pre-V4 engine (no offsets, no extra RNG): old saves reproduce.
 * Coefficients and limits are documented in TACTICS.md and calibrated in tests/unit/tactics.test.ts.
 */
import type { FbAttrs, FbPos, SquadMember } from "@/types/football";

export type TacticId = "balanced" | "possession" | "counter" | "press" | "lowblock";
export const TACTIC_IDS: TacticId[] = ["balanced", "possession", "counter", "press", "lowblock"];
export interface TacticChoice { id: TacticId; fit: number }
export const BALANCED: TacticChoice = { id: "balanced", fit: 0 };

export interface TacticInfo { id: TacticId; name: string; icon: string; summary: string; strengths: string[]; risks: string[]; metric: string; possession: number }
export const TACTICS: Record<TacticId, TacticInfo> = {
  balanced: { id: "balanced", name: "Equilibrado", icon: "⚖", summary: "La referencia: sin ajustes tácticos.", strengths: ["Sin riesgos añadidos", "Rendimiento estable ante cualquier rival"], risks: ["No explota las virtudes específicas de tu plantilla"], metric: "—", possession: 0 },
  possession: { id: "possession", name: "Posesión", icon: "◎", summary: "Control del balón con pase y regate.", strengths: ["Más ocasiones y menos llegadas rivales con un XI técnico", "Menos desgaste físico"], risks: ["Pierde eficacia ante rivales superiores", "Un XI poco técnico sufre"], metric: "pase y regate de medios y atacantes", possession: 9 },
  counter: { id: "counter", name: "Contraataque", icon: "➹", summary: "Transiciones rápidas al espacio.", strengths: ["Muy eficaz contra rivales superiores", "Rinde con atacantes veloces"], risks: ["Contra rivales débiles genera poco", "Depende del ritmo de delanteros y laterales"], metric: "ritmo de atacantes y laterales", possession: -7 },
  press: { id: "press", name: "Presión alta", icon: "⇑", summary: "Recuperar arriba y atacar rápido.", strengths: ["Mucho volumen ofensivo", "Asfixia a cualquier rival"], risks: ["Espacios a la espalda: concedes más", "Mucha más fatiga en semanas cargadas"], metric: "físico y defensa de medios y atacantes", possession: 4 },
  lowblock: { id: "lowblock", name: "Bloque bajo", icon: "▬", summary: "Defensa compacta cerca del área.", strengths: ["Encajas mucho menos", "Aún más sólido contra rivales superiores", "Menos fatiga"], risks: ["Generas bastante menos en ataque", "Contra rivales débiles cuesta ganar"], metric: "defensa y físico de defensas y pivotes", possession: -11 },
};

const ATT_POS: FbPos[] = ["ST", "CF", "LW", "RW"];
const MID_POS: FbPos[] = ["CAM", "CM", "CDM", "LM", "RM"];
const DEF_POS: FbPos[] = ["CB", "LB", "RB", "LWB", "RWB"];
const WIDE_DEF: FbPos[] = ["LB", "RB", "LWB", "RWB"];
const mean = (xs: number[], fb: number) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : fb);
const attrsOf = (sq: SquadMember[], pos: FbPos[], f: (a: FbAttrs) => number) => sq.filter((m) => m.attrs && pos.includes(m.pos)).map((m) => f(m.attrs!));

/** Raw tactic metric of an XI (estimated attributes) — reference values come from the dataset (≈ median XI). */
export function tacticMetric(sq: SquadMember[], id: TacticId): number {
  switch (id) {
    case "possession": return mean(attrsOf(sq, [...MID_POS, ...ATT_POS], (a) => (a.pas + a.dri) / 2), 70);
    case "counter": return mean([...attrsOf(sq, ATT_POS, (a) => a.pac), ...attrsOf(sq, WIDE_DEF, (a) => a.pac)], 70);
    case "press": return mean(attrsOf(sq, [...MID_POS, ...ATT_POS], (a) => (a.phy + a.def) / 2), 60);
    case "lowblock": return mean(attrsOf(sq, [...DEF_POS, "CDM"], (a) => (a.def + a.phy) / 2), 75);
    default: return 0;
  }
}
/** Reference (median) and spread per metric, measured on random drafted XIs (see tests). */
export const TACTIC_REF: Record<Exclude<TacticId, "balanced">, { mid: number; spread: number }> = {
  possession: { mid: 82.4, spread: 4.1 }, counter: { mid: 84.2, spread: 3.8 }, press: { mid: 66.9, spread: 4.4 }, lowblock: { mid: 81.7, spread: 3.2 },
};
const clamp = (x: number, a = -1, b = 1) => Math.max(a, Math.min(b, x));

export function tacticFit(sq: SquadMember[], id: TacticId): number {
  if (id === "balanced" || !sq.length) return 0;
  const r = TACTIC_REF[id];
  return Math.round(clamp((tacticMetric(sq, id) - r.mid) / r.spread) * 100) / 100;
}
export const chooseTactic = (sq: SquadMember[], id: TacticId): TacticChoice => ({ id, fit: tacticFit(sq, id) });

/** Coefficients (ATT/DEF units). Offsets are bounded to ±4 units. */
export const TACTIC_COEF: Record<TacticId, { att: [number, number, number]; def: [number, number, number]; fatigue: number }> = {
  //                 [base, ×fit, ×rivalStrength]
  balanced: { att: [0, 0, 0], def: [0, 0, 0], fatigue: 1 },
  possession: { att: [0.3, 1.4, -0.8], def: [-0.4, 0.8, -0.4], fatigue: 0.9 },
  counter: { att: [-0.4, 1.4, 1.6], def: [0.6, 0.3, 0.6], fatigue: 1 },
  press: { att: [1.5, 1.0, -0.2], def: [-1.7, 0.8, -0.4], fatigue: 1.45 },
  lowblock: { att: [-2.0, 0.3, 0.2], def: [2.2, 0.9, 0.6], fatigue: 0.8 },
};

export function tacticAdjust(t: TacticChoice | undefined | null, userRating: number, oppRating: number): { att: number; def: number } {
  if (!t || t.id === "balanced") return { att: 0, def: 0 };
  const c = TACTIC_COEF[t.id], r = clamp((oppRating - userRating) / 8), f = clamp(t.fit);
  const v = (k: [number, number, number]) => clamp(k[0] + k[1] * f + k[2] * r, -4, 4);
  return { att: v(c.att), def: v(c.def) };
}
export const tacticFatigue = (t: TacticChoice | undefined | null) => (t ? TACTIC_COEF[t.id].fatigue : 1);

/* ───────── Engine-backed preview (exact probabilities, no fatigue, no RNG) ───────── */
import { outcomeProbs } from "./match";
import { PL_CLUBS } from "@/lib/data/football/world";
import { DIFFICULTY_PARAMS, type Difficulty } from "@/lib/core/difficulty";

export interface TacticPreview { id: TacticId; fit: number; vsAvg: { att: number; def: number }; vsTop: { att: number; def: number }; expPts: number; winVsAvg: number }
/** Expected Premier League points over a double round robin (38 matches, exact outcome probabilities, no fatigue/form drift). */
export function tacticPreview(user: { rating: number; att: number; def: number }, sq: SquadMember[], difficulty: Difficulty): TacticPreview[] {
  const boost = DIFFICULTY_PARAMS[difficulty].fbRivalBoost;
  const rivals = PL_CLUBS.map((t) => ({ id: t.id, att: t.att + boost, def: t.def + boost, rating: t.rating + boost }));
  const avg = rivals.reduce((a, t) => a + t.rating, 0) / rivals.length, top = Math.max(...rivals.map((t) => t.rating));
  const avgSide = { id: "AVG", att: rivals.reduce((a, t) => a + t.att, 0) / rivals.length, def: rivals.reduce((a, t) => a + t.def, 0) / rivals.length };
  return TACTIC_IDS.map((id) => {
    const t = chooseTactic(sq, id);
    let pts = 0;
    for (const o of rivals) for (const venue of ["home", "away"] as const) {
      const a = tacticAdjust(t, user.rating, o.rating);
      const p = outcomeProbs({ id: "U", att: user.att + a.att, def: user.def + a.def }, o, venue);
      pts += 3 * p.win + p.draw;
    }
    const aAvg = tacticAdjust(t, user.rating, avg);
    const w = outcomeProbs({ id: "U", att: user.att + aAvg.att, def: user.def + aAvg.def }, avgSide, "home").win;
    return { id, fit: t.fit, vsAvg: aAvg, vsTop: tacticAdjust(t, user.rating, top), expPts: (pts * 19) / 20, winVsAvg: w };
  });
}
