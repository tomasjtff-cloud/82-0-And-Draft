"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ACH_BY_ID, TIER_ES, TIER_POINTS, type AchDef } from "@/lib/progress/achievements";
import { UNLOCK_EVENT } from "@/lib/progress/store";
import { TrophyIcon } from "./TrophyIcon";

const TIER_RING: Record<string, string> = { bronze: "ring-[#c27a3a]", silver: "ring-[#c9d1dc]", gold: "ring-gold", platinum: "ring-[#9fe7ff]" };

/** Non-blocking "¡LOGRO DESBLOQUEADO!" stack (max 3 visible, the rest summarised). Never intercepts the game. */
export function AchievementToasts() {
  const [queue, setQueue] = useState<AchDef[]>([]);
  useEffect(() => {
    const on = (e: Event) => { const ids = (e as CustomEvent<string[]>).detail ?? []; setQueue((q) => [...q, ...ids.map((id) => ACH_BY_ID[id]).filter(Boolean)]); };
    window.addEventListener(UNLOCK_EVENT, on);
    return () => window.removeEventListener(UNLOCK_EVENT, on);
  }, []);
  useEffect(() => {
    if (!queue.length) return;
    const t = setTimeout(() => setQueue((q) => q.slice(Math.min(2, q.length))), 4200);
    return () => clearTimeout(t);
  }, [queue]);
  const shown = queue.slice(0, 2), rest = queue.length - shown.length;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+60px)] z-[60] flex flex-col items-center gap-1.5 px-3" data-testid="ach-toasts">
      <AnimatePresence>
        {shown.map((a, i) => (
          <motion.div key={`${a.id}-${i}`} initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, delay: i * 0.12 }}
            className={`flex w-full max-w-sm items-center gap-2.5 rounded-2xl border border-line-strong bg-surface/95 px-3 py-2 shadow-2xl ring-2 backdrop-blur ${TIER_RING[a.tier]}`} data-testid="ach-toast">
            <TrophyIcon kind={a.icon} size={30} />
            <div className="min-w-0 flex-1">
              <div className="font-cond text-[10px] font-bold uppercase tracking-[.2em] text-gold-2">¡Logro desbloqueado! · {TIER_ES[a.tier]} · +{TIER_POINTS[a.tier]}</div>
              <div className="truncate font-cond text-base font-bold uppercase">{a.name}</div>
            </div>
            <button className="pointer-events-auto p-1 text-muted" aria-label="Cerrar" onClick={() => setQueue((q) => q.filter((x) => x !== a))}>✕</button>
          </motion.div>
        ))}
        {rest > 0 && <motion.div key="rest" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-auto rounded-full bg-surface/95 px-3 py-1 text-xs"><Link href="/logros" className="underline">y {rest} logro{rest > 1 ? "s" : ""} más</Link></motion.div>}
      </AnimatePresence>
    </div>
  );
}
