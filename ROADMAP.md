# ROADMAP

_Última actualización: 2026-11-06_

## Estado del deployment (2026-11-06)
- Plataforma elegida: **GitHub Pages** (export estático, gratis). Vercel se descartó en esta sesión porque el token guardado no se aplicó; el repo sigue siendo compatible con Vercel/Netlify.
- Workflow `pages.yml`: build y tests OK; requiere activar Pages una vez (Settings → Pages → Source: GitHub Actions).
- E2E completo verificado contra el export estático servido bajo `/82-0-And-Draft/`.

## Completado
- [x] Fase 1 — Base: Next.js 15 + TS + Tailwind 4 + Motion, sistema visual, landing, tests, docs.
- [x] Fase 2 — NBA jugable: draft 5 rondas, re-spins, ~700 versiones de jugador, ratings con ajuste por época, cancha, 82 partidos, resultados, análisis, Monte Carlo, guardado local.
- [x] Fase 3 — Football draft: ruleta histórica + FUT Draft, re-spins, 8 formaciones, química, swaps, cambio de formación, ~1.600 versiones de jugador.
- [x] Fase 4 — Simulación de fútbol: PL (380), Champions 36 equipos (sorteo con restricciones + KO), FA Cup, Carabao Cup, Quick Sim, Live Season, trofeos, quadruple.
- [x] Fase 5b — Verificación real: FiveThirtyEight RAPTOR (NBA 1977-2022, 537/537) + Wikidata (fútbol 1.577/1.592; NBA 91 + 25 probables), métricas reales en cartas, filas contradichas excluidas.
- [~] Fase 5 — Datos: capa de proveedores en servidor, `/api/data/status`, proxy de búsqueda BALLDONTLIE, importador de verificación NBA, validador de integridad. **Sin probar contra APIs reales** (el entorno de desarrollo no tenía acceso de red a esos hosts ni claves).
- [~] Fase 6 — Pulido: animaciones, reduced motion, responsive verificado a 390 px. Pendiente: sonidos, inglés, banquillo.
- [x] Fase 7 — Verificación: 33 tests unitarios/integración, build de producción, e2e smoke (NBA + fútbol ruleta/quick sim + FUT/live) sin errores de consola.

## Pendiente (prioridad)
1. Verificar medias por partido NBA (PPG/RPG…) con una fuente con licencia (538 no las incluye; BALLDONTLIE de pago). 
1b. **Verificación de datos con API**: ejecutar `scripts/import-nba.ts` con clave y plan adecuado; revisar diffs; marcar filas `api-verified`.
2. Importador de fútbol (football-data / API-Football) para plantillas recientes; histórico anterior a ~2010 requerirá fuentes adicionales con licencia apropiada.
3. Banquillo opcional de 5 (rotaciones/fatiga) — el modelo de fatiga ya existe, falta UI + uso en `season.ts`.
4. Soporte de inglés (diccionario i18n).
5. Ampliar combinaciones finas: NBA franquicia-década con <3 cartas (ver `npm run validate:data`), más clubes de fútbol (Everton, Leeds, Forest 70-80s, Roma, Lazio, Sevilla, PSV…).
6. Sonidos opcionales con control de volumen.
7. Monte Carlo para fútbol (probabilidad de cada título) y comparación de semillas lado a lado.
8. Ejecutar Monte Carlo pesado en Web Worker.

## Errores / limitaciones conocidos
- Datos `manual-curation`: pueden contener pequeñas imprecisiones; los campos dudosos se dejaron `null`.
- Ratings de clubes 2026/27, campo de Champions y clubes EFL: escenario aproximado, no listas oficiales.
- Calendario 2026/27: plantilla aproximada (fechas plausibles, no oficiales).
- Desempates UCL más allá de victorias fuera usan rating como proxy del coeficiente.
- `npm run lint` no configurado (ESLint no instalado).

## Dependencias externas / bloqueos
- Claves: `BALLDONTLIE_API_KEY` (medias por temporada requieren plan de pago), `FOOTBALL_DATA_API_KEY`, `API_FOOTBALL_KEY` — opcionales.
- Referencias visuales (X, inspora, refero) no revisadas por bloqueo de red del entorno.
