"use client";
import { useRef, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { KEYS, remove } from "@/lib/storage";
import { applyImport, buildExport, parseImport, PROGRESS_KEY, type ExportFile } from "@/lib/progress/store";
import { T } from "@/lib/i18n";

function download(file: ExportFile, name: string) {
  const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 10);

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<ExportFile | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const r = parseImport(await f.text());
    if (!r.ok) { setMsg({ ok: false, text: r.error }); setPending(null); return; }
    setPending(r.file); setMsg(null);
  };
  const doImport = (mode: "merge" | "replace") => {
    if (!pending) return;
    if (mode === "replace") download(buildExport(), `legends-lab-copia-antes-de-importar-${stamp()}.json`);
    const r = applyImport(pending, mode);
    setMsg({ ok: true, text: `${mode === "merge" ? "Progreso combinado" : "Progreso reemplazado"}: ${r.seasons} temporadas y ${r.achievements} logros guardados.` });
    setPending(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-5xl">{T.nav.settings.toUpperCase()}</h1>
      <div className="panel mt-6 divide-y divide-line">
        <Toggle label="Reducir movimiento" desc="Desactiva ruletas animadas, confeti y transiciones." checked={settings.reducedMotion} onChange={(v) => update({ reducedMotion: v })} />
        <Toggle label="Animaciones rápidas" desc="Acelera ruletas y revelado de resultados." checked={settings.fastAnimations} onChange={(v) => update({ fastAnimations: v })} />
        <div className="p-5">
          <div className="font-cond font-bold uppercase tracking-wide">Idioma</div>
          <p className="text-sm text-muted">Español. Los textos están centralizados para poder añadir otros idiomas más adelante.</p>
        </div>
      </div>

      <section className="panel mt-6 space-y-3 p-5" data-testid="progress-io">
        <h2 className="font-cond text-lg font-bold uppercase tracking-wide">Mi progreso</h2>
        <p className="text-sm text-muted" data-testid="progress-note">Tu progreso se guarda en este navegador. Puedes exportarlo para conservarlo o transferirlo a otro dispositivo. Si borras los datos del navegador, perderás el progreso que no hayas exportado.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-gold btn-sm" onClick={() => { download(buildExport(), `legends-lab-progreso-${stamp()}.json`); setMsg({ ok: true, text: "Archivo de progreso descargado." }); }} data-testid="export-progress">Exportar mi progreso</button>
          <label className="btn btn-sm cursor-pointer">
            Importar mi progreso
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} data-testid="import-file" />
          </label>
        </div>
        {pending && (
          <div className="rounded-xl border border-gold/50 bg-gold/5 p-3 text-sm" role="dialog" aria-label="Confirmar importación" data-testid="import-confirm">
            <p>Archivo válido del {new Date(pending.exportedAt).toLocaleString("es-ES")}: {pending.data.progress.seasons.length} temporadas, {Object.keys(pending.data.progress.achievements).length} logros, {pending.data.history.length} entradas de historial.</p>
            <p className="mt-1 text-xs text-muted">Combinar suma lo que no tengas (sin duplicar temporadas ni logros). Reemplazar descarga antes una copia de seguridad de tu progreso actual.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn btn-gold btn-sm" onClick={() => doImport("merge")} data-testid="import-merge">Combinar</button>
              <button className="btn btn-sm" onClick={() => doImport("replace")} data-testid="import-replace">Reemplazar (con copia)</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPending(null)}>Cancelar</button>
            </div>
          </div>
        )}
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-win" : "text-loss"}`} data-testid="io-msg">{msg.text}</p>}
      </section>

      <section className="panel mt-6 flex flex-wrap items-center gap-2 p-5">
        <button className="btn btn-sm" onClick={() => { remove(KEYS.nbaDraft); remove(KEYS.fbSession); setMsg({ ok: true, text: "Partidas en curso borradas." }); }}>Borrar partidas en curso</button>
        {!confirmWipe ? <button className="btn btn-sm" onClick={() => setConfirmWipe(true)}>Borrar todos los datos locales</button> : (
          <span className="flex flex-wrap items-center gap-2 text-sm">¿Seguro? Se perderán historial, logros y récords.
            <button className="btn btn-sm border-loss text-loss" onClick={() => { Object.values(KEYS).forEach(remove); remove(PROGRESS_KEY); setConfirmWipe(false); setMsg({ ok: true, text: "Todos los datos locales borrados." }); }}>Sí, borrar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmWipe(false)}>Cancelar</button>
          </span>
        )}
      </section>
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
