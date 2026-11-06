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
scripts/  validate-data.ts (integridad) · verify-nba-538.ts + verify-wikidata.ts (verificación con fuentes reales) · import-nba.ts (BALLDONTLIE)

Pipeline de datos: dataset curado (TS) → scripts de verificación (offline, con red) → JSON compactos en src/lib/data/verification → empaquetados en el build → la app
no llama a ninguna API durante las partidas (rápido, sin cuotas, sin base de datos). Hosting: Vercel, estático + 2 rutas serverless.
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
| FiveThirtyEight RAPTOR (GitHub) | Integrado (build-time) | 1977-2022, solo temporada regular |
| Wikidata SPARQL | Integrado (build-time) | Huecos en jugadores recientes / altas recientes |
| BALLDONTLIE | Proxy de búsqueda (rate-limit 10/min/IP) + importador de verificación | Free: teams/players/games, ~5 req/min; season averages de pago |
| nba_api / NBA.com Stats | No integrado | Librería Python no oficial; NBA.com suele bloquear IPs de nube |
| football-data.org | Cliente preparado | Free: 12 competiciones, ~10 req/min, histórico limitado |
| API-Football | Cliente preparado | Free: 100 req/día; temporadas antiguas limitadas |
| Transfermarkt | Solo referencia manual | Sin API pública; no se hace scraping |


## NBA v2 — ratings, química, liga, playoffs y estadísticas

### Ratings (55–99)
1. **Features** (`nba-features.ts`): puntos, rebotes, asistencias, robos y tapones normalizados al entorno moderno (ritmo, eficiencia ofensiva de la liga, rebotes disponibles); eFG% estimado (FG% + 0,5·3PM/FGM, con FTM ≈ 19 % de los puntos porque el dataset no tiene FTA) relativo a la liga de esa temporada; reputación defensiva; triples por partido.
2. **Modelo de impacto**: regresión lineal ridge (λ=2, ponderada por minutos) del RAPTOR total real de FiveThirtyEight sobre esas features en 537 temporadas verificadas → R² 0,60, RMSE 1,77 (`scripts/calibrate-nba.ts` → `nba-calibration.json`).
3. **Corrección de varianza**: la regresión encoge los extremos; la predicción se re-escala por 1/√R² alrededor de la media para que las leyendas fuera del rango de 538 (pre-1977, 2022+) no queden comprimidas.
4. **Mezcla con dato real**: si la temporada tiene RAPTOR (≥500 min), impacto = w·RAPTOR + (1−w)·predicción con w = 0,5·min(1, MP/2500).
5. **Escala (v2.1)**: impacto → OVR por nodos lineales (−3→64, 0→76, 2→83, 4→88, 6→92,5, 8→96, 9,5→99,5). Índice de producción = línea de volumen + eficiencia con peso reducido (12), mapeado como 52 + 0,85·índice. OVR final = 0,57·impacto + 0,43·producción, recortado a 55–99. Anclas de referencia del usuario (testeadas): primes de Jordan 87-88/88-89/90-91 y LeBron 08-09/12-13 = 99; LaMelo 22-23 = 82. También llegan a 99 Wilt (61-62, 63-64, 66-67), D. Robinson 93-94 y Wade 08-09.
6. Causa de los casos reportados (v2.0): el modelo anterior usaba FG% crudo (castiga a tiradores de 3 como LaMelo) y un ajuste de rebotes por época que penalizaba a pívots de los 90 (Ewing). Ahora: Ewing 89-90 = 90, 93-94 = 87; LaMelo 22-23 = 77 (su impacto real esa temporada fue modesto: 41 % en tiros de campo en 36 partidos).

### Modelo de equipo
net = (OVR medio − 80,5) + 0,06·(ataque−80) + 0,06·(defensa−65) + Σ ajustes de encaje (× sensibilidad de dificultad). Calibrado para que subir todos los OVR no infle los récords (tests en `tests/unit/nba-v2.test.ts`).

### Química NBA (explicable)
`evaluateNbaTeam().fit` devuelve términos con estado `bonus | ok | pending | penalty` y su valor en puntos de net:
- Tiro y espaciado: <2 tiradores (tiro ≥62) → −1,6 por cada uno que falte; 3 tiradores +0,5; ≥4 +1.
- Creación: mejor creador <62 → −1,8; ≥85 → +0,5.
- Protección del aro: <55 → −1,8; ≥85 → +0,5.
- Rebote medio <48 → −1,2. Defensa media <50 → −1,2.
- Un solo balón: ≥3 anotadores de ≥26 pts ajustados → −1,1 por cada uno por encima de 2.
- Posición secundaria: −0,6 por jugador.
Las necesidades que aún pueden cubrirse quedan "pending" (sin penalizar) hasta completar el quinteto. Química = 70 + 8·Σ. No hay bonus por franquicia compartida ni por fama. `previewPick()` evalúa el equipo antes/después con el mismo modelo.

### Liga y playoffs
31 equipos (30 franquicias + el tuyo en el Oeste). Calendario exacto de 82 partidos por equipo: 2 vs cada equipo de la otra conferencia; Este 4×8 + 3×6 (diseño circulante); Oeste 3–4 vs cada rival con grafo de "4 partidos" de grados prescritos (Havel–Hakimi aleatorizado). Todos los partidos usan el mismo modelo de margen normal. Clasificación por victorias → enfrentamiento directo → diferencial → sorteo. Playoffs: 8 por conferencia (sin play-in), 1-8/4-5/2-7/3-6, mejor de 7 con 2-2-1-1-1; Finals con ventaja para el mejor récord.

### Estadísticas simuladas
El marcador se decide primero; `boxscore.ts` reparte esos puntos exactos entre los 5 titulares y un banquillo genérico (≈0,33 pts/min) según puntos por 36 normalizados × minutos, con ruido; los jugadores a los que se pide más que su volumen histórico pierden algo de eficiencia (y ganan si comparten balón con más estrellas). Tiros: TL ≈ 19 % de los puntos, triples según su proporción histórica, FGA/3PA/FTA a partir de sus porcentajes ± ruido. Rebotes, asistencias (≈60 % de canastas), robos y tapones de equipo por posesiones, repartidos por perfil × minutos. Invariantes: Σ puntos = marcador, Σ minutos = 240 + 25·prórrogas, 2·FGM+3PM+FTM = PTS.

## Fútbol — Monte Carlo
Cada iteración i ejecuta `simulateRest(createSeason(seed#fbmc i))`: el mismo motor del Quick Sim (sorteos, calendario, fatiga, localía, química/formación vía ATT/DEF del XI, dificultad). Se registran posición, puntos, GF/GA y la ronda más profunda en cada copa. Probabilidades = frecuencias k/N con intervalo de Wilson al 95 % (con k=0 el límite superior ≈ 3/N). Corre en un Web Worker en lotes de 10–25 temporadas con progreso, cancelación (resultados parciales) y fallback en el hilo principal. Rendimiento: ~12 ms por temporada en escritorio (sorteo de Champions constructivo).
