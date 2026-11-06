/**
 * NBA 82-0 draft engine — pure, deterministic, UI-agnostic.
 * Five rounds. Each round spins (franchise, decade) independently among
 * combinations that contain at least one card that can still be placed.
 * Re-spins: 1 team + 1 era per full draft; only consumed on success.
 */
import { Rng } from "@/lib/core/rng";
import type { Difficulty } from "@/lib/core/difficulty";
import { NBA_PLAYER_SEASONS } from "@/lib/data/nba/players";
import { toCard } from "@/lib/ratings/nba";
import type { Decade, NbaCard, NbaDraftState, NbaPos, NbaSpin } from "@/types/nba";
import { NBA_POSITIONS } from "@/types/nba";

/** Rows contradicted by an external source never enter the draft. */
export const ALL_CARDS: NbaCard[] = NBA_PLAYER_SEASONS.map(toCard).filter((c) => c.check.membership !== "contradicted");
export const CARD_BY_ID: Record<string, NbaCard> = Object.fromEntries(ALL_CARDS.map((c) => [c.id, c]));

const POOL = new Map<string, NbaCard[]>();
for (const c of ALL_CARDS) {
  const k = `${c.franchiseId}|${c.decade}`;
  if (!POOL.has(k)) POOL.set(k, []);
  POOL.get(k)!.push(c);
}
export function poolFor(spin: NbaSpin): NbaCard[] {
  return (POOL.get(`${spin.franchiseId}|${spin.decade}`) ?? []).slice().sort((a, b) => b.ratings.overall - a.ratings.overall);
}

export function openPositions(state: Pick<NbaDraftState, "lineup">): NbaPos[] {
  return NBA_POSITIONS.filter((p) => !state.lineup[p]);
}
function usedPlayerIds(state: Pick<NbaDraftState, "lineup">): Set<string> {
  return new Set(Object.values(state.lineup).filter(Boolean).map((id) => CARD_BY_ID[id!].playerId));
}

/** Can this card be placed right now? (open position + not already drafted in any version) */
export function placeablePositions(state: Pick<NbaDraftState, "lineup">, card: NbaCard): NbaPos[] {
  if (usedPlayerIds(state).has(card.playerId)) return [];
  const open = openPositions(state);
  return card.positions.filter((p) => open.includes(p));
}

function eligibleCount(state: Pick<NbaDraftState, "lineup">, spin: NbaSpin): number {
  return poolFor(spin).filter((c) => placeablePositions(state, c).length > 0).length;
}

/** All (franchise, decade) combos with at least one placeable card. */
export function validCombos(state: Pick<NbaDraftState, "lineup">): NbaSpin[] {
  const out: NbaSpin[] = [];
  for (const k of POOL.keys()) {
    const [franchiseId, decade] = k.split("|");
    const spin = { franchiseId, decade: decade as Decade };
    if (eligibleCount(state, spin) > 0) out.push(spin);
  }
  return out.sort((a, b) => (a.franchiseId + a.decade).localeCompare(b.franchiseId + b.decade));
}

/** Two-stage spin: franchise uniformly, then decade among that franchise's valid decades. */
function spinFrom(rng: Rng, combos: NbaSpin[]): NbaSpin {
  const franchises = [...new Set(combos.map((c) => c.franchiseId))].sort();
  const f = rng.pick(franchises);
  const decades = combos.filter((c) => c.franchiseId === f).map((c) => c.decade).sort();
  return { franchiseId: f, decade: rng.pick(decades) };
}

export function createDraft(seed: string, difficulty: Difficulty): NbaDraftState {
  const rng = new Rng(`nba-draft:${seed}`);
  const base: NbaDraftState = {
    seed, difficulty, round: 0, spin: null, options: [], lineup: {},
    respins: { team: 1, era: 1 }, history: [], rngState: rng.state(),
  };
  return doSpin(base);
}

function withSpin(state: NbaDraftState, spin: NbaSpin, rng: Rng): NbaDraftState {
  return { ...state, spin, options: poolFor(spin).map((c) => c.id), rngState: rng.state() };
}

function doSpin(state: NbaDraftState): NbaDraftState {
  const rng = Rng.fromState(state.rngState);
  const combos = validCombos(state);
  if (combos.length === 0) throw new Error("No hay combinaciones válidas en el dataset");
  return withSpin(state, spinFrom(rng, combos), rng);
}

