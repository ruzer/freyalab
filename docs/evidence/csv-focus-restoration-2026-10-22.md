# CSV: restauración de foco sin repetir el desplazamiento

Fecha: 2026-10-22. Base: `98eeb0b42bdbd986d891413b21a32e01aa8fdffd` (PR #35).
Entorno local: macOS 27.0.1, Apple silicon, Node 24, Electron 44.9.2; una aplicación de prueba y un worker de Playwright.

## Fallo comprobado

Después de cerrar un diálogo de rango sobre una selección que termina en otra página virtualizada, la petición `pendingCell` seguía activa aunque la celda ya había recibido el foco. Cambiar después el foco a la grilla y desplazar cuatro filas, manteniendo la celda dentro del margen virtualizado, volvía a enfocar la celda anterior y revertía el desplazamiento.

El caso mínimo usa 300 filas y el diálogo real. Espera explícitamente el foco de la última celda antes del nuevo desplazamiento, por lo que comprueba una petición ya satisfecha. La instrumentación temporal registró llamadas repetidas a `focus()` y el regreso del scroll; se eliminó antes del commit. El nuevo caso falló 3 de 3 veces con la implementación anterior.

La prueba original de cancelación con 50.000 filas pasó 21 de 21 veces en este Mac. Este resultado no reproduce por sí solo el fallo intermitente del paquete Linux observado en PR #34; la comprobación de ese entorno queda a CI.

## Corrección compartida

La restauración espera a que termine la carga de página y vuelve a comprobar ese estado tras `tick()`. Esto evita consumir la petición en una fila que una carga pendiente vaya a reemplazar. Cuando la celda recibe realmente el foco, consume la petición; los cambios posteriores del virtualizador dejan de recuperarlo.

Se conserva el mismo camino para navegación de teclado y cierre de menús, transformaciones y diálogos de rango. No cambia el motor, la selección, el guardado, los valores CSV ni las dependencias. No se amplían tiempos ni se relajan aserciones.

## Comprobaciones locales

- `npm run check`: 0 errores y 0 advertencias.
- `npm test`: 174 pruebas en 18 archivos aprobadas.
- `npm run build`: aprobado.
- Regresión de foco y desplazamiento: 10 de 10 repeticiones aprobadas (10,7 s en total).
- Flujos relacionados de rangos, paleta, menús estructurales, transformaciones y teclado: 20 de 20 aprobados (20,9 s).
- Paquete real macOS arm64 (`electron-builder --dir`): 13 de 13 flujos de paleta, rangos y teclado aprobados (16,3 s), incluida la regresión.
- La regresión comprueba foco, posición exacta de scroll, metadatos del documento y contenido del archivo original.

Pendiente de CI: suite completa y paquete en Linux, Windows, macOS Intel y Apple silicon. El paquete local se usa únicamente para pruebas; no reemplaza la aplicación instalada ni valida un instalador.
