"use client";
import { useSettings } from "@/hooks/useSettings";
import { KEYS, remove } from "@/lib/storage";
import { useState } from "react";

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const [msg, setMsg] = useState("");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-5xl">AJUSTES</h1>
      <div className="panel mt-6 divide-y divide-line">
        <Toggle label="Reducir movimiento" desc="Desactiva ruletas animadas, confeti y transiciones." checked={settings.reducedMotion} onChange={(v) => update({ reducedMotion: v })} />
        <Toggle label="Animaciones rápidas" desc="Acelera ruletas y revelado de resultados." checked={settings.fastAnimations} onChange={(v) => update({ fastAnimations: v })} />
        <div className="p-5">
          <div className="font-cond font-bold uppercase tracking-wide">Idioma</div>
          <p className="text-sm text-muted">Español (predeterminado). Inglés: pendiente — ver ROADMAP.md.</p>
        </div>
        <div className="flex flex-wrap gap-2 p-5">
          <button className="btn btn-sm" onClick={() => { remove(KEYS.nbaDraft); remove(KEYS.fbSession); setMsg("Partidas en curso borradas."); }}>Borrar partidas en curso</button>
          <button className="btn btn-sm" onClick={() => { Object.values(KEYS).forEach(remove); setMsg("Todos los datos locales borrados."); }}>Borrar todos los datos locales</button>
          {msg && <span className="self-center text-sm text-win">{msg}</span>}
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 p-5">
      <div><div className="font-cond font-bold uppercase tracking-wide">{label}</div><div className="text-sm text-muted">{desc}</div></div>
      <input type="checkbox" className="h-5 w-5 accent-[#ff6a13]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
