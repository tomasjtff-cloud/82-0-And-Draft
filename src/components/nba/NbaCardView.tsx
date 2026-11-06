"use client";
import { motion } from "motion/react";
import { FRANCHISE_BY_ID } from "@/lib/data/nba/franchises";
import type { NbaCard, NbaPos } from "@/types/nba";
import { StatBar } from "@/components/common/StatBar";
import { VerifyBadge } from "@/components/common/VerifyBadge";

const fmtPct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}`);
const fmt = (v: number | null) => (v == null ? "—" : v.toFixed(1));

/** Tier scale (v2): 95-99 leyenda · 90-94 superestrella · 85-89 all-star · 77-84 titular · 68-76 rotación · 55-67 suplente. */
export function tierOf(ovr: number) {
  if (ovr >= 95) return { name: "LEYENDA", ring: "from-[#fff3c4] via-nba to-[#7a2a00]", text: "text-nba-2" };
  if (ovr >= 90) return { name: "SUPERESTRELLA", ring: "from-[#ffe08a] via-[#ff8a3d] to-[#5b2a00]", text: "text-nba-2" };
  if (ovr >= 85) return { name: "ALL-STAR", ring: "from-[#f7e08f] via-[#c9a23c] to-[#5b4510]", text: "text-gold-2" };
  if (ovr >= 77) return { name: "TITULAR", ring: "from-[#eef1f5] via-[#9aa3ae] to-[#4b525c]", text: "text-text" };
  if (ovr >= 68) return { name: "ROTACIÓN", ring: "from-[#e9b48a] via-[#a8693c] to-[#4a2810]", text: "text-[#e9b48a]" };
  return { name: "SUPLENTE", ring: "from-[#8d94a0] via-[#5c6370] to-[#2b2f36]", text: "text-muted" };
}

interface Props {
  card: NbaCard;
  placeable?: NbaPos[];
  disabledReason?: string;
  onPick?: (pos: NbaPos) => void;
  compact?: boolean;
  index?: number;
}

export function NbaCardView({ card, placeable = [], disabledReason, onPick, compact, index = 0 }: Props) {
  const fr = FRANCHISE_BY_ID[card.franchiseId];
  const tier = tierOf(card.ratings.overall);
  const est = new Set(card.ratings.estimated);
  const disabled = !!onPick && placeable.length === 0;
  return (
    <motion.article
      initial={{ opacity: 0, y: 18, rotateX: -12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      data-testid="nba-card" data-card-id={card.id}
      className={`relative rounded-2xl bg-gradient-to-br p-[1.5px] ${tier.ring} ${disabled ? "opacity-45 grayscale-[.6]" : ""}`}>
      <div className="relative h-full overflow-hidden rounded-[15px] bg-surface p-3.5">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${fr.colors[0]}, ${fr.colors[1]})` }} />
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className={`font-display text-4xl leading-none ${tier.text}`}>{card.ratings.overall}</div>
            <div className="mt-1 font-cond text-[11px] font-bold tracking-widest text-muted">{tier.name}</div>
          </div>
          <div className="text-right">
            <div className="flex justify-end gap-1">
              {card.positions.map((p, i) => (
                <span key={p} className={`rounded px-1.5 py-0.5 font-cond text-xs font-bold ${i === 0 ? "bg-white/15" : "bg-white/5 text-muted"}`}>{p}</span>
              ))}
            </div>
            <div className="mt-1 font-mono text-xs text-muted">{card.season}</div>
          </div>
        </div>
        <h3 className="mt-2 font-cond text-xl font-bold uppercase leading-tight tracking-wide">{card.name}</h3>
        <p className="truncate text-xs text-muted">{card.teamName}</p>

        <div className="mt-3 grid grid-cols-5 gap-1 text-center">
          {[["PTS", card.ppg], ["REB", card.rpg], ["AST", card.apg], ["STL", card.spg], ["BLK", card.bpg]].map(([k, v]) => (
            <div key={k as string} className="rounded-md bg-white/5 py-1">
              <div className="font-mono text-sm tabular">{fmt(v as number | null)}</div>
              <div className="font-cond text-[10px] font-bold tracking-wider text-muted">{k}</div>
            </div>
          ))}
        </div>
        {!compact && (
          <>
            <div className="mt-1 grid grid-cols-3 gap-1 text-center">
              {[["FG%", card.fgPct], ["3P%", card.tpPct], ["FT%", card.ftPct]].map(([k, v]) => (
                <div key={k as string} className="rounded-md bg-white/5 py-1">
                  <div className="font-mono text-xs tabular">{fmtPct(v as number | null)}</div>
                  <div className="font-cond text-[10px] font-bold tracking-wider text-muted">{k}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              <StatBar label="Ataque" value={card.ratings.offense} />
              <StatBar label="Defensa" value={card.ratings.defense} estimated={est.has("defense")} />
              <StatBar label="Creación" value={card.ratings.playmaking} />
              <StatBar label="Rebote" value={card.ratings.rebounding} />
              <StatBar label="Aro" value={card.ratings.rimProtection} estimated={est.has("rimProtection")} />
              <StatBar label="Tiro" value={card.ratings.shooting} estimated={est.has("shooting")} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5"><VerifyBadge check={card.check} /></div>
            {card.check.raptor && (
              <p className="mt-1 font-mono text-[10px] text-muted" data-testid="raptor-line">
                RAPTOR {card.check.raptor.raptorTotal > 0 ? "+" : ""}{card.check.raptor.raptorTotal} (O {card.check.raptor.raptorOffense} / D {card.check.raptor.raptorDefense}) · WAR {card.check.raptor.war} · {card.check.raptor.mp} min
              </p>
            )}
            {card.check.spell && !card.check.raptor && (
              <p className="mt-1 text-[10px] text-muted">Etapa en el equipo (Wikidata): {card.check.spell.start ?? "?"} → {card.check.spell.end ?? "…"}</p>
            )}
            <p className="mt-1 text-[10px] leading-snug text-dim" title={card.source}>
              Impacto est. {card.ratings.impact > 0 ? "+" : ""}{card.ratings.impact}/100 · Por partido: curación manual · GP {card.gp ?? "—"} · Ajuste época ×{card.ratings.eraAdjustment}
              {est.size > 0 && " · * atributo estimado (dato no registrado)"}
              {card.check.raptor && " · Métricas avanzadas: FiveThirtyEight (CC BY 4.0)"}
            </p>
          </>
        )}
        {onPick && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {placeable.length > 0 ? placeable.map((p) => (
              <button key={p} className="btn btn-nba btn-sm flex-1" onClick={() => onPick(p)} data-testid={`pick-${card.id}-${p}`}>
                Elegir · {p}
              </button>
            )) : <span className="text-xs text-muted">{disabledReason ?? "Sin posición libre"}</span>}
          </div>
        )}
      </div>
    </motion.article>
  );
}
