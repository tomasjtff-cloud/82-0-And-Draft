"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Difficulty } from "@/lib/core/difficulty";
import type { UserTeamInput } from "@/features/football-simulation/season";
import { runSeed, simulateOne, summarizeRuns, type FbMcSummary, type FbRunOutcome } from "@/features/football-simulation/monte-carlo";

export type McStatus = "idle" | "running" | "done" | "cancelled" | "error";

/** Runs the football Monte Carlo in a Web Worker (main-thread batched fallback if workers are unavailable). */
export function useFootballMonteCarlo() {
  const [status, setStatus] = useState<McStatus>("idle");
  const [done, setDone] = useState(0);
  const [runs, setRuns] = useState(0);
  const [summary, setSummary] = useState<FbMcSummary | null>(null);
  const [ms, setMs] = useState(0);
  const worker = useRef<Worker | null>(null);
  const cancelFlag = useRef(false);
  const t0 = useRef(0);

  useEffect(() => () => worker.current?.terminate(), []);

  const start = useCallback((user: UserTeamInput, difficulty: Difficulty, seed: string, n: number) => {
    worker.current?.terminate();
    setStatus("running"); setDone(0); setRuns(n); setSummary(null); cancelFlag.current = false; t0.current = performance.now();
    const batch = n >= 1000 ? 25 : 10;
    try {
      const w = new Worker(new URL("../features/football-simulation/mc.worker.ts", import.meta.url));
      worker.current = w;
      w.onmessage = (e) => {
        const m = e.data;
        setSummary(m.summary);
        setMs(performance.now() - t0.current);
        if (m.type === "progress") setDone(m.done);
        else { setDone(m.summary.runs); setStatus(m.type === "done" ? "done" : "cancelled"); w.terminate(); worker.current = null; }
      };
      w.onerror = () => { setStatus("error"); w.terminate(); worker.current = null; };
      w.postMessage({ type: "start", user, difficulty, seed, runs: n, batch });
    } catch {
      // Fallback: batched on the main thread
      const out: FbRunOutcome[] = [];
      const step = () => {
        if (cancelFlag.current) { setSummary(summarizeRuns(out)); setStatus("cancelled"); return; }
        const end = Math.min(n, out.length + 5);
        for (let i = out.length; i < end; i++) out.push(simulateOne(user, difficulty, runSeed(seed, i)));
        setDone(out.length); setSummary(summarizeRuns(out)); setMs(performance.now() - t0.current);
        if (out.length >= n) setStatus("done"); else setTimeout(step, 0);
      };
      step();
    }
  }, []);

  const cancel = useCallback(() => {
    cancelFlag.current = true;
    worker.current?.postMessage({ type: "cancel" });
  }, []);

  return { status, done, runs, summary, ms, start, cancel };
}
