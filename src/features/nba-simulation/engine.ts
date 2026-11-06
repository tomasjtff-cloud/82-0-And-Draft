/**
 * NBA season simulator (v2): 82-game regular season for the user, a full
 * 31-team league for standings, best-of-7 playoffs and simulated box scores.
 * Game model (all games, user or not): margin ~ Normal(μ, σ) with
 *   μ = netA − netB ± home court − fatigue,  σ by difficulty.
 * Nothing is precomputed: every game is a reproducible draw from the seed.
 */
import { Rng } from "@/lib/core/rng";
import { DIFFICULTY_PARAMS, type Difficulty } from "@/lib/core/difficulty";
import { NBA_FRANCHISES, NBA_OPPONENT_STRENGTH } from "@/lib/data/nba/franchises";
import { evaluateNbaTeam, type NbaTeamEval } from "@/lib/ratings/nba";
import type { NbaCard, NbaGameResult, NbaPos, NbaSeasonResult, PlayerTotals, PlayoffGame, PlayoffOutcome, PlayoffSeries, StandingEntry } from "@/types/nba";
import { NBA_POSITIONS } from "@/types/nba";
import { buildLeagueGames, USER_ID } from "./league";
import { accumulate, emptyTotals, generateBox, profiles, type PlayerProfile } from "./boxscore";

export const HOME_COURT = 1.6;
export { USER_ID };

export interface ScheduledGame { game: number; opponent: string; home: boolean; backToBack: boolean }

/** 82 games: 15 East teams ×2, 7 West teams ×4, 8 West teams ×3 (user placed in the West). */
export function buildSchedule(rng: Rng): ScheduledGame[] {
  const west = NBA_FRANCHISES.filter((f) => f.conference === "West").map((f) => f.id);
  const east = NBA_FRANCHISES.filter((f) => f.conference === "East").map((f) => f.id);
  const westShuffled = rng.shuffle(west);
  const list: { opponent: string; home: boolean }[] = [];
  for (const t of east) list.push({ opponent: t, home: true }, { opponent: t, home: false });
  westShuffled.forEach((t, i) => {
    const n = i < 7 ? 4 : 3;
    for (let k = 0; k < n; k++) list.push({ opponent: t, home: k % 2 === 0 });
  });
  let homes = list.filter((g) => g.home).length;
  for (const g of list) {
    if (homes <= 41) break;
    const sameOpp = list.filter((x) => x.opponent === g.opponent);
    if (sameOpp.length === 3 && g.home && sameOpp.filter((x) => x.home).length === 2) { g.home = false; homes--; }
  }
  for (const g of list) {
    if (homes >= 41) break;
    const sameOpp = list.filter((x) => x.opponent === g.opponent);
    if (sameOpp.length === 3 && !g.home && sameOpp.filter((x) => x.home).length === 1) { g.home = true; homes++; }
  }
  const ordered = rng.shuffle(list);
  const b2b = new Set<number>();
  while (b2b.size < 14) b2b.add(1 + rng.int(81));
  return ordered.map((g, i) => ({ game: i + 1, opponent: g.opponent, home: g.home, backToBack: b2b.has(i) }));
}

export function gameExpectation(teamNet: number, opp: string, home: boolean, b2b: boolean, difficulty: Difficulty): number {
  const d = DIFFICULTY_PARAMS[difficulty];
  const oppNet = (NBA_OPPONENT_STRENGTH[opp]?.net ?? 0) + d.nbaOpponentBoost;
  return teamNet - oppNet + (home ? HOME_COURT : -HOME_COURT) - (b2b ? 1.5 * d.nbaFatigue : 0);
}

/** P(win) under the normal margin model (Abramowitz–Stegun erf). */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

interface Played { home: number; away: number; overtimes: number; possessions: number }
/** One game: scores around a shared possession count; overtimes until decided. */
export function playGame(rng: Rng, mu: number, sd: number, pace: number): Played {
  const margin = rng.normal(mu, sd);
  const possessions = pace + rng.normal(0, 2.5);
  const total = possessions * 1.14 * 2 + rng.normal(0, 9);
  let home = Math.round(total / 2 + margin / 2), away = Math.round(total / 2 - margin / 2);
  let overtimes = 0;
  while (home === away && overtimes < 5) {
    overtimes++;
    const m = rng.normal(mu * 0.12, 4.5), t = Math.max(10, Math.round(22 + rng.normal(0, 3)));
    home += Math.round(t / 2 + m / 2); away += Math.round(t / 2 - m / 2);
  }
  if (home === away) home += rng.next() < normCdf(mu / sd) ? 1 : -1;
  return { home, away, overtimes, possessions };
}

