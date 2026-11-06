"use client";
import { useEffect, useMemo, useState } from "react";
import { diffName } from "@/lib/core/difficulty";
import Link from "next/link";
import { Sheet } from "@/components/common/Sheet";
import { TrophyIcon, type TrophyKind } from "@/components/common/TrophyIcon";
import { ACHIEVEMENTS, levelOf, LEVELS, profilePoints, TOTAL_POINTS } from "@/lib/progress/achievements";
import { loadProgress, setProfileName } from "@/lib/progress/store";
import { fbRecords, hallOfFame, trophyRoom, type Filters, type TrophyKey, type TrophyWin } from "@/lib/progress/records";
import type { Progress } from "@/lib/progress/types";

const ROOM: [TrophyKey, TrophyKind, string][] = [
  ["nba", "nba", "Anillo NBA"], ["PL", "pl", "Premier League"], ["UCL", "ucl", "Champions League"], ["FA", "fa", "FA Cup"], ["EFL", "efl", "Carabao Cup"],
  ["ballon", "ballon", "Balón de Oro LL"], ["boot", "boot", "Bota de Oro LL"], ["glove", "glove", "Guante de Oro LL"],
];
const DIFFS: [string, string][] = [["all", "Todas"], ["EASY", "Fácil"], ["NORMAL", "Normal"], ["HARD", "Difícil"]];

