# Rediseño UX/UI · Ronda 1 — comparativa con el mockup, arquitectura visual y hoja de ruta

**Estado:** entregables previos + primera iteración (R1-1, «Barra compacta») implementada en este PR. **Fecha:** 23 de octubre de 2026, sobre `main` en `799cb70`.
**Referencia:** `freyalab_redise_o_ux_ui_ronda_1_mockups_especificaci_n.html` (aprobado como *referencia*, no como implementación literal).
**No repite** la [auditoría integral](../audit/UX-UI-CONTINUOUS-IMPROVEMENT.md) ni el [diseño del espacio de trabajo flexible](FLEXIBLE-WORKSPACE.md): cita sus hallazgos (UX-03, UX-04, UX-06, UX-11, UX-12, UX-17, UX-20) y sus decisiones D1–D8. Para no confundir identificadores, las iteraciones de esta ronda se llaman **R1-1 … R1-6** (el encargo las nombra UX-01 … UX-06).

> Los números del mockup (1 240 filas, «$4 812 450», «82 %») son **simulados** y no se usan como resultados. Todas las cifras de este documento se midieron en la aplicación real con un CSV sintético de 1 240 filas × 7 columnas (`experiments/ux-redesign/measure-layout.mjs`, §11).

## 1. Comparativa del mockup contra la aplicación real

| Tema | Mockup | `main` antes de este PR (medido) | Decisión |
|---|---|---|---|
| Espacio sobre la primera fila (1440×900) | 104 px (36 + 30 + 38) | **214 px** (48 global + 36 pestañas + 45 + 45 + 40) en 4 franjas; **237 px** a 1280×720 porque la primera franja se parte en dos líneas (68 px) | R1-1: **110 px** en una sola barra (§8). Confirma el hallazgo UX-04 de la auditoría |
| Filas visibles (1440×900 / 1280×720) | — | 19 / 13 | R1-1: **22 / 16** (+16 % / +23 %) |
| Controles en las barras CSV | pocos, agrupados | 23 | R1-1: 22 en una sola fila, con 3 menús |
| Metadatos (codificación, separador, encabezado) | barra de estado | franja propia entre el menú y la tabla | R1-1: barra de estado |
| «Analizar» como botón único | sí | 4 botones que compiten (Consulta avanzada, Análisis, Estadísticas, Gráficos); el panel con 3 pestañas **ya existe** (F2a–F2c) | R1-1: botón **Analizar**; Consulta avanzada pasa al menú Filtrar |
| Etiqueta de filtro activo | chip «Estado = Pagado ×» | contador en «Filtros N» y botón «Quitar filtros y orden» aparte | R1-1: chip «N filtros ×» (el detalle por columna sigue en el menú) |
| Menú de limpieza en la cabecera de columna | sí, con vista previa celda a celda | solo por rango, 5 clics + desplazamiento (hallazgo UX-11) | R1-3 |
| 3 tarjetas de sugerencia de gráfico | sí, reglas locales | lienzo vacío; X = primera columna (hallazgo UX-06); existen *presets* guardados (DW-03a), no sugerencias | R1-4 |
| Mensaje «Copia en memoria · Original intacto» | sí | el motor de tablas mantiene la tabla en memoria hoy, pero **no será cierto** con el motor de archivos grandes ([RFC](LARGE-FILE-EDITOR-RFC.md)) | **No se adopta**: vocabulario de estado en §5 |
| Valores únicos, vacíos, filas ocultas en lenguaje claro | «Celdas vacías», «Filas ocultas por filtro» | «Vacíos exactos», «Ausentes», «Excluidos» (hallazgo UX-13) | R1-3/R1-4 con el resumen |
| Objetivos ≥ 26–28 px y texto ≥ 12 px | sí | texto de 10–11 px, controles < 24 px (hallazgo UX-20) | R1-6; R1-1 no empeora (controles de 28 px; barra de estado a 30 px con controles de 22 px: **desviación declarada**, se corrige en R1-6) |
| Responsive < 1120 px útiles | el panel pasa a «ampliado» | **ya implementado** en F2c/#51 (modo ampliado y arranque cerrado) | nada que hacer |
| Mermaid con plantilla válida y errores en español | sí | lienzo vacío + error en inglés (UX-10) | **fuera de este PR**, propuesta propia (§7) |