export interface SimOptions { withBox?: boolean; withPlayoffs?: boolean }

export function simulateSeason(
  lineup: Partial<Record<NbaPos, NbaCard>>, difficulty: Difficulty, seed: string, opts: SimOptions = {},
): { result: NbaSeasonResult; team: NbaTeamEval } {
  const withBox = opts.withBox ?? true, withPlayoffs = opts.withPlayoffs ?? true;
  const d = DIFFICULTY_PARAMS[difficulty];
  const team = evaluateNbaTeam(lineup, d.nbaFitSensitivity);
  const rng = new Rng(`nba-season:${seed}`);
  const schedule = buildSchedule(rng);
  const seasonForm = rng.normal(0, 0.8);
  const prof = profiles(lineup);
  const regTotals = new Map<string, PlayerTotals>([...prof.map((p) => [p.key, emptyTotals(p.key, p.name)] as const), ["BENCH", emptyTotals("BENCH", "Suplentes")]]);

  // ── user regular season
  const games: NbaGameResult[] = [];
  const sd = d.nbaGameSd;
  for (const g of schedule) {
    const mu = gameExpectation(team.net + seasonForm, g.opponent, g.home, g.backToBack, difficulty);
    const pace = ((NBA_OPPONENT_STRENGTH[g.opponent]?.pace ?? 99) + 99) / 2;
    // the user's perspective: "home" = user's score
    const r = playGame(rng, mu, sd, pace);
    const teamScore = r.home, oppScore = r.away;
    const res: NbaGameResult = {
      game: g.game, opponent: g.opponent, home: g.home, backToBack: g.backToBack, teamScore, oppScore, win: teamScore > oppScore,
      expectedMargin: Math.round(mu * 10) / 10, winProb: Math.round(normCdf(mu / sd) * 1000) / 1000, overtimes: r.overtimes,
    };
    if (withBox && prof.length === 5) { res.box = generateBox(rng, prof, teamScore, r.possessions, r.overtimes, { b2b: g.backToBack, margin: teamScore - oppScore }); accumulate(regTotals, res.box); }
    games.push(res);
  }
  const wins = games.filter((g) => g.win).length;
  let best = 0, cur = 0;
  for (const g of games) { cur = g.win ? cur + 1 : 0; best = Math.max(best, cur); }
  const avgMargin = games.reduce((s, g) => s + g.teamScore - g.oppScore, 0) / games.length;
  const result: NbaSeasonResult = {
    seed, difficulty, wins, losses: games.length - wins, games, longestWinStreak: best,
    avgMargin: Math.round(avgMargin * 10) / 10, teamNet: team.net,
  };
  if (!withPlayoffs) return { result, team };

  // ── rest of the league (separate RNG stream so the user's games are unchanged by it)
  const lrng = new Rng(`nba-league:${seed}`);
  const net = new Map<string, number>([[USER_ID, team.net + seasonForm]]);
  for (const f of NBA_FRANCHISES) net.set(f.id, (NBA_OPPONENT_STRENGTH[f.id]?.net ?? 0) + d.nbaOpponentBoost + lrng.normal(0, 1.5));
  const conf = new Map<string, "East" | "West">([[USER_ID, "West"], ...NBA_FRANCHISES.map((f) => [f.id, f.conference] as const)]);
  const rec = new Map<string, StandingEntry>([...conf].map(([t, c]) => [t, { team: t, conference: c, w: 0, l: 0, pf: 0, pa: 0 }]));
  const h2h = new Map<string, number>(); // "a|b" -> wins of a over b
  const record = (home: string, away: string, hs: number, as: number) => {
    const H = rec.get(home)!, A = rec.get(away)!;
    H.pf += hs; H.pa += as; A.pf += as; A.pa += hs;
    const [w, l] = hs > as ? [home, away] : [away, home];
    rec.get(w)!.w++; rec.get(l)!.l++;
    h2h.set(`${w}|${l}`, (h2h.get(`${w}|${l}`) ?? 0) + 1);
  };
  for (const g of games) g.home ? record(USER_ID, g.opponent, g.teamScore, g.oppScore) : record(g.opponent, USER_ID, g.oppScore, g.teamScore);
  for (const g of buildLeagueGames(lrng, schedule)) {
    const mu = net.get(g.home)! - net.get(g.away)! + HOME_COURT;
    const pace = ((NBA_OPPONENT_STRENGTH[g.home]?.pace ?? 99) + (NBA_OPPONENT_STRENGTH[g.away]?.pace ?? 99)) / 2;
    const r = playGame(lrng, mu, sd, pace);
    record(g.home, g.away, r.home, r.away);
  }
  const lots = new Map([...rec.keys()].map((t) => [t, lrng.next()]));
  const sortConf = (c: "East" | "West") => [...rec.values()].filter((r) => r.conference === c).sort((a, b) =>
    b.w - a.w || (h2h.get(`${b.team}|${a.team}`) ?? 0) - (h2h.get(`${a.team}|${b.team}`) ?? 0) || (b.pf - b.pa) - (a.pf - a.pa) || lots.get(a.team)! - lots.get(b.team)!);
  const east = sortConf("East"), west = sortConf("West");
  east.forEach((r, i) => (r.seed = i + 1)); west.forEach((r, i) => (r.seed = i + 1));
  result.standings = [...west, ...east].map((r) => ({ ...r }));

  // ── playoffs: top 8 per conference (no play-in), best of 7, 2-2-1-1-1
  const prng = new Rng(`nba-playoffs:${seed}`);
  const poTotals = new Map<string, PlayerTotals>([...prof.map((p) => [p.key, emptyTotals(p.key, p.name)] as const), ["BENCH", emptyTotals("BENCH", "Suplentes")]]);
  const seedOf = new Map<string, number>([...east, ...west].map((r) => [r.team, r.seed!]));
  const winPct = (t: string) => rec.get(t)!.w / 82;
  const series: PlayoffSeries[] = [];
  const playSeries = (a: string, b: string, round: 1 | 2 | 3 | 4, confName: PlayoffSeries["conference"]): string => {
    // home court: better seed within a conference; Finals → better record (lots on tie)
    const aHigh = round === 4 ? winPct(a) > winPct(b) || (winPct(a) === winPct(b) && lots.get(a)! < lots.get(b)!) : seedOf.get(a)! < seedOf.get(b)!;
    const high = aHigh ? a : b, low = aHigh ? b : a;
    const s: PlayoffSeries = { id: `${round}-${high}-${low}`, round, conference: confName, high, low, highSeed: seedOf.get(high)!, lowSeed: seedOf.get(low)!, winsHigh: 0, winsLow: 0, winner: "", games: [] };
    const homePattern = [true, true, false, false, true, false, true];
    for (let gi = 0; s.winsHigh < 4 && s.winsLow < 4; gi++) {
      const home = homePattern[gi] ? high : low, away = homePattern[gi] ? low : high;
      const mu = net.get(home)! - net.get(away)! + HOME_COURT;
      const pace = ((NBA_OPPONENT_STRENGTH[home]?.pace ?? 99) + (NBA_OPPONENT_STRENGTH[away]?.pace ?? 99)) / 2;
      const r = playGame(prng, mu, sd, pace);
      const pg: PlayoffGame = { game: gi + 1, home, away, homeScore: r.home, awayScore: r.away, overtimes: r.overtimes };
      if (withBox && prof.length === 5 && (home === USER_ID || away === USER_ID)) {
        const mine = home === USER_ID ? r.home : r.away, theirs = home === USER_ID ? r.away : r.home;
        pg.box = generateBox(prng, prof, mine, r.possessions, r.overtimes, { margin: mine - theirs, playoff: true });
        accumulate(poTotals, pg.box);
      }
      const winner = r.home > r.away ? home : away;
      if (winner === high) s.winsHigh++; else s.winsLow++;
      s.games.push(pg);
    }
    s.winner = s.winsHigh === 4 ? high : low;
    series.push(s);
    return s.winner;
  };
  const bracket = (rows: StandingEntry[], c: "East" | "West") => {
    const t = (seedN: number) => rows[seedN - 1].team;
    const r1 = [[1, 8], [4, 5], [2, 7], [3, 6]].map(([x, y]) => playSeries(t(x), t(y), 1, c));
    const r2 = [playSeries(r1[0], r1[1], 2, c), playSeries(r1[2], r1[3], 2, c)];
    return playSeries(r2[0], r2[1], 3, c);
  };
  const westChamp = bracket(west, "West"), eastChamp = bracket(east, "East");
  const champion = playSeries(westChamp, eastChamp, 4, "Finals");
  const userSeries = series.filter((s) => s.high === USER_ID || s.low === USER_ID);
  const lastUser = userSeries[userSeries.length - 1];
  const outcome: PlayoffOutcome = !lastUser ? "missed" : champion === USER_ID ? "champion"
    : (["first-round", "conf-semis", "conf-finals", "finals"] as PlayoffOutcome[])[lastUser.round - 1];
  result.playoffs = { series, outcome, champion, userSeed: (seedOf.get(USER_ID) ?? 99) <= 8 ? seedOf.get(USER_ID)! : null };
  if (withBox && prof.length === 5) result.stats = { regular: [...regTotals.values()], playoffs: [...poTotals.values()].filter((t) => t.gp > 0) };
  return { result, team };
}

