/**
 * Deterministic, serializable PRNG (sfc32) used by every engine.
 * Same seed + same inputs => identical results. State is a plain tuple so it
 * can be stored in localStorage and resumed (LIVE SEASON).
 */
export type RngState = [number, number, number, number];

export function hashSeed(seed: string | number): RngState {
  const str = String(seed);
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export class Rng {
  private s: RngState;
  constructor(seed: string | number | RngState) {
    this.s = Array.isArray(seed) ? ([...seed] as RngState) : hashSeed(seed);
    for (let i = 0; i < 12; i++) this.next();
  }
  static fromState(state: RngState): Rng {
    const r = Object.create(Rng.prototype) as Rng;
    r.s = [...state] as RngState;
    return r;
  }
  state(): RngState {
    return [...this.s] as RngState;
  }
  /** Uniform in [0,1) */
  next(): number {
    let [a, b, c, d] = this.s;
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.s = [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
    return (t >>> 0) / 4294967296;
  }
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("Rng.pick on empty array");
    return arr[this.int(arr.length)];
  }
  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /** Standard normal via Box-Muller */
  normal(mean = 0, sd = 1): number {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /** Poisson sample (Knuth; lambdas here are small, < 6) */
  poisson(lambda: number): number {
    if (!(lambda > 0)) return 0;
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= this.next(); } while (p > L && k < 30);
    return k - 1;
  }
  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    const ws = items.map(weight);
    const total = ws.reduce((s, w) => s + Math.max(0, w), 0);
    if (total <= 0) return this.pick(items);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, ws[i]);
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}

export function randomSeed(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
