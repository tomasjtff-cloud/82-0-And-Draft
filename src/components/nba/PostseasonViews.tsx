"use client";
import { useMemo, useState } from "react";
import { FRANCHISE_BY_ID } from "@/lib/data/nba/franchises";
import { USER_ID, OUTCOME_LABEL } from "@/features/nba-simulation/engine";
import type { NbaSeasonResult, PlayerTotals, PlayoffSeries, StandingEntry } from "@/types/nba";

export const teamLabel = (id: string) => (id === USER_ID ? "TU QUINTETO" : `${FRANCHISE_BY_ID[id]?.city ?? id} ${FRANCHISE_BY_ID[id]?.name ?? ""}`);
const short = (id: string) => (id === USER_ID ? "TÚ" : id);

export function StandingsView({ standings }: { standings: StandingEntry[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="standings">
      {(["West", "East"] as const).map((c) => (
        <div key={c} className="panel overflow-x-auto p-2">
          <h4 className="px-2 py-1 font-cond text-sm font-bold uppercase tracking-wider text-muted">Conferencia {c === "West" ? "Oeste" : "Este"}</h4>
          <table className="w-full text-sm">
            <thead className="text-left font-cond text-[11px] uppercase text-muted"><tr><th className="px-2">#</th><th>Equipo</th><th>V</th><th>D</th><th>Dif</th></tr></thead>
            <tbody className="tabular">
              {standings.filter((s) => s.conference === c).map((s) => (
                <tr key={s.team} className={`border-t border-line ${s.team === USER_ID ? "bg-nba/15 font-semibold" : ""} ${s.seed! > 8 ? "text-muted" : ""}`} data-testid={s.team === USER_ID ? "standing-user" : undefined}>
                  <td className="px-2 py-1 font-mono">{s.seed}</td><td className="truncate">{teamLabel(s.team)}</td><td className="font-mono">{s.w}</td><td className="font-mono">{s.l}</td>
                  <td className="font-mono">{(((s.pf - s.pa) / 82) > 0 ? "+" : "") + ((s.pf - s.pa) / 82).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-2 py-1 text-[10px] text-dim">Top 8 a playoffs (sin play-in). Desempate: enfrentamiento directo, diferencial, sorteo.</p>
        </div>
      ))}
    </div>
  );
}

function SeriesCard({ s }: { s: PlayoffSeries }) {
  const mine = s.high === USER_ID || s.low === USER_ID;
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${mine ? "border-nba/60 bg-nba/10" : "border-line bg-white/[.02]"}`} data-testid="series">
      {[[s.high, s.highSeed, s.winsHigh], [s.low, s.lowSeed, s.winsLow]].map(([t, seed, w]) => (
        <div key={t as string} className={`flex justify-between gap-2 ${s.winner === t ? "font-bold" : "text-muted"}`}>
          <span className="truncate"><span className="font-mono text-[10px] text-dim">{seed}</span> {short(t as string)}</span><span className="font-mono">{w}</span>
        </div>
      ))}
    </div>
  );
}

export function PlayoffsView({ result }: { result: NbaSeasonResult }) {
  const po = result.playoffs!;
  const [open, setOpen] = useState<string | null>(null);
  const userSeries = po.series.filter((s) => s.high === USER_ID || s.low === USER_ID);
  const cols: [string, PlayoffSeries[]][] = [
    ["1ª ronda Oeste", po.series.filter((s) => s.round === 1 && s.conference === "West")],
    ["Semis Oeste", po.series.filter((s) => s.round === 2 && s.conference === "West")],
    ["Final Oeste", po.series.filter((s) => s.round === 3 && s.conference === "West")],
    ["NBA Finals", po.series.filter((s) => s.round === 4)],
    ["Final Este", po.series.filter((s) => s.round === 3 && s.conference === "East")],
    ["Semis Este", po.series.filter((s) => s.round === 2 && s.conference === "East")],
    ["1ª ronda Este", po.series.filter((s) => s.round === 1 && s.conference === "East")],
  ];
  return (
    <div className="space-y-4" data-testid="playoffs">
      <div className={`panel p-4 ${po.outcome === "champion" ? "border-gold" : ""}`}>
        <div className="font-cond text-xs font-bold uppercase tracking-[.2em] text-muted">Resultado de playoffs</div>
        <div className={`font-display text-3xl ${po.outcome === "champion" ? "text-gold" : po.outcome === "missed" ? "text-muted" : "text-text"}`} data-testid="playoff-outcome" data-outcome={po.outcome}>{OUTCOME_LABEL[po.outcome]}</div>
        <div className="text-xs text-muted">Campeón: {teamLabel(po.champion)}{po.userSeed ? ` · Tu siembra: ${po.userSeed}º Oeste` : ""}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 overflow-x-auto sm:grid-cols-4 lg:grid-cols-7">
        {cols.map(([label, list]) => (
          <div key={label} className="min-w-[120px] space-y-2"><h4 className="font-cond text-xs font-bold uppercase tracking-wider text-muted">{label}</h4>{list.map((s) => <SeriesCard key={s.id} s={s} />)}</div>
        ))}
      </div>
      {userSeries.length > 0 && (
        <div className="panel p-4">
          <h4 className="font-cond text-sm font-bold uppercase tracking-wide">Tus series</h4>
          {userSeries.map((s) => (
            <div key={s.id} className="mt-2 border-t border-line pt-2">
              <button className="flex w-full justify-between text-left text-sm" onClick={() => setOpen(open === s.id ? null : s.id)}>
                <span>{["", "Primera ronda", "Semifinal de conferencia", "Final de conferencia", "NBA Finals"][s.round]} vs {teamLabel(s.high === USER_ID ? s.low : s.high)}</span>
                <span className="font-mono">{s.high === USER_ID ? `${s.winsHigh}-${s.winsLow}` : `${s.winsLow}-${s.winsHigh}`} {s.winner === USER_ID ? "✓" : "✗"}</span>
              </button>
              {open === s.id && (
                <ul className="mt-1 grid grid-cols-2 gap-1 font-mono text-xs sm:grid-cols-4">
                  {s.games.map((g) => { const mine = g.home === USER_ID ? g.homeScore : g.awayScore, th = g.home === USER_ID ? g.awayScore : g.homeScore; return <li key={g.game} className={mine > th ? "text-win" : "text-loss"}>J{g.game} {g.home === USER_ID ? "vs" : "@"} {mine}-{th}{g.overtimes ? ` (${g.overtimes}OT)` : ""}</li>; })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const pct = (m: number, a: number) => (a ? ((m / a) * 100).toFixed(1) : "—");
export function PlayerStatsView({ stats }: { stats: NonNullable<NbaSeasonResult["stats"]> }) {
  const [mode, setMode] = useState<"regular" | "playoffs">("regular");
  const rows = mode === "regular" ? stats.regular : stats.playoffs;
  const leaders = useMemo(() => {
    const starters = rows.filter((r) => r.key !== "BENCH" && r.gp > 0);
    const lead = (f: (r: PlayerTotals) => number, label: string) => { const r = [...starters].sort((a, b) => f(b) - f(a))[0]; return r ? { label, name: r.name, v: f(r).toFixed(1) } : null; };
    return [lead((r) => r.pts / r.gp, "Puntos"), lead((r) => r.reb / r.gp, "Rebotes"), lead((r) => r.ast / r.gp, "Asistencias"), lead((r) => r.stl / r.gp, "Robos"), lead((r) => r.blk / r.gp, "Tapones")].filter(Boolean) as { label: string; name: string; v: string }[];
  }, [rows]);
  return (
    <div className="space-y-4" data-testid="player-stats">
      <div className="flex gap-2">
        <button className={`btn btn-sm ${mode === "regular" ? "" : "btn-ghost"}`} onClick={() => setMode("regular")}>Temporada regular</button>
        <button className={`btn btn-sm ${mode === "playoffs" ? "" : "btn-ghost"}`} onClick={() => setMode("playoffs")} disabled={!stats.playoffs.length} data-testid="stats-playoffs">Playoffs</button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {leaders.map((l) => <div key={l.label} className="rounded-xl bg-white/5 px-3 py-2"><div className="text-[10px] uppercase text-muted">Líder en {l.label}</div><div className="truncate font-cond text-sm font-bold uppercase">{l.name}</div><div className="font-display text-2xl">{l.v}</div></div>)}
      </div>
      <div className="panel overflow-x-auto p-2">
        <table className="w-full min-w-[720px] text-sm" data-testid="stats-table">
          <thead className="text-left font-cond text-[11px] uppercase text-muted"><tr>{["Jugador", "PJ", "MIN", "PTS", "REB", "AST", "ROB", "TAP", "FG%", "3P%", "TL%", "PTS tot."].map((h) => <th key={h} className="px-2 py-1">{h}</th>)}</tr></thead>
          <tbody className="tabular">
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-line">
                <td className="px-2 py-1.5"><span className="mr-1 font-cond text-xs font-bold text-nba-2">{r.key === "BENCH" ? "BAN" : r.key}</span>{r.name}</td>
                {[r.gp, (r.min / r.gp).toFixed(1), (r.pts / r.gp).toFixed(1), (r.reb / r.gp).toFixed(1), (r.ast / r.gp).toFixed(1), (r.stl / r.gp).toFixed(1), (r.blk / r.gp).toFixed(1), pct(r.fgm, r.fga), pct(r.tpm, r.tpa), pct(r.ftm, r.fta), r.pts].map((v, i) => <td key={i} className="px-2 py-1.5 font-mono">{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-2 py-1 text-[10px] text-dim">Estadísticas SIMULADAS a partir del marcador de cada partido: reparto de posesiones según el perfil de cada jugador, sus minutos y los compañeros con los que comparte el balón. “Suplentes” agrupa los minutos del banquillo genérico.</p>
      </div>
    </div>
  );
}
