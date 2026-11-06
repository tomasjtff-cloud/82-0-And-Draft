/** Builds compact ledger records from finished seasons (pure; no RNG, no side effects). */
import type { FbDraftState } from "@/types/football";
import type { NbaCard, NbaPos, NbaSeasonResult, PlayerTotals, BoxLine } from "@/types/nba";
import { plTable, summarize, type SeasonState } from "@/features/football-simulation/season";
import { aggregatePlayerStats, userMatches } from "@/features/football-simulation/player-stats";
import { seasonAwards } from "@/features/football-simulation/awards";
import { BENCH_KEY } from "@/features/football-simulation/events";
import { FB_CARD_BY_ID } from "@/features/football-draft/engine";
import { USER_ID } from "@/features/nba-simulation/league";
import type { NbaTeamEval } from "@/lib/ratings/nba";
import type { FbSeasonRec, NbaSeasonRec, AwardRef } from "./types";

const goals = (m: { home: string; hg: number; ag: number; et?: { hg: number; ag: number } | null }, u: string) =>
  m.home === u ? [m.hg + (m.et?.hg ?? 0), m.ag + (m.et?.ag ?? 0)] : [m.ag + (m.et?.ag ?? 0), m.hg + (m.et?.hg ?? 0)];

export function fbSeasonRecord(s: SeasonState, d: FbDraftState, ctx: { teamName: string; ovr: number; chem: number; date?: string }): FbSeasonRec {
  const row = plTable(s).find((r) => r.team === s.userId)!;
  const sum = summarize(s);
  const won = Object.fromEntries(sum.trophies.map((t) => [t.comp, t.status === "won"])) as FbSeasonRec["won"];
  const mine = userMatches(s);
  const plCs = mine.filter((m) => m.comp === "PL" && goals(m, s.userId)[1] === 0).length;
  const finals = mine.filter((m) => m.stage === "F").map((m) => {
    const [gf, ga] = goals(m, s.userId);
    const winByPens = !!m.pens && ((m.home === s.userId) === (m.pens.h > m.pens.a));
    return { comp: m.comp, gf, ga, pens: !!m.pens, won: gf > ga || (gf === ga && winByPens) };
  });
  const maxWinMargin = Math.max(0, ...mine.map((m) => { const [a, b] = goals(m, s.userId); return a - b; }));
  const finalHatTrick = mine.some((m) => m.stage === "F" && (m.detail?.lines ?? []).some((l) => l.key !== BENCH_KEY && l.goals >= 3));
  const all = aggregatePlayerStats(s, "ALL"), ucl = aggregatePlayerStats(s, "UCL");
  const players = (s.squad ?? []).map((m) => {
    const r = all.find((x) => x.key === m.slotId), u = ucl.find((x) => x.key === m.slotId);
    return { id: m.cardId, name: m.name, pos: m.pos, g: r?.goals ?? 0, a: r?.assists ?? 0, cs: r?.cleanSheets ?? 0, r: r?.rating ?? 0, gp: r?.gp ?? 0, min: r?.min ?? 0, ug: u?.goals ?? 0 };
  });
  const aw = seasonAwards(s);
  const ref = (w?: { cardId: string; name: string; stats: string }): AwardRef | undefined => (w ? { id: w.cardId, name: w.name, stat: w.stats } : undefined);
  const nations = new Set(Object.values(d.lineup).map((id) => FB_CARD_BY_ID[id]?.nation).filter(Boolean)).size;
  return {
    kind: "fb", id: `fb:${s.seed}`, date: ctx.date ?? new Date().toISOString(), difficulty: s.difficulty, mode: d.mode, tactic: s.tactic?.id ?? "balanced",
    draftSeed: d.seed, seasonSeed: s.seed,
    team: { name: ctx.teamName, formationId: d.formationId, ovr: ctx.ovr, chem: ctx.chem, nations },
    pl: { pos: row.pos!, pts: row.pts, w: row.w, d: row.d, l: row.l, gf: row.gf, ga: row.ga, cs: plCs },
    won, titles: Object.values(won).filter(Boolean).length, finals, maxWinMargin, finalHatTrick, players,
    awards: { ballon: ref(aw?.ballonDor), boot: ref(aw?.goldenBoot), glove: ref(aw?.goldenGlove), pots: ref(aw?.playerOfSeason) },
  };
}

/* ───────── NBA ───────── */
const per = (t: PlayerTotals) => ({ ppg: t.pts / t.gp, rpg: t.reb / t.gp, apg: t.ast / t.gp, spg: t.stl / t.gp, bpg: t.blk / t.gp });
const composite = (t: { ppg: number; rpg: number; apg: number; spg: number; bpg: number }) => t.ppg + 1.2 * t.rpg + 1.5 * t.apg + 2 * t.spg + 2 * t.bpg;
const r1 = (x: number) => Math.round(x * 10) / 10;
/** Legend (for "Legends Only"): estimated season impact ≥ +6 per 100 poss. (≈ MVP-level RAPTOR); 112 of 708 seasons qualify. */
export const NBA_LEGEND_IMPACT = 6;
/** Engine maximum of NBA chemistry: 70 + 8·(spacing 1 + creator 0.5 + rim 0.5) = 86. */
export const NBA_CHEM_MAX = 86;
export const NBA_MIN_GP = 58; // ≥ 70 % of the season for per-game achievements

