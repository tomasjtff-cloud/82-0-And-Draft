/** Records, hall of fame and trophy room — all derived from the saved ledger (verifiable). */
import type { FbSeasonRec, NbaSeasonRec, Progress } from "./types";
import { ctxOf } from "./achievements";

export interface RecordRow { key: string; label: string; who: string; value: string; date: string; mode: string; difficulty: string; ref: string }
export interface Filters { mode?: "all" | "roulette" | "fut"; difficulty?: "all" | string }
const MODE_ES: Record<string, string> = { roulette: "Historical Roulette", fut: "FUT Draft", nba: "NBA 82-0" };
export const MIN_GP_RATING = 30; // minimum games for the best average rating record

export function filterFb(p: Progress, f: Filters = {}): FbSeasonRec[] {
  return ctxOf(p).fb.filter((s) => (!f.mode || f.mode === "all" || s.mode === f.mode) && (!f.difficulty || f.difficulty === "all" || s.difficulty === f.difficulty));
}

export function fbRecords(p: Progress, f: Filters = {}): RecordRow[] {
  const all = filterFb(p, f), full = all.filter((s) => !s.legacy);
  const out: RecordRow[] = [];
  const row = (key: string, label: string, s: FbSeasonRec | undefined, who: string, value: string) => { if (s) out.push({ key, label, who, value, date: s.date, mode: MODE_ES[s.mode] ?? s.mode, difficulty: s.difficulty, ref: s.id }); };
  const bestPlayer = (f: (pl: FbSeasonRec["players"][number]) => number, pool = full, filter: (pl: FbSeasonRec["players"][number]) => boolean = () => true) => {
    let best: { s: FbSeasonRec; pl: FbSeasonRec["players"][number]; v: number } | undefined;
    for (const s of pool) for (const pl of s.players) if (filter(pl) && (!best || f(pl) > best.v)) best = { s, pl, v: f(pl) };
    return best && best.v > 0 ? best : undefined;
  };
  const g = bestPlayer((x) => x.g); if (g) row("goals", "Más goles en una temporada", g.s, `${g.pl.name} · ${g.s.team.name}`, `${g.v} goles`);
  const a = bestPlayer((x) => x.a); if (a) row("assists", "Más asistencias", a.s, `${a.pl.name} · ${a.s.team.name}`, `${a.v} asistencias`);
  const u = bestPlayer((x) => x.ug); if (u) row("ucl", "Más goles en Champions", u.s, `${u.pl.name} · ${u.s.team.name}`, `${u.v} goles`);
  const cs = bestPlayer((x) => x.cs, full, (x) => x.pos === "GK"); if (cs) row("cs", "Más porterías a cero", cs.s, `${cs.pl.name} · ${cs.s.team.name}`, `${cs.v}`);
  const r = bestPlayer((x) => x.r, full, (x) => x.gp >= MIN_GP_RATING); if (r) row("rating", `Mejor nota media (mín. ${MIN_GP_RATING} PJ)`, r.s, `${r.pl.name} · ${r.s.team.name}`, r.v.toFixed(2).replace(".", ","));
  const top = <T,>(xs: T[], f: (x: T) => number) => [...xs].sort((x, y) => f(y) - f(x))[0];
  const pts = top(all, (s) => s.pl.pts); if (pts) row("pts", "Más puntos en Premier League", pts, pts.team.name, `${pts.pl.pts} pts`);
  const gd = top(full, (s) => s.pl.gf - s.pl.ga); if (gd) row("gd", "Mejor diferencia de goles (Premier)", gd, gd.team.name, `${gd.pl.gf - gd.pl.ga > 0 ? "+" : ""}${gd.pl.gf - gd.pl.ga}`);
  const tt = top(all, (s) => s.titles); if (tt && tt.titles > 0) row("titles", "Más títulos en una temporada", tt, tt.team.name, `${tt.titles}`);
  const q = all.filter((s) => s.titles === 4); if (q.length) row("quad", "Quadruples conseguidos", q[0], q.map((s) => s.team.name).slice(0, 3).join(", "), `${q.length}`);
  const perf = top(all, perfScore); if (perf) row("perf", "Mejor XI por rendimiento", perf, `${perf.team.name} · ${perf.team.formationId}`, `${perfScore(perf)} pts de rendimiento`);
  const ovr = top(all, (s) => s.team.ovr); if (ovr) row("ovr", "Mejor XI por media (OVR)", ovr, `${ovr.team.name} · ${ovr.team.formationId}`, `${ovr.team.ovr}`);
  return out;
}
/** "Rendimiento" = Premier League points + 10 per title (documented, simple and verifiable). */
export const perfScore = (s: FbSeasonRec) => s.pl.pts + 10 * s.titles;

