"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Sheet } from "@/components/common/Sheet";
import { TrophyIcon, type TrophyKind } from "@/components/common/TrophyIcon";
import { Celebration } from "@/components/common/Celebration";
import { scoreline } from "@/features/football-simulation/match";
import { finalOdds, upcomingFinal, userFinals } from "@/features/football-simulation/finals";
import { BENCH_KEY } from "@/features/football-simulation/events";
import type { SeasonState } from "@/features/football-simulation/season";
import type { CompId, Match } from "@/types/football";

export const COMP_ES: Record<CompId, string> = { PL: "Premier League", UCL: "Champions League", FA: "FA Cup", EFL: "Carabao Cup" };
const ICON: Record<CompId, TrophyKind> = { PL: "pl", UCL: "ucl", FA: "fa", EFL: "efl" };
const pct = (x: number) => `${Math.round(x * 100)}%`;
const nameOfKey = (s: SeasonState, k: string) => (k === BENCH_KEY ? "Suplente" : s.squad?.find((m) => m.slotId === k)?.name ?? k);
const userWon = (s: SeasonState, m: Match) => {
  const h = m.hg + (m.et?.hg ?? 0), a = m.ag + (m.et?.ag ?? 0); const uh = m.home === s.userId;
  if (h !== a) return uh ? h > a : a > h;
  return !!m.pens && (uh ? m.pens.h > m.pens.a : m.pens.a > m.pens.h);
};

/** VS screen before a final (live season). Probabilities are the engine's exact 90' odds. */
export function FinalPreview({ s, onOpenXi }: { s: SeasonState; onOpenXi?: () => void }) {
  const f = upcomingFinal(s);
  if (!f) return null;
  const u = s.teams[s.userId], o = s.teams[f.opponent], p = finalOdds(s, f.opponent);
  const row = (k: string, a: number, b: number) => <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm"><span className={`text-right font-mono ${a >= b ? "text-win" : ""}`}>{Math.round(a)}</span><span className="text-[11px] uppercase text-muted">{k}</span><span className={`font-mono ${b >= a ? "text-win" : ""}`}>{Math.round(b)}</span></div>;
  return (
    <motion.section initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="panel relative overflow-hidden border-gold/60 p-5" data-testid="final-preview">
      <div className="text-center font-cond text-xs font-bold uppercase tracking-[.3em] text-gold-2">Final · {COMP_ES[f.comp]} · {f.date} · campo neutral</div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-right font-display text-2xl leading-tight sm:text-4xl">{u.name}</div>
        <div className="flex flex-col items-center"><TrophyIcon kind={ICON[f.comp]} size={56} /><span className="font-display text-xl text-gold">VS</span></div>
        <div className="font-display text-2xl leading-tight sm:text-4xl">{o.name}</div>
      </div>
      <div className="mx-auto mt-3 max-w-sm space-y-1">{row("Media", u.rating, o.rating)}{row("Ataque", u.att, o.att)}{row("Defensa", u.def, o.def)}</div>
      <div className="mx-auto mt-3 max-w-sm" data-testid="final-odds">
        <div className="flex h-2 overflow-hidden rounded-full" aria-hidden><span className="bg-win" style={{ width: pct(p.win) }} /><span className="bg-white/30" style={{ width: pct(p.draw) }} /><span className="bg-loss" style={{ width: pct(p.loss) }} /></div>
        <p className="mt-1 text-center font-mono text-sm">Ganar en 90' {pct(p.win)} · Empate {pct(p.draw)} · Perder {pct(p.loss)}</p>
        <p className="text-center text-[11px] text-muted">Probabilidad exacta del motor para los 90 minutos (sin fatiga). Si hay empate: prórroga y penales.</p>
      </div>
      {onOpenXi && <div className="mt-3 text-center"><button className="btn btn-sm" onClick={onOpenXi}>Ver mi XI</button></div>}
    </motion.section>
  );
}

