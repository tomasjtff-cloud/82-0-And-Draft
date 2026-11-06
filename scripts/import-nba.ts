/**
 * NBA verification importer (BALLDONTLIE).
 * Usage: BALLDONTLIE_API_KEY=... npx tsx scripts/import-nba.ts [--limit 20]
 *
 * For each curated player-season it looks up the player id and (if the
 * account tier allows it) the season averages, then writes a diff report to
 * data/nba/verification-report.json. It never overwrites the curated dataset
 * automatically: a human reviews the report and updates rows, switching
 * `verification` to "api-verified" only when values match.
 * Rate limit aware (free tier ≈ 5 req/min).
 */
import fs from "node:fs";
import { NBA_PLAYER_SEASONS } from "../src/lib/data/nba/players";

const KEY = process.env.BALLDONTLIE_API_KEY;
const BASE = "https://api.balldontlie.io/v1";
const limit = Number(process.argv[process.argv.indexOf("--limit") + 1]) || 20;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(path: string) {
  const res = await fetch(BASE + path, { headers: { Authorization: KEY! } });
  if (res.status === 401 || res.status === 403) throw new Error(`Endpoint ${path} no disponible para este plan (HTTP ${res.status}).`);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${path}`);
  return res.json();
}

async function main() {
  if (!KEY) { console.log("BALLDONTLIE_API_KEY no configurada. Ver .env.example y README (Integraciones)."); return; }
  const report: unknown[] = [];
  for (const p of NBA_PLAYER_SEASONS.filter((x) => x.startYear >= 1979).slice(0, limit)) {
    try {
      const [first, ...rest] = p.name.split(" ");
      const found = await get(`/players?search=${encodeURIComponent(rest.join(" ") || first)}&per_page=25`);
      const match = found.data.find((x: { first_name: string; last_name: string }) => `${x.first_name} ${x.last_name}`.toLowerCase() === p.name.toLowerCase());
      if (!match) { report.push({ id: p.id, status: "player-not-found" }); continue; }
      await sleep(13000);
      const avg = await get(`/season_averages?season=${p.startYear}&player_id=${match.id}`).catch((e: Error) => ({ error: e.message }));
      report.push({ id: p.id, playerApiId: match.id, curated: { ppg: p.ppg, rpg: p.rpg, apg: p.apg }, api: avg });
      await sleep(13000);
    } catch (e) {
      report.push({ id: p.id, status: "error", message: (e as Error).message });
    }
  }
  fs.mkdirSync("data/nba", { recursive: true });
  fs.writeFileSync("data/nba/verification-report.json", JSON.stringify(report, null, 2));
  console.log(`Informe escrito en data/nba/verification-report.json (${report.length} filas).`);
}
main();
