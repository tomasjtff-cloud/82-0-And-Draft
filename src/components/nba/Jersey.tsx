/** Original basketball jersey (tank top) drawn in SVG with the franchise palette. Not an official asset. */
export function Jersey({ primary, secondary, label, size = 64, dim }: { primary: string; secondary: string; label: string; size?: number; dim?: boolean }) {
  const light = isLight(primary);
  return (
    <svg width={size} height={size * 1.08} viewBox="0 0 100 108" aria-hidden className={dim ? "opacity-40" : ""}>
      <path d="M28 4 L40 4 Q50 18 60 4 L72 4 L74 22 Q80 30 88 30 L88 104 L12 104 L12 30 Q20 30 26 22 Z" fill={primary} stroke={secondary} strokeWidth="5" strokeLinejoin="round" />
      <path d="M40 4 Q50 18 60 4" fill="none" stroke={secondary} strokeWidth="5" />
      <rect x="12" y="92" width="76" height="6" fill={secondary} opacity=".85" />
      <text x="50" y="72" textAnchor="middle" fontFamily="Anton, Impact, sans-serif" fontSize="38" fill={light ? "#111" : "#fff"} stroke={secondary} strokeWidth="1.2">{label}</text>
    </svg>
  );
}
function isLight(hex: string): boolean {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}
