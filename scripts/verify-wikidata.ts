/**
 * Verifies player–club–season memberships against Wikidata (CC0) "member of
 * sports team" (P54) statements with start/end qualifiers, and attaches the
 * spell's verifiable totals (matches P1350, goals P1351) when present.
 *
 *   npx tsx scripts/verify-wikidata.ts football
 *   npx tsx scripts/verify-wikidata.ts nba      (only seasons outside 538 coverage)
 *
 * Output: src/lib/data/verification/{football,nba}-wikidata.json
 * Policy: rows that come back "contradicted" must be reviewed and removed or
 * fixed by hand — the app never shows them as verified.
 */
import fs from "node:fs";
import { FB_PLAYER_SEASONS, fbSlug } from "../src/lib/data/football/players";
import { NBA_PLAYER_SEASONS } from "../src/lib/data/nba/players";
import { FRANCHISE_BY_ID } from "../src/lib/data/nba/franchises";

const sport = process.argv[2] === "nba" ? "nba" : "football";
const ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "LegendsLabVerifier/0.2 (personal non-commercial project)";

/** Main association-football club items on Wikidata (several where duplicates exist). */
const CLUB_QIDS: Record<string, string[]> = {
  MUN: ["Q18656"], LIV: ["Q1130849"], ARS: ["Q9617"], CHE: ["Q9616"], MCI: ["Q50602", "Q16844562"], TOT: ["Q18741"], NEW: ["Q18716"],
  RMA: ["Q8682"], BAR: ["Q7156"], ATM: ["Q8701"], VAL: ["Q10333"], MIL: ["Q1543"], INT: ["Q631"], JUV: ["Q1422"], NAP: ["Q2641"],
  FCB: ["Q15789"], BVB: ["Q41420"], B04: ["Q104761", "Q97905892"], PSG: ["Q483020"], OM: ["Q132885"], OL: ["Q704"], AJA: ["Q81888"],
  FCP: ["Q128446"], SLB: ["Q131499", "Q1573672", "Q3493861"],
};

interface Spell { team: string; teamLabel: string; start: string | null; sp: number; end: string | null; ep: number; apps: number | null; goals: number | null }
interface Person { qid: string; label: string; spells: Spell[] }

