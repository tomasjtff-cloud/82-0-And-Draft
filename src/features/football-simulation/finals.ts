/** Finals helpers (pure, read-only). */
import type { CompId, Match } from "@/types/football";
import { isSeasonDone, type SeasonState } from "./season";
import { outcomeProbs } from "./match";
import { tacticAdjust } from "./tactics";

export const userFinals = (s: SeasonState): Match[] => s.matches.filter((m) => m.stage === "F" && (m.home === s.userId || m.away === s.userId)).sort((a, b) => a.date.localeCompare(b.date));

/** The next event is a final the user is in (opponent = winner of the other semifinal). */
export function upcomingFinal(s: SeasonState): { comp: CompId; date: string; opponent: string } | null {
  if (isSeasonDone(s)) return null;
  for (let i = s.cursor; i < s.events.length; i++) {
    const ev = s.events[i];
    if (ev.stage !== "F") continue;
    const sf = s.ties.filter((t) => t.comp === ev.comp && t.stage === "SF");
    if (sf.length < 2 || sf.some((t) => !t.winner)) continue;
    const mine = sf.find((t) => t.winner === s.userId);
    if (!mine) continue;
    const other = sf.find((t) => t !== mine)!;
    if (s.matches.some((m) => m.comp === ev.comp && m.stage === "F")) continue;
    return { comp: ev.comp, date: ev.date, opponent: other.winner! };
  }
  return null;
}

/** Exact 90' probabilities of the final (neutral venue, user's tactic, no fatigue/form drift). */
export function finalOdds(s: SeasonState, opponent: string) {
  const u = s.teams[s.userId], o = s.teams[opponent];
  const a = tacticAdjust(s.tactic, u.rating, o.rating);
  return outcomeProbs({ id: u.id, att: u.att + a.att, def: u.def + a.def }, { id: o.id, att: o.att, def: o.def }, "neutral");
}
