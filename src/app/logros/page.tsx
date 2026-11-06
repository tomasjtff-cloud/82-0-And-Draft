"use client";
import { useEffect, useMemo, useState } from "react";
import { TrophyIcon } from "@/components/common/TrophyIcon";
import { ACHIEVEMENTS, evaluateAll, profilePoints, TIER_ES, TIER_POINTS, TOTAL_POINTS, type AchProgress } from "@/lib/progress/achievements";
import { loadProgress } from "@/lib/progress/store";
import type { Progress } from "@/lib/progress/types";

type F = "all" | "nba" | "fb" | "done" | "todo" | "secret";
const FILTERS: [F, string][] = [["all", "Todos"], ["nba", "NBA 82-0"], ["fb", "Draft de fútbol"], ["done", "Desbloqueados"], ["todo", "Pendientes"], ["secret", "Secretos"]];
const TIER_CLS: Record<string, string> = { bronze: "text-[#e0a46a]", silver: "text-[#d6dde6]", gold: "text-gold-2", platinum: "text-[#9fe7ff]" };

export default function AchievementsPage() {
  const [p, setP] = useState<Progress | null>(null);
  const [f, setF] = useState<F>("all");
  useEffect(() => setP(loadProgress()), []);
  const ev = useMemo<Record<string, AchProgress>>(() => (p ? evaluateAll(p) : {}), [p]);
  if (!p) return <div className="mx-auto max-w-5xl px-4 py-10 text-muted">Cargando logros…</div>;
  const pts = profilePoints(p), unlocked = Object.keys(p.achievements).length;
  const list = ACHIEVEMENTS.filter((a) => {
    const done = !!p.achievements[a.id];
    if (f === "nba") return a.game === "nba" || a.game === "both";
    if (f === "fb") return a.game === "fb" || a.game === "both";
    if (f === "done") return done; if (f === "todo") return !done; if (f === "secret") return !!a.secret;
    return true;
  });
  return (
    <div className="mx-auto max-w-5xl px-4 py-8" data-testid="achievements-page">
      <h1 className="font-display text-5xl">LOGROS</h1>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-lg">
        <div className="panel p-3 text-center"><div className="text-[10px] uppercase text-muted">Desbloqueados</div><div className="font-display text-2xl" data-testid="ach-unlocked">{unlocked}/{ACHIEVEMENTS.length}</div></div>
        <div className="panel p-3 text-center"><div className="text-[10px] uppercase text-muted">Puntos</div><div className="font-display text-2xl" data-testid="ach-points">{pts}/{TOTAL_POINTS}</div></div>
        <div className="panel p-3 text-center"><div className="text-[10px] uppercase text-muted">Completado</div><div className="font-display text-2xl">{Math.round((pts / TOTAL_POINTS) * 100)}%</div></div>
      </div>
      <div className="mt-4 flex gap-1 overflow-x-auto pb-1 scrollbar-thin" role="tablist">
        {FILTERS.map(([k, l]) => <button key={k} role="tab" aria-selected={f === k} onClick={() => setF(k)} className={`chip shrink-0 min-h-[36px] ${f === k ? "border-gold bg-gold/15 text-text" : "text-muted"}`} data-testid={`ach-filter-${k}`}>{l}</button>)}
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2" data-testid="ach-list">
        {list.map((a) => {
          const u = p.achievements[a.id], e = ev[a.id], hidden = a.secret && !u;
          return (
            <li key={a.id} className={`flex items-start gap-3 rounded-2xl border p-3 ${u ? "border-gold/40 bg-gradient-to-br from-gold/10 to-transparent" : "border-line bg-white/[.03]"}`} data-testid="ach-item" data-unlocked={u ? "true" : "false"}>
              <TrophyIcon kind={hidden ? "star" : a.icon} size={44} locked={!u} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-cond text-base font-bold uppercase">{hidden ? "Logro secreto" : a.name}</span>
                  <span className={`shrink-0 font-cond text-[11px] font-bold uppercase ${TIER_CLS[a.tier]}`}>{TIER_ES[a.tier]} · {TIER_POINTS[a.tier]}</span>
                </div>
                <p className="text-xs text-muted">{hidden ? "Sigue jugando para descubrirlo." : a.desc}</p>
                <div className="mt-1 text-[11px] text-dim">{a.game === "nba" ? "NBA 82-0" : a.game === "fb" ? "Draft de fútbol" : "NBA + fútbol"}{u ? ` · desbloqueado el ${new Date(u.at).toLocaleDateString("es-ES")}` : ""}</div>
                {!u && !hidden && e && e.target > 1 && (
                  <div className="mt-1.5"><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gold" style={{ width: `${Math.round((e.cur / e.target) * 100)}%` }} /></div><div className="mt-0.5 font-mono text-[10px] text-muted">{Math.round(e.cur * 10) / 10}/{e.target}</div></div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-xs text-muted">Los logros se calculan con tus temporadas y drafts guardados en este navegador. Los puntos solo representan tu progreso: no cambian la dificultad ni las probabilidades.</p>
    </div>
  );
}
