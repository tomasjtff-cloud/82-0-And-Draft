import { describe, expect, it } from "vitest";
import { FB_CARD_BY_ID } from "@/features/football-draft/engine";
import { FORMATION_BY_ID } from "@/lib/data/football/formations";
import { leagueOf } from "@/lib/data/football/clubs";
import { chemTips, chemistryBreakdown, computeChemistry } from "@/lib/ratings/football";
import type { FbPlayerSeason } from "@/types/football";

const card = (name: string, club: string, year: number): FbPlayerSeason => {
  const c = Object.values(FB_CARD_BY_ID).find((x) => x.name === name && x.clubId === club && x.startYear === year);
  if (!c) throw new Error(`missing ${name} ${club} ${year}`);
  return c;
};
const fm = FORMATION_BY_ID["4-3-3"];
const slot = (pos: string, n = 0) => fm.slots.filter((s) => s.pos === pos)[n].id;

describe("chemistry v4: the De Jong case", () => {
  // De Jong (BAR), Di María + Ramos (RMA), an Atlético player: 4 LaLiga players, no other Dutch or Barça player.
  const lineup: Record<string, FbPlayerSeason | undefined> = {
    [slot("CM", 0)]: card("Frenkie de Jong", "BAR", 2019),
    [slot("RW")]: { ...card("Ángel Di María", "RMA", 2013), positions: ["RW"] } as FbPlayerSeason,
    [slot("CB", 0)]: card("Sergio Ramos", "RMA", 2016),
    [slot("CM", 1)]: card("Adelardo", "ATM", 1973),
  };
  it("4 LaLiga players give exactly +1 league, nothing else → 1/3 (FUT rules)", () => {
    const b = chemistryBreakdown(fm, lineup, leagueOf, null, false);
    const dj = b.slots[slot("CM", 0)];
    expect(dj.groups.find((g) => g.kind === "league")).toMatchObject({ count: 4, points: 1, next: 5 });
    expect(dj.groups.find((g) => g.kind === "club")).toMatchObject({ count: 1, points: 0, next: 2 });
    expect(dj.groups.find((g) => g.kind === "nation")).toMatchObject({ count: 1, points: 0, next: 2 });
    expect(dj.effective).toBe(1);
    expect(computeChemistry(fm, lineup, leagueOf, null).perSlot[slot("CM", 0)]).toBe(1);
    expect(chemTips(dj).join(" ")).toMatch(/1 jugador más .*liga \(4\/5\)/);
  });
  it("a 5th LaLiga player lifts the league bonus to +2", () => {
    const five = { ...lineup, [slot("ST")]: card("José Eulogio Gárate", "ATM", 1973) };
    expect(chemistryBreakdown(fm, five, leagueOf, null).slots[slot("CM", 0)].effective).toBe(2);
  });
  it("Roulette extended rules can add the +1 extra (documented difference between modes)", () => {
    const b = chemistryBreakdown(fm, lineup, leagueOf, null, true);
    const dj = b.slots[slot("CM", 0)];
    expect(dj.effective).toBe(1 + dj.extraPoints);
    expect(dj.extras.map((e) => e.kind)).toEqual(["language", "style", "continent"]);
  });
  it("out-of-position players get 0 but still count for teammates", () => {
    const oop = { ...lineup, [slot("GK")]: card("José Eulogio Gárate", "ATM", 1973) };
    const b = chemistryBreakdown(fm, oop, leagueOf, null);
    expect(b.slots[slot("GK")].effective).toBe(0);
    expect(b.slots[slot("GK")].outOfPosition).toBe(true);
    expect(b.slots[slot("CM", 0)].groups.find((g) => g.kind === "league")!.count).toBe(5);
  });
  it("individual cap is 3 and total equals the sum of effective values", () => {
    const b = chemistryBreakdown(fm, lineup, leagueOf, card("Sergio Ramos", "RMA", 2016).id, true);
    for (const s of Object.values(b.slots)) expect(s.effective).toBe(Math.min(3, s.raw));
    expect(b.total).toBe(Object.values(b.slots).reduce((a, s) => a + s.effective, 0));
  });
});
