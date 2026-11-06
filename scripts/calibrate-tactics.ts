/**
 * Tactics calibration: (1) metric distribution on random XIs → TACTIC_REF;
 * (2) analytic expected PL points per tactic (exact outcome probabilities, no fatigue)
 * for weak / average / strong XIs; (3) full-season Monte Carlo per tactic.
 * Usage: npx tsx scripts/calibrate-tactics.ts [seasons]
 */
import { createFbDraft, isFbComplete, pickFb } from "@/features/football-draft/engine";
import { buildSquad, userTeamInput } from "@/features/football-draft/squad";
import { TACTIC_IDS, tacticMetric, tacticAdjust, chooseTactic, type TacticId } from "@/features/football-simulation/tactics";
import { outcomeProbs } from "@/features/football-simulation/match";
import { simulateOne } from "@/features/football-simulation/monte-carlo";
import { PL_CLUBS } from "@/lib/data/football/world";

const N = Number(process.argv[2] ?? 40);
const drafts = Array.from({ length: 120 }, (_, i) => {
  let s = createFbDraft(`cal${i}`, "NORMAL", i % 2 ? "fut" : "roulette", "4-3-3");
  if (s.mode === "fut") { /* captain */ const { pickCaptain, captainSlots } = require("@/features/football-draft/engine"); const c = s.options[i % s.options.length]; s = pickCaptain(s, c, captainSlots(s, c)[0]).state; }
  while (!isFbComplete(s)) { const r = pickFb(s, s.options[(i * 7) % s.options.length]); if (!r.ok) break; s = r.state; }
  return s;
});
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
console.log("== metric distribution (p25 / p50 / p75)");
for (const t of TACTIC_IDS.filter((x) => x !== "balanced")) {
  const v = drafts.map((d) => tacticMetric(buildSquad(d.formationId, d.lineup, d.captainId), t));
  console.log(t.padEnd(11), q(v, 0.25).toFixed(1), q(v, 0.5).toFixed(1), q(v, 0.75).toFixed(1));
}
function expPts(att: number, def: number, rating: number, t: TacticId, fit: number) {
  let pts = 0;
  for (const o of PL_CLUBS) for (const venue of ["home", "away"] as const) {
    const a = tacticAdjust({ id: t, fit }, rating, o.rating);
    const p = outcomeProbs({ id: "U", att: att + a.att, def: def + a.def }, o, venue);
    pts += 3 * p.win + p.draw;
  }
  return pts * (19 / 20); // 38 matches (approx: removes the replaced club)
}
console.log("\n== analytic PL points (no fatigue) by XI strength × tactic fit");
for (const [label, att, def, rating] of [["weak 70", 70, 70, 70], ["weak 76", 76, 76, 76], ["avg 83", 83, 83, 83], ["strong 90", 90, 90, 90]] as const) {
  for (const fit of [-1, 0, 1]) console.log(label, `fit ${fit}`.padEnd(7), TACTIC_IDS.map((t) => `${t.slice(0, 5)} ${expPts(att, def, rating, t, t === "balanced" ? 0 : fit).toFixed(1)}`).join(" | "));
}
console.log(`\n== full seasons (${N} per tactic, 6 XIs): mean PL pts / GF / GA / P(PL) / P(UCL)`);
for (const t of TACTIC_IDS) {
  let pts = 0, gf = 0, ga = 0, pl = 0, ucl = 0, n = 0;
  for (let k = 0; k < 6; k++) {
    const d = drafts[k * 17];
    const input = userTeamInput(d.formationId, d.lineup, d.captainId, "NORMAL", "ARS", "Arsenal", undefined, false, undefined, t);
    for (let i = 0; i < N; i++) { const o = simulateOne(input, "NORMAL", `tc${k}-${i}`); pts += o.pts; gf += o.gf; ga += o.ga; pl += +o.won.PL; ucl += +o.won.UCL; n++; }
  }
  console.log(t.padEnd(11), (pts / n).toFixed(1), (gf / n).toFixed(1), (ga / n).toFixed(1), (pl / n).toFixed(2), (ucl / n).toFixed(2));
}
void chooseTactic;
