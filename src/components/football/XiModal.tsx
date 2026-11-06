"use client";
import { useMemo, useState } from "react";
import { Sheet } from "@/components/common/Sheet";
import type { FbPlayerSeason } from "@/types/football";
import { FORMATION_BY_ID } from "@/lib/data/football/formations";
import { HIST_CLUB_BY_ID, leagueOf } from "@/lib/data/football/clubs";
import { DIFFICULTY_PARAMS, type Difficulty } from "@/lib/core/difficulty";
import { chemistryEffect, chemistryLinks, computeChemistry, teamRatings } from "@/lib/ratings/football";
import { lineupOf, type FbSquadSnapshot } from "@/features/football-draft/squad";
import { ChemLegend, Pitch } from "./Pitch";

export interface XiSource { formationId: string; lineup: Record<string, string>; captainId: string | null; difficulty: Difficulty; title?: string }

export function XiButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return <button className="btn btn-sm" onClick={onClick} disabled={disabled} data-testid="view-xi">⚽ <span className="sm:hidden">Mi XI</span><span className="hidden sm:inline">Ver mi XI</span></button>;
}

export const xiFromSnapshot = (s: FbSquadSnapshot): XiSource => ({ formationId: s.formationId, lineup: s.lineup, captainId: s.captainId, difficulty: s.difficulty, title: s.clubName });

/** "VER MI XI": full pitch with the eleven in their positions, chemistry mode and per-player details. */
export function XiModal({ open, onClose, xi, children }: { open: boolean; onClose: () => void; xi: XiSource | null; children?: React.ReactNode }) {
  const [chemMode, setChemMode] = useState(true);
  const [focus, setFocus] = useState<string | null>(null);
  const data = useMemo(() => {
    if (!xi) return null;
    const fm = FORMATION_BY_ID[xi.formationId];
    const lc: Record<string, FbPlayerSeason | undefined> = lineupOf(xi.lineup);
    const chem = computeChemistry(fm, lc, leagueOf, xi.captainId);
    const sens = DIFFICULTY_PARAMS[xi.difficulty].fbFitSensitivity;
    return { fm, lc, chem, r: teamRatings(fm, lc, chem.total, sens), links: chemistryLinks(fm, lc, leagueOf), effect: chemistryEffect(chem.total, sens) };
  }, [xi]);
  return (
    <Sheet open={open} onClose={onClose} title={xi?.title ? `Mi XI · ${xi.title}` : "Mi XI"} testId="xi-modal">
      {!data || !xi ? <p className="text-sm text-muted">Aún no hay jugadores elegidos.</p> : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            {[["Formación", xi.formationId], ["Team OVR", data.r.ovr], ["Ataque", data.r.attack], ["Medio", data.r.midfield], ["Defensa", data.r.defense], ["Química", `${data.chem.total}/33`]].map(([k, v]) => (
              <div key={k as string} className="rounded-xl bg-white/5 py-2"><div className="font-cond text-[10px] font-bold uppercase text-muted">{k}</div><div className="font-display text-2xl tabular" data-testid={k === "Química" ? "xi-chem" : undefined}>{v}</div></div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className={`btn btn-sm ${chemMode ? "border-win text-win" : ""}`} onClick={() => setChemMode((v) => !v)} data-testid="toggle-chem-mode">⚗ Modo química {chemMode ? "ON" : "OFF"}</button>
            {chemMode && <ChemLegend />}
          </div>
          <div className="mx-auto max-w-md">
            <Pitch formation={data.fm} lineup={data.lc} chem={data.chem.perSlot} captainId={xi.captainId} chemMode={chemMode} links={data.links} focus={focus} onSlotClick={(id) => setFocus(focus === id ? null : id)} />
          </div>
          <p className="text-xs text-muted">La química total ({data.chem.total}/33) suma <b className={data.effect >= 0 ? "text-win" : "text-loss"}>{data.effect >= 0 ? "+" : ""}{data.effect}</b> al ataque y a la defensa del motor de partido (fórmula (química/33 − 0,6)·4). Toca un jugador para ver solo sus vínculos.</p>
          <ul className="divide-y divide-line" data-testid="xi-list">
            {data.fm.slots.map((s) => {
              const c = data.lc[s.id];
              if (!c) return <li key={s.id} className="py-2 text-sm text-muted">{s.pos} · vacío</li>;
              return (
                <li key={s.id} className={`flex items-start gap-3 py-2 ${focus === s.id ? "bg-white/5" : ""}`} data-testid="xi-row">
                  <span className="w-10 shrink-0 font-display text-lg text-gold">{s.pos}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-cond text-base font-bold uppercase">{c.name}{xi.captainId === c.id && <span className="ml-1 rounded bg-gold px-1 text-[10px] text-black">C</span>}</span>
                    <span className="block truncate text-xs text-muted">{HIST_CLUB_BY_ID[c.clubId]?.name} · {c.season} · {c.nation}</span>
                    <span className="block text-[11px] text-dim">{data.chem.links[s.id]?.join(", ") || "sin vínculos"}</span>
                  </span>
                  <span className="text-right"><span className="block font-display text-2xl leading-none">{c.ovr}</span><span className="font-mono text-[11px] text-win">quím {data.chem.perSlot[s.id] ?? 0}/3</span></span>
                </li>
              );
            })}
          </ul>
          {children}
        </div>
      )}
    </Sheet>
  );
}
