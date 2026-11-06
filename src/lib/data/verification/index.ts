/**
 * Verification layer: joins curated rows with REAL external sources.
 * - nba-538.json: FiveThirtyEight RAPTOR (CC BY 4.0), seasons 1976-77 → 2021-22:
 *   membership + minutes, possessions, RAPTOR, WAR (regular season).
 * - nba-wikidata.json / football-wikidata.json: Wikidata (CC0) P54 spells with
 *   start/end and, when present, matches/goals for the whole spell at the club.
 * Regenerate with `npm run verify:data` (needs network to GitHub + Wikidata).
 */
import nba538 from "./nba-538.json";
import nbaWd from "./nba-wikidata.json";
import fbWd from "./football-wikidata.json";

export type MembershipStatus = "verified" | "probable" | "unverified" | "contradicted";

export interface RaptorInfo { mp: number; poss: number; raptorOffense: number; raptorDefense: number; raptorTotal: number; war: number; bbrefId: string }
export interface SpellInfo { qid: string; start: string | null; end: string | null; apps: number | null; goals: number | null }
export interface VerificationInfo { membership: MembershipStatus; sources: string[]; raptor?: RaptorInfo; spell?: SpellInfo; note?: string }

/** Documented exceptions where the external source is known to be incomplete. */
export const OVERRIDES: Record<string, string> = {
  "tobias-harris-det-2024": "Wikidata solo registra su etapa 2016-18 en Detroit; regresó a los Pistons en 2024-25. Pendiente de verificación con otra fuente.",
};

type WdRow = { status: string; qid?: string; spellStart?: string | null; spellEnd?: string | null; spellApps?: number | null; spellGoals?: number | null };
const NBA538 = (nba538 as { rows: Record<string, { status: string } & Partial<RaptorInfo>> }).rows;
const NBAWD = (nbaWd as { rows: Record<string, WdRow> }).rows;
const FBWD = (fbWd as { rows: Record<string, WdRow> }).rows;

function fromWikidata(r: WdRow | undefined, id: string): VerificationInfo {
  if (OVERRIDES[id]) return { membership: "unverified", sources: [], note: OVERRIDES[id] };
  if (!r || r.status === "not-found" || r.status === "out-of-range") return { membership: "unverified", sources: [] };
  const spell = r.qid ? { qid: r.qid, start: r.spellStart ?? null, end: r.spellEnd ?? null, apps: r.spellApps ?? null, goals: r.spellGoals ?? null } : undefined;
  const membership: MembershipStatus = r.status === "verified" ? "verified" : r.status === "probable" ? "probable" : "contradicted";
  return { membership, sources: ["Wikidata"], spell };
}

export function nbaVerification(id: string): VerificationInfo {
  const r = NBA538[id];
  if (r?.status === "verified") {
    const { mp, poss, raptorOffense, raptorDefense, raptorTotal, war, bbrefId } = r as RaptorInfo;
    return { membership: "verified", sources: ["FiveThirtyEight"], raptor: { mp, poss, raptorOffense, raptorDefense, raptorTotal, war, bbrefId } };
  }
  return fromWikidata(NBAWD[id], id);
}

export function fbVerification(id: string): VerificationInfo {
  return fromWikidata(FBWD[id], id);
}

export const VERIFICATION_SUMMARY = {
  nba538: (nba538 as { counts: Record<string, number> }).counts,
  nbaWikidata: (nbaWd as { counts: Record<string, number> }).counts,
  footballWikidata: (fbWd as { counts: Record<string, number> }).counts,
};
