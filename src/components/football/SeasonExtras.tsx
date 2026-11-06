"use client";
import { useMemo, useState } from "react";
import { Sheet } from "@/components/common/Sheet";
import type { CompId, Match } from "@/types/football";
import type { SeasonState } from "@/features/football-simulation/season";
import { aggregatePlayerStats, seasonRecords, teamAwards, userMatches, type FbStatRow, type StatScope } from "@/features/football-simulation/player-stats";
import { BENCH_KEY } from "@/features/football-simulation/events";
import { COMP_NAME } from "@/features/football-simulation/calendar";
import { scoreline } from "@/features/football-simulation/match";

const SCOPES: [StatScope, string][] = [["ALL", "Todas"], ["PL", "Premier"], ["UCL", "Champions"], ["FA", "FA Cup"], ["EFL", "Carabao"]];
type SortKey = "goals" | "assists" | "gp" | "min" | "rating";
const SORTS: [SortKey, string][] = [["goals", "Goles"], ["assists", "Asist."], ["gp", "PJ"], ["min", "Min"], ["rating", "Nota"]];
const nameOfKey = (s: SeasonState, key: string) => (key === BENCH_KEY ? "Suplente" : s.squad?.find((m) => m.slotId === key)?.name ?? key);

export const noDetail = (s: SeasonState) => !s.squad;
export function NoDetailNotice() {
  return <p className="panel p-4 text-sm text-muted" data-testid="no-detail">Esta temporada se jugó con una versión anterior (sin eventos individuales). Las estadísticas por jugador están disponibles en las temporadas nuevas.</p>;
}

