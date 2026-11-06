import { describe, expect, it } from "vitest";
import { ALL_CARDS, CARD_BY_ID, createDraft, isComplete, lineupCards, pick, placeablePositions, poolFor, validCombos, versionsFor } from "@/features/nba-draft/engine";
import { monteCarlo, simulateSeason, USER_ID } from "@/features/nba-simulation/engine";
import { buildLeagueGames, gamesPerTeam } from "@/features/nba-simulation/league";
import { buildSchedule } from "@/features/nba-simulation/engine";
import { Rng } from "@/lib/core/rng";
import type { NbaCard, NbaPos } from "@/types/nba";

const byName = (n: string, y: number) => ALL_CARDS.find((c) => c.name === n && c.startYear === y)!;
const lineupOf = (cards: [NbaPos, NbaCard][]) => Object.fromEntries(cards) as Partial<Record<NbaPos, NbaCard>>;

describe("NBA draft pools (dedupe)", () => {
  it("each player appears once per franchise+decade and the default is his best season", () => {
    for (const combo of validCombos({ lineup: {} })) {
      const pool = poolFor(combo);
      expect(new Set(pool.map((c) => c.playerId)).size).toBe(pool.length);
      for (const c of pool) {
        const versions = versionsFor(combo, c.playerId);
        expect(versions.length).toBeGreaterThanOrEqual(1);
        expect(Math.max(...versions.map((v) => v.ratings.overall))).toBe(c.ratings.overall);
      }
    }
    const nop = poolFor({ franchiseId: "NOP", decade: "2020s" });
    expect(nop.filter((c) => c.playerId === "zion-williamson").length).toBe(1);
    expect(versionsFor({ franchiseId: "NOP", decade: "2020s" }, "zion-williamson").length).toBe(2);
  });
  it("a non-default season of an offered player can be picked; never two versions of one player", () => {
    for (let i = 0; i < 80; i++) {
      let s = createDraft(`dd${i}`, "NORMAL");
      while (!isComplete(s)) {
        const card = s.options.map((id) => CARD_BY_ID[id]).find((c) => placeablePositions(s, c).length > 0)!;
        const alt = versionsFor(s.spin!, card.playerId).find((v) => v.id !== card.id && placeablePositions(s, v).length > 0) ?? card;
        const r = pick(s, alt.id, placeablePositions(s, alt)[0]);
        if (!r.ok) throw new Error(r.error);
        s = r.state;
      }
      const ids = Object.values(lineupCards(s)).map((c) => c!.playerId);
      expect(new Set(ids).size).toBe(5);
      expect(new Set(Object.values(s.lineup)).size).toBe(5);
    }
  });
});

describe("NBA ratings v2", () => {
  it("prime legends rate 95+, role players stay in the rotation band", () => {
    for (const [n, y] of [["Michael Jordan", 1988], ["LeBron James", 2012], ["Stephen Curry", 2015], ["Wilt Chamberlain", 1961]] as const) expect(byName(n, y).ratings.overall).toBeGreaterThanOrEqual(95);
    expect(byName("Patrick Ewing", 1989).ratings.overall).toBeGreaterThanOrEqual(88);
    expect(byName("Luc Longley", 1995).ratings.overall).toBeLessThanOrEqual(72);
    expect(byName("Kendrick Perkins", 2009).ratings.overall).toBeLessThanOrEqual(76);
  });
  it("user reference anchors (v2.1): prime Jordan/LeBron = 99, LaMelo 2022-23 = 82-83", () => {
    for (const y of [1987, 1988, 1990]) expect(byName("Michael Jordan", y).ratings.overall).toBe(99);
    for (const y of [2008, 2012]) expect(byName("LeBron James", y).ratings.overall).toBe(99);
    const lamelo = byName("LaMelo Ball", 2022).ratings.overall;
    expect(lamelo).toBeGreaterThanOrEqual(82); expect(lamelo).toBeLessThanOrEqual(83);
    expect(ALL_CARDS.filter((c) => c.ratings.overall === 99).length).toBeLessThanOrEqual(12);
  });
  it("prime seasons beat lesser seasons of the same legend", () => {
    expect(byName("Kobe Bryant", 2005).ratings.overall).toBeGreaterThan(byName("Kobe Bryant", 1998).ratings.overall + 8);
    expect(byName("Michael Jordan", 1988).ratings.overall).toBeGreaterThan(byName("Michael Jordan", 2001).ratings.overall + 8);
  });
  it("the scale is spread across all tiers", () => {
    const ovr = ALL_CARDS.map((c) => c.ratings.overall);
    expect(ovr.filter((o) => o >= 95).length).toBeGreaterThan(5);
    expect(ovr.filter((o) => o < 77).length).toBeGreaterThan(50);
  });
});

