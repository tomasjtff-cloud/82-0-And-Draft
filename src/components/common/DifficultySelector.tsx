"use client";
import { DIFFICULTIES, DIFFICULTY_EXPLAIN, DIFFICULTY_LABEL, type Difficulty } from "@/lib/core/difficulty";
import { diffName } from "@/lib/core/difficulty";

export function DifficultySelector({ value, onChange, accent = "nba" }: { value: Difficulty; onChange: (d: Difficulty) => void; accent?: "nba" | "gold" }) {
  const activeCls = accent === "nba" ? "border-nba bg-nba/15 text-text" : "border-gold bg-gold/15 text-text";
  return (
    <div>
      <div role="radiogroup" aria-label="Dificultad" className="grid grid-cols-3 gap-2">
        {DIFFICULTIES.map((d) => (
          <button key={d} role="radio" aria-checked={value === d} onClick={() => onChange(d)} data-testid={`difficulty-${d}`}
            className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${value === d ? activeCls : "border-line text-muted hover:border-line-strong"}`}>
            <div className="font-cond text-sm font-bold uppercase tracking-wider">{diffName(d)}</div>
            <div className="text-xs opacity-80">{DIFFICULTY_LABEL[d]}</div>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{DIFFICULTY_EXPLAIN[value]}</p>
    </div>
  );
}
