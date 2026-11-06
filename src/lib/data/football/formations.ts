import type { Formation, FbPos } from "@/types/football";

/** Pitch coordinates: x 0..100 (left→right), y 0..100 (own goal at bottom = 100). */
function f(id: string, rows: [FbPos, number, number][]): Formation {
  const count: Record<string, number> = {};
  return {
    id, name: id,
    slots: rows.map(([pos, x, y]) => {
      count[pos] = (count[pos] ?? 0) + 1;
      return { id: `${pos}${count[pos]}`, pos, x, y };
    }),
  };
}

export const FORMATIONS: Formation[] = [
  f("4-3-3", [["GK", 50, 92], ["LB", 14, 72], ["CB", 37, 76], ["CB", 63, 76], ["RB", 86, 72], ["CM", 28, 52], ["CDM", 50, 58], ["CM", 72, 52], ["LW", 16, 26], ["ST", 50, 18], ["RW", 84, 26]]),
  f("4-2-3-1", [["GK", 50, 92], ["LB", 14, 72], ["CB", 37, 76], ["CB", 63, 76], ["RB", 86, 72], ["CDM", 36, 58], ["CDM", 64, 58], ["LW", 16, 36], ["CAM", 50, 38], ["RW", 84, 36], ["ST", 50, 16]]),
  f("4-4-2", [["GK", 50, 92], ["LB", 14, 72], ["CB", 37, 76], ["CB", 63, 76], ["RB", 86, 72], ["LM", 14, 46], ["CM", 38, 52], ["CM", 62, 52], ["RM", 86, 46], ["ST", 38, 18], ["ST", 62, 18]]),
  f("4-1-2-1-2", [["GK", 50, 92], ["LB", 14, 72], ["CB", 37, 76], ["CB", 63, 76], ["RB", 86, 72], ["CDM", 50, 60], ["CM", 30, 48], ["CM", 70, 48], ["CAM", 50, 34], ["ST", 38, 16], ["ST", 62, 16]]),
  f("3-5-2", [["GK", 50, 92], ["CB", 28, 76], ["CB", 50, 78], ["CB", 72, 76], ["LWB", 10, 50], ["CM", 32, 50], ["CDM", 50, 58], ["CM", 68, 50], ["RWB", 90, 50], ["ST", 38, 18], ["ST", 62, 18]]),
  f("3-4-3", [["GK", 50, 92], ["CB", 28, 76], ["CB", 50, 78], ["CB", 72, 76], ["LM", 12, 50], ["CM", 38, 54], ["CM", 62, 54], ["RM", 88, 50], ["LW", 18, 24], ["ST", 50, 16], ["RW", 82, 24]]),
  f("5-3-2", [["GK", 50, 92], ["LWB", 8, 62], ["CB", 30, 76], ["CB", 50, 78], ["CB", 70, 76], ["RWB", 92, 62], ["CM", 30, 48], ["CDM", 50, 54], ["CM", 70, 48], ["ST", 38, 18], ["ST", 62, 18]]),
  f("4-2-2-2", [["GK", 50, 92], ["LB", 14, 72], ["CB", 37, 76], ["CB", 63, 76], ["RB", 86, 72], ["CDM", 36, 58], ["CDM", 64, 58], ["CAM", 24, 36], ["CAM", 76, 36], ["ST", 38, 16], ["ST", 62, 16]]),
];
export const FORMATION_BY_ID: Record<string, Formation> = Object.fromEntries(FORMATIONS.map((x) => [x.id, x]));

/** Draft order for a formation: GK, defence, midfield, attack. */
export function draftOrder(formationId: string): string[] {
  const fm = FORMATION_BY_ID[formationId];
  return [...fm.slots].sort((a, b) => b.y - a.y || a.x - b.x).map((s) => s.id);
}
