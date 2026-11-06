import type { Difficulty } from "@/lib/core/difficulty";
import { DIFFICULTY_PARAMS } from "@/lib/core/difficulty";
import { evaluateNbaTeam } from "@/lib/ratings/nba";
import type { NbaCard, NbaPos, NbaTeamSnapshot } from "@/types/nba";
import { NBA_POSITIONS } from "@/types/nba";

export function buildSnapshot(lineup: Partial<Record<NbaPos, NbaCard>>, difficulty: Difficulty, seed: string, draftSeed: string, extra: Partial<NbaTeamSnapshot> = {}): NbaTeamSnapshot {
  // identity is cosmetic and travels with the snapshot (history), never with the simulation
  const e = evaluateNbaTeam(lineup, DIFFICULTY_PARAMS[difficulty].nbaFitSensitivity);
  return {
    version: 2, seed, draftSeed, difficulty,
    players: NBA_POSITIONS.filter((p) => lineup[p]).map((pos) => { const c = lineup[pos]!; return { pos, id: c.id, name: c.name, teamName: c.teamName, season: c.season, ovr: c.ratings.overall }; }),
    teamOvr: e.overall, chemistry: e.chemistry, net: e.net, strengths: e.strengths, weaknesses: e.weaknesses, ...extra,
  };
}
