"use client";
import { AnimatePresence, motion } from "motion/react";
import type { FbPlayerSeason, Formation } from "@/types/football";
import { slotFit, type ChemLink } from "@/lib/ratings/football";
import { FbMiniCard } from "./FbCardView";

const LINK_COLOR = { club: "#3ddc84", nation: "#f3dc94", league: "#7cc4ff", language: "#ff9f5a", style: "#c58bff" } as const;

/**
 * Interactive pitch. In chemistry mode the real chemistry links (shared club,
 * nation or league between in-position players) are drawn between cards and
 * each card shows its individual chemistry.
 */
export function Pitch({ formation, lineup, chem, current, selected, captainId, onSlotClick, chemMode, links = [], focus, highlight = [], compact }: {
  formation: Formation; lineup: Record<string, FbPlayerSeason | undefined>; chem?: Record<string, number>;
  current?: string | null; selected?: string | null; captainId?: string | null; onSlotClick?: (slotId: string) => void;
  chemMode?: boolean; links?: ChemLink[]; focus?: string | null; highlight?: string[]; compact?: boolean;
}) {
  const pos = Object.fromEntries(formation.slots.map((s) => [s.id, s]));
  const shown = chemMode ? links.filter((l) => !focus || l.a === focus || l.b === focus) : [];
  return (
    <div className={`pitch relative w-full overflow-hidden ${compact ? "aspect-[4/5]" : "aspect-[3/4]"}`} data-testid="pitch" data-chem-mode={chemMode ? "on" : "off"}>
      <svg viewBox="0 0 300 400" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="none">
        <g fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2">
          <rect x="8" y="8" width="284" height="384" rx="4" />
          <path d="M8 200h284" /><circle cx="150" cy="200" r="38" />
          <rect x="80" y="8" width="140" height="58" /><rect x="80" y="334" width="140" height="58" />
          <rect x="118" y="8" width="64" height="22" /><rect x="118" y="370" width="64" height="22" />
        </g>
        {shown.map((l) => {
          const a = pos[l.a], b = pos[l.b];
          if (!a || !b) return null;
          const k = (["club", "nation", "language", "league", "style"] as const).find((x) => l.kinds.includes(x)) ?? "league";
          return <line key={`${l.a}-${l.b}`} data-testid="chem-link" x1={a.x * 3} y1={a.y * 4} x2={b.x * 3} y2={b.y * 4} stroke={LINK_COLOR[k]} strokeOpacity={focus ? 0.95 : 0.55} strokeWidth={l.kinds.length >= 2 ? 3 : 1.6} strokeLinecap="round" />;
        })}
      </svg>
      {formation.slots.map((s) => {
        const c = lineup[s.id];
        return (
          <button key={s.id} onClick={() => onSlotClick?.(s.id)} data-testid={`fb-slot-${s.id}`} aria-label={c ? `${s.pos}: ${c.name}` : `${s.pos} vacío`}
            className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
            <AnimatePresence mode="wait">
              {c ? (
                <motion.div key={c.id} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="relative">
                  <FbMiniCard card={c} pos={s.pos} chem={chem?.[s.id] ?? 0} fit={slotFit(c, s.pos)} selected={selected === s.id || focus === s.id} captain={captainId === c.id} />
                  {chemMode && <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-black font-mono text-xs font-bold text-win ring-2 ring-win" data-testid="slot-chem">{chem?.[s.id] ?? 0}</span>}
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className={`grid h-11 w-11 place-items-center rounded-full border-2 border-dashed font-cond text-xs font-extrabold sm:h-14 sm:w-14 ${current === s.id || highlight.includes(s.id) ? "animate-pulse border-gold bg-gold/25 text-gold-2" : "border-white/50 bg-black/30"}`}>
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

const LEGEND_ES = { club: "Club", nation: "Nación", league: "Liga", language: "Idioma", style: "Estilo" } as const;
export function ChemLegend({ extended = false }: { extended?: boolean }) {
  const kinds = extended ? (["club", "nation", "league", "language", "style"] as const) : (["club", "nation", "league"] as const);
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-muted">
      {kinds.map((k) => <span key={k} className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded" style={{ background: LINK_COLOR[k] }} />{LEGEND_ES[k]}</span>)}
      <span>· línea gruesa = 2+ vínculos{extended ? " · continente cuenta sin línea" : ""}</span>
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
