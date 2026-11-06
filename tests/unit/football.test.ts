import { describe, expect, it } from "vitest";
import { FB_PLAYER_SEASONS } from "@/lib/data/football/players";
import { HIST_CLUB_BY_ID, leagueOf } from "@/lib/data/football/clubs";
import { FORMATIONS, FORMATION_BY_ID } from "@/lib/data/football/formations";
import { DRAFT_FIT_MIN, computeChemistry, posCompat, slotFit, teamRatings } from "@/lib/ratings/football";
import {
  FB_CARD_BY_ID, captainSlots, changeFormation, createFbDraft, isFbComplete, pickCaptain, pickFb, respinClub, respinEra, slotById, swapSlots,
} from "@/features/football-draft/engine";
import { createSeason, isSeasonDone, plTable, simulateRest, stepSeason, stepToNextUserMatch, summarize, uclTable } from "@/features/football-simulation/season";
import { roundRobin } from "@/features/football-simulation/league";
import { Rng } from "@/lib/core/rng";
import type { FbDraftState } from "@/types/football";

function autoDraft(seed: string, mode: "roulette" | "fut", formation = "4-3-3"): FbDraftState {
  let s = createFbDraft(seed, "NORMAL", mode, formation);
  if (mode === "fut") {
    const cap = s.options[0];
    const r = pickCaptain(s, cap, captainSlots(s, cap)[0]);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  let guard = 0;
  while (!isFbComplete(s) && guard++ < 20) {
    expect(s.options.length).toBeGreaterThan(0);
    const r = pickFb(s, s.options[0]);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}
function userInput(s: FbDraftState, clubId = "ARS", name = "Arsenal") {
  const fm = FORMATION_BY_ID[s.formationId];
  const lu = Object.fromEntries(Object.entries(s.lineup).map(([k, v]) => [k, FB_CARD_BY_ID[v]]));
  const chem = computeChemistry(fm, lu, leagueOf, s.captainId).total;
  const r = teamRatings(fm, lu, chem);
  return { clubId, name, rating: r.ovr, att: r.att, def: r.def };
}

describe("football dataset", () => {
  it("unique ids, known clubs, valid positions and estimated attributes", () => {
    const ids = new Set<string>();
    for (const p of FB_PLAYER_SEASONS) {
      expect(ids.has(p.id), p.id).toBe(false); ids.add(p.id);
      expect(HIST_CLUB_BY_ID[p.clubId], p.clubId).toBeTruthy();
      expect(p.attrsEstimated).toBe(true);
      if (p.positions[0] === "GK") { expect(p.gk).toBeTruthy(); expect(p.attrs).toBeNull(); }
      else { expect(p.attrs).toBeTruthy(); Object.values(p.attrs!).forEach((v) => { expect(v).toBeGreaterThanOrEqual(20); expect(v).toBeLessThanOrEqual(99); }); }
      expect(p.decade).toBe(`${Math.floor(p.startYear / 10) * 10}s`);
    }
    expect(FB_PLAYER_SEASONS.length).toBeGreaterThan(500);
  });
  it("same player has distinct season versions", () => {
    const cr = FB_PLAYER_SEASONS.filter((p) => p.playerId === "cristiano-ronaldo").map((p) => p.clubId);
    expect(new Set(cr)).toEqual(new Set(["MUN", "RMA", "JUV"]));
    const messi = FB_PLAYER_SEASONS.filter((p) => p.playerId === "lionel-messi");
    expect(messi.length).toBeGreaterThanOrEqual(4);
  });
  it("positional compatibility is symmetric-ish and GK is exclusive", () => {
    expect(posCompat("GK", "ST")).toBe(0);
    expect(posCompat("ST", "CF")).toBeGreaterThan(0.9);
    expect(posCompat("LW", "CB")).toBeLessThan(0.7);
  });
  it("all formations have 11 slots and exactly one GK", () => {
    for (const f of FORMATIONS) { expect(f.slots.length).toBe(11); expect(f.slots.filter((s) => s.pos === "GK").length).toBe(1); }
  });
});

describe("football draft", () => {
  it("roulette: every option belongs to the spun club+decade and fits the slot", () => {
    for (let i = 0; i < 40; i++) {
      let s = createFbDraft(`r${i}`, "NORMAL", "roulette", FORMATIONS[i % FORMATIONS.length].id);
      while (!isFbComplete(s)) {
        for (const id of s.options) {
          const c = FB_CARD_BY_ID[id];
          expect(c.clubId).toBe(s.spin!.clubId);
          expect(c.decade).toBe(s.spin!.decade);
          expect(slotFit(c, slotById(s, s.currentSlot!).pos)).toBeGreaterThanOrEqual(DRAFT_FIT_MIN);
        }
        expect(s.options.length).toBeLessThanOrEqual(5);
        const r = pickFb(s, s.options[0]); if (!r.ok) throw new Error(r.error); s = r.state;
      }
      const players = Object.values(s.lineup).map((id) => FB_CARD_BY_ID[id].playerId);
      expect(new Set(players).size).toBe(11);
    }
  });
  it("roulette re-spins only change their variable and are single-use", () => {
    let checked = 0;
    for (let i = 0; i < 30 && checked < 6; i++) {
      const s = createFbDraft(`rs${i}`, "NORMAL", "roulette", "4-4-2");
      const rc = respinClub(s);
      if (rc.ok) {
        expect(rc.state.spin!.decade).toBe(s.spin!.decade);
        expect(rc.state.spin!.clubId).not.toBe(s.spin!.clubId);
        expect(rc.state.currentSlot).toBe(s.currentSlot);
        expect(respinClub(rc.state).ok).toBe(false);
        checked++;
      }
      const re = respinEra(s);
      if (re.ok) {
        expect(re.state.spin!.clubId).toBe(s.spin!.clubId);
        expect(re.state.spin!.decade).not.toBe(s.spin!.decade);
        expect(re.state.currentSlot).toBe(s.currentSlot);
        expect(respinEra(re.state).ok).toBe(false);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
  it("FUT: captain + 10 picks, 5 cards per slot, no duplicate players, mixed quality", () => {
    const ovrs: number[] = [];
    for (let i = 0; i < 20; i++) {
      let s = createFbDraft(`f${i}`, "NORMAL", "fut", "4-2-3-1");
      expect(s.options.length).toBe(5);
      const cap = s.options[0];
      const r = pickCaptain(s, cap, captainSlots(s, cap)[0]); if (!r.ok) throw new Error(r.error); s = r.state;
      while (!isFbComplete(s)) {
        expect(s.options.length).toBe(5);
        expect(new Set(s.options.map((id) => FB_CARD_BY_ID[id].playerId)).size).toBe(5);
        ovrs.push(...s.options.map((id) => FB_CARD_BY_ID[id].ovr));
        const p = pickFb(s, s.options[2]); if (!p.ok) throw new Error(p.error); s = p.state;
      }
      expect(new Set(Object.values(s.lineup).map((id) => FB_CARD_BY_ID[id].playerId)).size).toBe(11);
    }
    const share95 = ovrs.filter((o) => o >= 95).length / ovrs.length;
    expect(share95).toBeLessThan(0.1);
    expect(Math.min(...ovrs)).toBeLessThan(80);
  });
  it("swap keeps GK in goal and formation change keeps the 11 players", () => {
    const s = autoDraft("swap", "roulette");
    expect(swapSlots(s, "GK1", "ST1").ok).toBe(false);
    const sw = swapSlots(s, "LW1", "RW1"); expect(sw.ok).toBe(true);
    const ch = changeFormation(s, "3-5-2"); expect(ch.ok).toBe(true);
    if (ch.ok) {
      expect(Object.keys(ch.state.lineup).length).toBe(11);
      expect(new Set(Object.values(ch.state.lineup))).toEqual(new Set(Object.values(s.lineup)));
      expect(FB_CARD_BY_ID[ch.state.lineup["GK1"]].positions[0]).toBe("GK");
    }
  });
  it("chemistry is within 0..33 and out-of-position players get 0", () => {
    const s = autoDraft("chem", "roulette");
    const fm = FORMATION_BY_ID[s.formationId];
    const lu = Object.fromEntries(Object.entries(s.lineup).map(([k, v]) => [k, FB_CARD_BY_ID[v]]));
    const c = computeChemistry(fm, lu, leagueOf, null);
    expect(c.total).toBeGreaterThanOrEqual(0); expect(c.total).toBeLessThanOrEqual(33);
    const swapped = swapSlots(s, "CB1", "ST1");
    if (swapped.ok) {
      const lu2 = Object.fromEntries(Object.entries(swapped.state.lineup).map(([k, v]) => [k, FB_CARD_BY_ID[v]]));
      const c2 = computeChemistry(fm, lu2, leagueOf, null);
      expect(c2.perSlot["ST1"]).toBe(0);
      const r1 = teamRatings(fm, lu, c.total), r2 = teamRatings(fm, lu2, c2.total);
      expect(r2.att).toBeLessThan(r1.att + 0.01);
    }
  });
});

describe("football season", () => {
  const draft = autoDraft("season", "roulette");
  const input = userInput(draft);

  it("round robin: 380 matches, 38 per team, every pair home and away", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `T${i}`);
    const f = roundRobin(ids, new Rng("rr"));
    expect(f.length).toBe(380);
    const pairs = new Set(f.map((m) => `${m.home}>${m.away}`));
    expect(pairs.size).toBe(380);
    for (const t of ids) {
      expect(f.filter((m) => m.home === t || m.away === t).length).toBe(38);
      expect(f.filter((m) => m.home === t).length).toBe(19);
    }
    for (let r = 1; r <= 38; r++) {
      const round = f.filter((m) => m.round === r);
      expect(round.length).toBe(10);
      expect(new Set(round.flatMap((m) => [m.home, m.away])).size).toBe(20);
    }
  });

  const seasons = ["s1", "s2", "s3", "s4", "s5"].map((seed) => simulateRest(createSeason(seed, "NORMAL", input)));

  it("Premier League table is mathematically consistent", () => {
    for (const s of seasons) {
      const pl = s.matches.filter((m) => m.comp === "PL");
      expect(pl.length).toBe(380);
      const t = plTable(s);
      expect(t.length).toBe(20);
      expect(new Set(t.map((r) => r.team)).size).toBe(20);
      for (const r of t) {
        expect(r.p).toBe(38);
        expect(r.w + r.d + r.l).toBe(38);
        expect(r.pts).toBe(r.w * 3 + r.d);
        expect(r.gd).toBe(r.gf - r.ga);
      }
      expect(t.reduce((a, r) => a + r.gf, 0)).toBe(t.reduce((a, r) => a + r.ga, 0));
      expect(t.reduce((a, r) => a + r.w, 0)).toBe(t.reduce((a, r) => a + r.l, 0));
      for (let i = 1; i < t.length; i++) expect(t[i - 1].pts).toBeGreaterThanOrEqual(t[i].pts);
      for (const m of s.matches) { expect(m.hg).toBeGreaterThanOrEqual(0); expect(m.ag).toBeGreaterThanOrEqual(0); expect(m.home).not.toBe(m.away); }
    }
  });

  it("no team plays twice on the same date", () => {
    for (const s of seasons) {
      const seen = new Set<string>();
      for (const m of s.matches) for (const id of [m.home, m.away]) {
        const k = `${id}@${m.date}`;
        expect(seen.has(k), k).toBe(false); seen.add(k);
      }
    }
  });

  it("Champions League: 36 teams, 8 games each (4H/4A), no compatriots, correct KO sizes", () => {
    for (const s of seasons) {
      expect(s.uclTeams.length).toBe(36);
      expect(s.uclTeams).toContain(s.userId);
      const lp = s.matches.filter((m) => m.comp === "UCL" && m.stage.startsWith("MD"));
      expect(lp.length).toBe(144);
      for (const id of s.uclTeams) {
        const games = lp.filter((m) => m.home === id || m.away === id);
        expect(games.length).toBe(8);
        expect(games.filter((m) => m.home === id).length).toBe(4);
        const opps = games.map((m) => (m.home === id ? m.away : m.home));
        expect(new Set(opps).size).toBe(8);
        for (const o of opps) expect(s.teams[o].country).not.toBe(s.teams[id].country);
        for (let pot = 0; pot < 4; pot++) expect(opps.filter((o) => s.uclPots[pot].includes(o)).length).toBe(2);
      }
      const table = uclTable(s);
      expect(table.length).toBe(36);
      const stage = (st: string) => s.ties.filter((t) => t.comp === "UCL" && t.stage === st);
      expect(stage("PO").length).toBe(8);
      expect(stage("R16").length).toBe(8);
      expect(stage("QF").length).toBe(4);
      expect(stage("SF").length).toBe(2);
      expect(stage("F").length).toBe(1);
      const top8 = table.slice(0, 8).map((r) => r.team);
      const po = new Set(stage("PO").flatMap((t) => [t.a, t.b]));
      expect([...po].every((id) => { const p = table.findIndex((r) => r.team === id) + 1; return p >= 9 && p <= 24; })).toBe(true);
      expect(stage("R16").every((t) => top8.includes(t.b))).toBe(true);
      for (const t of [...stage("PO"), ...stage("R16"), ...stage("QF"), ...stage("SF")]) { expect(t.legs.length).toBe(2); expect([t.a, t.b]).toContain(t.winner); }
    }
  });

  it("domestic cups have valid rounds, one champion each, and Carabao rules", () => {
    for (const s of seasons) {
      const fa = (st: string) => s.ties.filter((t) => t.comp === "FA" && t.stage === st).length;
      expect([fa("R3"), fa("R4"), fa("R5"), fa("QF"), fa("SF"), fa("F")]).toEqual([32, 16, 8, 4, 2, 1]);
      const efl = (st: string) => s.ties.filter((t) => t.comp === "EFL" && t.stage === st);
      expect([efl("R2").length, efl("R3").length, efl("R4").length, efl("QF").length, efl("SF").length, efl("F").length]).toEqual([23, 16, 8, 4, 2, 1]);
      // no extra time before the semi-finals in the Carabao Cup
      for (const t of [...efl("R2"), ...efl("R3"), ...efl("R4"), ...efl("QF")]) {
        const m = s.matches.find((x) => x.id === t.legs[0])!;
        expect(m.et ?? null).toBeNull();
      }
      expect(efl("SF").every((t) => t.twoLegged && t.legs.length === 2)).toBe(true);
      // FA semi-finals and final at a neutral venue
      for (const t of s.ties.filter((x) => x.comp === "FA" && (x.stage === "SF" || x.stage === "F"))) expect(s.matches.find((m) => m.id === t.legs[0])!.neutral).toBe(true);
      // a team eliminated cannot reappear later
      for (const comp of ["FA", "EFL"] as const) {
        const losers = new Set<string>();
        const order = comp === "FA" ? ["R3", "R4", "R5", "QF", "SF", "F"] : ["R2", "R3", "R4", "QF", "SF", "F"];
        for (const st of order) for (const t of s.ties.filter((x) => x.comp === comp && x.stage === st)) {
          expect(losers.has(t.a) || losers.has(t.b)).toBe(false);
          losers.add(t.winner === t.a ? t.b : t.a);
        }
      }
    }
  });

  it("summary has no contradictory trophies and matches tables", () => {
    for (const s of seasons) {
      expect(isSeasonDone(s)).toBe(true);
      const sum = summarize(s);
      expect(sum.trophies.length).toBe(4);
      const pl = sum.trophies[0];
      expect(pl.champion).toBe(plTable(s)[0].team);
      if (pl.status === "won") expect(plTable(s)[0].team).toBe(s.userId);
      for (const t of sum.trophies.slice(1)) {
        expect(t.champion).toBeTruthy();
        if (t.status === "won") expect(t.champion).toBe(s.userId);
        if (t.status !== "won") expect(t.champion).not.toBe(s.userId);
        expect(t.status).not.toBe("in-progress");
      }
      expect(sum.quadruple).toBe(sum.trophies.every((t) => t.status === "won"));
    }
  });

  it("seeds reproduce; live stepping equals quick sim", () => {
    const a = simulateRest(createSeason("rep", "HARD", input));
    const b = simulateRest(createSeason("rep", "HARD", input));
    expect(a.matches).toEqual(b.matches);
    let live = createSeason("rep", "HARD", input);
    live = stepToNextUserMatch(live);
    live = stepSeason(live).state;
    live = simulateRest(live);
    expect(live.matches).toEqual(a.matches);
    const c = simulateRest(createSeason("other", "HARD", input));
    expect(c.matches.map((m) => m.hg)).not.toEqual(a.matches.map((m) => m.hg));
  });

  it("Fantasy FC replaces a PL club (still 20) and enters the UCL", () => {
    const s = createSeason("fan", "NORMAL", { ...input, clubId: "FAN", name: "Fantasy FC", replacedClubId: "HUL" });
    expect(s.plTeams.length).toBe(20);
    expect(s.plTeams).toContain("FAN");
    expect(s.plTeams).not.toContain("HUL");
    expect(s.uclTeams).toContain("FAN");
    expect(s.uclTeams.length).toBe(36);
    expect(s.notes.length).toBeGreaterThan(0);
  });

  it("stronger teams earn more points on average; upsets exist", () => {
    const weak = { ...input, rating: 70, att: 70, def: 70 };
    const strong = { ...input, rating: 92, att: 94, def: 91 };
    let ws = 0, ss = 0, strongLosses = 0;
    for (let i = 0; i < 6; i++) {
      const a = simulateRest(createSeason(`mc${i}`, "NORMAL", weak));
      const b = simulateRest(createSeason(`mc${i}`, "NORMAL", strong));
      ws += plTable(a).find((r) => r.team === a.userId)!.pts;
      const rb = plTable(b).find((r) => r.team === b.userId)!;
      ss += rb.pts; strongLosses += rb.l;
    }
    expect(ss).toBeGreaterThan(ws + 6 * 25);
    expect(strongLosses).toBeGreaterThan(0);
  });
});
