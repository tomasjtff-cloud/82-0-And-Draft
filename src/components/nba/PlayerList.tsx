"use client";
import { useMemo, useState } from "react";
import type { NbaCard, NbaPos } from "@/types/nba";
import { NBA_POSITIONS } from "@/types/nba";
import { tierOf } from "./NbaCardView";

type SortKey = "ovr" | "ppg" | "rpg" | "apg" | "tp";
const SORTS: [SortKey, string][] = [["ovr", "OVR"], ["ppg", "PTS"], ["rpg", "REB"], ["apg", "AST"], ["tp", "3P%"]];

/** Compact, filterable player list for the current spin (one row per player). */
export function PlayerList({ cards, placeable, onOpen, versionCount }: { cards: NbaCard[]; placeable: (c: NbaCard) => NbaPos[]; onOpen: (c: NbaCard) => void; versionCount: (c: NbaCard) => number }) {
  const [pos, setPos] = useState<NbaPos | "ALL">("ALL");
  const [sort, setSort] = useState<SortKey>("ovr");
  const shown = useMemo(() => {
    const val = (c: NbaCard) => (sort === "ovr" ? c.ratings.overall : sort === "tp" ? c.tpPct ?? -1 : c[sort]);
    return cards.filter((c) => pos === "ALL" || c.positions.includes(pos)).sort((a, b) => val(b) - val(a));
  }, [cards, pos, sort]);
  return (
    <div data-testid="player-list">
      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin" role="group" aria-label="Filtrar por posición">
        {(["ALL", ...NBA_POSITIONS] as const).map((p) => (
          <button key={p} onClick={() => setPos(p)} className={`chip shrink-0 ${pos === p ? "border-nba bg-nba/20 text-text" : "text-muted"}`} data-testid={`filter-${p}`}>{p === "ALL" ? "Todas" : p}</button>
        ))}
        <span className="mx-1 w-px shrink-0 bg-line" />
        {SORTS.map(([k, l]) => (
          <button key={k} onClick={() => setSort(k)} className={`chip shrink-0 ${sort === k ? "border-white/60 text-text" : "text-muted"}`}>↓{l}</button>
        ))}
      </div>
      <ul className="divide-y divide-line">
        {shown.map((c) => {
          const pl = placeable(c);
          const t = tierOf(c.ratings.overall);
          return (
            <li key={c.id}>
              <button onClick={() => onOpen(c)} data-testid="player-row" data-card-id={c.id} data-placeable={pl.length > 0}
                className={`flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-white/[.03] ${pl.length ? "" : "opacity-45"}`}>
                <span className={`w-10 shrink-0 text-center font-display text-2xl leading-none ${t.text}`}>{c.ratings.overall}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-cond text-base font-bold uppercase leading-tight">{c.name}</span>
                  <span className="block truncate text-[11px] text-muted">{c.season}{versionCount(c) > 1 ? ` · +${versionCount(c) - 1} temporada(s)` : ""} · {c.positions.join("/")}{c.check.membership === "verified" ? " · ✓" : ""}</span>
                </span>
                <span className="grid shrink-0 grid-cols-3 gap-2 text-center font-mono text-xs tabular">
                  <span><b className="block text-sm">{c.ppg.toFixed(1)}</b><span className="text-[9px] text-muted">PTS</span></span>
                  <span><b className="block text-sm">{c.rpg.toFixed(1)}</b><span className="text-[9px] text-muted">REB</span></span>
                  <span><b className="block text-sm">{c.apg.toFixed(1)}</b><span className="text-[9px] text-muted">AST</span></span>
                </span>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="py-4 text-center text-sm text-muted">Ningún jugador para este filtro.</li>}
      </ul>
    </div>
  );
}
