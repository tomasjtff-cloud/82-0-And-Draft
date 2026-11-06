# Arquitectura — Legends Lab

## Visión general

```
┌──────────────── Navegador (React client components) ────────────────┐
│ app/nba → NbaGame ─┐                 app/football → FootballGame ─┐  │
│ components/*  (UI pura: cartas, cancha, campo, tablas, brackets)  │  │
│                    ▼                                              ▼  │
│      features/nba-draft/engine     features/football-draft/engine    │
│      features/nba-simulation       features/football-simulation/*    │
│                    ▼                                              ▼  │
│        lib/ratings/*   lib/data/*   lib/core/rng   lib/core/difficulty│
│        lib/storage (localStorage: partidas, historial, ajustes)      │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────── Servidor (Next.js route handlers) ───────────────────┐
│ /api/data/status       qué proveedores están configurados + cobertura│
│ /api/data/nba/search   proxy BALLDONTLIE (clave solo en servidor)    │
│ lib/api/providers.ts   fetch + caché en memoria (24 h) + errores     │
└──────────────────────────────────────────────────────────────────────┘
scripts/  validate-data.ts (integridad) · import-nba.ts (verificación vía API)
```

Separación de responsabilidades:
- **Motores** (`features/*/engine*.ts`, `football-simulation/*`): TypeScript puro, sin React, deterministas, testeables con Vitest sin navegador.
- **Ratings** (`lib/ratings`): transforman datos crudos en atributos y fuerzas. Ningún motor usa un “rating = resultado”: el rating es input de un modelo probabilístico.
- **Datos** (`lib/data`): datasets tipados con procedencia (`source`, `verification`, `updatedAt`).
- **UI** (`components`, contenedores `*Game.tsx`): solo presentación y orquestación de llamadas a motores.

## Modelo de datos

| Entidad del spec | Implementación |
|---|---|
| Franchise / Team (NBA) | `NbaFranchise` (`id` estable, `names[]` por rango de años, conferencia/división actuales) |
| Club (fútbol) | `HistClub` (draft) · `SimTeam` (mundo de simulación 2026/27) |
| Player / PlayerSeason / HistoricalMembership | `NbaPlayerSeason`, `FbPlayerSeason`: una fila = jugador × club × temporada (la pertenencia histórica ES la fila) |
| PlayerPosition | `positions[]` (primaria primero) + matriz `posCompat` (fútbol) |
| PlayerRating | `NbaRatings` (calculado) · `FbAttrs`/`GkAttrs` + `ovr` (estimados) |
| Season / Era | `startYear`, `season`, `decade` |
| Draft / DraftPick | `NbaDraftState` (`history[]`), `FbDraftState` (`lineup` slot→carta, `captainId`) |
| Simulation | `NbaSeasonResult`, `SeasonState` (fútbol, serializable con `rng`) |
| Competition / Fixture / MatchResult | `CompId`, `plFixtures`, `uclFixtures`, `Match` (incl. prórroga/penales/ida-vuelta), `Tie` |
| Standing | `StandingRow` + `sortPremierLeague` / `sortUclLeague` |
| Trophy | `TrophyResult` (`won`/`runner-up`/`eliminated`/`not-qualified`/`in-progress`) |
| DataSource | `source`, `verification`, `updatedAt` en cada fila + `PROVIDERS` |

Restricciones validadas (tests + `validate:data`): ids únicos, club/franquicia existente, valores plausibles, reglas de época, sin duplicar jugador (cualquier versión) en una alineación, GK solo en portería.

## Motores de simulación

### NBA (82 partidos)
1. `normalize()` traslada cada temporada al entorno moderno (ritmo, puntos por 100 posesiones, rebotes disponibles).
2. `rateNbaPlayer()` → componentes + OVR. Campos ausentes → estimación marcada.
3. `evaluateNbaTeam()` → net rating con rendimientos decrecientes y penalizaciones de encaje.
4. `buildSchedule()` → 82 partidos (15 Este ×2, 7 Oeste ×4, 8 Oeste ×3), 41 casa, 14 back-to-backs.
5. Por partido: margen ~ Normal(μ, σ); marcador alrededor de posesiones compartidas; prórrogas si empate.
6. `monteCarlo()` repite con semillas derivadas; reporta frecuencias simuladas + probabilidad analítica (producto de P(victoria)).

### Fútbol (temporada)
- `calendar.ts`: plantilla de fechas 2026/27 (aproximada) sin choques para un mismo equipo.
- `season.ts`: estado serializable con cursor de eventos. `stepSeason` procesa un evento (jornada PL, jornada UCL, ronda de copa, ida/vuelta), `stepToNextUserMatch` avanza hasta el siguiente partido del usuario, `simulateRest` completa. Quick Sim y Live usan el mismo camino → mismos resultados con la misma semilla (testeado).
- Sorteos de copa en el momento del evento, con el RNG del estado.

### Dificultad
Parámetros explícitos (`lib/core/difficulty.ts`): boost de rivales, σ de margen NBA, sensibilidad a desequilibrios/encaje, fatiga. Nunca derrotas forzadas.

## Persistencia y caché
- `localStorage` (`lib/storage.ts`): ajustes, historial (200), mejor récord NBA, draft NBA en curso, sesión de fútbol completa (draft + temporada) para continuar después.
- APIs: caché en memoria 24 h en servidor + `revalidate` de Next. Orden de prioridad: datos locales verificados → caché → API autorizada → dataset demo etiquetado → error claro.

## Integraciones externas (estado)
| Fuente | Estado | Limitación conocida |
|---|---|---|
| BALLDONTLIE | Proxy de búsqueda + importador de verificación | Free: teams/players/games, ~5 req/min; season averages de pago |
| nba_api / NBA.com Stats | No integrado | Librería Python no oficial; NBA.com suele bloquear IPs de nube |
| football-data.org | Cliente preparado | Free: 12 competiciones, ~10 req/min, histórico limitado |
| API-Football | Cliente preparado | Free: 100 req/día; temporadas antiguas limitadas |
| Transfermarkt | Solo referencia manual | Sin API pública; no se hace scraping |
