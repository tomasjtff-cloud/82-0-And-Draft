"use client";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";

/** Bottom sheet on mobile, centered dialog on desktop. Respects iPhone safe areas. */
export function Sheet({ open, onClose, title, children, testId }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; testId?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={title} data-testid={testId}
            className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-line-strong bg-surface md:rounded-3xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
              <div className="mx-auto h-1 w-10 rounded-full bg-white/20 md:hidden" aria-hidden />
            </div>
            <div className="flex items-center justify-between px-5 pb-2 pt-1">
              <h2 className="font-display text-2xl">{title}</h2>
              <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Cerrar" data-testid="sheet-close">✕</button>
            </div>
            <div className="overflow-y-auto px-5 pb-5 scrollbar-thin">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
