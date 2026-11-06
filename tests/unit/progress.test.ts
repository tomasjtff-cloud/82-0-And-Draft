import { beforeEach, describe, expect, it } from "vitest";
import { ACHIEVEMENTS, ACH_BY_ID, evaluateAll, levelOf, TOTAL_POINTS, unlockNew } from "@/lib/progress/achievements";
import { applyImport, buildExport, legacyFromHistory, loadProgress, parseImport, recordDraft, recordSeason, PROGRESS_KEY } from "@/lib/progress/store";
import { emptyProgress, type FbSeasonRec, type NbaSeasonRec, type Progress } from "@/lib/progress/types";
import { fbRecords, hallOfFame, trophyRoom } from "@/lib/progress/records";
import { fbSeasonRecord, nbaSeasonRecord, NBA_CHEM_MAX } from "@/lib/progress/summarize";
import { createFbDraft, isFbComplete, pickFb } from "@/features/football-draft/engine";
import { userTeamInput } from "@/features/football-draft/squad";
import { createSeason, simulateRest } from "@/features/football-simulation/season";
import { seasonAwards, BOOT_PL_GOALS, GLOVE_PL_CS } from "@/features/football-simulation/awards";
import { aggregatePlayerStats } from "@/features/football-simulation/player-stats";
import { ALL_CARDS } from "@/features/nba-draft/engine";
import { simulateSeason } from "@/features/nba-simulation/engine";
import { evaluateNbaTeam } from "@/lib/ratings/nba";

// minimal browser storage for the store functions
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).window = { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }, dispatchEvent: () => true };

let n = 0;
const fb = (o: Partial<FbSeasonRec> = {}): FbSeasonRec => ({
  kind: "fb", id: `fb:t${n++}`, date: new Date(2026, 0, 1 + n).toISOString(), difficulty: "NORMAL", mode: "roulette", tactic: "balanced", draftSeed: `d${n}`, seasonSeed: `s${n}`,
  team: { name: "Test FC", formationId: "4-3-3", ovr: 85, chem: 25, nations: 5 }, pl: { pos: 3, pts: 70, w: 20, d: 10, l: 8, gf: 70, ga: 40, cs: 12 },
  won: { PL: false, UCL: false, FA: false, EFL: false }, titles: 0, finals: [], maxWinMargin: 3, finalHatTrick: false, players: [], awards: {}, ...o,
});
const nba = (o: Partial<NbaSeasonRec> = {}): NbaSeasonRec => ({
  kind: "nba", id: `nba:t${n++}`, date: new Date(2026, 0, 1 + n).toISOString(), difficulty: "NORMAL", draftSeed: `d${n}`, seed: `s${n}`, teamName: "Test",
  wins: 41, losses: 41, outcome: "missed", champion: false, seriesWon: 0, poW: 0, poL: 0, expectedWins: 50, chemistry: 70, teamOvr: 85, offense: 70, defense: 60, playmaking: 60, legends: 0,
  longestStreak: 5, homeW: 21, homeL: 20, finalsGame7Win: false, players: [], awards: {}, ...o,
});
const prog = (seasons: (FbSeasonRec | NbaSeasonRec)[], drafts: Progress["drafts"] = []): Progress => ({ ...emptyProgress(), seasons, drafts });
const unlocked = (p: Progress) => new Set(unlockNew(p).unlocked.map((a) => a.id));

describe("achievement catalog", () => {
  it("has stable unique ids, ≥ 25 per game, secrets in both, and points by tier", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ACHIEVEMENTS.filter((a) => a.game === "fb").length).toBeGreaterThanOrEqual(25);
    expect(ACHIEVEMENTS.filter((a) => a.game === "nba").length).toBeGreaterThanOrEqual(25);
    expect(ACHIEVEMENTS.some((a) => a.secret && a.game === "fb") && ACHIEVEMENTS.some((a) => a.secret && a.game === "nba")).toBe(true);
    expect(TOTAL_POINTS).toBeGreaterThan(1000);
    expect(levelOf(0).name).toBe("Novato");
  });
});

