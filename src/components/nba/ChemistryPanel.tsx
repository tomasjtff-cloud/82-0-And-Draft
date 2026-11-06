"use client";
import type { FitItem, NbaTeamEval } from "@/lib/ratings/nba";

const ICON: Record<FitItem["status"], { i: string; cls: string }> = {
  bonus: { i: "▲", cls: "text-win" }, ok: { i: "✓", cls: "text-win/80" }, pending: { i: "…", cls: "text-gold-2" }, penalty: { i: "▼", cls: "text-loss" },
};

/** Real, engine-backed explanation of team fit (values are net-rating points used by the simulator). */
export function ChemistryPanel({ ev, compact }: { ev: NbaTeamEval; compact?: boolean }) {
  const applied = ev.fit.reduce((s, i) => s + i.value, 0);
  return (
    <div className="panel p-4" data-testid="chemistry-panel">
      <div className="flex items-baseline justify-between">
        <span className="font-cond text-sm font-bold uppercase tracking-wide">Química</span>
        <span className="font-display text-3xl tabular" data-testid="chemistry-value">{ev.chemistry}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-loss via-gold to-win" style={{ width: `${ev.chemistry}%` }} /></div>
      <p className="mt-1 text-[11px] text-muted">Química = 70 + 8 × (suma de ajustes). Ajuste aplicado al rating neto: <b className={applied >= 0 ? "text-win" : "text-loss"}>{applied >= 0 ? "+" : ""}{applied.toFixed(1)}</b> pts/100 posesiones.</p>
      {ev.fit.length === 0 ? <p className="mt-2 text-xs text-muted">Elige tu primer jugador para ver el encaje.</p> : (
        <ul className="mt-3 space-y-1.5">
          {ev.fit.map((it) => (
            <li key={it.key} className="flex gap-2 text-xs" data-testid={`fit-${it.key}`} data-status={it.status}>
              <span className={`w-4 shrink-0 font-bold ${ICON[it.status].cls}`}>{ICON[it.status].i}</span>
              <span className="min-w-0 flex-1"><b className="font-cond uppercase tracking-wide">{it.label}</b> <span className="text-muted">— {it.detail}</span></span>
              {it.value !== 0 && <span className={`shrink-0 font-mono ${it.value > 0 ? "text-win" : "text-loss"}`}>{it.value > 0 ? "+" : ""}{it.value.toFixed(1)}</span>}
            </li>
          ))}
        </ul>
      )}
      {!compact && ev.roles.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <div className="font-cond text-xs font-bold uppercase tracking-wide text-muted">Quién aporta qué</div>
          <ul className="mt-1 space-y-0.5 text-xs">
            {ev.roles.map((r) => <li key={r.pos}><b className="text-nba-2">{r.pos}</b> {r.name}: <span className="text-muted">{r.brings.join(", ") || "complemento"}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
