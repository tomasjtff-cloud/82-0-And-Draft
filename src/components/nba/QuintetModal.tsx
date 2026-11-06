"use client";
import { Sheet } from "@/components/common/Sheet";
import type { NbaTeamSnapshot } from "@/types/nba";
import { NBA_POSITIONS } from "@/types/nba";
import { tierOf } from "./NbaCardView";

export function QuintetButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return <button className="btn btn-sm" onClick={onClick} disabled={disabled} data-testid="view-quintet">👕 <span className="sm:hidden">Quinteto</span><span className="hidden sm:inline">Ver mi quinteto</span></button>;
}

/** "VER MI QUINTETO": works from a live draft, results or a saved history snapshot. */
export function QuintetModal({ open, onClose, snap, children }: { open: boolean; onClose: () => void; snap: NbaTeamSnapshot | null; children?: React.ReactNode }) {
  return (
    <Sheet open={open} onClose={onClose} title="Mi quinteto" testId="quintet-modal">
      {!snap ? <p className="text-sm text-muted">Aún no has elegido jugadores.</p> : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["OVR equipo", snap.teamOvr], ["Química", snap.chemistry], ["Net", `${snap.net > 0 ? "+" : ""}${snap.net}`]].map(([k, v]) => (
              <div key={k as string} className="rounded-xl bg-white/5 py-2"><div className="font-cond text-[11px] font-bold uppercase text-muted">{k}</div><div className="font-display text-3xl tabular">{v}</div></div>
            ))}
          </div>
          <ul className="divide-y divide-line">
            {NBA_POSITIONS.map((pos) => {
              const p = snap.players.find((x) => x.pos === pos);
              return (
                <li key={pos} className="flex items-center gap-3 py-2" data-testid="quintet-row">
                  <span className="w-8 font-display text-lg text-nba">{pos}</span>
                  {p ? (
                    <>
                      <div className="min-w-0 flex-1"><div className="truncate font-cond text-base font-bold uppercase">{p.name}</div><div className="truncate text-xs text-muted">{p.teamName} · {p.season}</div></div>
                      <div className="text-right"><div className={`font-display text-2xl leading-none ${tierOf(p.ovr).text}`}>{p.ovr}</div><div className="font-cond text-[10px] font-bold text-muted">{tierOf(p.ovr).name}</div></div>
                    </>
                  ) : <span className="text-sm text-muted">Vacío</span>}
                </li>
              );
            })}
          </ul>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div><span className="font-cond font-bold uppercase text-win">Fortalezas: </span><span className="text-muted">{snap.strengths.join(", ") || "—"}</span></div>
            <div><span className="font-cond font-bold uppercase text-loss">Debilidades: </span><span className="text-muted">{snap.weaknesses.join(", ") || "—"}</span></div>
          </div>
          {snap.record && <p className="text-sm">Temporada: <b>{snap.record.wins}-{snap.record.losses}</b>{snap.playoff ? ` · ${snap.playoff}` : ""}</p>}
          <p className="text-[11px] text-dim">Dificultad {snap.difficulty} · semilla de temporada <span className="font-mono">{snap.seed}</span></p>
          {children}
        </div>
      )}
    </Sheet>
  );
}
