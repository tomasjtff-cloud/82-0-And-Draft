"use client";
import Link from "next/link";
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
  return (
    <MotionConfig reducedMotion={settings.reducedMotion ? "always" : "user"}>
      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
            <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Legends Lab inicio">
              <Logo />
              <span className="font-display whitespace-nowrap text-lg tracking-wide sm:text-xl">LEGENDS<span className="text-nba"> LAB</span></span>
            </Link>
            <nav className="ml-auto flex gap-1 overflow-x-auto scrollbar-thin" aria-label="Principal">
              {NAV.map((n) => {
                const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
                return (
                  <Link key={n.href} href={n.href}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-cond text-sm font-semibold uppercase tracking-wider transition-colors ${active ? "bg-surface-3 text-text" : "text-muted hover:text-text"}`}>
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </div>
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

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#ffb347" /><stop offset="1" stopColor="#ff6a13" /></linearGradient>
      </defs>
      <path d="M16 2 29 9v14L16 30 3 23V9z" fill="url(#lg)" />
      <path d="M10 10v12h7M19 10v12h4" stroke="#140700" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
