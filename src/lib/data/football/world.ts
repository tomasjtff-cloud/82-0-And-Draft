/**
 * Simulation world for the 2026/27 reference season (game scenario).
 *
 * - Premier League 2026/27 clubs: the 20 clubs after 2025/26 promotion/
 *   relegation (relegated: Wolves, Burnley, West Ham; promoted: Coventry City,
 *   Ipswich Town, Hull City) — per public reports found during research.
 * - Ratings are Legends Lab ESTIMATES of current strength on an OVR-like scale.
 * - The UCL field and EFL clubs are an APPROXIMATE scenario built from clubs
 *   that regularly take part; they are NOT the official 2026/27 entry lists.
 * - No real 2026/27 results are used or assumed.
 */
import type { SimTeam } from "@/types/football";

function t(id: string, name: string, short: string, country: string, rating: number, attOff = 0, defOff = 0, tier?: SimTeam["tier"]): SimTeam {
  return { id, name, short, country, rating, att: rating + attOff, def: rating + defOff, tier };
}

export const PL_CLUBS: SimTeam[] = [
  t("ARS", "Arsenal", "ARS", "ENG", 85, -1, 2, "PL"),
  t("MCI", "Manchester City", "MCI", "ENG", 84, 1, -1, "PL"),
  t("LIV", "Liverpool", "LIV", "ENG", 84, 2, -2, "PL"),
  t("CHE", "Chelsea", "CHE", "ENG", 82, 1, -1, "PL"),
  t("NEW", "Newcastle United", "NEW", "ENG", 80, 0, 0, "PL"),
  t("AVL", "Aston Villa", "AVL", "ENG", 79, 0, 0, "PL"),
  t("MUN", "Manchester United", "MUN", "ENG", 79, 0, -1, "PL"),
  t("TOT", "Tottenham Hotspur", "TOT", "ENG", 78, 1, -1, "PL"),
  t("BHA", "Brighton & Hove Albion", "BHA", "ENG", 77, 1, -1, "PL"),
  t("CRY", "Crystal Palace", "CRY", "ENG", 77, -1, 1, "PL"),
  t("NFO", "Nottingham Forest", "NFO", "ENG", 76, -1, 1, "PL"),
  t("BRE", "Brentford", "BRE", "ENG", 76, 1, -1, "PL"),
  t("BOU", "AFC Bournemouth", "BOU", "ENG", 76, 1, -1, "PL"),
  t("FUL", "Fulham", "FUL", "ENG", 75, 0, 0, "PL"),
  t("EVE", "Everton", "EVE", "ENG", 75, -1, 1, "PL"),
  t("LEE", "Leeds United", "LEE", "ENG", 73, 0, 0, "PL"),
  t("SUN", "Sunderland", "SUN", "ENG", 73, -1, 1, "PL"),
  t("COV", "Coventry City", "COV", "ENG", 72, 0, 0, "PL"),
  t("IPS", "Ipswich Town", "IPS", "ENG", 72, 0, 0, "PL"),
  t("HUL", "Hull City", "HUL", "ENG", 71, 0, 0, "PL"),
];

