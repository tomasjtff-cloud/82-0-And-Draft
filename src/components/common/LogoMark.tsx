/** Legends Lab "LL" monogram (same geometry as public/brand/legends-lab-mark.svg, the master vector). */
export function LogoMark({ size = 30, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} role="img" aria-label="Legends Lab">
      <defs>
        <linearGradient id="llm-o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffc463" /><stop offset=".55" stopColor="#ff7a1a" /><stop offset="1" stopColor="#e2470a" /></linearGradient>
        <linearGradient id="llm-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#14161c" /><stop offset="1" stopColor="#06070a" /></linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#llm-bg)" />
      <rect x="10" y="10" width="492" height="492" rx="104" fill="none" stroke="#ff7a1a" strokeOpacity=".35" strokeWidth="6" />
      <g transform="translate(256 256) skewX(-12) translate(-246 -256)">
        <path d="M118 104h82v214h96v74H118z" fill="url(#llm-o)" />
        <path d="M252 150h70v170h96v66H252z" fill="#ffffff" stroke="#08090c" strokeWidth="16" paintOrder="stroke" strokeLinejoin="miter" />
        <path d="M118 104h82v12h-82z" fill="#fff" opacity=".25" />
        <path d="M70 150h34v16H70zM56 196h48v16H56zM78 242h26v16H78z" fill="url(#llm-o)" opacity=".9" />
        <path d="M118 392h300v14H118z" fill="url(#llm-o)" opacity=".55" />
      </g>
    </svg>
  );
}
