"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Difficulty } from "@/lib/core/difficulty";
import { randomSeed } from "@/lib/core/rng";
import { FRANCHISE_BY_ID, NBA_FRANCHISES } from "@/lib/data/nba/franchises";
import { evaluateNbaTeam } from "@/lib/ratings/nba";
import { DIFFICULTY_PARAMS } from "@/lib/core/difficulty";
import { addHistory, KEYS, load, remove, save, type HistoryEntry } from "@/lib/storage";
import { animMs, useSettings } from "@/hooks/useSettings";
import type { NbaDraftState, NbaPos, NbaSeasonResult } from "@/types/nba";
import { NBA_POSITIONS } from "@/types/nba";
import {
  CARD_BY_ID, createDraft, eraRespinOptions, isComplete, lineupCards, movePlayer, pick, placeablePositions,
  respinEra, respinTeam, teamRespinOptions,
} from "./engine";
import { monteCarlo, simulateSeason, type MonteCarloSummary } from "@/features/nba-simulation/engine";
import { DifficultySelector } from "@/components/common/DifficultySelector";
import { Reel } from "@/components/common/Reel";
import { NbaCardView } from "@/components/nba/NbaCardView";
import { Court } from "@/components/nba/Court";
import { StatBar } from "@/components/common/StatBar";
import { SeasonResults } from "@/components/nba/SeasonResults";

type Phase = "setup" | "draft" | "results";
const FR_NAMES = NBA_FRANCHISES.map((f) => `${f.city} ${f.name}`);
const DECADES = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];