export function hallOfFame(p: Progress, f: Filters = {}) {
  const fb = filterFb(p, f);
  const nba = ctxOf(p).nba.filter((s) => !f.difficulty || f.difficulty === "all" || s.difficulty === f.difficulty);
  const titles = (k: keyof FbSeasonRec["won"]) => fb.filter((s) => s.won[k]).length;
  const players = new Map<string, { name: string; titles: number; seasons: number; goals: number }>();
  for (const s of fb) for (const pl of s.players) { const x = players.get(pl.id) ?? { name: pl.name, titles: 0, seasons: 0, goals: 0 }; x.titles += s.titles; x.seasons++; x.goals += pl.g; players.set(pl.id, x); }
  return {
    fbSeasons: fb.length, nbaSeasons: nba.length, PL: titles("PL"), UCL: titles("UCL"), FA: titles("FA"), EFL: titles("EFL"), quadruples: fb.filter((s) => s.titles === 4).length,
    rings: nba.filter((s) => s.champion).length, perfect: nba.filter((s) => s.wins === 82).length,
    topPlayers: [...players.values()].filter((x) => x.titles > 0).sort((a, b) => b.titles - a.titles || b.goals - a.goals).slice(0, 5),
    bestTeams: [...fb].sort((a, b) => perfScore(b) - perfScore(a)).slice(0, 5),
    bestNba: [...nba].sort((a, b) => b.wins - a.wins || Number(b.champion) - Number(a.champion)).slice(0, 3),
  };
}

export type TrophyKey = "nba" | "PL" | "UCL" | "FA" | "EFL" | "ballon" | "boot" | "glove";
export interface TrophyWin { date: string; team: string; detail: string; ref: string; key: string }
export function trophyRoom(p: Progress): Record<TrophyKey, TrophyWin[]> {
  const c = ctxOf(p);
  const fbWin = (k: "PL" | "UCL" | "FA" | "EFL") => c.fb.filter((s) => s.won[k]).map((s) => ({ date: s.date, team: s.team.name, detail: s.legacy ? `${s.pl.pos}º en Premier · ${s.pl.pts} pts` : `${s.pl.pos}º · ${s.pl.pts} pts · goleador: ${top(s)}`, ref: s.id, key: s.id }));
  const award = (k: "ballon" | "boot" | "glove") => c.fb.filter((s) => s.awards[k]).map((s) => ({ date: s.date, team: s.team.name, detail: `${s.awards[k]!.name} · ${s.awards[k]!.stat}`, ref: s.id, key: s.id }));
  return {
    nba: c.nba.filter((s: NbaSeasonRec) => s.champion).map((s) => ({ date: s.date, team: s.teamName, detail: `${s.wins}-${s.losses}${s.awards.finalsMvp ? ` · MVP de las Finals: ${s.awards.finalsMvp.name}` : ""}`, ref: s.id, key: s.id })),
    PL: fbWin("PL"), UCL: fbWin("UCL"), FA: fbWin("FA"), EFL: fbWin("EFL"), ballon: award("ballon"), boot: award("boot"), glove: award("glove"),
  };
}
const top = (s: FbSeasonRec) => { const t = [...s.players].sort((a, b) => b.g - a.g)[0]; return t ? `${t.name} (${t.g})` : "—"; };
