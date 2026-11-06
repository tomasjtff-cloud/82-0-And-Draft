import { describe, expect, it } from "vitest";
import { runSeed, simulateOne, summarizeRuns, wilson } from "@/features/football-simulation/monte-carlo";
import { createSeason, plTable, simulateRest, summarize } from "@/features/football-simulation/season";

const strong = { clubId: "ARS", name: "Arsenal", rating: 92, att: 95, def: 92 };
const weak = { clubId: "ARS", name: "Arsenal", rating: 76, att: 77, def: 76 };
const runMany = (u: typeof strong, n: number, seed = "mc") => Array.from({ length: n }, (_, i) => simulateOne(u, "NORMAL", runSeed(seed, i)));

describe("football Monte Carlo", () => {
  it("each run is exactly the real season engine for that seed", () => {
    const seed = runSeed("x", 3);
    const o = simulateOne(strong, "NORMAL", seed);
    const s = simulateRest(createSeason(seed, "NORMAL", strong));
    const row = plTable(s).find((r) => r.team === s.userId)!;
    expect(o.plPos).toBe(row.pos);
    expect(o.pts).toBe(row.pts);
    const t = summarize(s).trophies;
    expect(o.won.PL).toBe(t[0].status === "won");
    expect(o.won.UCL).toBe(t[1].status === "won");
    expect(o.won.FA).toBe(t[2].status === "won");
    expect(o.won.EFL).toBe(t[3].status === "won");
  });
  it("is reproducible and seeds are independent", () => {
    expect(runMany(strong, 10, "r")).toEqual(runMany(strong, 10, "r"));
    expect(runMany(strong, 10, "r").map((o) => o.pts)).not.toEqual(runMany(strong, 10, "q").map((o) => o.pts));
  });
  it("summary is internally consistent and responds to team strength", () => {
    const s = summarizeRuns(runMany(strong, 60));
    const w = summarizeRuns(runMany(weak, 60));
    expect(s.posDist.reduce((a, b) => a + b, 0)).toBe(60);
    expect(s.uclStages.reduce((a, b) => a + b, 0)).toBe(60);
    expect(s.titles.quadruple.k).toBeLessThanOrEqual(Math.min(s.titles.PL.k, s.titles.UCL.k, s.titles.FA.k, s.titles.EFL.k));
    expect(s.titleCountDist[4]).toBe(s.titles.quadruple.k);
    expect(s.titles.PL.k).toBe(s.posDist[0]);
    expect(s.avgPts).toBeGreaterThan(w.avgPts + 15);
    expect(s.titles.PL.p).toBeGreaterThan(w.titles.PL.p);
    for (const p of Object.values(s.titles)) { expect(p.lo).toBeLessThanOrEqual(p.p); expect(p.hi).toBeGreaterThanOrEqual(p.p); }
  });
  it("Wilson interval behaves for rare events", () => {
    const [lo, hi] = wilson(0, 1000);
    expect(lo).toBe(0); expect(hi).toBeGreaterThan(0.002); expect(hi).toBeLessThan(0.005);
    const [l2, h2] = wilson(500, 1000);
    expect(l2).toBeGreaterThan(0.46); expect(h2).toBeLessThan(0.54);
  });
});
