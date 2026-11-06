# Premios y logros

## Premios individuales de fútbol — "Mi equipo" (`awards.ts`)
Solo el XI del usuario tiene estadísticas individuales simuladas, así que todos son **reconocimientos internos de Legends Lab** (nunca premios mundiales u oficiales).
- **Rendimiento neutral por posición**: z = (nota media − media del puesto)/desv. del puesto, con medias medidas en 60 temporadas: POR 6,84±0,13 · DEF 6,32±0,15 · MED 6,74±0,20 · DEL 7,19±0,29.
- **Jugador de la temporada**: máx. z·disponibilidad + 0,15·títulos·disponibilidad + 0,3·z en finales (mín. 40 % de minutos). En 80 temporadas ganaron 29 medios, 28 atacantes, 17 defensores y 6 porteros.
- **Balón de Oro LL**: el jugador de la temporada si z ≥ 1,0 y el equipo ganó Premier o Champions (≈ 12 % de temporadas). Si no, queda desierto (se explica por qué).
- **Bota de Oro LL**: máximo goleador de Premier del equipo con ≥ 25 goles (rango de ganadores reales 22–32).
- **Guante de Oro LL**: portero con ≥ 15 porterías a cero en Premier (rango real 15–21).
- Mejor defensor/mediocampista/delantero (z por línea), mejor jugador de Champions (≥ 4 PJ). Líderes de goles (Premier, Champions, total) y asistencias del equipo.
- Mejor joven: **no disponible** (el dataset no tiene fechas de nacimiento).

## NBA — reconocimientos del quinteto (`nbaInternalAwards`)
MVP del quinteto (pts + 1,2·reb + 1,5·ast + 2·robos + 2·tapones por partido), máximo anotador, reboteador, asistente, mejor defensor (robos+tapones) y MVP de las Finals del equipo (si las ganó). No son premios de la NBA.

## Logros (`src/lib/progress/achievements.ts`)
59 logros: 29 de fútbol, 29 de NBA y 1 cruzado (6 secretos). Bronce 10 · Plata 25 · Oro 50 · Platino 100 (2 540 puntos). Los puntos solo representan progreso; no cambian dificultad ni probabilidades.

Reglas: evaluadores puros sobre el registro local; un logro se guarda una vez (`{at, ref, v}`) y nunca se revoca; cada temporada cuenta una vez (id estable: `fb:<semilla>` / `nba:<semilla>:<draft>`), así que reabrir o repetir no vuelve a conceder. Las partidas migradas (anteriores a V4) solo cuentan para logros de equipo (títulos, victorias, puntos).

Definiciones documentadas: leyenda NBA = impacto estimado ≥ +6 por 100 posesiones (112 de 708 temporadas); química máxima NBA = 86 (todos los bonus); promedios con ≥ 58 PJ; "Contra las probabilidades" = proyección previa del motor (Σ prob. de victoria) ≤ 45; "Contra todo pronóstico" = Premier con media ≤ 80 en Normal o Difícil; "Doble corona" = anillo NBA y Champions con < 7 días entre ambas. Umbrales validados con el motor (máximos observados: 41 ppg, 17,6 rpg, 12,1 apg; goleador de temporada mediana 41 goles).
