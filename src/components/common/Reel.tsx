"use client";
import { useEffect, useState } from "react";

/**
 * Slot-machine style reel. Purely cosmetic: the final value is decided by the
 * engine BEFORE the animation starts; the reel only reveals it.
 */
export function Reel({ value, pool, label, durationMs, accent = "#ff6a13", testId }: { value: string; pool: string[]; label: string; durationMs: number; accent?: string; testId?: string }) {
  const [shown, setShown] = useState(value);
  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    if (durationMs <= 0 || pool.length < 2) { setShown(value); return; }
    setSpinning(true);
    const start = performance.now();
    let i = 0, timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const t = performance.now() - start;
      if (t >= durationMs) { setShown(value); setSpinning(false); return; }
      i = (i + 1) % pool.length;
      setShown(pool[i]);
      const progress = t / durationMs;
      timer = setTimeout(step, 40 + progress * progress * 180);
    };
    step();
    return () => clearTimeout(timer);
  }, [value, pool, durationMs]);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line-strong bg-ink/70 px-3 py-2 sm:px-4 sm:py-3" data-testid={testId} data-final={value}>
      <div className="font-cond text-[11px] font-bold uppercase tracking-[.2em] text-muted">{label}</div>
      <div className={`font-display mt-0.5 truncate text-2xl sm:text-3xl md:text-4xl ${spinning ? "blur-[1px]" : ""}`} style={{ color: spinning ? "#9aa1ac" : accent }}>
        {shown}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-ink to-transparent" />
    </div>
  );
}
