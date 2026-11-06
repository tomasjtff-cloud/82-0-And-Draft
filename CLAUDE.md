# CLAUDE.md — memoria operativa de Legends Lab

> Lee este archivo, `README.md` y `ROADMAP.md` antes de modificar código. No dependas del historial de conversación.

## Qué es
App web personal con dos juegos: **NBA 82-0 Challenge** y **Football Ultimate Draft & Season Simulator**. Español por defecto. Repo: `tomasjtff-cloud/82-0-And-Draft`, rama `main`.

## Stack
Next.js 15 (App Router) · React 19 · TypeScript estricto · Tailwind CSS v4 (`@theme` en `src/app/globals.css`) · `motion` (Framer Motion) · Vitest · Playwright (e2e smoke). Sin base de datos: datasets en TypeScript + `localStorage` para partidas/historial.

## Comandos
```bash
npm run dev | npm run build | npm test | npm run typecheck | npm run validate:data | npm run verify:data
npm run build && npm start   # luego: npm run e2e  (tests/e2e/smoke.mjs)
```
Antes de cada commit: `npm test` y `npm run build` deben pasar.

## Estructura
```
src/
  app/                     rutas (/, /nba, /football, /history, /settings, /api/data/*)
  components/common|nba|football   UI pura (sin lógica de juego)
  features/
    nba-draft/engine.ts            draft NBA (puro, determinista)
    nba-draft/NbaGame.tsx          contenedor UI NBA
    nba-simulation/engine.ts       82 partidos + Monte Carlo
    football-draft/engine.ts       ruleta + FUT, re-spins, swaps, formación
    football-draft/FootballGame.tsx contenedor UI fútbol
    football-simulation/           match.ts (Poisson) · calendar.ts · league.ts · ucl-draw.ts · season.ts
  lib/
    core/rng.ts                    PRNG sfc32 serializable (semillas)
    core/difficulty.ts             parámetros explícitos por dificultad
    data/nba/{franchises,players}.ts
    data/football/{clubs,players,formations,world}.ts
    ratings/{nba,nba-context,football}.ts
    data/verification/             JSON generados por scripts/verify-*.ts + index.ts (capa de verificación)
    api/providers.ts               proveedores externos (solo servidor)
    storage.ts                     localStorage seguro
  types/{nba,football}.ts
scripts/ validate-data.ts · import-nba.ts · verify-nba-538.ts · verify-wikidata.ts
tests/unit/*.test.ts · tests/e2e/smoke.mjs
```

## Convenciones
- **La lógica vive en `features/*/engine*.ts` y `lib/`**, nunca en componentes. Los motores son funciones puras que reciben y devuelven estado serializable (`rngState` incluido).
- Toda aleatoriedad pasa por `Rng` con semilla con prefijo por dominio (`nba-draft:`, `nba-season:`, `fb-draft:`, `fb-season:`). Nunca `Math.random()` en motores (solo `randomSeed()` en UI).
- Resultados como `Result<T> = {ok:true,state}|{ok:false,error}`; un error nunca consume un re-spin.
- IDs estables: jugador `slug(nombre)`; versión `${playerId}-${club}-${añoInicio}`. Franquicias/clubes con id estable y nombres históricos por año.
- UI: Tailwind con tokens de `globals.css`; componentes con `data-testid` para e2e.
- Textos de UI en español.

## Reglas de integridad de datos (no negociables)
1. Solo filas jugador–club–temporada reales. Si dudas de la pertenencia, **no la añadas**.
2. Si no conoces un valor con confianza → `null` (NBA) y el motor lo marca **estimado**. No inventes estadísticas.
3. Robos/tapones = `null` antes de 1973-74; 3P = `null` antes de 1979-80 (lo fuerza `r()`).
4. Atributos de fútbol = estimación derivada (`estimateAttributes`) de `ovr` + estilo. Nunca presentarlos como EA.
5. `leagueGoals` solo si es un dato conocido; si no, `null`.
6. La pertenencia se verifica externamente con `npm run verify:data` (FiveThirtyEight RAPTOR CC BY 4.0 para NBA 1977-2022; Wikidata CC0 P54 para el resto). Tras añadir filas: ejecutarlo, revisar `CONTRADICTED` y corregir/eliminar. Las contradichas se excluyen del draft automáticamente; las excepciones documentadas van en `OVERRIDES` (`src/lib/data/verification/index.ts`). Node fetch necesita `NODE_USE_ENV_PROXY=1` en el entorno cloud.
7. Mundo 2026/27 (fuerzas, campos de Champions/EFL) es escenario aproximado: no usar resultados reales.

## Ampliar datos
- NBA: añadir filas `r(...)` en `src/lib/data/nba/players.ts` (formato documentado arriba del archivo).
- Fútbol: añadir `p(...)` en `src/lib/data/football/players.ts`; clubes nuevos en `clubs.ts` (id, país, liga, colores).
- Ejecutar `npm run validate:data` y `npm test`. Las combinaciones franquicia/club–década aparecen automáticamente en las ruletas.

