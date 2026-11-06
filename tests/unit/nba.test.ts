import { describe, expect, it } from "vitest";
import {
  ALL_CARDS, CARD_BY_ID, createDraft, isComplete, lineupCards, pick, placeablePositions,
  respinEra, respinTeam, validCombos, poolFor,
} from "@/features/nba-draft/engine";
import { buildSchedule, monteCarlo, simulateSeason } from "@/features/nba-simulation/engine";
import { NBA_PLAYER_SEASONS } from "@/lib/data/nba/players";
import { FRANCHISE_BY_ID, teamNameFor } from "@/lib/data/nba/franchises";
import { Rng } from "@/lib/core/rng";
import type { NbaDraftState, NbaPos } from "@/types/nba";

function autoDraft(seed: string): NbaDraftState {
  let s = createDraft(seed, "NORMAL");
  while (!isComplete(s)) {
    const best = s.options.map((id) => CARD_BY_ID[id]).find((c) => placeablePositions(s, c).length > 0)!;
    expect(best, "every spin must offer a placeable card").toBeTruthy();
    const r = pick(s, best.id, placeablePositions(s, best)[0]);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

describe("NBA dataset integrity", () => {
  it("has unique ids and valid franchises/positions", () => {
    const ids = new Set<string>();
    for (const p of NBA_PLAYER_SEASONS) {
      expect(ids.has(p.id), `duplicate ${p.id}`).toBe(false);
      ids.add(p.id);
      expect(FRANCHISE_BY_ID[p.franchiseId]).toBeTruthy();
      expect(p.positions.length).toBeGreaterThan(0);
      p.positions.forEach((x) => expect(["PG", "SG", "SF", "PF", "C"]).toContain(x));
      expect(p.ppg).toBeGreaterThan(0);
      if (p.startYear < 1973) { expect(p.spg).toBeNull(); expect(p.bpg).toBeNull(); }
      if (p.startYear < 1979) { expect(p.tpPct).toBeNull(); }
      if (p.fgPct != null) expect(p.fgPct).toBeLessThan(0.8);
      expect(p.decade).toBe(`${Math.floor(p.startYear / 10) * 10}s`);
    }
    expect(NBA_PLAYER_SEASONS.length).toBeGreaterThan(300);
  });
  it("resolves historical franchise names", () => {
    expect(teamNameFor("OKC", 1995)).toBe("Seattle SuperSonics");
    expect(teamNameFor("OKC", 2013)).toBe("Oklahoma City Thunder");
    expect(teamNameFor("SAC", 1961)).toBe("Cincinnati Royals");
    expect(teamNameFor("GSW", 1963)).toBe("San Francisco Warriors");
    expect(teamNameFor("BKN", 2002)).toBe("New Jersey Nets");
  });
  it("same player gets different ratings for different seasons", () => {
    const lebron = ALL_CARDS.filter((c) => c.playerId === "lebron-james");
    expect(lebron.length).toBeGreaterThanOrEqual(4);
    expect(new Set(lebron.map((c) => c.ratings.overall)).size).toBeGreaterThan(1);
  });
  it("ratings are within 55..99", () => {
    for (const c of ALL_CARDS) { expect(c.ratings.overall).toBeGreaterThanOrEqual(55); expect(c.ratings.overall).toBeLessThanOrEqual(99); }
  });
});

describe("NBA draft engine", () => {
  it("spins only valid combos and all pool cards belong to the franchise+decade", () => {
    const s = createDraft("seed-1", "NORMAL");
    expect(s.spin).toBeTruthy();
    for (const id of s.options) {
      const c = CARD_BY_ID[id];
      expect(c.franchiseId).toBe(s.spin!.franchiseId);
      expect(c.decade).toBe(s.spin!.decade);
    }
  });
  it("is deterministic for the same seed", () => {
    expect(createDraft("abc", "NORMAL").spin).toEqual(createDraft("abc", "NORMAL").spin);
  });
  it("team re-spin changes only the franchise and is consumed once", () => {
    const s = createDraft("respin", "NORMAL");
    const r = respinTeam(s);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.spin!.decade).toBe(s.spin!.decade);
    expect(r.state.spin!.franchiseId).not.toBe(s.spin!.franchiseId);
    expect(r.state.respins.team).toBe(0);
    expect(r.state.respins.era).toBe(1);
    expect(respinTeam(r.state).ok).toBe(false);
  });
  it("era re-spin changes only the decade", () => {
    for (const seed of ["e1", "e2", "e3", "e4", "e5"]) {
      const s = createDraft(seed, "NORMAL");
      const r = respinEra(s);
      if (!r.ok) { expect(r.error).toBeTruthy(); expect(s.respins.era).toBe(1); continue; }
      expect(r.state.spin!.franchiseId).toBe(s.spin!.franchiseId);
      expect(r.state.spin!.decade).not.toBe(s.spin!.decade);
      expect(r.state.respins.era).toBe(0);
    }
  });
  it("rejects duplicates, occupied and invalid positions", () => {
    let s = createDraft("dup", "NORMAL");
    const c = CARD_BY_ID[s.options[0]];
    const bad = (["PG", "SG", "SF", "PF", "C"] as NbaPos[]).find((p) => !c.positions.includes(p))!;
    expect(pick(s, c.id, bad).ok).toBe(false);
    const r = pick(s, c.id, c.positions[0]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.state;
    // same player, any version, can no longer be placed
    const other = ALL_CARDS.find((x) => x.playerId === c.playerId && x.id !== c.id);
    if (other) expect(placeablePositions(s, other)).toEqual([]);
    expect(pick(s, "not-a-card", "PG").ok).toBe(false);
  });
  it("200 seeded auto-drafts always complete five unique players", () => {
    for (let i = 0; i < 200; i++) {
      const s = autoDraft(`auto-${i}`);
      const cards = Object.values(lineupCards(s));
      expect(cards.length).toBe(5);
      expect(new Set(cards.map((c) => c!.playerId)).size).toBe(5);
      for (const h of s.history) {
        const card = CARD_BY_ID[h.pickedId];
        expect(card.franchiseId).toBe(h.spin.franchiseId);
        expect(card.decade).toBe(h.spin.decade);
        expect(card.positions).toContain(h.pos);
      }
    }
  });
  it("valid combos always have a placeable card", () => {
    const s = createDraft("vc", "NORMAL");
    for (const combo of validCombos(s)) expect(poolFor(combo).some((c) => placeablePositions(s, c).length > 0)).toBe(true);
  });
});

describe("NBA season simulation", () => {
  const s = autoDraft("season");
  const lineup = lineupCards(s);
  it("schedule has 82 games, 41 home, every franchise faced", () => {
    const sched = buildSchedule(new Rng("x"));
    expect(sched.length).toBe(82);
    expect(sched.filter((g) => g.home).length).toBe(41);
    expect(new Set(sched.map((g) => g.opponent)).size).toBe(30);
  });
  it("wins + losses = 82, no ties, valid scores", () => {
    for (const d of ["EASY", "NORMAL", "HARD"] as const) {
      const { result } = simulateSeason(lineup, d, "seed");
      expect(result.wins + result.losses).toBe(82);
      for (const g of result.games) {
        expect(g.teamScore).not.toBe(g.oppScore);
        expect(g.teamScore).toBeGreaterThan(50);
        expect(g.oppScore).toBeGreaterThan(50);
        expect(g.winProb).toBeGreaterThanOrEqual(0);
        expect(g.winProb).toBeLessThanOrEqual(1);
        expect(g.win).toBe(g.teamScore > g.oppScore);
      }
    }
  });
  it("is reproducible with the same seed and differs with another", () => {
    const a = simulateSeason(lineup, "NORMAL", "same").result;
    const b = simulateSeason(lineup, "NORMAL", "same").result;
    expect(a).toEqual(b);
    const c = simulateSeason(lineup, "NORMAL", "other").result;
    expect(c.games.map((g) => g.teamScore)).not.toEqual(a.games.map((g) => g.teamScore));
  });
  it("stronger lineups win more on average and difficulty matters (Monte Carlo)", () => {
    const top = [...ALL_CARDS].sort((x, y) => y.ratings.overall - x.ratings.overall);
    const pickPos = (pos: NbaPos, used: Set<string>) => { const c = top.find((x) => x.positions[0] === pos && !used.has(x.playerId))!; used.add(c.playerId); return c; };
    const used = new Set<string>();
    const strong = Object.fromEntries((["PG", "SG", "SF", "PF", "C"] as NbaPos[]).map((p) => [p, pickPos(p, used)]));
    const bottom = [...ALL_CARDS].sort((x, y) => x.ratings.overall - y.ratings.overall);
    const used2 = new Set<string>();
    const weak = Object.fromEntries((["PG", "SG", "SF", "PF", "C"] as NbaPos[]).map((p) => { const c = bottom.find((x) => x.positions[0] === p && !used2.has(x.playerId))!; used2.add(c.playerId); return [p, c]; }));
    const mS = monteCarlo(strong, "NORMAL", "mc", 200);
    const mW = monteCarlo(weak, "NORMAL", "mc", 200);
    expect(mS.meanWins).toBeGreaterThan(mW.meanWins + 30);
    expect(mS.maxWins).toBeLessThanOrEqual(82);
    expect(mS.minWins).toBeLessThan(82); // never guaranteed
    const easy = monteCarlo(strong, "EASY", "mc", 200).meanWins;
    const hard = monteCarlo(strong, "HARD", "mc", 200).meanWins;
    expect(easy).toBeGreaterThan(hard);
    expect(mS.distribution.reduce((a, b) => a + b, 0)).toBe(200);
  });
});
