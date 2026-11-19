# SIM-1d · Sugerencias de gráfico con sentido

Base fija: `main 0260a5d05341e98a8ea97d5ced7330aa97f413c4`. Rama independiente `codex/sim-1d-sugerencias-con-sentido`; SIM-1c continúa en su propia rama. Contrato: sección SIM-1d de la historia íntegra ya presente, SHA-256 `c0e45fd395cb147f9a278699b9f45c9a6da93f88a0ab72d87b91e7155afd257f`.

## Alcance previo a producto

Con Filas y Valores vacíos, si existe una categoría o texto categorizable, `initialChart` propone contar sus filas sin elegir una medida numérica: «Número de filas por Ciudad». La propuesta sigue separada de las zonas elegidas y del cálculo: `CsvCharts` conserva su acción Crear; abrir Gráficos no ejecuta el gráfico.

Al elegir una categoría o texto en Filas y una columna numérica en Valores, `suggest` y el predeterminado de `addToZone` coinciden en `aggregate:'average'`. Fecha ISO con número conserva Suma y agrupación mensual; dos números conservan dispersión. Un perfil identificador nunca se convierte en medida numérica. Las selecciones inexistentes, perfiles inciertos, nombres duplicados, Unicode, límites y alternativas conservan sus validaciones actuales. La función pura `suggest(columns,{})` puede conservar `null`: no representa una selección de oficio.

Decisión de raíz del 2026-11-19, antes de producto: añadir o reemplazar Valores sigue reiniciando el cálculo como hoy. Solo cambia el predeterminado de número por categoría, de Suma a Promedio. Cambiar Filas o Columnas conserva la agregación actual —incluida Suma elegida explícitamente— salvo la normalización actual a conteo de un mapa de calor. No se añade metadata ni persistencia para inferir intención. Suma permanece disponible mediante el selector existente.

## Superficies y conservación

`src/shared/chart-suggest.ts` define la sugerencia; `chart-fields.ts` define `initialChart` y `addToZone`. Sus únicos consumidores de producto están en `CsvCharts.svelte`: propuesta inicial, arranque legado y adición de campo. Se reutilizan `chartLabels`, opciones, perfiles y SQL existentes. Los textos explicativos deben seguir describiendo la agregación propuesta en es/en y en-XA.

Se conservan las 49 combinaciones de perfiles y todos los datasets existentes. Los casos que requieren una medida ya elegida se preparan como tal, para comprobar su mismo comportamiento sin depender del predeterminado retirado. La equivalencia SQL por categoría pasa a comprobar Promedio, conservando también un caso explícito de Suma. Las comprobaciones de fecha+número, dispersión, identificadores y datos originales permanecen.

Antes de modificar producto se escriben unitarias rojas de conteo inicial, propuesta Promedio y primera adición numérica. Una encuesta sintética independiente incluirá identificadores con ceros/enteros inseguros, categorías repetidas, ingresos numéricos distintos y un ingreso vacío. Sus conteos, sumas y medias se fijan en el oráculo de prueba, sin usar el motor del producto para calcular lo esperado. Después raíz conserva el rojo. En esta preparación no se construye, no se ejecuta GUI, no se publica un PR y no se modifica producto.

## Siete respuestas del ADR 0021

1. **Does a tool already do this?** `suggest`, `initialChart`, `addToZone`, los perfiles y `chartLabels` ya producen la propuesta y las opciones válidas. Se ajustan esos puntos compartidos; no otro recomendador.
2. **Is there a skill we can reuse?** TDD para fijar rojo antes de producto, diagnóstico de callers y Ponytail para el cambio mínimo que cubre tanto propuesta como selección real.
3. **Can it be integrated through CLI, API, or MCP?** Bastan las funciones puras y el formulario existentes. Sin IPC, API, red ni servicio nuevos.
4. **How mature, secure, and maintained is it?** Se reutilizan TypeScript, perfiles, validación y dependencias fijadas del proyecto. Se preservan índices por posición, identificación conservadora, límites y escape de SQL.
5. **What maintenance cost does it add?** Un predeterminado coherente en dos rutas y sus pruebas. No añade caché, preferencia, metadata de intención ni otra colección de datos de usuario.
6. **What is the minimum glue LAB must write?** Conectar la propuesta existente de conteo y el promedio por categoría en FreyaLab. LAB no cambia; motor, SQL, guardado, originales y dependencias quedan fuera del cambio.
7. **Does writing our own code add value?** Evita elegir automáticamente una suma sin significado y hace que la propuesta coincida con el cálculo al añadir Valores, conservando el control explícito de la persona.

Estado de este primer commit: solo alcance y ADR, antes de escribir las nuevas pruebas y antes de cambiar producto. Ningún resultado rojo, verde o de CI se atribuye todavía a SIM-1d.
