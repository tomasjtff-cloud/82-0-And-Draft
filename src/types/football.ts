import type { Difficulty } from "@/lib/core/difficulty";

export type FbPos =
  | "GK" | "RB" | "CB" | "LB" | "RWB" | "LWB" | "CDM" | "CM" | "CAM" | "RM" | "LM" | "RW" | "LW" | "ST" | "CF";
export const FB_POSITIONS: FbPos[] = ["GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "CM", "CAM", "RM", "LM", "RW", "LW", "ST", "CF"];
export type FbDecade = "1970s" | "1980s" | "1990s" | "2000s" | "2010s" | "2020s";
export const FB_DECADES: FbDecade[] = ["1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];

/** Play-style archetype codes (drive estimated attributes and tactical fit). */
export type FbStyle =
  | "POA" | "TM" | "CF" | "F9" | "SPD" | "IF" | "DRB" | "CRS" | "SS" | "PM" | "TQ" | "BTB" | "REG" | "DLP" | "DES"
  | "STO" | "BPD" | "LIB" | "AFB" | "DFB" | "SST" | "SWK";

export interface HistClub { id: string; name: string; country: string; league: string; colors: [string, string] }

export interface FbAttrs { pac: number; sho: number; pas: number; dri: number; def: number; phy: number }
export interface GkAttrs { div: number; han: number; kic: number; ref: number; spd: number; pos: number }

export interface FbPlayerSeason {
  id: string;            // `${playerId}-${clubId}-${startYear}`
  playerId: string;
  name: string;
  nation: string;        // FIFA trigram
  clubId: string;
  startYear: number;     // 2007 => 2007/08
  season: string;        // "2007/08"
  decade: FbDecade;
  positions: FbPos[];    // primary first
  ovr: number;           // Legends Lab ESTIMATE (not an EA rating)
  style: FbStyle;
  attrs: FbAttrs | null; // outfield
  gk: GkAttrs | null;    // goalkeepers
  leagueGoals: number | null; // verifiable stat when curated; null if not included
  attrsEstimated: true;
  source: string;
  verification: "manual-curation" | "api-verified";
  updatedAt: string;
}

export interface FormationSlot { id: string; pos: FbPos; x: number; y: number }
export interface Formation { id: string; name: string; slots: FormationSlot[] }

export type DraftMode = "roulette" | "fut";

export interface FbSpin { clubId: string; decade: FbDecade }

export interface FbDraftState {
  seed: string;
  difficulty: Difficulty;
  mode: DraftMode;
  formationId: string;
  step: number;                        // FUT: 0 = captain; then slots
  order: string[];                     // slot ids in draft order
  currentSlot: string | null;
  spin: FbSpin | null;                 // roulette mode
  filter: { clubId?: string; decade?: FbDecade } | null; // FUT optional re-spin filter
  options: string[];                   // card ids offered
  lineup: Record<string, string>;      // slotId -> card id
  captainId: string | null;
  respins: { club: number; era: number };
  rngState: [number, number, number, number];
}

export interface SimTeam {
  id: string;
  name: string;
  short: string;
  country: string;
  rating: number;  // overall strength (OVR-like scale)
  att: number;
  def: number;
  isUser?: boolean;
  tier?: "PL" | "EFL1" | "EFL2";
}

export type CompId = "PL" | "UCL" | "FA" | "EFL";

export interface Match {
  id: string;
  comp: CompId;
  stage: string;        // e.g. "R12", "MD3", "R3", "QF", "SF", "F", "PO"
  date: string;         // YYYY-MM-DD
  home: string;
  away: string;
  hg: number;
  ag: number;
  et?: { hg: number; ag: number } | null; // goals scored in extra time only
  pens?: { h: number; a: number } | null;
  neutral?: boolean;
  tieId?: string;
  leg?: 1 | 2;
}

export interface Tie {
  id: string;
  comp: CompId;
  stage: string;
  a: string;            // first drawn / first-leg home / seeded team
  b: string;
  legs: string[];       // match ids
  winner: string | null;
  twoLegged: boolean;
}

export interface StandingRow {
  team: string; p: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number;
  awayGf?: number; awayW?: number; pos?: number; form?: ("W" | "D" | "L")[];
}
