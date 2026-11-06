"use client";
import type { Difficulty } from "@/lib/core/difficulty";
import { randomSeed } from "@/lib/core/rng";
import { useFootballMonteCarlo } from "@/hooks/useFootballMonteCarlo";
import type { UserTeamInput } from "@/features/football-simulation/season";
import { EFL_STAGES, FA_STAGES, UCL_STAGES, type Prob } from "@/features/football-simulation/monte-carlo";
import { useState } from "react";

const fmt = (p: Prob) => `${(p.p * 100).toFixed(p.p < 0.01 && p.p > 0 ? 2 : 1)}%`;
const ci = (p: Prob) => `IC95% ${(p.lo * 100).toFixed(1)}–${(p.hi * 100).toFixed(1)}%`;

function Bars({ labels, counts, total, testId }: { labels: readonly string[]; counts: number[]; total: number; testId?: string }) {
  const max = Math.max(1, ...counts);
  return (
    <ul className="space-y-1" data-testid={testId}>
      {labels.map((l, i) => (
        <li key={l} className="flex items-center gap-2 text-xs">
          <span className="w-20 shrink-0 text-muted">{l}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-gold" style={{ width: `${(counts[i] / max) * 100}%` }} /></span>
          <span className="w-12 text-right font-mono">{total ? ((counts[i] / total) * 100).toFixed(1) : "0.0"}%</span>
        </li>
      ))}
    </ul>
  );
}

/** "SIMULAR 1.000 TEMPORADAS" — full seasons with the real engine, in a Web Worker. */
export function FootballMonteCarloPanel({ user, difficulty }: { user: UserTeamInput; difficulty: Difficulty }) {
  const mc = useFootballMonteCarlo();
  const [seed, setSeed] = useState(() => randomSeed());
  const s = mc.summary;
  const running = mc.status === "running";
  return (
    <section className="panel p-5" data-testid="fb-mc-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-cond text-lg font-bold uppercase tracking-wide">Monte Carlo · temporadas completas</h3>
        <span className="text-xs text-muted">Semilla <span className="font-mono">{seed}</span> <button className="underline" onClick={() => setSeed(randomSeed())} disabled={running}>cambiar</button></span>
      </div>
      <p className="mt-1 text-xs text-muted">Cada temporada usa el motor real (Premier, Champions, FA Cup, Carabao, calendario, localía, fatiga, química y dificultad) con una semilla independiente y reproducible.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-gold" disabled={running} onClick={() => mc.start(user, difficulty, seed, 1000)} data-testid="fb-mc-1000">Simular 1.000 temporadas</button>
        {[100, 500, 2000].map((n) => <button key={n} className="btn btn-sm" disabled={running} onClick={() => mc.start(user, difficulty, seed, n)} data-testid={`fb-mc-${n}`}>{n.toLocaleString("es-ES")}</button>)}
        {running && <button className="btn btn-sm" onClick={mc.cancel} data-testid="fb-mc-cancel">Cancelar</button>}
      </div>
      {mc.status !== "idle" && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-gold transition-all" style={{ width: `${mc.runs ? (mc.done / mc.runs) * 100 : 0}%` }} /></div>
          <div className="mt-1 flex justify-between text-[11px] text-muted" data-testid="fb-mc-progress">
            <span>{mc.done.toLocaleString("es-ES")} / {mc.runs.toLocaleString("es-ES")} temporadas {mc.status === "done" ? "· completado" : mc.status === "cancelled" ? "· cancelado (resultados parciales)" : mc.status === "error" ? "· error" : "…"}</span>
            <span>{(mc.ms / 1000).toFixed(1)} s</span>
          </div>
        </div>
      )}
      {s && s.runs > 0 && (
        <div className="mt-4 space-y-4" data-testid="fb-mc-results" data-status={mc.status}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {([["Premier League", s.titles.PL], ["Champions League", s.titles.UCL], ["FA Cup", s.titles.FA], ["Carabao Cup", s.titles.EFL], ["Quadruple", s.titles.quadruple], ["Algún título", s.titles.anyTitle]] as [string, Prob][]).map(([k, p]) => (
              <div key={k} className={`rounded-xl px-3 py-2 ${k === "Quadruple" ? "bg-gold/15" : "bg-white/5"}`}>
                <div className="text-[11px] uppercase text-muted">{k}</div>
                <div className="font-display text-2xl tabular">{fmt(p)}</div>
                <div className="text-[10px] text-dim">{p.k}/{s.runs} · {ci(p)}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[["Posición media PL", s.avgPos.toFixed(1)], ["Puntos medios", `${s.avgPts.toFixed(1)} ± ${s.sdPts.toFixed(1)}`], ["Goles a favor", s.avgGf.toFixed(1)], ["Goles en contra", s.avgGa.toFixed(1)]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/5 px-3 py-2"><div className="text-[11px] text-muted">{k}</div><div className="font-mono">{v}</div></div>
            ))}
          </div>
          <div>
            <h4 className="mb-1 font-cond text-sm font-bold uppercase tracking-wide">Posición final en la Premier League</h4>
            <div className="flex h-20 items-end gap-0.5" data-testid="fb-mc-posdist">
              {s.posDist.map((c, i) => <div key={i} title={`${i + 1}º: ${c}`} className={`flex-1 rounded-t-sm ${i === 0 ? "bg-gold" : i < 4 ? "bg-win/70" : i >= 17 ? "bg-loss/70" : "bg-white/30"}`} style={{ height: `${(c / Math.max(1, ...s.posDist)) * 100}%`, minHeight: c ? 2 : 0 }} />)}
            </div>
            <div className="flex justify-between font-mono text-[10px] text-dim"><span>1º</span><span>10º</span><span>20º</span></div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div><h4 className="mb-1 font-cond text-sm font-bold uppercase">Champions: ronda alcanzada</h4><Bars labels={UCL_STAGES} counts={s.uclStages} total={s.runs} /></div>
            <div><h4 className="mb-1 font-cond text-sm font-bold uppercase">FA Cup</h4><Bars labels={FA_STAGES} counts={s.faStages} total={s.runs} /></div>
            <div><h4 className="mb-1 font-cond text-sm font-bold uppercase">Carabao Cup</h4><Bars labels={EFL_STAGES} counts={s.eflStages} total={s.runs} /></div>
          </div>
          <div><h4 className="mb-1 font-cond text-sm font-bold uppercase">Títulos por temporada</h4><Bars labels={["0", "1", "2", "3", "4"]} counts={s.titleCountDist} total={s.runs} /></div>
          <p className="text-[11px] leading-snug text-dim">Frecuencias del videojuego, no predicciones reales. IC95% de Wilson; con 0 éxitos el límite superior ≈ 3/N (regla del tres). Para sucesos raros (quadruple) usa 2.000 temporadas.</p>
        </div>
      )}
    </section>
  );
}
