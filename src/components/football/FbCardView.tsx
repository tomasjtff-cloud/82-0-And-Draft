"use client";
import { motion } from "motion/react";
import { shortName } from "@/lib/core/names";
import { HIST_CLUB_BY_ID } from "@/lib/data/football/clubs";
import { rarityOf, STYLE_LABEL } from "@/lib/ratings/football";
import type { FbPlayerSeason } from "@/types/football";
import { VerifyBadge } from "@/components/common/VerifyBadge";

/** Spanish names of the estimated attributes (all PAC…PHY / GK values are Legends Lab estimates). */
export const OUT_LABELS: [string, string][] = [["PAC", "Ritmo"], ["SHO", "Tiro"], ["PAS", "Pase"], ["DRI", "Regate"], ["DEF", "Defensa"], ["PHY", "Físico"]];
export const GK_LABELS: [string, string][] = [["DIV", "Estirada"], ["HAN", "Manejo"], ["KIC", "Saque"], ["REF", "Reflejos"], ["SPD", "Velocidad"], ["POS", "Colocación"]];
const LABEL_ES: Record<string, string> = Object.fromEntries([...OUT_LABELS, ...GK_LABELS]);
export const FRAME: Record<string, string> = { icon: "frame-icon", rare: "frame-gold", gold: "frame-gold", silver: "frame-silver", bronze: "frame-bronze" };

export function FbCardView({ card, onPick, pickLabel = "Elegir", index = 0, highlight, testId, disabled }: {
  card: FbPlayerSeason; onPick?: () => void; pickLabel?: string; index?: number; highlight?: boolean; testId?: string; disabled?: boolean;
}) {
  const r = rarityOf(card.ovr);
  const club = HIST_CLUB_BY_ID[card.clubId];
  const stats: [string, number][] = card.gk
    ? GK_LABELS.map(([k]) => [k, card.gk![k.toLowerCase() as keyof typeof card.gk]] as [string, number])
    : OUT_LABELS.map(([k]) => [k, card.attrs![k.toLowerCase() as keyof typeof card.attrs]] as [string, number]);
  const dark = r.key === "silver" || r.key === "gold" || r.key === "rare" || r.key === "icon";
  return (
    <motion.article initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: index * 0.06, duration: 0.3 }}
      data-testid="fb-card" data-card-id={card.id}
      className={`relative rounded-2xl p-[2px] ${FRAME[r.key]} ${highlight ? "ring-2 ring-white" : ""} ${disabled ? "opacity-50" : ""}`}>
      <div className={`relative overflow-hidden rounded-[14px] p-3.5 ${dark ? "bg-gradient-to-b from-black/10 to-black/35" : "bg-black/30"}`} style={{ color: "#16120a" }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="font-display text-4xl leading-none">{card.ovr}</div>
            <div className="font-cond text-sm font-extrabold">{card.positions.join(" · ")}</div>
          </div>
          <div className="text-right">
            <div className="font-cond text-[10px] font-extrabold uppercase tracking-widest opacity-80">{r.label}</div>
            <div className="mt-0.5 font-mono text-xs font-bold">{card.season}</div>
            <div className="mt-1 inline-flex items-center gap-1 rounded bg-black/15 px-1.5 py-0.5 font-cond text-[11px] font-bold">{card.nation}</div>
          </div>
        </div>
        <h3 className="mt-2 font-cond text-xl font-extrabold uppercase leading-tight">{card.name}</h3>
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: club.colors[0], boxShadow: `inset 0 0 0 2px ${club.colors[1]}` }} />
          <span className="truncate">{club.name}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-1">
          {stats.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between border-b border-black/15 font-mono text-sm">
              <span className="font-cond text-[11px] font-extrabold" title={LABEL_ES[k]}>{k}<sup className="opacity-60">*</sup></span><span className="font-bold tabular">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
          <span>{STYLE_LABEL[card.style]}</span>
          {card.leagueGoals != null && <span>{card.leagueGoals} goles liga</span>}
        </div>
        <div className="mt-2"><VerifyBadge check={card.check} onDark={false} /></div>
        {card.check?.spell && (card.check.spell.apps != null || card.check.spell.start) && (
          <p className="mt-1 text-[10.5px] font-semibold" data-testid="spell-line">
            Etapa {card.check.spell.start ?? "?"}–{card.check.spell.end ?? "…"}{card.check.spell.apps != null ? ` · ${card.check.spell.apps} PJ` : ""}{card.check.spell.goals != null ? ` · ${card.check.spell.goals} goles` : ""} (Wikidata)
          </p>
        )}
        <p className="mt-1 text-[9.5px] leading-snug opacity-75">* Atributo estimado por Legends Lab (no EA). Datos verificados: solo los marcados con fuente.</p>
        {onPick && (
          <button className="mt-3 w-full rounded-lg bg-black/85 py-2 font-cond text-sm font-bold uppercase tracking-wider text-gold-2 transition hover:bg-black disabled:opacity-40"
            onClick={onPick} disabled={disabled} data-testid={testId ?? `fb-pick-${card.id}`}>{pickLabel}</button>
        )}
      </div>
    </motion.article>
  );
}

