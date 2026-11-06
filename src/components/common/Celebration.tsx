"use client";
import { useEffect, useRef } from "react";

/** Lightweight canvas confetti (original). Skipped entirely with reduced motion. */
export function Celebration({ active, colors = ["#ff6a13", "#ffb347", "#ffffff"], durationMs = 4200 }: { active: boolean; colors?: string[]; durationMs?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active) return;
    if (document.documentElement.dataset.reducedMotion === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; };
    resize();
    const parts = Array.from({ length: 180 }, () => ({
      x: Math.random() * canvas.width, y: -Math.random() * canvas.height * 0.5,
      vx: (Math.random() - 0.5) * 3 * dpr, vy: (2 + Math.random() * 4) * dpr,
      s: (4 + Math.random() * 6) * dpr, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const start = performance.now(); let raf = 0;
    const tick = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const fade = Math.max(0, 1 - (t - start) / durationMs);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vy += 0.02 * dpr;
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      }
      if (t - start < durationMs) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    raf = requestAnimationFrame(tick);
    addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
  }, [active, colors, durationMs]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-50 h-full w-full" />;
}