async function sparql(query: string, attempt = 0): Promise<any> {
  const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query)}`, { headers: { Accept: "application/sparql-results+json", "User-Agent": UA } });
  if ((res.status === 429 || res.status >= 500) && attempt < 4) { await new Promise((r) => setTimeout(r, 4000 * (attempt + 1))); return sparql(query, attempt + 1); }
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
  return res.json();
}

interface Member { qid: string; names: string[]; spell: Spell }

/** All people with a P54 statement for the given team items (labels + aliases + spell qualifiers). */
async function fetchMembers(teamFilter: string): Promise<Member[]> {
  const q = `SELECT ?p ?team ?teamLabel ?s ?sp ?e ?ep ?apps ?goals (GROUP_CONCAT(DISTINCT ?n; separator="|") AS ?names) WHERE {
    ${teamFilter}
    ?st ps:P54 ?team. ?p p:P54 ?st.
    { ?p rdfs:label ?n FILTER(LANG(?n) IN ("en","es","it","de","fr","pt","nl")) } UNION { ?p skos:altLabel ?n FILTER(LANG(?n) = "en") }
    OPTIONAL { ?st pq:P580 ?s. ?st pqv:P580 ?sv. ?sv wikibase:timePrecision ?sp }
    OPTIONAL { ?st pq:P582 ?e. ?st pqv:P582 ?ev. ?ev wikibase:timePrecision ?ep }
    OPTIONAL { ?st pq:P1350 ?apps } OPTIONAL { ?st pq:P1351 ?goals }
    ?team rdfs:label ?teamLabel FILTER(LANG(?teamLabel) = "en")
  } GROUP BY ?p ?team ?teamLabel ?s ?sp ?e ?ep ?apps ?goals`;
  const d = await sparql(q);
  return d.results.bindings.map((b: any) => ({
    qid: (b.p.value as string).split("/").pop()!,
    names: (b.names?.value ?? "").split("|").map((x: string) => fbSlug(x)).filter(Boolean),
    spell: {
      team: (b.team.value as string).split("/").pop()!, teamLabel: b.teamLabel.value,
      start: b.s?.value ?? null, sp: Number(b.sp?.value ?? 9), end: b.e?.value ?? null, ep: Number(b.ep?.value ?? 9),
      apps: b.apps ? Number(b.apps.value) : null, goals: b.goals ? Number(b.goals.value) : null,
    },
  }));
}

function nameMatches(rowName: string, names: string[]): boolean {
  const s = fbSlug(rowName);
  if (names.includes(s)) return true;
  const parts = s.split("-");
  if (parts.length === 1) return names.some((n) => n === s || n.split("-").includes(s));
  const last = parts[parts.length - 1], first = parts[0];
  return names.some((n) => { const np = n.split("-"); return np.includes(last) && np.some((x) => x.startsWith(first.slice(0, 3))); });
}

type Grade = "verified" | "probable" | "no";
/** Season y = Aug 1 y → Jun 30 y+1. Year-precision bounds on the boundary year are only "probable". */
function grade(sp: Spell, y: number): Grade {
  const yearOf = (iso: string) => Number(iso.replace(/^\+/, "").slice(0, 4));
  let startG: Grade = "verified", endG: Grade = "verified";
  if (sp.start) {
    if (sp.sp >= 10) { if (sp.start.replace(/^\+/, "").slice(0, 10) > `${y + 1}-06-30`) startG = "no"; }
    else { const s = yearOf(sp.start); startG = s <= y ? "verified" : s === y + 1 ? "probable" : "no"; }
  } else startG = "probable";
  if (sp.end) {
    if (sp.ep >= 10) { if (sp.end.replace(/^\+/, "").slice(0, 10) < `${y}-08-01`) endG = "no"; }
    else { const e = yearOf(sp.end); endG = e >= y + 1 ? "verified" : e === y ? "probable" : "no"; }
  }
  if (startG === "no" || endG === "no") return "no";
  return startG === "verified" && endG === "verified" ? "verified" : "probable";
}

async function main() {
  type Row = { id: string; name: string; y: number; group: string };
  let rows: Row[]; let groups: Record<string, string>;
  if (sport === "football") {
    rows = FB_PLAYER_SEASONS.map((p) => ({ id: p.id, name: p.name, y: p.startYear, group: p.clubId }));
    groups = Object.fromEntries(Object.entries(CLUB_QIDS).map(([k, q]) => [k, `VALUES ?team { ${q.map((x) => `wd:${x}`).join(" ")} }`]));
  } else {
    rows = NBA_PLAYER_SEASONS.filter((p) => p.startYear + 1 < 1977 || p.startYear + 1 > 2022).map((p) => ({ id: p.id, name: p.name, y: p.startYear, group: p.franchiseId }));
    groups = {};
    for (const id of new Set(rows.map((r) => r.group))) {
      const f = FRANCHISE_BY_ID[id];
      const labels = [...new Set([...f.names.map((n) => n.name), `${f.city} ${f.name}`])];
      groups[id] = `VALUES ?tl { ${labels.map((l) => `"${l}"@en`).join(" ")} } ?team rdfs:label ?tl; wdt:P118 wd:Q155223.`;
    }
  }
  const members: Record<string, Member[]> = {};
  for (const g of new Set(rows.map((r) => r.group))) {
    members[g] = await fetchMembers(groups[g]);
    process.stdout.write(`\r${g}: ${members[g].length} etapas          `);
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log();
  const out: Record<string, unknown> = {};
  const counts: Record<string, number> = {};
  const review: string[] = [];
  for (const r of rows) {
    const cands = members[r.group].filter((m) => nameMatches(r.name, m.names));
    let status = cands.length ? "contradicted" : "not-found";
    let best: Member | null = cands[0] ?? null;
    for (const m of cands) {
      const g = grade(m.spell, r.y);
      if (g === "verified") { status = "verified"; best = m; break; }
      if (g === "probable") { status = "probable"; best = m; }
    }
    counts[status] = (counts[status] ?? 0) + 1;
    if (status === "contradicted") review.push(`${r.id}  (Wikidata ${best!.qid}: ${best!.spell.teamLabel} ${best!.spell.start?.slice(0, 10) ?? "?"} → ${best!.spell.end?.slice(0, 10) ?? "…"})`);
    const cut = (iso: string | null, prec: number) => (iso ? iso.replace(/^\+/, "").slice(0, prec >= 10 ? 10 : 4) : null);
    out[r.id] = best && status !== "not-found"
      ? { status, qid: best.qid, spellStart: cut(best.spell.start, best.spell.sp), spellEnd: cut(best.spell.end, best.spell.ep), spellApps: best.spell.apps, spellGoals: best.spell.goals }
      : { status };
  }
  const file = `src/lib/data/verification/${sport}-wikidata.json`;
  fs.writeFileSync(file, JSON.stringify({ source: "Wikidata (CC0) — P54 member of sports team", generatedAt: new Date().toISOString().slice(0, 10), counts, rows: out }, ));
  console.log(counts);
  if (review.length) console.log("CONTRADICTED (revisar):\n  " + review.join("\n  "));
  const nf = rows.filter((r) => (out[r.id] as { status: string }).status === "not-found").map((r) => `${r.name} (${r.group})`);
  if (nf.length) console.log("Sin coincidencia en Wikidata:", [...new Set(nf)].join(", "));
}
main();
