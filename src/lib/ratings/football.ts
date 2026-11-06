/**
 * Football rating system (Legends Lab, original).
 * - Attributes are ESTIMATES derived from a curated overall + play-style
 *   archetype + deterministic per-player variation. They are NOT EA ratings.
 * - Positional compatibility, chemistry and line ratings feed the season engine.
 */
import type { FbAttrs, FbPlayerSeason, FbPos, FbStyle, Formation, GkAttrs } from "@/types/football";
import { CONTINENT_OF, LANGUAGES_OF } from "@/lib/data/football/nation-links";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/* ───────── Attribute estimation ───────── */
const OUTFIELD: Record<Exclude<FbStyle, "SST" | "SWK">, [number, number, number, number, number, number]> = {
  POA: [2, 6, -10, -1, -50, -4], TM: [-8, 4, -8, -6, -45, 6], CF: [0, 5, -3, 1, -45, 2], F9: [-3, 2, 2, 4, -48, -10],
  SPD: [8, -2, -8, 1, -52, -10], IF: [4, 1, -4, 4, -50, -12], DRB: [3, -4, -2, 5, -52, -14], CRS: [2, -6, 1, 0, -45, -10],
  SS: [-1, 2, -2, 3, -45, -10], PM: [-6, -3, 5, 3, -30, -12], TQ: [-5, 0, 3, 5, -48, -14], BTB: [-2, -4, -2, -3, -10, 3],
  REG: [-10, -6, 5, -1, -18, -10], DLP: [-10, -10, 3, -4, -6, -4], DES: [-6, -18, -8, -10, 2, 5],
  STO: [-12, -45, -22, -24, 3, 4], BPD: [-10, -42, -12, -16, 2, 0], LIB: [-12, -35, -6, -12, 2, -3],
  AFB: [2, -30, -6, -4, -6, -6], DFB: [-2, -38, -14, -12, -1, -2],
};
const GK_T: Record<"SST" | "SWK", [number, number, number, number, number, number]> = {
  SST: [1, 0, -8, 2, -40, 1], SWK: [0, -1, 2, 0, -25, 0],
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function jitter(seed: string, i: number): number {
  return (hash(`${seed}:${i}`) % 7) - 3; // -3..+3, deterministic
}

export function estimateAttributes(p: Pick<FbPlayerSeason, "id" | "ovr" | "style" | "positions">): { attrs: FbAttrs | null; gk: GkAttrs | null } {
  if (p.positions[0] === "GK") {
    const t = GK_T[p.style === "SWK" ? "SWK" : "SST"];
    const v = t.map((o, i) => clamp(Math.round(p.ovr + o + jitter(p.id, i)), 25, 99));
    return { attrs: null, gk: { div: v[0], han: v[1], kic: v[2], ref: v[3], spd: v[4], pos: v[5] } };
  }
  const t = OUTFIELD[p.style as keyof typeof OUTFIELD] ?? OUTFIELD.BTB;
  const v = t.map((o, i) => clamp(Math.round(p.ovr + o + jitter(p.id, i)), 20, 99));
  return { attrs: { pac: v[0], sho: v[1], pas: v[2], dri: v[3], def: v[4], phy: v[5] }, gk: null };
}

/* ───────── Positional compatibility ───────── */
const PAIRS: [FbPos, FbPos, number][] = [
  ["LB", "LWB", 0.95], ["RB", "RWB", 0.95], ["LB", "RB", 0.85], ["LWB", "RWB", 0.85], ["LWB", "LM", 0.88], ["RWB", "RM", 0.88],
  ["LB", "LM", 0.8], ["RB", "RM", 0.8], ["CB", "CDM", 0.82], ["CB", "LB", 0.8], ["CB", "RB", 0.8],
  ["CDM", "CM", 0.93], ["CM", "CAM", 0.92], ["CDM", "CAM", 0.82], ["CAM", "CF", 0.9], ["CF", "ST", 0.95], ["CAM", "ST", 0.82],
  ["LW", "LM", 0.95], ["RW", "RM", 0.95], ["LW", "RW", 0.88], ["LM", "RM", 0.85], ["LW", "ST", 0.82], ["RW", "ST", 0.82],
  ["LW", "CAM", 0.85], ["RW", "CAM", 0.85], ["LW", "CF", 0.88], ["RW", "CF", 0.88], ["LM", "CM", 0.85], ["RM", "CM", 0.85],
];
const COMPAT = new Map<string, number>();
for (const [a, b, v] of PAIRS) { COMPAT.set(`${a}|${b}`, v); COMPAT.set(`${b}|${a}`, v); }

export function posCompat(playerPos: FbPos, slotPos: FbPos): number {
  if (playerPos === slotPos) return 1;
  if (playerPos === "GK" || slotPos === "GK") return 0;
  return COMPAT.get(`${playerPos}|${slotPos}`) ?? 0.65;
}
/** Best fit of a card for a slot (primary position counts fully, secondaries at 0.97). */
export function slotFit(card: Pick<FbPlayerSeason, "positions">, slotPos: FbPos): number {
  let best = 0;
  card.positions.forEach((p, i) => { best = Math.max(best, posCompat(p, slotPos) * (i === 0 ? 1 : 0.97)); });
  return best;
}
export const DRAFT_FIT_MIN = 0.9;

/* ───────── Chemistry (Legends Lab system, 0..33) ───────── */
export interface ChemResult { total: number; perSlot: Record<string, number>; links: Record<string, string[]> }

/**
 * Chemistry rules. FUT (and every pre-0.4.2 save) = classic club/nation/league with full weight.
 * Historical Roulette v2 = classic + one extra +1 per player if they share idioma (≥3 in the XI),
 * familia de estilo (≥4) or continente (≥4) — max +1 extra; weight 0.7. Per-player cap stays 3 (team max 33).
 * Calibrated on 300 random roulette XIs: classic avg 16/33 → extended avg ≈24 (p10 20, p90 28).
 */
export interface ChemRules { extended: boolean; weight: number; version: 1 | 2 }
export const CLASSIC_CHEM: ChemRules = { extended: false, weight: 1, version: 1 };
export const CHEM_WEIGHT: Record<"roulette" | "fut", number> = { roulette: 0.7, fut: 1 };
export function chemRulesFor(mode: "roulette" | "fut" | undefined | null, version: 1 | 2 = 2, legacyWeight?: number): ChemRules {
  if (mode !== "roulette") return { extended: false, weight: 1, version };
  if (version === 2) return { extended: true, weight: CHEM_WEIGHT.roulette, version: 2 };
  return { extended: false, weight: legacyWeight ?? 1, version: 1 };
}
export const chemWeightFor = (mode: "roulette" | "fut" | undefined | null) => chemRulesFor(mode).weight;

/** Players needed in the XI sharing a language / style family / continent for the Roulette extra +1. */
export const EXT_MIN = { language: 3, style: 4, continent: 4 } as const;

/** Play-style families (from the estimated archetype of each card). */
export type StyleFamily = "Toque" | "Vértigo" | "Fuerza";
const FAMILY: Record<FbStyle, StyleFamily> = {
  PM: "Toque", TQ: "Toque", DLP: "Toque", REG: "Toque", F9: "Toque", SS: "Toque", BPD: "Toque", LIB: "Toque", SWK: "Toque",
  SPD: "Vértigo", IF: "Vértigo", DRB: "Vértigo", CRS: "Vértigo", AFB: "Vértigo", CF: "Vértigo",
  TM: "Fuerza", POA: "Fuerza", BTB: "Fuerza", DES: "Fuerza", STO: "Fuerza", DFB: "Fuerza", SST: "Fuerza",
};
export const styleFamily = (s: FbStyle): StyleFamily => FAMILY[s];
export const STYLE_FAMILY_DESC: Record<StyleFamily, string> = {
  Toque: "posesión y pase", Vértigo: "velocidad y desborde", Fuerza: "físico e intensidad",
};
const continentOf = (n: string) => CONTINENT_OF[n] ?? n;
const languagesOf = (n: string) => LANGUAGES_OF[n] ?? [n];

/* Thresholds (counts include the player himself). Single source of truth for engine + UI. */
export const CHEM_THRESHOLDS = { club: [2, 4, 6], nation: [2, 4, 7], league: [3, 5, 8] } as const;
export type ChemGroupKind = keyof typeof CHEM_THRESHOLDS;
export interface ChemGroup {
  kind: ChemGroupKind; key: string; count: number; thresholds: readonly number[];
  points: number; next: number | null; /** other slots in the same group (incl. out-of-position players, who still count for teammates) */ mates: string[];
}
export interface ChemExtra { kind: "language" | "style" | "continent"; key: string; count: number; min: number; met: boolean; mates: string[] }
export interface SlotChem {
  slotId: string; cardId: string; outOfPosition: boolean; groups: ChemGroup[]; extras: ChemExtra[];
  extraPoints: number; legend: boolean; captain: boolean; raw: number; effective: number; why: string[];
}
export interface ChemBreakdown { total: number; extended: boolean; slots: Record<string, SlotChem> }

/**
 * Full, explainable chemistry. RULES (documented in CHEMISTRY.md):
 * - group counts include every placed player, also those out of position (they get 0 themselves but still count for teammates);
 * - club 2/4/6, nation 2/4/7, league 3/5/8 → +1/+2/+3 each;
 * - Roulette v2 (extended): +1 extra max if language ≥3, style family ≥4 or continent ≥4;
 * - legends (OVR ≥ 90) in position have at least 1; captain +1; individual cap 3 (team 33).
 */
export function chemistryBreakdown(
  formation: Formation, lineup: Record<string, FbPlayerSeason | undefined>, leagueOf: (clubId: string) => string, captainId: string | null, extended = false,
): ChemBreakdown {
  const placed = formation.slots.map((s) => ({ slot: s, c: lineup[s.id] })).filter((x) => !!x.c) as { slot: Formation["slots"][number]; c: FbPlayerSeason }[];
  const keyOf: Record<ChemGroupKind, (c: FbPlayerSeason) => string> = { club: (c) => c.clubId, nation: (c) => c.nation, league: (c) => leagueOf(c.clubId) };
  const members = (f: (c: FbPlayerSeason) => string[]) => {
    const m = new Map<string, string[]>();
    for (const { slot, c } of placed) for (const k of f(c)) m.set(k, [...(m.get(k) ?? []), slot.id]);
    return m;
  };
  const groups = { club: members((c) => [keyOf.club(c)]), nation: members((c) => [keyOf.nation(c)]), league: members((c) => [keyOf.league(c)]) };
  const langs = members((c) => languagesOf(c.nation)), fams = members((c) => [FAMILY[c.style]]), conts = members((c) => [continentOf(c.nation)]);
  const lvl = (n: number, t: readonly number[]) => (n >= t[2] ? 3 : n >= t[1] ? 2 : n >= t[0] ? 1 : 0);
  const slots: Record<string, SlotChem> = {};
  let total = 0;
  for (const { slot, c } of placed) {
    const outOfPosition = slotFit(c, slot.pos) < 0.9;
    const gs: ChemGroup[] = (["club", "nation", "league"] as const).map((kind) => {
      const key = keyOf[kind](c), all = groups[kind].get(key)!, t = CHEM_THRESHOLDS[kind];
      const points = lvl(all.length, t);
      return { kind, key, count: all.length, thresholds: t, points, next: t.find((x) => x > all.length) ?? null, mates: all.filter((x) => x !== slot.id) };
    });
    const extras: ChemExtra[] = [];
    if (extended) {
      const lang = languagesOf(c.nation).map((l) => ({ l, m: langs.get(l)! })).sort((a, b) => b.m.length - a.m.length)[0];
      const fam = fams.get(FAMILY[c.style])!, cont = conts.get(continentOf(c.nation))!;
      extras.push({ kind: "language", key: lang.l, count: lang.m.length, min: EXT_MIN.language, met: lang.m.length >= EXT_MIN.language, mates: lang.m.filter((x) => x !== slot.id) });
      extras.push({ kind: "style", key: FAMILY[c.style], count: fam.length, min: EXT_MIN.style, met: fam.length >= EXT_MIN.style, mates: fam.filter((x) => x !== slot.id) });
      extras.push({ kind: "continent", key: continentOf(c.nation), count: cont.length, min: EXT_MIN.continent, met: cont.length >= EXT_MIN.continent, mates: cont.filter((x) => x !== slot.id) });
    }
    const why: string[] = [];
    let raw = 0, extraPoints = 0, legend = false;
    const captain = !!captainId && c.id === captainId;
    if (!outOfPosition) {
      for (const g of gs) if (g.points) why.push(`${g.kind === "club" ? "club" : g.kind === "nation" ? "nación" : "liga"} +${g.points}`);
      raw = gs.reduce((a, g) => a + g.points, 0);
      const met = extras.filter((e) => e.met);
      if (met.length) { extraPoints = 1; raw += 1; why.push(`extra +1 (${met.map((e) => `${e.kind === "language" ? "idioma" : e.kind === "style" ? "estilo" : "continente"} ${e.key}`).join(", ")})`); }
      // Legends are never isolated: elite players keep a base of 1 (cross-era friendly).
      if (c.ovr >= 90 && raw < 1) { raw = 1; legend = true; why.push("leyenda +1"); }
      if (captain) { raw += 1; why.push("capitán +1"); }
    } else why.push("fuera de posición: 0");
    const effective = Math.min(3, raw);
    slots[slot.id] = { slotId: slot.id, cardId: c.id, outOfPosition, groups: gs, extras, extraPoints, legend, captain, raw, effective, why };
    total += effective;
  }
  return { total, extended, slots };
}

/** Compact result used by the engine; derived from chemistryBreakdown (same numbers, by construction). */
export function computeChemistry(
  formation: Formation, lineup: Record<string, FbPlayerSeason | undefined>, leagueOf: (clubId: string) => string, captainId: string | null, extended = false,
): ChemResult {
  const b = chemistryBreakdown(formation, lineup, leagueOf, captainId, extended);
  const perSlot: Record<string, number> = {}, links: Record<string, string[]> = {};
  for (const s of Object.values(b.slots)) { perSlot[s.slotId] = s.effective; links[s.slotId] = s.why; }
  return { total: b.total, perSlot, links };
}

/** Human tips: which thresholds are closest for this player (only when below 3). */
export function chemTips(s: SlotChem): string[] {
  if (s.outOfPosition) return ["Colócalo en su posición natural: fuera de posición su química individual es 0."];
  if (s.effective >= 3) return [];
  const tips: string[] = [];
  for (const g of [...s.groups].filter((g) => g.next !== null).sort((a, b) => a.next! - a.count - (b.next! - b.count))) {
    const need = g.next! - g.count;
    tips.push(`${need} jugador${need > 1 ? "es" : ""} más con su misma ${g.kind === "club" ? "club" : g.kind === "nation" ? "nacionalidad" : "liga"} (${g.count}/${g.next}) → +1.`.replace("misma club", "mismo club"));
  }
  if (s.extras.length && !s.extraPoints) {
    const e = [...s.extras].sort((a, b) => a.min - a.count - (b.min - b.count))[0];
    const need = e.min - e.count;
    tips.push(`${need} más con su ${e.kind === "language" ? "idioma" : e.kind === "style" ? "estilo" : "continente"} (${e.count}/${e.min}) → extra +1.`);
  }
  return tips.slice(0, 3);
}

/* ───────── Team ratings ───────── */
export interface FbTeamRatings {
  ovr: number; attack: number; midfield: number; defense: number; gk: number; chemistry: number; // chemistry 0..33
  att: number; def: number; // match-engine inputs (OVR scale)
  fitPenalty: number;
  outOfPosition: string[];
  notes: string[];
}

const ATT_POS: FbPos[] = ["ST", "CF", "LW", "RW"];
const MID_POS: FbPos[] = ["CAM", "CM", "CDM", "LM", "RM"];
const DEF_POS: FbPos[] = ["CB", "LB", "RB", "LWB", "RWB"];

export function teamRatings(
  formation: Formation, lineup: Record<string, FbPlayerSeason | undefined>, chem: number, fitSensitivity = 1, chemWeight = 1,
): FbTeamRatings {
  const parts = { att: [] as number[], mid: [] as number[], def: [] as number[], gk: [] as number[], all: [] as number[] };
  const outOfPosition: string[] = [];
  let fitPenalty = 0;
  for (const s of formation.slots) {
    const c = lineup[s.id];
    if (!c) continue;
    const fit = slotFit(c, s.pos);
    const factor = fit >= 1 ? 1 : 1 - (1 - fit) * 0.55 * fitSensitivity;
    if (fit < 0.9) outOfPosition.push(`${c.name} (${s.pos})`);
    fitPenalty += c.ovr * (1 - factor);
    if (s.pos === "GK") {
      const g = c.gk;
      const gkv = g ? (g.div + g.han + g.ref + g.pos) / 4 * 0.9 + g.kic * 0.1 : c.ovr * 0.45; // outfielder in goal is catastrophic
      parts.gk.push(gkv * factor); parts.all.push(c.ovr * factor); continue;
    }
    const a = c.attrs ?? { pac: 40, sho: 30, pas: 40, dri: 35, def: 30, phy: 50 };
    const attV = 0.4 * a.sho + 0.25 * a.dri + 0.2 * a.pac + 0.15 * a.pas;
    const midV = 0.35 * a.pas + 0.25 * a.dri + 0.2 * a.def + 0.2 * a.phy;
    const defV = 0.5 * a.def + 0.25 * a.phy + 0.25 * a.pac;
    // Map attribute composites back onto the OVR scale of a specialist.
    if (ATT_POS.includes(s.pos)) parts.att.push((attV + 1) * factor);
    else if (MID_POS.includes(s.pos)) { parts.mid.push((midV + 2) * factor); if (s.pos === "CAM" || s.pos === "LM" || s.pos === "RM") parts.att.push((attV + 1) * factor * 0.97); if (s.pos === "CDM") parts.def.push((defV + 1) * factor * 0.97); }
    else if (DEF_POS.includes(s.pos)) parts.def.push((defV + 1) * factor);
    parts.all.push(c.ovr * factor);
  }
  const mean = (xs: number[], fb: number) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : fb);
  const ovr = mean(parts.all, 50);
  const attack = mean(parts.att, ovr - 8);
  const midfield = mean(parts.mid, ovr - 8);
  const defense = mean(parts.def, ovr - 8);
  const gk = mean(parts.gk, 40);
  const chemAdj = (chem / 33 - 0.6) * 4 * fitSensitivity * chemWeight;
  const notes: string[] = [];
  if (parts.att.length === 0) notes.push("Sin atacantes: el gol dependerá del mediocampo.");
  if (parts.def.length < 3) notes.push("Línea defensiva muy corta.");
  if (outOfPosition.length) notes.push(`${outOfPosition.length} jugador(es) fuera de posición.`);
  // Match-engine inputs: weights sum to 1 on each side → no double counting.
  const att = 0.55 * attack + 0.3 * midfield + 0.15 * ovr + chemAdj;
  const def = 0.5 * defense + 0.25 * gk + 0.25 * midfield + chemAdj;
  return {
    ovr: Math.round(ovr), attack: Math.round(attack), midfield: Math.round(midfield), defense: Math.round(defense), gk: Math.round(gk),
    chemistry: chem, att: Math.round(att * 10) / 10, def: Math.round(def * 10) / 10, fitPenalty: Math.round(fitPenalty), outOfPosition, notes,
  };
}

