"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Difficulty } from "@/lib/core/difficulty";
import { DIFFICULTY_PARAMS } from "@/lib/core/difficulty";
import { randomSeed } from "@/lib/core/rng";
import { FRANCHISE_BY_ID, NBA_FRANCHISES } from "@/lib/data/nba/franchises";
import { evaluateNbaTeam } from "@/lib/ratings/nba";
import { addHistory, KEYS, load, remove, save, type HistoryEntry } from "@/lib/storage";
import { animMs, useSettings } from "@/hooks/useSettings";
import type { NbaCard, NbaDraftState, NbaPos, NbaSeasonResult, NbaTeamSnapshot } from "@/types/nba";
import { NBA_POSITIONS } from "@/types/nba";
import {
  CARD_BY_ID, createDraft, eraRespinOptions, isComplete, lineupCards, movePlayer, pick, placeablePositions,
  respinEra, respinTeam, teamRespinOptions, versionsFor,
} from "./engine";
import { buildSnapshot } from "./snapshot";
import { monteCarlo, simulateSeason, OUTCOME_LABEL, type MonteCarloSummary } from "@/features/nba-simulation/engine";
import { DifficultySelector } from "@/components/common/DifficultySelector";
import { Reel } from "@/components/common/Reel";
import { Court } from "@/components/nba/Court";
import { SeasonResults } from "@/components/nba/SeasonResults";
import { ChemistryPanel } from "@/components/nba/ChemistryPanel";
import { PlayerList } from "@/components/nba/PlayerList";
import { PlayerSheet } from "@/components/nba/PlayerSheet";
import { QuintetButton, QuintetModal } from "@/components/nba/QuintetModal";

type Phase = "setup" | "draft" | "results";
const FR_NAMES = NBA_FRANCHISES.map((f) => `${f.city} ${f.name}`);
const DECADES = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];
interface LastSession { draft: NbaDraftState; seed: string }

