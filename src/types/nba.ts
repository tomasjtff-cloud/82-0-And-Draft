import type { Difficulty } from "@/lib/core/difficulty";

export type NbaPos = "PG" | "SG" | "SF" | "PF" | "C";
export const NBA_POSITIONS: NbaPos[] = ["PG", "SG", "SF", "PF", "C"];
export type Decade = "1960s" | "1970s" | "1980s" | "1990s" | "2000s" | "2010s" | "2020s";

export interface NbaFranchise {
  id: string;
  city: string;
  name: string;
  conference: "East" | "West";
  division: string;
  colors: [string, string];
  /** names by season START year (inclusive) */
  names: { from: number; to: number; name: string }[];
}

export type Verification = "manual-curation" | "api-verified" | "estimated";

/** One historical version of a player (player + franchise + season). */
export interface NbaPlayerSeason {
  id: string;            // stable: `${playerId}-${franchiseId}-${startYear}`
  playerId: string;      // stable slug for the person (blocks duplicates across versions)
  name: string;
  franchiseId: string;
  teamName: string;      // historical name for that season
  startYear: number;     // 1995 => 1995-96
  season: string;        // "1995-96"
  decade: Decade;
  positions: NbaPos[];   // primary first
  gp: number | null;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number | null;    // not recorded before 1973-74
  bpg: number | null;
  fgPct: number | null;
  tpPct: number | null;  // no 3pt line before 1979-80
  tpa: number | null;    // 3PA per game
  ftPct: number | null;
  /** curated defensive reputation 0-3 (All-Defensive / DPOY level honors) */
  defRep: number;
  source: string;
  verification: Verification;
  updatedAt: string;
}

export interface NbaRatings {
  overall: number;
  offense: number;
  defense: number;
  playmaking: number;
  rebounding: number;
  rimProtection: number;
  shooting: number;
  versatility: number;
  eraAdjustment: number; // multiplicative factor applied to counting stats (shown as %)
  /** estimated impact, points per 100 possessions above average (RAPTOR scale) */
  impact: number;
  /** which components rely on estimates because stats were missing */
  estimated: string[];
}

export interface NbaCard extends NbaPlayerSeason {
  ratings: NbaRatings;
  check: import("@/lib/data/verification").VerificationInfo;
}

export interface NbaSpin {
  franchiseId: string;
  decade: Decade;
}

export interface NbaDraftState {
  seed: string;
  difficulty: Difficulty;
  round: number;               // 0..4
  spin: NbaSpin | null;
  options: string[];           // card ids offered this round
  lineup: Partial<Record<NbaPos, string>>; // pos -> card id
  respins: { team: number; era: number };
  history: { round: number; spin: NbaSpin; pickedId: string; pos: NbaPos }[];
  rngState: [number, number, number, number];
}

/** One box-score line of the user's team (starters by position, plus the generic bench). */
export interface BoxLine {
  key: NbaPos | "BENCH";
  min: number; pts: number; reb: number; ast: number; stl: number; blk: number;
  fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number;
}

export interface NbaGameResult {
  game: number;
  opponent: string;
  home: boolean;
  backToBack: boolean;
  teamScore: number;
  oppScore: number;
  win: boolean;
  expectedMargin: number;
  winProb: number;
  overtimes?: number;
  box?: BoxLine[];
}

export interface StandingEntry { team: string; conference: "East" | "West"; w: number; l: number; pf: number; pa: number; seed?: number }

export interface PlayoffGame { game: number; home: string; away: string; homeScore: number; awayScore: number; overtimes: number; box?: BoxLine[] }
export interface PlayoffSeries {
  id: string; round: 1 | 2 | 3 | 4; conference: "East" | "West" | "Finals";
  high: string; low: string; highSeed: number; lowSeed: number;
  winsHigh: number; winsLow: number; winner: string; games: PlayoffGame[];
}
export type PlayoffOutcome = "missed" | "first-round" | "conf-semis" | "conf-finals" | "finals" | "champion";

export interface PlayerTotals {
  key: NbaPos | "BENCH"; name: string; gp: number;
  min: number; pts: number; reb: number; ast: number; stl: number; blk: number;
  fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number;
}

export interface NbaSeasonResult {
  seed: string;
  difficulty: Difficulty;
  wins: number;
  losses: number;
  games: NbaGameResult[];
  longestWinStreak: number;
  avgMargin: number;
  teamNet: number;
  standings?: StandingEntry[];
  playoffs?: { series: PlayoffSeries[]; outcome: PlayoffOutcome; champion: string; userSeed: number | null };
  stats?: { regular: PlayerTotals[]; playoffs: PlayerTotals[] };
}

/** Everything needed to show "VER MI QUINTETO" later (history, reloads). Values frozen at draft time. */
export interface NbaTeamSnapshot {
  version: 2;
  seed: string;          // season seed (re-simulating with it reproduces the season)
  draftSeed: string;
  difficulty: Difficulty;
  players: { pos: NbaPos; id: string; name: string; teamName: string; season: string; ovr: number }[];
  teamOvr: number;
  chemistry: number;
  net: number;
  strengths: string[];
  weaknesses: string[];
  record?: { wins: number; losses: number };
  playoff?: string;
}