export function nbaInternalAwards(result: NbaSeasonResult): NbaSeasonRec["awards"] {
  const reg = (result.stats?.regular ?? []).filter((t) => t.key !== "BENCH" && t.gp > 0);
  if (!reg.length) return {};
  const P = reg.map((t) => ({ t, p: per(t) }));
  const top = (f: (x: (typeof P)[number]) => number) => [...P].sort((a, b) => f(b) - f(a))[0];
  const ref = (x: (typeof P)[number], stat: string): AwardRef => ({ id: x.t.key, name: x.t.name, stat });
  const mvp = top((x) => composite(x.p)), sc = top((x) => x.p.ppg), rb = top((x) => x.p.rpg), as = top((x) => x.p.apg), df = top((x) => x.p.spg + x.p.bpg);
  const out: NbaSeasonRec["awards"] = {
    mvp: ref(mvp, `${r1(mvp.p.ppg)} pts · ${r1(mvp.p.rpg)} reb · ${r1(mvp.p.apg)} ast`),
    scorer: ref(sc, `${r1(sc.p.ppg)} pts/p`), rebounder: ref(rb, `${r1(rb.p.rpg)} reb/p`), passer: ref(as, `${r1(as.p.apg)} ast/p`),
  };
  if (df.p.spg + df.p.bpg > 0) out.defender = ref(df, `${r1(df.p.spg)} robos · ${r1(df.p.bpg)} tapones /p`);
  const finals = result.playoffs?.series.find((x) => x.round === 4 && (x.high === USER_ID || x.low === USER_ID));
  if (finals && finals.winner === USER_ID && finals.games.every((g) => g.box)) {
    const acc = new Map<string, { name: string; gp: number; pts: number; reb: number; ast: number; stl: number; blk: number }>();
    for (const g of finals.games) for (const l of g.box as BoxLine[]) {
      if (l.key === "BENCH") continue;
      const name = reg.find((t) => t.key === l.key)?.name ?? l.key;
      const a = acc.get(l.key) ?? { name, gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 };
      a.gp++; a.pts += l.pts; a.reb += l.reb; a.ast += l.ast; a.stl += l.stl; a.blk += l.blk; acc.set(l.key, a);
    }
    const best = [...acc.entries()].sort((a, b) => composite(per(b[1] as never)) - composite(per(a[1] as never)))[0];
    if (best) { const p = per(best[1] as never); out.finalsMvp = { id: best[0], name: best[1].name, stat: `${r1(p.ppg)} pts · ${r1(p.rpg)} reb · ${r1(p.apg)} ast en las Finals` }; }
  }
  return out;
}

export function nbaSeasonRecord(result: NbaSeasonResult, lineup: Partial<Record<NbaPos, NbaCard>>, team: NbaTeamEval, ctx: { draftSeed: string; teamName: string; date?: string }): NbaSeasonRec {
  const po = result.playoffs;
  const mySeries = po?.series.filter((x) => x.high === USER_ID || x.low === USER_ID) ?? [];
  const winsIn = (x: (typeof mySeries)[number]) => (x.high === USER_ID ? x.winsHigh : x.winsLow), lossIn = (x: (typeof mySeries)[number]) => (x.high === USER_ID ? x.winsLow : x.winsHigh);
  const finals = mySeries.find((x) => x.round === 4);
  const reg = (result.stats?.regular ?? []).filter((t) => t.key !== "BENCH" && t.gp > 0);
  return {
    kind: "nba", id: `nba:${result.seed}:${ctx.draftSeed}`, date: ctx.date ?? new Date().toISOString(), difficulty: result.difficulty, draftSeed: ctx.draftSeed, seed: result.seed, teamName: ctx.teamName,
    wins: result.wins, losses: result.losses, outcome: po?.outcome ?? "missed", champion: po?.outcome === "champion",
    seriesWon: mySeries.filter((x) => x.winner === USER_ID).length, poW: mySeries.reduce((a, x) => a + winsIn(x), 0), poL: mySeries.reduce((a, x) => a + lossIn(x), 0),
    expectedWins: r1(result.games.reduce((a, g) => a + g.winProb, 0)),
    chemistry: team.chemistry, teamOvr: team.overall, offense: team.offense, defense: team.defense, playmaking: team.playmaking,
    legends: Object.values(lineup).filter((c) => c && c.ratings.impact >= NBA_LEGEND_IMPACT).length,
    longestStreak: result.longestWinStreak, homeW: result.games.filter((g) => g.home && g.win).length, homeL: result.games.filter((g) => g.home && !g.win).length,
    finalsGame7Win: !!finals && finals.games.length === 7 && finals.winner === USER_ID,
    players: reg.map((t) => { const p = per(t); return { name: t.name, pos: t.key, gp: t.gp, ppg: r1(p.ppg), rpg: r1(p.rpg), apg: r1(p.apg), spg: r1(p.spg), bpg: r1(p.bpg) }; }),
    awards: nbaInternalAwards(result),
  };
}
