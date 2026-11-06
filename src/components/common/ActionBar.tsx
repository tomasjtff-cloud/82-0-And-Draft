"use client";
/** Contextual bottom action bar (mobile). Only the actions that apply to the current phase are passed in. */
export interface ActionItem { key: string; label: string; icon: string; onClick: () => void; active?: boolean; disabled?: boolean; primary?: boolean; testId?: string }
export const ACTION_BAR_H = 60;

export function ActionBar({ items, className = "" }: { items: ActionItem[]; className?: string }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Acciones" className={`fixed inset-x-0 bottom-0 z-50 border-t border-line-strong bg-ink/95 backdrop-blur lg:hidden ${className}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }} data-testid="action-bar">
      <ul className="mx-auto flex max-w-xl items-stretch gap-1 px-2 py-1.5" style={{ minHeight: ACTION_BAR_H }}>
        {items.map((a) => (
          <li key={a.key} className="flex-1">
            <button onClick={a.onClick} disabled={a.disabled} aria-pressed={a.active} data-testid={a.testId ?? `act-${a.key}`}
              className={`flex h-full min-h-[48px] w-full flex-col items-center justify-center rounded-xl px-1 font-cond text-[11px] font-bold uppercase tracking-wider transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold disabled:opacity-40
                ${a.primary ? "bg-gold text-black" : a.active ? "bg-white/15 text-text" : "text-muted hover:text-text"}`}>
              <span aria-hidden className="text-lg leading-none">{a.icon}</span>
              <span className="mt-0.5 leading-none">{a.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