export function FbPlayerStatsView({ s }: { s: SeasonState }) {
  const [scope, setScope] = useState<StatScope>("ALL");
  const [sort, setSort] = useState<SortKey>("goals");
  const rows = useMemo(() => aggregatePlayerStats(s, scope), [s, scope]);
  const played = userMatches(s, scope).length;
  const awards = useMemo(() => teamAwards(rows, played), [rows, played]);
  if (noDetail(s)) return <NoDetailNotice />;
  const sorted = [...rows].filter((r) => r.key !== BENCH_KEY || r.min > 0).sort((a, b) => (b[sort] as number) - (a[sort] as number) || b.goals - a.goals);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  return (
    <div className="space-y-4" data-testid="fb-player-stats">
      <div className="flex gap-1 overflow-x-auto scrollbar-thin">{SCOPES.map(([k, l]) => <button key={k} onClick={() => setScope(k)} className={`chip shrink-0 ${scope === k ? "border-gold bg-gold/15 text-text" : "text-muted"}`} data-testid={`fb-scope-${k}`}>{l}</button>)}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" data-testid="fb-awards">
        {([["MVP", awards.mvp, (r: FbStatRow) => `${r.rating.toFixed(2)} nota`], ["Máximo goleador", awards.topScorer, (r: FbStatRow) => `${r.goals} goles`], ["Máximo asistidor", awards.topAssister, (r: FbStatRow) => `${r.assists} asist.`], ["Mejor jugador", awards.bestPlayer, (r: FbStatRow) => `${r.rating.toFixed(2)} nota media`], ["Portero", awards.bestGk, (r: FbStatRow) => `${r.cleanSheets} porterías a cero`]] as [string, FbStatRow | undefined, (r: FbStatRow) => string][]).map(([k, r, f]) => (
          <div key={k} className={`rounded-xl px-3 py-2 ${k === "MVP" ? "bg-gold/15" : "bg-white/5"}`}><div className="text-[10px] uppercase text-muted">{k}</div><div className="truncate font-cond text-sm font-bold uppercase">{r?.name ?? "—"}</div><div className="font-mono text-xs">{r ? f(r) : ""}</div></div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted">Ordenar: {SORTS.map(([k, l]) => <button key={k} onClick={() => setSort(k)} className={`chip ${sort === k ? "border-white/60 text-text" : ""}`} data-testid={`fb-sort-${k}`}>{l}</button>)}</div>
      <div className="panel overflow-x-auto p-2">
        <table className="w-full min-w-[860px] text-sm" data-testid="fb-stats-table">
          <thead className="text-left font-cond text-[11px] uppercase text-muted"><tr>{["Jugador", "PJ", "Min", "G", "A", "G/90", "A/90", "Tiros", "A puerta", "Pase", "TA", "TR", "Nota", "xG*", "xA*", "GK: paradas · % · ceros"].map((h) => <th key={h} className="px-2 py-1">{h}</th>)}</tr></thead>
          <tbody className="tabular">
            {sorted.map((r) => (
              <tr key={r.key} className="border-t border-line">
                <td className="px-2 py-1.5 whitespace-nowrap"><span className="mr-1 font-cond text-xs font-bold text-gold">{r.pos}</span>{r.name}</td>
                {[r.gp, r.min, r.goals, r.assists, r.g90.toFixed(2), r.a90.toFixed(2), r.shots, r.sot, pct(r.passesOk, r.passes), r.yellow, r.red, r.key === BENCH_KEY ? "—" : r.rating.toFixed(2), r.xg.toFixed(1), r.xa.toFixed(1),
                  r.pos === "GK" ? `${r.saves} · ${pct(r.saves, r.saves + r.conceded)} · ${r.cleanSheets}` : ""].map((v, i) => <td key={i} className="px-2 py-1.5 font-mono">{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-2 py-1 text-[10px] text-dim">Estadísticas SIMULADAS de esta temporada del juego (no son datos históricos reales). Los goles salen exactamente de los marcadores; los penales de una tanda no cuentan. *xG/xA: estimación del modelo (goles esperados del partido repartidos por perfil y minutos).</p>
      </div>
    </div>
  );
}

export function MatchDetailSheet({ s, m, onClose }: { s: SeasonState; m: Match | null; onClose: () => void }) {
  const name = (id: string) => s.teams[id]?.name ?? id;
  return (
    <Sheet open={!!m} onClose={onClose} title={m ? `${COMP_NAME[m.comp]} · ${m.stage}` : ""} testId="fb-match-sheet">
      {m && (
        <div className="space-y-3">
          <div className="text-center"><div className="text-xs text-muted">{m.date}{m.neutral ? " · campo neutral" : ""}</div><div className="font-display text-3xl">{name(m.home)} <span className="text-gold">{scoreline(m)}</span> {name(m.away)}</div></div>
          {!m.detail ? <NoDetailNotice /> : (
            <>
              <ul className="space-y-1 text-sm" data-testid="fb-match-goals">
                {m.detail.goals.length === 0 && <li className="text-muted">Sin goles de tu equipo.</li>}
                {m.detail.goals.map((g, i) => <li key={i}>⚽ <b className="font-mono">{g.minute}&apos;</b> {nameOfKey(s, g.scorer)}{g.penalty ? " (pen.)" : ""}{g.assist ? <span className="text-muted"> · asist. {nameOfKey(s, g.assist)}</span> : ""}{g.extraTime ? <span className="text-gold-2"> · prórroga</span> : ""}</li>)}
              </ul>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {[["Posesión", `${m.detail.possession}%`], ["Tiros (a puerta)", `${m.detail.shots} (${m.detail.sot})`], ["Rival: tiros (a puerta)", `${m.detail.oppShots} (${m.detail.oppSot})`]].map(([k, v]) => <div key={k} className="rounded-lg bg-white/5 py-1.5"><div className="text-muted">{k}</div><div className="font-mono text-sm">{v}</div></div>)}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-xs" data-testid="fb-match-lines">
                  <thead className="text-left text-muted"><tr>{["Jugador", "Min", "G", "A", "Tiros", "Pases", "Tarj.", "Nota"].map((h) => <th key={h} className="py-1">{h}</th>)}</tr></thead>
                  <tbody className="font-mono tabular">{m.detail.lines.filter((l) => l.min > 0).map((l) => <tr key={l.key} className="border-t border-line"><td className="py-1 font-sans">{nameOfKey(s, l.key)}</td><td>{l.min}</td><td>{l.goals}</td><td>{l.assists}</td><td>{l.shots}/{l.sot}</td><td>{l.passesOk}/{l.passes}</td><td>{l.yellow ? "🟨" : ""}{l.red ? "🟥" : ""}</td><td>{l.key === BENCH_KEY ? "—" : l.rating.toFixed(1)}</td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

export function FbMatchList({ s }: { s: SeasonState }) {
  const [open, setOpen] = useState<Match | null>(null);
  const [scope, setScope] = useState<StatScope>("ALL");
  const ms = userMatches(s, scope);
  const name = (id: string) => s.teams[id]?.name ?? id;
  const res = (m: Match) => { const h = m.hg + (m.et?.hg ?? 0), a = m.ag + (m.et?.ag ?? 0); const d = m.home === s.userId ? h - a : a - h; return d > 0 ? "W" : d < 0 ? "L" : m.pens ? ((m.home === s.userId) === (m.pens.h > m.pens.a) ? "W" : "L") : "D"; };
  return (
    <div className="space-y-2" data-testid="fb-match-list">
      <div className="flex gap-1 overflow-x-auto scrollbar-thin">{SCOPES.map(([k, l]) => <button key={k} onClick={() => setScope(k)} className={`chip shrink-0 ${scope === k ? "border-gold bg-gold/15 text-text" : "text-muted"}`}>{l}</button>)}</div>
      <ul className="panel divide-y divide-line">
        {ms.map((m) => {
          const r = res(m);
          const scorers = m.detail?.goals.map((g) => nameOfKey(s, g.scorer).split(" ").pop()).join(", ");
          return (
            <li key={m.id}>
              <button className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/[.03]" onClick={() => setOpen(m)} data-testid="fb-match-row">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded font-cond text-xs font-extrabold ${r === "W" ? "bg-win/80 text-black" : r === "L" ? "bg-loss/80" : "bg-draw/60 text-black"}`}>{r === "W" ? "V" : r === "L" ? "D" : "E"}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm">{name(m.home)} <b className="font-mono">{scoreline(m)}</b> {name(m.away)}</span><span className="block truncate text-[11px] text-muted">{m.date} · {COMP_NAME[m.comp as CompId]} {m.stage}{scorers ? ` · ⚽ ${scorers}` : ""}</span></span>
              </button>
            </li>
          );
        })}
      </ul>
      <MatchDetailSheet s={s} m={open} onClose={() => setOpen(null)} />
    </div>
  );
}

export function SeasonHighlights({ s }: { s: SeasonState }) {
  const rec = useMemo(() => seasonRecords(s), [s]);
  const name = (id: string) => s.teams[id]?.name ?? id;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="fb-records">
      {[
        ["Mayor victoria", rec.biggestWin ? `${name(rec.biggestWin.home)} ${scoreline(rec.biggestWin)} ${name(rec.biggestWin.away)}` : "—"],
        ["Racha de victorias", `${rec.winStreak} partidos`], ["Racha invicta", `${rec.unbeatenStreak} partidos`],
        ["Goles (todas)", `${rec.goalsFor} a favor · ${rec.goalsAgainst} en contra`], ["Porterías a cero", `${rec.cleanSheets}`],
        ["Hat-tricks", rec.hatTricks.length ? rec.hatTricks.map((h) => `${nameOfKey(s, h.key)} (${h.goals})`).join(", ") : "—"],
        ["Peor derrota", rec.heaviestDefeat ? `${name(rec.heaviestDefeat.home)} ${scoreline(rec.heaviestDefeat)} ${name(rec.heaviestDefeat.away)}` : "—"],
      ].map(([k, v]) => <div key={k} className="rounded-xl bg-white/5 px-3 py-2"><div className="text-[10px] uppercase text-muted">{k}</div><div className="text-sm">{v}</div></div>)}
    </div>
  );
}
