export type Difficulty = "EASY" | "NORMAL" | "HARD";
export const DIFFICULTIES: Difficulty[] = ["EASY", "NORMAL", "HARD"];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  EASY: "Sencillo",
  NORMAL: "Regular",
  HARD: "Difícil",
};

/** Explicit, documented parameters. Difficulty never forces a result. */
export interface DifficultyParams {
  /** NBA: points added to every opponent's net rating */
  nbaOpponentBoost: number;
  /** NBA: std-dev of single-game margin (more noise = more upsets) */
  nbaGameSd: number;
  /** NBA: multiplier on team-fit penalties (imbalance sensitivity) */
  nbaFitSensitivity: number;
  /** NBA: fatigue — extra penalty on back-to-backs */
  nbaFatigue: number;
  /** Football: OVR points added to every rival club */
  fbRivalBoost: number;
  /** Football: multiplier on positional / chemistry penalties */
  fbFitSensitivity: number;
  /** Football: fatigue multiplier from fixture congestion */
  fbFatigue: number;
}

export const DIFFICULTY_PARAMS: Record<Difficulty, DifficultyParams> = {
  EASY: { nbaOpponentBoost: -3, nbaGameSd: 12, nbaFitSensitivity: 0.6, nbaFatigue: 0.5, fbRivalBoost: -3, fbFitSensitivity: 0.6, fbFatigue: 0.5 },
  NORMAL: { nbaOpponentBoost: 0, nbaGameSd: 12.5, nbaFitSensitivity: 1, nbaFatigue: 1, fbRivalBoost: 0, fbFitSensitivity: 1, fbFatigue: 1 },
  HARD: { nbaOpponentBoost: 3, nbaGameSd: 13, nbaFitSensitivity: 1.4, nbaFatigue: 1.5, fbRivalBoost: 2.5, fbFitSensitivity: 1.4, fbFatigue: 1.5 },
};

export const DIFFICULTY_EXPLAIN: Record<Difficulty, string> = {
  EASY: "Rivales algo más débiles, menor penalización por desequilibrios y fatiga reducida.",
  NORMAL: "Parámetros de referencia del motor.",
  HARD: "Rivales más fuertes, más castigo por desequilibrios del equipo y más fatiga en tramos cargados.",
};

/** Spanish display names (internal ids stay EASY/NORMAL/HARD). */
export const DIFFICULTY_NAME: Record<string, string> = { EASY: "Fácil", NORMAL: "Normal", HARD: "Difícil" };
export const diffName = (d: string) => DIFFICULTY_NAME[d] ?? d;
