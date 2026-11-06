"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TrophyIcon, type TrophyKind } from "@/components/common/TrophyIcon";
import { FB_CARD_BY_ID } from "@/features/football-draft/engine";
import { HIST_CLUB_BY_ID } from "@/lib/data/football/clubs";
import type { AwardWinner, FbSeasonAwards } from "@/features/football-simulation/awards";

function AwardRow({ kind, title, w, testId }: { kind: TrophyKind; title: string; w: AwardWinner; testId: string }) {
  const c = FB_CARD_BY_ID[w.cardId];
  return (
    <li className="flex items-start gap-3 rounded-xl bg-white/5 p-3" data-testid={testId}>
      <TrophyIcon kind={kind} size={44} />
      <div className="min-w-0 flex-1">
        <div className="font-cond text-[11px] font-bold uppercase tracking-wider text-gold-2">{title}</div>
        <div className="truncate font-cond text-lg font-bold uppercase leading-tight">{w.name}</div>
        <div className="truncate text-xs text-muted">{w.pos}{c ? ` · ${HIST_CLUB_BY_ID[c.clubId]?.name ?? c.clubId} ${c.season} · OVR ${c.ovr}` : ""}</div>
        <div className="mt-0.5 font-mono text-xs">{w.stats}</div>
        <div className="text-[11px] text-muted">{w.reason}</div>
      </div>
    </li>
  );
}

/** PREMIOS DE LA TEMPORADA (internal recognitions of the user's XI, from simulated stats). */
export function SeasonAwardsView({ a, reduced }: { a: FbSeasonAwards; reduced?: boolean }) {
  const [intro, setIntro] = useState(!!a.ballonDor && !reduced);
  const rows: [TrophyKind, string, AwardWinner | undefined, string][] = [
    ["ballon", "Balón de Oro de Legends Lab — Mi equipo", a.ballonDor, "award-ballon"],
    ["star", "Jugador de la temporada", a.playerOfSeason, "award-pots"],
    ["boot", "Bota de Oro de Legends Lab — Mi equipo", a.goldenBoot, "award-boot"],
    ["glove", "Guante de Oro de Legends Lab — Mi equipo", a.goldenGlove, "award-glove"],
    ["medal", "Mejor jugador de Champions (mi equipo)", a.bestUcl, "award-ucl"],
    ["medal", "Mejor defensor", a.bestDefender, "award-def"],
    ["medal", "Mejor mediocampista", a.bestMidfielder, "award-mid"],
    ["medal", "Mejor delantero", a.bestForward, "award-fwd"],
  ];
  const leaders: [string, AwardWinner | undefined][] = [["Goles Premier", a.leaders.plGoals], ["Goles Champions", a.leaders.uclGoals], ["Goles totales", a.leaders.allGoals], ["Asistencias", a.leaders.assists]];
  return (
    <section className="space-y-3" data-testid="fb-season-awards">
      <h3 className="font-cond text-lg font-bold uppercase tracking-wide">Premios de la temporada</h3>
      <AnimatePresence>
        {intro && a.ballonDor && (
          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}
            className="relative overflow-hidden rounded-2xl border border-gold/60 bg-gradient-to-b from-gold/25 to-transparent p-5 text-center" data-testid="ballon-intro">
            <motion.div initial={{ rotate: -12, y: 10 }} animate={{ rotate: 0, y: 0 }} transition={{ type: "spring", stiffness: 120, damping: 12 }} className="mx-auto w-fit"><TrophyIcon kind="ballon" size={96} /></motion.div>
            <div className="mt-2 font-cond text-xs font-bold uppercase tracking-[.25em] text-gold-2">Balón de Oro de Legends Lab</div>
            <div className="font-display text-4xl leading-none">{a.ballonDor.name}</div>
            <div className="mt-1 font-mono text-sm">{a.ballonDor.stats}</div>
            <button className="btn btn-sm mt-3" onClick={() => setIntro(false)} data-testid="ballon-skip">Continuar</button>
          </motion.div>
        )}
      </AnimatePresence>
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.filter(([, , w]) => !!w).map(([k, t, w, id]) => <AwardRow key={id} kind={k} title={t} w={w!} testId={id} />)}
      </ul>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {leaders.filter(([, w]) => !!w).map(([k, w]) => <div key={k} className="rounded-lg bg-white/5 px-3 py-2"><div className="text-[10px] uppercase text-muted">{k}</div><div className="truncate font-cond font-bold uppercase">{w!.name}</div><div className="font-mono text-xs">{w!.stats.split(" ")[0]}</div></div>)}
      </div>
      {a.notes.length > 0 && <ul className="space-y-0.5 text-xs text-muted">{a.notes.map((n) => <li key={n}>· {n}</li>)}</ul>}
      <p className="text-[11px] text-dim">Reconocimientos ficticios de Legends Lab basados solo en las estadísticas simuladas de tu XI. No son premios oficiales ni comparan con jugadores de otros equipos.</p>
    </section>
  );
}
