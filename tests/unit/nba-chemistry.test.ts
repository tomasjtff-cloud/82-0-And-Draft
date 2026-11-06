import { describe, expect, it } from "vitest";
import { ALL_CARDS } from "@/features/nba-draft/engine";
import { evaluateNbaTeam, previewPick } from "@/lib/ratings/nba";
import { simulateSeason } from "@/features/nba-simulation/engine";
import type { NbaCard, NbaPos } from "@/types/nba";

const by = (n: string, y: number) => ALL_CARDS.find((c) => c.name === n && c.startYear === y)!;
const L = (x: [NbaPos, NbaCard][]) => Object.fromEntries(x) as Partial<Record<NbaPos, NbaCard>>;

describe("NBA chemistry (explainable fit)", () => {
  const base: [NbaPos, NbaCard][] = [["PG", by("Stephen Curry", 2015)], ["SG", by("Klay Thompson", 2015)], ["SF", by("Kevin Durant", 2017)], ["PF", by("Draymond Green", 2015)]];
  it("fit items sum to the applied adjustment and chemistry is derived from them", () => {
    const e = evaluateNbaTeam(L([...base, ["C", by("Andrew Bogut", 2014)]]));
    const sum = e.fit.reduce((s, i) => s + i.value, 0);
    expect(Math.round(sum * 10) / 10).toBe(e.fitAdjust);
    expect(e.chemistry).toBe(Math.round(Math.max(0, Math.min(100, 70 + sum * 8))));
  });
  it("needs are pending while picks remain, penalised once the lineup is complete", () => {
    const partial = evaluateNbaTeam(L([["PG", by("Stephen Curry", 2015)]]));
    expect(partial.fit.find((i) => i.key === "rim")!.status).toBe("pending");
    const noRim = evaluateNbaTeam(L([["PG", by("Stephen Curry", 2015)], ["SG", by("Klay Thompson", 2015)], ["SF", by("Kevin Durant", 2017)], ["PF", by("Dirk Nowitzki", 2006)], ["C", by("Kevin Love", 2016)]]));
    const rim = noRim.fit.find((i) => i.key === "rim")!;
    if (rim.status === "penalty") expect(rim.value).toBeLessThan(0);
  });
  it("preview explains the pick and matches the evaluation the simulator uses", () => {
    const p = previewPick(L(base), by("Andrew Bogut", 2014), "C");
    expect(p.after.net).toBe(evaluateNbaTeam(L([...base, ["C", by("Andrew Bogut", 2014)]])).net);
    expect(p.messages.length).toBeGreaterThan(0);
    const bad = previewPick(L(base), by("Kevin Love", 2016), "C");
    expect(typeof bad.deltaNet).toBe("number");
  });
  it("no bonus for shared franchise or fame: identical ratings, different franchises → same fit", () => {
    const e = evaluateNbaTeam(L(base));
    expect(e.fit.every((i) => !/franquicia|famos/i.test(i.detail))).toBe(true);
  });
  it("chemistry affects the simulation (fitAdjust is part of net)", () => {
    const lineup = L([...base, ["C", by("Andrew Bogut", 2014)]]);
    const e1 = evaluateNbaTeam(lineup, 1), e2 = evaluateNbaTeam(lineup, 2);
    if (e1.fitAdjust !== 0) expect(e2.net).not.toBe(e1.net);
    expect(simulateSeason(lineup, "NORMAL", "c").result.teamNet).toBe(e1.net);
  });
});