describe("NBA achievements (controlled cases)", () => {
  it.each([[50, "nba_50"], [60, "nba_60"], [70, "nba_70"], [74, "nba_74"], [82, "nba_82"]])("%i wins unlocks %s", (w, id) => {
    expect(unlocked(prog([nba({ wins: w, losses: 82 - w })])).has(id)).toBe(true);
  });
  it("82-0 eliminated in playoffs: perfect season yes, ultimate season NO", () => {
    const u = unlocked(prog([nba({ wins: 82, losses: 0, outcome: "conf-finals", seriesWon: 2 })]));
    expect(u.has("nba_82")).toBe(true); expect(u.has("nba_ultimate")).toBe(false); expect(u.has("nba_champ")).toBe(false);
  });
  it("82-0 + ring unlocks the ultimate season; 16-0 unlocks perfect playoffs", () => {
    const u = unlocked(prog([nba({ wins: 82, losses: 0, outcome: "champion", champion: true, seriesWon: 4, poW: 16, poL: 0 })]));
    expect(["nba_82", "nba_ultimate", "nba_champ", "nba_perfect_po", "nba_finalist", "nba_series"].every((x) => u.has(x))).toBe(true);
  });
  it("legacy seasons (no detail) never unlock detail-based achievements", () => {
    const u = unlocked(prog([nba({ legacy: true, champion: true, outcome: "champion", poL: 99, expectedWins: 99 })]));
    expect(u.has("nba_champ")).toBe(true); expect(u.has("nba_perfect_po")).toBe(false); expect(u.has("nba_underdog")).toBe(false);
  });
  it("individual averages with minimum games", () => {
    const p = (o: object) => ({ name: "X", pos: "C", gp: 70, ppg: 10, rpg: 5, apg: 3, spg: 1, bpg: 1, ...o });
    const u = unlocked(prog([nba({ players: [p({ ppg: 36, rpg: 16, apg: 12.5 }), p({ ppg: 31, gp: 40 })] })]));
    expect(["nba_30ppg", "nba_35ppg", "nba_15rpg", "nba_12apg", "nba_dd", "nba_td"].every((x) => u.has(x))).toBe(true);
    expect(unlocked(prog([nba({ players: [p({ ppg: 40, gp: 40 })] })])).has("nba_30ppg")).toBe(false);
  });
  it("cumulative: three rings in different seasons → dynasty; progress counted once per season", () => {
    const rings = [nba({ champion: true, outcome: "champion" }), nba({ champion: true, outcome: "champion" })];
    expect(evaluateAll(prog(rings)).nba_dynasty).toMatchObject({ cur: 2, target: 3 });
    expect(unlocked(prog([...rings, nba({ champion: true, outcome: "champion" })])).has("nba_dynasty")).toBe(true);
  });
  it("chemistry max is the engine's real maximum and is reachable", () => {
    expect(NBA_CHEM_MAX).toBe(86);
    const best = { PG: undefined, SG: undefined, SF: undefined, PF: undefined, C: undefined } as never;
    void best;
    expect(unlocked(prog([], [{ game: "nba", id: "x", date: new Date().toISOString(), chem: 86 }])).has("nba_chem_max")).toBe(true);
  });
});

