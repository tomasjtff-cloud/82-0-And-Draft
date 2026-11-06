/**
 * Verifies NBA player–franchise–season memberships against FiveThirtyEight's
 * public RAPTOR dataset (CC BY 4.0, seasons 1976-77 → 2021-22) and attaches
 * real advanced metrics (minutes, possessions, RAPTOR, WAR).
 *
 *   npx tsx scripts/verify-nba-538.ts
 *
 * Source: https://github.com/fivethirtyeight/data/tree/master/nba-raptor
 * Output: src/lib/data/verification/nba-538.json (committed; read at build time).
 */
import fs from "node:fs";
import path from "node:path";
import { NBA_PLAYER_SEASONS, slug } from "../src/lib/data/nba/players";

const URL = "https://raw.githubusercontent.com/fivethirtyeight/data/master/nba-raptor/historical_RAPTOR_by_team.csv";
const CACHE = "data/cache/historical_RAPTOR_by_team.csv";
const OUT = "src/lib/data/verification/nba-538.json";

/** Legends Lab franchise id → Basketball-Reference style codes used by 538. */
const CODES: Record<string, string[]> = {
  ATL: ["ATL"], BOS: ["BOS"], BKN: ["NYN", "NJN", "BRK"], CHA: ["CHH", "CHA"], CHI: ["CHI"], CLE: ["CLE"], DAL: ["DAL"],
  DEN: ["DEN"], DET: ["DET"], GSW: ["GSW"], HOU: ["HOU"], IND: ["IND"], LAC: ["BUF", "SDC", "LAC"], LAL: ["LAL"],
  MEM: ["VAN", "MEM"], MIA: ["MIA"], MIL: ["MIL"], MIN: ["MIN"], NOP: ["NOH", "NOK", "NOP"], NYK: ["NYK"], OKC: ["SEA", "OKC"],
  ORL: ["ORL"], PHI: ["PHI"], PHX: ["PHO"], POR: ["POR"], SAC: ["KCK", "SAC"], SAS: ["SAS"], TOR: ["TOR"], UTA: ["NOJ", "UTA"], WAS: ["WSB", "WAS"],
};

function parseCsv(text: string): Record<string, string>[] {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split(",");
  return lines.map((l) => { const v = l.split(","); return Object.fromEntries(cols.map((c, i) => [c, v[i]])); });
}

async function main() {
  let text: string;
  if (fs.existsSync(CACHE)) text = fs.readFileSync(CACHE, "utf8");
  else {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} downloading 538 data`);
    text = await res.text();
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    fs.writeFileSync(CACHE, text);
  }
  const rows = parseCsv(text).filter((r) => r.season_type === "RS");
  const idx = new Map<string, Record<string, string>[]>();
  for (const r of rows) {
    const k = `${r.team}|${r.season}`;
    if (!idx.has(k)) idx.set(k, []);
    idx.get(k)!.push(r);
  }
  const out: Record<string, unknown> = {};
  const counts = { verified: 0, "not-found": 0, "out-of-range": 0 };
  const missing: string[] = [];
  for (const p of NBA_PLAYER_SEASONS) {
    const season = p.startYear + 1; // 538 uses the season END year
    if (season < 1977 || season > 2022) { out[p.id] = { status: "out-of-range" }; counts["out-of-range"]++; continue; }
    const cands = CODES[p.franchiseId].flatMap((c) => idx.get(`${c}|${season}`) ?? []);
    const ALIASES: Record<string, string> = { "jakob-poltl": "jakob-poeltl", "ron-artest": "metta-world-peace" };
    const target = ALIASES[slug(p.name)] ?? slug(p.name);
    const last = target.split("-").slice(-1)[0];
    let hit = cands.find((r) => slug(r.player_name) === target || slug(r.player_name) === slug(p.name));
    if (!hit) {
      const byLast = cands.filter((r) => { const s = slug(r.player_name); return s.endsWith(last) || s.split("-").slice(-1)[0].slice(0, 4) === last.slice(0, 4); });
      const first = target.split("-")[0];
      hit = byLast.find((r) => slug(r.player_name).startsWith(first.slice(0, 3))) ?? (byLast.length === 1 ? byLast[0] : undefined);
    }
    if (!hit) { out[p.id] = { status: "not-found" }; counts["not-found"]++; missing.push(`${p.name} ${p.franchiseId} ${p.season}`); continue; }
    const n = (k: string) => Math.round(Number(hit![k]) * 10) / 10;
    out[p.id] = {
      status: "verified", bbrefId: hit.player_id, team: hit.team, mp: Number(hit.mp), poss: Number(hit.poss),
      raptorOffense: n("raptor_offense"), raptorDefense: n("raptor_defense"), raptorTotal: n("raptor_total"), war: n("war_reg_season"),
    };
    counts.verified++;
  }
  fs.writeFileSync(OUT, JSON.stringify({ source: "FiveThirtyEight RAPTOR (CC BY 4.0)", url: URL, generatedAt: new Date().toISOString().slice(0, 10), counts, rows: out }, ));
  console.log(counts);
  if (missing.length) console.log("Not found in 538 (review manually):\n  " + missing.join("\n  "));
}
main();
