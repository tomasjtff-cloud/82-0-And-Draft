import type { Rng } from "@/lib/core/rng";
import type { Match, StandingRow, SimTeam } from "@/types/football";

/** Double round-robin (circle method): 2·(n−1) rounds, every pair home & away. */
export function roundRobin(teamIds: string[], rng: Rng): { round: number; home: string; away: string }[] {
  const ids = rng.shuffle(teamIds);
  if (ids.length % 2) throw new Error("Even number of teams required");
  const n = ids.length, half = n / 2, firstLeg: { round: number; home: string; away: string }[] = [];
  const arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      const swap = (r + i) % 2 === 1 || (i === 0 && r % 2 === 1);
      firstLeg.push({ round: r + 1, home: swap ? b : a, away: swap ? a : b });
    }
    arr.splice(1, 0, arr.pop()!); // rotate all but first
  }
  const secondLeg = firstLeg.map((m) => ({ round: m.round + (n - 1), home: m.away, away: m.home }));
  return [...firstLeg, ...secondLeg];
}

export function standings(teamIds: string[], matches: Match[]): StandingRow[] {
  const rows = new Map<string, StandingRow>(teamIds.map((t) => [t, { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, awayGf: 0, awayW: 0, form: [] }]));
  const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date));
  for (const m of sorted) {
    const h = rows.get(m.home), a = rows.get(m.away);
    if (!h || !a) continue;
    h.p++; a.p++; h.gf += m.hg; h.ga += m.ag; a.gf += m.ag; a.ga += m.hg; a.awayGf! += m.ag;
    if (m.hg > m.ag) { h.w++; a.l++; h.pts += 3; h.form!.push("W"); a.form!.push("L"); }
    else if (m.hg < m.ag) { a.w++; h.l++; a.pts += 3; a.awayW! += 1; a.form!.push("W"); h.form!.push("L"); }
    else { h.d++; a.d++; h.pts++; a.pts++; h.form!.push("D"); a.form!.push("D"); }
  }
  for (const r of rows.values()) { r.gd = r.gf - r.ga; r.form = r.form!.slice(-5); }
  return [...rows.values()];
}

/** Premier League: points, GD, GF, then head-to-head points, H2H away goals, then lots (seeded). */
export function sortPremierLeague(rows: StandingRow[], matches: Match[], rng: Rng): StandingRow[] {
  const lots = new Map(rows.map((r) => [r.team, rng.next()]));
  const h2h = (a: string, b: string) => {
    let pa = 0, pb = 0, awayA = 0, awayB = 0;
    for (const m of matches) {
      if (m.home === a && m.away === b) { if (m.hg > m.ag) pa += 3; else if (m.hg < m.ag) pb += 3; else { pa++; pb++; } awayB += m.ag; }
      if (m.home === b && m.away === a) { if (m.hg > m.ag) pb += 3; else if (m.hg < m.ag) pa += 3; else { pa++; pb++; } awayA += m.ag; }
    }
    return pb - pa || awayB - awayA;
  };
  const out = [...rows].sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || h2h(x.team, y.team) || lots.get(x.team)! - lots.get(y.team)!);
  out.forEach((r, i) => (r.pos = i + 1));
  return out;
}

/** UCL league phase: points, GD, GF, away goals, wins, away wins, then coefficient proxy (rating). */
export function sortUclLeague(rows: StandingRow[], teams: Record<string, SimTeam>): StandingRow[] {
  const out = [...rows].sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || y.awayGf! - x.awayGf! || y.w - x.w || y.awayW! - x.awayW! || teams[y.team].rating - teams[x.team].rating || x.team.localeCompare(y.team));
  out.forEach((r, i) => (r.pos = i + 1));
  return out;
}