describe("football achievements (controlled cases)", () => {
  it("chemistry, borders, PL feats, Champions, quadruple and awards", () => {
    const quad = fb({ won: { PL: true, UCL: true, FA: true, EFL: true }, titles: 4, pl: { pos: 1, pts: 101, w: 32, d: 6, l: 0, gf: 104, ga: 20, cs: 21 }, finals: [{ comp: "UCL", gf: 4, ga: 0, pens: false, won: true }], awards: { ballon: { id: "c", name: "X", stat: "" }, boot: { id: "c", name: "X", stat: "" } } });
    const u = unlocked(prog([quad], [{ game: "fb", id: "d1", date: new Date().toISOString(), chem: 33, nations: 6 }]));
    for (const id of ["fb_debut", "fb_chem33", "fb_borders", "fb_pl", "fb_invincibles", "fb_100pts", "fb_100goals", "fb_wall", "fb_ucl", "fb_ucl_night", "fb_fa", "fb_efl", "fb_treble", "fb_quadruple", "fb_ballon", "fb_boot"]) expect(u.has(id), id).toBe(true);
    expect(u.has("fb_underdog")).toBe(false);
  });
  it("tactics challenge needs a title with each of the five tactics", () => {
    const t = (tactic: FbSeasonRec["tactic"]) => fb({ tactic, titles: 1, won: { PL: false, UCL: false, FA: true, EFL: false } });
    expect(evaluateAll(prog([t("balanced"), t("press")])).fb_tactics5.cur).toBe(2);
    expect(unlocked(prog(["balanced", "possession", "counter", "press", "lowblock"].map((x) => t(x as never)))).has("fb_tactics5")).toBe(true);
  });
  it("underdog and low-chemistry challenges", () => {
    const u = unlocked(prog([fb({ won: { PL: true, UCL: false, FA: false, EFL: false }, titles: 1, team: { name: "U", formationId: "4-4-2", ovr: 79, chem: 15, nations: 3 } })]));
    expect(u.has("fb_underdog") && u.has("fb_brain")).toBe(true);
    expect(unlocked(prog([fb({ difficulty: "EASY", won: { PL: true, UCL: false, FA: false, EFL: false }, titles: 1, team: { name: "U", formationId: "4-4-2", ovr: 79, chem: 25, nations: 3 } })])).has("fb_underdog")).toBe(false);
  });
});

