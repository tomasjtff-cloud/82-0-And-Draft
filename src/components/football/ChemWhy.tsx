"use client";
import { HIST_CLUB_BY_ID } from "@/lib/data/football/clubs";
import { LEAGUE_ES, NATION_ES } from "@/lib/data/football/nation-links";
import { chemTips, STYLE_FAMILY_DESC, type SlotChem, type StyleFamily } from "@/lib/ratings/football";
import { shortName } from "@/lib/core/names";
import type { FbPlayerSeason } from "@/types/football";

const KIND_LABEL = { club: "Club", nation: "Nacionalidad", league: "Liga", language: "Idioma", style: "Estilo", continent: "Continente" } as const;
const KIND_ICON = { club: "▣", nation: "⚑", league: "◆", language: "❝", style: "↯", continent: "◍" } as const;

function groupName(kind: keyof typeof KIND_LABEL, key: string): string {
  if (kind === "club") return HIST_CLUB_BY_ID[key]?.name ?? key;
  if (kind === "nation") return NATION_ES[key] ?? key;
  if (kind === "league") return LEAGUE_ES[key] ?? key;
  if (kind === "style") return `${key} (${STYLE_FAMILY_DESC[key as StyleFamily] ?? ""})`;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** "¿Por qué tengo esta química?" — every number comes from chemistryBreakdown (the engine's own calculation). */
export function ChemWhy({ s, card, lineup }: { s: SlotChem; card: FbPlayerSeason; lineup: Record<string, FbPlayerSeason | undefined> }) {
  const mates = (ids: string[]) => ids.map((id) => lineup[id]).filter(Boolean).map((c) => shortName(c!.name)).join(", ");
  const tips = chemTips(s);
  return (
    <div className="space-y-3" data-testid="chem-why">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-cond text-xl font-bold uppercase">{card.name}</div>
        <div className="font-display text-3xl tabular" data-testid="chem-why-total">{s.effective}/3</div>
      </div>
      {s.outOfPosition && <p className="rounded-lg bg-loss/15 p-2 text-sm text-loss">Está fuera de posición: su química individual es 0. Sigue contando para la química de sus compañeros.</p>}
      <ul className="divide-y divide-line rounded-xl bg-white/5">
        {s.groups.map((g) => (
          <li key={g.kind} className="flex items-start gap-2 px-3 py-2 text-sm" data-testid={`chem-why-${g.kind}`}>
            <span aria-hidden className="w-4 text-center text-muted">{KIND_ICON[g.kind]}</span>
            <span className="min-w-0 flex-1">
              <b>{KIND_LABEL[g.kind]}: {groupName(g.kind, g.key)}</b> · <span className="font-mono">{g.count}/{g.next ?? g.thresholds[2]}</span>
              <span className="block text-xs text-muted">{g.mates.length ? `Comparte con ${mates(g.mates)}` : "Nadie más del XI"} · umbrales {g.thresholds.join("/")}</span>
            </span>
            <span className={`font-mono font-bold ${g.points ? "text-win" : "text-muted"}`}>+{g.points}</span>
          </li>
        ))}
        {s.extras.map((e) => (
          <li key={e.kind} className="flex items-start gap-2 px-3 py-2 text-sm" data-testid={`chem-why-${e.kind}`}>
            <span aria-hidden className="w-4 text-center text-muted">{KIND_ICON[e.kind]}</span>
            <span className="min-w-0 flex-1">
              <b>{KIND_LABEL[e.kind]}: {groupName(e.kind, e.key)}</b> · <span className="font-mono">{e.count}/{e.min}</span> {e.met ? "✓ cumple" : "· no cumple"}
              <span className="block text-xs text-muted">{e.mates.length ? `Comparte con ${mates(e.mates)}` : "Nadie más del XI"} · solo Historical Roulette, extra máx. +1</span>
            </span>
          </li>
        ))}
        {s.extras.length > 0 && <li className="flex justify-between px-3 py-2 text-sm"><span>Bonificación extra (Roulette)</span><span className={`font-mono font-bold ${s.extraPoints ? "text-win" : "text-muted"}`}>+{s.extraPoints}</span></li>}
        {s.legend && <li className="flex justify-between px-3 py-2 text-sm"><span>Leyenda (OVR ≥ 90): mínimo 1</span><span className="font-mono font-bold text-win">→1</span></li>}
        {s.captain && <li className="flex justify-between px-3 py-2 text-sm"><span>Capitán</span><span className="font-mono font-bold text-win">+1</span></li>}
      </ul>
      <p className="text-sm">Puntos obtenidos: <b className="font-mono">{s.raw}</b> → química efectiva <b className="font-mono">{s.effective}/3</b>{s.raw > 3 ? " (tope individual de 3)" : ""}.</p>
      {tips.length > 0 && (
        <div className="rounded-xl border border-gold/40 bg-gold/5 p-3 text-sm" data-testid="chem-why-tips">
          <div className="mb-1 font-cond text-xs font-bold uppercase tracking-wider text-gold-2">Para subir su química</div>
          <ul className="space-y-0.5">{tips.map((t) => <li key={t}>• {t}</li>)}</ul>
        </div>
      )}
      <p className="text-[11px] text-muted">Los conteos incluyen al propio jugador. Compartir un rasgo no siempre suma: solo cuenta al alcanzar cada umbral.</p>
    </div>
  );
}
