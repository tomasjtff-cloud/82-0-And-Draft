"use client";
import { useMemo } from "react";
import { Sheet } from "@/components/common/Sheet";
import type { FbPlayerSeason, Formation } from "@/types/football";
import type { Difficulty } from "@/lib/core/difficulty";
import { HIST_CLUB_BY_ID } from "@/lib/data/football/clubs";
import { KIND_ES, type ChemRules } from "@/lib/ratings/football";
import { contrast, pickImpact, type PickImpact } from "@/features/football-draft/compare";
import { FbCardView, GK_LABELS, OUT_LABELS } from "./FbCardView";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const sign = (x: number, d = 1) => `${x > 0 ? "+" : ""}${x.toFixed(d)}`;

/** Projected impact of one candidate on the XI (all numbers from the real chemistry/ratings/match functions). */
function ImpactBlock({ card, imp, testId }: { card: FbPlayerSeason; imp: PickImpact; testId: string }) {
  const p = imp.preview;
  const rows: [string, string, number][] = [
    ["Química individual", `${p.ownChem}/3`, 0],
    ["Química del XI", `${p.before} → ${p.after}`, p.delta],
    ["Media del equipo", `${imp.before.ovr} → ${imp.after.ovr}`, imp.after.ovr - imp.before.ovr],
    ["Ataque", `${imp.before.attack} → ${imp.after.attack}`, imp.after.attack - imp.before.attack],
    ["Mediocampo", `${imp.before.midfield} → ${imp.after.midfield}`, imp.after.midfield - imp.before.midfield],
    ["Defensa", `${imp.before.defense} → ${imp.after.defense}`, imp.after.defense - imp.before.defense],
    ["Encaje posicional", pct(imp.fit), imp.fit >= 1 ? 1 : imp.fit < 0.9 ? -1 : 0],
  ];
  return (
    <div data-testid={testId}>
      <div className="mb-1 truncate font-cond text-sm font-bold uppercase">{card.name}</div>
      <dl className="divide-y divide-line text-sm">
        {rows.map(([k, v, d]) => (
          <div key={k} className="flex items-center justify-between gap-2 py-1">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className={`font-mono tabular ${d > 0 ? "text-win" : d < 0 ? "text-loss" : ""}`}>{v}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2 py-1"><dt className="text-xs text-muted">Motor (ATT / DEF)</dt><dd className="font-mono text-xs tabular">{sign(imp.after.att - imp.before.att)} / {sign(imp.after.def - imp.before.def)}</dd></div>
      </dl>
      {imp.probs && (
        <div className="mt-2 rounded-lg bg-white/5 p-2 text-xs" data-testid={`${testId}-probs`}>
          <div className="flex h-2 overflow-hidden rounded-full" aria-hidden>
            <span className="bg-win" style={{ width: pct(imp.probs.win) }} /><span className="bg-white/30" style={{ width: pct(imp.probs.draw) }} /><span className="bg-loss" style={{ width: pct(imp.probs.loss) }} />
          </div>
          <div className="mt-1 font-mono">V {pct(imp.probs.win)} · E {pct(imp.probs.draw)} · D {pct(imp.probs.loss)}</div>
        </div>
      )}
    </div>
  );
}

/** Candidate detail + real chemistry preview + side-by-side comparison with projected impact. */
export function FbPlayerSheet({ card, compareWith, formation, lineup, slotId, captainId, difficulty, rules, pickLabel = "Elegir", onPick, onClose }: {
  card: FbPlayerSeason | null; compareWith?: FbPlayerSeason | null; formation: Formation; lineup: Record<string, FbPlayerSeason | undefined>;
  slotId: string | null; captainId: string | null; difficulty: Difficulty; rules: ChemRules; pickLabel?: string; onPick: (c: FbPlayerSeason) => void; onClose: () => void;
}) {
  const imp = useMemo(() => (card && slotId ? pickImpact(formation, lineup, slotId, card, captainId, difficulty, rules) : null), [card, slotId, formation, lineup, captainId, difficulty, rules]);
  const imp2 = useMemo(() => (compareWith && slotId ? pickImpact(formation, lineup, slotId, compareWith, captainId, difficulty, rules) : null), [compareWith, slotId, formation, lineup, captainId, difficulty, rules]);
  const p = imp?.preview;
  const nameOf = (id: string) => lineup[id]?.name ?? card?.name ?? id;
  const cmp = card && compareWith ? [contrast(card, compareWith), contrast(compareWith, card)] : null;
  return (
    <Sheet open={!!card} onClose={onClose} title={compareWith ? "Comparar jugadores" : card?.name ?? ""} testId="fb-player-sheet">
      {card && (
        <div className="space-y-4">
          {p && !compareWith && (
            <div className="panel p-4" data-testid="fb-chem-preview">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-cond text-sm font-bold uppercase tracking-wide">Química del XI</span>
                <span className="font-mono text-sm">{p.before} → <b className={p.delta > 0 ? "text-win" : p.delta < 0 ? "text-loss" : ""} data-testid="fb-chem-after">{p.after}</b>/33 <span className={p.delta > 0 ? "text-win" : p.delta < 0 ? "text-loss" : "text-muted"}>({p.delta > 0 ? "+" : ""}{p.delta})</span></span>
              </div>
              <p className="mt-1 text-sm">{p.delta !== 0 ? `Elegir a ${card.name} ${p.delta > 0 ? "aumenta" : "reduce"} tu química de ${p.before} a ${p.after}. ` : `Tu química se mantiene en ${p.before}. `}Su química individual: <b>{p.ownChem}/3</b>.</p>
              <ul className="mt-1 space-y-0.5 text-sm">{p.reasons.map((r) => <li key={r} className={r.startsWith("Fuera") ? "text-loss" : "text-muted"}>• {r}</li>)}</ul>
              {p.changes.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5">{p.changes.map((c) => <li key={c.slotId} className={`chip ${c.to > c.from ? "text-win" : "text-loss"}`}>{c.name} {c.from}→{c.to}</li>)}</ul>}
              {p.newLinks.length > 0 && <p className="mt-1 text-[11px] text-muted">Nuevos vínculos: {p.newLinks.map((l) => `${nameOf(l.a === slotId ? l.b : l.a)} (${l.kinds.map((k) => KIND_ES[k]).join("+")})`).join(", ")}</p>}
            </div>
          )}
          {imp && !compareWith && (
            <div className="panel p-4"><div className="mb-2 font-cond text-sm font-bold uppercase tracking-wide">Impacto en tu XI</div><ImpactBlock card={card} imp={imp} testId="fb-impact" /></div>
          )}
          {compareWith && imp && imp2 && cmp ? (
            <div className="space-y-3" data-testid="fb-compare">
              <div className="panel overflow-x-auto p-3">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase text-muted"><th /><th className="max-w-[9rem] truncate">{card.name}</th><th className="max-w-[9rem] truncate">{compareWith.name}</th></tr></thead>
                  <tbody className="font-mono tabular">
                    <tr className="border-t border-line"><td className="py-1 font-sans text-xs text-muted">Club</td><td className="font-sans text-xs">{HIST_CLUB_BY_ID[card.clubId]?.name} {card.season}</td><td className="font-sans text-xs">{HIST_CLUB_BY_ID[compareWith.clubId]?.name} {compareWith.season}</td></tr>
                    <tr className="border-t border-line"><td className="py-1 font-sans text-xs text-muted">Posición</td><td>{card.positions.join("/")}</td><td>{compareWith.positions.join("/")}</td></tr>
                    {[["OVR", card.ovr, compareWith.ovr], ...((card.gk ? GK_LABELS : OUT_LABELS).map(([k, es]) => [es, ((card.gk ?? card.attrs) as unknown as Record<string, number>)[k.toLowerCase()] ?? 0, ((compareWith.gk ?? compareWith.attrs) as unknown as Record<string, number> | null)?.[k.toLowerCase()] ?? 0]))].map(([k, a, b]) => (
                      <tr key={k as string} className="border-t border-line"><td className="py-1 font-sans text-xs text-muted">{k}</td><td className={(a as number) > (b as number) ? "text-win" : ""}>{a}</td><td className={(b as number) > (a as number) ? "text-win" : ""}>{b}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-[10px] text-muted">* Atributos estimados por Legends Lab.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[[card, imp, cmp[0], "fb-impact-a"], [compareWith, imp2, cmp[1], "fb-impact-b"]].map(([c, i, k, tid]) => {
                  const cc = c as FbPlayerSeason, ii = i as PickImpact, kk = k as { better: string[]; worse: string[] };
                  return (
                    <div key={tid as string} className="panel min-w-0 p-3">
                      <ImpactBlock card={cc} imp={ii} testId={tid as string} />
                      {kk.better.length > 0 && <p className="mt-2 text-[11px] text-win">▲ {kk.better.join(", ")}</p>}
                      {kk.worse.length > 0 && <p className="text-[11px] text-loss">▼ {kk.worse.join(", ")}</p>}
                      <button className="btn btn-gold mt-3 w-full py-2 text-sm" onClick={() => onPick(cc)} data-testid={`fb-pick-${cc.id}`}>{pickLabel}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {(imp?.probs || imp2?.probs) && <p className="text-[11px] text-muted">Probabilidad exacta del motor (Poisson + forma integrada) de un partido de Premier League en casa contra un rival de referencia: la media de los 20 clubes a esta dificultad, sin fatiga y con táctica Equilibrado.{imp && imp.placed < 11 ? ` XI parcial (${imp.placed}/11): la media se calcula con los jugadores elegidos.` : ""} No decide por ti: compara química, encaje y estilo.</p>}
          {!compareWith && <div className="mx-auto max-w-sm"><FbCardView card={card} /></div>}
          {!compareWith && (
            <div className="sticky -bottom-5 z-10 -mx-5 border-t border-line bg-surface px-5 pb-5 pt-3">
              <button className="btn btn-gold w-full py-3 text-base" onClick={() => onPick(card)} data-testid={`fb-pick-${card.id}`}>{pickLabel} · {card.name}</button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
