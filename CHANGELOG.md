# Changelog

## 0.2.0 — 2026-11-06
### Añadido
- Verificación con fuentes reales: FiveThirtyEight RAPTOR (CC BY 4.0) para NBA 1977-2022 y Wikidata (CC0) para fútbol y NBA fuera de ese rango; métricas reales (minutos, RAPTOR, WAR; partidos/goles de la etapa) en las cartas; insignias de verificación.
- Filas contradichas excluidas del draft; `npm run verify:data`.
- Rate limit en el proxy de BALLDONTLIE.
- Deployment en GitHub Pages (export estático) con despliegue automático desde `main`; CI en GitHub Actions; secciones Deployment y Sports Data Providers en README.
### Corregido
- Liam Brady (Inter): temporada corregida a 1984/85 tras contradicción con Wikidata.

## 0.1.0 — 2026-11-06
### Añadido
- Base del proyecto (Next.js 15, React 19, TypeScript, Tailwind 4, Motion, Vitest).
- RNG con semillas serializable y parámetros de dificultad explícitos.
- **NBA 82-0**: dataset curado (30 franquicias, nombres históricos), ratings con ajuste por época, draft con ruletas y re-spins, evaluación de quinteto, simulación de 82 partidos, Monte Carlo, resultados y análisis.
- **Football Ultimate Draft**: dataset curado (24 clubes), atributos estimados, compatibilidad posicional, química, Historical Roulette y FUT Draft, 8 formaciones.
- **Simulador de temporada**: Premier League, Champions League (fase liga 36 equipos), FA Cup, Carabao Cup; Quick Sim y Live Season; vitrina de trofeos y quadruple.
- Historial, ajustes (reducir movimiento, animaciones rápidas), guardado local.
- Capa de proveedores de datos en servidor, `/api/data/status`, `/api/data/nba/search`, scripts de validación e importación.
- Tests unitarios/integración y smoke test e2e; documentación completa.
### Corregido
- Agregado ofensivo NBA dividía por la suma de pesos + 1.
- Elegibilidad de draft de fútbol: umbral de encaje 0.85 → 0.9 (evita ofrecer jugadores que quedarían fuera de posición).