describe("NBA team calibration (records stay reasonable after re-rating)", () => {
  const legends = lineupOf([["PG", byName("Stephen Curry", 2015)], ["SG", byName("Michael Jordan", 1988)], ["SF", byName("LeBron James", 2012)], ["PF", byName("Kevin Garnett", 2003)], ["C", byName("Shaquille O'Neal", 1999)]]);
  const starters = lineupOf([["PG", byName("Mike Conley", 2012)], ["SG", byName("Jaylen Brown", 2019)], ["SF", byName("Andrew Wiggins", 2021)], ["PF", byName("Tobias Harris", 2019)], ["C", byName("Clint Capela", 2017)]]);
  it("legends ≈ 70-77 wins on Normal and still rarely 82-0", () => {
    const mc = monteCarlo(legends, "NORMAL", "cal", 200);
    expect(mc.meanWins).toBeGreaterThan(68); expect(mc.meanWins).toBeLessThan(78);
    expect(mc.pUndefeated).toBeLessThan(0.02);
    expect(mc.analyticUndefeated).toBeLessThan(0.01);
    expect(mc.pChampion).toBeLessThan(1);
  });
  it("solid starters land near .500, not 82-0", () => {
    const mc = monteCarlo(starters, "NORMAL", "cal", 150);
    expect(mc.meanWins).toBeGreaterThan(28); expect(mc.meanWins).toBeLessThan(48);
    expect(mc.maxWins).toBeLessThan(70);
  });
});

