# Química de fútbol (Legends Lab)

Fuente única: `chemistryBreakdown()` en `src/lib/ratings/football.ts`. El motor (`computeChemistry`), la vista previa (`previewFbPick`), el comparador (`pickImpact`), el panel **¿Por qué tengo esta química?** (`components/football/ChemWhy.tsx`) y VER MI XI leen los mismos números.

## Reglas (versión 1 = FUT Draft y partidas antiguas)
| Vínculo | Umbrales (incluye al propio jugador) | Puntos |
|---|---|---|
| Club | 2 / 4 / 6 | +1 / +2 / +3 |
| Nacionalidad | 2 / 4 / 7 | +1 / +2 / +3 |
| Liga | 3 / 5 / 8 | +1 / +2 / +3 |

- Tope individual 3, tope del XI 33.
- Fuera de posición (encaje < 0,9): química individual 0, **pero sigue contando en los grupos de sus compañeros** (regla existente, documentada, no se cambió).
- Leyenda (OVR ≥ 90) en posición: mínimo 1. Capitán: +1 (antes del tope).
- Efecto: (química/33 − 0,6)·4 × sensibilidad de dificultad × peso de la modalidad sobre ATT y DEF.

## Historical Roulette (versión 2, `chemVersion: 2`)
Además de las reglas anteriores, **+1 extra máximo** si se cumple alguno: idioma compartido con ≥ 3 del XI, familia de estilo (Toque / Vértigo / Fuerza, derivada del arquetipo estimado) con ≥ 4, continente con ≥ 4. Peso de la química: 70 %. Las partidas guardadas con reglas anteriores se reconstruyen con sus reglas (`snapshotRules`).

## Caso De Jong (investigado)
De Jong (Barcelona) + Di María y Ramos (Real Madrid) + un jugador del Atlético = 4 de LaLiga. Club 1/2 → 0; Países Bajos 1/2 → 0; LaLiga 4 → +1 (siguiente umbral 5). **1/3 es correcto en FUT Draft.** Con un quinto jugador de LaLiga sería 2/3. En Historical Roulette puede sumar el +1 extra (idioma/estilo/continente). Cubierto por `tests/unit/chemistry-v4.test.ts`.