## Decisiones técnicas clave
- **NBA ratings**: ver sección “NBA v2”. Escala: 95–99 leyenda, 90–94 superestrella, 85–89 all-star, 77–84 titular, 68–76 rotación, 55–67 suplente.
- **NBA partido**: margen ~ Normal(μ, σ≈12.5) con μ = net propio − (net rival + boost dificultad) ± 1.6 localía − fatiga b2b, forma de temporada N(0,0.8). Calibración v2 (Normal): leyendas OVR 97 ≈ 73,5 victorias, P(82-0) analítica ≈ 1,6·10⁻⁴; OVR 83 ≈ 49; OVR 78 ≈ 37; OVR 72 ≈ 16.
- **Fútbol partido**: Poisson independiente, λ = 1.36·exp(0.042·(ATT−DEF_rival) ± 0.12 localía), forma N(0,1.6) por equipo, fatiga por congestión (×dificultad para el usuario). Prórroga λ/3. Penales simulados.
- **Química**: club 2/4/6, nación 2/4/7, liga 3/5/8 → +1/+2/+3 (máx 3 por jugador, 33 equipo), 0 fuera de posición (encaje <0.9), leyendas (≥90) mínimo 1, capitán +1. Efecto: (chem/33−0.6)·4 sobre ATT/DEF.
- **Elegibilidad de draft**: encaje posicional ≥ 0.9 (`DRAFT_FIT_MIN`).
- **Champions**: 4 bombos de 9 por rating; cada equipo 2 rivales por bombo (1 casa/1 fuera), sin compatriotas, máx. 2 por país; sorteo constructivo greedy por par de bombos con reintentos; 8 jornadas por emparejamientos perfectos con DFS. Playoffs 9–24, bracket R16 por pares de cabezas de serie, mejor clasificado cierra en casa.
- **Copas**: FA Cup sin replays (prórroga+penales; SF y F neutrales). Carabao: penales directos hasta cuartos; SF ida/vuelta con prórroga en la vuelta; final neutral.
- Usuario como club real: su XI sustituye la plantilla. Fantasy FC sustituye a un club PL elegido (siguen 20). El usuario siempre juega la Champions (regla fantástica, reemplaza al inglés más débil).

## Deployment
**Producción: Vercel** — https://legends-lab.vercel.app/ (integración Git: push a `main` = deploy de producción). Sin variables obligatorias.
GitHub Pages (`.github/workflows/pages.yml`) queda solo como espejo manual (`workflow_dispatch`): `GITHUB_PAGES=true` activa `output: export` + basePath.

## NBA v2 (resumen técnico)
- **Ratings**: `src/lib/ratings/nba-features.ts` (features con eFG estimado) + `scripts/calibrate-nba.ts` (regresión ridge ponderada por minutos contra RAPTOR → `nba-calibration.json`). OVR = 0.57·impactToOvr(impacto) + 0.43·producción (v2.1; anclas del usuario: primes de Jordan/LeBron = 99, LaMelo 22-23 = 82–83, testeadas). Impacto = predicción ajustada en varianza (÷√R²) mezclada con RAPTOR real (peso 0.5·min(1, MP/2500)).
- **Equipo**: net = (OVR medio − 80.5)·1.0 + (ataque−80)·0.06 + (defensa−65)·0.06 + Σ ajustes de encaje. Química = 70 + 8·Σ ajustes (`evaluateNbaTeam().fit`).
- **Pools del draft**: un jugador por franquicia+década (mejor temporada: OVR → impacto → PJ → más reciente); otras temporadas seleccionables (`versionsFor`).
- **Liga**: 31 equipos (30 franquicias + "YOU" en el Oeste), 82 partidos exactos cada uno (`league.ts`). Playoffs top-8 por conferencia, mejor de 7 (2-2-1-1-1). RNG separados: `nba-season:`, `nba-league:`, `nba-playoffs:`.
- **Box scores**: `boxscore.ts` reparte exactamente el marcador entre 5 titulares + banquillo (invariantes testeadas).
- **Persistencia**: `ll:nba:last:v1` (draft + semilla → la temporada se recalcula), historial con `nba: NbaTeamSnapshot` (entradas antiguas siguen siendo válidas sin snapshot).

## Fútbol Monte Carlo
`src/features/football-simulation/monte-carlo.ts` (motor real, semillas `${seed}#fbmc${i}`, IC Wilson) + `mc.worker.ts` (lotes, progreso, cancelación) + `src/hooks/useFootballMonteCarlo.ts`.

## Estado / siguientes pasos
Ver `ROADMAP.md`. Al terminar una sesión: actualizar ROADMAP.md y CHANGELOG.md, commit descriptivo, push y verificar.
