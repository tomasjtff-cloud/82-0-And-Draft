/**
 * Football season engine (step-based, serializable, deterministic per seed).
 * Competitions: Premier League (20/38/380), UEFA Champions League (36-team
 * league phase + playoffs + KO), FA Cup (from R3, no replays, ET + pens),
 * Carabao Cup (R2→Final, pens without ET until SF; two-legged SF; final ET+pens).
 */
import { Rng, type RngState } from "@/lib/core/rng";
import { DIFFICULTY_PARAMS, type Difficulty } from "@/lib/core/difficulty";
import { EFL_CLUBS, EURO_CLUBS, FANTASY_ID, PL_CLUBS } from "@/lib/data/football/world";
import type { CompId, Match, SimTeam, StandingRow, Tie } from "@/types/football";
import { buildCalendar, type SeasonEvent } from "./calendar";
import { roundRobin, sortPremierLeague, sortUclLeague, standings } from "./league";
import { drawLeaguePhase, makePots, type LeagueFixture } from "./ucl-draw";
import { decidedWinner, playMatch, type Decider, type Side } from "./match";

export interface UserTeamInput { clubId: string; name: string; rating: number; att: number; def: number; replacedClubId?: string }

export interface SeasonState {
  version: 1;
  seed: string;
  difficulty: Difficulty;
  userId: string;
  notes: string[];
  teams: Record<string, SimTeam>;
  plTeams: string[];
  uclTeams: string[];
  uclPots: string[][];
  faTeams: string[];
  eflR2Teams: string[];
  eflEuro: string[];
  plFixtures: { round: number; home: string; away: string }[];
  uclFixtures: LeagueFixture[];
  events: SeasonEvent[];
  cursor: number;
  matches: Match[];
  ties: Tie[];
  alive: { FA: string[]; EFL: string[] };
  uclRanking: string[] | null;
  uclBracket: string[] | null; // R16 tie ids in bracket order
  lastPlayed: Record<string, string[]>;
  rng: RngState;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

export function createSeason(seed: string, difficulty: Difficulty, user: UserTeamInput): SeasonState {
  const rng = new Rng(`fb-season:${seed}`);
  const d = DIFFICULTY_PARAMS[difficulty];
  const notes: string[] = [];
  const teams: Record<string, SimTeam> = {};
  const boost = (t: SimTeam): SimTeam => ({ ...t, att: t.att + d.fbRivalBoost, def: t.def + d.fbRivalBoost, rating: t.rating + d.fbRivalBoost });
  for (const t of [...PL_CLUBS, ...EURO_CLUBS, ...EFL_CLUBS]) teams[t.id] = boost(t);

  // ── user team: replaces its real club, or Fantasy FC replaces a chosen PL club
  let plTeams = PL_CLUBS.map((t) => t.id);
  let userId = user.clubId;
  if (user.clubId === FANTASY_ID) {
    const replaced = user.replacedClubId && plTeams.includes(user.replacedClubId) ? user.replacedClubId : [...PL_CLUBS].sort((a, b) => a.rating - b.rating)[0].id;
    plTeams = plTeams.map((id) => (id === replaced ? FANTASY_ID : id));
    notes.push(`Regla fantástica: Fantasy FC ocupa la plaza de ${teams[replaced].name} en la Premier League (siguen siendo 20 clubes).`);
    delete teams[replaced];
    userId = FANTASY_ID;
  }
  const base = PL_CLUBS.find((t) => t.id === user.clubId);
  teams[userId] = { id: userId, name: user.name, short: base?.short ?? "FAN", country: "ENG", rating: user.rating, att: user.att, def: user.def, isUser: true, tier: "PL" };

  // ── UCL: top-5 English clubs by strength + 31 European clubs = 36
  const englishByRating = plTeams.filter((id) => id !== userId).sort((a, b) => teams[b].rating - teams[a].rating);
  let english = englishByRating.slice(0, 5);
  if (!english.includes(userId)) {
    const dropped = english[english.length - 1];
    english = [...english.slice(0, 4), userId];
    notes.push(`Regla fantástica: tu equipo entra en la Champions League ocupando la plaza inglesa de ${teams[dropped].name}.`);
  }
  const uclTeams = [...english, ...EURO_CLUBS.map((t) => t.id)];
  const uclFixtures = drawLeaguePhase(uclTeams.map((id) => teams[id]), rng);
  const uclPots = makePots(uclTeams.map((id) => teams[id]));

  // ── Carabao: 9 PL clubs "in Europe" enter at R3 (UCL English entrants + next 4)
  const others = plTeams.filter((id) => !english.includes(id)).sort((a, b) => teams[b].rating - teams[a].rating);
  const eflEuro = [...english, ...others.slice(0, 4)];
  const eflR2Pl = others.slice(4); // 11
  const eflPool = rng.shuffle(EFL_CLUBS.map((t) => t.id)).slice(0, 46 - eflR2Pl.length);
  const eflR2Teams = [...eflR2Pl, ...eflPool];

  // ── FA Cup R3: 20 PL + 44 EFL = 64
  const faTeams = [...plTeams, ...EFL_CLUBS.map((t) => t.id)];
  if (faTeams.length !== 64) throw new Error("FA Cup R3 must have 64 clubs");

  return {
    version: 1, seed, difficulty, userId, notes, teams, plTeams, uclTeams, uclPots, faTeams, eflR2Teams, eflEuro,
    plFixtures: roundRobin(plTeams, rng), uclFixtures, events: buildCalendar(), cursor: 0, matches: [], ties: [],
    alive: { FA: [...faTeams], EFL: [] }, uclRanking: null, uclBracket: null, lastPlayed: {}, rng: rng.state(),
  };
}

/* ───────── helpers ───────── */

function side(s: SeasonState, id: string, date: string): Side {
  const t = s.teams[id];
  const d = DIFFICULTY_PARAMS[s.difficulty];
  const recent = (s.lastPlayed[id] ?? []).filter((x) => daysBetween(x, date) <= 6).length;
  const factor = t.isUser ? d.fbFatigue : 0.6;
  const fatigue = Math.max(0, recent - 1) * 1.5 * factor + (recent >= 1 && (s.lastPlayed[id] ?? []).some((x) => daysBetween(x, date) <= 3) ? 0.8 * factor : 0);
  return { id, att: t.att - fatigue, def: t.def - fatigue };
}
function record(s: SeasonState, m: Match) {
  s.matches.push(m);
  for (const id of [m.home, m.away]) (s.lastPlayed[id] ??= []).push(m.date), (s.lastPlayed[id] = s.lastPlayed[id].slice(-4));
}
function play(s: SeasonState, rng: Rng, home: string, away: string, ev: SeasonEvent, decider: Decider, extra: Partial<Match> & { aggregateBefore?: { home: number; away: number } } = {}): Match {
  const m = playMatch(rng, side(s, home, ev.date), side(s, away, ev.date), {
    id: `${ev.id}-${home}-${away}`, comp: ev.comp, stage: ev.stage, date: ev.date, decider,
    neutral: extra.neutral, aggregateBefore: extra.aggregateBefore, tieId: extra.tieId, leg: extra.leg,
  });
  record(s, m);
  return m;
}
function singleTie(s: SeasonState, rng: Rng, ev: SeasonEvent, a: string, b: string, decider: Decider, neutral = false): string {
  const tieId = `${ev.id}-T-${a}-${b}`;
  const m = play(s, rng, a, b, ev, decider, { neutral, tieId });
  const winner = decidedWinner(m);
  s.ties.push({ id: tieId, comp: ev.comp, stage: ev.stage, a, b, legs: [m.id], winner, twoLegged: false });
  return winner;
}
function drawPairs(rng: Rng, ids: string[]): [string, string][] {
  const sh = rng.shuffle(ids);
  const out: [string, string][] = [];
  for (let i = 0; i + 1 < sh.length; i += 2) out.push([sh[i], sh[i + 1]]);
  return out;
}
/** First leg of a two-legged tie: `first` hosts leg 1, `second` hosts leg 2. */
function firstLeg(s: SeasonState, rng: Rng, ev: SeasonEvent, first: string, second: string, stageKey: string) {
  const tieId = `${ev.comp}-${stageKey}-${first}-${second}`;
  const m = play(s, rng, first, second, ev, "none", { tieId, leg: 1 });
  s.ties.push({ id: tieId, comp: ev.comp, stage: stageKey, a: first, b: second, legs: [m.id], winner: null, twoLegged: true });
}
function secondLegs(s: SeasonState, rng: Rng, ev: SeasonEvent, stageKey: string, decider: Decider) {
  for (const tie of s.ties.filter((t) => t.comp === ev.comp && t.stage === stageKey && !t.winner)) {
    const l1 = s.matches.find((m) => m.id === tie.legs[0])!;
    // leg 2: tie.b hosts; aggregate from b's perspective
    const agg = { home: l1.ag, away: l1.hg };
    const m = play(s, rng, tie.b, tie.a, ev, decider, { tieId: tie.id, leg: 2, aggregateBefore: agg });
    tie.legs.push(m.id);
    tie.winner = decidedWinner(m, agg);
  }
}
const winnersOf = (s: SeasonState, comp: CompId, stage: string) => s.ties.filter((t) => t.comp === comp && t.stage === stage).map((t) => t.winner!);

export function uclTable(s: SeasonState): StandingRow[] {
  const ms = s.matches.filter((m) => m.comp === "UCL" && m.stage.startsWith("MD"));
  return sortUclLeague(standings(s.uclTeams, ms), s.teams);
}
export function plTable(s: SeasonState): StandingRow[] {
  const ms = s.matches.filter((m) => m.comp === "PL");
  return sortPremierLeague(standings(s.plTeams, ms), ms, new Rng(`pl-lots:${s.seed}`));
}

/* ───────── event processing ───────── */

function processEvent(s: SeasonState, ev: SeasonEvent, rng: Rng) {
  if (ev.comp === "PL") {
    const round = Number(ev.stage.slice(1));
    for (const f of s.plFixtures.filter((x) => x.round === round)) play(s, rng, f.home, f.away, ev, "none");
    return;
  }
  if (ev.comp === "UCL") {
    if (ev.stage.startsWith("MD")) {
      const md = Number(ev.stage.slice(2));
      for (const f of s.uclFixtures.filter((x) => x.md === md)) play(s, rng, f.home, f.away, ev, "none");
      if (md === 8) s.uclRanking = uclTable(s).map((r) => r.team);
      return;
    }
    const rank = s.uclRanking!;
    const pos = (id: string) => rank.indexOf(id) + 1;
    if (ev.stage === "PO-1") {
      // 9/10 v 23/24, 11/12 v 21/22, 13/14 v 19/20, 15/16 v 17/18 — seeded team hosts leg 2
      for (const [s1, s2] of [[9, 23], [11, 21], [13, 19], [15, 17]]) {
        const seeded = rng.shuffle([rank[s1 - 1], rank[s1]]);
        const unseeded = rng.shuffle([rank[s2 - 1], rank[s2]]);
        for (let k = 0; k < 2; k++) firstLeg(s, rng, ev, unseeded[k], seeded[k], "PO");
      }
      return;
    }
    if (ev.stage === "PO-2") { secondLegs(s, rng, ev, "PO", "et+pens"); return; }
    if (ev.stage === "R16-1") {
      // Seeds 1/2 meet winners of 15/16–17/18 ties, 3/4 → 13/14–19/20, 5/6 → 11/12–21/22, 7/8 → 9/10–23/24.
      const poTies = s.ties.filter((t) => t.comp === "UCL" && t.stage === "PO");
      const tieFor = (seed: number) => poTies.find((t) => pos(t.b) === seed)!;
      const groups: [number, number, number, number][] = [[1, 2, 15, 16], [3, 4, 13, 14], [5, 6, 11, 12], [7, 8, 9, 10]];
      const halfA: string[] = [], halfB: string[] = [];
      for (const [t1, t2, p1, p2] of groups) {
        const tops = rng.shuffle([rank[t1 - 1], rank[t2 - 1]]);
        const opps = rng.shuffle([tieFor(p1).winner!, tieFor(p2).winner!]);
        const ids = tops.map((top, k) => { firstLeg(s, rng, ev, opps[k], top, "R16"); return `UCL-R16-${opps[k]}-${top}`; });
        halfA.push(ids[0]); halfB.push(ids[1]);
      }
      // bracket order within each half: [1/2, 7/8, 3/4, 5/6]
      const order = (h: string[]) => [h[0], h[3], h[1], h[2]];
      s.uclBracket = [...order(halfA), ...order(halfB)];
      return;
    }
    if (ev.stage === "R16-2") { secondLegs(s, rng, ev, "R16", "et+pens"); return; }
    const koNext = (from: string, to: string) => {
      const prev = from === "R16" ? s.uclBracket!.map((id) => s.ties.find((t) => t.id === id)!) : s.ties.filter((t) => t.comp === "UCL" && t.stage === from);
      for (let i = 0; i + 1 < prev.length; i += 2) {
        const a = prev[i].winner!, b = prev[i + 1].winner!;
        // better league-phase ranking hosts the second leg
        const [first, second] = pos(a) < pos(b) ? [b, a] : [a, b];
        firstLeg(s, rng, ev, first, second, to);
      }
    };
    if (ev.stage === "QF-1") { koNext("R16", "QF"); return; }
    if (ev.stage === "QF-2") { secondLegs(s, rng, ev, "QF", "et+pens"); return; }
    if (ev.stage === "SF-1") { koNext("QF", "SF"); return; }
    if (ev.stage === "SF-2") { secondLegs(s, rng, ev, "SF", "et+pens"); return; }
    if (ev.stage === "F") {
      const [a, b] = winnersOf(s, "UCL", "SF");
      singleTie(s, rng, ev, a, b, "et+pens", true);
      return;
    }
  }
  if (ev.comp === "EFL") {
    if (ev.stage === "R2") {
      const winners = drawPairs(rng, s.eflR2Teams).map(([a, b]) => singleTie(s, rng, ev, a, b, "pens"));
      s.alive.EFL = [...winners, ...s.eflEuro];
      return;
    }
    if (["R3", "R4", "QF"].includes(ev.stage)) {
      s.alive.EFL = drawPairs(rng, s.alive.EFL).map(([a, b]) => singleTie(s, rng, ev, a, b, "pens"));
      return;
    }
    if (ev.stage === "SF-1") { for (const [a, b] of drawPairs(rng, s.alive.EFL)) firstLeg(s, rng, ev, a, b, "SF"); return; }
    if (ev.stage === "SF-2") { secondLegs(s, rng, ev, "SF", "et+pens"); s.alive.EFL = winnersOf(s, "EFL", "SF"); return; }
    if (ev.stage === "F") { const [a, b] = s.alive.EFL; s.alive.EFL = [singleTie(s, rng, ev, a, b, "et+pens", true)]; return; }
  }
  if (ev.comp === "FA") {
    const neutral = ev.stage === "SF" || ev.stage === "F";
    s.alive.FA = drawPairs(rng, s.alive.FA).map(([a, b]) => singleTie(s, rng, ev, a, b, "et+pens", neutral));
  }
}

/** Process the next calendar event. Returns false when the season is over. */
export function stepSeason(state: SeasonState): { state: SeasonState; event: SeasonEvent | null } {
  if (state.cursor >= state.events.length) return { state, event: null };
  const s: SeasonState = structuredClone(state);
  const rng = Rng.fromState(s.rng);
  const ev = s.events[s.cursor];
  processEvent(s, ev, rng);
  s.cursor++;
  s.rng = rng.state();
  return { state: s, event: ev };
}

/** Advance until (and including) the next event in which the user's team plays. */
export function stepToNextUserMatch(state: SeasonState): SeasonState {
  let s = state;
  while (s.cursor < s.events.length) {
    const before = s.matches.length;
    s = stepSeason(s).state;
    if (s.matches.slice(before).some((m) => m.home === s.userId || m.away === s.userId)) break;
  }
  return s;
}

export function simulateRest(state: SeasonState): SeasonState {
  const s: SeasonState = structuredClone(state);
  const rng = Rng.fromState(s.rng);
  while (s.cursor < s.events.length) { processEvent(s, s.events[s.cursor], rng); s.cursor++; }
  s.rng = rng.state();
  return s;
}

export const isSeasonDone = (s: SeasonState) => s.cursor >= s.events.length;

/* ───────── summary ───────── */

export type TrophyStatus = "won" | "runner-up" | "eliminated" | "not-qualified" | "in-progress";
export interface TrophyResult { comp: CompId; status: TrophyStatus; detail: string; champion: string | null }

const STAGE_ES: Record<string, string> = {
  R2: "Segunda ronda", R3: "Tercera ronda", R4: "Cuarta ronda", R5: "Quinta ronda", QF: "Cuartos de final", SF: "Semifinales",
  F: "Final", PO: "Playoffs", R16: "Octavos de final", LEAGUE: "Fase liga",
};

function cupResult(s: SeasonState, comp: CompId, stages: string[]): TrophyResult {
  const u = s.userId;
  const userTies = s.ties.filter((t) => t.comp === comp && (t.a === u || t.b === u));
  const finalTie = s.ties.find((t) => t.comp === comp && t.stage === "F");
  const champion = finalTie?.winner ?? null;
  if (!userTies.length) {
    const entered = comp === "UCL" ? s.uclTeams.includes(u) : true;
    if (!entered) return { comp, status: "not-qualified", detail: "No clasificado", champion };
    if (comp === "UCL") {
      if (!s.uclRanking) return { comp, status: "in-progress", detail: "Fase liga en curso", champion };
      const p = s.uclRanking.indexOf(u) + 1;
      return { comp, status: p <= 24 ? "in-progress" : "eliminated", detail: p <= 24 ? `Fase liga: ${p}º` : `Eliminado en fase liga (${p}º)`, champion };
    }
    return { comp, status: "in-progress", detail: "Aún no ha debutado", champion };
  }
  const last = userTies.sort((a, b) => stages.indexOf(b.stage) - stages.indexOf(a.stage))[0];
  if (!last.winner) return { comp, status: "in-progress", detail: `En juego: ${STAGE_ES[last.stage] ?? last.stage}`, champion };
  if (last.stage === "F") return last.winner === u ? { comp, status: "won", detail: "Campeón", champion } : { comp, status: "runner-up", detail: "Subcampeón", champion };
  if (last.winner === u) {
    const done = isSeasonDone(s);
    return { comp, status: done ? "eliminated" : "in-progress", detail: done ? `Superó ${STAGE_ES[last.stage] ?? last.stage}` : `Clasificado tras ${STAGE_ES[last.stage] ?? last.stage}`, champion };
  }
  return { comp, status: "eliminated", detail: `Eliminado en ${STAGE_ES[last.stage] ?? last.stage}`, champion };
}

export function summarize(s: SeasonState): { trophies: TrophyResult[]; plPosition: number; narrative: string[]; quadruple: boolean } {
  const table = plTable(s);
  const plPos = table.findIndex((r) => r.team === s.userId) + 1;
  const done = isSeasonDone(s);
  const plChampion = done ? table[0].team : null;
  const pl: TrophyResult = !done
    ? { comp: "PL", status: "in-progress", detail: `${plPos}º provisional`, champion: null }
    : plPos === 1 ? { comp: "PL", status: "won", detail: "Campeón", champion: plChampion }
      : plPos === 2 ? { comp: "PL", status: "runner-up", detail: "Subcampeón", champion: plChampion }
        : { comp: "PL", status: "eliminated", detail: `${plPos}º puesto`, champion: plChampion };
  const ucl = cupResult(s, "UCL", ["PO", "R16", "QF", "SF", "F"]);
  const fa = cupResult(s, "FA", ["R3", "R4", "R5", "QF", "SF", "F"]);
  const efl = cupResult(s, "EFL", ["R2", "R3", "R4", "QF", "SF", "F"]);
  const trophies = [pl, ucl, fa, efl];
  const won = trophies.filter((t) => t.status === "won").length;
  const userRow = table.find((r) => r.team === s.userId)!;
  const narrative: string[] = [];
  narrative.push(`Premier League: ${pl.detail} con ${userRow.pts} puntos (${userRow.w}V ${userRow.d}E ${userRow.l}D, ${userRow.gf}-${userRow.ga}).`);
  narrative.push(`Champions League: ${ucl.detail}.`);
  narrative.push(`FA Cup: ${fa.detail}.`);
  narrative.push(`Carabao Cup: ${efl.detail}.`);
  if (done) {
    const names = (id: string | null) => (id ? s.teams[id]?.name ?? id : "—");
    narrative.push(`Campeones: PL ${names(pl.champion)}, UCL ${names(ucl.champion)}, FA Cup ${names(fa.champion)}, Carabao ${names(efl.champion)}.`);
    narrative.push(won === 4 ? "THE QUADRUPLE. Temporada perfecta." : won === 3 ? "Un triplete histórico." : won === 2 ? "Doblete." : won === 1 ? "Un título para la vitrina." : "Temporada sin títulos.");
  }
  return { trophies, plPosition: plPos, narrative, quadruple: done && won === 4 };
}

/** Upcoming user fixture if already known (league fixtures and drawn cup ties). */
export function nextUserFixture(s: SeasonState): { date: string; comp: CompId; label: string; opponent: string | null; home: boolean | null } | null {
  for (let i = s.cursor; i < s.events.length; i++) {
    const ev = s.events[i];
    if (ev.comp === "PL") {
      const f = s.plFixtures.find((x) => x.round === Number(ev.stage.slice(1)) && (x.home === s.userId || x.away === s.userId));
      if (f) return { date: ev.date, comp: "PL", label: ev.label, opponent: f.home === s.userId ? f.away : f.home, home: f.home === s.userId };
    } else if (ev.comp === "UCL" && ev.stage.startsWith("MD")) {
      const f = s.uclFixtures.find((x) => x.md === Number(ev.stage.slice(2)) && (x.home === s.userId || x.away === s.userId));
      if (f) return { date: ev.date, comp: "UCL", label: ev.label, opponent: f.home === s.userId ? f.away : f.home, home: f.home === s.userId };
    } else {
      // cup: is user still alive / involved?
      const alive = ev.comp === "FA" ? s.alive.FA.includes(s.userId) : ev.comp === "EFL" ? (ev.stage === "R2" ? s.eflR2Teams.includes(s.userId) : s.alive.EFL.includes(s.userId) || (ev.stage === "R3" && s.eflEuro.includes(s.userId))) : null;
      const pendingLeg = s.ties.find((t) => t.comp === ev.comp && t.twoLegged && !t.winner && (t.a === s.userId || t.b === s.userId) && ev.stage.endsWith("-2"));
      if (pendingLeg) return { date: ev.date, comp: ev.comp, label: ev.label, opponent: pendingLeg.a === s.userId ? pendingLeg.b : pendingLeg.a, home: pendingLeg.b === s.userId };
      if (alive) return { date: ev.date, comp: ev.comp, label: ev.label, opponent: null, home: null };
      if (ev.comp === "UCL" && s.uclRanking) {
        const p = s.uclRanking.indexOf(s.userId) + 1;
        const stillIn = s.ties.filter((t) => t.comp === "UCL" && (t.a === s.userId || t.b === s.userId)).every((t) => !t.winner || t.winner === s.userId);
        if (p <= 24 && stillIn && !ev.stage.endsWith("-2")) return { date: ev.date, comp: "UCL", label: ev.label, opponent: null, home: null };
      }
    }
  }
  return null;
}
