/** Squad freezing + persisted snapshot of a football XI (history, reloads, "VER MI XI"). */
import type { Difficulty } from "@/lib/core/difficulty";
import { DIFFICULTY_PARAMS } from "@/lib/core/difficulty";
import { FORMATION_BY_ID } from "@/lib/data/football/formations";
import { HIST_CLUB_BY_ID, leagueOf } from "@/lib/data/football/clubs";
import { CLASSIC_CHEM, chemRulesFor, computeChemistry, slotFit, teamRatings, type ChemRules } from "@/lib/ratings/football";
import type { DraftMode, FbDraftState, FbPlayerSeason, SquadMember } from "@/types/football";
import { createFbDraft, FB_CARD_BY_ID } from "./engine";
import { createSeason, simulateRest, type SeasonState } from "@/features/football-simulation/season";
import type { UserTeamInput } from "@/features/football-simulation/season";
import { chooseTactic, type TacticId } from "@/features/football-simulation/tactics";

export function lineupOf(lineup: Record<string, string>): Record<string, FbPlayerSeason | undefined> {
  return Object.fromEntries(Object.entries(lineup).map(([k, v]) => [k, FB_CARD_BY_ID[v]]));
}

export function buildSquad(formationId: string, lineup: Record<string, string>, captainId: string | null, extended = false): SquadMember[] {
  const fm = FORMATION_BY_ID[formationId];
  const lc = lineupOf(lineup);
  const chem = computeChemistry(fm, lc, leagueOf, captainId, extended);
  return fm.slots.filter((s) => lc[s.id]).map((s) => {
    const c = lc[s.id]!;
    return { slotId: s.id, pos: s.pos, cardId: c.id, name: c.name, clubId: c.clubId, season: c.season, ovr: c.ovr, chem: chem.perSlot[s.id] ?? 0, fit: slotFit(c, s.pos), captain: c.id === captainId, attrs: c.attrs, gk: c.gk };
  });
}

/** The exact input the season engine (and Monte Carlo) receive for this XI. */
export function userTeamInput(formationId: string, lineup: Record<string, string>, captainId: string | null, difficulty: Difficulty, clubId: string, name: string, replacedClubId?: string, withSquad = true, rules: ChemRules = CLASSIC_CHEM, tactic: TacticId = "balanced"): UserTeamInput {
  const fm = FORMATION_BY_ID[formationId];
  const lc = lineupOf(lineup);
  const chem = computeChemistry(fm, lc, leagueOf, captainId, rules.extended);
  const r = teamRatings(fm, lc, chem.total, DIFFICULTY_PARAMS[difficulty].fbFitSensitivity, rules.weight);
  const squad = buildSquad(formationId, lineup, captainId, rules.extended);
  return { clubId, name, rating: r.ovr, att: r.att, def: r.def, replacedClubId, ...(withSquad ? { squad } : {}), ...(tactic !== "balanced" ? { tactic: chooseTactic(squad, tactic) } : {}) };
}

export interface FbSquadSnapshot {
  version: 1;
  seasonSeed: string; draftSeed: string; difficulty: Difficulty; mode: DraftMode;
  formationId: string; captainId: string | null; lineup: Record<string, string>; // slotId → stable card id
  clubId: string; clubName: string; replacedClubId?: string;
  /** Chemistry weight used for this season (absent in pre-0.4.1 saves → 1). */
  chemWeight?: number;
  /** 2 = Roulette extended chemistry (continente/idioma/estilo, 0.4.2+). Absent → classic rules. */
  chemVersion?: 2;
  /** V4: tactic used for the season (absent = Equilibrado) */
  tactic?: TacticId;
  chemistry: number; ovr: number; attack: number; midfield: number; defense: number;
  players: { slotId: string; pos: string; cardId: string; name: string; club: string; season: string; ovr: number; chem: number; captain: boolean }[];
  result?: { plPos: number; pts: number; trophies: string[] };
}

/** Chemistry rules a snapshot was played with (old saves → classic rules + their stored weight). */
export const snapshotRules = (s: Pick<FbSquadSnapshot, "mode" | "chemWeight" | "chemVersion">): ChemRules =>
  s.chemVersion === 2 ? chemRulesFor(s.mode, 2) : { extended: false, weight: s.chemWeight ?? 1, version: 1 };

export function buildFbSnapshot(d: FbDraftState, seasonSeed: string, clubId: string, clubName: string, replacedClubId?: string, result?: FbSquadSnapshot["result"], rules: ChemRules = chemRulesFor(d.mode), tactic: TacticId = "balanced"): FbSquadSnapshot {
  const fm = FORMATION_BY_ID[d.formationId];
  const lc = lineupOf(d.lineup);
  const chem = computeChemistry(fm, lc, leagueOf, d.captainId, rules.extended);
  const chemWeight = rules.weight;
  const r = teamRatings(fm, lc, chem.total, DIFFICULTY_PARAMS[d.difficulty].fbFitSensitivity, chemWeight);
  return {
    version: 1, seasonSeed, draftSeed: d.seed, difficulty: d.difficulty, mode: d.mode, formationId: d.formationId, captainId: d.captainId, lineup: { ...d.lineup },
    clubId, clubName, replacedClubId, chemWeight, ...(rules.version === 2 ? { chemVersion: 2 as const } : {}), ...(tactic !== "balanced" ? { tactic } : {}), chemistry: chem.total, ovr: r.ovr, attack: r.attack, midfield: r.midfield, defense: r.defense,
    players: buildSquad(d.formationId, d.lineup, d.captainId, rules.extended).map((m) => ({ slotId: m.slotId, pos: m.pos, cardId: m.cardId, name: m.name, club: HIST_CLUB_BY_ID[m.clubId]?.name ?? m.clubId, season: m.season, ovr: m.ovr, chem: m.chem, captain: m.captain })),
    result,
  };
}

/** A snapshot can rebuild the XI only if every stable card id still exists in the dataset. */
export function snapshotIsComplete(s: FbSquadSnapshot | undefined | null): boolean {
  return !!s && s.version === 1 && Object.keys(s.lineup).length === 11 && Object.values(s.lineup).every((id) => !!FB_CARD_BY_ID[id]) && !!FORMATION_BY_ID[s.formationId];
}

/** Rebuilds the frozen draft + the exact finished season from a history snapshot (deterministic: same seeds, same XI). */
export function rebuildFromSnapshot(s: FbSquadSnapshot): { draft: FbDraftState; season: SeasonState } | null {
  if (!snapshotIsComplete(s)) return null;
  const draft: FbDraftState = { ...createFbDraft(s.draftSeed, s.difficulty, s.mode, s.formationId), lineup: { ...s.lineup }, captainId: s.captainId, currentSlot: null, spin: null, filter: null, options: [], step: 11 };
  const season = simulateRest(createSeason(s.seasonSeed, s.difficulty, userTeamInput(s.formationId, s.lineup, s.captainId, s.difficulty, s.clubId, s.clubName, s.replacedClubId, true, snapshotRules(s), s.tactic ?? "balanced")));
  return { draft, season };
}
