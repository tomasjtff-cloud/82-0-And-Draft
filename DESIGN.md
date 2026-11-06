# DESIGN — sistema visual de Legends Lab

## Referencias y limitaciones de investigación
Desde el entorno de desarrollo **no fue posible abrir** inspora.design, styles.refero.design, 82-0-challenge.com, 82-0.games, futwiz.com ni los dos posts de X (bloqueo de red del entorno). No se ha inventado su contenido. Las mecánicas de NBA 82-0 se implementaron según la especificación del proyecto, y las de FUT Draft según la especificación y resultados de búsqueda (formación → capitán entre 5 → 1 de 5 por posición → química por club/nación/liga). La identidad visual es **original**: sin logos, escudos, fotos ni assets de terceros.

## Identidad
- Nombre: **LEGENDS LAB**. Tono: videojuego premium, oscuro, deportivo, sobrio.
- Logo: hexágono naranja con monograma "LL" (SVG propio).

## Color (tokens en `src/app/globals.css`)
| Token | Valor | Uso |
|---|---|---|
| `ink` | `#06070a` | fondo |
| `surface` / `-2` / `-3` | `#0e1014` / `#15181e` / `#1d2129` | paneles, inputs, estados activos |
| `line` / `line-strong` | blanco 8% / 16% | bordes |
| `text` / `muted` / `dim` | `#f3f4f6` / `#8d94a0` / `#5c6370` | texto |
| `nba` / `nba-2` / `nba-deep` | `#ff6a13` / `#ffb347` / `#3a1606` | acento NBA (negro + naranja) |
| `pitch` / `pitch-2` | `#0c3b25` / `#11502f` | campo |
| `gold` / `gold-2` | `#d9b45a` / `#f3dc94` | acento fútbol, trofeos |
| `win` / `loss` / `draw` | `#3ddc84` / `#ff4d5e` / `#b8bec9` | resultados |
Sin degradados morados genéricos. Contraste AA para texto principal sobre `ink`.

## Tipografía
- Display: **Anton** (marcadores, títulos, OVR).
- Interfaz: **Barlow** / **Barlow Condensed** (etiquetas en mayúsculas con tracking amplio).
- Números/estadísticas: **JetBrains Mono** con `tabular-nums`.
Cargadas desde Google Fonts con fallbacks del sistema (la app funciona sin red).

## Espaciado y forma
Escala Tailwind (4 px). Paneles `rounded-[18px]`, botones `12px`, chips `999px`. Gutter móvil 16 px. Contenedor máx. 1280 px.

## Componentes
Landing (2 tiles de juego) · selector de dificultad (radiogroup) · ruletas tipo slot (`Reel`) · botones de re-spin con contador · cartas NBA (marco por nivel: LEGEND/ALL-STAR/STARTER/ROLE, franja con colores de franquicia) · cartas de fútbol (marco por rareza: Leyenda/Oro raro/Oro/Plata/Bronce) · cancha de básquet SVG/CSS · campo de fútbol SVG con mini-cartas y barra de química · `StatBar` · tablas de liga con zonas · brackets de eliminatorias · vitrina de trofeos · calendario 82 partidos (grid W/L) · histograma Monte Carlo · historial · ajustes.

## Animación
`motion`: revelado escalonado de cartas, pop-in en cancha/campo, ruletas que desaceleran, barras de progreso de temporada, contador de récord, confeti canvas propio (82-0, ≥73 victorias, quadruple). La lógica nunca espera a la animación: el resultado se decide antes y la animación solo lo revela. **Reduced motion**: respeta `prefers-reduced-motion` y el ajuste "Reducir movimiento" (desactiva ruletas y confeti); "Animaciones rápidas" acelera todo.

## Responsive
Desktop-first con rejillas que colapsan a 1 columna; cancha y campo con `aspect-ratio`; tablas con scroll horizontal propio (la página no desborda: verificado a 390 px en e2e).

## Accesibilidad
Botones reales con `aria-label` en posiciones, `role=radiogroup/tab`, foco visible naranja, `role=alert` en errores, colores de resultado acompañados de letra (V/E/D) o texto.