## 2. Funcionalidades existentes que deben conservarse

Ninguna se elimina en R1-1; cada una conserva su comando de la paleta (`Ctrl/⌘ + K`) y su atajo.

| Función | Dónde estaba | Dónde está en R1-1 |
|---|---|---|
| Buscar en la tabla (`Ctrl/⌘ + F`) | franja 1 | barra, campo de búsqueda (igual) |
| Reemplazar en el documento (`Ctrl/⌘ + Mayús + F`) | franja 1 | barra, botón **Reemplazar** (mismo nombre) |
| Filtros por columna | franja 1, «Filtros» | menú **Filtrar** → «Filtros por columna» |
| Consulta avanzada | franja 1 | menú **Filtrar** → «Consulta avanzada» |
| Orden numérico | franja 1 | menú **Filtrar** → «Orden numérico» |
| Quitar filtros y orden | franja 1 | chip de la barra y menú **Filtrar** |
| Análisis SQL / Estadísticas / Gráficos | 3 botones | botón **Analizar** → pestañas Resumen · Gráficos · SQL (misma pestaña que la última vez) |
| Operaciones (transformar documento, mayúsculas, minúsculas, quitar espacios) | franja 2, «Operaciones» | menú **Limpiar datos** |
| + Fila, + Columna, Eliminar filas/columna, duplicar | franja 3 y menú Operaciones | menú **Filas y columnas** (con insertar arriba/abajo/izquierda/derecha, que antes solo estaban en la paleta) |
| Copiar como Markdown | barra de selección | menú **Filas y columnas** → «Copiar» |
| Comandos CSV (`Ctrl/⌘ + K`) | botón «Comandos» | botón **Buscar acción** (misma paleta) |
| Codificación, separador, primera fila como encabezado | franja 3 | barra de estado (mismos controles, mismas reglas: bloqueados con cambios sin guardar) |
| Rango seleccionado, acciones del rango, estadísticas rápidas | barra de selección | barra de estado |
| Guardar, Exportar, Deshacer, Rehacer, Abrir, Nuevo | barra global | sin cambios |

## 3. Problemas de distribución (medidos)

1. **Asfixia vertical:** 214 px (24 % de 900) antes de la primera fila; a 1280×720 son 237 px y la tabla solo enseña 13 filas.
2. **La franja 1 se parte en dos líneas** por debajo de ~1100 px útiles (68 px en vez de 45).
3. **Cuatro nombres para un mismo panel** (Consulta avanzada / Análisis / Estadísticas / Gráficos) y «Operaciones» frente a «Comandos» (hallazgo UX-12).
4. **Metadatos que casi nunca cambian** (codificación, separador, encabezado) ocupan una franja entera.
5. **Dos barras inferiores** (barra de selección 34 px + barra de estado 25 px = 59 px).
6. Los menús `<details>` no se cerraban con Escape ni al pulsar fuera (hallazgo UX-17): R1-1 lo corrige en los menús de la barra y de la barra de estado.

## 4. Componentes que pueden reutilizarse

| Necesidad | Ya existe | Uso |
|---|---|---|
| Panel lateral con pestañas, ancho recordado, vista ampliada, teclado | `AnalysisDock.svelte`, `workspace.svelte.ts`, `workspace-layout.ts` | R1-1 solo cambia su botón de entrada |
| Menús desplegables | patrón `details.insert-menu` + `.dropdown` | los tres menús nuevos (sin componente nuevo) |
| Paleta de comandos | `CsvCommands.svelte` | botón «Buscar acción»; también alimenta los elementos de los menús (misma etiqueta, descripción y estado deshabilitado) |
| Vista previa y confirmación de cambios | `CsvRangePreview.svelte` (rango), `CsvTransform.svelte` (documento): antes → después, recuento, confirmar, deshacer | **R1-3 los reutiliza** desde la cabecera de columna; no se escribe otra vista previa |
| Filtros y orden | `CsvQueryTools.svelte` | sin cambios (se abre desde el menú Filtrar) |
| Gráficos y consultas | `CsvCharts.svelte`, DuckDB-Wasm, ECharts, `chart-presets` | R1-4 añade reglas locales de sugerencia encima; sin motor nuevo |
| Estadísticas | `CsvStatistics.svelte`, `CsvColumnAnalysis.svelte`, `simple-statistics` | R1-3/R1-4 cambian el vocabulario, no el cálculo |
| Iconos | `lib/icons.ts` (Lucide copiado) | solo los ya incluidos (embudo, llave, tabla, gráfico, comando, reemplazar) |

