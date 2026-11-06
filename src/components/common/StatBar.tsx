export function StatBar({ label, value, max = 99, color = "var(--color-nba)", estimated = false }: { label: string; value: number; max?: number; color?: string; estimated?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 font-cond font-semibold uppercase tracking-wide text-muted">{label}{estimated && <span title="Estimado" className="ml-0.5 text-nba-2">*</span>}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, (value / max) * 100))}%`, background: color }} />
      </div>
      <span className="w-7 text-right font-mono tabular">{value}</span>
    </div>
  );
}
