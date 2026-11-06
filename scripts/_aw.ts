import { createFbDraft, isFbComplete, pickFb, pickCaptain, captainSlots } from "@/features/football-draft/engine";
import { userTeamInput } from "@/features/football-draft/squad";
import { createSeason, simulateRest } from "@/features/football-simulation/season";
import { seasonAwards, groupOf } from "@/features/football-simulation/awards";
const cnt: Record<string, number> = {}; let bo = 0, boot = 0, glove = 0; const N = 80;
for (let i = 0; i < N; i++) {
  let s = createFbDraft(`aw${i}`, "NORMAL", i % 2 ? "fut" : "roulette", ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1"][i % 4]);
  if (s.mode === "fut") { const c = s.options[0]; s = (pickCaptain(s, c, captainSlots(s, c)[0]) as any).state; }
  while (!isFbComplete(s)) { const r = pickFb(s, s.options[(i * 3) % s.options.length]); if (!r.ok) break; s = r.state; }
  const a = seasonAwards(simulateRest(createSeason(`aws${i}`, "NORMAL", userTeamInput(s.formationId, s.lineup, s.captainId, "NORMAL", "ARS", "Arsenal"))))!;
  const g = groupOf(a.playerOfSeason!.pos); cnt[g] = (cnt[g] ?? 0) + 1; if (a.ballonDor) bo++; if (a.goldenBoot) boot++; if (a.goldenGlove) glove++;
}
console.log("player of season by group", cnt, "ballon", bo / N, "boot", boot / N, "glove", glove / N);
