import { describe, expect, it } from "vitest";
import { chemRulesFor } from "@/lib/ratings/football";
import { createFbDraft, isFbComplete, pickFb } from "@/features/football-draft/engine";
import { buildFbSnapshot, buildSquad, rebuildFromSnapshot, userTeamInput } from "@/features/football-draft/squad";
import { createSeason, plTable, simulateRest } from "@/features/football-simulation/season";
import { simulateOne, runSeed } from "@/features/football-simulation/monte-carlo";
import { TACTIC_IDS, tacticAdjust, tacticFit, tacticPreview } from "@/features/football-simulation/tactics";
import { outcomeProbs, playMatch } from "@/features/football-simulation/match";
import { Rng } from "@/lib/core/rng";

const drafted = (seed: string) => {
  let s = createFbDraft(seed, "NORMAL", "roulette", "4-3-3");
  while (!isFbComplete(s)) { const r = pickFb(s, s.options[0]); if (!r.ok) throw new Error(r.error); s = r.state; }
  return s;
};

describe("exact outcome probabilities match the engine", () => {
  it("analytic W/D/L ≈ simulated frequencies of playMatch (20k matches)", () => {
    const a = { id: "A", att: 84, def: 82 }, b = { id: "B", att: 78, def: 79 };
    const p = outcomeProbs(a, b, "home");
    const rng = new Rng("probs");
    let w = 0, d = 0; const N = 20000;
    for (let i = 0; i < N; i++) { const m = playMatch(rng, a, b, { id: `m${i}`, comp: "PL", stage: "R1", date: "2026-08-15", decider: "none" }); if (m.hg > m.ag) w++; else if (m.hg === m.ag) d++; }
    expect(Math.abs(w / N - p.win)).toBeLessThan(0.012);
    expect(Math.abs(d / N - p.draw)).toBeLessThan(0.012);
  });
});

describe("tactics", () => {
  const d = drafted("tac1");
  const base = userTeamInput(d.formationId, d.lineup, d.captainId, "NORMAL", "ARS", "Arsenal");
  it("Equilibrado reproduces the pre-V4 engine exactly (same matches as no tactic)", () => {
    const withBal = userTeamInput(d.formationId, d.lineup, d.captainId, "NORMAL", "ARS", "Arsenal", undefined, true, undefined, "balanced");
    expect(withBal.tactic).toBeUndefined();
    expect(simulateRest(createSeason("t-s", "NORMAL", withBal)).matches).toEqual(simulateRest(createSeason("t-s", "NORMAL", base)).matches);
  });
  it("every tactic changes the simulation, deterministically", () => {
    const ref = simulateRest(createSeason("t-s", "NORMAL", base)).matches.map((m) => `${m.hg}-${m.ag}`).join();
    for (const t of TACTIC_IDS.filter((x) => x !== "balanced")) {
      const inp = userTeamInput(d.formationId, d.lineup, d.captainId, "NORMAL", "ARS", "Arsenal", undefined, true, undefined, t);
      const a = simulateRest(createSeason("t-s", "NORMAL", inp)), b = simulateRest(createSeason("t-s", "NORMAL", inp));
      expect(a.matches).toEqual(b.matches);
      expect(a.matches.map((m) => `${m.hg}-${m.ag}`).join()).not.toBe(ref);
      expect(a.tactic?.id).toBe(t);
    }
  });
  it("Monte Carlo uses the same tactic as the season (same seed → same PL points)", () => {
    const inp = userTeamInput(d.formationId, d.lineup, d.captainId, "NORMAL", "ARS", "Arsenal", undefined, false, undefined, "press");
    const s = simulateRest(createSeason(runSeed("q", 3), "NORMAL", userTeamInput(d.formationId, d.lineup, d.captainId, "NORMAL", "ARS", "Arsenal", undefined, true, undefined, "press")));
    expect(simulateOne(inp, "NORMAL", runSeed("q", 3)).pts).toBe(plTable(s).find((r) => r.team === s.userId)!.pts);
  });
  it("snapshot keeps the tactic and rebuilds the identical season", () => {
    const inp = userTeamInput(d.formationId, d.lineup, d.captainId, "NORMAL", "ARS", "Arsenal", undefined, true, chemRulesFor(d.mode), "lowblock");
    const played = simulateRest(createSeason("snap-t", "NORMAL", inp));
    const snap = buildFbSnapshot(d, "snap-t", "ARS", "Arsenal", undefined, undefined, undefined, "lowblock");
    expect(snap.tactic).toBe("lowblock");
    expect(rebuildFromSnapshot(snap)!.season.matches).toEqual(played.matches);
  });
  it("trade-offs: each tactic has a downside and none is best in every context", () => {
    for (const t of TACTIC_IDS.filter((x) => x !== "balanced")) {
      const worst = Math.min(...[-1, 1].flatMap((f) => [-1, 1].map((r) => { const a = tacticAdjust({ id: t, fit: f }, 80, 80 + r * 8); return Math.min(a.att, a.def); })));
      expect(worst).toBeLessThan(0);
    }
    const sq = buildSquad(d.formationId, d.lineup, d.captainId);
    const best = (rating: number) => { const p = tacticPreview({ rating, att: rating, def: rating }, sq, "NORMAL"); return p.sort((a, b) => b.expPts - a.expPts)[0].id; };
    expect(new Set([best(68), best(76), best(90)]).size).toBeGreaterThan(1);
  });
  it("fit is bounded and derived from the XI", () => {
    const sq = buildSquad(d.formationId, d.lineup, d.captainId);
    for (const t of TACTIC_IDS) { const f = tacticFit(sq, t); expect(f).toBeGreaterThanOrEqual(-1); expect(f).toBeLessThanOrEqual(1); }
  });
});
