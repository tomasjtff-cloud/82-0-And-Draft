"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoMark } from "./LogoMark";
import { T } from "@/lib/i18n";
import { usePathname } from "next/navigation";
import { MotionConfig } from "motion/react";
import { useSettings } from "@/hooks/useSettings";
import { AchievementToasts } from "./AchievementToasts";

const NAV = [
  { href: "/", label: T.nav.home },
  { href: "/nba", label: T.nav.nba },
  { href: "/football", label: T.nav.football },
  { href: "/legado", label: T.nav.legacy },
  { href: "/logros", label: T.nav.achievements },
  { href: "/history", label: T.nav.history },
  { href: "/settings", label: T.nav.settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <MotionConfig reducedMotion={settings.reducedMotion ? "always" : "user"}>
      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5" style={{ paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}>
            <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Legends Lab inicio" onClick={() => setOpen(false)}>
              <LogoMark size={32} />
              <span className="font-display whitespace-nowrap text-lg tracking-wide sm:text-xl">LEGENDS<span className="text-nba"> LAB</span></span>
            </Link>
            <nav className="ml-auto hidden gap-1 lg:flex" aria-label="Principal">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-cond text-sm font-semibold uppercase tracking-wider transition-colors ${isActive(n.href) ? "bg-surface-3 text-text" : "text-muted hover:text-text"}`}>
                  {n.label}
                </Link>
              ))}
            </nav>
            <button className="ml-auto flex min-h-[44px] items-center gap-2 rounded-xl border border-line px-3 font-cond text-sm font-bold uppercase tracking-wider lg:hidden"
              onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="mobile-menu" data-testid="menu-button">
              <span aria-hidden className="text-lg leading-none">{open ? "✕" : "☰"}</span>{open ? "Cerrar" : "Menú"}
            </button>
          </div>
          {open && (
            <nav id="mobile-menu" aria-label="Principal" className="border-t border-line bg-ink/95 px-3 pb-3 pt-2 lg:hidden" data-testid="mobile-menu">
              <ul className="grid grid-cols-2 gap-2">
                {NAV.map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} onClick={() => setOpen(false)} aria-current={isActive(n.href) ? "page" : undefined}
                      className={`flex min-h-[48px] items-center rounded-xl px-3 font-cond text-base font-bold uppercase tracking-wider ${isActive(n.href) ? "bg-nba text-black" : "bg-white/5 text-text"}`}>
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </header>
        <main className="flex-1">{children}</main>
        <AchievementToasts />
        <footer className="border-t border-line px-4 py-6 text-center text-xs text-dim">
          Legends Lab · proyecto personal sin fines comerciales · ratings y simulaciones son estimaciones propias, no datos oficiales.
        </footer>
      </div>
    </MotionConfig>
  );
}