export function teamRespinOptions(state: NbaDraftState): string[] {
  if (!state.spin) return [];
  return validCombos(state).filter((c) => c.decade === state.spin!.decade && c.franchiseId !== state.spin!.franchiseId).map((c) => c.franchiseId);
}
export function eraRespinOptions(state: NbaDraftState): Decade[] {
  if (!state.spin) return [];
  return validCombos(state).filter((c) => c.franchiseId === state.spin!.franchiseId && c.decade !== state.spin!.decade).map((c) => c.decade);
}

export type Result<T> = { ok: true; state: T } | { ok: false; error: string };

/** RE-SPIN TEAM: changes only the franchise, keeps the decade. */
export function respinTeam(state: NbaDraftState): Result<NbaDraftState> {
  if (state.respins.team <= 0) return { ok: false, error: "Ya usaste el re-spin de equipo." };
  const opts = teamRespinOptions(state);
  if (opts.length === 0) return { ok: false, error: "No hay otra franquicia con jugadores elegibles en esta década." };
  const rng = Rng.fromState(state.rngState);
  const franchiseId = rng.pick(opts);
  const next = withSpin(state, { franchiseId, decade: state.spin!.decade }, rng);
  return { ok: true, state: { ...next, respins: { ...state.respins, team: state.respins.team - 1 } } };
}

/** RE-SPIN ERA: changes only the decade, keeps the franchise. */
export function respinEra(state: NbaDraftState): Result<NbaDraftState> {
  if (state.respins.era <= 0) return { ok: false, error: "Ya usaste el re-spin de época." };
  const opts = eraRespinOptions(state);
  if (opts.length === 0) return { ok: false, error: "Esta franquicia no tiene otra década con jugadores elegibles." };
  const rng = Rng.fromState(state.rngState);
  const decade = rng.pick(opts);
  const next = withSpin(state, { franchiseId: state.spin!.franchiseId, decade }, rng);
  return { ok: true, state: { ...next, respins: { ...state.respins, era: state.respins.era - 1 } } };
}

export function pick(state: NbaDraftState, cardId: string, pos: NbaPos): Result<NbaDraftState> {
  if (isComplete(state)) return { ok: false, error: "El quinteto ya está completo." };
  if (!state.options.includes(cardId)) return { ok: false, error: "Ese jugador no está disponible en esta ronda." };
  const card = CARD_BY_ID[cardId];
  if (!card) return { ok: false, error: "Jugador desconocido." };
  if (state.lineup[pos]) return { ok: false, error: `La posición ${pos} ya está ocupada.` };
  if (!card.positions.includes(pos)) return { ok: false, error: `${card.name} no puede jugar de ${pos}.` };
  if (usedPlayerIds(state).has(card.playerId)) return { ok: false, error: `${card.name} ya está en tu quinteto.` };
  const next: NbaDraftState = {
    ...state,
    lineup: { ...state.lineup, [pos]: cardId },
    history: [...state.history, { round: state.round, spin: state.spin!, pickedId: cardId, pos }],
    round: state.round + 1,
  };
  if (isComplete(next)) return { ok: true, state: { ...next, spin: null, options: [] } };
  return { ok: true, state: doSpin(next) };
}

export function isComplete(state: Pick<NbaDraftState, "lineup">): boolean {
  return NBA_POSITIONS.every((p) => !!state.lineup[p]);
}

export function lineupCards(state: Pick<NbaDraftState, "lineup">): Partial<Record<NbaPos, NbaCard>> {
  const out: Partial<Record<NbaPos, NbaCard>> = {};
  for (const p of NBA_POSITIONS) if (state.lineup[p]) out[p] = CARD_BY_ID[state.lineup[p]!];
  return out;
}

/** Swap two filled/empty slots if both cards can legally play the destination. */
export function movePlayer(state: NbaDraftState, from: NbaPos, to: NbaPos): Result<NbaDraftState> {
  const a = state.lineup[from];
  if (!a) return { ok: false, error: "No hay jugador en esa posición." };
  const b = state.lineup[to];
  const ca = CARD_BY_ID[a];
  if (!ca.positions.includes(to)) return { ok: false, error: `${ca.name} no puede jugar de ${to}.` };
  if (b && !CARD_BY_ID[b].positions.includes(from)) return { ok: false, error: `${CARD_BY_ID[b].name} no puede jugar de ${from}.` };
  const lineup = { ...state.lineup, [to]: a, [from]: b };
  if (!b) delete lineup[from];
  return { ok: true, state: { ...state, lineup } };
}
