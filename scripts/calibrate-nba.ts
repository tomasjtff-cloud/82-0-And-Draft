/**
 * Fits the NBA box-score impact model against FiveThirtyEight RAPTOR (real
 * on/off + box impact, CC BY 4.0) for every verified player-season, weighted
 * by minutes. Writes src/lib/ratings/nba-calibration.json.
 *   npx tsx scripts/calibrate-nba.ts
 */
import fs from "node:fs";
import { NBA_PLAYER_SEASONS } from "../src/lib/data/nba/players";
import { nbaVerification } from "../src/lib/data/verification";
import { FEATURE_NAMES, designRow, nbaFeatures } from "../src/lib/ratings/nba-features";

const X: number[][] = [], y: number[] = [], w: number[] = [];
for (const p of NBA_PLAYER_SEASONS) {
  const v = nbaVerification(p.id);
  if (!v.raptor || v.raptor.mp < 800) continue;
  X.push(designRow(nbaFeatures(p))); y.push(v.raptor.raptorTotal); w.push(Math.min(1, v.raptor.mp / 2500));
}
const k = FEATURE_NAMES.length;
// Ridge-regularised weighted least squares: (XᵀWX + λI) β = XᵀWy  (no penalty on intercept)
const A = Array.from({ length: k }, () => new Array(k).fill(0)), b = new Array(k).fill(0);
for (let i = 0; i < X.length; i++) for (let r = 0; r < k; r++) { b[r] += w[i] * X[i][r] * y[i]; for (let c = 0; c < k; c++) A[r][c] += w[i] * X[i][r] * X[i][c]; }
for (let r = 1; r < k; r++) A[r][r] += 2;
// Gaussian elimination
const M = A.map((row, i) => [...row, b[i]]);
for (let c = 0; c < k; c++) {
  let piv = c; for (let r = c + 1; r < k; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
  [M[c], M[piv]] = [M[piv], M[c]];
  for (let r = 0; r < k; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let j = c; j <= k; j++) M[r][j] -= f * M[c][j]; }
}
const beta = M.map((row, i) => row[k] / row[i]);
const pred = X.map((x) => x.reduce((s, v, i) => s + v * beta[i], 0));
const mean = y.reduce((s, v) => s + v, 0) / y.length;
const ssTot = y.reduce((s, v) => s + (v - mean) ** 2, 0), ssRes = y.reduce((s, v, i) => s + (v - pred[i]) ** 2, 0);
const r2 = 1 - ssRes / ssTot, rmse = Math.sqrt(ssRes / y.length);
const out = { model: "RAPTOR_total ~ box features (ridge λ=2, minutes-weighted)", n: X.length, r2: +r2.toFixed(3), rmse: +rmse.toFixed(2),
  coefficients: Object.fromEntries(FEATURE_NAMES.map((n, i) => [n, +beta[i].toFixed(4)])), generatedAt: new Date().toISOString().slice(0, 10) };
fs.writeFileSync("src/lib/ratings/nba-calibration.json", JSON.stringify(out, null, 2));
console.log(out);
