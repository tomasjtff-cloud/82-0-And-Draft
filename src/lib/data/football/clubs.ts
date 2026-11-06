import type { HistClub } from "@/types/football";

/** Historical clubs used by the draft. Ids are stable across renames. Colors: original palettes. */
export const HIST_CLUBS: HistClub[] = [
  { id: "MUN", name: "Manchester United", country: "ENG", league: "England", colors: ["#c8102e", "#111111"] },
  { id: "LIV", name: "Liverpool", country: "ENG", league: "England", colors: ["#c8102e", "#00a398"] },
  { id: "ARS", name: "Arsenal", country: "ENG", league: "England", colors: ["#ef0107", "#ffffff"] },
  { id: "CHE", name: "Chelsea", country: "ENG", league: "England", colors: ["#034694", "#ffffff"] },
  { id: "MCI", name: "Manchester City", country: "ENG", league: "England", colors: ["#6cabdd", "#1c2c5b"] },
  { id: "TOT", name: "Tottenham Hotspur", country: "ENG", league: "England", colors: ["#f2f2f2", "#132257"] },
  { id: "NEW", name: "Newcastle United", country: "ENG", league: "England", colors: ["#241f20", "#f2f2f2"] },
  { id: "RMA", name: "Real Madrid", country: "ESP", league: "Spain", colors: ["#f5f5f5", "#febe10"] },
  { id: "BAR", name: "FC Barcelona", country: "ESP", league: "Spain", colors: ["#a50044", "#004d98"] },
  { id: "ATM", name: "Atlético de Madrid", country: "ESP", league: "Spain", colors: ["#cb3524", "#272e61"] },
  { id: "VAL", name: "Valencia", country: "ESP", league: "Spain", colors: ["#f2f2f2", "#ee8707"] },
  { id: "MIL", name: "AC Milan", country: "ITA", league: "Italy", colors: ["#fb090b", "#111111"] },
  { id: "INT", name: "Inter", country: "ITA", league: "Italy", colors: ["#0068a8", "#111111"] },
  { id: "JUV", name: "Juventus", country: "ITA", league: "Italy", colors: ["#f2f2f2", "#111111"] },
  { id: "NAP", name: "Napoli", country: "ITA", league: "Italy", colors: ["#12a0d7", "#003c82"] },
  { id: "FCB", name: "Bayern München", country: "GER", league: "Germany", colors: ["#dc052d", "#0066b2"] },
  { id: "BVB", name: "Borussia Dortmund", country: "GER", league: "Germany", colors: ["#fde100", "#111111"] },
  { id: "B04", name: "Bayer Leverkusen", country: "GER", league: "Germany", colors: ["#e32221", "#111111"] },
  { id: "PSG", name: "Paris Saint-Germain", country: "FRA", league: "France", colors: ["#004170", "#da291c"] },
  { id: "OM", name: "Olympique de Marseille", country: "FRA", league: "France", colors: ["#2faee0", "#f2f2f2"] },
  { id: "OL", name: "Olympique Lyonnais", country: "FRA", league: "France", colors: ["#f2f2f2", "#14387f"] },
  { id: "AJA", name: "Ajax", country: "NED", league: "Netherlands", colors: ["#d2122e", "#f2f2f2"] },
  { id: "FCP", name: "FC Porto", country: "POR", league: "Portugal", colors: ["#00428c", "#f2f2f2"] },
  { id: "SLB", name: "Benfica", country: "POR", league: "Portugal", colors: ["#e83030", "#f2f2f2"] },
];
export const HIST_CLUB_BY_ID: Record<string, HistClub> = Object.fromEntries(HIST_CLUBS.map((c) => [c.id, c]));
export const leagueOf = (clubId: string) => HIST_CLUB_BY_ID[clubId]?.league ?? "Other";