/** Other European clubs for the UCL scenario (36 total with the 5 English entrants). */
export const EURO_CLUBS: SimTeam[] = [
  t("RMA", "Real Madrid", "RMA", "ESP", 86, 1, -1), t("BAR", "FC Barcelona", "BAR", "ESP", 85, 2, -2),
  t("ATM", "Atlético de Madrid", "ATM", "ESP", 81, -1, 1), t("ATH", "Athletic Club", "ATH", "ESP", 77),
  t("VIL", "Villarreal", "VIL", "ESP", 77, 1, -1),
  t("FCB", "Bayern München", "FCB", "GER", 85, 2, -1), t("B04", "Bayer Leverkusen", "B04", "GER", 80),
  t("BVB", "Borussia Dortmund", "BVB", "GER", 80, 1, -1), t("RBL", "RB Leipzig", "RBL", "GER", 77), t("VFB", "VfB Stuttgart", "VFB", "GER", 76),
  t("INT", "Inter", "INT", "ITA", 83, 0, 1), t("NAP", "Napoli", "NAP", "ITA", 81, 0, 1), t("JUV", "Juventus", "JUV", "ITA", 80, -1, 1),
  t("MIL", "AC Milan", "MIL", "ITA", 79), t("ATA", "Atalanta", "ATA", "ITA", 78, 1, -1),
  t("PSG", "Paris Saint-Germain", "PSG", "FRA", 85, 1, 0), t("OM", "Olympique de Marseille", "OM", "FRA", 77), t("ASM", "AS Monaco", "ASM", "FRA", 76, 1, -1), t("LOSC", "Lille OSC", "LOSC", "FRA", 75),
  t("SLB", "Benfica", "SLB", "POR", 77), t("SCP", "Sporting CP", "SCP", "POR", 77, 1, -1), t("FCP", "FC Porto", "FCP", "POR", 76),
  t("PSV", "PSV Eindhoven", "PSV", "NED", 76, 1, -1), t("AJA", "Ajax", "AJA", "NED", 75), t("FEY", "Feyenoord", "FEY", "NED", 75),
  t("CLB", "Club Brugge", "CLB", "BEL", 74), t("CEL", "Celtic", "CEL", "SCO", 73), t("RBS", "Red Bull Salzburg", "RBS", "AUT", 72),
  t("GAL", "Galatasaray", "GAL", "TUR", 75), t("SLA", "Slavia Praha", "SLA", "CZE", 71), t("FCK", "FC København", "FCK", "DEN", 71),
];

/** Approximate pool of English Football League clubs (not the official 2026/27 divisions). */
export const EFL_CLUBS: SimTeam[] = [
  ...[
    ["WOL", "Wolverhampton Wanderers", 72], ["BUR", "Burnley", 71], ["WHU", "West Ham United", 72], ["LEI", "Leicester City", 70],
    ["SOU", "Southampton", 70], ["SHU", "Sheffield United", 69], ["MID", "Middlesbrough", 69], ["NOR", "Norwich City", 68],
    ["WAT", "Watford", 67], ["BRC", "Bristol City", 67], ["WBA", "West Bromwich Albion", 68], ["MIL2", "Millwall", 67],
    ["STK", "Stoke City", 66], ["QPR", "Queens Park Rangers", 65], ["BLB", "Blackburn Rovers", 66], ["PNE", "Preston North End", 66],
    ["SWA", "Swansea City", 66], ["DER", "Derby County", 65], ["POR2", "Portsmouth", 65], ["OXF", "Oxford United", 64],
    ["CHA", "Charlton Athletic", 64], ["WRE", "Wrexham", 66], ["BIR", "Birmingham City", 67], ["SHW", "Sheffield Wednesday", 64],
  ].map(([id, name, r]) => t(id as string, name as string, (id as string).slice(0, 3), "ENG", r as number, 0, 0, "EFL1")),
  ...[
    ["BOL", "Bolton Wanderers", 62], ["BAR2", "Barnsley", 61], ["HUD", "Huddersfield Town", 62], ["PET", "Peterborough United", 60],
    ["REA", "Reading", 60], ["WIG", "Wigan Athletic", 60], ["STO", "Stockport County", 61], ["LIN", "Lincoln City", 60],
    ["BRA", "Bradford City", 59], ["ROT", "Rotherham United", 59], ["LOR", "Leyton Orient", 59], ["EXE", "Exeter City", 58],
    ["WYC", "Wycombe Wanderers", 60], ["MAN", "Mansfield Town", 58], ["BPL", "Blackpool", 59], ["CAM", "Cambridge United", 57],
    ["DON", "Doncaster Rovers", 58], ["PVA", "Port Vale", 57], ["PLY", "Plymouth Argyle", 60], ["NOT", "Northampton Town", 57],
  ].map(([id, name, r]) => t(id as string, name as string, (id as string).slice(0, 3), "ENG", r as number, 0, 0, "EFL2")),
];

export const FANTASY_ID = "FAN";
