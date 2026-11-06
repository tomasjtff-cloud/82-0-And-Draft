"use client";
import { useEffect, useState } from "react";
import { KEYS, load, save, type HistoryEntry } from "@/lib/storage";
import { QuintetModal } from "@/components/nba/QuintetModal";
import type { NbaTeamSnapshot } from "@/types/nba";
import { useRouter } from "next/navigation";
import { XiModal, xiFromSnapshot, type XiSource } from "@/components/football/XiModal";
import { rebuildFromSnapshot, snapshotIsComplete, type FbSquadSnapshot } from "@/features/football-draft/squad";

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "nba" | "football">("all");
  const [snap, setSnap] = useState<NbaTeamSnapshot | null>(null);
  const [xi, setXi] = useState<XiSource | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const reopen = (fs: FbSquadSnapshot) => {
    const r = rebuildFromSnapshot(fs);
    if (!r) { setMsg("No se puede reconstruir esta temporada: faltan datos del XI."); return; }
    save(KEYS.fbSession, { phase: "season", config: { difficulty: fs.difficulty, clubId: fs.clubId, replacedClubId: fs.replacedClubId ?? "HUL", formationId: fs.formationId, mode: fs.mode }, draft: r.draft, season: r.season, live: false });
    router.push("/football");
  };
  useEffect(() => setItems(load<HistoryEntry[]>(KEYS.history, [])), []);
  const shown = items.filter((i) => filter === "all" || i.game === filter);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-5xl">HISTORIAL</h1>
      <p className="mt-1 text-sm text-muted">Guardado localmente en este navegador (últimas 200 partidas).</p>
      <div className="mt-6 flex gap-2">
        {(["all", "nba", "football"] as const).map((f) => (
          <button key={f} className={`btn btn-sm ${filter === f ? "" : "btn-ghost"}`} onClick={() => setFilter(f)}>{f === "all" ? "Todo" : f === "nba" ? "NBA" : "Fútbol"}</button>
        ))}
        {items.length > 0 && <button className="btn btn-sm btn-ghost ml-auto" onClick={() => { save(KEYS.history, []); setItems([]); }}>Borrar historial</button>}
      </div>
      <div className="panel mt-4 divide-y divide-line">
        {shown.length === 0 && <p className="p-6 text-sm text-muted">Sin partidas todavía.</p>}
        {shown.map((h) => (
          <div key={h.id} className="grid grid-cols-[auto_1fr] items-center gap-3 p-4 sm:grid-cols-[auto_1fr_auto]" data-testid="history-row">
            <span className={`chip ${h.game === "nba" ? "text-nba-2" : "text-gold-2"}`}>{h.game === "nba" ? "NBA" : "FÚTBOL"}</span>
            <div className="min-w-0">
              <div className="font-display text-2xl tabular">{h.title}</div>
              <div className="truncate text-xs text-muted">{h.detail}</div>
            </div>
            <div className="col-span-2 text-right text-xs text-muted sm:col-span-1">
              <div>{new Date(h.date).toLocaleString("es-ES")}</div>
              <div>{h.difficulty} · <span className="font-mono">{h.seed}</span></div>
              {h.nba && <button className="btn btn-sm mt-1" onClick={() => setSnap(h.nba!)} data-testid="history-quintet">Ver quinteto</button>}
              {h.game === "football" && (snapshotIsComplete(h.football) ? (
                <div className="mt-1 flex flex-wrap justify-end gap-1">
                  <button className="btn btn-sm" onClick={() => setXi(xiFromSnapshot(h.football!))} data-testid="history-xi">Ver XI</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => reopen(h.football!)} data-testid="history-reopen">Abrir temporada</button>
                </div>
              ) : <div className="mt-1 max-w-[14rem] text-[11px] text-muted" data-testid="history-no-xi">Partida antigua: sin datos del XI guardados.</div>)}
            </div>
          </div>
        ))}
      </div>
      {msg && <p role="alert" className="mt-3 text-sm text-loss">{msg}</p>}
      <XiModal open={!!xi} onClose={() => setXi(null)} xi={xi} />
      <QuintetModal open={!!snap} onClose={() => setSnap(null)} snap={snap} />
    </div>
  );
}
