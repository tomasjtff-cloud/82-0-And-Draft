/** Original, lightweight SVG trophies (no third-party artwork). */
export type TrophyKind = "nba" | "pl" | "ucl" | "fa" | "efl" | "ballon" | "boot" | "glove" | "medal" | "star" | "crown";
const GOLD = ["#fff3c4", "#f3c25a", "#a8741c"], SILVER = ["#ffffff", "#c9d1dc", "#7d8794"];

export function TrophyIcon({ kind, size = 56, locked = false, className = "" }: { kind: TrophyKind; size?: number; locked?: boolean; className?: string }) {
  const id = `g-${kind}`;
  const c = kind === "ucl" || kind === "glove" ? SILVER : GOLD;
  const fill = locked ? "#2a2a2e" : `url(#${id})`;
  const stroke = locked ? "#3a3a40" : c[2];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`${className} ${locked ? "opacity-60" : "drop-shadow-[0_4px_10px_rgba(243,194,90,.35)]"}`} aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c[0]} /><stop offset=".45" stopColor={c[1]} /><stop offset="1" stopColor={c[2]} /></linearGradient></defs>
      <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round">
        {kind === "nba" && <><circle cx="32" cy="14" r="9" /><path d="M23 24h18l-4 22h-10z" /><rect x="22" y="48" width="20" height="8" rx="2" /></>}
        {kind === "pl" && <><path d="M18 10h28v10a14 14 0 0 1-28 0z" /><path d="M14 12h4v8a6 6 0 0 1-4-2zM50 12h-4v8a6 6 0 0 0 4-2z" /><path d="M27 34h10l2 12H25z" /><rect x="20" y="48" width="24" height="8" rx="2" /><path d="M24 9l4-5 4 5 4-5 4 5" fill="none" /></>}
        {kind === "ucl" && <><path d="M20 8h24l-2 18a10 10 0 0 1-20 0z" /><path d="M20 12c-10 0-12 14-2 16M44 12c10 0 12 14 2 16" fill="none" strokeWidth="3" /><path d="M28 36h8l3 10H25z" /><rect x="21" y="48" width="22" height="8" rx="2" /></>}
        {kind === "fa" && <><path d="M22 8h20v6a10 10 0 0 1-20 0z" /><path d="M24 22h16l-3 12H27z" /><path d="M18 12c-6 2-4 10 4 9M46 12c6 2 4 10-4 9" fill="none" strokeWidth="2.5" /><path d="M28 36h8v8h-8z" /><rect x="20" y="46" width="24" height="10" rx="2" /></>}
        {kind === "efl" && <><path d="M18 8h28l-3 16a11 11 0 0 1-22 0z" /><path d="M16 10l-4 8 8 4M48 10l4 8-8 4" fill="none" strokeWidth="2.5" /><path d="M29 34h6v10h-6z" /><path d="M20 46h24l-2 10H22z" /></>}
        {kind === "ballon" && <><circle cx="32" cy="28" r="18" /><path d="M32 14l6 5-2 7h-8l-2-7zM18 30l6-3 4 6-3 6-6-2zM46 30l-6-3-4 6 3 6 6-2z" fill={locked ? "#1f1f23" : "rgba(120,80,10,.35)"} strokeWidth="1" /><rect x="22" y="48" width="20" height="8" rx="2" /></>}
        {kind === "boot" && <><path d="M18 8h10v24c6 0 16 4 20 10v6H14v-8l4-4z" /><path d="M14 52h34v4H14z" /><path d="M20 50v2M28 50v2M36 50v2M44 50v2" fill="none" /></>}
        {kind === "glove" && <><path d="M20 30V14a3 3 0 0 1 6 0v12V10a3 3 0 0 1 6 0v16V12a3 3 0 0 1 6 0v16V18a3 3 0 0 1 6 0v18c0 10-6 16-14 16h-2c-6 0-10-4-12-8l-6-8a3 3 0 0 1 5-4z" /></>}
        {kind === "medal" && <><path d="M22 4h8l4 14h-8zM42 4h-8l-4 14h8z" /><circle cx="32" cy="38" r="16" /><path d="M32 28l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z" fill={locked ? "#1f1f23" : "rgba(120,80,10,.35)"} strokeWidth="1" /></>}
        {kind === "star" && <path d="M32 6l7 16 17 2-13 11 4 17-15-9-15 9 4-17L8 24l17-2z" />}
        {kind === "crown" && <><path d="M10 22l12 10 10-18 10 18 12-10-4 26H14z" /><rect x="14" y="50" width="36" height="6" rx="2" /></>}
      </g>
    </svg>
  );
}
