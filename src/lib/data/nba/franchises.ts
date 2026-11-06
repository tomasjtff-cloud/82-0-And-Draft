import type { NbaFranchise } from "@/types/nba";

/**
 * 30 NBA franchises with historical names (relocations / renames) keyed by
 * season START year. Franchise identity is stable (id) — the display name of a
 * card is resolved for the specific season.
 * Colors are original Legends Lab palettes (not official brand assets).
 */
export const NBA_FRANCHISES: NbaFranchise[] = [
  { id: "ATL", city: "Atlanta", name: "Hawks", conference: "East", division: "Southeast", colors: ["#c8102e", "#fdb927"], names: [{ from: 1955, to: 1967, name: "St. Louis Hawks" }, { from: 1968, to: 9999, name: "Atlanta Hawks" }] },
  { id: "BOS", city: "Boston", name: "Celtics", conference: "East", division: "Atlantic", colors: ["#007a33", "#ba9653"], names: [{ from: 1946, to: 9999, name: "Boston Celtics" }] },
  { id: "BKN", city: "Brooklyn", name: "Nets", conference: "East", division: "Atlantic", colors: ["#e5e5e5", "#555555"], names: [{ from: 1976, to: 1976, name: "New York Nets" }, { from: 1977, to: 2011, name: "New Jersey Nets" }, { from: 2012, to: 9999, name: "Brooklyn Nets" }] },
  { id: "CHA", city: "Charlotte", name: "Hornets", conference: "East", division: "Southeast", colors: ["#1d8cab", "#3b2a6b"], names: [{ from: 1988, to: 2001, name: "Charlotte Hornets" }, { from: 2004, to: 2013, name: "Charlotte Bobcats" }, { from: 2014, to: 9999, name: "Charlotte Hornets" }] },
  { id: "CHI", city: "Chicago", name: "Bulls", conference: "East", division: "Central", colors: ["#ce1141", "#111111"], names: [{ from: 1966, to: 9999, name: "Chicago Bulls" }] },
  { id: "CLE", city: "Cleveland", name: "Cavaliers", conference: "East", division: "Central", colors: ["#860038", "#fdbb30"], names: [{ from: 1970, to: 9999, name: "Cleveland Cavaliers" }] },
  { id: "DAL", city: "Dallas", name: "Mavericks", conference: "West", division: "Southwest", colors: ["#0064b1", "#bbc4ca"], names: [{ from: 1980, to: 9999, name: "Dallas Mavericks" }] },
  { id: "DEN", city: "Denver", name: "Nuggets", conference: "West", division: "Northwest", colors: ["#0e2240", "#fec524"], names: [{ from: 1976, to: 9999, name: "Denver Nuggets" }] },
  { id: "DET", city: "Detroit", name: "Pistons", conference: "East", division: "Central", colors: ["#c8102e", "#1d42ba"], names: [{ from: 1948, to: 1956, name: "Fort Wayne Pistons" }, { from: 1957, to: 9999, name: "Detroit Pistons" }] },
  { id: "GSW", city: "San Francisco", name: "Warriors", conference: "West", division: "Pacific", colors: ["#1d428a", "#ffc72c"], names: [{ from: 1946, to: 1961, name: "Philadelphia Warriors" }, { from: 1962, to: 1970, name: "San Francisco Warriors" }, { from: 1971, to: 9999, name: "Golden State Warriors" }] },
  { id: "HOU", city: "Houston", name: "Rockets", conference: "West", division: "Southwest", colors: ["#ce1141", "#c4ced4"], names: [{ from: 1967, to: 1970, name: "San Diego Rockets" }, { from: 1971, to: 9999, name: "Houston Rockets" }] },
  { id: "IND", city: "Indiana", name: "Pacers", conference: "East", division: "Central", colors: ["#002d62", "#fdbb30"], names: [{ from: 1976, to: 9999, name: "Indiana Pacers" }] },
  { id: "LAC", city: "Los Angeles", name: "Clippers", conference: "West", division: "Pacific", colors: ["#c8102e", "#1d428a"], names: [{ from: 1970, to: 1977, name: "Buffalo Braves" }, { from: 1978, to: 1983, name: "San Diego Clippers" }, { from: 1984, to: 9999, name: "Los Angeles Clippers" }] },
  { id: "LAL", city: "Los Angeles", name: "Lakers", conference: "West", division: "Pacific", colors: ["#552583", "#fdb927"], names: [{ from: 1948, to: 1959, name: "Minneapolis Lakers" }, { from: 1960, to: 9999, name: "Los Angeles Lakers" }] },
  { id: "MEM", city: "Memphis", name: "Grizzlies", conference: "West", division: "Southwest", colors: ["#5d76a9", "#12173f"], names: [{ from: 1995, to: 2000, name: "Vancouver Grizzlies" }, { from: 2001, to: 9999, name: "Memphis Grizzlies" }] },
  { id: "MIA", city: "Miami", name: "Heat", conference: "East", division: "Southeast", colors: ["#98002e", "#f9a01b"], names: [{ from: 1988, to: 9999, name: "Miami Heat" }] },
  { id: "MIL", city: "Milwaukee", name: "Bucks", conference: "East", division: "Central", colors: ["#00471b", "#eee1c6"], names: [{ from: 1968, to: 9999, name: "Milwaukee Bucks" }] },
  { id: "MIN", city: "Minnesota", name: "Timberwolves", conference: "West", division: "Northwest", colors: ["#236192", "#78be20"], names: [{ from: 1989, to: 9999, name: "Minnesota Timberwolves" }] },
  { id: "NOP", city: "New Orleans", name: "Pelicans", conference: "West", division: "Southwest", colors: ["#0c2340", "#c8102e"], names: [{ from: 2002, to: 2004, name: "New Orleans Hornets" }, { from: 2005, to: 2006, name: "New Orleans/Oklahoma City Hornets" }, { from: 2007, to: 2012, name: "New Orleans Hornets" }, { from: 2013, to: 9999, name: "New Orleans Pelicans" }] },
  { id: "NYK", city: "New York", name: "Knicks", conference: "East", division: "Atlantic", colors: ["#006bb6", "#f58426"], names: [{ from: 1946, to: 9999, name: "New York Knicks" }] },
  { id: "OKC", city: "Oklahoma City", name: "Thunder", conference: "West", division: "Northwest", colors: ["#007ac1", "#ef3b24"], names: [{ from: 1967, to: 2007, name: "Seattle SuperSonics" }, { from: 2008, to: 9999, name: "Oklahoma City Thunder" }] },
  { id: "ORL", city: "Orlando", name: "Magic", conference: "East", division: "Southeast", colors: ["#0077c0", "#c4ced4"], names: [{ from: 1989, to: 9999, name: "Orlando Magic" }] },
  { id: "PHI", city: "Philadelphia", name: "76ers", conference: "East", division: "Atlantic", colors: ["#006bb6", "#ed174c"], names: [{ from: 1949, to: 1962, name: "Syracuse Nationals" }, { from: 1963, to: 9999, name: "Philadelphia 76ers" }] },
  { id: "PHX", city: "Phoenix", name: "Suns", conference: "West", division: "Pacific", colors: ["#e56020", "#1d1160"], names: [{ from: 1968, to: 9999, name: "Phoenix Suns" }] },
  { id: "POR", city: "Portland", name: "Trail Blazers", conference: "West", division: "Northwest", colors: ["#e03a3e", "#111111"], names: [{ from: 1970, to: 9999, name: "Portland Trail Blazers" }] },
  { id: "SAC", city: "Sacramento", name: "Kings", conference: "West", division: "Pacific", colors: ["#5a2d81", "#63727a"], names: [{ from: 1957, to: 1971, name: "Cincinnati Royals" }, { from: 1972, to: 1974, name: "Kansas City-Omaha Kings" }, { from: 1975, to: 1984, name: "Kansas City Kings" }, { from: 1985, to: 9999, name: "Sacramento Kings" }] },
  { id: "SAS", city: "San Antonio", name: "Spurs", conference: "West", division: "Southwest", colors: ["#c4ced4", "#111111"], names: [{ from: 1976, to: 9999, name: "San Antonio Spurs" }] },
  { id: "TOR", city: "Toronto", name: "Raptors", conference: "East", division: "Atlantic", colors: ["#ce1141", "#a1a1a4"], names: [{ from: 1995, to: 9999, name: "Toronto Raptors" }] },
  { id: "UTA", city: "Utah", name: "Jazz", conference: "West", division: "Northwest", colors: ["#002b5c", "#f9a01b"], names: [{ from: 1974, to: 1978, name: "New Orleans Jazz" }, { from: 1979, to: 9999, name: "Utah Jazz" }] },
  { id: "WAS", city: "Washington", name: "Wizards", conference: "East", division: "Southeast", colors: ["#002b5c", "#e31837"], names: [{ from: 1961, to: 1961, name: "Chicago Packers" }, { from: 1962, to: 1962, name: "Chicago Zephyrs" }, { from: 1963, to: 1972, name: "Baltimore Bullets" }, { from: 1973, to: 1973, name: "Capital Bullets" }, { from: 1974, to: 1996, name: "Washington Bullets" }, { from: 1997, to: 9999, name: "Washington Wizards" }] },
];

