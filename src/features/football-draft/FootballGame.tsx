"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import type { Difficulty } from "@/lib/core/difficulty";
import { DIFFICULTY_PARAMS } from "@/lib/core/difficulty";
import { randomSeed } from "@/lib/core/rng";
import { FORMATIONS, FORMATION_BY_ID } from "@/lib/data/football/formations";
import { HIST_CLUBS, HIST_CLUB_BY_ID, leagueOf } from "@/lib/data/football/clubs";
import { FANTASY_ID, PL_CLUBS } from "@/lib/data/football/world";
import { computeChemistry, teamRatings, slotFit } from "@/lib/ratings/football";
import { addHistory, KEYS, load, remove, save } from "@/lib/storage";
import { animMs, useSettings } from "@/hooks/useSettings";
import type { DraftMode, FbDraftState, FbPlayerSeason } from "@/types/football";
import { FB_DECADES } from "@/types/football";
import {
  FB_CARD_BY_ID, canRespinClub, canRespinEra, captainSlots, changeFormation, createFbDraft, isFbComplete, pickCaptain, pickFb,
  respinClub, respinEra, slotById, swapSlots,
} from "./engine";
import { createSeason, isSeasonDone, simulateRest, stepSeason, stepToNextUserMatch, summarize, type SeasonState } from "@/features/football-simulation/season";
import { DifficultySelector } from "@/components/common/DifficultySelector";
import { Reel } from "@/components/common/Reel";
import { StatBar } from "@/components/common/StatBar";
import { FbCardView } from "@/components/football/FbCardView";
import { FormationPreview, Pitch } from "@/components/football/Pitch";
import { SeasonView } from "@/components/football/SeasonView";

type Phase = "setup" | "draft" | "squad" | "season";
interface Config { difficulty: Difficulty; clubId: string; replacedClubId: string; formationId: string; mode: DraftMode }
interface Session { phase: Phase; config: Config; draft: FbDraftState | null; season: SeasonState | null; live: boolean }

const DEFAULT_CONFIG: Config = { difficulty: "NORMAL", clubId: "ARS", replacedClubId: "HUL", formationId: "4-3-3", mode: "roulette" };
const CLUB_NAMES = HIST_CLUBS.map((c) => c.name);

