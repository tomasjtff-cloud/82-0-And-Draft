"use client";
import { TrophyIcon, type TrophyKind } from "@/components/common/TrophyIcon";
import { nbaInternalAwards } from "@/lib/progress/summarize";
import type { NbaSeasonResult } from "@/types/nba";

/** Internal recognitions of the user's five (simulated stats only) — not league-wide NBA awards. */
export function NbaAwards({ result }: { result: NbaSeasonResult }) {
  const a = nbaInternalAwards(result);
  const rows: [TrophyKind, string, typeof a.mvp][] = [["star", "MVP del quinteto", a.mvp], ["nba", "MVP de las Finals (mi equipo)", a.finalsMvp], ["medal", "Máximo anotador", a.scorer], ["medal", "Líder en rebotes", a.rebounder], ["medal", "Líder en asistencias", a.passer], ["medal", "Mejor defensor (robos + tapones)", a.defender]];
  const shown = rows.filter(([, , w]) => !!w);
  if (!shown.length) return null;
  return (
    <section className="space-y-2" data-testid="nba-awards">
      <h3 className="font-cond text-lg font-bold uppercase tracking-wide">Reconocimientos del equipo</h3>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map(([k, t, w]) => (
          <li key={t} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <TrophyIcon kind={k} size={36} />
            <div className="min-w-0"><div className="font-cond text-[11px] font-bold uppercase tracking-wider text-nba-2">{t}</div><div className="truncate font-cond text-base font-bold uppercase">{w!.name}</div><div className="font-mono text-xs">{w!.stat}</div></div>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-dim">Reconocimientos internos de Legends Lab calculados con las estadísticas simuladas de tu quinteto (temporada regular; Finals si las ganaste). No son premios oficiales de la NBA.</p>
    </section>
  );
}