export function FbMiniCard({ card, pos, chem, fit, selected, captain }: { card: FbPlayerSeason; pos: string; chem: number; fit: number; selected?: boolean; captain?: boolean }) {
  const r = rarityOf(card.ovr);
  return (
    <div className={`w-[74px] rounded-lg p-[1.5px] sm:w-[92px] ${FRAME[r.key]} ${selected ? "ring-2 ring-white" : ""} ${fit < 0.9 ? "outline outline-2 outline-loss" : ""}`}>
      <div className="rounded-[7px] bg-black/25 px-1.5 py-1 text-[#16120a]">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg leading-none">{card.ovr}</span>
          <span className="font-cond text-[11px] font-extrabold">{pos}</span>
        </div>
        {(() => { const sn = shortName(card.name); return (
          <div className={`line-clamp-2 break-words font-cond font-extrabold uppercase leading-[1.05] ${sn.length > 11 ? "text-[9.5px]" : "text-[11px]"}`} title={card.name}>{captain ? "© " : ""}{sn}</div>
        ); })()}
        <div className="mt-0.5 flex gap-0.5" aria-label={`Química ${chem}`}>
          {[0, 1, 2].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < chem ? "bg-[#0b6b3a]" : "bg-black/20"}`} />)}
        </div>
      </div>
    </div>
  );
}

/** Compact candidate row for the draft drawer (tap = details, ⇄ = compare). */
export function FbCandidateRow({ card, onOpen, onCompare, comparing, ownChem }: { card: FbPlayerSeason; onOpen: () => void; onCompare?: () => void; comparing?: boolean; ownChem?: number }) {
  const r = rarityOf(card.ovr);
  const labels = card.gk ? GK_LABELS : OUT_LABELS;
  const vals = labels.map(([k]) => (card.gk ? card.gk[k.toLowerCase() as keyof typeof card.gk] : card.attrs![k.toLowerCase() as keyof typeof card.attrs]) as number);
  return (
    <div className={`flex items-center gap-2 py-2 ${comparing ? "rounded-lg bg-gold/10" : ""}`} data-testid="fb-candidate">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" data-testid="fb-candidate-open" data-card-id={card.id}>
        <span className={`grid h-12 w-11 shrink-0 place-items-center rounded-lg p-[1.5px] ${FRAME[r.key]}`}><span className="font-display text-xl leading-none text-[#16120a]">{card.ovr}</span></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-cond text-base font-bold uppercase leading-tight">{card.name}</span>
          <span className="block truncate text-[11px] text-muted">{card.positions.join("/")} · {card.season} · {card.nation}{card.check?.membership === "verified" ? " · ✓" : ""}{ownChem != null ? ` · quím. ${ownChem}` : ""}</span>
          <span className="mt-0.5 grid grid-cols-6 gap-1 font-mono text-[10px] tabular text-muted">{labels.map(([k], i) => <span key={k}><b className="text-text">{vals[i]}</b> {k}</span>)}</span>
        </span>
      </button>
      {onCompare && <button onClick={onCompare} className={`btn btn-sm shrink-0 px-2 ${comparing ? "border-gold text-gold-2" : ""}`} aria-label="Comparar" data-testid="fb-compare-toggle">⇄</button>}
    </div>
  );
}
