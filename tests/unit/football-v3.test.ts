import { describe, expect, it } from "vitest";
import { FB_CARD_BY_ID, captainSlots, createFbDraft, isFbComplete, pickCaptain, pickFb, slotById } from "@/features/football-draft/engine";
import { buildFbSnapshot, buildSquad, lineupOf, rebuildFromSnapshot, snapshotIsComplete, userTeamInput } from "@/features/football-draft/squad";
import { createSeason, plTable, simulateRest, stepSeason, stepToNextUserMatch } from "@/features/football-simulation/season";
import { aggregatePlayerStats, seasonRecords, teamAwards, userMatches } from "@/features/football-simulation/player-stats";
import { BENCH_KEY } from "@/features/football-simulation/events";
import { runSeed, simulateOne } from "@/features/football-simulation/monte-carlo";
import { FORMATION_BY_ID } from "@/lib/data/football/formations";
import { leagueOf } from "@/lib/data/football/clubs";
import { computeChemistry, previewFbPick } from "@/lib/ratings/football";
import type { FbDraftState } from "@/types/football";

function draft(seed: string, mode: "roulette" | "fut", formation = "4-3-3"): FbDraftState {
  let s = createFbDraft(seed, "NORMAL", mode, formation);
  if (mode === "fut") { const c = s.options[0]; const r = pickCaptain(s, c, captainSlots(s, c)[0]); if (!r.ok) throw new Error(r.error); s = r.state; }
  while (!isFbComplete(s)) { const r = pickFb(s, s.options[0]); if (!r.ok) throw new Error(r.error); s = r.state; }
  return s;
}
const goalsOf = (m: { home: string; hg: number; ag: number; et?: { hg: number; ag: number } | null }, user: string) =>
  m.home === user ? [m.hg + (m.et?.hg ?? 0), m.ag + (m.et?.ag ?? 0)] : [m.ag + (m.et?.ag ?? 0), m.hg + (m.et?.hg ?? 0)];

