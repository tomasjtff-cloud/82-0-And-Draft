"use client";
import { motion, AnimatePresence } from "motion/react";
import type { NbaCard, NbaPos } from "@/types/nba";
import { NBA_POSITIONS } from "@/types/nba";
import { tierOf } from "./NbaCardView";

const SPOTS: Record<NbaPos, { x: number; y: number }> = {
  PG: { x: 50, y: 78 }, SG: { x: 18, y: 58 }, SF: { x: 82, y: 58 }, PF: { x: 30, y: 26 }, C: { x: 66, y: 22 },
};

export function Court({ lineup, selected, onSlotClick }: { lineup: Partial<Record<NbaPos, NbaCard>>; selected?: NbaPos | null; onSlotClick?: (p: NbaPos) => void }) {
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
        const isSel = selected === p;
        return (
          <button key={p} onClick={() => onSlotClick?.(p)} data-testid={`slot-${p}`}
            aria-label={c ? `${p}: ${c.name}` : `${p} vacío`}
            className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
            <AnimatePresence mode="wait">
              {c ? (
                <motion.div key={c.id} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
                  className={`w-[92px] rounded-xl bg-gradient-to-br p-[1.5px] shadow-xl sm:w-[120px] ${tierOf(c.ratings.overall).ring} ${isSel ? "ring-2 ring-white" : ""}`}>
                  <div className="rounded-[10px] bg-ink/90 px-2 py-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-xl leading-none">{c.ratings.overall}</span>
                      <span className="font-cond text-xs font-bold text-nba-2">{p}</span>
                    </div>
                    <div className="truncate font-cond text-[13px] font-bold uppercase leading-tight">{c.name}</div>
                    <div className="truncate text-[10px] text-muted">{c.season} · {c.franchiseId}</div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-white/50 bg-black/30 font-display text-lg sm:h-16 sm:w-16">
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
