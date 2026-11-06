"use client";
import { motion, AnimatePresence } from "motion/react";
import { shortName } from "@/lib/core/names";
import type { NbaCard, NbaPos } from "@/types/nba";
import { NBA_POSITIONS } from "@/types/nba";
import { FRANCHISE_BY_ID } from "@/lib/data/nba/franchises";
import { Jersey } from "./Jersey";

const SPOTS: Record<NbaPos, { x: number; y: number }> = {
  PG: { x: 50, y: 80 }, SG: { x: 17, y: 60 }, SF: { x: 83, y: 60 }, PF: { x: 30, y: 27 }, C: { x: 68, y: 22 },
};

/** Half court with the five positions; drafted players appear as original jerseys. */
export function Court({ lineup, selected, onSlotClick, highlight = [] }: { lineup: Partial<Record<NbaPos, NbaCard>>; selected?: NbaPos | null; onSlotClick?: (p: NbaPos) => void; highlight?: NbaPos[] }) {
  return (
    <div className="court relative aspect-[5/4] w-full overflow-hidden" data-testid="court">
      <svg viewBox="0 0 500 400" className="absolute inset-0 h-full w-full" aria-hidden>
        <g fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="3">
          <rect x="4" y="4" width="492" height="392" rx="18" />
          <rect x="170" y="4" width="160" height="190" />
          <circle cx="250" cy="194" r="60" />
          <path d="M30 4v120 a220 220 0 0 0 440 0V4" />
          <circle cx="250" cy="44" r="12" />
          <path d="M215 30h70" />
          <path d="M190 396a60 60 0 0 1 120 0" />
        </g>
      </svg>
      {NBA_POSITIONS.map((p) => {
        const c = lineup[p];
        const s = SPOTS[p];
        const fr = c ? FRANCHISE_BY_ID[c.franchiseId] : null;
        const hl = highlight.includes(p);
        return (
          <button key={p} onClick={() => onSlotClick?.(p)} data-testid={`slot-${p}`} aria-label={c ? `${p}: ${c.name}` : `${p} vacío`}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
            <AnimatePresence mode="wait">
              {c && fr ? (
                <motion.div key={c.id} initial={{ scale: 0.3, opacity: 0, y: -20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.3, opacity: 0 }}
                  className={`flex flex-col items-center ${selected === p ? "drop-shadow-[0_0_10px_rgba(255,255,255,.9)]" : "drop-shadow-lg"}`}>
                  <Jersey primary={fr.colors[0]} secondary={fr.colors[1]} label={String(c.ratings.overall)} size={46} />
                  <span className="mt-0.5 max-w-[84px] truncate rounded bg-black/75 px-1.5 py-0.5 font-cond text-[11px] font-bold uppercase leading-tight sm:max-w-[110px] sm:text-xs">{shortName(c.name)}</span>
                  <span className="font-cond text-[10px] font-bold text-nba-2">{p}</span>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className={`grid h-12 w-12 place-items-center rounded-full border-2 border-dashed font-display text-base sm:h-14 sm:w-14 ${hl ? "animate-pulse border-nba bg-nba/25 text-nba-2" : "border-white/50 bg-black/35"}`}>
                  {p}
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}
