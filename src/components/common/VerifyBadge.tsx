import type { VerificationInfo } from "@/lib/data/verification";

const STYLE: Record<VerificationInfo["membership"], { label: string; cls: string; title: string }> = {
  verified: { label: "✓ Verificado", cls: "bg-win/20 text-win border-win/40", title: "Pertenencia jugador–equipo–temporada confirmada por una fuente externa" },
  probable: { label: "≈ Probable", cls: "bg-gold/15 text-gold-2 border-gold/40", title: "La fuente confirma la etapa en el club con fechas de precisión anual que incluyen el límite de la temporada" },
  unverified: { label: "Sin verificar", cls: "bg-white/5 text-muted border-line-strong", title: "Curación manual; la fuente externa no tiene el dato" },
  contradicted: { label: "✗ Contradicho", cls: "bg-loss/20 text-loss border-loss/40", title: "La fuente externa contradice la fila" },
};

export function VerifyBadge({ check, onDark = true }: { check?: VerificationInfo; onDark?: boolean }) {
  if (!check) return null;
  const s = STYLE[check.membership];
  return (
    <span data-testid="verify-badge" data-status={check.membership} title={check.note ?? s.title}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-cond text-[10px] font-bold uppercase tracking-wider ${onDark ? s.cls : "border-black/25 bg-black/10"}`}>
      {s.label}{check.sources.length ? ` · ${check.sources.join(", ")}` : ""}
    </span>
  );
}