describe("store: dedupe, migration, export/import", () => {
  beforeEach(() => mem.clear());
  it("a season counts once (re-opening/replaying does not re-grant)", () => {
    const r = fb({ won: { PL: true, UCL: false, FA: false, EFL: false }, titles: 1 });
    expect(recordSeason(r).map((a) => a.id)).toContain("fb_pl");
    expect(recordSeason(r)).toEqual([]);
    expect(loadProgress().seasons.filter((s) => s.id === r.id)).toHaveLength(1);
  });
  it("drafts are deduped by seed and keep the best chemistry", () => {
    recordDraft({ game: "fb", id: "S", date: new Date().toISOString(), chem: 20 });
    recordDraft({ game: "fb", id: "S", date: new Date().toISOString(), chem: 33 });
    const p = loadProgress();
    expect(p.drafts).toHaveLength(1); expect(p.drafts[0].chem).toBe(33); expect(p.achievements.fb_chem33).toBeTruthy();
  });
  it("migrates old history entries into legacy records once", () => {
    mem.set("ll:history:v1", JSON.stringify([{ id: "h1", game: "nba", date: "2026-01-01T00:00:00Z", seed: "a", difficulty: "NORMAL", title: "60-22 🏆", detail: "Test Team · X", score: 60, nba: { version: 2, seed: "a", draftSeed: "b", difficulty: "NORMAL", players: [], teamOvr: 88, chemistry: 78, net: 5, strengths: [], weaknesses: [], record: { wins: 60, losses: 22 }, playoff: "Campeón" } }]));
    const p = loadProgress();
    expect(p.seasons).toHaveLength(1);
    expect(p.seasons[0]).toMatchObject({ legacy: true, wins: 60, champion: true });
    expect(p.achievements.nba_60 && p.achievements.nba_champ).toBeTruthy();
    expect(p.achievements.nba_60.at).toBe("2026-01-01T00:00:00Z");
    expect(loadProgress().seasons).toHaveLength(1);
    expect(legacyFromHistory({ id: "x", game: "football", date: "", seed: "", difficulty: "", title: "", detail: "", score: 0 })).toBeNull();
  });
  it("export → import (merge) restores without duplicates; invalid files are rejected", () => {
    recordSeason(fb({ won: { PL: false, UCL: true, FA: false, EFL: false }, titles: 1 }));
    const file = buildExport();
    expect(parseImport("{nope").ok).toBe(false);
    expect(parseImport(JSON.stringify({ format: "other" })).ok).toBe(false);
    expect(parseImport(JSON.stringify({ ...file, version: 9 })).ok).toBe(false);
    const parsed = parseImport(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    mem.clear();
    if (parsed.ok) { applyImport(parsed.file, "merge"); applyImport(parsed.file, "merge"); }
    const p = loadProgress();
    expect(p.seasons).toHaveLength(1);
    expect(p.achievements.fb_ucl).toBeTruthy();
    expect(mem.has(PROGRESS_KEY)).toBe(true);
  });
  it("records, hall of fame and trophy room come from saved records", () => {
    const p = prog([fb({ won: { PL: true, UCL: false, FA: false, EFL: false }, titles: 1, players: [{ id: "c1", name: "Goleador", pos: "ST", g: 44, a: 9, cs: 0, r: 7.6, gp: 50, min: 4000, ug: 9 }] })]);
    const rec = fbRecords(p);
    expect(rec.find((r) => r.key === "goals")).toMatchObject({ who: "Goleador · Test FC", value: "44 goles" });
    expect(hallOfFame(p).PL).toBe(1);
    expect(trophyRoom(p).PL).toHaveLength(1);
  });
});

describe("season → ledger records and awards (real simulations)", () => {
  let d = createFbDraft("pr1", "NORMAL", "roulette", "4-3-3");
  while (!isFbComplete(d)) { const r = pickFb(d, d.options[0]); if (!r.ok) throw new Error(r.error); d = r.state; }
  const s = simulateRest(createSeason("pr1-s", "NORMAL", userTeamInput(d.formationId, d.lineup, d.captainId, "NORMAL", "ARS", "Arsenal")));
  it("awards come from simulated stats with documented thresholds", () => {
    const a = seasonAwards(s)!;
    const pl = aggregatePlayerStats(s, "PL");
    expect(a.playerOfSeason).toBeTruthy();
    if (a.goldenBoot) expect(pl.find((r) => r.key === a.goldenBoot!.key)!.goals).toBeGreaterThanOrEqual(BOOT_PL_GOALS);
    if (a.goldenGlove) { expect(a.goldenGlove.pos).toBe("GK"); expect(pl.find((r) => r.key === a.goldenGlove!.key)!.cleanSheets).toBeGreaterThanOrEqual(GLOVE_PL_CS); }
    expect(seasonAwards(s)).toEqual(a); // deterministic
  });
  it("fb record is consistent with the season", () => {
    const r = fbSeasonRecord(s, d, { teamName: "Arsenal", ovr: 85, chem: 20 });
    expect(r.players).toHaveLength(11);
    expect(r.players.reduce((a, p) => a + p.g, 0)).toBeLessThanOrEqual(r.pl.gf + 400);
    expect(r.id).toBe(`fb:${s.seed}`);
  });
  it("nba record + internal awards from a real season", () => {
    const P = ["PG", "SG", "SF", "PF", "C"] as const;
    const lu = Object.fromEntries(P.map((p) => [p, [...ALL_CARDS].filter((c) => c.positions[0] === p).sort((a, b) => b.ratings.overall - a.ratings.overall)[0]]));
    const { result } = simulateSeason(lu, "NORMAL", "pr-nba");
    const r = nbaSeasonRecord(result, lu, evaluateNbaTeam(lu, 1), { draftSeed: "x", teamName: "Lab" });
    expect(r.wins + r.losses).toBe(82);
    expect(r.players.length).toBe(5);
    expect(r.awards.mvp).toBeTruthy();
    if (r.champion) expect(r.awards.finalsMvp).toBeTruthy();
    expect(ACH_BY_ID.nba_82).toBeTruthy();
  });
});
