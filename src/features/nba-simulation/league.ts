/**
 * Full 31-team league for the NBA scenario: the 30 current franchises plus
 * the user's quintet ("YOU", placed in the West → 16 West / 15 East).
 * Every team plays exactly 82 games:
 *  - East: 2 vs each of the 16 West teams, 4 vs 8 East rivals, 3 vs 6 (circulant design).
 *  - West (non-user): 2 vs each East team, 3/4 vs the user (from the user schedule),
 *    and 3 or 4 vs the other 14 West teams so the total is exactly 82.
 * All games use the same normal-margin model as the user's games.
 */
import type { Rng } from "@/lib/core/rng";
import { NBA_FRANCHISES } from "@/lib/data/nba/franchises";
import type { ScheduledGame } from "./engine";

export const USER_ID = "YOU";
export interface LeagueGame { home: string; away: string }

function circulantThreeGamePairs(ids: string[]): Set<string> {
  const n = ids.length, s = new Set<string>();
  for (let i = 0; i < n; i++) for (const d of [1, 2, 3]) s.add([ids[i], ids[(i + d) % n]].sort().join("|"));
  return s;
}

/** Games between non-user teams (the user's 82 come from buildSchedule). */
export function buildLeagueGames(rng: Rng, userSchedule: ScheduledGame[]): LeagueGame[] {
  const east = rng.shuffle(NBA_FRANCHISES.filter((f) => f.conference === "East").map((f) => f.id));
  const west = rng.shuffle(NBA_FRANCHISES.filter((f) => f.conference === "West").map((f) => f.id));
  const games: LeagueGame[] = [];
  const add = (a: string, b: string, n: number) => {
    const firstHome = rng.next() < 0.5;
    for (let k = 0; k < n; k++) games.push((k % 2 === 0) === firstHome ? { home: a, away: b } : { home: b, away: a });
  };
  // Inter-conference: 2 games each (user's own East games are in the user schedule)
  for (const e of east) for (const w of west) add(e, w, 2);
  // East intra-conference: 3 games vs circulant neighbours (degree 6), 4 vs the rest
  const eThree = circulantThreeGamePairs(east);
  for (let i = 0; i < east.length; i++) for (let j = i + 1; j < east.length; j++) add(east[i], east[j], eThree.has([east[i], east[j]].sort().join("|")) ? 3 : 4);
  // West: user plays 4 vs some teams (u=4) and 3 vs others (u=3). Four-game degree must be 10-u.
  const vsUser = new Map<string, number>();
  for (const g of userSchedule) vsUser.set(g.opponent, (vsUser.get(g.opponent) ?? 0) + 1);
  // Four-game graph with prescribed degrees (6 if the user plays them 4 times, 7 if 3 times),
  // built by randomised Havel–Hakimi with restarts.
  const n = west.length;
  const target = new Map(west.map((t) => [t, 10 - (vsUser.get(t) ?? 3)]));
  let four: Set<string> | null = null;
  for (let attempt = 0; attempt < 500 && !four; attempt++) {
    const need = new Map(target);
    const edges = new Set<string>();
    let ok = true;
    while (ok) {
      const open = west.filter((t) => need.get(t)! > 0);
      if (!open.length) break;
      open.sort((x, y) => need.get(y)! - need.get(x)! || rng.next() - 0.5);
      const v = open[0];
      const cands = rng.shuffle(open.slice(1).filter((u) => !edges.has([u, v].sort().join("|")))).sort((x, y) => need.get(y)! - need.get(x)!);
      if (cands.length < need.get(v)!) { ok = false; break; }
      for (const u of cands.slice(0, need.get(v)!)) { edges.add([u, v].sort().join("|")); need.set(u, need.get(u)! - 1); }
      need.set(v, 0);
    }
    if (ok) four = edges;
  }
  if (!four) throw new Error("No se pudo construir el calendario de la Conferencia Oeste");
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) add(west[i], west[j], four!.has([west[i], west[j]].sort().join("|")) ? 4 : 3);
  return games;
}

export function gamesPerTeam(userSchedule: ScheduledGame[], league: LeagueGame[]): Map<string, number> {
  const m = new Map<string, number>([[USER_ID, userSchedule.length]]);
  for (const g of userSchedule) m.set(g.opponent, (m.get(g.opponent) ?? 0) + 1);
  for (const g of league) { m.set(g.home, (m.get(g.home) ?? 0) + 1); m.set(g.away, (m.get(g.away) ?? 0) + 1); }
  return m;
}