export function NbaGame() {
  const { settings } = useSettings();
  const [phase, setPhase] = useState<Phase>("setup");
  const [difficulty, setDifficulty] = useState<Difficulty>("NORMAL");
  const [draft, setDraft] = useState<NbaDraftState | null>(null);
  const [saved, setSaved] = useState<NbaDraftState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<NbaPos | null>(null);
  const [season, setSeason] = useState<{ result: NbaSeasonResult; animate: number } | null>(null);
  const [mc, setMc] = useState<MonteCarloSummary | null>(null);
  const [mcBusy, setMcBusy] = useState(false);
  const [best, setBest] = useState<{ wins: number; losses: number; seed: string } | null>(null);
  const [recent, setRecent] = useState<HistoryEntry[]>([]);
  const [howTo, setHowTo] = useState(false);

  useEffect(() => {
    setBest(load(KEYS.nbaBest, null));
    setRecent(load<HistoryEntry[]>(KEYS.history, []).filter((h) => h.game === "nba").slice(0, 5));
    const s = load<NbaDraftState | null>(KEYS.nbaDraft, null);
    if (s && s.lineup) setSaved(s);
  }, [phase]);
  useEffect(() => { if (draft) save(KEYS.nbaDraft, draft); }, [draft]);

  const lineup = useMemo(() => (draft ? lineupCards(draft) : {}), [draft]);
  const teamEval = useMemo(() => evaluateNbaTeam(lineup, DIFFICULTY_PARAMS[difficulty].nbaFitSensitivity), [lineup, difficulty]);
  const complete = draft ? isComplete(draft) : false;

  const start = (seed = randomSeed()) => {
    setError(null); setSeason(null); setMc(null); setSelectedSlot(null);
    setDraft(createDraft(seed, difficulty)); setPhase("draft");
  };
  const resume = () => { if (!saved) return; setDifficulty(saved.difficulty); setDraft(saved); setPhase(isComplete(saved) ? "draft" : "draft"); };

  const apply = (r: { ok: true; state: NbaDraftState } | { ok: false; error: string }) => {
    if (r.ok) { setDraft(r.state); setError(null); } else setError(r.error);
  };

  const runSeason = (seed: string, animate = true) => {
    if (!draft) return;
    const { result } = simulateSeason(lineup, draft.difficulty, seed);
    setSeason({ result, animate: animate ? animMs(settings, 2600) : 0 });
    setMc(null);
    setPhase("results");
    const names = NBA_POSITIONS.map((p) => lineup[p]?.name).join(", ");
    addHistory({ game: "nba", seed, difficulty: draft.difficulty, title: `${result.wins}-${result.losses}`, detail: names, score: result.wins });
    const prev = load<{ wins: number } | null>(KEYS.nbaBest, null);
    if (!prev || result.wins > prev.wins) save(KEYS.nbaBest, { wins: result.wins, losses: result.losses, seed });
  };

  const runMc = (runs: number) => {
    if (!draft || !season) return;
    setMcBusy(true);
    setTimeout(() => { setMc(monteCarlo(lineup, draft.difficulty, season.result.seed, runs)); setMcBusy(false); }, 30);
  };

  const onSlotClick = (p: NbaPos) => {
    if (!draft) return;
    if (selectedSlot && selectedSlot !== p) { apply(movePlayer(draft, selectedSlot, p)); setSelectedSlot(null); return; }
    setSelectedSlot(draft.lineup[p] ? (selectedSlot === p ? null : p) : null);
  };

  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <section>
            <span className="chip border-nba/50 text-nba-2">Game 1</span>
            <h1 className="font-display mt-3 text-6xl leading-none md:text-8xl">NBA <span className="text-nba">82-0</span></h1>
            <p className="mt-3 text-lg">Build your legendary starting five. <span className="text-muted">Can you go undefeated?</span></p>
            <div className="panel mt-8 p-5">
              <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-[.2em] text-muted">Dificultad</h2>
              <DifficultySelector value={difficulty} onChange={setDifficulty} />
              <div className="mt-5 flex flex-wrap gap-3">
                <button className="btn btn-nba" onClick={() => start()} data-testid="start-nba-draft">Nuevo draft</button>
                {saved && !isComplete(saved) && <button className="btn" onClick={resume}>Continuar draft guardado</button>}
                <button className="btn btn-ghost" onClick={() => setHowTo((v) => !v)}>Cómo jugar</button>
              </div>
            </div>
            <AnimatePresence>
              {howTo && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="panel mt-4 overflow-hidden p-5 text-sm text-muted">
                  <ol className="list-decimal space-y-1.5 pl-5">
                    <li>Cinco rondas. En cada una se sortean una <b className="text-text">franquicia</b> y una <b className="text-text">década</b>.</li>
                    <li>Elige un jugador que realmente jugó en esa franquicia en esa década. Cada carta es una temporada concreta.</li>
                    <li>Colócalo en una posición libre (PG, SG, SF, PF, C). Algunas cartas admiten posición secundaria.</li>
                    <li>Tienes <b className="text-text">1 Re-spin de equipo</b> y <b className="text-text">1 Re-spin de época</b> para todo el draft.</li>
                    <li>Con el quinteto completo, simula 82 partidos. Cada partido es un sorteo probabilístico reproducible por semilla.</li>
                  </ol>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
          <aside className="space-y-4">
            <div className="panel p-5">
              <div className="font-cond text-sm font-bold uppercase tracking-[.2em] text-muted">Mejor récord</div>
              <div className="font-display mt-1 text-6xl tabular">{best ? `${best.wins}-${best.losses}` : "—"}</div>
              {best && <div className="text-xs text-muted">Semilla {best.seed}</div>}
            </div>
            <div className="panel p-5">
              <div className="font-cond text-sm font-bold uppercase tracking-[.2em] text-muted">Historial reciente</div>
              {recent.length === 0 ? <p className="mt-2 text-sm text-muted">Aún no hay temporadas.</p> : (
                <ul className="mt-2 divide-y divide-line text-sm">
                  {recent.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="font-display text-xl tabular">{h.title}</span>
                      <span className="truncate text-xs text-muted">{h.detail}</span>
                      <span className="chip text-[10px]">{h.difficulty}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (!draft) return null;

  if (phase === "results" && season) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <SeasonResults
            result={season.result} team={teamEval} animate={season.animate} mc={mc} mcBusy={mcBusy}
            onReplay={() => runSeason(season.result.seed)} onNewSeed={() => runSeason(randomSeed())}
            onCustomSeed={(s) => runSeason(s)} onMonteCarlo={runMc}
            onNewDraft={() => { remove(KEYS.nbaDraft); setPhase("setup"); setDraft(null); }}
          />
          <aside className="space-y-4">
            <Court lineup={lineup} />
            <TeamPanel ev={teamEval} />
          </aside>
        </div>
      </div>
    );
  }

  // ───────── Draft phase ─────────
  const spin = draft.spin;
  const fr = spin ? FRANCHISE_BY_ID[spin.franchiseId] : null;
  const cards = draft.options.map((id) => CARD_BY_ID[id]);
  const teamOpts = teamRespinOptions(draft).length;
  const eraOpts = eraRespinOptions(draft).length;
  const reelMs = animMs(settings, 1100);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl">NBA <span className="text-nba">82-0</span></h1>
        <span className="chip text-muted">Ronda {Math.min(5, draft.round + 1)} / 5</span>
        <span className="chip text-muted">{draft.difficulty}</span>
        <span className="chip text-muted">Semilla <span className="font-mono normal-case">{draft.seed}</span></span>
        <button className="btn btn-ghost btn-sm ml-auto" onClick={() => { remove(KEYS.nbaDraft); setPhase("setup"); setDraft(null); }}>Abandonar</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          {!complete && spin && fr && (
            <section className="panel p-4 md:p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Reel label="Franquicia" value={draft && `${fr.city} ${fr.name}`} pool={FR_NAMES} durationMs={reelMs} testId="reel-team" accent={fr.colors[0] === "#111111" ? "#ffffff" : "#ff8a3d"} />
                <Reel label="Década" value={spin.decade} pool={DECADES} durationMs={reelMs} testId="reel-era" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button className="btn btn-sm" disabled={draft.respins.team <= 0 || teamOpts === 0} onClick={() => apply(respinTeam(draft))} data-testid="respin-team">
                  ↻ Re-spin team <span className="rounded bg-white/10 px-1.5 font-mono">{draft.respins.team}</span>
                </button>
                <button className="btn btn-sm" disabled={draft.respins.era <= 0 || eraOpts === 0} onClick={() => apply(respinEra(draft))} data-testid="respin-era">
                  ↻ Re-spin era <span className="rounded bg-white/10 px-1.5 font-mono">{draft.respins.era}</span>
                </button>
                <span className="text-xs text-muted">Re-spins por draft completo. Team conserva la década; Era conserva la franquicia.</span>
              </div>
              {error && <p role="alert" className="mt-2 text-sm text-loss">{error}</p>}
            </section>
          )}

          {!complete && (
            <section>
              <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-[.2em] text-muted">
                Jugadores de {spin && `${fr?.city} ${fr?.name} · ${spin.decade}`} ({cards.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="card-grid">
                {cards.map((c, i) => {
                  const pl = placeablePositions(draft, c);
                  const already = Object.values(draft.lineup).some((id) => id && CARD_BY_ID[id].playerId === c.playerId);
                  return (
                    <NbaCardView key={c.id} card={c} index={i} placeable={pl}
                      disabledReason={already ? "Ya está en tu quinteto" : "Sus posiciones ya están ocupadas"}
                      onPick={(pos) => apply(pick(draft, c.id, pos))} />
                  );
                })}
              </div>
            </section>
          )}

          {complete && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel p-6 text-center">
              <div className="font-cond text-sm font-bold uppercase tracking-[.25em] text-muted">Quinteto completo</div>
              <div className="font-display mt-2 text-5xl">OVR {teamEval.overall} · NET {teamEval.net > 0 ? "+" : ""}{teamEval.net}</div>
              <p className="mt-2 text-sm text-muted">Puedes intercambiar posiciones tocando dos jugadores en la cancha (si ambos pueden jugar ahí).</p>
              <button className="btn btn-nba mt-5 px-8 py-4 text-lg" onClick={() => runSeason(randomSeed())} data-testid="simulate-season">Simulate 82-game season</button>
            </motion.section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Court lineup={lineup} selected={selectedSlot} onSlotClick={onSlotClick} />
          <TeamPanel ev={teamEval} />
          {draft.history.length > 0 && (
            <div className="panel p-4 text-xs text-muted">
              <div className="mb-2 font-cond text-sm font-bold uppercase tracking-wide text-text">Picks</div>
              {draft.history.map((h) => (
                <div key={h.round} className="flex justify-between py-0.5"><span>R{h.round + 1} · {h.spin.franchiseId} {h.spin.decade}</span><span className="text-text">{h.pos} · {CARD_BY_ID[h.pickedId].name}</span></div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function TeamPanel({ ev }: { ev: ReturnType<typeof evaluateNbaTeam> }) {
  return (
    <div className="panel p-4" data-testid="team-panel">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-cond text-sm font-bold uppercase tracking-wide">Equipo</span>
        <span className="font-mono text-xs text-muted">Química {ev.chemistry}</span>
      </div>
      <div className="space-y-1">
        <StatBar label="Overall" value={ev.overall} />
        <StatBar label="Ataque" value={ev.offense} />
        <StatBar label="Defensa" value={ev.defense} />
        <StatBar label="Creación" value={ev.playmaking} />
        <StatBar label="Rebote" value={ev.rebounding} />
        <StatBar label="Aro" value={ev.rimProtection} />
        <StatBar label="Tiro" value={ev.shooting} />
        <StatBar label="Versatil." value={ev.versatility} />
        <StatBar label="Química" value={ev.chemistry} max={100} color="var(--color-win)" />
      </div>
      {ev.notes.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted">{ev.notes.map((n) => <li key={n}>· {n}</li>)}</ul>}
    </div>
  );
}
