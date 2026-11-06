/** Squad freezing + persisted snapshot of a football XI (history, reloads, "VER MI XI"). */
import type { Difficulty } from "@/lib/core/difficulty";
import { DIFFICULTY_PARAMS } from "@/lib/core/difficulty";
import { FORMATION_BY_ID } from "@/lib/data/football/formations";
import { HIST_CLUB_BY_ID, leagueOf } from "@/lib/data/football/clubs";
import { computeChemistry, slotFit, teamRatings } from "@/lib/ratings/football";
import type { DraftMode, FbDraftState, FbPlayerSeason, SquadMember } from "@/types/football";
import { FB_CARD_BY_ID } from "./engine";
import type { UserTeamInput } from "@/features/football-simulation/season";

export function lineupOf(lineup: Record<string, string>): Record<string, FbPlayerSeason | undefined> {
  return Object.fromEntries(Object.entries(lineup).map(([k, v]) => [k, FB_CARD_BY_ID[v]]));
}

export function buildSquad(formationId: string, lineup: Record<string, string>, captainId: string | null): SquadMember[] {
  const fm = FORMATION_BY_ID[formationId];
  const lc = lineupOf(lineup);
  const chem = computeChemistry(fm, lc, leagueOf, captainId);
  return fm.slots.filter((s) => lc[s.id]).map((s) => {
    const c = lc[s.id]!;
    return { slotId: s.id, pos: s.pos, cardId: c.id, name: c.name, clubId: c.clubId, season: c.season, ovr: c.ovr, chem: chem.perSlot[s.id] ?? 0, fit: slotFit(c, s.pos), captain: c.id === captainId, attrs: c.attrs, gk: c.gk };
  });
}

/** The exact input the season engine (and Monte Carlo) receive for this XI. */
export function userTeamInput(formationId: string, lineup: Record<string, string>, captainId: string | null, difficulty: Difficulty, clubId: string, name: string, replacedClubId?: string, withSquad = true): UserTeamInput {
  const fm = FORMATION_BY_ID[formationId];
  const lc = lineupOf(lineup);
  const chem = computeChemistry(fm, lc, leagueOf, captainId);
  const r = teamRatings(fm, lc, chem.total, DIFFICULTY_PARAMS[difficulty].fbFitSensitivity);
  return { clubId, name, rating: r.ovr, att: r.att, def: r.def, replacedClubId, ...(withSquad ? { squad: buildSquad(formationId, lineup, captainId) } : {}) };
}

export interface FbSquadSnapshot {
  version: 1;
  seasonSeed: string; draftSeed: string; difficulty: Difficulty; mode: DraftMode;
  formationId: string; captainId: string | null; lineup: Record<string, string>; // slotId → stable card id
  clubId: string; clubName: string; replacedClubId?: string;
  chemistry: number; ovr: number; attack: number; midfield: number; defense: number;
  players: { slotId: string; pos: string; cardId: string; name: string; club: string; season: string; ovr: number; chem: number; captain: boolean }[];
  result?: { plPos: number; pts: number; trophies: string[] };
}

export function buildFbSnapshot(d: FbDraftState, seasonSeed: string, clubId: string, clubName: string, replacedClubId?: string, result?: FbSquadSnapshot["result"]): FbSquadSnapshot {
  const fm = FORMATION_BY_ID[d.formationId];
  const lc = lineupOf(d.lineup);
  const chem = computeChemistry(fm, lc, leagueOf, d.captainId);
  const r = teamRatings(fm, lc, chem.total, DIFFICULTY_PARAMS[d.difficulty].fbFitSensitivity);
  return {
    version: 1, seasonSeed, draftSeed: d.seed, difficulty: d.difficulty, mode: d.mode, formationId: d.formationId, captainId: d.captainId, lineup: { ...d.lineup },
    clubId, clubName, replacedClubId, chemistry: chem.total, ovr: r.ovr, attack: r.attack, midfield: r.midfield, defense: r.defense,
    players: buildSquad(d.formationId, d.lineup, d.captainId).map((m) => ({ slotId: m.slotId, pos: m.pos, cardId: m.cardId, name: m.name, club: HIST_CLUB_BY_ID[m.clubId]?.name ?? m.clubId, season: m.season, ovr: m.ovr, chem: m.chem, captain: m.captain })),
    result,
  };
}

/** A snapshot can rebuild the XI only if every stable card id still exists in the dataset. */
export function snapshotIsComplete(s: FbSquadSnapshot | undefined | null): boolean {
  return !!s && s.version === 1 && Object.keys(s.lineup).length === 11 && Object.values(s.lineup).every((id) => !!FB_CARD_BY_ID[id]) && !!FORMATION_BY_ID[s.formationId];
}