Dependencias nuevas: **ninguna**.

## 5. Arquitectura visual propuesta

```text
┌ Barra global (40)  Abrir · Nuevo · [documento] · Deshacer · Rehacer · Guardar · Exportar ┐
├ Pestañas (32) ─────────────────────────────────────────────────────────────────────────┤
├ Barra CSV (38)  Buscar · Reemplazar · Filtrar ▾ · [N filtros ×] · Limpiar datos ▾ ·       │
│                 Filas y columnas ▾ ······················· Buscar acción · Analizar       │
├ Tabla ───────────────────────────────────────────────┬ Panel acoplado (Resumen·Gráficos·SQL) ┤
│  cabecera de columna ▾ (R1-3)                         │  redimensionable · ampliable          │
├ Estado (30)  mensaje · rango/selección · estadísticas rápidas │ Codificación · Separador · Encabezado · Guardado · Local ┘
```

- **Una sola barra de contexto por documento** (38 px) y una sola barra de estado (30 px). Todo lo demás vive en menús, en la paleta o en el panel.
- **Etiquetas con texto** hasta ~1000 px de área útil; por debajo, solo icono con `aria-label` y `title` (comportamiento predecible, sin ocultar funciones).
- **Menús**: se cierran con Escape (el foco vuelve a su botón) y al pulsar fuera.
- **Vocabulario de estado** (no se usa «Copia en memoria»; describe qué puede hacer la persona, no cómo trabaja el motor):

| Estado | Mensaje | Cuándo |
|---|---|---|
| Sin cambios | «Guardado» | documento sin ediciones |
| Edición | «Cambios pendientes» (+ marca en la pestaña) | hay ediciones sin guardar |
| Muestra | «Muestra de solo lectura» | archivo que el motor abre parcialmente (hoy: > 50 MiB) |
| Análisis de solo lectura | «Solo lectura» | documento bloqueado |
| Dataset derivado | «Dataset derivado de <archivo>» | cuando exista (hallazgo 8 de la auditoría; **no se asume implementado**) |
| Vista parcial | «N de M filas» (+ chip de filtros) | filtro, búsqueda u orden activos |

## 6. Hoja de ruta priorizada (iteraciones R1-1 … R1-6)

Ajustada a lo que ya existe en `main`: el panel acoplado (F2a), su ancho recordado (F2b) y la vista ampliada/estrecha (F2c) están hechos, así que **R1-2 se reduce** a pulir lo que R1-1 deja pendiente.

| # | Iteración (encargo) | Contenido | Depende de | Hallazgos que cierra |
|---|---|---|---|---|
| **R1-1** | UX-01 Barra compacta | Barra CSV única, barra de estado, menús agrupados, **Analizar** | — | UX-04, UX-12 (parcial), UX-17 (parcial) |
| R1-2 | UX-02 Panel lateral | Solo lo que falta: foco y anuncios al cambiar de pestaña desde **Analizar**, dock recordado por documento | R1-1 | UX-03 (ya cerrado por F2) |
| R1-3 | UX-03 Limpieza contextual | Menú ▾ en la cabecera de cada columna: ordenar, filtrar, mayúsculas/minúsculas/espacios, duplicados, estadísticas; **vista previa antes → después con recuento y deshacer** reutilizando `CsvRangePreview`/`CsvTransform`; sin cambios silenciosos | R1-1 | UX-11, UX-08, UX-13 |
| R1-4 | UX-04 Gráficos intuitivos | Sugerencias por reglas locales (categoría+número → barras, fecha+número → líneas, número → histograma, dos números → dispersión, categoría+categoría → calor, categoría+número → cajas), sin elegir identificadores como medida, vista en vivo con *debounce*, cancelación y descarte de resultados obsoletos, errores comprensibles | R1-1 | UX-06, UX-07 |
| R1-5 | UX-05 Flexible Workspace | Ventana desacoplada **solo después** de validar el contrato IPC y las solicitudes concurrentes (F4 del diseño) | R1-2, cola de F1 | — |
| R1-6 | UX-06 Accesibilidad | Texto ≥ 12 px, objetivos ≥ 26–28 px (incluida la barra de estado), contraste, foco, roles ARIA, validación 1440×900 / 1280×720 / escalado del sistema / claro y oscuro | todas | UX-20 |