/** Post-final report built only from the simulated events of that match. */
export function FinalReport({ s, m, onClose, onOpenXi }: { s: SeasonState; m: Match | null; onClose: () => void; onOpenXi?: () => void }) {
  const [step, setStep] = useState(0);
  const won = m ? userWon(s, m) : false;
  const goals = m?.detail?.goals ?? [];
  const reduced = typeof window !== "undefined" && (document.documentElement.dataset.reducedMotion === "true" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (!m) return; setStep(reduced ? 99 : 0);
    if (reduced) return;
    const t = setInterval(() => setStep((x) => (x > goals.length + 1 ? x : x + 1)), 650);
    return () => clearInterval(t);
  }, [m, goals.length, reduced]);
  if (!m) return null;
  const name = (id: string) => s.teams[id]?.name ?? id;
  const uh = m.home === s.userId;
  const lines = (m.detail?.lines ?? []).filter((l) => l.key !== BENCH_KEY && l.min > 0);
  const motm = [...lines].sort((a, b) => b.rating - a.rating)[0];
  const cards = lines.filter((l) => l.yellow || l.red);
  return (
    <Sheet open={!!m} onClose={onClose} title={`Final · ${COMP_ES[m.comp]}`} testId="final-report">
      <Celebration active={won} colors={["#d9b45a", "#f3dc94", "#ffffff"]} durationMs={4000} />
      <div className="space-y-4">
        <div className="text-center">
          <TrophyIcon kind={ICON[m.comp]} size={72} locked={!won} />
          <div className="mt-1 font-display text-3xl">{name(m.home)} <span className="text-gold">{scoreline(m)}</span> {name(m.away)}</div>
          <div className={`font-cond text-lg font-bold uppercase ${won ? "text-win" : "text-loss"}`} data-testid="final-outcome">{won ? "¡Campeones!" : "Subcampeones"}</div>
        </div>
        {m.detail ? (
          <>
            <ol className="space-y-1" data-testid="final-timeline">
              <li className="text-xs text-muted">0' · Comienza la final</li>
              {goals.map((g, i) => i < step && (
                <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="text-sm">⚽ <b className="font-mono">{g.minute}'</b> {nameOfKey(s, g.scorer)}{g.penalty ? " (pen.)" : ""}{g.assist ? <span className="text-muted"> · asist. {nameOfKey(s, g.assist)}</span> : ""}{g.extraTime ? <span className="text-gold-2"> · prórroga</span> : ""}</motion.li>
              ))}
              {step > goals.length && <>
                {m.et && <li className="text-xs text-gold-2">Prórroga: {uh ? m.et.hg : m.et.ag}-{uh ? m.et.ag : m.et.hg} para tu equipo</li>}
                {m.pens && <li className="text-xs text-gold-2">Penales: {uh ? m.pens.h : m.pens.a}-{uh ? m.pens.a : m.pens.h} para tu equipo</li>}
                <li className="text-xs text-muted">Final del partido</li>
              </>}
            </ol>
            {step <= goals.length && <button className="btn btn-ghost btn-sm" onClick={() => setStep(99)} data-testid="final-skip">Saltar animación</button>}
            <p className="text-[11px] text-muted">Goles de tu equipo con minuto y asistencia, generados por el simulador. Los goles del rival no tienen autoría individual (no se simulan jugadores rivales).</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {motm && <div className="rounded-xl bg-gold/15 p-3"><div className="text-[10px] uppercase text-muted">Jugador del partido (tu equipo)</div><div className="font-cond text-lg font-bold uppercase" data-testid="final-motm">{nameOfKey(s, motm.key)}</div><div className="font-mono text-xs">nota {motm.rating.toFixed(1)} · {motm.goals} G · {motm.assists} A</div></div>}
              <div className="rounded-xl bg-white/5 p-3 text-sm"><div className="text-[10px] uppercase text-muted">Estadísticas</div>Tiros {m.detail.shots} ({m.detail.sot} a puerta) · rival {m.detail.oppShots} ({m.detail.oppSot}) · posesión {m.detail.possession}%</div>
            </div>
            {cards.length > 0 && <p className="text-sm">Tarjetas: {cards.map((l) => `${nameOfKey(s, l.key)} (${l.red ? "roja" : "amarilla"})`).join(", ")}</p>}
          </>
        ) : <p className="text-sm text-muted">Esta temporada se jugó con una versión anterior sin eventos individuales.</p>}
        {onOpenXi && <button className="btn btn-sm" onClick={onOpenXi}>Ver mi XI</button>}
      </div>
    </Sheet>
  );
}

export function FinalsList({ s, onOpen }: { s: SeasonState; onOpen: (m: Match) => void }) {
  const fs = userFinals(s);
  if (!fs.length) return null;
  return (
    <section className="space-y-2" data-testid="finals-list">
      <h3 className="font-cond text-lg font-bold uppercase tracking-wide">Finales</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {fs.map((m) => { const w = userWon(s, m); return (
          <li key={m.id}><button onClick={() => onOpen(m)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${w ? "border-gold/50 bg-gold/10" : "border-line bg-white/5"}`} data-testid="final-row">
            <TrophyIcon kind={ICON[m.comp]} size={36} locked={!w} />
            <span className="min-w-0 flex-1"><span className="block font-cond font-bold uppercase">{COMP_ES[m.comp]} · {w ? "Campeón" : "Subcampeón"}</span><span className="block truncate text-xs text-muted">{s.teams[m.home]?.name} {scoreline(m)} {s.teams[m.away]?.name}</span></span>
          </button></li>
        ); })}
      </ul>
    </section>
  );
}
