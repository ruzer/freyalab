# Construcción de FreyaLab

La referencia es `docs/design/reference.html`; conservar su diseño y reemplazar simulaciones por comportamiento real. Proyecto independiente de LAB, sin copiar historia ni configuraciones privadas.

## Entregas y dependencia

Las siete entregas se integran en orden. Cada PR incluye contexto, resultado, comprobaciones, limitaciones y cómo revertirlo. Un cambio posterior depende de los contratos de la entrega anterior; el trabajo interno independiente puede desarrollarse en paralelo, sin presentar entregas sin verificar como cerradas.

| Entrega | Construcción | Cierre verificable |
|---|---|---|
| 1 | Repositorio MIT, base Electron/TS/Svelte, recursos locales, diseño y CI | Ventana y ambos temas; referencias conservadas; CI básica funcional |
| 2 | Abrir/crear, árbol bajo demanda, pestañas, recientes, guardado y recuperación | Roundtrip, cierre con cambios, conflicto externo, recuperación sin sobrescribir |
| 3 | CodeMirror, Markdown, índice, fórmulas, Mermaid embebido y primer PDF | Edición real y PDF multipágina con contenido completo |
| 4 | Motor CSV separado, virtualización, edición, filtros, búsqueda, estadísticas y muestra | Datos preservados, límites explícitos y UI responsive con fixture 50 MiB |
| 5 | Mermaid individual y SVG/PNG/PDF, HTML autónomo y exportaciones tabulares | Resultados utilizables fuera de FreyaLab; exportación no limpia cambios |
| 6 | Fidelidad visual, accesibilidad, seguridad, errores, cancelación y mediciones | Capturas revisadas, escenarios adversos probados y rendimiento documentado |
| 7 | Paquetes, ejecución, instalación y prerelease | Artefactos comprobados del mismo main, checksums y evidencia por plataforma |

## Comprobaciones de cada PR

```sh
npm ci
npm run check
npm test
npm run test:e2e
npm run build
```

La CI Linux usa Xvfb para E2E. `npm run licenses` genera avisos de producción; `npm run dist` empaqueta en el sistema de ejecución. El E2E usa perfiles temporales y archivos sintéticos, nunca datos del usuario.

## Reversión

Revertir el PR mediante Git; no eliminar documentos, sesiones o recuperaciones del usuario como parte de la reversión. Mantener recuperaciones de versiones desconocidas y mostrar la incompatibilidad en vez de borrarlas. Los cambios de formato de persistencia se versionan antes de integrarse.

## Pruebas esenciales

- Persistencia: fallos, permisos, conflictos externos, cierre con cambios, caída y recuperación.
- CSV: ceros, fechas textuales, codificaciones, BOM, delimitadores, comillas, campos multilínea, encabezados duplicados, sort/filtro y edición con identificadores estables.
- Límites: 50 MiB, dos millones de celdas, registro 1 MiB; muestra de 200 registros/8 MiB sin truncamientos presentados como datos válidos.
- Documentos: imágenes relativas, fórmulas, bloques Mermaid válidos/erróneos y PDF con varias páginas.
- Aislamiento: Node ausente en renderer, IPC validado, contenido saneado y exportación aislada.
- Visual: claro/oscuro a 1280×800 y 1440×900 frente a la referencia.

## Medición

Registrar sistema, arquitectura, CPU, RAM, revisión y versiones. Medir arranque, apertura de Markdown, CSV 50 MiB, filtros, orden y memoria. El objetivo de respuesta visual durante trabajo de fondo es inferior a 200 ms en el equipo de referencia; no es una garantía universal ni un gate rígido en máquinas compartidas.

## Publicación

Ver `DISTRIBUTION.md`. Ausencia de CI obligatoria bloquea publicar; no impide continuar desarrollo y comprobaciones locales. Una construcción correcta no se equipara con ejecución, instalación o verificación de otra plataforma.