Markdown y Mermaid **no** entran en esta ronda (propuestas aparte, §7).

## 7. Propuestas independientes (no se implementan aquí)

- **Markdown:** barra contextual con inserción visual (tablas, código, enlaces, imágenes), vista dividida y menú de inserción rápida. Reutiliza `Editor.svelte` y el patrón de menús; dependencias: ninguna prevista.
- **Mermaid:** plantilla inicial válida, galería breve, errores en español («Revisa la línea 3…»), zoom y exportación ya existentes. Cierra UX-10.

## 8. R1-1: resultados medidos

| Medida (CSV sintético de 1 240 × 7) | Antes | Después |
|---|---:|---:|
| Espacio hasta la tabla · 1440×900 | 214 px | **110 px** (−104 px, −49 %) |
| Espacio hasta la tabla · 1280×720 | 237 px | **110 px** (−127 px) |
| Alto de la tabla · 1440×900 / 1280×720 | 627 / 424 px | **760 / 580 px** (+21 % / +37 %) |
| Filas visibles · 1440×900 / 1280×720 | 19 / 13 | **22 / 16** |
| Columnas visibles (ancho de la tabla sin panel) | 6 / 5 | 6 / 5 |
| Franjas de controles sobre la tabla | 3 (+ barra de selección y de estado abajo) | **1** (+ una sola barra de estado) |
| Controles en las barras CSV | 23 | 22 (3 de ellos son menús que agrupan 18 acciones) |
| Alto de las barras: global / pestañas / CSV / estado | 48 / 36 / 45+45+40 / 34+25 | **40 / 32 / 38 / 30** |

| Flujo (interacciones) | Antes | Después |
|---|---:|---:|
| Abrir el panel de gráficos (el último abierto fue otro) | 1 | 2 (Analizar + pestaña) |
| Abrir el panel de gráficos (era el último abierto) | 1 | **1** (Analizar recuerda la pestaña) |
| Cerrar el panel | 1 | 1 |
| Ver qué filtros hay activos y quitarlos | leer el contador de «Filtros» + 1 clic en otro botón | **chip permanente** + 1 clic |
| Mostrar los filtros por columna | 1 | 2 (Filtrar + «Filtros por columna») — **coste asumido** de agrupar lo secundario |
| Cambiar la codificación | 2 | 2 (barra de estado) |
| Limpiar una columna entera | 5 + desplazamiento | igual (R1-3) |

Capturas antes/después (`docs/evidence/ux-01-*.png`: claro a 1440×900 y 1280×720, oscuro a 1280×720, menú «Limpiar datos», panel «Analizar» abierto y el editor Markdown con las nuevas alturas). Pruebas: `tests/e2e/compact-toolbar.spec.ts` (5 casos, fallaban en `main`) y el resto de la suite E2E adaptada a los nuevos nombres mediante `tests/e2e/panel.ts`.

**Compromisos conscientes de R1-1:** (1) abrir otra pestaña del panel cuesta un clic más; (2) la barra de estado es de 30 px con controles de 22 px (el mockup pide ≥ 26 px: R1-6); (3) los iconos de la barra se quedan sin texto por debajo de ~1000 px útiles; (4) las pestañas y la barra global son 12 px más bajas en **todos** los editores.

