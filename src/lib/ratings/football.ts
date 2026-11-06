/**
 * Football rating system (Legends Lab, original).
 * - Attributes are ESTIMATES derived from a curated overall + play-style
 *   archetype + deterministic per-player variation. They are NOT EA ratings.
 * - Positional compatibility, chemistry and line ratings feed the season engine.
 */
import type { FbAttrs, FbPlayerSeason, FbPos, FbStyle, Formation, GkAttrs } from "@/types/football";

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

export function computeChemistry(
  formation: Formation, lineup: Record<string, FbPlayerSeason | undefined>, leagueOf: (clubId: string) => string, captainId: string | null,
): ChemResult {
  const placed = formation.slots.map((s) => ({ slot: s, c: lineup[s.id] })).filter((x) => !!x.c) as { slot: Formation["slots"][number]; c: FbPlayerSeason }[];
  const count = (key: (c: FbPlayerSeason) => string) => {
    const m = new Map<string, number>();
    for (const { c } of placed) m.set(key(c), (m.get(key(c)) ?? 0) + 1);
    return m;
  };
  const clubs = count((c) => c.clubId), nations = count((c) => c.nation), leagues = count((c) => leagueOf(c.clubId));
  const lvl = (n: number, t: [number, number, number]) => (n >= t[2] ? 3 : n >= t[1] ? 2 : n >= t[0] ? 1 : 0);
  const perSlot: Record<string, number> = {};
  const links: Record<string, string[]> = {};
  let total = 0;
  for (const { slot, c } of placed) {
    const fit = slotFit(c, slot.pos);
    const why: string[] = [];
    let pts = 0;
    if (fit >= 0.9) {
      const cl = lvl(clubs.get(c.clubId)!, [2, 4, 6]);
      const na = lvl(nations.get(c.nation)!, [2, 4, 7]);
      const le = lvl(leagues.get(leagueOf(c.clubId))!, [3, 5, 8]);
      if (cl) why.push(`club +${cl}`); if (na) why.push(`nación +${na}`); if (le) why.push(`liga +${le}`);
      pts = cl + na + le;
      // Legends are never isolated: elite players keep a base of 1 (cross-era friendly).
      if (c.ovr >= 90 && pts < 1) { pts = 1; why.push("leyenda +1"); }
      if (captainId && c.id === captainId) { pts += 1; why.push("capitán +1"); }
    } else {
      why.push("fuera de posición: 0");
    }
    perSlot[slot.id] = Math.min(3, pts);
    links[slot.id] = why;
    total += perSlot[slot.id];
  }
  return { total, perSlot, links };
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
  formation: Formation, lineup: Record<string, FbPlayerSeason | undefined>, chem: number, fitSensitivity = 1,
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
  const chemAdj = (chem / 33 - 0.6) * 4 * fitSensitivity;
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
export interface ChemLink { a: string; b: string; kinds: ("club" | "nation" | "league")[] }

/** Pairs of in-position players who share club, nation or league (the groups that feed computeChemistry). */
export function chemistryLinks(formation: Formation, lineup: Record<string, FbPlayerSeason | undefined>, leagueOf: (clubId: string) => string): ChemLink[] {
  const placed = formation.slots.map((s) => ({ s, c: lineup[s.id] })).filter((x) => x.c && slotFit(x.c, x.s.pos) >= 0.9) as { s: Formation["slots"][number]; c: FbPlayerSeason }[];
  const out: ChemLink[] = [];
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j];
    const kinds: ChemLink["kinds"] = [];
    if (a.c.clubId === b.c.clubId) kinds.push("club");
    if (a.c.nation === b.c.nation) kinds.push("nation");
    if (leagueOf(a.c.clubId) === leagueOf(b.c.clubId)) kinds.push("league");
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
const KIND_ES = { club: "club", nation: "nacionalidad", league: "liga" } as const;

export function previewFbPick(formation: Formation, lineup: Record<string, FbPlayerSeason | undefined>, slotId: string, card: FbPlayerSeason, leagueOf: (clubId: string) => string, captainId: string | null, fitSensitivity = 1): FbPickPreview {
  const before = computeChemistry(formation, lineup, leagueOf, captainId);
  const nextLineup = { ...lineup, [slotId]: card };
  const after = computeChemistry(formation, nextLineup, leagueOf, captainId);
  const changes = formation.slots.filter((s) => s.id !== slotId && lineup[s.id] && (before.perSlot[s.id] ?? 0) !== (after.perSlot[s.id] ?? 0))
    .map((s) => ({ slotId: s.id, name: lineup[s.id]!.name, from: before.perSlot[s.id] ?? 0, to: after.perSlot[s.id] ?? 0 }));
  const linksBefore = new Set(chemistryLinks(formation, lineup, leagueOf).map((l) => `${l.a}|${l.b}|${l.kinds.join()}`));
  const newLinks = chemistryLinks(formation, nextLineup, leagueOf).filter((l) => (l.a === slotId || l.b === slotId) && !linksBefore.has(`${l.a}|${l.b}|${l.kinds.join()}`));
  const slot = formation.slots.find((s) => s.id === slotId)!;
  const outOfPosition = slotFit(card, slot.pos) < 0.9;
  const shared = new Map<string, Set<string>>();
  for (const l of newLinks) for (const k of l.kinds) { const other = l.a === slotId ? l.b : l.a; if (!shared.has(k)) shared.set(k, new Set()); shared.get(k)!.add(nextLineup[other]!.name); }
  const reasons: string[] = [];
  if (outOfPosition) reasons.push(`Fuera de posición en ${slot.pos}: su química individual será 0.`);
  for (const [k, names] of shared) reasons.push(`Comparte ${KIND_ES[k as keyof typeof KIND_ES]} con ${[...names].slice(0, 4).join(", ")}${names.size > 4 ? "…" : ""}.`);
  if (!reasons.length) reasons.push("No comparte club, nacionalidad ni liga con nadie del XI todavía.");
  const rb = teamRatings(formation, lineup, before.total, fitSensitivity), ra = teamRatings(formation, nextLineup, after.total, fitSensitivity);
  return { before: before.total, after: after.total, delta: after.total - before.total, changes, newLinks, ownChem: after.perSlot[slotId] ?? 0, outOfPosition, reasons, attBefore: rb.att, attAfter: ra.att, defBefore: rb.def, defAfter: ra.def };
}

/** How chemistry moves the match engine inputs: (chem/33 − 0.6)·4 on ATT and DEF (scaled by difficulty). */
export const chemistryEffect = (chem: number, fitSensitivity = 1) => Math.round((chem / 33 - 0.6) * 4 * fitSensitivity * 10) / 10;
