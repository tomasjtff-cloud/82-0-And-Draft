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
- **NBA ratings**: normalización por ritmo y entorno ofensivo de cada temporada (`nba-context.ts`) → índice tipo box-score → OVR 55–99. Rating de equipo con rendimientos decrecientes en ataque y penalizaciones de encaje (tiro, creación, aro, rebote, exceso de anotadores, posición secundaria) escaladas por dificultad. Net rating ≈ `(OVR−71.5)·0.83 + ...`.
- **NBA partido**: margen ~ Normal(μ, σ≈12.5) con μ = net propio − (net rival + boost dificultad) ± 1.6 localía − fatiga b2b, forma de temporada N(0,0.8). Calibración: quinteto top ≈ 74 victorias NORMAL, P(82-0) ≈ 10⁻⁴…10⁻²; quinteto All-Star ≈ 50; role players ≈ 15.
- **Fútbol partido**: Poisson independiente, λ = 1.36·exp(0.042·(ATT−DEF_rival) ± 0.12 localía), forma N(0,1.6) por equipo, fatiga por congestión (×dificultad para el usuario). Prórroga λ/3. Penales simulados.
- **Química**: club 2/4/6, nación 2/4/7, liga 3/5/8 → +1/+2/+3 (máx 3 por jugador, 33 equipo), 0 fuera de posición (encaje <0.9), leyendas (≥90) mínimo 1, capitán +1. Efecto: (chem/33−0.6)·4 sobre ATT/DEF.
- **Elegibilidad de draft**: encaje posicional ≥ 0.9 (`DRAFT_FIT_MIN`).
- **Champions**: 4 bombos de 9 por rating; cada equipo 2 rivales por bombo (1 casa/1 fuera), sin compatriotas, máx. 2 por país; 8 jornadas por emparejamientos perfectos con DFS. Playoffs 9–24, bracket R16 por pares de cabezas de serie, mejor clasificado cierra en casa.
- **Copas**: FA Cup sin replays (prórroga+penales; SF y F neutrales). Carabao: penales directos hasta cuartos; SF ida/vuelta con prórroga en la vuelta; final neutral.
- Usuario como club real: su XI sustituye la plantilla. Fantasy FC sustituye a un club PL elegido (siguen 20). El usuario siempre juega la Champions (regla fantástica, reemplaza al inglés más débil).

## Deployment
GitHub Pages (export estático, `.github/workflows/pages.yml`): push a `main` = producción en https://tomasjtff-cloud.github.io/82-0-And-Draft/. `GITHUB_PAGES=true` activa `output: export` + basePath; el workflow elimina `src/app/api` antes del build. Probar el export localmente: `GITHUB_PAGES=true npm run build`, servir `out/` bajo `/82-0-And-Draft/`, y `BASE_URL=... npm run e2e`.

## Estado / siguientes pasos
Ver `ROADMAP.md`. Al terminar una sesión: actualizar ROADMAP.md y CHANGELOG.md, commit descriptivo, push y verificar.