## 9. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | Quien busca «Gráficos» ya no lo ve en la barra | «Analizar» abre el panel con las pestañas Resumen · Gráficos · SQL a la vista; los comandos de la paleta conservan sus nombres; mensaje de ayuda en el título del botón |
| 2 | Las acciones agrupadas en menús son menos descubribles | doble entrada: menú y paleta (`Ctrl/⌘ + K`); la limpieza por cabecera de columna (R1-3) sumará una tercera |
| 3 | El portal de la barra de estado mueve un nodo del DOM fuera de su componente | acción de 3 líneas (`portal`), el nodo se retira al desmontar; prueba de que la barra de estado contiene los controles y de que desaparecen al cambiar de documento |
| 4 | Pruebas E2E acopladas a los nombres antiguos (~150 selectores) | centralizadas en `panel.ts` (`showPanel`, `analyzeButton`, `menuItem`) |
| 5 | Ventanas estrechas: la barra única no cabe | etiquetas ocultas bajo ~1000 px con `aria-label`, sin ocultar funciones |
| 6 | Desviaciones de accesibilidad (texto de 11 px, controles de 22 px en la barra de estado) | declaradas; se corrigen en R1-6 |
| 7 | Las alturas de la barra global y de las pestañas afectan a Markdown y Mermaid | cambio solo de CSS; sin cambios de contenido; revisar capturas de ambos editores antes de fusionar |

## 10. Criterios de aceptación

**R1-1 (este PR):** una sola barra de contexto; tabla a ≤ 110 px del borde superior a 1440×900 y a 1280×720; ≥ 22 / ≥ 16 filas visibles; las 5 acciones principales visibles; ninguna función eliminada (§2); metadatos en la barra de estado; menús con Escape y clic fuera; `npm run check`, `npm test`, `npm run test:e2e` y `npm run build` en verde; sin dependencias nuevas.
**R1-3:** toda transformación desde la cabecera muestra alcance, antes → después, recuento y confirmación, y se deshace con un paso; ningún cambio silencioso.
**R1-4:** gráfico útil en ≤ 2 interacciones sin elegir identificadores como medida; actualización con *debounce*, cancelación y resultados obsoletos descartados; errores en español.
**R1-6:** texto ≥ 12 px, objetivos ≥ 26 px, contraste AA, foco visible y navegación completa por teclado en 1440×900, 1280×720, ambos temas y escalado del sistema.

## 11. Cómo se midió

`experiments/ux-redesign/measure-layout.mjs` (Playwright + Electron, ventana de 1440×900 y 1280×720, CSV sintético de 1 240 filas, tema claro): `getBoundingClientRect` de cada franja, de la tabla y de las celdas totalmente visibles (la misma definición que usan `analysis-dock.spec.ts` y `compact-toolbar.spec.ts`). Las cifras de «antes» se tomaron de `main` (`799cb70`) recién construida.

## 12. Comprobación con los archivos de prueba del usuario

Con `/private/tmp/FreyaLab-pruebas/` (21 columnas; acentos, comillas, saltos de línea y vacíos; el informe de validación del usuario da 45 000 / 448 000 / 4 587 000 / 46 000 filas) y la compilación de este PR:

| Archivo | Resultado en FreyaLab |
|---|---|
| `ventas_10MiB.csv` (45 000 filas) | se abre completo en ~0,6 s; barra única a 110 px, 22 filas visibles, barra de estado con codificación, separador y encabezado (`ux-01-despues-1280x720-oscuro.png`) |
| `ventas_100MiB.csv` (448 000 filas) | se abre como **muestra de solo lectura de 200 filas** en ~3 s con el aviso «El archivo supera 50 MiB…»: es el límite actual del motor (`TABLE_LIMITS.bytes`), no un defecto de R1-1; lo aborda el [RFC del editor de archivos grandes](LARGE-FILE-EDITOR-RFC.md) |
| `ventas_1GiB.csv`, `ancho_150_columnas_50MiB.csv` | misma muestra de 200 filas (superan 50 MiB); 1 GiB no se abrió en la aplicación en esta ronda |

**Hallazgo ajeno a este PR (ya presente en `main`):** al abrir `ventas_10MiB.csv` aparece a veces el aviso «La tabla ya no está abierta.» justo después de abrirlo (4 de 6 aperturas en `main` sin cambios y 4 de 6 con este PR, con `experiments/ux-redesign/probe-open-toast.mjs`); la tabla se muestra bien y el aviso es inofensivo, pero es un fallo de carrera entre la apertura y la primera petición de la interfaz que conviene corregir aparte.
