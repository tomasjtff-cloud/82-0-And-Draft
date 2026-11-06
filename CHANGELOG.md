# Changelog

## 0.4.1 — 2026-11-06
### Cambiado
- Fútbol · Historical Roulette: la química pesa el 40 % (`CHEM_WEIGHT.roulette = 0.4`) sobre ATT/DEF, porque club + década por posición vuelven los vínculos cuestión de suerte. En Normal el efecto pasa de −2,4…+1,6 a −0,96…+0,64. FUT Draft sin cambios. La vista previa, VER MI XI, la temporada y el Monte Carlo usan el mismo peso; el historial guarda el peso usado (partidas antiguas = 1, se reabren idénticas).

## 0.4.0 — 2026-11-06 (Legends Lab V3)
### Añadido
- NBA: ciudad + nombre del equipo personalizables (validados, por defecto "Legends Lab"), visibles en draft, 82 partidos, clasificación, playoffs, Finals, resultados, Monte Carlo, quinteto e historial. Solo cosmético: no toca semillas, calendario, rivales ni dificultad. Partidas antiguas siguen abriéndose.
- Fútbol: botón permanente **VER MI XI** (draft, XI completo, Live, Quick Sim, final de temporada, Monte Carlo, historial) con campo, química individual, capitán, Team OVR, ATT/MID/DEF, química /33, vínculos y explicación.
- Fútbol: draft rediseñado al estilo NBA (indicador de posición/progreso, ruletas con GIRAR, campo central, cajón inferior con candidatos, buscador, ficha detallada con ELEGIR, comparación entre dos candidatos, atributos de portero, estimados marcados con *).
- Vista previa de química antes de elegir (actual, esperada, delta, quién gana/pierde, vínculos nuevos, penalización por posición) usando el motor real; modo química en el campo con vínculos e impacto en ATT/DEF.
- Eventos individuales simulados para los partidos del usuario (`events.ts`, RNG `fb-events:` separado: no altera marcadores): goleadores, asistencias, tiros, pases, tarjetas, minutos, notas, xG/xA estimados, paradas/porterías a cero. Penales de tanda excluidos.
- "Mis jugadores": estadísticas por competición (PL/UCL/FA/EFL/Todas), orden por goles/asistencias/PJ/minutos/nota, premios (pichichi, asistente, mejor jugador, portero, MVP), récords, historial de partidos con detalle.
- Resumen de fin de temporada; Monte Carlo integrado como pestaña con comparación temporada jugada vs distribución.
- Historial de fútbol: snapshot del XI (11 IDs estables, formación, capitán, química, resultado) → "Ver XI" y "Abrir temporada" (reconstrucción determinista). Entradas antiguas muestran aviso.
### Tests
- 72 unitarios + e2e ampliado (identidad NBA, preview = química final, XI en draft/temporada/historial, estadísticas, detalle de partido, reapertura idéntica desde historial, iPhone 13 sin scroll horizontal).

## 0.3.1 — 2026-11-06
### Cambiado
- Escala NBA v2.1 con las anclas de referencia del usuario: primes de Jordan y LeBron = 99, LaMelo 2022-23 = 82. Nodos de impacto más altos, menos castigo por eficiencia en el índice de producción (0,57 impacto / 0,43 producción). Pivote del modelo de equipo 79 → 80,5 para que los récords no se inflen (leyendas ≈ 73-74 victorias en Normal).

## 0.3.0 — 2026-11-06 (Legends Lab V2)
### Corregido
- NBA: jugadores repetidos en una misma lista (p. ej. Zion Williamson) — el pool listaba cada temporada como carta distinta. Ahora una carta por jugador (mejor temporada) y las demás temporadas en su ficha.
- NBA: ratings demasiado castigados (FG% crudo penalizaba a tiradores de 3; ajuste de rebotes por época penalizaba a pívots). Nuevo modelo calibrado contra RAPTOR.
- Vista previa con quinteto vacío mostraba un net sin sentido.
### Añadido
- Ratings NBA v2 + recalibración del modelo de equipo; escala de tiers 55–99.
- Liga completa de 31 equipos, clasificación, playoffs al mejor de 7, NBA Finals, celebración del anillo.
- Box scores y estadísticas simuladas (temporada y playoffs) con líderes del equipo.
- Química NBA explicable (términos con valor en net), vista previa del impacto de cada elección, "quién aporta qué".
- VER MI QUINTETO (draft, resultados, historial) y persistencia de la última temporada (se recalcula desde la semilla).
- Rediseño móvil NBA: indicador de ronda, ruletas + botón GIRAR, cancha con camisetas originales, panel inferior con filtros y orden, ficha con temporadas alternativas.
- Fútbol: Monte Carlo de temporadas completas (100–2.000) en Web Worker con progreso, cancelación e IC95% de Wilson.
### Rendimiento
- Sorteo de la fase liga de Champions constructivo: temporada de fútbol ~24 ms → ~12 ms.

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
