/// <reference lib="webworker" />
/**
 * Web Worker running football Monte Carlo in batches so the UI never freezes.
 * Messages in:  { type: "start", user, difficulty, seed, runs, batch } | { type: "cancel" }
 * Messages out: { type: "progress", done, runs, summary } … { type: "done", summary } | { type: "cancelled", summary }
 */
import { runSeed, simulateOne, summarizeRuns, type FbRunOutcome } from "./monte-carlo";

let cancelled = false;
self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === "cancel") { cancelled = true; return; }
  if (m.type !== "start") return;
  cancelled = false;
  const out: FbRunOutcome[] = [];
  const batch = Math.max(1, m.batch ?? 20);
  const step = () => {
    if (cancelled) { postMessage({ type: "cancelled", summary: summarizeRuns(out) }); return; }
    const end = Math.min(m.runs, out.length + batch);
    for (let i = out.length; i < end; i++) out.push(simulateOne(m.user, m.difficulty, runSeed(m.seed, i)));
    if (out.length >= m.runs) { postMessage({ type: "done", summary: summarizeRuns(out) }); return; }
    postMessage({ type: "progress", done: out.length, runs: m.runs, summary: summarizeRuns(out) });
    setTimeout(step, 0); // yield so a "cancel" message can be received
  };
  step();
};
