/**
 * UEFA Champions League league-phase draw (36 teams, 4 pots of 9, 8 games):
 * each team meets 2 opponents from every pot (one home, one away), never a
 * club from its own country and at most 2 from any other country.
 * Matches are then distributed over 8 matchdays (one game per team per day).
 * Randomised constructive search with restarts — deterministic per RNG.
 */
import type { Rng } from "@/lib/core/rng";
import type { SimTeam } from "@/types/football";

export interface LeagueFixture { md: number; home: string; away: string }

export function makePots(teams: SimTeam[]): string[][] {
  const sorted = [...teams].sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id)).map((t) => t.id);
  return [0, 1, 2, 3].map((i) => sorted.slice(i * 9, i * 9 + 9));
}

export function drawLeaguePhase(teams: SimTeam[], rng: Rng): LeagueFixture[] {
  if (teams.length !== 36) throw new Error("UCL league phase requires 36 teams");
  const byId = Object.fromEntries(teams.map((t) => [t.id, t]));
  const pots = makePots(teams);
  for (let attempt = 0; attempt < 500; attempt++) {
    const edges: { home: string; away: string }[] = [];
    const opp = new Map<string, Set<string>>(teams.map((t) => [t.id, new Set()]));
    const cc = new Map<string, Map<string, number>>(teams.map((t) => [t.id, new Map()]));
    const okPair = (a: string, b: string, pending: [string, string][]) => {
      if (a === b || byId[a].country === byId[b].country || opp.get(a)!.has(b)) return false;
      const count = (x: string, country: string) => (cc.get(x)!.get(country) ?? 0) + pending.filter(([p, q]) => (p === x && byId[q].country === country) || (q === x && byId[p].country === country)).length;
      return count(a, byId[b].country) < 2 && count(b, byId[a].country) < 2 && !pending.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
    };
    const commit = (pairs: [string, string][]) => {
      for (const [h, a] of pairs) {
        edges.push({ home: h, away: a });
        opp.get(h)!.add(a); opp.get(a)!.add(h);
        cc.get(h)!.set(byId[a].country, (cc.get(h)!.get(byId[a].country) ?? 0) + 1);
        cc.get(a)!.set(byId[h].country, (cc.get(a)!.get(byId[h].country) ?? 0) + 1);
      }
    };
    let failed = false;
    for (let i = 0; i < 4 && !failed; i++) {
      for (let j = i; j < 4 && !failed; j++) {
        let done = false;
        for (let tries = 0; tries < 400 && !done; tries++) {
          const pending: [string, string][] = [];
          let bad = false;
          if (i === j) {
            const cyc = rng.shuffle(pots[i]);
            for (let k = 0; k < 9 && !bad; k++) {
              const h = cyc[k], a = cyc[(k + 1) % 9];
              if (!okPair(h, a, pending)) bad = true; else pending.push([h, a]);
            }
          } else {
            const sigma = rng.shuffle(pots[j]), tau = rng.shuffle(pots[j]);
            for (let k = 0; k < 9 && !bad; k++) {
              const x = pots[i][k];
              if (sigma[k] === tau[k]) { bad = true; break; }
              if (!okPair(x, sigma[k], pending)) { bad = true; break; }
              pending.push([x, sigma[k]]);
              if (!okPair(tau[k], x, pending)) { bad = true; break; }
              pending.push([tau[k], x]);
            }
          }
          if (!bad) { commit(pending); done = true; }
        }
        if (!done) failed = true;
      }
    }
    if (failed) continue;
    const md = assignMatchdays(edges, teams.map((t) => t.id), rng);
    if (md) return edges.map((e, i) => ({ ...e, md: md[i] }));
  }
  throw new Error("UCL draw failed");
}

/** Peel 8 perfect matchings (each = one matchday) with randomised DFS + restarts. */
function assignMatchdays(edges: { home: string; away: string }[], ids: string[], rng: Rng): number[] | null {
  for (let attempt = 0; attempt < 200; attempt++) {
    const md = new Array<number>(edges.length).fill(-1);
    let ok = true;
    for (let d = 1; d <= 8 && ok; d++) {
      const m = perfectMatching(edges, md, ids, rng);
      if (!m) { ok = false; break; }
      for (const e of m) md[e] = d;
    }
    if (ok) return md;
  }
  return null;
}

function perfectMatching(edges: { home: string; away: string }[], md: number[], ids: string[], rng: Rng): number[] | null {
  const adj = new Map<string, number[]>(ids.map((i) => [i, []]));
  edges.forEach((e, i) => { if (md[i] === -1) { adj.get(e.home)!.push(i); adj.get(e.away)!.push(i); } });
  const matched = new Set<string>();
  const chosen: number[] = [];
  let steps = 0;
  const other = (e: number, v: string) => (edges[e].home === v ? edges[e].away : edges[e].home);
  const dfs = (): boolean => {
    if (++steps > 20000) return false;
    if (matched.size === ids.length) return true;
    let best: string | null = null, bestOpts: number[] = [];
    for (const v of ids) {
      if (matched.has(v)) continue;
      const opts = adj.get(v)!.filter((e) => !matched.has(other(e, v)));
      if (best === null || opts.length < bestOpts.length) { best = v; bestOpts = opts; if (opts.length <= 1) break; }
    }
    if (!best || bestOpts.length === 0) return false;
    for (const e of rng.shuffle(bestOpts)) {
      const u = other(e, best);
      matched.add(best); matched.add(u); chosen.push(e);
      if (dfs()) return true;
      matched.delete(best); matched.delete(u); chosen.pop();
    }
    return false;
  };
  return dfs() ? chosen : null;
}
