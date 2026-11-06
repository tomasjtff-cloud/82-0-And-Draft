/**
 * Football draft engine — pure & deterministic.
 * Modes:
 *  - roulette: per slot, spin (club, decade) among combos with ≥1 eligible
 *    player for that slot; up to 5 options. Re-spin club keeps decade+slot,
 *    re-spin era keeps club+slot.
 *  - fut: captain from 5 elite cards, then 5 cards per slot with a quality
 *    distribution. Re-spins act as optional filters (club / decade).
 */
import { Rng } from "@/lib/core/rng";
import type { Difficulty } from "@/lib/core/difficulty";
import { FB_PLAYER_SEASONS } from "@/lib/data/football/players";
import { FORMATION_BY_ID, draftOrder } from "@/lib/data/football/formations";
import { DRAFT_FIT_MIN, slotFit } from "@/lib/ratings/football";
import type { DraftMode, FbDecade, FbDraftState, FbPlayerSeason, FbSpin, FormationSlot } from "@/types/football";

export const FB_CARDS = FB_PLAYER_SEASONS;
export const FB_CARD_BY_ID: Record<string, FbPlayerSeason> = Object.fromEntries(FB_CARDS.map((c) => [c.id, c]));

const POOL = new Map<string, FbPlayerSeason[]>();
for (const c of FB_CARDS) {
  const k = `${c.clubId}|${c.decade}`;
  if (!POOL.has(k)) POOL.set(k, []);
  POOL.get(k)!.push(c);
}

export type Result<T> = { ok: true; state: T } | { ok: false; error: string };

export function slotById(state: Pick<FbDraftState, "formationId">, slotId: string): FormationSlot {
  const s = FORMATION_BY_ID[state.formationId].slots.find((x) => x.id === slotId);
  if (!s) throw new Error(`Slot ${slotId} not in formation`);
  return s;
}
function usedPlayers(state: Pick<FbDraftState, "lineup">): Set<string> {
  return new Set(Object.values(state.lineup).map((id) => FB_CARD_BY_ID[id].playerId));
}
export function eligibleFor(state: Pick<FbDraftState, "lineup" | "formationId">, slotId: string, card: FbPlayerSeason): boolean {
  if (usedPlayers(state).has(card.playerId)) return false;
  return slotFit(card, slotById(state, slotId).pos) >= DRAFT_FIT_MIN;
}

export function rouletteCombos(state: Pick<FbDraftState, "lineup" | "formationId">, slotId: string): FbSpin[] {
  const out: FbSpin[] = [];
  for (const [k, cards] of POOL) {
    if (cards.some((c) => eligibleFor(state, slotId, c))) {
      const [clubId, decade] = k.split("|");
      out.push({ clubId, decade: decade as FbDecade });
    }
  }
  return out.sort((a, b) => (a.clubId + a.decade).localeCompare(b.clubId + b.decade));
}

function rouletteOptions(state: FbDraftState, spin: FbSpin, slotId: string, rng: Rng): string[] {
  const elig = (POOL.get(`${spin.clubId}|${spin.decade}`) ?? []).filter((c) => eligibleFor(state, slotId, c));
  return rng.shuffle(elig).slice(0, 5).sort((a, b) => b.ovr - a.ovr).map((c) => c.id);
}

/** FUT pack weighting: favours mid/high golds, keeps 90+ rare. */
function futWeight(ovr: number): number {
  if (ovr >= 92) return 0.35;
  if (ovr >= 89) return 0.7;
  if (ovr >= 85) return 1.2;
  if (ovr >= 80) return 1.4;
  return 1.0;
}
function futOptions(state: FbDraftState, slotId: string, rng: Rng, filter: FbDraftState["filter"]): string[] {
  let elig = FB_CARDS.filter((c) => eligibleFor(state, slotId, c));
  if (filter?.clubId) elig = elig.filter((c) => c.clubId === filter.clubId);
  if (filter?.decade) elig = elig.filter((c) => c.decade === filter.decade);
  const chosen: FbPlayerSeason[] = [];
  const pool = [...elig];
  while (chosen.length < 5 && pool.length) {
    const c = rng.weighted(pool, (x) => futWeight(x.ovr));
    chosen.push(c);
    // never two versions of the same player in one pack
    for (let i = pool.length - 1; i >= 0; i--) if (pool[i].playerId === c.playerId) pool.splice(i, 1);
  }
  return chosen.sort((a, b) => b.ovr - a.ovr).map((c) => c.id);
}
function captainOptions(rng: Rng): string[] {
  const elite = FB_CARDS.filter((c) => c.ovr >= 88);
  const out: FbPlayerSeason[] = [];
  const pool = [...elite];
  while (out.length < 5 && pool.length) {
    const c = rng.pick(pool);
    // spread positions: avoid more than 2 captains of the same primary position
    if (out.filter((o) => o.positions[0] === c.positions[0]).length < 2) out.push(c);
    for (let i = pool.length - 1; i >= 0; i--) if (pool[i].playerId === c.playerId) pool.splice(i, 1);
  }
  return out.sort((a, b) => b.ovr - a.ovr).map((c) => c.id);
}

