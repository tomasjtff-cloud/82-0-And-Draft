"use client";
import { AnimatePresence, motion } from "motion/react";
import type { FbPlayerSeason, Formation } from "@/types/football";
import { slotFit } from "@/lib/ratings/football";
import { FbMiniCard } from "./FbCardView";

export function Pitch({ formation, lineup, chem, current, selected, captainId, onSlotClick }: {
  formation: Formation; lineup: Record<string, FbPlayerSeason | undefined>; chem?: Record<string, number>;
  current?: string | null; selected?: string | null; captainId?: string | null; onSlotClick?: (slotId: string) => void;
}) {
  return (
    <div className="pitch relative aspect-[3/4] w-full overflow-hidden" data-testid="pitch">
      <svg viewBox="0 0 300 400" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="none">
        <g fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2">
          <rect x="8" y="8" width="284" height="384" rx="4" />
          <path d="M8 200h284" /><circle cx="150" cy="200" r="38" />
          <rect x="80" y="8" width="140" height="58" /><rect x="80" y="334" width="140" height="58" />
          <rect x="118" y="8" width="64" height="22" /><rect x="118" y="370" width="64" height="22" />
        </g>
      </svg>
      {formation.slots.map((s) => {
        const c = lineup[s.id];
        return (
          <button key={s.id} onClick={() => onSlotClick?.(s.id)} data-testid={`fb-slot-${s.id}`} aria-label={c ? `${s.pos}: ${c.name}` : `${s.pos} vacío`}
            className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
            <AnimatePresence mode="wait">
              {c ? (
                <motion.div key={c.id} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                  <FbMiniCard card={c} pos={s.pos} chem={chem?.[s.id] ?? 0} fit={slotFit(c, s.pos)} selected={selected === s.id} captain={captainId === c.id} />
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className={`grid h-12 w-12 place-items-center rounded-full border-2 border-dashed font-cond text-xs font-extrabold sm:h-14 sm:w-14 ${current === s.id ? "animate-pulse border-gold bg-gold/25 text-gold-2" : "border-white/50 bg-black/30"}`}>
                  {s.pos}
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}

export function FormationPreview({ formation, active }: { formation: Formation; active?: boolean }) {
  return (
    <svg viewBox="0 0 60 80" className="h-20 w-full" aria-hidden>
      <rect x="1" y="1" width="58" height="78" rx="4" fill={active ? "#11502f" : "#0c2a1c"} stroke="rgba(255,255,255,.25)" />
      <path d="M1 40h58" stroke="rgba(255,255,255,.2)" />
      {formation.slots.map((s) => <circle key={s.id} cx={2 + (s.x / 100) * 56} cy={2 + (s.y / 100) * 76} r="3.2" fill={s.pos === "GK" ? "#f3dc94" : active ? "#d9b45a" : "#9aa1ac"} />)}
    </svg>
  );
}
