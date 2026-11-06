/**
 * Spanish UI strings (default and only language for now). Shared/repeated labels live here so a
 * second language can be added by providing another object with the same shape (see index.ts).
 * Proper names stay untranslated: Legends Lab, NBA, FUT Draft, Historical Roulette, Premier League,
 * Champions League, FA Cup, Carabao Cup, Monte Carlo, players, clubs and franchises.
 */
export const es = {
  app: { name: "Legends Lab", description: "NBA 82-0 y Draft de fútbol: drafts históricos y temporadas simuladas. Proyecto personal.", tagline: "Proyecto personal · 2 juegos · simulación probabilística" },
  nav: { home: "Inicio", nba: "NBA 82-0", football: "Draft de fútbol", legacy: "Mi legado", achievements: "Logros", history: "Historial", settings: "Ajustes" },
  games: { nba: "NBA 82-0", football: "Draft de fútbol", game1: "Juego 1", game2: "Juego 2" },
  home: {
    nbaTitle: "Arma tu quinteto legendario.", nbaSub: "¿Puedes terminar invicto?",
    fbTitle: "Arma tu XI soñado.", fbSub: "Conquista Inglaterra y Europa.", play: "Jugar ahora →",
    nbaBullets: ["5 rondas: franquicia + década al azar", "1 nuevo giro de equipo y 1 de época", "82 partidos simulados uno a uno"],
  },
  team: { ovr: "Media", attack: "Ataque", midfield: "Mediocampo", defense: "Defensa", chemistry: "Química" },
  sim: { quick: "Simulación rápida", quickLong: "Simulación rápida · temporada completa", live: "Temporada en vivo", liveLong: "Temporada en vivo · jornada a jornada", simulating: "Simulando…", next: "Siguiente partido ▸", rest: "Simular resto", newDraft: "Nuevo draft" },
  respin: { club: "Volver a girar club", era: "Volver a girar época", team: "Volver a girar equipo" },
  trophy: { won: "CAMPEÓN", runnerUp: "SUBCAMPEÓN", eliminated: "ELIMINADO", notQualified: "NO CLASIFICADO", inProgress: "EN JUEGO", quadruple: "¡QUADRUPLE!" },
  nba: { calendar: "Calendario", b2b: "Partidos consecutivos (b2b)" },
  common: { loading: "Cargando…", close: "Cerrar", cancel: "Cancelar", empty: "Sin datos todavía." },
} as const;
export type Dict = typeof es;