export const FRANCHISE_BY_ID: Record<string, NbaFranchise> = Object.fromEntries(NBA_FRANCHISES.map((f) => [f.id, f]));

export function teamNameFor(franchiseId: string, startYear: number): string {
  const f = FRANCHISE_BY_ID[franchiseId];
  if (!f) throw new Error(`Unknown franchise ${franchiseId}`);
  const n = f.names.find((x) => startYear >= x.from && startYear <= x.to);
  return n ? n.name : `${f.city} ${f.name}`;
}

/**
 * Opponent field for the 82-game season (current-era league).
 * netRating = Legends Lab ESTIMATE of team strength vs league average
 * (points per 100 possessions). Not official data.
 */
export const NBA_OPPONENT_STRENGTH: Record<string, { net: number; pace: number }> = {
  OKC: { net: 9.5, pace: 99 }, CLE: { net: 7, pace: 99 }, BOS: { net: 5.5, pace: 96 }, HOU: { net: 4, pace: 98 },
  NYK: { net: 4.5, pace: 96 }, DEN: { net: 4, pace: 99 }, MIN: { net: 3, pace: 97 }, DET: { net: 3, pace: 100 },
  LAL: { net: 2, pace: 99 }, LAC: { net: 2, pace: 97 }, IND: { net: 1.5, pace: 101 }, GSW: { net: 1.5, pace: 100 },
  MEM: { net: 1.5, pace: 103 }, ORL: { net: 1, pace: 97 }, SAS: { net: 1, pace: 100 }, MIL: { net: 0, pace: 99 },
  ATL: { net: 0, pace: 102 }, MIA: { net: -1, pace: 97 }, DAL: { net: -1, pace: 99 }, PHI: { net: -1.5, pace: 98 },
  PHX: { net: -2, pace: 98 }, SAC: { net: -2, pace: 99 }, CHI: { net: -2, pace: 102 }, POR: { net: -2.5, pace: 99 },
  TOR: { net: -3, pace: 100 }, NOP: { net: -5.5, pace: 99 }, CHA: { net: -6, pace: 98 }, BKN: { net: -7, pace: 96 },
  UTA: { net: -8, pace: 101 }, WAS: { net: -9, pace: 101 },
};
