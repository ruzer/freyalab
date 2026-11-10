# TXT-02a · Colores por columna

## Pruebas locales

- Rojo en `3a2404a`: el CSV sintético entrecomillado de siete columnas mostró peso 400 en el encabezado en lugar de 500. La prueba esperaba el formato nuevo.
- Verde sobre `ec792b6`: 115 unitarias de analizador, modelo de texto, modo CSV, ajustes y editor. Seis E2E enfocadas de CSV Texto sin reintentos. Verifican colores calculados, encabezados editables, cursor y tinte, comillas, salto multilínea lejano, TSV, punto y coma, filas irregulares, desplazamiento horizontal hasta la columna 200 y persistencia tras reiniciar.
- El guardado del CSV de prueba con BOM UTF-8 y CRLF conservó el SHA-256. Las capturas usan datos sintéticos de siete columnas.
- macOS arm64 27.0.1, Node 24. `npm run check`, `npm run build` y `git diff --check` completados localmente.

[Claro, 1440×900](txt-02a-colores-claro-1440.png) · [Oscuro, 1440×900](txt-02a-colores-oscuro-1440.png)

## Contraste

Valores mínimos de las seis tintas por tema, calculados con la fórmula WCAG y la composición de los fondos de CSS. En la E2E se cotejaron los doce colores finales mediante `getComputedStyle`.

| Fondo | Claro | Oscuro |
|---|---:|---:|
| `--bg` | 6,29:1 | 9,37:1 |
| Fondo real del editor, `--code` | 6,03:1 | 9,37:1 |
| Línea activa | 5,69:1 | 8,72:1 |
| Columna actual | 5,41:1 | 7,85:1 |
| Línea activa y columna actual | 5,12:1 | 7,25:1 |
| Selección enfocada | 4,06:1 | 4,80:1 |
| Selección enfocada y columna actual | 3,72:1 | 4,15:1 |

La selección clara conserva 4,33:1 para el azul y 4,06:1 para el rojo antes de aplicar el tinte. La posición también se muestra en texto, con nombre accesible, cuando se desactivan los colores.

## Medición de 10 MiB

Archivo ASCII sintético de 10.485.760 bytes, 200 columnas y 5.824 filas de datos. Se abrió directamente en Texto en una ventana de 1440×900, con un perfil nuevo por muestra. Se midió apertura hasta dos cuadros tras montar el editor, salto por «Ir a línea» a la línea 2912 y una pulsación que sustituyó un carácter en esa línea. La pulsación se midió desde `keydown` hasta dos cuadros.

| Variante | Apertura (ms) | Salto (ms) | Pulsación (ms) |
|---|---:|---:|---:|
| `main ec792b6`, muestra 1 | 201 | 78 | 23 |
| `main ec792b6`, muestra 2 | 205 | 82 | 23 |
| `main ec792b6`, muestra 3 | 190 | 82 | 23 |
| TXT-02a, muestra 1 | 233 | 157 | 58 |
| TXT-02a, muestra 2 | 230 | 170 | 55 |
| TXT-02a, muestra 3 | 241 | 123 | 64 |

Medianas de apertura 201 → 233 ms, salto 82 → 157 ms y pulsación 23 → 58 ms. Una primera versión dibujaba las 200 columnas en cada línea del viewport y llegó a medianas de 371 ms para el salto y 119 ms para la pulsación. El pintado final recorta las decoraciones al viewport con un margen horizontal. Las líneas físicas de más de 10.000 caracteres se dejan sin color, conservando el estado de comillas para las líneas posteriores.

Queda pendiente la CI remota. La medición local describe este equipo y archivo de prueba.
