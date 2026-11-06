/**
 * NBA 82-game season simulator.
 * Each game: margin ~ Normal(mu, sd), with
 *   mu = teamNet - (oppNet + difficultyBoost) ± homeCourt − fatigue
 * Scores are generated around a shared possession count. No result is fixed:
 * every game is an independent draw from a reproducible RNG.
 */
import { Rng } from "@/lib/core/rng";
import { DIFFICULTY_PARAMS, type Difficulty } from "@/lib/core/difficulty";
import { NBA_FRANCHISES, NBA_OPPONENT_STRENGTH } from "@/lib/data/nba/franchises";
import { evaluateNbaTeam, type NbaTeamEval } from "@/lib/ratings/nba";
import type { NbaCard, NbaGameResult, NbaPos, NbaSeasonResult } from "@/types/nba";

export const HOME_COURT = 1.6;

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
  // balance home/away to 41/41 (3-game series split 2/1 alternately)
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
  // ~14 back-to-backs, never game 1
  const b2b = new Set<number>();
  while (b2b.size < 14) b2b.add(1 + rng.int(81));
  return ordered.map((g, i) => ({ game: i + 1, opponent: g.opponent, home: g.home, backToBack: b2b.has(i) }));
}

export function gameExpectation(teamNet: number, opp: string, home: boolean, b2b: boolean, difficulty: Difficulty): number {
  const d = DIFFICULTY_PARAMS[difficulty];
  const oppNet = (NBA_OPPONENT_STRENGTH[opp]?.net ?? 0) + d.nbaOpponentBoost;
  return teamNet - oppNet + (home ? HOME_COURT : -HOME_COURT) - (b2b ? 1.5 * d.nbaFatigue : 0);
}

/** P(win) under the normal margin model. Abramowitz-Stegun erf. */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

export function simulateSeason(
  lineup: Partial<Record<NbaPos, NbaCard>>, difficulty: Difficulty, seed: string,
): { result: NbaSeasonResult; team: NbaTeamEval } {
  const d = DIFFICULTY_PARAMS[difficulty];
  const team = evaluateNbaTeam(lineup, d.nbaFitSensitivity);
  const rng = new Rng(`nba-season:${seed}`);
  const schedule = buildSchedule(rng);
  const games: NbaGameResult[] = [];
  // Season-level form: a small persistent random effect (health/luck).
  const seasonForm = rng.normal(0, 0.8);
  for (const g of schedule) {
    const mu = gameExpectation(team.net + seasonForm, g.opponent, g.home, g.backToBack, difficulty);
    const sd = d.nbaGameSd;
    const winProb = normCdf(mu / sd);
    let margin = rng.normal(mu, sd);
    const pace = ((NBA_OPPONENT_STRENGTH[g.opponent]?.pace ?? 99) + 99) / 2 + rng.normal(0, 2.5);
    const base = pace * 1.14;
    const total = base * 2 + rng.normal(0, 9);
    let teamScore = Math.round(total / 2 + margin / 2);
    let oppScore = Math.round(total / 2 - margin / 2);
    // Overtime(s) until decided — still probabilistic, weighted by mu.
    let ot = 0;
    while (teamScore === oppScore && ot < 4) {
      ot++;
      const otMargin = rng.normal(mu * 0.12, 4.5);
      const otTotal = Math.max(10, Math.round(22 + rng.normal(0, 3)));
      teamScore += Math.round(otTotal / 2 + otMargin / 2);
      oppScore += Math.round(otTotal / 2 - otMargin / 2);
    }
    if (teamScore === oppScore) teamScore += rng.next() < winProb ? 1 : -1;
    margin = teamScore - oppScore;
    games.push({
      game: g.game, opponent: g.opponent, home: g.home, backToBack: g.backToBack,
      teamScore, oppScore, win: teamScore > oppScore,
      expectedMargin: Math.round(mu * 10) / 10, winProb: Math.round(winProb * 1000) / 1000,
    });
  }
  const wins = games.filter((g) => g.win).length;
  let best = 0, cur = 0;
  for (const g of games) { cur = g.win ? cur + 1 : 0; best = Math.max(best, cur); }
  const avgMargin = games.reduce((s, g) => s + g.teamScore - g.oppScore, 0) / games.length;
  return {
    team,
    result: {
      seed, difficulty, wins, losses: games.length - wins, games, longestWinStreak: best,
      avgMargin: Math.round(avgMargin * 10) / 10, teamNet: team.net,
    },
  };
}

export interface MonteCarloSummary {
  runs: number; meanWins: number; minWins: number; maxWins: number; p10: number; p90: number;
  pOver70: number; pUndefeated: number; distribution: number[]; analyticUndefeated: number;
}

/** Repeat the season `runs` times with derived seeds; returns real simulated frequencies. */
export function monteCarlo(lineup: Partial<Record<NbaPos, NbaCard>>, difficulty: Difficulty, seed: string, runs = 1000): MonteCarloSummary {
  const dist = new Array(83).fill(0);
  const winsArr: number[] = [];
  let analyticLog = 0;
  for (let i = 0; i < runs; i++) {
    const { result } = simulateSeason(lineup, difficulty, `${seed}#mc${i}`);
    dist[result.wins]++;
    winsArr.push(result.wins);
    if (i === 0) analyticLog = result.games.reduce((s, g) => s + Math.log(Math.max(1e-12, g.winProb)), 0);
  }
  winsArr.sort((a, b) => a - b);
  const q = (p: number) => winsArr[Math.min(winsArr.length - 1, Math.floor(p * winsArr.length))];
  return {
    runs,
    meanWins: Math.round((winsArr.reduce((s, w) => s + w, 0) / runs) * 10) / 10,
    minWins: winsArr[0], maxWins: winsArr[winsArr.length - 1], p10: q(0.1), p90: q(0.9),
    pOver70: winsArr.filter((w) => w > 70).length / runs,
    pUndefeated: dist[82] / runs,
    distribution: dist,
    analyticUndefeated: Math.exp(analyticLog),
  };
}

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
  return out;
}