export function createFbDraft(seed: string, difficulty: Difficulty, mode: DraftMode, formationId: string): FbDraftState {
  if (!FORMATION_BY_ID[formationId]) throw new Error("Formación desconocida");
  const rng = new Rng(`fb-draft:${mode}:${seed}`);
  const base: FbDraftState = {
    seed, difficulty, mode, formationId, step: 0, order: draftOrder(formationId), currentSlot: null, spin: null, filter: null,
    options: [], lineup: {}, captainId: null, respins: { club: 1, era: 1 }, rngState: rng.state(),
  };
  if (mode === "fut") {
    return { ...base, options: captainOptions(rng), rngState: rng.state() };
  }
  return advance(base);
}

export function isFbComplete(state: Pick<FbDraftState, "lineup" | "formationId">): boolean {
  return FORMATION_BY_ID[state.formationId].slots.every((s) => !!state.lineup[s.id]);
}
function nextOpenSlot(state: FbDraftState): string | null {
  return state.order.find((id) => !state.lineup[id]) ?? null;
}

/** Move to the next open slot and generate its options. */
function advance(state: FbDraftState): FbDraftState {
  const slotId = nextOpenSlot(state);
  if (!slotId) return { ...state, currentSlot: null, spin: null, options: [] };
  const rng = Rng.fromState(state.rngState);
  if (state.mode === "roulette") {
    const combos = rouletteCombos(state, slotId);
    if (!combos.length) throw new Error(`Sin jugadores elegibles para ${slotId}`);
    const clubs = [...new Set(combos.map((c) => c.clubId))].sort();
    const clubId = rng.pick(clubs);
    const decades = combos.filter((c) => c.clubId === clubId).map((c) => c.decade).sort();
    const spin = { clubId, decade: rng.pick(decades) };
    return { ...state, currentSlot: slotId, spin, options: rouletteOptions(state, spin, slotId, rng), rngState: rng.state() };
  }
  const filter = null;
  return { ...state, currentSlot: slotId, filter, options: futOptions(state, slotId, rng, filter), rngState: rng.state() };
}

/** FUT: choose the captain and the slot where he plays. */
export function pickCaptain(state: FbDraftState, cardId: string, slotId: string): Result<FbDraftState> {
  if (state.mode !== "fut" || state.captainId) return { ok: false, error: "El capitán ya fue elegido." };
  if (!state.options.includes(cardId)) return { ok: false, error: "Capitán no disponible." };
  const card = FB_CARD_BY_ID[cardId];
  if (slotFit(card, slotById(state, slotId).pos) < DRAFT_FIT_MIN) return { ok: false, error: `${card.name} no encaja en ${slotId}.` };
  const next = { ...state, captainId: cardId, lineup: { [slotId]: cardId }, step: 1 };
  return { ok: true, state: advance(next) };
}

export function captainSlots(state: FbDraftState, cardId: string): string[] {
  const card = FB_CARD_BY_ID[cardId];
  return FORMATION_BY_ID[state.formationId].slots.filter((s) => slotFit(card, s.pos) >= DRAFT_FIT_MIN).map((s) => s.id);
}

export function pickFb(state: FbDraftState, cardId: string): Result<FbDraftState> {
  if (state.mode === "fut" && !state.captainId) return { ok: false, error: "Primero elige al capitán." };
  const slotId = state.currentSlot;
  if (!slotId) return { ok: false, error: "El once ya está completo." };
  if (!state.options.includes(cardId)) return { ok: false, error: "Esa carta no está disponible." };
  const card = FB_CARD_BY_ID[cardId];
  if (!eligibleFor(state, slotId, card)) return { ok: false, error: `${card.name} no es elegible para ${slotId}.` };
  const next: FbDraftState = { ...state, lineup: { ...state.lineup, [slotId]: cardId }, step: state.step + 1, filter: null };
  return { ok: true, state: advance(next) };
}

/** RE-SPIN CLUB. Roulette: new club, same decade & slot. FUT: re-draw the 5 cards filtered to one club. */
export function respinClub(state: FbDraftState): Result<FbDraftState> {
  if (state.respins.club <= 0) return { ok: false, error: "Ya usaste el re-spin de club." };
  const slotId = state.currentSlot;
  if (!slotId) return { ok: false, error: "No hay ronda activa." };
  const rng = Rng.fromState(state.rngState);
  if (state.mode === "roulette") {
    const opts = rouletteCombos(state, slotId).filter((c) => c.decade === state.spin!.decade && c.clubId !== state.spin!.clubId);
    if (!opts.length) return { ok: false, error: "No hay otro club con jugadores elegibles en esta década para esta posición." };
    const spin = { clubId: rng.pick(opts).clubId, decade: state.spin!.decade };
    return { ok: true, state: { ...state, spin, options: rouletteOptions(state, spin, slotId, rng), respins: { ...state.respins, club: state.respins.club - 1 }, rngState: rng.state() } };
  }
  const clubs = [...new Set(FB_CARDS.filter((c) => eligibleFor(state, slotId, c)).map((c) => c.clubId))].sort();
  if (!clubs.length) return { ok: false, error: "Sin clubes elegibles." };
  const filter = { clubId: rng.pick(clubs) };
  return { ok: true, state: { ...state, filter, options: futOptions(state, slotId, rng, filter), respins: { ...state.respins, club: state.respins.club - 1 }, rngState: rng.state() } };
}

