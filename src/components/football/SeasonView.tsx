"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { CompId, Match, Tie } from "@/types/football";
import { plTable, summarize, uclTable, nextUserFixture, isSeasonDone, type SeasonState, type TrophyResult } from "@/features/football-simulation/season";
import { scoreline } from "@/features/football-simulation/match";
import { COMP_NAME } from "@/features/football-simulation/calendar";
import { Celebration } from "@/components/common/Celebration";
import { aggregatePlayerStats, teamAwards, userMatches as userMatchesOf } from "@/features/football-simulation/player-stats";
import { FbMatchList, FbPlayerStatsView, SeasonHighlights, noDetail } from "./SeasonExtras";
import { ChemLegend, Pitch } from "./Pitch";
import { FORMATION_BY_ID } from "@/lib/data/football/formations";
import { leagueOf } from "@/lib/data/football/clubs";
import { DIFFICULTY_PARAMS } from "@/lib/core/difficulty";
import { chemistryEffect, chemistryLinks, computeChemistry, teamRatings } from "@/lib/ratings/football";
import { lineupOf } from "@/features/football-draft/squad";
import type { XiSource } from "./XiModal";

type Tab = "summary" | "xi" | "players" | "mine" | "pl" | "ucl" | "fa" | "efl" | "mc";
const STATUS: Record<TrophyResult["status"], { label: string; cls: string }> = {
  won: { label: "WON", cls: "bg-gold text-black" },
  "runner-up": { label: "RUNNER-UP", cls: "bg-white/80 text-black" },
  eliminated: { label: "ELIMINATED", cls: "bg-loss/80 text-white" },
  "not-qualified": { label: "NOT QUALIFIED", cls: "bg-white/10 text-muted" },
  "in-progress": { label: "EN JUEGO", cls: "bg-white/10 text-text" },
};
const COMP_KEY: Record<CompId, string> = { PL: "pl", UCL: "ucl", FA: "fa", EFL: "efl" };

