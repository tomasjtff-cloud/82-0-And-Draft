"use client";
import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/i18n";
import { motion } from "motion/react";
import type { Difficulty } from "@/lib/core/difficulty";
import { DIFFICULTY_PARAMS } from "@/lib/core/difficulty";
import { randomSeed } from "@/lib/core/rng";
import { FORMATIONS, FORMATION_BY_ID } from "@/lib/data/football/formations";
import { HIST_CLUBS, HIST_CLUB_BY_ID, leagueOf } from "@/lib/data/football/clubs";
import { FANTASY_ID, PL_CLUBS } from "@/lib/data/football/world";
import { slotFit, chemRulesFor, chemistryBreakdown, chemistryEffect, type ChemRules, chemistryLinks, computeChemistry, teamRatings } from "@/lib/ratings/football";
import { addHistory, KEYS, load, remove, save } from "@/lib/storage";
import { animMs, useSettings } from "@/hooks/useSettings";
import type { DraftMode, FbDraftState, FbPlayerSeason } from "@/types/football";
import { FB_DECADES } from "@/types/football";
import {
  FB_CARD_BY_ID, canRespinClub, canRespinEra, captainSlots, changeFormation, createFbDraft, isFbComplete, pickCaptain, pickFb,
  respinClub, respinEra, slotById, swapSlots,
} from "./engine";
import { createSeason, isSeasonDone, plTable, simulateRest, stepSeason, stepToNextUserMatch, summarize, type SeasonState } from "@/features/football-simulation/season";
import { buildFbSnapshot, buildSquad, userTeamInput } from "./squad";
import { recordDraft, recordSeason } from "@/lib/progress/store";
import { fbSeasonRecord } from "@/lib/progress/summarize";
import { tacticPreview, type TacticId } from "@/features/football-simulation/tactics";
import { TacticPicker } from "@/components/football/TacticPicker";
import { DifficultySelector } from "@/components/common/DifficultySelector";
import { Reel } from "@/components/common/Reel";
import { FbCandidateRow, FbCardView } from "@/components/football/FbCardView";
import { FbPlayerSheet } from "@/components/football/FbPlayerSheet";
import { ChemWhy } from "@/components/football/ChemWhy";
import { ActionBar } from "@/components/common/ActionBar";
import { Sheet } from "@/components/common/Sheet";
import { XiButton, XiModal, type XiSource } from "@/components/football/XiModal";
import { ChemLegend, FormationPreview, Pitch } from "@/components/football/Pitch";
import { SeasonView } from "@/components/football/SeasonView";
import { FootballMonteCarloPanel } from "@/components/football/MonteCarloPanel";

type Phase = "setup" | "draft" | "squad" | "season";
interface Config { difficulty: Difficulty; clubId: string; replacedClubId: string; formationId: string; mode: DraftMode; tactic?: TacticId }
interface Session { phase: Phase; config: Config; draft: FbDraftState | null; season: SeasonState | null; live: boolean; /** rules the current season was played with */ rules?: ChemRules }

const DEFAULT_CONFIG: Config = { difficulty: "NORMAL", clubId: "ARS", replacedClubId: "HUL", formationId: "4-3-3", mode: "roulette" };
const CLUB_NAMES = HIST_CLUBS.map((c) => c.name);

