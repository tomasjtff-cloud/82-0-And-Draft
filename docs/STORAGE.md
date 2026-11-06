# Almacenamiento local (sin cuenta)

| Clave | Contenido |
|---|---|
| `ll:settings:v1` | Preferencias |
| `ll:history:v1` | Historial (200 entradas) con snapshots de XI/quinteto |
| `ll:progress:v1` | **Registro de progreso**: temporadas compactas (≤ 1 000 por juego), drafts (≤ 3 000), logros desbloqueados, nombre de perfil |
| `ll:nba:*`, `ll:fb:session:v1` | Partidas en curso, identidad NBA, mejor récord |

- Récords, salón de la fama, sala de trofeos y progreso de logros se **derivan** del registro (no se guardan dos veces).
- **IndexedDB no se usa**: un registro ocupa ~0,7 KB (peor caso ~1,4 MB), se lee de forma síncrona al arrancar y localStorage basta; menos código y menos riesgo.
- **Migración**: la primera vez se convierten las entradas del historial con snapshot en registros `legacy` (solo datos de equipo) y se desbloquean logros retroactivos con la fecha original.
- **Exportar/Importar** (Ajustes): JSON `legends-lab-progress` v1 con progreso, historial y preferencias. Al importar se valida formato, versión, ids, fechas y tamaño (nada se ejecuta). *Combinar* une por id sin duplicar (la fecha de logro más antigua gana); *Reemplazar* descarga antes una copia de seguridad.
- La estructura permite añadir sincronización en la nube en el futuro sin cambiarla.