export function SeasonView({ s, live, onNextUser, onNextEvent, onSimRest, onNew, busy, xi, headerExtra, mcSlot }: {
  s: SeasonState; live: boolean; onNextUser: () => void; onNextEvent: () => void; onSimRest: () => void; onNew: () => void; busy: boolean;
  xi?: XiSource | null; headerExtra?: React.ReactNode; mcSlot?: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("summary");
  const done = isSeasonDone(s);
  const sum = useMemo(() => summarize(s), [s]);
  const name = (id: string) => s.teams[id]?.name ?? id;
  const next = useMemo(() => nextUserFixture(s), [s]);
  const userMatches = s.matches.filter((m) => m.home === s.userId || m.away === s.userId).sort((a, b) => a.date.localeCompare(b.date));
  const form = userMatches.slice(-5).map((m) => result(m, s.userId));
  const progress = Math.round((s.cursor / s.events.length) * 100);

  return (
    <div className="space-y-6" data-testid="fb-season">
      <Celebration active={sum.quadruple} colors={["#d9b45a", "#f3dc94", "#ffffff", "#11502f"]} durationMs={6000} />
      {sum.quadruple && (
        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel border-gold p-8 text-center">
          <div className="font-display text-6xl text-gold md:text-8xl">THE QUADRUPLE</div>
          <p className="mt-2 text-muted">Premier League, Champions League, FA Cup y Carabao Cup. Temporada inmortal.</p>
        </motion.div>
      )}

      <section className="panel p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-cond text-sm font-bold uppercase tracking-[.2em] text-muted">Temporada 2026/27 · {s.difficulty} · semilla <span className="font-mono normal-case">{s.seed}</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} /></div>
            <div className="mt-1 text-xs text-muted">{done ? "Temporada finalizada" : `Próximo evento: ${s.events[s.cursor].label} · ${COMP_NAME[s.events[s.cursor].comp]} · ${s.events[s.cursor].date}`}</div>
          </div>
          {!done && (
            <div className="flex flex-wrap gap-2">
              {live && <button className="btn btn-gold btn-sm" disabled={busy} onClick={onNextUser} data-testid="fb-next-day">Siguiente partido ▸</button>}
              {live && <button className="btn btn-sm" disabled={busy} onClick={onNextEvent}>Siguiente evento</button>}
              <button className="btn btn-sm" disabled={busy} onClick={onSimRest} data-testid="fb-sim-rest">Simular resto</button>
            </div>
          )}
          {headerExtra}
          <button className="btn btn-ghost btn-sm" onClick={onNew} data-testid="fb-new">Nuevo draft</button>
        </div>
        {!done && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/5 p-3 text-sm">
              <div className="text-[11px] uppercase tracking-wider text-muted">Próximo rival</div>
              {next ? <div className="font-semibold">{next.opponent ? `${next.home ? "vs" : "@"} ${name(next.opponent)}` : "Pendiente de sorteo"}<div className="text-xs text-muted">{COMP_NAME[next.comp]} · {next.label} · {next.date}</div></div> : <div className="text-muted">—</div>}
            </div>
            <div className="rounded-xl bg-white/5 p-3 text-sm">
              <div className="text-[11px] uppercase tracking-wider text-muted">Forma reciente</div>
              <div className="mt-1 flex gap-1">{form.length ? form.map((f, i) => <FormDot key={i} r={f} />) : <span className="text-muted">—</span>}</div>
            </div>
            <div className="rounded-xl bg-white/5 p-3 text-sm">
              <div className="text-[11px] uppercase tracking-wider text-muted">Premier League</div>
              <div className="font-semibold">{sum.plPosition}º · {plTable(s).find((r) => r.team === s.userId)?.pts ?? 0} pts</div>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="fb-trophies">
        {sum.trophies.map((t, i) => (
          <motion.button key={t.comp} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            onClick={() => setTab(COMP_KEY[t.comp] as Tab)} data-testid={`fb-trophy-${COMP_KEY[t.comp]}`}
            className={`panel relative overflow-hidden p-5 text-left ${t.status === "won" ? "border-gold" : ""}`}>
            <TrophyIcon won={t.status === "won"} />
            <div className="font-cond text-sm font-bold uppercase tracking-[.18em] text-muted">{COMP_NAME[t.comp]}</div>
            <span className={`mt-2 inline-block rounded-md px-2 py-0.5 font-cond text-xs font-extrabold tracking-wider ${STATUS[t.status].cls}`}>{STATUS[t.status].label}</span>
            <div className="mt-2 text-sm">{t.detail}</div>
            {t.champion && <div className="mt-1 text-xs text-muted">Campeón: {name(t.champion)}</div>}
          </motion.button>
        ))}
      </section>

      <div className="flex gap-1 overflow-x-auto scrollbar-thin" role="tablist">
        {([["summary", "Resumen"], ["xi", "Mi XI"], ["players", "Mis jugadores"], ["mine", "Partidos"], ["pl", "Premier League"], ["ucl", "Champions"], ["fa", "FA Cup"], ["efl", "Carabao Cup"], ["mc", "Monte Carlo"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`fb-tab-${k}`}
            className={`whitespace-nowrap rounded-lg px-3 py-2 font-cond text-sm font-bold uppercase tracking-wider ${tab === k ? "bg-surface-3 text-text" : "text-muted hover:text-text"}`}>{l}</button>
        ))}
      </div>

      {tab === "summary" && <SummaryTab s={s} xi={xi ?? null} narrative={sum.narrative} done={done} />}
      {tab === "xi" && <XiTab xi={xi ?? null} />}
      {tab === "players" && <FbPlayerStatsView s={s} />}
      {tab === "mc" && (mcSlot ?? <p className="text-sm text-muted">Monte Carlo no disponible.</p>)}
      {tab === "pl" && <PlTab s={s} />}
      {tab === "ucl" && <UclTab s={s} />}
      {tab === "fa" && <CupTab s={s} comp="FA" stages={["R3", "R4", "R5", "QF", "SF", "F"]} />}
      {tab === "efl" && <CupTab s={s} comp="EFL" stages={["R2", "R3", "R4", "QF", "SF", "F"]} />}
      {tab === "mine" && <FbMatchList s={s} />}
    </div>
  );
}

function result(m: Match, team: string): "W" | "D" | "L" {
  const h = m.hg + (m.et?.hg ?? 0), a = m.ag + (m.et?.ag ?? 0);
  const mine = m.home === team ? h - a : a - h;
  if (mine > 0) return "W";
  if (mine < 0) return "L";
  if (m.pens) return (m.home === team) === (m.pens.h > m.pens.a) ? "W" : "L";
  return "D";
}
function FormDot({ r }: { r: "W" | "D" | "L" }) {
  return <span className={`inline-grid h-6 w-6 place-items-center rounded font-cond text-xs font-extrabold ${r === "W" ? "bg-win/80 text-black" : r === "L" ? "bg-loss/80" : "bg-draw/60 text-black"}`}>{r === "W" ? "V" : r === "L" ? "D" : "E"}</span>;
}
function TrophyIcon({ won }: { won: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={`absolute -right-2 -top-2 h-20 w-20 ${won ? "opacity-90" : "opacity-15"}`} aria-hidden>
      <path d="M20 8h24v10a12 12 0 0 1-24 0zM20 12H10a8 8 0 0 0 10 10M44 12h10a8 8 0 0 1-10 10M28 30h8v10h-8zM22 44h20v6H22z" fill={won ? "#d9b45a" : "#888"} />
    </svg>
  );
}

function PlTab({ s }: { s: SeasonState }) {
  const table = plTable(s);
  const played = s.matches.filter((m) => m.comp === "PL");
  const rounds = [...new Set(played.map((m) => Number(m.stage.slice(1))))].sort((a, b) => a - b);
  const [round, setRound] = useState<number>(rounds[rounds.length - 1] ?? 1);
  const name = (id: string) => s.teams[id]?.name ?? id;
  return (
    <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="panel overflow-x-auto p-2">
        <table className="w-full min-w-[560px] text-sm" data-testid="pl-table">
          <thead className="text-left font-cond text-xs uppercase tracking-wider text-muted">
            <tr>{["Pos", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts", "Forma"].map((h) => <th key={h} className="px-2 py-2">{h}</th>)}</tr>
          </thead>
          <tbody className="tabular">
            {table.map((r) => (
              <tr key={r.team} data-testid="pl-row" className={`border-t border-line ${r.team === s.userId ? "bg-gold/10 font-semibold" : ""} ${r.pos! >= 18 ? "text-loss/90" : ""}`}>
                <td className="px-2 py-1.5 font-mono">{r.pos}</td>
                <td className="px-2 py-1.5">{name(r.team)}</td>
                {[r.p, r.w, r.d, r.l, r.gf, r.ga, r.gd > 0 ? `+${r.gd}` : r.gd].map((v, i) => <td key={i} className="px-2 py-1.5 font-mono">{v}</td>)}
                <td className="px-2 py-1.5 font-mono font-bold">{r.pts}</td>
                <td className="px-2 py-1.5"><div className="flex gap-0.5">{r.form!.map((f, i) => <span key={i} className={`h-2 w-2 rounded-full ${f === "W" ? "bg-win" : f === "L" ? "bg-loss" : "bg-draw"}`} />)}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-cond text-base font-bold uppercase">Jornada</h3>
          <select className="rounded-lg border border-line bg-surface px-2 py-1 text-sm" value={round} onChange={(e) => setRound(Number(e.target.value))} aria-label="Jornada">
            {rounds.map((r) => <option key={r} value={r}>Jornada {r}</option>)}
          </select>
        </div>
        <ul className="divide-y divide-line text-sm">
          {played.filter((m) => m.stage === `R${round}`).map((m) => (
            <li key={m.id} className={`grid grid-cols-[1fr_auto_1fr] gap-2 py-1.5 ${m.home === s.userId || m.away === s.userId ? "text-gold-2" : ""}`}>
              <span className="truncate text-right">{name(m.home)}</span><span className="font-mono">{m.hg}-{m.ag}</span><span className="truncate">{name(m.away)}</span>
            </li>
          ))}
          {rounds.length === 0 && <li className="py-2 text-muted">Aún no hay jornadas disputadas.</li>}
        </ul>
      </div>
    </section>
  );
}

function TieRow({ s, t }: { s: SeasonState; t: Tie }) {
  const name = (id: string) => s.teams[id]?.name ?? id;
  const legs = t.legs.map((id) => s.matches.find((m) => m.id === id)!).filter(Boolean);
  const mine = t.a === s.userId || t.b === s.userId;
  return (
    <div className={`rounded-lg border border-line px-3 py-2 text-sm ${mine ? "border-gold/60 bg-gold/10" : "bg-white/[.02]"}`}>
      {[t.a, t.b].map((id) => (
        <div key={id} className={`flex justify-between gap-2 ${t.winner === id ? "font-semibold text-text" : t.winner ? "text-muted" : ""}`}>
          <span className="truncate">{name(id)}</span>
        </div>
      ))}
      <div className="mt-1 font-mono text-[11px] text-muted">{legs.map((m) => `${s.teams[m.home]?.short ?? m.home} ${scoreline(m)} ${s.teams[m.away]?.short ?? m.away}`).join(" | ")}</div>
    </div>
  );
}

function UclTab({ s }: { s: SeasonState }) {
  const table = uclTable(s);
  const name = (id: string) => s.teams[id]?.name ?? id;
  const st = (k: string) => s.ties.filter((t) => t.comp === "UCL" && t.stage === k);
  const bracketR16 = s.uclBracket ? s.uclBracket.map((id) => s.ties.find((t) => t.id === id)!).filter(Boolean) : [];
  return (
    <section className="space-y-6">
      <div className="panel overflow-x-auto p-2">
        <table className="w-full min-w-[520px] text-sm" data-testid="ucl-table">
          <thead className="text-left font-cond text-xs uppercase tracking-wider text-muted"><tr>{["Pos", "Club", "P", "W", "D", "L", "GD", "Pts"].map((h) => <th key={h} className="px-2 py-2">{h}</th>)}</tr></thead>
          <tbody className="tabular">
            {table.map((r) => (
              <tr key={r.team} data-testid="ucl-row" className={`border-t border-line ${r.team === s.userId ? "bg-gold/10 font-semibold" : ""}`}>
                <td className={`px-2 py-1.5 font-mono ${r.pos! <= 8 ? "text-win" : r.pos! <= 24 ? "text-gold-2" : "text-loss"}`}>{r.pos}</td>
                <td className="px-2 py-1.5">{name(r.team)} <span className="text-xs text-dim">{s.teams[r.team].country}</span></td>
                {[r.p, r.w, r.d, r.l, r.gd > 0 ? `+${r.gd}` : r.gd].map((v, i) => <td key={i} className="px-2 py-1.5 font-mono">{v}</td>)}
                <td className="px-2 py-1.5 font-mono font-bold">{r.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-2 py-2 text-[11px] text-dim">1–8 octavos directos · 9–24 playoffs · 25–36 eliminados. Desempate: puntos, DG, GF, goles fuera, victorias, victorias fuera, coeficiente (proxy).</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" data-testid="ucl-bracket">
        {([["Playoffs", st("PO")], ["Octavos", bracketR16], ["Cuartos", st("QF")], ["Semifinales", st("SF")], ["Final", st("F")]] as [string, Tie[]][]).map(([label, ties]) => (
          <div key={label} className="space-y-2">
            <h4 className="font-cond text-sm font-bold uppercase tracking-wider text-muted">{label}</h4>
            {ties.length ? ties.map((t) => <TieRow key={t.id} s={s} t={t} />) : <p className="text-xs text-dim">Pendiente</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function CupTab({ s, comp, stages }: { s: SeasonState; comp: CompId; stages: string[] }) {
  const LABEL: Record<string, string> = { R2: "Segunda ronda", R3: "Tercera ronda", R4: "Cuarta ronda", R5: "Quinta ronda", QF: "Cuartos", SF: "Semifinales", F: "Final" };
  const rules = comp === "FA"
    ? "Eliminatoria a partido único sin replays: prórroga y penales. Semifinales y final en sede neutral. Tu equipo entra en la tercera ronda."
    : "Sin prórroga hasta semifinales (penales directos). Semifinales a ida y vuelta (prórroga y penales en la vuelta). Final en sede neutral con prórroga y penales. Los clubes en Europa entran en la tercera ronda.";
  return (
    <section className="space-y-4" data-testid="cup-bracket">
      <p className="text-xs text-muted">{rules}</p>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {stages.map((st) => {
          const ties = s.ties.filter((t) => t.comp === comp && t.stage === st);
          const mineFirst = [...ties].sort((a, b) => Number(b.a === s.userId || b.b === s.userId) - Number(a.a === s.userId || a.b === s.userId));
          return (
            <div key={st} className="space-y-2">
              <h4 className="font-cond text-sm font-bold uppercase tracking-wider text-muted">{LABEL[st]} {ties.length > 0 && <span className="text-dim">({ties.length})</span>}</h4>
              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                {ties.length ? mineFirst.map((t) => <TieRow key={t.id} s={s} t={t} />) : <p className="text-xs text-dim">Pendiente</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function XiTab({ xi }: { xi: XiSource | null }) {
  const [chemMode, setChemMode] = useState(true);
  const [focus, setFocus] = useState<string | null>(null);
  if (!xi) return <p className="panel p-4 text-sm text-muted">No hay XI asociado a esta temporada.</p>;
  const fm = FORMATION_BY_ID[xi.formationId];
  const lc = lineupOf(xi.lineup);
  const chem = computeChemistry(fm, lc, leagueOf, xi.captainId);
  return (
    <section className="space-y-3" data-testid="fb-xi-tab">
      <div className="flex flex-wrap items-center gap-2"><button className={`btn btn-sm ${chemMode ? "border-win text-win" : ""}`} onClick={() => setChemMode((v) => !v)}>⚗ Modo química</button>{chemMode && <ChemLegend />}</div>
      <div className="mx-auto max-w-md"><Pitch formation={fm} lineup={lc} chem={chem.perSlot} captainId={xi.captainId} chemMode={chemMode} links={chemistryLinks(fm, lc, leagueOf)} focus={focus} onSlotClick={(id) => setFocus(focus === id ? null : id)} /></div>
    </section>
  );
}

function SummaryTab({ s, xi, narrative, done }: { s: SeasonState; xi: XiSource | null; narrative: string[]; done: boolean }) {
  const row = plTable(s).find((r) => r.team === s.userId)!;
  const rows = useMemo(() => (noDetail(s) ? [] : aggregatePlayerStats(s)), [s]);
  const awards = useMemo(() => teamAwards(rows, userMatchesOf(s).length), [rows, s]);
  const xiInfo = useMemo(() => {
    if (!xi) return null;
    const fm = FORMATION_BY_ID[xi.formationId]; const lc = lineupOf(xi.lineup);
    const chem = computeChemistry(fm, lc, leagueOf, xi.captainId); const sens = DIFFICULTY_PARAMS[xi.difficulty].fbFitSensitivity;
    return { chem: chem.total, effect: chemistryEffect(chem.total, sens), r: teamRatings(fm, lc, chem.total, sens), fm, lc, perSlot: chem.perSlot };
  }, [xi]);
  const topScorers = [...rows].filter((r) => r.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 3);
  return (
    <section className="space-y-4" data-testid="fb-summary">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel p-5">
          <div className="font-cond text-xs font-bold uppercase tracking-[.2em] text-muted">Premier League {done ? "· final" : "· provisional"}</div>
          <div className="mt-1 flex flex-wrap items-end gap-4">
            <div className="font-display text-6xl leading-none" data-testid="fb-final-pos">{row.pos}º</div>
            <div className="grid grid-cols-3 gap-2 font-mono text-sm sm:grid-cols-6">{[["Pts", row.pts], ["V", row.w], ["E", row.d], ["D", row.l], ["GF", row.gf], ["GC", row.ga]].map(([k, v]) => <div key={k as string} className="rounded-lg bg-white/5 px-2 py-1 text-center"><div className="text-[10px] text-muted">{k}</div>{v}</div>)}</div>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-muted">{narrative.map((n) => <li key={n}>· {n}</li>)}</ul>
          {s.notes.length > 0 && <ul className="mt-3 space-y-1 text-xs text-gold-2">{s.notes.map((n) => <li key={n}>⚑ {n}</li>)}</ul>}
        </div>
        {xiInfo && (
          <div className="panel p-4">
            <div className="flex items-center justify-between"><span className="font-cond text-sm font-bold uppercase tracking-wide">Mi XI · {xi!.formationId}</span><span className="font-mono text-xs">OVR {xiInfo.r.ovr} · Quím {xiInfo.chem}/33</span></div>
            <div className="mx-auto mt-2 max-w-[260px]"><Pitch formation={xiInfo.fm} lineup={xiInfo.lc} chem={xiInfo.perSlot} captainId={xi!.captainId} compact /></div>
            <p className="mt-2 text-[11px] text-muted">Química {xiInfo.chem}/33 → {xiInfo.effect >= 0 ? "+" : ""}{xiInfo.effect} en ataque y defensa · Ataque {xiInfo.r.attack} · Medio {xiInfo.r.midfield} · Defensa {xiInfo.r.defense}</p>
          </div>
        )}
      </div>
      {rows.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-gold/15 px-3 py-2"><div className="text-[10px] uppercase text-muted">MVP del equipo</div><div className="font-cond text-lg font-bold uppercase" data-testid="fb-mvp">{awards.mvp?.name ?? "—"}</div><div className="font-mono text-xs">{awards.mvp ? `${awards.mvp.rating.toFixed(2)} nota · ${awards.mvp.goals} G · ${awards.mvp.assists} A` : ""}</div></div>
          <div className="rounded-xl bg-white/5 px-3 py-2"><div className="text-[10px] uppercase text-muted">Máximos goleadores</div>{topScorers.map((r) => <div key={r.key} className="flex justify-between text-sm"><span className="truncate">{r.name}</span><b className="font-mono">{r.goals}</b></div>)}</div>
          <div className="rounded-xl bg-white/5 px-3 py-2"><div className="text-[10px] uppercase text-muted">Máximo asistidor</div><div className="font-cond text-lg font-bold uppercase">{awards.topAssister?.name ?? "—"}</div><div className="font-mono text-xs">{awards.topAssister?.assists ?? 0} asistencias</div></div>
        </div>
      )}
      <SeasonHighlights s={s} />
      <p className="text-[11px] text-dim">Resultados del videojuego generados con un modelo probabilístico (Poisson). No son predicciones deportivas reales.</p>
    </section>
  );
}