export interface MonteCarloSummary {
  runs: number; meanWins: number; minWins: number; maxWins: number; p10: number; p90: number;
  pOver70: number; pUndefeated: number; distribution: number[]; analyticUndefeated: number;
  pPlayoffs: number; pFinals: number; pChampion: number;
}

/** Repeat the season `runs` times with derived seeds; returns real simulated frequencies. */
export function monteCarlo(lineup: Partial<Record<NbaPos, NbaCard>>, difficulty: Difficulty, seed: string, runs = 1000): MonteCarloSummary {
  const dist = new Array(83).fill(0);
  const winsArr: number[] = [];
  let analyticLog = 0, po = 0, fin = 0, champ = 0;
  for (let i = 0; i < runs; i++) {
    const { result } = simulateSeason(lineup, difficulty, `${seed}#mc${i}`, { withBox: false, withPlayoffs: true });
    dist[result.wins]++;
    winsArr.push(result.wins);
    const o = result.playoffs!.outcome;
    if (o !== "missed") po++;
    if (o === "finals" || o === "champion") fin++;
    if (o === "champion") champ++;
    if (i === 0) analyticLog = result.games.reduce((s, g) => s + Math.log(Math.max(1e-12, g.winProb)), 0);
  }
  winsArr.sort((a, b) => a - b);
  const q = (p: number) => winsArr[Math.min(winsArr.length - 1, Math.floor(p * winsArr.length))];
  return {
    runs, meanWins: Math.round((winsArr.reduce((s, w) => s + w, 0) / runs) * 10) / 10,
    minWins: winsArr[0], maxWins: winsArr[winsArr.length - 1], p10: q(0.1), p90: q(0.9),
    pOver70: winsArr.filter((w) => w > 70).length / runs, pUndefeated: dist[82] / runs, distribution: dist,
    analyticUndefeated: Math.exp(analyticLog), pPlayoffs: po / runs, pFinals: fin / runs, pChampion: champ / runs,
  };
}

