"use client";
import { useMemo } from "react";
import { Sheet } from "@/components/common/Sheet";
import type { FbPlayerSeason, Formation } from "@/types/football";
import { previewFbPick } from "@/lib/ratings/football";
import { leagueOf } from "@/lib/data/football/clubs";
import { FbCardView, GK_LABELS, OUT_LABELS } from "./FbCardView";

/** Candidate detail + REAL chemistry preview (same engine) + optional side-by-side comparison. */
export function FbPlayerSheet({ card, compareWith, formation, lineup, slotId, captainId, fitSensitivity, chemWeight = 1, pickLabel = "Elegir", onPick, onClose }: {
  card: FbPlayerSeason | null; compareWith?: FbPlayerSeason | null; formation: Formation; lineup: Record<string, FbPlayerSeason | undefined>;
  slotId: string | null; captainId: string | null; fitSensitivity: number; chemWeight?: number; pickLabel?: string; onPick: (c: FbPlayerSeason) => void; onClose: () => void;
}) {
  const p = useMemo(() => (card && slotId ? previewFbPick(formation, lineup, slotId, card, leagueOf, captainId, fitSensitivity, chemWeight) : null), [card, slotId, formation, lineup, captainId, fitSensitivity, chemWeight]);
  const q = useMemo(() => (compareWith && slotId ? previewFbPick(formation, lineup, slotId, compareWith, leagueOf, captainId, fitSensitivity, chemWeight) : null), [compareWith, slotId, formation, lineup, captainId, fitSensitivity, chemWeight]);
  const nameOf = (id: string) => lineup[id]?.name ?? card?.name ?? id;
  return (
    <Sheet open={!!card} onClose={onClose} title={card?.name ?? ""} testId="fb-player-sheet">
      {card && (
        <div className="space-y-4">
          {p && (
            <div className="panel p-4" data-testid="fb-chem-preview">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-cond text-sm font-bold uppercase tracking-wide">Química del XI</span>
                <span className="font-mono text-sm">{p.before} → <b className={p.delta > 0 ? "text-win" : p.delta < 0 ? "text-loss" : ""} data-testid="fb-chem-after">{p.after}</b>/33 <span className={p.delta > 0 ? "text-win" : p.delta < 0 ? "text-loss" : "text-muted"}>({p.delta > 0 ? "+" : ""}{p.delta})</span></span>
              </div>
              <p className="mt-1 text-sm">{p.delta !== 0 ? `Elegir a ${card.name} ${p.delta > 0 ? "aumenta" : "reduce"} tu química de ${p.before} a ${p.after}. ` : `Tu química se mantiene en ${p.before}. `}Su química individual: <b>{p.ownChem}/3</b>.</p>
              <ul className="mt-1 space-y-0.5 text-sm">{p.reasons.map((r) => <li key={r} className={r.startsWith("Fuera") ? "text-loss" : "text-muted"}>• {r}</li>)}</ul>
              {p.changes.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5">{p.changes.map((c) => <li key={c.slotId} className={`chip ${c.to > c.from ? "text-win" : "text-loss"}`}>{c.name} {c.from}→{c.to}</li>)}</ul>}
              {Object.values(lineup).filter(Boolean).length > 0 && <p className="mt-2 text-[11px] text-muted">Ataque del equipo {p.attBefore.toFixed(1)} → {p.attAfter.toFixed(1)} · Defensa {p.defBefore.toFixed(1)} → {p.defAfter.toFixed(1)} (motor de partido; con XI incompleto es una media de los elegidos)</p>}
              {p.newLinks.length > 0 && <p className="mt-1 text-[11px] text-muted">Nuevos vínculos: {p.newLinks.map((l) => `${nameOf(l.a === slotId ? l.b : l.a)} (${l.kinds.map((k) => (k === "club" ? "club" : k === "nation" ? "nación" : "liga")).join("+")})`).join(", ")}</p>}
            </div>
          )}
          {compareWith && q && p ? (
            <div className="panel overflow-x-auto p-3" data-testid="fb-compare">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase text-muted"><th /><th className="truncate">{card.name}</th><th className="truncate">{compareWith.name}</th></tr></thead>
                <tbody className="font-mono tabular">
                  {[["OVR", card.ovr, compareWith.ovr], ...((card.gk ? GK_LABELS : OUT_LABELS).map(([k, es]) => [es, (card.gk ?? card.attrs)![k.toLowerCase() as never] as number, ((compareWith.gk ?? compareWith.attrs) as Record<string, number> | null)?.[k.toLowerCase()] ?? 0])), ["Química XI", p.after, q.after], ["Quím. propia", p.ownChem, q.ownChem]].map(([k, a, b]) => (
                    <tr key={k as string} className="border-t border-line"><td className="py-1 font-sans text-xs text-muted">{k}</td><td className={(a as number) > (b as number) ? "text-win" : ""}>{a}</td><td className={(b as number) > (a as number) ? "text-win" : ""}>{b}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="mx-auto max-w-sm"><FbCardView card={card} /></div>
          <div className="sticky -bottom-5 z-10 -mx-5 border-t border-line bg-surface px-5 pb-5 pt-3">
            <button className="btn btn-gold w-full py-3 text-base" onClick={() => onPick(card)} data-testid={`fb-pick-${card.id}`}>{pickLabel} · {card.name}</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