/** RE-SPIN ERA. Roulette: new decade, same club & slot. FUT: re-draw filtered to one decade. */
export function respinEra(state: FbDraftState): Result<FbDraftState> {
  if (state.respins.era <= 0) return { ok: false, error: "Ya usaste el re-spin de época." };
  const slotId = state.currentSlot;
  if (!slotId) return { ok: false, error: "No hay ronda activa." };
  const rng = Rng.fromState(state.rngState);
  if (state.mode === "roulette") {
    const opts = rouletteCombos(state, slotId).filter((c) => c.clubId === state.spin!.clubId && c.decade !== state.spin!.decade);
    if (!opts.length) return { ok: false, error: "Este club no tiene otra década con jugadores elegibles para esta posición." };
    const spin = { clubId: state.spin!.clubId, decade: rng.pick(opts).decade };
    return { ok: true, state: { ...state, spin, options: rouletteOptions(state, spin, slotId, rng), respins: { ...state.respins, era: state.respins.era - 1 }, rngState: rng.state() } };
  }
  const decades = [...new Set(FB_CARDS.filter((c) => eligibleFor(state, slotId, c)).map((c) => c.decade))].sort();
  if (!decades.length) return { ok: false, error: "Sin décadas elegibles." };
  const filter = { decade: rng.pick(decades) };
  return { ok: true, state: { ...state, filter, options: futOptions(state, slotId, rng, filter), respins: { ...state.respins, era: state.respins.era - 1 }, rngState: rng.state() } };
}

export function canRespinClub(state: FbDraftState): boolean {
  if (state.respins.club <= 0 || !state.currentSlot || (state.mode === "fut" && !state.captainId)) return false;
  if (state.mode === "fut") return true;
  return rouletteCombos(state, state.currentSlot).some((c) => c.decade === state.spin!.decade && c.clubId !== state.spin!.clubId);
}
export function canRespinEra(state: FbDraftState): boolean {
  if (state.respins.era <= 0 || !state.currentSlot || (state.mode === "fut" && !state.captainId)) return false;
  if (state.mode === "fut") return true;
  return rouletteCombos(state, state.currentSlot).some((c) => c.clubId === state.spin!.clubId && c.decade !== state.spin!.decade);
}

/** Swap two slots (GK only with GK). Positional consequences are reflected in ratings, not blocked. */
export function swapSlots(state: FbDraftState, a: string, b: string): Result<FbDraftState> {
  const sa = slotById(state, a), sb = slotById(state, b);
  if ((sa.pos === "GK") !== (sb.pos === "GK")) return { ok: false, error: "Un portero solo puede intercambiarse con la portería." };
  const lineup = { ...state.lineup };
  const ca = lineup[a], cb = lineup[b];
  if (cb) lineup[a] = cb; else delete lineup[a];
  if (ca) lineup[b] = ca; else delete lineup[b];
  return { ok: true, state: { ...state, lineup } };
}

/** Change formation after the draft: greedy re-assignment by positional fit. */
export function changeFormation(state: FbDraftState, formationId: string): Result<FbDraftState> {
  const fm = FORMATION_BY_ID[formationId];
  if (!fm) return { ok: false, error: "Formación desconocida." };
  if (!isFbComplete(state)) return { ok: false, error: "Completa el draft antes de cambiar la formación." };
  const cards = Object.values(state.lineup).map((id) => FB_CARD_BY_ID[id]);
  const gk = cards.filter((c) => c.positions[0] === "GK");
  const out = cards.filter((c) => c.positions[0] !== "GK");
  const lineup: Record<string, string> = {};
  const gkSlot = fm.slots.find((s) => s.pos === "GK")!;
  if (gk[0]) lineup[gkSlot.id] = gk[0].id;
  const remaining = [...out, ...gk.slice(1)];
  const slots = fm.slots.filter((s) => s.pos !== "GK");
  // assign highest-fit pairs first
  const pairs: { s: FormationSlot; c: FbPlayerSeason; f: number }[] = [];
  for (const s of slots) for (const c of remaining) pairs.push({ s, c, f: slotFit(c, s.pos) * 100 + c.ovr / 100 });
  pairs.sort((x, y) => y.f - x.f);
  const usedS = new Set<string>(), usedC = new Set<string>();
  for (const p of pairs) {
    if (usedS.has(p.s.id) || usedC.has(p.c.id)) continue;
    lineup[p.s.id] = p.c.id; usedS.add(p.s.id); usedC.add(p.c.id);
  }
  return { ok: true, state: { ...state, formationId, order: draftOrder(formationId), lineup } };
}