export const OUTCOME_LABEL: Record<PlayoffOutcome, string> = {
  missed: "Fuera de playoffs", "first-round": "Eliminado en primera ronda", "conf-semis": "Eliminado en semifinales de conferencia",
  "conf-finals": "Eliminado en finales de conferencia", finals: "Subcampeón (perdió las NBA Finals)", champion: "CAMPEÓN DE LA NBA",
};

export function seasonAnalysis(result: NbaSeasonResult, team: NbaTeamEval): string[] {
  const out: string[] = [];
  out.push(`Rating neto estimado del quinteto: ${team.net >= 0 ? "+" : ""}${team.net} puntos/100 posesiones frente a un equipo promedio.`);
  if (team.strengths.length) out.push(`Fortalezas: ${team.strengths.join(", ")}.`);
  if (team.weaknesses.length) out.push(`Debilidades: ${team.weaknesses.join(", ")}.`);
  out.push(...team.notes);
  const losses = result.games.filter((g) => !g.win);
  const upsetLosses = losses.filter((g) => g.winProb >= 0.8).length;
  if (upsetLosses) out.push(`${upsetLosses} derrota(s) llegaron en partidos donde eras claro favorito (≥80%): la varianza existe.`);
  const b2bLosses = losses.filter((g) => g.backToBack).length;
  if (b2bLosses) out.push(`${b2bLosses} derrota(s) en la segunda noche de un back-to-back.`);
  if (result.wins === 82) out.push("Temporada perfecta. Historia pura.");
  else if (result.wins >= 73) out.push("Ritmo de récord histórico.");
  if (result.playoffs) out.push(`Playoffs: ${OUTCOME_LABEL[result.playoffs.outcome]}${result.playoffs.userSeed ? ` (cabeza de serie nº ${result.playoffs.userSeed} del Oeste)` : ""}.`);
  return out;
}
export const STARTERS = NBA_POSITIONS;
export type { PlayerProfile };
