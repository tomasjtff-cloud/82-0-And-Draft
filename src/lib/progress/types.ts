/**
 * Local progress ledger (no account). One compact, versioned record per finished season,
 * plus completed drafts and unlocked achievements. Everything else (records, hall of fame,
 * trophy room, achievement progress) is DERIVED from this ledger — never stored twice.
 */
import type { TacticId } from "@/features/football-simulation/tactics";

export const PROGRESS_VERSION = 1;

export interface FbPlayerLine { id: string; name: string; pos: string; g: number; a: number; cs: number; r: number; gp: number; min: number; ug: number }
export interface AwardRef { id: string; name: string; stat: string }
export interface FbSeasonRec {
  kind: "fb"; id: string; date: string; difficulty: string; mode: "roulette" | "fut"; tactic: TacticId;
  draftSeed: string; seasonSeed: string;
  team: { name: string; formationId: string; ovr: number; chem: number; nations: number };
  pl: { pos: number; pts: number; w: number; d: number; l: number; gf: number; ga: number; cs: number };
  won: { PL: boolean; UCL: boolean; FA: boolean; EFL: boolean }; titles: number;
  finals: { comp: string; gf: number; ga: number; pens: boolean; won: boolean }[];
  maxWinMargin: number; finalHatTrick: boolean;
  players: FbPlayerLine[];
  awards: { ballon?: AwardRef; boot?: AwardRef; glove?: AwardRef; pots?: AwardRef };
  /** migrated from a pre-V4 history entry: only team-level facts are known */
  legacy?: true;
}
export interface NbaPlayerAvg { name: string; pos: string; gp: number; ppg: number; rpg: number; apg: number; spg: number; bpg: number }
export interface NbaSeasonRec {
  kind: "nba"; id: string; date: string; difficulty: string; draftSeed: string; seed: string; teamName: string;
  wins: number; losses: number; outcome: string; champion: boolean; seriesWon: number; poW: number; poL: number;
  expectedWins: number; chemistry: number; teamOvr: number; offense: number; defense: number; playmaking: number; legends: number;
  longestStreak: number; homeW: number; homeL: number; finalsGame7Win: boolean;
  players: NbaPlayerAvg[];
  awards: { mvp?: AwardRef; scorer?: AwardRef; rebounder?: AwardRef; passer?: AwardRef; defender?: AwardRef; finalsMvp?: AwardRef };
  legacy?: true;
}
export type SeasonRec = FbSeasonRec | NbaSeasonRec;
export interface DraftRec { game: "fb" | "nba"; id: string; date: string; chem: number; nations?: number; mode?: string }
export interface UnlockRec { at: string; ref: string | null; v: number }
export interface Progress {
  version: number;
  profileName: string;
  seasons: SeasonRec[];
  drafts: DraftRec[];
  achievements: Record<string, UnlockRec>;
  migratedHistory?: boolean;
}
export const emptyProgress = (): Progress => ({ version: PROGRESS_VERSION, profileName: "", seasons: [], drafts: [], achievements: {} });
