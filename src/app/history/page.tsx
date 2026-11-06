"use client";
import { useEffect, useState } from "react";
import { KEYS, load, save, type HistoryEntry } from "@/lib/storage";

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "nba" | "football">("all");
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
          <div key={h.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 p-4" data-testid="history-row">
            <span className={`chip ${h.game === "nba" ? "text-nba-2" : "text-gold-2"}`}>{h.game === "nba" ? "NBA" : "FÚTBOL"}</span>
            <div className="min-w-0">
              <div className="font-display text-2xl tabular">{h.title}</div>
              <div className="truncate text-xs text-muted">{h.detail}</div>
            </div>
            <div className="text-right text-xs text-muted">
              <div>{new Date(h.date).toLocaleString("es-ES")}</div>
              <div>{h.difficulty} · <span className="font-mono">{h.seed}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