export function FootballGame() {
  const { settings } = useSettings();
  const [session, setSession] = useState<Session>({ phase: "setup", config: DEFAULT_CONFIG, draft: null, season: null, live: false });
  const [error, setError] = useState<string | null>(null);
  const [captainPick, setCaptainPick] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = load<Session | null>(KEYS.fbSession, null);
    if (s && s.config) setSession(s);
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) save(KEYS.fbSession, session); }, [session, loaded]);

  const { config, draft, season } = session;
  const set = (patch: Partial<Session>) => setSession((s) => ({ ...s, ...patch }));
  const setConfig = (patch: Partial<Config>) => setSession((s) => ({ ...s, config: { ...s.config, ...patch } }));

  const formation = draft ? FORMATION_BY_ID[draft.formationId] : FORMATION_BY_ID[config.formationId];
  const lineupCards = useMemo(() => {
    const out: Record<string, FbPlayerSeason | undefined> = {};
    if (draft) for (const [k, v] of Object.entries(draft.lineup)) out[k] = FB_CARD_BY_ID[v];
    return out;
  }, [draft]);
  const chem = useMemo(() => computeChemistry(formation, lineupCards, leagueOf, draft?.captainId ?? null), [formation, lineupCards, draft]);
  const ratings = useMemo(() => teamRatings(formation, lineupCards, chem.total, DIFFICULTY_PARAMS[config.difficulty].fbFitSensitivity), [formation, lineupCards, chem, config.difficulty]);
  const userName = config.clubId === FANTASY_ID ? "Fantasy FC" : PL_CLUBS.find((c) => c.id === config.clubId)?.name ?? "Mi club";

  const apply = (r: { ok: true; state: FbDraftState } | { ok: false; error: string }, phaseIfComplete = true) => {
    if (!r.ok) { setError(r.error); return; }
    setError(null);
    set({ draft: r.state, phase: phaseIfComplete && isFbComplete(r.state) ? "squad" : session.phase === "setup" ? "draft" : session.phase });
  };

  const start = () => {
    setError(null); setCaptainPick(null); setSelected(null);
    try {
      const d = createFbDraft(randomSeed(), config.difficulty, config.mode, config.formationId);
      set({ draft: d, season: null, phase: "draft" });
    } catch (e) { setError(String(e)); }
  };

  const beginSeason = (live: boolean) => {
    if (!draft) return;
    setBusy(true);
    setTimeout(() => {
      let s = createSeason(randomSeed(), config.difficulty, { clubId: config.clubId, name: userName, rating: ratings.ovr, att: ratings.att, def: ratings.def, replacedClubId: config.replacedClubId });
      if (!live) s = simulateRest(s);
      set({ season: s, phase: "season", live });
      if (!live) record(s);
      setBusy(false);
    }, 20);
  };
  const record = (s: SeasonState) => {
    const sum = summarize(s);
    const won = sum.trophies.filter((t) => t.status === "won").map((t) => t.comp);
    addHistory({ game: "football", seed: s.seed, difficulty: s.difficulty, title: sum.quadruple ? "QUADRUPLE" : won.length ? won.join(" + ") : `${sum.plPosition}º PL`, detail: `${userName} · ${draft?.formationId} · OVR ${ratings.ovr}`, score: won.length });
  };
  const advance = (fn: (s: SeasonState) => SeasonState) => {
    if (!season) return;
    setBusy(true);
    setTimeout(() => {
      const n = fn(season);
      set({ season: n });
      if (isSeasonDone(n) && !isSeasonDone(season)) record(n);
      setBusy(false);
    }, 10);
  };

  const onSlotClick = (slotId: string) => {
    if (!draft || session.phase !== "squad") { setInspect(draft?.lineup[slotId] ?? null); return; }
    setInspect(draft.lineup[slotId] ?? null);
    if (selected && selected !== slotId) { const r = swapSlots(draft, selected, slotId); if (r.ok) set({ draft: r.state }); else setError(r.error); setSelected(null); return; }
    setSelected(selected === slotId ? null : slotId);
  };

  const newDraft = () => { remove(KEYS.fbSession); setSession({ phase: "setup", config, draft: null, season: null, live: false }); setSelected(null); setInspect(null); };

  /* ───────── SETUP ───────── */
  if (session.phase === "setup") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <span className="chip border-gold/50 text-gold-2">Game 2</span>
        <h1 className="font-display mt-3 text-5xl leading-none md:text-7xl">FOOTBALL <span className="text-gold">ULTIMATE DRAFT</span></h1>
        <p className="mt-3 text-lg">Build your dream XI. <span className="text-muted">Conquer England and Europe.</span></p>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="panel p-5" data-testid="fb-difficulty">
              <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-[.2em] text-muted">Dificultad</h2>
              <DifficultySelector value={config.difficulty} onChange={(d) => setConfig({ difficulty: d })} accent="gold" />
            </div>
            <div className="panel p-5">
              <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-[.2em] text-muted">Club representado · Temporada 2026/27</h2>
              <select className="w-full rounded-lg border border-line bg-surface px-3 py-2.5" value={config.clubId} onChange={(e) => setConfig({ clubId: e.target.value })} data-testid="fb-club-select" aria-label="Club">
                {PL_CLUBS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value={FANTASY_ID}>★ Fantasy FC (club personalizado)</option>
              </select>
              {config.clubId === FANTASY_ID && (
                <label className="mt-3 block text-sm text-muted">Fantasy FC sustituye en la Premier League a:
                  <select className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2" value={config.replacedClubId} onChange={(e) => setConfig({ replacedClubId: e.target.value })}>
                    {PL_CLUBS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
              <p className="mt-3 text-xs text-muted">Regla fantástica: tu equipo siempre disputa la Champions League. Si su club real no estaría clasificado, ocupa la plaza inglesa más débil. Tu XI sustituye la plantilla real del club elegido.</p>
            </div>
            <div className="panel p-5">
              <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-[.2em] text-muted">Modalidad de draft</h2>
              <div className="grid grid-cols-2 gap-2">
                {([["roulette", "Historical Roulette", "Por cada posición se sortea club + década. Hasta 5 jugadores reales de ese club en esa época."], ["fut", "FUT Draft", "Elige capitán entre 5 estrellas y luego 1 de 5 cartas por posición, de todas las épocas."]] as [DraftMode, string, string][]).map(([k, t, d]) => (
                  <button key={k} onClick={() => setConfig({ mode: k })} data-testid={`fb-mode-${k}`}
                    className={`rounded-xl border p-3 text-left ${config.mode === k ? "border-gold bg-gold/10" : "border-line hover:border-line-strong"}`}>
                    <div className="font-cond font-bold uppercase tracking-wide">{t}</div><div className="mt-1 text-xs text-muted">{d}</div>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">Re-spins (1 de cada por draft): <b>Ruleta</b> → Club conserva década y posición; Época conserva club y posición. <b>FUT</b> → vuelven a sacar las 5 cartas filtradas por un club o una década al azar.</p>
            </div>
          </div>
          <div className="space-y-6">
            <div className="panel p-5">
              <h2 className="mb-3 font-cond text-sm font-bold uppercase tracking-[.2em] text-muted">Formación</h2>
              <div className="grid grid-cols-4 gap-2">
                {FORMATIONS.map((f) => (
                  <button key={f.id} onClick={() => setConfig({ formationId: f.id })} data-testid={`fb-formation-${f.id}`}
                    className={`rounded-xl border p-1.5 ${config.formationId === f.id ? "border-gold" : "border-line hover:border-line-strong"}`}>
                    <FormationPreview formation={f} active={config.formationId === f.id} />
                    <div className="mt-1 font-cond text-sm font-bold">{f.name}</div>
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-gold w-full py-4 text-lg" onClick={start} data-testid="fb-start">Empezar draft</button>
            {session.draft && session.phase === "setup" && null}
            {error && <p role="alert" className="text-sm text-loss">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (!draft) return null;

  /* ───────── SEASON ───────── */
  if (session.phase === "season" && season) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <SeasonView s={season} live={session.live} busy={busy}
          onNextUser={() => advance(stepToNextUserMatch)} onNextEvent={() => advance((s) => stepSeason(s).state)} onSimRest={() => advance(simulateRest)} onNew={newDraft} />
      </div>
    );
  }

  /* ───────── DRAFT / SQUAD ───────── */
  const isSquad = session.phase === "squad";
  const slot = draft.currentSlot ? slotById(draft, draft.currentSlot) : null;
  const needCaptain = draft.mode === "fut" && !draft.captainId;
  const options = draft.options.map((id) => FB_CARD_BY_ID[id]);
  const club = draft.spin ? HIST_CLUB_BY_ID[draft.spin.clubId] : null;
  const reelMs = animMs(settings, 1000);
  const inspected = inspect ? FB_CARD_BY_ID[inspect] : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl">ULTIMATE <span className="text-gold">DRAFT</span></h1>
        <span className="chip text-muted">{draft.mode === "fut" ? "FUT Draft" : "Historical Roulette"}</span>
        <span className="chip text-muted">{draft.formationId}</span>
        <span className="chip text-muted">{config.difficulty}</span>
        <span className="chip text-muted">{userName}</span>
        <span className="chip text-muted">{Object.keys(draft.lineup).length}/11</span>
        <button className="btn btn-ghost btn-sm ml-auto" onClick={newDraft}>Abandonar</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="min-w-0 space-y-5">
          {!isSquad && (
            <>
              {draft.mode === "roulette" && draft.spin && club && slot && (
                <section className="panel p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Reel label="Posición" value={slot.pos} pool={[slot.pos]} durationMs={0} accent="#f3dc94" />
                    <Reel label="Club" value={club.name} pool={CLUB_NAMES} durationMs={reelMs} accent="#d9b45a" testId="fb-reel-club" />
                    <Reel label="Década" value={draft.spin.decade} pool={FB_DECADES} durationMs={reelMs} accent="#d9b45a" testId="fb-reel-era" />
                  </div>
                </section>
              )}
              {draft.mode === "fut" && (
                <section className="panel p-4">
                  <div className="font-cond text-sm font-bold uppercase tracking-[.2em] text-muted">{needCaptain ? "Paso 1 · Elige a tu capitán" : `Elige tu ${slot?.pos} (${slot?.id})`}</div>
                  {draft.filter && <div className="mt-1 text-sm text-gold-2">Filtro activo: {draft.filter.clubId ? HIST_CLUB_BY_ID[draft.filter.clubId].name : draft.filter.decade}</div>}
                </section>
              )}
              {!needCaptain && (
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn btn-sm" disabled={!canRespinClub(draft)} onClick={() => apply(respinClub(draft), false)} data-testid="fb-respin-club">↻ Re-spin club <span className="rounded bg-white/10 px-1.5 font-mono">{draft.respins.club}</span></button>
                  <button className="btn btn-sm" disabled={!canRespinEra(draft)} onClick={() => apply(respinEra(draft), false)} data-testid="fb-respin-era">↻ Re-spin era <span className="rounded bg-white/10 px-1.5 font-mono">{draft.respins.era}</span></button>
                </div>
              )}
              {error && <p role="alert" className="text-sm text-loss">{error}</p>}
              {needCaptain && captainPick ? (
                <div className="panel p-4">
                  <p className="mb-3 text-sm">¿Dónde juega <b>{FB_CARD_BY_ID[captainPick].name}</b>?</p>
                  <div className="flex flex-wrap gap-2">
                    {captainSlots(draft, captainPick).map((sid) => (
                      <button key={sid} className="btn btn-gold btn-sm" onClick={() => { apply(pickCaptain(draft, captainPick, sid)); setCaptainPick(null); }} data-testid={`fb-pick-slot-${sid}`}>{sid}</button>
                    ))}
                    <button className="btn btn-sm btn-ghost" onClick={() => setCaptainPick(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="fb-options">
                  {options.map((c, i) => (
                    <FbCardView key={c.id} card={c} index={i} pickLabel={needCaptain ? "Capitán" : "Elegir"}
                      onPick={() => {
                        if (needCaptain) {
                          const slots = captainSlots(draft, c.id);
                          if (slots.length === 1) apply(pickCaptain(draft, c.id, slots[0])); else setCaptainPick(c.id);
                        } else apply(pickFb(draft, c.id));
                      }} />
                  ))}
                </div>
              )}
            </>
          )}

          {isSquad && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="panel p-5">
                <div className="font-cond text-sm font-bold uppercase tracking-[.2em] text-muted">Once completo</div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="fb-chemistry">
                  {[["TEAM OVR", ratings.ovr], ["ATTACK", ratings.attack], ["MIDFIELD", ratings.midfield], ["DEFENSE", ratings.defense], ["CHEMISTRY", `${chem.total}/33`]].map(([k, v]) => (
                    <div key={k as string} className="rounded-xl bg-white/5 px-3 py-3 text-center">
                      <div className="font-cond text-[11px] font-bold tracking-wider text-muted">{k}</div>
                      <div className="font-display text-3xl tabular">{v}</div>
                    </div>
                  ))}
                </div>
                {ratings.notes.length > 0 && <ul className="mt-3 space-y-1 text-xs text-gold-2">{ratings.notes.map((n) => <li key={n}>· {n}</li>)}</ul>}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <label className="text-sm text-muted">Formación:
                    <select className="ml-2 rounded-lg border border-line bg-surface px-2 py-1 text-text" value={draft.formationId}
                      onChange={(e) => { const r = changeFormation(draft, e.target.value); if (r.ok) set({ draft: r.state }); else setError(r.error); }}>
                      {FORMATIONS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </label>
                  <span className="text-xs text-muted">Toca dos jugadores en el campo para intercambiarlos. Borde rojo = fuera de posición.</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-gold px-6 py-4 text-base" disabled={busy} onClick={() => beginSeason(false)} data-testid="fb-quick-sim">{busy ? "Simulando…" : "Quick sim · temporada completa"}</button>
                <button className="btn px-6 py-4 text-base" disabled={busy} onClick={() => beginSeason(true)} data-testid="fb-live-sim">Live season · jornada a jornada</button>
              </div>
              {inspected && <div className="max-w-xs"><FbCardView card={inspected} /></div>}
            </motion.section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Pitch formation={formation} lineup={lineupCards} chem={chem.perSlot} current={draft.currentSlot} selected={selected} captainId={draft.captainId} onSlotClick={onSlotClick} />
          <div className="panel p-4">
            <div className="mb-2 flex justify-between font-cond text-sm font-bold uppercase"><span>Equipo</span><span className="text-muted">Química {chem.total}/33</span></div>
            <div className="space-y-1">
              <StatBar label="Team OVR" value={ratings.ovr} color="var(--color-gold)" />
              <StatBar label="Ataque" value={ratings.attack} color="var(--color-gold)" />
              <StatBar label="Medio" value={ratings.midfield} color="var(--color-gold)" />
              <StatBar label="Defensa" value={ratings.defense} color="var(--color-gold)" />
              <StatBar label="Portero" value={ratings.gk} color="var(--color-gold)" />
              <StatBar label="Química" value={chem.total} max={33} color="var(--color-win)" />
            </div>
            {selected && draft.lineup[selected] && (
              <p className="mt-2 text-xs text-muted">{FB_CARD_BY_ID[draft.lineup[selected]].name}: {chem.links[selected]?.join(", ") || "sin vínculos"} · ajuste posicional {Math.round(slotFit(FB_CARD_BY_ID[draft.lineup[selected]], slotById(draft, selected).pos) * 100)}%</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
