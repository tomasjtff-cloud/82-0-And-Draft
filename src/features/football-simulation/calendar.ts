/**
 * 2026/27 GAME calendar (approximate, original). Dates are a plausible
 * template so congestion/fatigue can be modelled; they are not the official
 * fixture list. All events for one team on a date are mutually exclusive.
 */
import type { CompId } from "@/types/football";

export interface SeasonEvent { id: string; date: string; comp: CompId; stage: string; label: string }

const iso = (d: Date) => d.toISOString().slice(0, 10);
function addDays(s: string, n: number): string { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); }

export const UCL_DATES: Record<string, string> = {
  MD1: "2026-09-16", MD2: "2026-09-30", MD3: "2026-10-21", MD4: "2026-11-04", MD5: "2026-11-25", MD6: "2026-12-09",
  MD7: "2027-01-20", MD8: "2027-01-27", "PO-1": "2027-02-17", "PO-2": "2027-02-24", "R16-1": "2027-03-10", "R16-2": "2027-03-17",
  "QF-1": "2027-04-07", "QF-2": "2027-04-14", "SF-1": "2027-04-28", "SF-2": "2027-05-05", F: "2027-05-29",
};
export const EFL_DATES: Record<string, string> = {
  R2: "2026-08-26", R3: "2026-09-23", R4: "2026-10-28", QF: "2026-12-16", "SF-1": "2027-01-13", "SF-2": "2027-02-03", F: "2027-03-21",
};
export const FA_DATES: Record<string, string> = {
  R3: "2027-01-09", R4: "2027-02-13", R5: "2027-03-06", QF: "2027-04-03", SF: "2027-04-24", F: "2027-05-15",
};
const RESERVED_SATURDAYS = new Set(["2026-09-05", "2026-10-10", "2026-11-14", "2027-01-09", "2027-02-13", "2027-03-06", "2027-03-27", "2027-04-03", "2027-04-24", "2027-05-15"]);
const PL_MIDWEEK = ["2026-12-01", "2026-12-15", "2026-12-29", "2027-01-05", "2027-02-09", "2027-03-02", "2027-04-20", "2027-05-11"];

export function plRoundDates(): string[] {
  const out: string[] = [];
  for (let d = "2026-08-22"; d <= "2027-05-22"; d = addDays(d, 7)) if (!RESERVED_SATURDAYS.has(d)) out.push(d);
  return [...out, ...PL_MIDWEEK].sort().slice(0, 38);
}

const STAGE_LABEL: Record<string, string> = {
  R2: "Segunda ronda", R3: "Tercera ronda", R4: "Cuarta ronda", R5: "Quinta ronda", QF: "Cuartos de final", SF: "Semifinales",
  "SF-1": "Semifinal (ida)", "SF-2": "Semifinal (vuelta)", F: "Final", "PO-1": "Playoffs (ida)", "PO-2": "Playoffs (vuelta)",
  "R16-1": "Octavos (ida)", "R16-2": "Octavos (vuelta)", "QF-1": "Cuartos (ida)", "QF-2": "Cuartos (vuelta)",
};
export const COMP_NAME: Record<CompId, string> = { PL: "Premier League", UCL: "Champions League", FA: "FA Cup", EFL: "Carabao Cup" };

export function buildCalendar(): SeasonEvent[] {
  const ev: SeasonEvent[] = [];
  plRoundDates().forEach((date, i) => ev.push({ id: `PL-R${i + 1}`, date, comp: "PL", stage: `R${i + 1}`, label: `Jornada ${i + 1}` }));
  for (const [stage, date] of Object.entries(UCL_DATES)) ev.push({ id: `UCL-${stage}`, date, comp: "UCL", stage, label: stage.startsWith("MD") ? `Fase liga · J${stage.slice(2)}` : STAGE_LABEL[stage] ?? stage });
  for (const [stage, date] of Object.entries(EFL_DATES)) ev.push({ id: `EFL-${stage}`, date, comp: "EFL", stage, label: STAGE_LABEL[stage] ?? stage });
  for (const [stage, date] of Object.entries(FA_DATES)) ev.push({ id: `FA-${stage}`, date, comp: "FA", stage, label: STAGE_LABEL[stage] ?? stage });
  return ev.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