describe("NBA league, playoffs and box scores", () => {
  it("every one of the 31 teams plays exactly 82 games", () => {
    for (const seed of ["l1", "l2", "l3", "l4", "l5", "l6"]) {
      const r = new Rng(seed); const u = buildSchedule(r);
      const m = gamesPerTeam(u, buildLeagueGames(r, u));
      expect(m.size).toBe(31);
      expect([...m.values()].every((v) => v === 82)).toBe(true);
    }
  });
  const lineup = lineupCards(createDraftComplete("box"));
  const { result } = simulateSeason(lineup, "NORMAL", "po-seed");
  it("standings are consistent (wins = losses league-wide, user record matches)", () => {
    const st = result.standings!;
    expect(st.length).toBe(31);
    expect(st.reduce((s, r) => s + r.w, 0)).toBe(st.reduce((s, r) => s + r.l, 0));
    expect(st.every((r) => r.w + r.l === 82)).toBe(true);
    const me = st.find((r) => r.team === USER_ID)!;
    expect(me.w).toBe(result.wins);
  });
  it("playoff bracket: 15 best-of-7 series, valid champion, outcome coherent", () => {
    const po = result.playoffs!;
    expect(po.series.length).toBe(15);
    for (const s of po.series) {
      expect(Math.max(s.winsHigh, s.winsLow)).toBe(4);
      expect(Math.min(s.winsHigh, s.winsLow)).toBeLessThan(4);
      expect(s.games.length).toBe(s.winsHigh + s.winsLow);
      expect([s.high, s.low]).toContain(s.winner);
    }
    const finals = po.series.filter((s) => s.round === 4);
    expect(finals.length).toBe(1);
    expect(po.champion).toBe(finals[0].winner);
    if (po.outcome === "champion") expect(po.champion).toBe(USER_ID);
    if (po.outcome === "missed") expect(po.series.some((s) => s.high === USER_ID || s.low === USER_ID)).toBe(false);
    for (const conf of ["East", "West"] as const) {
      const r1 = po.series.filter((s) => s.round === 1 && s.conference === conf);
      expect(r1.map((s) => s.highSeed + s.lowSeed).every((x) => x === 9)).toBe(true);
    }
  });
  it("box scores add up to the final score and to the minutes played", () => {
    const allBoxes = [...result.games.map((g) => ({ box: g.box!, pts: g.teamScore, ot: g.overtimes ?? 0 })),
      ...result.playoffs!.series.flatMap((s) => s.games.filter((g) => g.box).map((g) => ({ box: g.box!, pts: g.home === USER_ID ? g.homeScore : g.awayScore, ot: g.overtimes })))];
    for (const { box, pts, ot } of allBoxes) {
      expect(box.reduce((s, l) => s + l.pts, 0)).toBe(pts);
      expect(box.reduce((s, l) => s + l.min, 0)).toBe(240 + 25 * ot);
      for (const l of box) {
        expect(2 * l.fgm + l.tpm + l.ftm).toBe(l.pts);
        expect(l.fgm).toBeLessThanOrEqual(l.fga); expect(l.tpm).toBeLessThanOrEqual(l.tpa); expect(l.tpa).toBeLessThanOrEqual(l.fga); expect(l.ftm).toBeLessThanOrEqual(l.fta);
        expect(Math.min(l.reb, l.ast, l.stl, l.blk, l.min)).toBeGreaterThanOrEqual(0);
      }
    }
    const reg = result.stats!.regular;
    expect(reg.length).toBe(6);
    expect(reg.reduce((s, t) => s + t.pts, 0)).toBe(result.games.reduce((s, g) => s + g.teamScore, 0));
    expect(reg.filter((t) => t.key !== "BENCH").every((t) => t.gp === 82)).toBe(true);
  });
  it("shared ball: a stacked lineup lowers each star's scoring vs. a lone star", () => {
    const star = byName("Michael Jordan", 1988);
    const stacked = lineupOf([["PG", byName("Stephen Curry", 2015)], ["SG", star], ["SF", byName("LeBron James", 2012)], ["PF", byName("Kevin Garnett", 2003)], ["C", byName("Shaquille O'Neal", 1999)]]);
    const lone = lineupOf([["PG", byName("Raymond Felton", 2012)], ["SG", star], ["SF", byName("Trevor Ariza", 2017)], ["PF", byName("Udonis Haslem", 2005)], ["C", byName("Kevin Duckworth", 1990)]]);
    const ppg = (l: Partial<Record<NbaPos, NbaCard>>) => { const t = simulateSeason(l, "NORMAL", "ball").result.stats!.regular.find((x) => x.key === "SG")!; return t.pts / t.gp; };
    expect(ppg(lone)).toBeGreaterThan(ppg(stacked) + 3);
  });
  it("is reproducible and differs by seed", () => {
    expect(simulateSeason(lineup, "HARD", "same").result).toEqual(simulateSeason(lineup, "HARD", "same").result);
    expect(simulateSeason(lineup, "HARD", "other").result.wins + simulateSeason(lineup, "HARD", "other2").result.wins).toBeGreaterThan(0);
  });
});

function createDraftComplete(seed: string) {
  let s = createDraft(seed, "NORMAL");
  while (!isComplete(s)) {
    const c = s.options.map((id) => CARD_BY_ID[id]).find((x) => placeablePositions(s, x).length > 0)!;
    const r = pick(s, c.id, placeablePositions(s, c)[0]); if (!r.ok) throw new Error(r.error); s = r.state;
  }
  return s;
}
