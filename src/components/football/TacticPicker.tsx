"use client";
import { TACTICS, type TacticId, type TacticPreview } from "@/features/football-simulation/tactics";

const fitLabel = (f: number) => (f >= 0.35 ? { t: "Encaje alto", c: "text-win" } : f <= -0.35 ? { t: "Encaje bajo", c: "text-loss" } : { t: "Encaje medio", c: "text-gold-2" });
const sgn = (x: number) => `${x > 0 ? "+" : ""}${x.toFixed(1)}`;

/** "MI ESTILO DE JUEGO": fixed tactic for the season; numbers come from the match engine (exact probabilities). */
export function TacticPicker({ previews, value, onChange }: { previews: TacticPreview[]; value: TacticId; onChange: (t: TacticId) => void }) {
  const bal = previews.find((p) => p.id === "balanced")!;
  const cur = previews.find((p) => p.id === value) ?? bal;
  const info = TACTICS[cur.id];
  return (
    <section id="fb-tactics" className="panel scroll-mt-20 p-4" data-testid="fb-tactics">
      <h3 className="font-cond text-lg font-bold uppercase tracking-wide">Mi estilo de juego</h3>
      <p className="text-xs text-muted">Se elige antes de empezar y se mantiene toda la temporada (también en Monte Carlo).</p>
      <div role="radiogroup" aria-label="Táctica" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {previews.map((p) => {
          const t = TACTICS[p.id], f = fitLabel(p.fit);
          return (
            <button key={p.id} role="radio" aria-checked={value === p.id} onClick={() => onChange(p.id)} data-testid={`fb-tactic-${p.id}`}
              className={`rounded-xl border p-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${value === p.id ? "border-gold bg-gold/10" : "border-line hover:border-line-strong"}`}>
              <span className="flex items-center gap-1.5 font-cond text-sm font-bold uppercase"><span aria-hidden>{t.icon}</span>{t.name}</span>
              {p.id !== "balanced" && <span className={`block text-[11px] ${f.c}`}>{f.t} ({sgn(p.fit)})</span>}
              <span className="block font-mono text-[11px] text-muted">{p.expPts.toFixed(1)} pts PL</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="fb-tactic-detail">
        <div>
          <div className="font-cond text-base font-bold uppercase">{info.icon} {info.name}</div>
          <p className="text-sm text-muted">{info.summary}</p>
          <ul className="mt-1 space-y-0.5 text-sm">{info.strengths.map((s) => <li key={s} className="text-win">＋ {s}</li>)}{info.risks.map((s) => <li key={s} className="text-loss">－ {s}</li>)}</ul>
          {cur.id !== "balanced" && <p className="mt-1 text-xs text-muted">Encaje con tu plantilla según {info.metric} (atributos estimados): <b className={fitLabel(cur.fit).c}>{fitLabel(cur.fit).t}</b>.</p>}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {[["Ataque vs rival medio", cur.vsAvg.att], ["Defensa vs rival medio", cur.vsAvg.def], ["Ataque vs líder", cur.vsTop.att], ["Defensa vs líder", cur.vsTop.def]].map(([k, v]) => (
            <div key={k as string} className="rounded-lg bg-white/5 p-2"><dt className="text-[11px] text-muted">{k}</dt><dd className={`font-mono text-lg ${(v as number) > 0 ? "text-win" : (v as number) < 0 ? "text-loss" : ""}`}>{sgn(v as number)}</dd></div>
          ))}
          <div className="col-span-2 rounded-lg bg-white/5 p-2"><dt className="text-[11px] text-muted">Puntos esperados en Premier (sin fatiga) · victoria vs rival medio en casa</dt><dd className="font-mono text-lg">{cur.expPts.toFixed(1)} <span className="text-sm text-muted">({sgn(cur.expPts - bal.expPts)} vs Equilibrado)</span> · {Math.round(cur.winVsAvg * 100)}%</dd></div>
        </dl>
      </div>
      <p className="mt-2 text-[11px] text-muted">Cálculo exacto del motor (Poisson con la forma integrada) contra los 20 clubes de la Premier a tu dificultad. La temporada real añade fatiga por calendario: Presión alta desgasta un 45 % más, Bloque bajo un 20 % menos y Posesión un 10 % menos.</p>
    </section>
  );
}
