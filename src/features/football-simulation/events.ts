/**
 * Individual match events for the user's XI (simulated, NOT historical stats).
 * The final score comes first from the match engine; this module then
 * distributes exactly those goals and generates the rest of the box score.
 * Uses its own RNG stream per match (`fb-events:${seed}:${matchId}`) so the
 * scores, Live vs Quick Sim and Monte Carlo stay identical with/without events.
 *
 * Invariants (tested): Σ scorer goals = team goals (regulation + ET, never
 * shoot-out kicks); assists ≤ non-penalty goals and never to the scorer;
 * every scorer/assister was on the pitch at that minute; Σ outfield minutes ≤
 * 10·T + bench minutes; GK clean sheet ⇔ 0 conceded; saves = opp SOT − conceded.
 */
import { Rng } from "@/lib/core/rng";
import type { FbPlayerLine, FbPos, GoalEvent, SquadMember, UserMatchDetail } from "@/types/football";

const SCORE_W: Record<FbPos, number> = { ST: 3.2, CF: 3.0, LW: 2.2, RW: 2.2, CAM: 1.8, LM: 1.4, RM: 1.4, CM: 0.9, CDM: 0.45, LWB: 0.5, RWB: 0.5, LB: 0.35, RB: 0.35, CB: 0.45, GK: 0 };
const ASSIST_W: Record<FbPos, number> = { CAM: 2.4, LW: 2.2, RW: 2.2, LM: 2.0, RM: 2.0, CM: 1.6, ST: 1.3, CF: 1.6, LWB: 1.4, RWB: 1.4, LB: 1.0, RB: 1.0, CDM: 0.8, CB: 0.35, GK: 0.05 };
const PASS_W: Record<FbPos, number> = { CB: 1.1, CM: 1.4, CDM: 1.4, CAM: 1.1, LB: 1.0, RB: 1.0, LWB: 1.0, RWB: 1.0, LM: 0.9, RM: 0.9, LW: 0.8, RW: 0.8, ST: 0.55, CF: 0.7, GK: 0.45 };
const CARD_W: Record<FbPos, number> = { CB: 1.6, CDM: 1.7, LB: 1.3, RB: 1.3, LWB: 1.2, RWB: 1.2, CM: 1.2, CAM: 0.8, LM: 0.9, RM: 0.9, LW: 0.7, RW: 0.7, ST: 0.8, CF: 0.8, GK: 0.25 };
const DEF_POS = new Set<FbPos>(["CB", "LB", "RB", "LWB", "RWB", "GK"]);
export const BENCH_KEY = "BENCH";

const sho = (m: SquadMember) => m.attrs?.sho ?? 20;
const creativity = (m: SquadMember) => (m.attrs ? (m.attrs.pas + m.attrs.dri) / 2 : 40);
const chemF = (m: SquadMember) => 0.85 + 0.05 * m.chem; // chemistry 0..3 → ×0.85..×1.0
const fitF = (m: SquadMember) => Math.max(0.6, m.fit);