export function FootballGame() {
  const { settings } = useSettings();
  const [session, setSession] = useState<Session>({ phase: "setup", config: DEFAULT_CONFIG, draft: null, season: null, live: false });
  const [error, setError] = useState<string | null>(null);
  const [captainPick, setCaptainPick] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusSlot, setFocusSlot] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showXi, setShowXi] = useState(false);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePair, setComparePair] = useState<[string, string] | null>(null);
  const [sortKey, setSortKey] = useState<"ovr" | "chem" | "fit">("ovr");
  const [pitchFull, setPitchFull] = useState(false);
  const [chemMode, setChemMode] = useState(false);
  const [listOpen, setListOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);

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
  const extended = session.phase === "season" && session.season ? !!session.rules?.extended : chemRulesFor(draft?.mode ?? config.mode).extended;
  const breakdown = useMemo(() => chemistryBreakdown(formation, lineupCards, leagueOf, draft?.captainId ?? null, extended), [formation, lineupCards, draft, extended]);
  const chem = useMemo(() => ({ total: breakdown.total, perSlot: Object.fromEntries(Object.values(breakdown.slots).map((x) => [x.slotId, x.effective])) as Record<string, number> }), [breakdown]);
  // During a season keep the rules it was played with; old sessions without them = classic.
  const rules: ChemRules = session.phase === "season" && session.season ? (session.rules ?? { extended: false, weight: 1, version: 1 }) : chemRulesFor(draft?.mode ?? config.mode);
  const chemW = rules.weight;
  const ratings = useMemo(() => teamRatings(formation, lineupCards, chem.total, DIFFICULTY_PARAMS[config.difficulty].fbFitSensitivity, chemW), [formation, lineupCards, chem, config.difficulty, chemW]);
  // progress: a completed XI counts as a completed draft (best chemistry reached is kept)
  const draftDone = session.phase === "squad" && !!session.draft && isFbComplete(session.draft);
  useEffect(() => {
    if (!draftDone || !session.draft) return;
    const d = session.draft;
    recordDraft({ game: "fb", id: d.seed, date: new Date().toISOString(), chem: chem.total, mode: d.mode, nations: new Set(Object.values(d.lineup).map((id) => FB_CARD_BY_ID[id]?.nation)).size });
  }, [draftDone, session.draft, chem.total]);
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
      let s = createSeason(randomSeed(), config.difficulty, userTeamInput(draft.formationId, draft.lineup, draft.captainId, config.difficulty, config.clubId, userName, config.replacedClubId, true, rules, config.tactic ?? "balanced"));
      if (!live) s = simulateRest(s);
      set({ season: s, phase: "season", live, rules });
      if (!live) record(s);
      setBusy(false);
    }, 20);
  };
  const record = (s: SeasonState) => {
    const sum = summarize(s);
    const won = sum.trophies.filter((t) => t.status === "won").map((t) => t.comp);
    const row = plTable(s).find((r) => r.team === s.userId)!;
    addHistory({ game: "football", seed: s.seed, difficulty: s.difficulty, title: sum.quadruple ? "QUADRUPLE" : won.length ? won.join(" + ") : `${sum.plPosition}º PL`, detail: `${userName} · ${draft?.formationId} · OVR ${ratings.ovr}`, score: won.length,
      ...(draft ? { football: buildFbSnapshot(draft, s.seed, config.clubId, userName, config.replacedClubId, { plPos: row.pos!, pts: row.pts, trophies: won }, session.rules ?? rules, s.tactic?.id ?? "balanced") } : {}) });
    if (draft) recordSeason(fbSeasonRecord(s, draft, { teamName: userName, ovr: ratings.ovr, chem: chem.total }));
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
    setFocusSlot(draft?.lineup[slotId] ? slotId : null);
    if (!draft || session.phase !== "squad") return;
    if (selected && selected !== slotId) { const r = swapSlots(draft, selected, slotId); if (r.ok) set({ draft: r.state }); else setError(r.error); setSelected(null); return; }
    setSelected(selected === slotId ? null : slotId);
  };

  const newDraft = () => { remove(KEYS.fbSession); setSession({ phase: "setup", config, draft: null, season: null, live: false }); setSelected(null); };

  /* ───────── SETUP ───────── */
  if (session.phase === "setup") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <span className="chip border-gold/50 text-gold-2">{T.games.game2}</span>
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
              <p className="mt-3 text-xs text-muted">Volver a girar (1 de cada por draft): <b>Ruleta</b> → Club conserva década y posición; Época conserva club y posición. <b>FUT</b> → vuelven a sacar las 5 cartas filtradas por un club o una década al azar.</p>
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

  const xi: XiSource = { formationId: draft.formationId, lineup: draft.lineup, captainId: draft.captainId, difficulty: config.difficulty, title: userName, rules };
  const sens = DIFFICULTY_PARAMS[config.difficulty].fbFitSensitivity;
  const links = chemistryLinks(formation, lineupCards, leagueOf, rules.extended);
  const tacticPreviews = session.phase === "squad" ? tacticPreview({ rating: ratings.ovr, att: ratings.att, def: ratings.def }, buildSquad(draft.formationId, draft.lineup, draft.captainId, rules.extended), config.difficulty) : [];
  const mcUser = userTeamInput(draft.formationId, draft.lineup, draft.captainId, config.difficulty, config.clubId, userName, config.replacedClubId, false, rules, config.tactic ?? "balanced");
  const xiModal = <XiModal open={showXi} onClose={() => setShowXi(false)} xi={Object.keys(draft.lineup).length ? xi : null} />;

  /* ───────── SEASON ───────── */
  if (session.phase === "season" && season) {
    const done = isSeasonDone(season);
    const row = plTable(season).find((r) => r.team === season.userId);
    const sum = done ? summarize(season) : null;
    const actual = done && row && sum ? { plPos: row.pos!, pts: row.pts, won: { PL: sum.trophies[0].status === "won", UCL: sum.trophies[1].status === "won", FA: sum.trophies[2].status === "won", EFL: sum.trophies[3].status === "won" } } : null;
    return (
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
        <SeasonView s={season} live={session.live} busy={busy} xi={xi} headerExtra={<XiButton onClick={() => setShowXi(true)} />}
          mcSlot={<FootballMonteCarloPanel user={mcUser} difficulty={config.difficulty} actual={actual} teamLabel={userName} />}
          onNextUser={() => advance(stepToNextUserMatch)} onNextEvent={() => advance((s) => stepSeason(s).state)} onSimRest={() => advance(simulateRest)} onNew={newDraft} />
        {xiModal}
      </div>
    );
  }

  /* ───────── DRAFT / SQUAD (mobile-first) ───────── */
  const isSquad = session.phase === "squad";
  const slot = draft.currentSlot ? slotById(draft, draft.currentSlot) : null;
  const needCaptain = draft.mode === "fut" && !draft.captainId;
  const options = draft.options.map((id) => FB_CARD_BY_ID[id]);
  const club = draft.spin ? HIST_CLUB_BY_ID[draft.spin.clubId] : null;
  const reelMs = animMs(settings, 1000);
  const spinKey = draft.mode === "roulette" && draft.spin ? `${draft.currentSlot}:${draft.spin.clubId}:${draft.spin.decade}` : null;
  const needSpin = !!spinKey && revealed !== spinKey && !isSquad;
  const filled = Object.keys(draft.lineup).length;
  const previewSlot = needCaptain ? (openCard ? captainSlots(draft, openCard)[0] ?? null : null) : draft.currentSlot;
  const chemOf = (c: FbPlayerSeason) => (previewSlot ? computeChemistry(formation, { ...lineupCards, [previewSlot]: c }, leagueOf, draft.captainId, rules.extended).perSlot[previewSlot] ?? 0 : undefined);
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const slotPos = previewSlot ? formation.slots.find((x) => x.id === previewSlot)?.pos : undefined;
  const shownOptions = options.filter((c) => !query.trim() || norm(c.name).includes(norm(query.trim())))
    .map((c) => ({ c, chem: chemOf(c) ?? 0, fit: slotPos ? slotFit(c, slotPos) : 1 }))
    .sort((a, b) => (sortKey === "chem" ? b.chem - a.chem : sortKey === "fit" ? b.fit - a.fit : 0) || b.c.ovr - a.c.ovr).map((x) => x.c);
  const onRowOpen = (id: string) => {
    if (!compareMode) { setOpenCard(id); return; }
    if (!compareId || compareId === id) { setCompareId(compareId === id ? null : id); return; }
    setComparePair([compareId, id]); setOpenCard(compareId);
  };
  const onPickCard = (c: FbPlayerSeason) => {
    setOpenCard(null); setCompareId(null); setComparePair(null); setCompareMode(false); setQuery("");
    if (needCaptain) { const slots = captainSlots(draft, c.id); if (slots.length === 1) apply(pickCaptain(draft, c.id, slots[0])); else setCaptainPick(c.id); }
    else apply(pickFb(draft, c.id));
  };

  return (
    <div className="mx-auto max-w-7xl px-3 pt-3 sm:px-4 lg:pb-8" style={{ paddingBottom: isSquad ? "calc(84px + env(safe-area-inset-bottom))" : "calc(44dvh + 64px)" }}>
      <div className="lg:grid lg:grid-cols-[1fr_420px] lg:gap-6">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-gold px-2.5 py-1 font-display text-lg leading-none text-black" data-testid="fb-progress">{isSquad ? "XI COMPLETO" : needCaptain ? "CAPITÁN" : `${slot?.pos ?? ""} · ${filled + 1}/11`}</span>
            <div className="hidden gap-0.5 sm:flex" aria-hidden>{Array.from({ length: 11 }, (_, i) => <span key={i} className={`h-1.5 w-3 rounded-full ${i < filled ? "bg-gold" : "bg-white/10"}`} />)}</div>
            <span className="min-w-0 flex-1 truncate text-right font-cond text-xs font-bold uppercase text-muted">{draft.mode === "fut" ? "FUT Draft" : "Historical Roulette"} · {draft.formationId} · {userName}</span>
            <XiButton onClick={() => setShowXi(true)} disabled={!filled} />
          </div>

          {!isSquad && draft.mode === "roulette" && draft.spin && club && slot && (
            <section className="panel p-3">
              <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
                <Reel label="Posición" value={slot.pos} pool={[slot.pos]} durationMs={0} accent="#f3dc94" />
                <Reel label="Club" value={needSpin ? "?" : club.name} pool={needSpin ? ["?"] : CLUB_NAMES} durationMs={needSpin ? 0 : reelMs} accent="#d9b45a" testId="fb-reel-club" />
                <Reel label="Década" value={needSpin ? "?" : draft.spin.decade} pool={needSpin ? ["?"] : FB_DECADES} durationMs={needSpin ? 0 : reelMs} accent="#d9b45a" testId="fb-reel-era" />
              </div>
              {needSpin ? <button className="btn btn-gold mt-3 w-full py-4 text-xl" onClick={() => setRevealed(spinKey)} data-testid="fb-spin-btn">🎰 GIRAR</button> : (
                <div className="mt-2 flex gap-2">
                  <button className="btn btn-sm flex-1" disabled={!canRespinClub(draft)} onClick={() => { apply(respinClub(draft), false); setRevealed(null); }} data-testid="fb-respin-club">↻ Club <span className="rounded bg-white/10 px-1.5 font-mono">{draft.respins.club}</span></button>
                  <button className="btn btn-sm flex-1" disabled={!canRespinEra(draft)} onClick={() => { apply(respinEra(draft), false); setRevealed(null); }} data-testid="fb-respin-era">↻ Época <span className="rounded bg-white/10 px-1.5 font-mono">{draft.respins.era}</span></button>
                </div>
              )}
            </section>
          )}
          {!isSquad && draft.mode === "fut" && (
            <section className="panel p-3">
              <div className="font-cond text-sm font-bold uppercase tracking-[.15em]">{needCaptain ? "Elige a tu capitán entre 5 estrellas" : `5 cartas para ${slot?.pos} (${slot?.id})`}</div>
              {draft.filter && <div className="mt-1 text-xs text-gold-2">Filtro activo: {draft.filter.clubId ? HIST_CLUB_BY_ID[draft.filter.clubId].name : draft.filter.decade}</div>}
              {!needCaptain && (
                <div className="mt-2 flex gap-2">
                  <button className="btn btn-sm flex-1" disabled={!canRespinClub(draft)} onClick={() => apply(respinClub(draft), false)} data-testid="fb-respin-club">↻ Filtro club <span className="rounded bg-white/10 px-1.5 font-mono">{draft.respins.club}</span></button>
                  <button className="btn btn-sm flex-1" disabled={!canRespinEra(draft)} onClick={() => apply(respinEra(draft), false)} data-testid="fb-respin-era">↻ Filtro época <span className="rounded bg-white/10 px-1.5 font-mono">{draft.respins.era}</span></button>
                </div>
              )}
            </section>
          )}
          {error && <p role="alert" className="text-sm text-loss">{error}</p>}
          {captainPick && (
            <div className="panel p-3">
              <p className="mb-2 text-sm">¿Dónde juega <b>{FB_CARD_BY_ID[captainPick].name}</b>?</p>
              <div className="flex flex-wrap gap-2">
                {captainSlots(draft, captainPick).map((sid) => <button key={sid} className="btn btn-gold btn-sm" onClick={() => { apply(pickCaptain(draft, captainPick, sid)); setCaptainPick(null); }} data-testid={`fb-pick-slot-${sid}`}>{sid}</button>)}
                <button className="btn btn-sm btn-ghost" onClick={() => setCaptainPick(null)}>Cancelar</button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="chip font-mono" data-testid="fb-formation-chip">{draft.formationId}</span>
            <span className="chip font-mono" title="Media del equipo">Media {ratings.ovr || "—"}</span>
            <button className={`btn btn-sm ${chemMode ? "border-win text-win" : ""}`} onClick={() => setChemMode((v) => !v)} aria-pressed={chemMode} data-testid="fb-chem-mode">⚗ Química {chem.total}/33</button>
            <button className="btn btn-sm btn-ghost ml-auto" onClick={() => setPitchFull((v) => !v)} aria-pressed={pitchFull} data-testid="fb-pitch-toggle">{pitchFull ? "⤡ Compacto" : "⤢ Completo"}</button>
            {chemMode && <ChemLegend extended={rules.extended} />}
          </div>
          <div className={`mx-auto w-full lg:max-w-none ${pitchFull ? "max-w-md" : "max-w-[310px] sm:max-w-md"}`}>
            <Pitch compact={!pitchFull} formation={formation} lineup={lineupCards} chem={chem.perSlot} current={isSquad ? null : draft.currentSlot} selected={selected} captainId={draft.captainId} onSlotClick={onSlotClick} chemMode={chemMode} links={links} focus={chemMode ? (selected ?? focusSlot) : null} />
          </div>
          {focusSlot && draft.lineup[focusSlot] && breakdown.slots[focusSlot] && (
            <div className="panel flex items-center gap-3 p-3" data-testid="chem-focus">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-cond text-base font-bold uppercase">{FB_CARD_BY_ID[draft.lineup[focusSlot]].name}</span>
                <span className="block text-xs text-muted">Química individual <b className="font-mono text-text">{breakdown.slots[focusSlot].effective}/3</b> · {breakdown.slots[focusSlot].why.join(" · ") || "sin vínculos activos"}</span>
              </span>
              <button className="btn btn-sm btn-gold shrink-0" onClick={() => setWhyOpen(true)} data-testid="chem-why-open">¿Por qué?</button>
            </div>
          )}
          {chemMode && <p className="text-xs text-muted">Química {chem.total}/33 → {chemistryEffect(chem.total, sens, chemW) >= 0 ? "+" : ""}{chemistryEffect(chem.total, sens, chemW)} en ataque y defensa del motor{chemW < 1 ? ` (Historical Roulette: también suman continente, idioma y estilo; la química pesa ${Math.round(chemW * 100)} %)` : ""}. Toca un jugador para ver sus vínculos.</p>}

          {isSquad && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="panel p-4">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" data-testid="fb-chemistry">
                  {[[T.team.ovr, ratings.ovr], [T.team.attack, ratings.attack], [T.team.midfield, ratings.midfield], [T.team.defense, ratings.defense], [T.team.chemistry, `${chem.total}/33`]].map(([k, v]) => (
                    <div key={k as string} className="rounded-xl bg-white/5 px-2 py-2 text-center"><div className="font-cond text-[10px] font-bold tracking-wider text-muted">{k}</div><div className="font-display text-2xl tabular">{v}</div></div>
                  ))}
                </div>
                {ratings.notes.length > 0 && <ul className="mt-2 space-y-1 text-xs text-gold-2">{ratings.notes.map((n) => <li key={n}>· {n}</li>)}</ul>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="text-sm text-muted">Formación:
                    <select className="ml-2 rounded-lg border border-line bg-surface px-2 py-1 text-base text-text" value={draft.formationId}
                      onChange={(e) => { const r = changeFormation(draft, e.target.value); if (r.ok) set({ draft: r.state }); else setError(r.error); }}>
                      {FORMATIONS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </label>
                  <span className="text-xs text-muted">Toca dos jugadores para intercambiarlos. Borde rojo = fuera de posición.</span>
                </div>
              </div>
              <TacticPicker previews={tacticPreviews} value={config.tactic ?? "balanced"} onChange={(t) => setConfig({ tactic: t })} />
              <div className="grid gap-2 sm:grid-cols-2">
                <button className="btn btn-gold py-4 text-base" disabled={busy} onClick={() => beginSeason(false)} data-testid="fb-quick-sim">{busy ? T.sim.simulating : T.sim.quickLong}</button>
                <button className="btn py-4 text-base" disabled={busy} onClick={() => beginSeason(true)} data-testid="fb-live-sim">{T.sim.liveLong}</button>
              </div>
              <FootballMonteCarloPanel user={mcUser} difficulty={config.difficulty} teamLabel={userName} />

            </motion.section>
          )}
          <button className="btn btn-ghost btn-sm" onClick={newDraft}>Abandonar draft</button>
        </div>

        {!isSquad && !needSpin && !captainPick && (
          <aside className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-40 flex max-h-[42dvh] flex-col lg:bottom-auto rounded-t-3xl border-t border-line-strong bg-surface/95 shadow-[0_-12px_40px_rgba(0,0,0,.6)] backdrop-blur lg:static lg:z-auto lg:max-h-none lg:rounded-2xl lg:border lg:bg-surface lg:shadow-none"
            data-testid="fb-drawer">
            <button className="flex items-center justify-between gap-2 px-4 pb-2 pt-3 text-left lg:pointer-events-none" onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen}>
              <span className="min-w-0">
                <span className="mx-auto mb-1 block h-1 w-10 rounded-full bg-white/20 lg:hidden" />
                <span className="block truncate font-cond text-sm font-bold uppercase tracking-wide">{needCaptain ? "Candidatos a capitán" : draft.mode === "roulette" && club ? `${club.name} · ${draft.spin!.decade} · ${slot?.pos}` : `Cartas para ${slot?.pos}`}</span>
                <span className="block text-[11px] text-muted">{compareMode ? (compareId ? "Elige el segundo jugador para comparar" : "Modo comparar: elige dos jugadores") : `${options.length} carta${options.length === 1 ? "" : "s"} · toca para ver ficha, química e impacto`}</span>
              </span>
              <span className="text-muted lg:hidden">{listOpen ? "▼" : "▲"}</span>
            </button>
            {listOpen && (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 scrollbar-thin">
                <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-1.5 bg-surface/95 px-1 pb-2">
                  {options.length > 3 && <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar jugador…" enterKeyHint="search" type="search" aria-label="Buscar jugador" className="min-w-0 flex-1 basis-40 rounded-lg border border-line bg-ink px-3 py-2 text-base" data-testid="fb-search" />}
                  <div role="group" aria-label="Ordenar" className="flex gap-1">
                    {([["ovr", "OVR"], ["chem", "Química"], ["fit", "Encaje"]] as const).map(([k, l]) => <button key={k} onClick={() => setSortKey(k)} aria-pressed={sortKey === k} className={`chip min-h-[36px] ${sortKey === k ? "border-gold bg-gold/15 text-text" : "text-muted"}`} data-testid={`fb-sort-${k}`}>{l}</button>)}
                  </div>
                  <button onClick={() => { setCompareMode((v) => !v); setCompareId(null); }} aria-pressed={compareMode} className={`chip min-h-[36px] ${compareMode ? "border-gold bg-gold/15 text-text" : "text-muted"}`} data-testid="fb-compare-mode">⇄ Comparar jugadores</button>
                </div>
                <div className="divide-y divide-line" data-testid="fb-options">
                  {shownOptions.map((c) => (
                    <FbCandidateRow key={c.id} card={c} ownChem={chemOf(c)} onOpen={() => onRowOpen(c.id)} comparing={compareId === c.id}
                      onCompare={() => setCompareId(compareId === c.id ? null : c.id)} />
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
      <FbPlayerSheet card={openCard ? FB_CARD_BY_ID[openCard] : null}
        compareWith={comparePair ? FB_CARD_BY_ID[comparePair[1]] : compareId && compareId !== openCard ? FB_CARD_BY_ID[compareId] : null}
        formation={formation} lineup={lineupCards} slotId={previewSlot} captainId={needCaptain ? openCard : draft.captainId} difficulty={config.difficulty} rules={rules}
        pickLabel={needCaptain ? "Capitán" : "Elegir"} onPick={onPickCard} onClose={() => { setOpenCard(null); setComparePair(null); }} />
      <Sheet open={whyOpen && !!focusSlot && !!breakdown.slots[focusSlot ?? ""]} onClose={() => setWhyOpen(false)} title="¿Por qué tengo esta química?" testId="chem-why-sheet">
        {focusSlot && breakdown.slots[focusSlot] && draft.lineup[focusSlot] && (
          <div className="space-y-4">
            <ChemWhy s={breakdown.slots[focusSlot]} card={FB_CARD_BY_ID[draft.lineup[focusSlot]]} lineup={lineupCards} />
            <div className="mx-auto max-w-xs"><FbCardView card={FB_CARD_BY_ID[draft.lineup[focusSlot]]} /></div>
          </div>
        )}
      </Sheet>
      {xiModal}
      <ActionBar items={isSquad ? [
        { key: "xi", label: "Mi XI", icon: "⚽", onClick: () => setShowXi(true) },
        { key: "chem", label: "Química", icon: "⚗", onClick: () => setChemMode((v) => !v), active: chemMode },
        { key: "tactic", label: "Táctica", icon: "♟", onClick: () => document.getElementById("fb-tactics")?.scrollIntoView({ behavior: settings.reducedMotion ? "auto" : "smooth", block: "start" }) },
        { key: "live", label: "En vivo", icon: "▶", onClick: () => beginSeason(true), disabled: busy },
        { key: "sim", label: "Simular", icon: "⏩", onClick: () => beginSeason(false), disabled: busy, primary: true },
      ] : [
        { key: "xi", label: "Mi XI", icon: "⚽", onClick: () => setShowXi(true), disabled: !filled },
        { key: "chem", label: "Química", icon: "⚗", onClick: () => setChemMode((v) => !v), active: chemMode },
        { key: "compare", label: "Comparar", icon: "⇄", onClick: () => { setCompareMode((v) => !v); setCompareId(null); setListOpen(true); }, active: compareMode, disabled: needSpin || !!captainPick },
        { key: "list", label: listOpen ? "Ocultar" : "Opciones", icon: listOpen ? "▾" : "▴", onClick: () => setListOpen((v) => !v), disabled: needSpin || !!captainPick },
      ]} />
    </div>
  );
}