export function rarityOf(ovr: number): { key: "icon" | "rare" | "gold" | "silver" | "bronze"; label: string } {
  if (ovr >= 90) return { key: "icon", label: "Leyenda" };
  if (ovr >= 85) return { key: "rare", label: "Oro raro" };
  if (ovr >= 75) return { key: "gold", label: "Oro" };
  if (ovr >= 65) return { key: "silver", label: "Plata" };
  return { key: "bronze", label: "Bronce" };
}

export const STYLE_LABEL: Record<FbStyle, string> = {
  POA: "Cazagoles", TM: "Referente", CF: "Delantero completo", F9: "Falso 9", SPD: "Velocista", IF: "Extremo a pierna cambiada",
  DRB: "Regateador", CRS: "Centrador", SS: "Segundo delantero", PM: "Creador", TQ: "Trequartista", BTB: "Box-to-box",
  REG: "Regista", DLP: "Organizador defensivo", DES: "Destructor", STO: "Stopper", BPD: "Central con salida", LIB: "Líbero",
  AFB: "Lateral ofensivo", DFB: "Lateral defensivo", SST: "Paradas", SWK: "Portero líbero",
};

/* ───────── Chemistry links & pick preview (same engine, explanatory layer) ───────── */
export type ChemLinkKind = "club" | "nation" | "league" | "language" | "style";
export interface ChemLink { a: string; b: string; kinds: ChemLinkKind[] }