describe("football V3: squad, events and stats", () => {
  const d = draft("v3", "fut", "4-2-3-1");
  const input = userTeamInput(d.formationId, d.lineup, d.captainId, "NORMAL", "ARS", "Arsenal");
  const season = simulateRest(createSeason("v3-season", "NORMAL", input));

  it("the squad keeps the 11 drafted versions, positions and captain", () => {
    expect(season.squad!.length).toBe(11);
    expect(new Set(season.squad!.map((m) => m.cardId))).toEqual(new Set(Object.values(d.lineup)));
    expect(season.squad!.filter((m) => m.captain).length).toBe(1);
    for (const m of season.squad!) expect(m.pos).toBe(slotById(d, m.slotId).pos);
  });

  it("every user match has events whose goals add up to the score (no shoot-out kicks)", () => {
    const ms = userMatches(season);
    expect(ms.length).toBeGreaterThan(40);
    for (const m of ms) {
      const det = m.detail!; const [gf, ga] = goalsOf(m, season.userId);
      expect(det.goals.length).toBe(gf);
      expect(det.lines.reduce((a, l) => a + l.goals, 0)).toBe(gf);
      const assists = det.lines.reduce((a, l) => a + l.assists, 0);
      expect(assists).toBeLessThanOrEqual(det.goals.filter((g) => !g.penalty).length);
      for (const g of det.goals) {
        expect(g.assist).not.toBe(g.scorer === BENCH_KEY ? undefined : g.scorer);
        if (g.penalty) expect(g.assist).toBeNull();
        expect(g.extraTime ? g.minute > 90 : g.minute <= 90).toBe(true);
      }
      const T = m.et ? 120 : 90;
      const gk = det.lines.find((l) => season.squad!.find((s) => s.slotId === l.key)?.pos === "GK")!;
      expect(gk.min).toBe(T);
      expect(gk.conceded).toBe(ga);
      expect(gk.cleanSheet).toBe(ga === 0);
      expect(gk.saves).toBe(det.oppSot - ga);
      expect(det.sot).toBeGreaterThanOrEqual(gf); expect(det.shots).toBeGreaterThanOrEqual(det.sot);
      for (const l of det.lines) { expect(l.min).toBeGreaterThanOrEqual(0); expect(l.min).toBeLessThanOrEqual(l.key === BENCH_KEY ? 3 * T : T); expect(l.sot).toBeLessThanOrEqual(l.shots); expect(l.goals).toBeLessThanOrEqual(l.sot); expect(l.passesOk).toBeLessThanOrEqual(l.passes); }
      const starters = det.lines.filter((l) => l.key !== BENCH_KEY);
      const bench = det.lines.find((l) => l.key === BENCH_KEY)!;
      expect(starters.reduce((a, l) => a + l.min, 0) + bench.min).toBeLessThanOrEqual(11 * T);
    }
  });

  it("per-competition stats add up to the all-competitions total", () => {
    const all = aggregatePlayerStats(season, "ALL");
    const comps = (["PL", "UCL", "FA", "EFL"] as const).map((c) => aggregatePlayerStats(season, c));
    for (const row of all) for (const k of ["gp", "min", "goals", "assists", "shots", "cleanSheets", "saves"] as const) {
      expect(comps.reduce((a, rows) => a + rows.find((r) => r.key === row.key)![k], 0)).toBe(row[k]);
    }
    const teamGoals = userMatches(season).reduce((a, m) => a + goalsOf(m, season.userId)[0], 0);
    expect(all.reduce((a, r) => a + r.goals, 0)).toBe(teamGoals);
    expect(seasonRecords(season).goalsFor).toBe(teamGoals);
    const plRow = plTable(season).find((r) => r.team === season.userId)!;
    expect(aggregatePlayerStats(season, "PL").reduce((a, r) => a + r.goals, 0)).toBe(plRow.gf);
  });

  it("attackers score more than defenders on average, but not exclusively", () => {
    const rows = aggregatePlayerStats(season, "ALL");
    const st = rows.filter((r) => ["ST", "CF", "LW", "RW", "CAM"].includes(r.pos));
    const df = rows.filter((r) => ["CB", "LB", "RB"].includes(r.pos));
    expect(st.reduce((a, r) => a + r.goals, 0) / st.length).toBeGreaterThan(df.reduce((a, r) => a + r.goals, 0) / df.length);
    const scorers = rows.filter((r) => r.goals > 0).length;
    expect(scorers).toBeGreaterThan(3);
  });

  it("awards come from the simulated stats", () => {
    const rows = aggregatePlayerStats(season);
    const a = teamAwards(rows, userMatches(season).length);
    expect(a.topScorer!.goals).toBe(Math.max(...rows.filter((r) => r.key !== BENCH_KEY).map((r) => r.goals)));
    expect(a.bestGk!.pos).toBe("GK");
    expect(a.mvp).toBeTruthy();
  });

  it("Live season and Quick sim are identical (scores and events)", () => {
    let live = createSeason("v3-season", "NORMAL", input);
    live = stepToNextUserMatch(live); live = stepSeason(live).state; live = stepToNextUserMatch(live);
    live = simulateRest(live);
    expect(live.matches).toEqual(season.matches);
  });

  it("events do not change any score: same seed with/without squad", () => {
    const noSquad = simulateRest(createSeason("v3-season", "NORMAL", { ...input, squad: undefined }));
    expect(noSquad.matches.map((m) => [m.id, m.hg, m.ag, m.et, m.pens])).toEqual(season.matches.map((m) => [m.id, m.hg, m.ag, m.et, m.pens]));
  });

  it("Monte Carlo uses exactly the XI's ratings", () => {
    const mcInput = userTeamInput(d.formationId, d.lineup, d.captainId, "NORMAL", "ARS", "Arsenal", undefined, false);
    expect([mcInput.att, mcInput.def, mcInput.rating]).toEqual([input.att, input.def, input.rating]);
    const o = simulateOne(mcInput, "NORMAL", runSeed("x", 1));
    const s = simulateRest(createSeason(runSeed("x", 1), "NORMAL", input));
    expect(o.pts).toBe(plTable(s).find((r) => r.team === s.userId)!.pts);
  });

  it("snapshot keeps 11 stable ids and rebuilds the same season", () => {
    const snap = buildFbSnapshot(d, "v3-season", "ARS", "Arsenal");
    expect(snapshotIsComplete(snap)).toBe(true);
    expect(snap.players.length).toBe(11);
    const rebuilt = simulateRest(createSeason(snap.seasonSeed, snap.difficulty, userTeamInput(snap.formationId, snap.lineup, snap.captainId, snap.difficulty, snap.clubId, snap.clubName)));
    expect(rebuilt.matches).toEqual(season.matches);
    const viaHelper = rebuildFromSnapshot(snap)!;
    expect(viaHelper.season.matches).toEqual(season.matches);
    expect(viaHelper.draft.lineup).toEqual(d.lineup);
    expect(isFbComplete(viaHelper.draft)).toBe(true);
    // an old save serialized through JSON still rebuilds
    expect(rebuildFromSnapshot(JSON.parse(JSON.stringify(snap)))!.season.matches).toEqual(season.matches);
    expect(snapshotIsComplete(undefined)).toBe(false);
    expect(snapshotIsComplete({ ...snap, lineup: { ...snap.lineup, ST1: "no-such-card" } })).toBe(false);
  });
});

describe("football chemistry preview", () => {
  it("previewed chemistry equals the final chemistry after picking, in both modes", () => {
    for (const mode of ["roulette", "fut"] as const) for (let i = 0; i < 12; i++) {
      let s = createFbDraft(`cp${mode}${i}`, "NORMAL", mode, "4-4-2");
      if (mode === "fut") { const c = s.options[1]; const r = pickCaptain(s, c, captainSlots(s, c)[0]); if (!r.ok) throw new Error(r.error); s = r.state; }
      const fm = FORMATION_BY_ID[s.formationId];
      while (!isFbComplete(s)) {
        const card = FB_CARD_BY_ID[s.options[s.options.length - 1]];
        const p = previewFbPick(fm, lineupOf(s.lineup), s.currentSlot!, card, leagueOf, s.captainId);
        const r = pickFb(s, card.id); if (!r.ok) throw new Error(r.error); s = r.state;
        const actual = computeChemistry(fm, lineupOf(s.lineup), leagueOf, s.captainId).total;
        expect(p.after).toBe(actual);
        expect(p.delta).toBe(p.after - p.before);
      }
      expect(buildSquad(s.formationId, s.lineup, s.captainId).reduce((a, m) => a + m.chem, 0)).toBe(computeChemistry(fm, lineupOf(s.lineup), leagueOf, s.captainId).total);
    }
  });
});
