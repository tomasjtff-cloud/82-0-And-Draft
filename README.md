# Legends Lab

Plataforma personal (sin fines comerciales) con **dos videojuegos deportivos jugables**:

| Juego | Qué haces | Objetivo |
|---|---|---|
| **NBA 82-0 Challenge** | Draft de 5 rondas (franquicia + década al azar), quinteto PG-SG-SF-PF-C con versiones históricas de jugadores, simulación de 82 partidos | Terminar **82-0** |
| **Football Ultimate Draft** | Draft de un XI (Historical Roulette o FUT Draft), formación, química, temporada completa | Ganar el **quadruple**: Premier League, Champions League, FA Cup y Carabao Cup |

Todo funciona **sin registro, sin claves y sin servicios de pago** (dataset local). Idioma: español.

## Requisitos e instalación

```bash
node >= 20 (probado con Node 22)
npm install
npm run dev          # http://localhost:3000
```

Producción local:

```bash
npm run build && npm start
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción (incluye type-check) |
| `npm test` | Tests unitarios/integración (Vitest): motores NBA, draft fútbol, competiciones |
| `npm run typecheck` | TypeScript sin emitir |
| `npm run validate:data` | Informe de integridad de los datasets |
| `npm run e2e` | Smoke test end-to-end con Playwright (requiere servidor en :3000 y `playwright` disponible) |

Para el e2e en tu máquina: `npm i -D playwright && npx playwright install chromium`, luego `npm run build && npm start` en una terminal y `npm run e2e` en otra.

## Qué funciona hoy

**NBA 82-0**
- Draft de 5 rondas con ruletas de franquicia y década (combinaciones válidas únicamente; nombres históricos: Seattle SuperSonics, Cincinnati Royals, New Jersey Nets…).
- 1 Re-spin de equipo y 1 de época por draft (no se consumen si fallan).
- ~700 versiones de jugador (temporada concreta) en las 30 franquicias, 1960s–2020s.
- Cartas con PPG/RPG/APG/SPG/BPG/FG%/3P%/FT%, ratings propios con ajuste por época y marcas de atributos estimados.
- Cancha interactiva, intercambio de posiciones válidas, evaluación de equipo (ataque, defensa, creación, rebote, aro, tiro, versatilidad, química).
- Simulación probabilística de 82 partidos con semilla, localía, back-to-backs, dificultad; resultados partido a partido; análisis; Monte Carlo (500/2000 temporadas).
- Mejor récord, historial y draft en curso guardados en el navegador.

**Football Ultimate Draft**
- Historical Roulette (club + década por posición, hasta 5 opciones) y FUT Draft (capitán + 5 cartas por posición con distribución de calidad).
- Re-spin de club y de época (1 de cada por draft) con reglas distintas por modalidad.
- ~1.600 versiones de futbolistas en 24 clubes históricos (Inglaterra, España, Italia, Alemania, Francia, Países Bajos, Portugal), 1970s–2020s.
- 8 formaciones, campo interactivo, intercambios, cambio de formación post-draft, química (0–33), TEAM OVR / ATTACK / MIDFIELD / DEFENSE.
- Temporada 2026/27 (escenario de juego): Premier League completa (20 clubes, 380 partidos), Champions League con fase liga de 36 equipos + playoffs + eliminatorias, FA Cup desde 3ª ronda, Carabao Cup desde 2ª ronda.
- Quick Sim y Live Season (partido a partido / evento a evento, se puede continuar más tarde).
- Vitrina de 4 trofeos con estado WON / RUNNER-UP / ELIMINATED / NOT QUALIFIED y celebración del quadruple.

## Integridad de datos (importante)

- Los jugadores, clubes y temporadas son **reales**; los valores fueron **curados manualmente** y están marcados `manual-curation` hasta verificarlos contra una fuente autorizada.
- Los campos no registrados en la época (robos/tapones antes de 1973-74, triples antes de 1979-80) quedan vacíos y el atributo dependiente se marca como **estimado**.
- Los atributos de fútbol (PAC, SHO, PAS, DRI, DEF, PHY y los de portero) son **estimaciones propias de Legends Lab**, no ratings de EA Sports.
- Las fuerzas de clubes 2026/27, la lista de participantes de Champions y los clubes de la EFL son un **escenario aproximado**; no se usan resultados reales de la temporada.
- Todo resultado es una **simulación del videojuego**, no una predicción deportiva.

## Configurar APIs (opcional)

Copia `.env.example` a `.env.local` y rellena las claves que tengas. Las claves solo se leen en rutas de servidor.

| Variable | Proveedor | Uso actual |
|---|---|---|
| `BALLDONTLIE_API_KEY` | balldontlie.io | `/api/data/nba/search?q=` y `scripts/import-nba.ts` (verificación; las medias por temporada requieren plan de pago) |
| `FOOTBALL_DATA_API_KEY` | football-data.org | Preparado en `src/lib/api/providers.ts` (importador pendiente) |
| `API_FOOTBALL_KEY` | api-football.com | Preparado en `src/lib/api/providers.ts` (importador pendiente) |

`GET /api/data/status` informa qué proveedores están configurados (solo booleanos) y la cobertura del dataset.

## Continuar el desarrollo

Lee en este orden: `CLAUDE.md` → `ROADMAP.md` → `ARCHITECTURE.md` → `DESIGN.md`. Para añadir jugadores ver “Ampliar datos” en `CLAUDE.md`.