/** Pairs of in-position players who share club, nation or league (the groups that feed computeChemistry). */
/** Continent is shared by most of any XI, so it counts but is not drawn as a line. */
export function chemistryLinks(formation: Formation, lineup: Record<string, FbPlayerSeason | undefined>, leagueOf: (clubId: string) => string, extended = false): ChemLink[] {
  const placed = formation.slots.map((s) => ({ s, c: lineup[s.id] })).filter((x) => x.c && slotFit(x.c, x.s.pos) >= 0.9) as { s: Formation["slots"][number]; c: FbPlayerSeason }[];
  const out: ChemLink[] = [];
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j];
    const kinds: ChemLink["kinds"] = [];
    if (a.c.clubId === b.c.clubId) kinds.push("club");
    if (a.c.nation === b.c.nation) kinds.push("nation");
    if (leagueOf(a.c.clubId) === leagueOf(b.c.clubId)) kinds.push("league");
    if (extended && a.c.nation !== b.c.nation && languagesOf(a.c.nation).some((l) => languagesOf(b.c.nation).includes(l))) kinds.push("language");
    if (extended && FAMILY[a.c.style] === FAMILY[b.c.style]) kinds.push("style");
    if (kinds.length) out.push({ a: a.s.id, b: b.s.id, kinds });
  }
  return out;
}

