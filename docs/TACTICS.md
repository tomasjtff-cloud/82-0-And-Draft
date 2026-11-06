# Tácticas (`src/features/football-simulation/tactics.ts`)

Se elige antes de empezar y es fija toda la temporada (Quick Sim, Live, Monte Carlo, estadísticas, historial). Solo modifica al equipo del usuario, dentro del mismo modelo de Poisson, como desplazamientos de ATT/DEF (1 punto ≈ ±4,2 % de goles esperados) y un multiplicador de fatiga. **Equilibrado = motor anterior exacto** (las partidas antiguas reproducen).

`ajuste = clamp(base + kFit·f + kRival·r, −4, 4)` con
- `f ∈ [−1,1]`: encaje del XI (atributos estimados) — `(métrica − mediana)/dispersión`, medianas medidas en 120 XI aleatorios (`scripts/calibrate-tactics.ts`).
- `r ∈ [−1,1]`: (rating rival − rating propio)/8 (+ = rival superior).

| Táctica | ATT [base, f, r] | DEF [base, f, r] | Fatiga | Métrica de encaje |
|---|---|---|---|---|
| Equilibrado | 0 | 0 | ×1 | — |
| Posesión | 0,3 · 1,4 · −0,8 | −0,4 · 0,8 · −0,4 | ×0,9 | pase+regate de medios/atacantes |
| Contraataque | −0,4 · 1,4 · 1,6 | 0,6 · 0,3 · 0,6 | ×1 | ritmo de atacantes y laterales |
| Presión alta | 1,5 · 1,0 · −0,2 | −1,7 · 0,8 · −0,4 | ×1,45 | físico+defensa de medios/atacantes |
| Bloque bajo | −2,0 · 0,3 · 0,2 | 2,2 · 0,9 · 0,6 | ×0,8 | defensa+físico de defensas/pivotes |

## Calibración (Normal)
Temporadas completas (6 XI drafteados × 15): puntos PL / GF / GC — Equilibrado 67,4/67,8/45,6 · Posesión 68,0/70,8/46,3 · Contraataque 64,1/62,8/44,8 (mejor % de Champions) · Presión 66,0/71,8/49,6 · Bloque bajo 67,6/63,3/40,5. Análisis exacto: equipos débiles rinden más con Contraataque/Bloque bajo, fuertes con Posesión/Presión, y un encaje bajo convierte cualquier táctica en peor que Equilibrado. Ninguna domina en todos los contextos (test `tactics.test.ts`).

La vista **Mi estilo de juego** muestra fortalezas, riesgos, encaje, cambios de ATT/DEF contra rival medio y líder, y los puntos esperados de Premier calculados con probabilidades exactas del motor (`outcomeProbs`, sin fatiga).
