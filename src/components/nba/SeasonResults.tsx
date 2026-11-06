"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { FRANCHISE_BY_ID } from "@/lib/data/nba/franchises";
import type { NbaGameResult, NbaSeasonResult } from "@/types/nba";
import type { NbaTeamEval } from "@/lib/ratings/nba";
import { seasonAnalysis, OUTCOME_LABEL, type MonteCarloSummary } from "@/features/nba-simulation/engine";
import { PlayerStatsView, PlayoffsView, StandingsView } from "./PostseasonViews";
import { Celebration } from "@/components/common/Celebration";

export function SeasonResults({ result, team, animate, onReplay, onNewSeed, onCustomSeed, onMonteCarlo, mc, mcBusy, onNewDraft, extra }: {
  result: NbaSeasonResult; team: NbaTeamEval; animate: number; extra?: React.ReactNode;
  onReplay: () => void; onNewSeed: () => void; onCustomSeed: (s: string) => void;
  onMonteCarlo: (runs: number) => void; mc: MonteCarloSummary | null; mcBusy: boolean; onNewDraft: () => void;
}) {
  const [revealed, setRevealed] = useState(animate > 0 ? 0 : 82);
  const [inspect, setInspect] = useState<NbaGameResult | null>(null);
  const [seedInput, setSeedInput] = useState(result.seed);
  const [filter, setFilter] = useState<"all" | "losses">("all");
  const [tab, setTab] = useState<"summary" | "calendar" | "standings" | "playoffs" | "stats" | "mc">("summary");
  useEffect(() => {
    setSeedInput(result.seed);
    if (animate <= 0) { setRevealed(82); return; }
    setRevealed(0);
    let n = 0;
    const id = setInterval(() => { n += 2; setRevealed(Math.min(82, n)); if (n >= 82) clearInterval(id); }, Math.max(8, animate / 41));
    return () => clearInterval(id);
  }, [result, animate]);

  const shown = result.games.slice(0, revealed);
  const w = shown.filter((g) => g.win).length;
  const l = shown.length - w;
  const done = revealed >= 82;
  const analysis = useMemo(() => seasonAnalysis(result, team), [result, team]);
  const perfect = done && result.wins === 82;
  const historic = done && result.wins >= 73;
  const ring = done && result.playoffs?.outcome === "champion";
  const games = filter === "losses" ? result.games.filter((g) => !g.win) : result.games;

  return (
    <div className="space-y-6" data-testid="nba-results">
      <Celebration active={perfect || historic || ring} colors={perfect || ring ? ["#ffd700", "#ff6a13", "#fff", "#ffb347"] : ["#ff6a13", "#ffb347"]} />
      <section className={`panel relative overflow-hidden p-6 md:p-8 ${perfect ? "border-gold" : ""}`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="font-cond text-sm font-bold uppercase tracking-[.25em] text-muted">{done ? "Final record" : "Simulando temporada…"}</div>
            <div className="font-display text-7xl leading-none tabular md:text-9xl" data-testid="final-record">
              <span className="text-win">{w}</span><span className="text-dim">-</span><span className="text-loss">{l}</span>
            </div>
            {perfect && <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display mt-2 text-3xl text-gold">82-0 · PERFECT SEASON</motion.div>}
            {!perfect && historic && <div className="font-display mt-2 text-2xl text-nba-2">RITMO HISTÓRICO</div>}
            <div className="mt-1 font-cond text-xs font-bold uppercase tracking-[.2em] text-muted">Temporada regular</div>
          </div>
          {done && result.playoffs && (
            <div className={`rounded-2xl border px-4 py-3 ${ring ? "border-gold bg-gold/10" : "border-line bg-white/5"}`} data-testid="postseason-badge">
              <div className="font-cond text-[11px] font-bold uppercase tracking-[.2em] text-muted">Playoffs</div>
              <div className={`font-display text-2xl ${ring ? "text-gold" : ""}`}>{ring ? "🏆 ANILLO" : OUTCOME_LABEL[result.playoffs.outcome]}</div>
              {ring && <div className="text-xs text-gold-2">Campeones de la NBA</div>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["% victorias", done ? `${((result.wins / 82) * 100).toFixed(1)}%` : "…"], ["Mejor racha", done ? result.longestWinStreak : "…"], ["Diferencial", done ? `${result.avgMargin > 0 ? "+" : ""}${result.avgMargin}` : "…"], ["Net rating", `${team.net > 0 ? "+" : ""}${team.net}`]].map(([k, v]) => (
              <div key={k as string} className="rounded-xl bg-white/5 px-4 py-3">
                <div className="font-cond text-[11px] font-bold uppercase tracking-wider text-muted">{k}</div>
                <div className="font-mono text-xl tabular">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-nba transition-all" style={{ width: `${(revealed / 82) * 100}%` }} /></div>
        <div className="mt-2 text-xs text-muted">Semilla <span className="font-mono text-text">{result.seed}</span> · Dificultad {result.difficulty}</div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-sm" onClick={onReplay} data-testid="replay-season">Repetir (misma semilla)</button>
        <button className="btn btn-nba btn-sm" onClick={onNewSeed} data-testid="new-seed-season">Nueva simulación</button>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (seedInput.trim()) onCustomSeed(seedInput.trim()); }}>
          <input value={seedInput} onChange={(e) => setSeedInput(e.target.value)} aria-label="Semilla" className="w-32 rounded-lg border border-line bg-surface px-3 font-mono text-sm" />
          <button className="btn btn-sm" type="submit">Usar semilla</button>
        </form>
        {extra}
        <button className="btn btn-sm btn-ghost ml-auto" onClick={onNewDraft} data-testid="new-draft">Nuevo draft</button>
      </div>

      {done && (
        <>
          <div className="flex gap-1 overflow-x-auto scrollbar-thin" role="tablist">
            {([["summary", "Resumen"], ["calendar", "Calendario"], ["standings", "Clasificación"], ["playoffs", "Playoffs"], ["stats", "Mis jugadores"], ["mc", "Monte Carlo"]] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`nba-tab-${k}`}
                className={`whitespace-nowrap rounded-lg px-3 py-2 font-cond text-sm font-bold uppercase tracking-wider ${tab === k ? "bg-surface-3 text-text" : "text-muted hover:text-text"}`}>{l}</button>
            ))}
          </div>
          {tab === "summary" && (
            <div className="panel p-5"><h3 className="font-cond text-lg font-bold uppercase tracking-wide">Análisis</h3>
              <ul className="mt-2 space-y-2 text-sm text-muted">{analysis.map((a) => <li key={a}>· {a}</li>)}</ul></div>
          )}
          {tab === "calendar" && (
          <div className="panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-cond text-lg font-bold uppercase tracking-wide">Calendario · 82 partidos</h3>
              <div className="flex gap-1">
                <button className={`btn btn-sm ${filter === "all" ? "" : "btn-ghost"}`} onClick={() => setFilter("all")}>Todos</button>
                <button className={`btn btn-sm ${filter === "losses" ? "" : "btn-ghost"}`} onClick={() => setFilter("losses")} data-testid="filter-losses">Derrotas ({result.losses})</button>
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5" data-testid="game-grid">
              {games.map((g) => (
                <button key={g.game} onClick={() => setInspect(g)} data-testid="game-cell"
                  className={`rounded-md px-1 py-1.5 text-center font-mono text-[11px] leading-tight transition-transform hover:scale-105 ${g.win ? "bg-win/15 text-win" : "bg-loss/20 text-loss"} ${inspect?.game === g.game ? "ring-2 ring-white" : ""}`}>
                  <div className="font-bold">{g.home ? "" : "@"}{g.opponent}</div>
                  <div className="opacity-80">#{g.game}</div>
                </button>
              ))}
            </div>
            {inspect && <GameDetail g={inspect} />}
          </div>
          )}
          {tab === "standings" && result.standings && <StandingsView standings={result.standings} />}
          {tab === "playoffs" && result.playoffs && <PlayoffsView result={result} />}
          {tab === "stats" && result.stats && <PlayerStatsView stats={result.stats} />}
          {tab === "mc" && <MonteCarloPanel mc={mc} busy={mcBusy} onRun={onMonteCarlo} />}
        </>
      )}
    </div>
  );
}

function GameDetail({ g }: { g: NbaGameResult }) {
  const opp = FRANCHISE_BY_ID[g.opponent];
  return (
    <div className="mt-4 rounded-xl border border-line bg-ink/60 p-4 text-sm" data-testid="game-detail">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-cond text-base font-bold uppercase">Partido {g.game} · {g.home ? "vs" : "@"} {opp.city} {opp.name}</div>
        <span className={`chip ${g.win ? "text-win" : "text-loss"}`}>{g.win ? "Victoria" : "Derrota"}</span>
      </div>
      <div className="font-display mt-2 text-4xl tabular">{g.teamScore} – {g.oppScore}</div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-4">
        <div>Prob. previa de victoria: <b className="text-text">{(g.winProb * 100).toFixed(1)}%</b></div>
        <div>Margen esperado: <b className="text-text">{g.expectedMargin > 0 ? "+" : ""}{g.expectedMargin}</b></div>
        <div>Localía: <b className="text-text">{g.home ? "Casa" : "Fuera"}</b></div>
        <div>Back-to-back: <b className="text-text">{g.backToBack ? "Sí" : "No"}</b></div>
      </div>
      {g.box && (
        <table className="mt-3 w-full text-xs" data-testid="box-score">
          <thead className="text-left text-muted"><tr>{["", "MIN", "PTS", "REB", "AST", "ROB", "TAP", "TC", "3P", "TL"].map((h) => <th key={h} className="py-0.5">{h}</th>)}</tr></thead>
          <tbody className="font-mono tabular">{g.box.map((l) => <tr key={l.key} className="border-t border-line"><td className="font-cond font-bold text-nba-2">{l.key === "BENCH" ? "BAN" : l.key}</td>{[l.min, l.pts, l.reb, l.ast, l.stl, l.blk, `${l.fgm}/${l.fga}`, `${l.tpm}/${l.tpa}`, `${l.ftm}/${l.fta}`].map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

function MonteCarloPanel({ mc, busy, onRun }: { mc: MonteCarloSummary | null; busy: boolean; onRun: (n: number) => void }) {
  const maxBin = mc ? Math.max(...mc.distribution) : 1;
  return (
    <div className="panel p-5" data-testid="mc-panel">
      <h3 className="font-cond text-lg font-bold uppercase tracking-wide">Monte Carlo</h3>
      <p className="mt-1 text-xs text-muted">Repite la temporada con el mismo quinteto y semillas derivadas.</p>
      <div className="mt-3 flex gap-2">
        {[500, 2000].map((n) => <button key={n} disabled={busy} className="btn btn-sm" onClick={() => onRun(n)} data-testid={`mc-${n}`}>{busy ? "Simulando…" : `${n} temporadas`}</button>)}
      </div>
      {mc && (
        <div className="mt-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Kv k="Media de victorias" v={mc.meanWins.toString()} />
            <Kv k="Rango" v={`${mc.minWins}–${mc.maxWins}`} />
            <Kv k="P10–P90" v={`${mc.p10}–${mc.p90}`} />
            <Kv k="P(>70 victorias)" v={`${(mc.pOver70 * 100).toFixed(1)}%`} />
            <Kv k="P(82-0) simulada" v={`${(mc.pUndefeated * 100).toFixed(2)}%`} />
            <Kv k="P(82-0) analítica" v={mc.analyticUndefeated < 1e-4 ? mc.analyticUndefeated.toExponential(1) : `${(mc.analyticUndefeated * 100).toFixed(3)}%`} />
            <Kv k="P(playoffs)" v={`${(mc.pPlayoffs * 100).toFixed(1)}%`} />
            <Kv k="P(anillo)" v={`${(mc.pChampion * 100).toFixed(1)}%`} />
          </div>
          <div className="flex h-24 items-end gap-px" aria-label="Distribución de victorias">
            {mc.distribution.map((c, i) => (
              <div key={i} title={`${i} victorias: ${c}`} className={`flex-1 rounded-t-sm ${i === 82 ? "bg-gold" : "bg-nba/70"}`} style={{ height: `${(c / maxBin) * 100}%`, minHeight: c ? 2 : 0 }} />
            ))}
          </div>
          <div className="flex justify-between font-mono text-[10px] text-dim"><span>0</span><span>41</span><span>82</span></div>
          <p className="text-[11px] leading-snug text-dim">
            Frecuencias de {mc.runs} simulaciones del videojuego (no predicciones reales). La probabilidad analítica multiplica las
            probabilidades de victoria por partido de un calendario; ignora la forma de temporada y varía con el calendario.
          </p>
        </div>
      )}
    </div>
  );
}
function Kv({ k, v }: { k: string; v: string }) {
  return <div className="rounded-lg bg-white/5 px-3 py-2"><div className="text-[11px] text-muted">{k}</div><div className="font-mono tabular">{v}</div></div>;
}