export default function LegacyPage() {
  const [p, setP] = useState<Progress | null>(null);
  const [name, setName] = useState("");
  const [open, setOpen] = useState<{ title: string; wins: TrophyWin[] } | null>(null);
  const [flt, setFlt] = useState<Filters>({ mode: "all", difficulty: "all" });
  useEffect(() => { const x = loadProgress(); setP(x); setName(x.profileName); }, []);
  const data = useMemo(() => (p ? { room: trophyRoom(p), rec: fbRecords(p, flt), hof: hallOfFame(p, flt), hofAll: hallOfFame(p) } : null), [p, flt]);
  if (!p || !data) return <div className="mx-auto max-w-5xl px-4 py-10 text-muted">Cargando…</div>;
  const pts = profilePoints(p), lvl = levelOf(pts), specials = ACHIEVEMENTS.filter((a) => a.tier === "platinum" && p.achievements[a.id]);
  const prevT = LEVELS[lvl.idx][0];
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8" data-testid="legacy-page">
      <header className="panel relative overflow-hidden p-5">
        <div className="absolute -right-8 -top-8 opacity-20" aria-hidden><TrophyIcon kind="crown" size={160} /></div>
        <div className="font-cond text-xs font-bold uppercase tracking-[.25em] text-muted">Mi legado</div>
        <div className="mt-1 flex flex-wrap items-end gap-3">
          <input value={name} maxLength={24} placeholder="Tu nombre (opcional)" aria-label="Nombre de perfil" onChange={(e) => setName(e.target.value)} onBlur={() => setProfileName(name)}
            className="min-w-0 max-w-full flex-1 bg-transparent font-display text-4xl uppercase outline-none placeholder:text-white/25 focus-visible:underline" data-testid="profile-name" />
          <span className="chip border-gold text-gold-2" data-testid="profile-level">{lvl.name}</span>
        </div>
        <div className="mt-2 h-2 max-w-md overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-nba to-gold" style={{ width: `${lvl.next ? Math.round(((pts - prevT) / (lvl.next - prevT)) * 100) : 100}%` }} /></div>
        <p className="mt-1 text-xs text-muted">{pts} puntos de logros{lvl.next ? ` · ${lvl.next - pts} para el siguiente nivel` : " · nivel máximo"}. El nombre de perfil es local y distinto del nombre de tu franquicia NBA.</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[["Partidas", data.hofAll.fbSeasons + data.hofAll.nbaSeasons], ["Temporadas NBA", data.hofAll.nbaSeasons], ["Temporadas fútbol", data.hofAll.fbSeasons], ["Anillos NBA", data.hofAll.rings], ["Champions", data.hofAll.UCL], ["Premier Leagues", data.hofAll.PL], ["Quadruples", data.hofAll.quadruples], ["Logros", `${Object.keys(p.achievements).length}/${ACHIEVEMENTS.length}`], ["Puntos", `${pts}/${TOTAL_POINTS}`], ["Progreso", `${Math.round((pts / TOTAL_POINTS) * 100)}%`]].map(([k, v]) => (
            <div key={k as string} className="rounded-xl bg-white/5 px-3 py-2"><dt className="text-[10px] uppercase text-muted">{k}</dt><dd className="font-display text-2xl tabular">{v}</dd></div>
          ))}
        </dl>
      </header>

      <section>
        <h2 className="font-display text-3xl">SALA DE TROFEOS</h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="trophy-room">
          {ROOM.map(([k, icon, label]) => {
            const wins = data.room[k];
            return (
              <li key={k}>
                <button onClick={() => wins.length && setOpen({ title: label, wins })} disabled={!wins.length} data-testid={`trophy-${k}`}
                  className={`flex w-full flex-col items-center rounded-2xl border p-4 transition ${wins.length ? "border-gold/40 bg-gradient-to-b from-gold/10 to-transparent hover:border-gold" : "border-line opacity-70"}`}>
                  <TrophyIcon kind={icon} size={64} locked={!wins.length} />
                  <span className="mt-2 text-center font-cond text-sm font-bold uppercase">{label}</span>
                  <span className="font-mono text-xs text-muted">{wins.length ? `×${wins.length}` : "Bloqueado"}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {specials.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{specials.map((a) => <span key={a.id} className="chip border-[#9fe7ff]/50 text-[#9fe7ff]">✦ {a.name}</span>)}</div>}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-3xl">RÉCORDS DE LEGENDS LAB</h2>
          <div className="flex flex-wrap gap-1">
            <select aria-label="Modalidad" className="rounded-lg border border-line bg-surface px-2 py-1 text-base" value={flt.mode} onChange={(e) => setFlt({ ...flt, mode: e.target.value as Filters["mode"] })}>
              <option value="all">Todas las modalidades</option><option value="roulette">Historical Roulette</option><option value="fut">FUT Draft</option>
            </select>
            <select aria-label="Dificultad" className="rounded-lg border border-line bg-surface px-2 py-1 text-base" value={flt.difficulty} onChange={(e) => setFlt({ ...flt, difficulty: e.target.value })}>
              {DIFFS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        {data.rec.length === 0 ? <p className="panel mt-3 p-4 text-sm text-muted">Todavía no hay temporadas de fútbol con estadísticas guardadas. <Link className="underline" href="/football">Juega una</Link>.</p> : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[640px] text-sm" data-testid="records-table">
              <thead><tr className="bg-white/5 text-left text-[11px] uppercase text-muted"><th className="p-2">Récord</th><th className="p-2">Jugador / equipo</th><th className="p-2">Marca</th><th className="p-2">Fecha</th><th className="p-2">Modalidad</th><th className="p-2">Dificultad</th></tr></thead>
              <tbody>{data.rec.map((r) => <tr key={r.key} className="border-t border-line"><td className="p-2 text-muted">{r.label}</td><td className="p-2 font-semibold">{r.who}</td><td className="p-2 font-mono">{r.value}</td><td className="p-2 text-xs">{new Date(r.date).toLocaleDateString("es-ES")}</td><td className="p-2 text-xs">{r.mode}</td><td className="p-2 text-xs">{diffName(r.difficulty)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        <p className="mt-1 text-[11px] text-dim">Récords calculados con temporadas guardadas en este navegador. Las partidas anteriores a la V4 solo aportan datos de equipo.</p>
      </section>

      <section>
        <h2 className="font-display text-3xl">SALÓN DE LA FAMA</h2>
        <dl className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6" data-testid="hall-of-fame">
          {[["Temporadas", data.hof.fbSeasons], ["Premier", data.hof.PL], ["Champions", data.hof.UCL], ["FA Cup", data.hof.FA], ["Carabao", data.hof.EFL], ["Quadruples", data.hof.quadruples]].map(([k, v]) => <div key={k as string} className="rounded-xl bg-white/5 px-3 py-2 text-center"><dt className="text-[10px] uppercase text-muted">{k}</dt><dd className="font-display text-2xl">{v}</dd></div>)}
        </dl>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="panel p-4"><h3 className="font-cond font-bold uppercase">Jugadores más exitosos</h3>{data.hof.topPlayers.length ? <ol className="mt-2 space-y-1 text-sm">{data.hof.topPlayers.map((x, i) => <li key={x.name + i} className="flex justify-between"><span>{i + 1}. {x.name}</span><span className="font-mono text-xs">{x.titles} títulos · {x.goals} G</span></li>)}</ol> : <p className="mt-2 text-sm text-muted">Gana títulos para llenar esta lista.</p>}</div>
          <div className="panel p-4"><h3 className="font-cond font-bold uppercase">Mejores equipos</h3>{data.hof.bestTeams.length ? <ol className="mt-2 space-y-1 text-sm">{data.hof.bestTeams.map((s, i) => <li key={s.id} className="flex justify-between gap-2"><span className="truncate">{i + 1}. {s.team.name} · {s.team.formationId}</span><span className="shrink-0 font-mono text-xs">{s.pl.pts} pts · {s.titles} tít.</span></li>)}</ol> : <p className="mt-2 text-sm text-muted">Sin temporadas todavía.</p>}</div>
        </div>
        {data.hof.bestNba.length > 0 && <div className="panel mt-3 p-4"><h3 className="font-cond font-bold uppercase">Mejores temporadas NBA</h3><ol className="mt-2 space-y-1 text-sm">{data.hof.bestNba.map((s, i) => <li key={s.id} className="flex justify-between"><span>{i + 1}. {s.teamName}</span><span className="font-mono text-xs">{s.wins}-{s.losses}{s.champion ? " · 🏆" : ""}</span></li>)}</ol></div>}
      </section>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ""} testId="trophy-sheet">
        <ul className="space-y-2">{open?.wins.map((w) => <li key={w.key} className="rounded-xl bg-white/5 p-3"><div className="font-cond font-bold uppercase">{w.team}</div><div className="text-sm">{w.detail}</div><div className="text-xs text-muted">{new Date(w.date).toLocaleString("es-ES")} · partida <span className="font-mono">{w.ref}</span></div></li>)}</ul>
        <p className="mt-3 text-xs text-muted">Puedes volver a abrir las temporadas desde el <Link className="underline" href="/history">historial</Link>.</p>
      </Sheet>
    </div>
  );
}
