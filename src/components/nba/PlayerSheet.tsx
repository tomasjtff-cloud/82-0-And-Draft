"use client";
import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/components/common/Sheet";
import type { NbaCard, NbaPos } from "@/types/nba";
import { previewPick } from "@/lib/ratings/nba";
import { NbaCardView } from "./NbaCardView";

/** Card detail + optional other seasons + real chemistry preview before confirming the pick. */
export function PlayerSheet({ card, versions, lineup, placeable, alreadyDrafted, fitSensitivity, onPick, onClose }: {
  card: NbaCard | null; versions: NbaCard[]; lineup: Partial<Record<NbaPos, NbaCard>>; placeable: (c: NbaCard) => NbaPos[];
  alreadyDrafted: boolean; fitSensitivity: number; onPick: (c: NbaCard, pos: NbaPos) => void; onClose: () => void;
}) {
  const [versionId, setVersionId] = useState<string | null>(null);
  useEffect(() => setVersionId(card?.id ?? null), [card]);
  const current = versions.find((v) => v.id === versionId) ?? card;
  const positions = current ? placeable(current) : [];
  const [target, setTarget] = useState<NbaPos | null>(null);
  useEffect(() => setTarget(positions[0] ?? null), [current?.id, positions.join()]);
  const preview = useMemo(() => (current && target ? previewPick(lineup, current, target, fitSensitivity) : null), [current, target, lineup, fitSensitivity]);
  return (
    <Sheet open={!!card} onClose={onClose} title={current?.name ?? ""} testId="player-sheet">
      {current && (
        <div className="space-y-4">
          {versions.length > 1 && (
            <div>
              <div className="mb-1 font-cond text-xs font-bold uppercase tracking-wide text-muted">Temporadas en esta franquicia y década</div>
              <div className="flex flex-wrap gap-1.5">
                {versions.map((v) => (
                  <button key={v.id} onClick={() => setVersionId(v.id)} data-testid={`version-${v.id}`} className={`chip ${v.id === current.id ? "border-nba bg-nba/20 text-text" : "text-muted"}`}>
                    {v.season} · {v.ratings.overall}{v.id === card!.id ? " ★" : ""}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-dim">★ = mejor temporada (OVR, luego impacto). Puedes elegir otra; nunca dos versiones del mismo jugador.</p>
            </div>
          )}
          {positions.length > 0 && preview ? (
            <div className="panel p-4" data-testid="pick-preview">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-cond text-sm font-bold uppercase tracking-wide">Vista previa del encaje</span>
                <span className="font-mono text-xs">Net {Object.keys(lineup).length ? preview.before.net : "—"} → <b className={preview.deltaNet >= 0 ? "text-win" : "text-loss"}>{preview.after.net}</b> · Química {preview.before.chemistry} → <b>{preview.after.chemistry}</b></span>
              </div>
              {positions.length > 1 && (
                <div className="mt-2 flex gap-1.5">{positions.map((p) => <button key={p} onClick={() => setTarget(p)} className={`chip ${p === target ? "border-nba bg-nba/20 text-text" : "text-muted"}`}>Como {p}</button>)}</div>
              )}
              <ul className="mt-2 space-y-1 text-sm">
                {preview.messages.map((m, i) => <li key={i} className={m.tone === "good" ? "text-win" : m.tone === "bad" ? "text-loss" : "text-muted"}>{m.tone === "good" ? "▲ " : m.tone === "bad" ? "▼ " : "• "}{m.text}</li>)}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted">{alreadyDrafted ? "Este jugador ya está en tu quinteto." : "Sus posiciones ya están ocupadas."}</p>
          )}
          <NbaCardView card={current} />
          <div className="sticky -bottom-5 z-10 -mx-5 flex flex-wrap gap-2 border-t border-line bg-surface px-5 pb-5 pt-3">
            {positions.map((p) => (
              <button key={p} className="btn btn-nba flex-1 py-3" onClick={() => onPick(current, p)} data-testid={`pick-${current.id}-${p}`}>Elegir · {p}</button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