function pickWeighted<T>(rng: Rng, items: T[], w: (t: T) => number): T | null {
  const ws = items.map(w), sum = ws.reduce((a, b) => a + Math.max(0, b), 0);
  if (sum <= 0) return null;
  let r = rng.next() * sum;
  for (let i = 0; i < items.length; i++) { r -= Math.max(0, ws[i]); if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
function binom(rng: Rng, n: number, p: number) { let k = 0; for (let i = 0; i < n; i++) if (rng.next() < p) k++; return k; }

export interface EventInput {
  squad: SquadMember[]; seed: string; matchId: string; userSide: "home" | "away";
  goalsReg: number; goalsEt: number; concededReg: number; concededEt: number; extraTime: boolean;
  xgFor: number; xgAgainst: number;
  /** tactic possession bias in percentage points (0 = Equilibrado; no extra RNG) */
  possessionBias?: number;
}

export function generateMatchEvents(i: EventInput): UserMatchDetail {
  const rng = new Rng(`fb-events:${i.seed}:${i.matchId}`);
  const T = i.extraTime ? 120 : 90;
  const out = new Map<string, { m: SquadMember | null; on: number; off: number; red: number | null; yellow: number }>();
  for (const m of i.squad) out.set(m.slotId, { m, on: 0, off: T, red: null, yellow: 0 });
  // discipline
  for (const m of i.squad) {
    const st = out.get(m.slotId)!;
    if (rng.next() < 0.07 * CARD_W[m.pos]) st.yellow = 1;
    if (rng.next() < 0.0035 * CARD_W[m.pos]) { st.red = 10 + rng.int(T - 15); st.off = st.red; }
  }
  // up to 3 substitutions (outfield only, not already sent off)
  let benchMin = 0;
  const benchIntervals: [number, number][] = [];
  const subCands = i.squad.filter((m) => m.pos !== "GK" && out.get(m.slotId)!.red === null);
  for (let k = 0; k < 3; k++) {
    if (rng.next() > 0.85) continue;
    const who = pickWeighted(rng, subCands.filter((m) => out.get(m.slotId)!.off === T), (m) => (SCORE_W[m.pos] + 0.6) * (1.3 - m.fit * 0.3) * (2 - m.chem * 0.2));
    if (!who) break;
    const minute = 55 + rng.int(33);
    out.get(who.slotId)!.off = minute;
    benchMin += T - minute;
    benchIntervals.push([minute, T]);
  }
  const onPitch = (minute: number) => i.squad.filter((m) => { const st = out.get(m.slotId)!; return minute > st.on && minute <= st.off; });
  const benchOn = (minute: number) => benchIntervals.filter(([a, b]) => minute > a && minute <= b).length;

  // goals: exactly the score (regulation + extra time). Shoot-out kicks are not events.
  const minutes: { minute: number; et: boolean }[] = [];
  for (let k = 0; k < i.goalsReg; k++) minutes.push({ minute: 1 + rng.int(90), et: false });
  for (let k = 0; k < i.goalsEt; k++) minutes.push({ minute: 91 + rng.int(30), et: true });
  minutes.sort((a, b) => a.minute - b.minute);
  const goals: GoalEvent[] = [];
  for (const { minute, et } of minutes) {
    const players = onPitch(minute).filter((m) => m.pos !== "GK");
    const bench = benchOn(minute);
    const penalty = rng.next() < 0.1;
    const bySlot = (k: string) => i.squad.find((x) => x.slotId === k)!;
    let scorer: string;
    if (penalty && players.length) {
      scorer = [...players].sort((a, b) => sho(b) - sho(a) || a.slotId.localeCompare(b.slotId))[0].slotId;
    } else {
      const cand = [...players.map((m) => m.slotId), ...(bench ? [BENCH_KEY] : [])];
      scorer = pickWeighted(rng, cand, (k) => (k === BENCH_KEY ? 1.2 * bench : SCORE_W[bySlot(k).pos] * Math.pow(sho(bySlot(k)) / 75, 3) * chemF(bySlot(k)) * fitF(bySlot(k)))) ?? BENCH_KEY;
    }
    let assist: string | null = null;
    if (!penalty && rng.next() < 0.78) {
      // the bench line can assist a bench goal only if two substitutes are on the pitch
      const cand = [...onPitch(minute).filter((m) => m.slotId !== scorer).map((m) => m.slotId), ...(bench > (scorer === BENCH_KEY ? 1 : 0) ? [BENCH_KEY] : [])];
      assist = pickWeighted(rng, cand, (k) => (k === BENCH_KEY ? 1.0 * bench : ASSIST_W[bySlot(k).pos] * Math.pow(creativity(bySlot(k)) / 75, 2.5) * chemF(bySlot(k)) * fitF(bySlot(k))));
    }
    goals.push({ minute, scorer, assist, penalty, extraTime: et });
  }

  // shots, possession, passes
  const G = i.goalsReg + i.goalsEt, O = i.concededReg + i.concededEt;
  const extraShots = rng.poisson(Math.max(1, i.xgFor * 8.5 + 3)) % 30;
  const shots = G + extraShots, sot = G + binom(rng, extraShots, 0.27);
  const oppExtra = rng.poisson(Math.max(1, i.xgAgainst * 8.5 + 3)) % 30;
  const oppShots = O + oppExtra, oppSot = O + binom(rng, oppExtra, 0.3);
  const possession = Math.round(Math.max(28, Math.min(72, 50 + (i.possessionBias ?? 0) + 12 * Math.tanh((i.xgFor - i.xgAgainst) / 1.5) + rng.normal(0, 3))));
  const teamPasses = Math.round(420 * (T / 90) + (possession - 50) * 8 + rng.normal(0, 30));

  const lines = new Map<string, FbPlayerLine>();
  const blank = (key: string, started: boolean, min: number): FbPlayerLine => ({ key, started, min, goals: 0, assists: 0, shots: 0, sot: 0, passes: 0, passesOk: 0, yellow: 0, red: 0, rating: 0, xg: 0, xa: 0 });
  for (const m of i.squad) { const st = out.get(m.slotId)!; const l = blank(m.slotId, true, st.off - st.on); l.yellow = st.yellow; l.red = st.red !== null ? 1 : 0; lines.set(m.slotId, l); }
  lines.set(BENCH_KEY, blank(BENCH_KEY, false, benchMin));
  for (const g of goals) { lines.get(g.scorer)!.goals++; lines.get(g.scorer)!.shots++; lines.get(g.scorer)!.sot++; if (g.assist) lines.get(g.assist)!.assists++; }
  // non-goal shots by shooting weight × minutes
  const minShare = (key: string) => lines.get(key)!.min / T;
  const shotW = (key: string) => { const m = i.squad.find((x) => x.slotId === key); return (m ? SCORE_W[m.pos] * Math.pow(sho(m) / 75, 2) * chemF(m) : 1.1) * minShare(key); };
  const keys = [...lines.keys()].filter((k) => lines.get(k)!.min > 0);
  const nonGoalOn = sot - G, nonGoalOff = shots - sot;
  for (let k = 0; k < nonGoalOn + nonGoalOff; k++) {
    const who = pickWeighted(rng, keys, shotW);
    if (!who) break;
    const l = lines.get(who)!; l.shots++; if (k < nonGoalOn) l.sot++;
  }
  // passes
  const passW = (key: string) => { const m = i.squad.find((x) => x.slotId === key); return (m ? PASS_W[m.pos] * ((m.attrs?.pas ?? m.gk?.kic ?? 60) / 75) : 0.9) * minShare(key); };
  const wsum = keys.reduce((a, k) => a + passW(k), 0);
  for (const k of keys) {
    const l = lines.get(k)!, m = i.squad.find((x) => x.slotId === k);
    l.passes = Math.max(0, Math.round((teamPasses * passW(k)) / wsum + rng.normal(0, 3)));
    const pas = m ? (m.attrs?.pas ?? (m.gk ? m.gk.kic - 8 : 60)) : 72;
    const acc = Math.max(0.55, Math.min(0.96, 0.78 + (pas - 75) * 0.004 + rng.normal(0, 0.03)));
    l.passesOk = Math.min(l.passes, Math.round(l.passes * acc));
  }
  // simulated xG / xA (model estimates): team λ split by shot / assist weights
  const xgW = keys.reduce((a, k) => a + shotW(k), 0);
  const xaW = (key: string) => { const m = i.squad.find((x) => x.slotId === key); return (m ? ASSIST_W[m.pos] * Math.pow(creativity(m) / 75, 2.5) : 1) * minShare(key); };
  const xaSum = keys.reduce((a, k) => a + xaW(k), 0);
  for (const k of keys) { const l = lines.get(k)!; l.xg = Math.round(((i.xgFor * shotW(k)) / xgW) * 100) / 100; l.xa = Math.round(((i.xgFor * 0.78 * 0.9 * xaW(k)) / xaSum) * 100) / 100; }
  // goalkeeper
  const gk = i.squad.find((m) => m.pos === "GK");
  if (gk) { const l = lines.get(gk.slotId)!; l.conceded = O; l.saves = oppSot - O; l.cleanSheet = O === 0 && l.min === T; }
  // match ratings (computed from the simulated events above)
  const result = G > O ? 1 : G < O ? -1 : 0;
  for (const k of keys) {
    const l = lines.get(k)!, m = i.squad.find((x) => x.slotId === k);
    let r = 6.4 + l.goals + 0.6 * l.assists + 0.12 * (l.sot - l.goals) + 0.25 * result - 0.2 * l.yellow - 1.5 * l.red + (l.passes ? (l.passesOk / l.passes - 0.8) * 3 : 0);
    if (m && DEF_POS.has(m.pos)) r += (O === 0 ? (m.pos === "GK" ? 0.6 : 0.5) : 0) - 0.15 * O;
    if (m?.pos === "GK") r += 0.12 * (l.saves ?? 0);
    r += rng.normal(0, 0.35);
    if (l.min < 30) r = 6.4 + (r - 6.4) * (l.min / 30);
    l.rating = Math.round(Math.max(3, Math.min(10, r)) * 10) / 10;
  }
  return { userSide: i.userSide, goals, lines: [...lines.values()], shots, sot, oppShots, oppSot, possession };
}
