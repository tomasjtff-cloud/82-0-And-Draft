import { ALL_CARDS } from "@/features/nba-draft/engine";
import { simulateSeason } from "@/features/nba-simulation/engine";
const by = (n: string, y: number) => ALL_CARDS.find((c) => c.name === n && c.startYear === y);
const best = (f: (c: any) => number, pos: string) => [...ALL_CARDS].filter((c) => c.positions.includes(pos as any)).sort((a, b) => f(b) - f(a))[0];
const P = ["PG", "SG", "SF", "PF", "C"] as const;
const weak = (p: string) => [...ALL_CARDS].filter((c) => c.positions[0] === p).sort((a, b) => a.ratings.overall - b.ratings.overall)[5];
let mx = { ppg: 0, rpg: 0, apg: 0 };
for (const [stat, pos] of [["ppg", "C"], ["ppg", "SG"], ["rpg", "C"], ["apg", "PG"]] as const) {
  const star = best((c) => c[stat], pos);
  const lu: any = {}; for (const p of P) lu[p] = p === pos ? star : weak(p);
  for (let i = 0; i < 3; i++) {
    const r = simulateSeason(lu, "EASY", `s${i}`).result;
    const t = r.stats!.regular.find((x) => x.key === pos)!;
    const v = { ppg: t.pts / t.gp, rpg: t.reb / t.gp, apg: t.ast / t.gp };
    mx = { ppg: Math.max(mx.ppg, v.ppg), rpg: Math.max(mx.rpg, v.rpg), apg: Math.max(mx.apg, v.apg) };
    if (i === 0) console.log(stat, star.name, star.season, `${star[stat]}`, "→", v.ppg.toFixed(1), v.rpg.toFixed(1), v.apg.toFixed(1), "W", r.wins);
  }
}
console.log("max", mx);
