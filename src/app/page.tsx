import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:py-16">
      <section className="mb-10 md:mb-14">
        <p className="chip text-muted">Proyecto personal · 2 juegos · simulación probabilística</p>
        <h1 className="font-display mt-4 text-5xl leading-[0.95] md:text-7xl">
          CONSTRUYE LEYENDAS.<br /><span className="text-muted">DESCUBRE SI SON INMORTALES.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted">
          Drafts históricos con jugadores reales por temporada, un motor de simulación con semillas reproducibles
          y temporadas completas. Sin registro, sin servicios de pago.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Link href="/nba" data-testid="enter-nba"
          className="group relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-nba-deep via-surface to-ink p-7 transition-transform hover:-translate-y-1 md:p-9">
          <CourtArt />
          <div className="relative">
            <span className="chip border-nba/50 text-nba-2">Game 1</span>
            <h2 className="font-display mt-4 text-5xl md:text-6xl">NBA <span className="text-nba">82-0</span></h2>
            <p className="mt-2 text-lg font-semibold">Build your legendary starting five.</p>
            <p className="text-muted">Can you go undefeated?</p>
            <ul className="mt-6 space-y-1 text-sm text-muted">
              <li>· 5 rondas: franquicia + década al azar</li>
              <li>· 1 re-spin de equipo y 1 de época</li>
              <li>· 82 partidos simulados uno a uno</li>
            </ul>
            <span className="btn btn-nba mt-7">Jugar ahora →</span>
          </div>
        </Link>

        <Link href="/football" data-testid="enter-football"
          className="group relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-pitch via-surface to-ink p-7 transition-transform hover:-translate-y-1 md:p-9">
          <PitchArt />
          <div className="relative">
            <span className="chip border-gold/50 text-gold-2">Game 2</span>
            <h2 className="font-display mt-4 text-5xl md:text-6xl">FOOTBALL <span className="text-gold">ULTIMATE DRAFT</span></h2>
            <p className="mt-2 text-lg font-semibold">Build your dream XI.</p>
            <p className="text-muted">Conquer England and Europe.</p>
            <ul className="mt-6 space-y-1 text-sm text-muted">
              <li>· Historical Roulette o FUT Draft</li>
              <li>· Premier League, Champions, FA Cup y Carabao Cup</li>
              <li>· ¿Llegará el quadruple?</li>
            </ul>
            <span className="btn btn-gold mt-7">Jugar ahora →</span>
          </div>
        </Link>
      </div>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          ["Datos con trazabilidad", "Cada carta indica temporada, fuente y qué atributos son estimados."],
          ["Semillas reproducibles", "Misma semilla + mismo equipo = mismo resultado. Repite o compara."],
          ["Sin resultados fijos", "Nada está precalculado: cada partido es un sorteo probabilístico."],
        ].map(([t, d]) => (
          <div key={t} className="panel p-5">
            <h3 className="font-cond text-lg font-bold uppercase tracking-wide">{t}</h3>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function CourtArt() {
  return (
    <svg className="pointer-events-none absolute -right-16 -top-10 h-[130%] opacity-25 transition-transform duration-700 group-hover:scale-105" viewBox="0 0 300 300" aria-hidden>
      <g fill="none" stroke="#ff6a13" strokeWidth="3">
        <circle cx="150" cy="150" r="120" />
        <path d="M150 30v240M30 150h240" />
        <path d="M65 65c40 40 40 130 0 170M235 65c-40 40-40 130 0 170" />
      </g>
    </svg>
  );
}
function PitchArt() {
  return (
    <svg className="pointer-events-none absolute -right-10 -top-6 h-[120%] opacity-25 transition-transform duration-700 group-hover:scale-105" viewBox="0 0 200 300" aria-hidden>
      <g fill="none" stroke="#d9b45a" strokeWidth="2.5">
        <rect x="10" y="10" width="180" height="280" rx="6" />
        <path d="M10 150h180" /><circle cx="100" cy="150" r="30" />
        <rect x="55" y="10" width="90" height="45" /><rect x="55" y="245" width="90" height="45" />
      </g>
    </svg>
  );
}
