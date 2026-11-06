/**
 * Dataset integrity report: `npm run validate:data`
 * Checks duplicates, impossible values, era rules and draft coverage.
 */
import { NBA_PLAYER_SEASONS } from "../src/lib/data/nba/players";
import { FRANCHISE_BY_ID } from "../src/lib/data/nba/franchises";
import { FB_PLAYER_SEASONS } from "../src/lib/data/football/players";
import { HIST_CLUB_BY_ID } from "../src/lib/data/football/clubs";

let problems = 0;
const warn = (m: string) => { problems++; console.log("  ✗", m); };

console.log("NBA player-seasons:", NBA_PLAYER_SEASONS.length);
const nbaIds = new Set<string>();
for (const p of NBA_PLAYER_SEASONS) {
  if (nbaIds.has(p.id)) warn(`duplicate ${p.id}`); nbaIds.add(p.id);
  if (!FRANCHISE_BY_ID[p.franchiseId]) warn(`unknown franchise ${p.franchiseId}`);
  if (p.startYear < 1973 && (p.spg != null || p.bpg != null)) warn(`${p.id}: steals/blocks before 1973-74`);
  if (p.startYear < 1979 && p.tpPct != null) warn(`${p.id}: 3P% before 1979-80`);
  if (p.ppg > 55 || p.rpg > 30 || p.apg > 16) warn(`${p.id}: implausible per-game value`);
  if (p.fgPct != null && (p.fgPct < 0.3 || p.fgPct > 0.8)) warn(`${p.id}: FG% out of range`);
}
const combos = new Map<string, number>();
for (const p of NBA_PLAYER_SEASONS) combos.set(`${p.franchiseId} ${p.decade}`, (combos.get(`${p.franchiseId} ${p.decade}`) ?? 0) + 1);
console.log("  franchise-decade combos:", combos.size, "· thin (<3 cards):", [...combos].filter(([, n]) => n < 3).map(([k]) => k).join(", ") || "none");

console.log("Football player-seasons:", FB_PLAYER_SEASONS.length);
const fbIds = new Set<string>();
for (const p of FB_PLAYER_SEASONS) {
  if (fbIds.has(p.id)) warn(`duplicate ${p.id}`); fbIds.add(p.id);
  if (!HIST_CLUB_BY_ID[p.clubId]) warn(`unknown club ${p.clubId}`);
  if (p.ovr < 50 || p.ovr > 99) warn(`${p.id}: ovr out of range`);
  if ((p.positions[0] === "GK") !== !!p.gk) warn(`${p.id}: GK attribute mismatch`);
}
const fbCombos = new Map<string, number>();
for (const p of FB_PLAYER_SEASONS) fbCombos.set(`${p.clubId} ${p.decade}`, (fbCombos.get(`${p.clubId} ${p.decade}`) ?? 0) + 1);
console.log("  club-decade combos:", fbCombos.size, "· thin (<4 cards):", [...fbCombos].filter(([, n]) => n < 4).map(([k]) => k).join(", ") || "none");
console.log(problems ? `\n${problems} problem(s) found` : "\nOK — no integrity problems found");
process.exitCode = problems ? 1 : 0;