export function NbaGame() {
  const { settings } = useSettings();
  const [phase, setPhase] = useState<Phase>("setup");
  const [difficulty, setDifficulty] = useState<Difficulty>("NORMAL");
  const [draft, setDraft] = useState<NbaDraftState | null>(null);
  const [saved, setSaved] = useState<NbaDraftState | null>(null);
  const [last, setLast] = useState<LastSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<NbaPos | null>(null);
  const [season, setSeason] = useState<{ result: NbaSeasonResult; animate: number } | null>(null);
  const [mc, setMc] = useState<MonteCarloSummary | null>(null);
  const [mcBusy, setMcBusy] = useState(false);
  const [best, setBest] = useState<{ wins: number; losses: number; seed: string } | null>(null);
  const [recent, setRecent] = useState<HistoryEntry[]>([]);
  const [howTo, setHowTo] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<NbaCard | null>(null);
  const [showQuintet, setShowQuintet] = useState(false);
  const [showChem, setShowChem] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const [histSnap, setHistSnap] = useState<NbaTeamSnapshot | null>(null);

  useEffect(() => {
    setBest(load(KEYS.nbaBest, null));
    setRecent(load<HistoryEntry[]>(KEYS.history, []).filter((h) => h.game === "nba").slice(0, 5));
    const s = load<NbaDraftState | null>(KEYS.nbaDraft, null);
    setSaved(s && s.lineup ? s : null);
    const l = load<LastSession | null>(KEYS.nbaLast, null);
    setLast(l && l.draft && l.draft.lineup && isComplete(l.draft) ? l : null);
  }, [phase]);
  useEffect(() => { if (draft) save(KEYS.nbaDraft, draft); }, [draft]);

  const diff = draft?.difficulty ?? difficulty;
  const sens = DIFFICULTY_PARAMS[diff].nbaFitSensitivity;
  const lineup = useMemo(() => (draft ? lineupCards(draft) : {}), [draft]);
  const teamEval = useMemo(() => evaluateNbaTeam(lineup, sens), [lineup, sens]);
  const complete = draft ? isComplete(draft) : false;
  const snapshot = useMemo(() => (draft && Object.keys(draft.lineup).length ? buildSnapshot(lineup, diff, season?.result.seed ?? "—", draft.seed, season ? { record: { wins: season.result.wins, losses: season.result.losses }, playoff: season.result.playoffs ? OUTCOME_LABEL[season.result.playoffs.outcome] : undefined } : {}) : null), [draft, lineup, diff, season]);
  const spinKey = draft?.spin ? `${draft.round}:${draft.spin.franchiseId}:${draft.spin.decade}` : null;
  const isRevealed = !!spinKey && revealed === spinKey;

  const start = (seed = randomSeed()) => {
    setError(null); setSeason(null); setMc(null); setSelectedSlot(null); setRevealed(null);
    setDraft(createDraft(seed, difficulty)); setPhase("draft");
  };
  const resume = () => { if (!saved) return; setDifficulty(saved.difficulty); setDraft(saved); setRevealed(null); setPhase("draft"); };
  const openLast = () => {
    if (!last) return;
    setDifficulty(last.draft.difficulty); setDraft(last.draft);
    const { result } = simulateSeason(lineupCards(last.draft), last.draft.difficulty, last.seed);
    setSeason({ result, animate: 0 }); setMc(null); setPhase("results");
  };

  const apply = (r: { ok: true; state: NbaDraftState } | { ok: false; error: string }, reveal = false) => {
    if (!r.ok) { setError(r.error); return; }
    setDraft(r.state); setError(null);
    if (reveal && r.state.spin) setRevealed(`${r.state.round}:${r.state.spin.franchiseId}:${r.state.spin.decade}`);
  };

  const runSeason = (seed: string, animate = true) => {
    if (!draft) return;
    const { result } = simulateSeason(lineup, draft.difficulty, seed);
    setSeason({ result, animate: animate ? animMs(settings, 2600) : 0 });
    setMc(null);
    setPhase("results");
    save(KEYS.nbaLast, { draft, seed });
    const names = NBA_POSITIONS.map((p) => lineup[p]?.name).join(", ");
    const outcome = result.playoffs ? OUTCOME_LABEL[result.playoffs.outcome] : undefined;
    addHistory({ game: "nba", seed, difficulty: draft.difficulty, title: `${result.wins}-${result.losses}${result.playoffs?.outcome === "champion" ? " 🏆" : ""}`, detail: `${names}${outcome ? ` · ${outcome}` : ""}`, score: result.wins,
      nba: buildSnapshot(lineup, draft.difficulty, seed, draft.seed, { record: { wins: result.wins, losses: result.losses }, playoff: outcome }) });
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
  const newDraft = () => { remove(KEYS.nbaDraft); setPhase("setup"); setDraft(null); setSeason(null); };

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
                {saved && !isComplete(saved) && <button className="btn" onClick={resume} data-testid="resume-draft">Continuar draft guardado</button>}
                {last && <button className="btn" onClick={openLast} data-testid="open-last">Ver última temporada</button>}
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
                      {h.nba && <button className="btn btn-sm btn-ghost" onClick={() => setHistSnap(h.nba!)} data-testid="history-quintet">Quinteto</button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
        <QuintetModal open={!!histSnap} onClose={() => setHistSnap(null)} snap={histSnap} />
      </div>
    );
  }

  if (!draft) return null;

  if (phase === "results" && season) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            <SeasonResults
              result={season.result} team={teamEval} animate={season.animate} mc={mc} mcBusy={mcBusy}
              onReplay={() => runSeason(season.result.seed)} onNewSeed={() => runSeason(randomSeed())}
              onCustomSeed={(s) => runSeason(s)} onMonteCarlo={runMc} onNewDraft={newDraft}
              extra={<QuintetButton onClick={() => setShowQuintet(true)} />}
            />
          </div>
          <aside className="space-y-4">
            <Court lineup={lineup} />
            <ChemistryPanel ev={teamEval} />
          </aside>
        </div>
        <QuintetModal open={showQuintet} onClose={() => setShowQuintet(false)} snap={snapshot} />
      </div>
    );
  }

  // ───────── Draft phase (mobile-first) ─────────
  const spin = draft.spin;
  const fr = spin ? FRANCHISE_BY_ID[spin.franchiseId] : null;
  const cards = draft.options.map((id) => CARD_BY_ID[id]);
  const teamOpts = teamRespinOptions(draft).length;
  const eraOpts = eraRespinOptions(draft).length;
  const reelMs = animMs(settings, 1100);
  const placeable = (c: NbaCard) => placeablePositions(draft, c);
  const drafted = (c: NbaCard) => Object.values(draft.lineup).some((id) => id && CARD_BY_ID[id].playerId === c.playerId);
  const open = NBA_POSITIONS.filter((p) => !draft.lineup[p]);

  const topBar = (
    <div className="flex items-center gap-2">
      <span className="rounded-lg bg-nba px-2.5 py-1 font-display text-lg leading-none text-black" data-testid="round-indicator">RONDA {Math.min(5, draft.round + 1)}/5</span>
      <div className="flex gap-1" aria-hidden>{[0, 1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 w-5 rounded-full ${i < draft.round ? "bg-nba" : i === draft.round && !complete ? "bg-nba/50" : "bg-white/10"}`} />)}</div>
      <span className="chip ml-auto text-[10px] text-muted">{draft.difficulty}</span>
      <QuintetButton onClick={() => setShowQuintet(true)} disabled={!Object.keys(draft.lineup).length} />
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-3 pb-[44dvh] pt-3 sm:px-4 lg:pb-8">
      <div className="lg:grid lg:grid-cols-[1fr_420px] lg:gap-6">
        <div className="min-w-0 space-y-3">
          {topBar}
          {!complete && spin && fr && (
            <section className="panel relative p-3">
              <div className="grid grid-cols-2 gap-2">
                <Reel label="Franquicia" value={isRevealed ? `${fr.city} ${fr.name}` : "?"} pool={isRevealed ? FR_NAMES : ["?"]} durationMs={isRevealed ? reelMs : 0} testId="reel-team" accent={fr.colors[0] === "#111111" ? "#ffffff" : "#ff8a3d"} />
                <Reel label="Década" value={isRevealed ? spin.decade : "?"} pool={isRevealed ? DECADES : ["?"]} durationMs={isRevealed ? reelMs : 0} testId="reel-era" />
              </div>
              {!isRevealed ? (
                <button className="btn btn-nba mt-3 w-full py-4 text-xl" onClick={() => setRevealed(spinKey)} data-testid="spin-btn">🎰 GIRAR</button>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button className="btn btn-sm flex-1" disabled={draft.respins.team <= 0 || teamOpts === 0} onClick={() => apply(respinTeam(draft), true)} data-testid="respin-team">↻ Equipo <span className="rounded bg-white/10 px-1.5 font-mono">{draft.respins.team}</span></button>
                  <button className="btn btn-sm flex-1" disabled={draft.respins.era <= 0 || eraOpts === 0} onClick={() => apply(respinEra(draft), true)} data-testid="respin-era">↻ Época <span className="rounded bg-white/10 px-1.5 font-mono">{draft.respins.era}</span></button>
                </div>
              )}
              {error && <p role="alert" className="mt-2 text-sm text-loss">{error}</p>}
            </section>
          )}
          <Court lineup={lineup} selected={selectedSlot} onSlotClick={onSlotClick} highlight={isRevealed ? open : []} />
          {complete ? (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel p-5 text-center">
              <div className="font-cond text-sm font-bold uppercase tracking-[.25em] text-muted">Quinteto completo</div>
              <div className="font-display mt-1 text-4xl">OVR {teamEval.overall} · NET {teamEval.net > 0 ? "+" : ""}{teamEval.net} · QUÍM {teamEval.chemistry}</div>
              <p className="mt-1 text-xs text-muted">Toca dos jugadores en la cancha para intercambiar posiciones válidas.</p>
              <button className="btn btn-nba mt-4 w-full px-8 py-4 text-lg sm:w-auto" onClick={() => runSeason(randomSeed())} data-testid="simulate-season">Simular temporada + playoffs</button>
            </motion.section>
          ) : (
            <button className="btn btn-sm w-full lg:hidden" onClick={() => setShowChem(true)} data-testid="open-chemistry">⚗ Química {teamEval.chemistry} · ver cómo se calcula</button>
          )}
          <div className="hidden lg:block"><ChemistryPanel ev={teamEval} /></div>
          {complete && <div className="lg:hidden"><ChemistryPanel ev={teamEval} /></div>}
          <button className="btn btn-ghost btn-sm" onClick={newDraft}>Abandonar draft</button>
        </div>

        {/* Player list: bottom drawer on mobile, side column on desktop */}
        {!complete && isRevealed && (
          <aside className="fixed inset-x-0 bottom-0 z-40 flex max-h-[42dvh] flex-col rounded-t-3xl border-t border-line-strong bg-surface/95 shadow-[0_-12px_40px_rgba(0,0,0,.6)] backdrop-blur lg:static lg:z-auto lg:max-h-none lg:rounded-2xl lg:border lg:bg-surface lg:shadow-none"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }} data-testid="player-drawer">
            <button className="flex items-center justify-between gap-2 px-4 pb-2 pt-3 text-left lg:pointer-events-none" onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen}>
              <span>
                <span className="mx-auto mb-1 block h-1 w-10 rounded-full bg-white/20 lg:hidden" />
                <span className="font-cond text-sm font-bold uppercase tracking-wide">{fr?.city} {fr?.name} · {spin?.decade}</span>
                <span className="block text-[11px] text-muted">{cards.length} jugador{cards.length === 1 ? "" : "es"} · toca uno para ver ficha y encaje</span>
              </span>
              <span className="text-muted lg:hidden">{listOpen ? "▼" : "▲"}</span>
            </button>
            {listOpen && (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 scrollbar-thin">
                <PlayerList cards={cards} placeable={placeable} onOpen={setOpenCard} versionCount={(c) => (spin ? versionsFor(spin, c.playerId).length : 1)} />
              </div>
            )}
          </aside>
        )}
      </div>

      <PlayerSheet card={openCard} versions={openCard && spin ? versionsFor(spin, openCard.playerId) : []} lineup={lineup} placeable={placeable}
        alreadyDrafted={openCard ? drafted(openCard) : false} fitSensitivity={sens}
        onPick={(c, p) => { apply(pick(draft, c.id, p)); setOpenCard(null); }} onClose={() => setOpenCard(null)} />
      <QuintetModal open={showQuintet} onClose={() => setShowQuintet(false)} snap={snapshot}>
        <ChemistryPanel ev={teamEval} compact />
      </QuintetModal>
      <AnimatePresence>{showChem && (
        <motion.div className="fixed inset-0 z-[60] flex items-end bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowChem(false)}>
          <div className="max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
            <ChemistryPanel ev={teamEval} />
            <button className="btn btn-sm mt-3 w-full" onClick={() => setShowChem(false)}>Cerrar</button>
          </div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}