export interface FbPickPreview {
  before: number; after: number; delta: number;
  changes: { slotId: string; name: string; from: number; to: number }[];
  newLinks: ChemLink[]; ownChem: number; outOfPosition: boolean; reasons: string[];
  attBefore: number; attAfter: number; defBefore: number; defAfter: number;
}
export const KIND_ES: Record<ChemLinkKind, string> = { club: "club", nation: "nacionalidad", league: "liga", language: "idioma", style: "estilo de juego" };

export function previewFbPick(formation: Formation, lineup: Record<string, FbPlayerSeason | undefined>, slotId: string, card: FbPlayerSeason, leagueOf: (clubId: string) => string, captainId: string | null, fitSensitivity = 1, chemWeight = 1, extended = false): FbPickPreview {
  const before = computeChemistry(formation, lineup, leagueOf, captainId, extended);
  const nextLineup = { ...lineup, [slotId]: card };
  const after = computeChemistry(formation, nextLineup, leagueOf, captainId, extended);
  const changes = formation.slots.filter((s) => s.id !== slotId && lineup[s.id] && (before.perSlot[s.id] ?? 0) !== (after.perSlot[s.id] ?? 0))
    .map((s) => ({ slotId: s.id, name: lineup[s.id]!.name, from: before.perSlot[s.id] ?? 0, to: after.perSlot[s.id] ?? 0 }));
  const linksBefore = new Set(chemistryLinks(formation, lineup, leagueOf, extended).map((l) => `${l.a}|${l.b}|${l.kinds.join()}`));
  const newLinks = chemistryLinks(formation, nextLineup, leagueOf, extended).filter((l) => (l.a === slotId || l.b === slotId) && !linksBefore.has(`${l.a}|${l.b}|${l.kinds.join()}`));
  const slot = formation.slots.find((s) => s.id === slotId)!;
  const outOfPosition = slotFit(card, slot.pos) < 0.9;
  const shared = new Map<string, Set<string>>();
  for (const l of newLinks) for (const k of l.kinds) { const other = l.a === slotId ? l.b : l.a; if (!shared.has(k)) shared.set(k, new Set()); shared.get(k)!.add(nextLineup[other]!.name); }
  const reasons: string[] = [];
  if (outOfPosition) reasons.push(`Fuera de posición en ${slot.pos}: su química individual será 0.`);
  for (const [k, names] of shared) reasons.push(`Comparte ${KIND_ES[k as keyof typeof KIND_ES]} con ${[...names].slice(0, 4).join(", ")}${names.size > 4 ? "…" : ""}.`);
  if (!reasons.length) reasons.push(extended ? "No comparte club, nación, liga, idioma ni estilo con nadie del XI todavía." : "No comparte club, nacionalidad ni liga con nadie del XI todavía.");
  const rb = teamRatings(formation, lineup, before.total, fitSensitivity, chemWeight), ra = teamRatings(formation, nextLineup, after.total, fitSensitivity, chemWeight);
  return { before: before.total, after: after.total, delta: after.total - before.total, changes, newLinks, ownChem: after.perSlot[slotId] ?? 0, outOfPosition, reasons, attBefore: rb.att, attAfter: ra.att, defBefore: rb.def, defAfter: ra.def };
}

/** How chemistry moves the match engine inputs: (chem/33 − 0.6)·4 on ATT and DEF (× difficulty × mode weight). */
export const chemistryEffect = (chem: number, fitSensitivity = 1, chemWeight = 1) => Math.round((chem / 33 - 0.6) * 4 * fitSensitivity * chemWeight * 10) / 10;
