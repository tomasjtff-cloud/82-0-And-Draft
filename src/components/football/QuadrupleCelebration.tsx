"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { TrophyIcon } from "@/components/common/TrophyIcon";
import { plTable, type SeasonState } from "@/features/football-simulation/season";
import { seasonAwards } from "@/features/football-simulation/awards";
import { TACTICS } from "@/features/football-simulation/tactics";
import { T } from "@/lib/i18n";

/** Special quadruple screen + share (Web Share API when available, clipboard otherwise). */
export function QuadrupleCelebration({ s, chem, onOpenXi }: { s: SeasonState; chem?: number; onOpenXi?: () => void }) {
  const [msg, setMsg] = useState("");
  const row = plTable(s).find((r) => r.team === s.userId)!;
  const aw = seasonAwards(s);
  const name = s.teams[s.userId].name;
  const tactic = TACTICS[s.tactic?.id ?? "balanced"].name;
  const text = [`🏆 ¡QUADRUPLE en Legends Lab! ${name} ganó Premier League, Champions League, FA Cup y Carabao Cup.`,
    `Premier: ${row.pts} pts (${row.w}V ${row.d}E ${row.l}D, ${row.gf}-${row.ga}).`,
    aw?.leaders.allGoals ? `Máximo goleador: ${aw.leaders.allGoals.name} (${aw.leaders.allGoals.stats.split(" ")[0]}).` : "",
    aw?.leaders.assists ? `Máximo asistidor: ${aw.leaders.assists.name}.` : "", aw?.playerOfSeason ? `MVP: ${aw.playerOfSeason.name}.` : "",
    `Táctica: ${tactic}${chem != null ? ` · Química ${chem}/33` : ""} · semilla ${s.seed}`].filter(Boolean).join("\n");
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: "Legends Lab · Quadruple", text }); setMsg("Compartido."); return; }
      await navigator.clipboard.writeText(text); setMsg("Resumen copiado al portapapeles.");
    } catch { setMsg("No se pudo compartir desde este navegador."); }
  };
  return (
    <motion.section initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel border-gold p-6 text-center" data-testid="quadruple">
      <div className="font-display text-5xl text-gold md:text-8xl">{T.trophy.quadruple}</div>
      <div className="mt-3 flex justify-center gap-2">{(["pl", "ucl", "fa", "efl"] as const).map((k, i) => <motion.div key={k} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 * i }}><TrophyIcon kind={k} size={56} /></motion.div>)}</div>
      <p className="mt-2 text-muted">Premier League, Champions League, FA Cup y Carabao Cup. Temporada inmortal.</p>
      <dl className="mx-auto mt-3 grid max-w-xl grid-cols-2 gap-2 text-left text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-white/5 p-2"><dt className="text-[10px] uppercase text-muted">Premier</dt><dd className="font-mono">{row.pts} pts · {row.gf}-{row.ga}</dd></div>
        {aw?.leaders.allGoals && <div className="rounded-lg bg-white/5 p-2"><dt className="text-[10px] uppercase text-muted">Máximo goleador</dt><dd className="truncate">{aw.leaders.allGoals.name}</dd></div>}
        {aw?.leaders.assists && <div className="rounded-lg bg-white/5 p-2"><dt className="text-[10px] uppercase text-muted">Máximo asistidor</dt><dd className="truncate">{aw.leaders.assists.name}</dd></div>}
        {aw?.playerOfSeason && <div className="rounded-lg bg-white/5 p-2"><dt className="text-[10px] uppercase text-muted">MVP</dt><dd className="truncate">{aw.playerOfSeason.name}</dd></div>}
        <div className="rounded-lg bg-white/5 p-2"><dt className="text-[10px] uppercase text-muted">Táctica</dt><dd>{tactic}</dd></div>
        {chem != null && <div className="rounded-lg bg-white/5 p-2"><dt className="text-[10px] uppercase text-muted">Química final</dt><dd>{chem}/33</dd></div>}
      </dl>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {onOpenXi && <button className="btn btn-sm" onClick={onOpenXi}>XI campeón</button>}
        <button className="btn btn-gold btn-sm" onClick={share} data-testid="share-quadruple">Compartir resumen</button>
      </div>
      {msg && <p className="mt-2 text-xs text-muted" role="status">{msg}</p>}
    </motion.section>
  );
}
