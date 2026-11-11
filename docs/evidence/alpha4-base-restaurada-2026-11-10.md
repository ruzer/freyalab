# Alpha.4 · Base local con funciones aprobadas recuperadas

La rama local `codex/alpha4-base-funciones` recupera AN-1a, PRJ-01a, PRJ-01b y TXT-02a. El código evaluado es `fb2c73c`. AN-1b continúa como entrega separada.

## Base y procedencia

Se partió de `3cfbf97b3a9e0d90cfddfce6ca53def31a5813a8` y se fusionó `origin/main` en `4dba4dbe1885c589f1849a7f555b16a9e95b76eb`. Ese merge produjo `e293d5b` y solo añadió documentación. Antes de recuperar funciones, esta comparación terminó con código 0:

```sh
git diff --exit-code f949c22 e293d5b -- . ':(exclude)docs/**'
```

Se recuperaron los commits explícitos con `git cherry-pick -x`, conservando su procedencia. No se copiaron los rangos completos de ramas con cambios ajenos.

| Bloque | Original | Recuperado |
|---|---|---|
| AN-1a · modelo y pruebas | `08ea05e` | `df24a95` |
| AN-1a · interfaz | `0296103` | `ae66465` |
| AN-1a · título estrecho | `a446474` | `a28a925` |
| AN-1a · evidencia | `56e62d0` | `791c313` |
| AN-1a · prioridad SQL y cierre de pruebas | `6930af7` | `6ca540e` |
| PRJ-01a · proyecto | `8667b95` | `9af91ca` |
| PRJ-01a · errores y preservación | `3622daf` | `bf0cee1` |
| PRJ-01a · diagnóstico traducido | `b37a97e` | `cf0b93c` |
| PRJ-01a · evidencia | `2278a0c` | `cd32d91` |
| PRJ-01b · fuentes protegidas | `d4f98fb` | `df2c69a` |
| PRJ-01b · evidencia | `df371a8` | `7eb7f5b` |
| PRJ-01b · ayuda del límite de 10 MiB | `35c3b5d` | `1ce5067` |
| PRJ-01b · cierre acotado | `01bdb3d` | `a3f9e86` |
| TXT-02a · colores por columna | `4a982ae` | `fb2c73c` |

`6ca540e` coincide con el código de `6930af7`, `cd32d91` con `2278a0c` y `a3f9e86` con `b96064f`, comparando todo el árbol salvo documentación con `git diff --exit-code`.

La genealogía real de TXT-02a es `ec792b6 → facee790 → 4a982ae`. No parte de `c07b3f8`. La historia que añadió `facee790` ya existe, byte por byte, en esta base, por lo que solo se recuperó el commit funcional `4a982ae`.

## Integración de TXT-02a

Hubo tres conflictos de contexto con las funciones ya recuperadas:

- En `App.svelte` se conservaron tanto las props de colores del editor como los callbacks y el estado de la pestaña Análisis.
- En `documents.ts` se conservó el formato fijado de las fuentes protegidas al abrir Tabla y se añadió la información de separador y encabezado al abrir Texto.
- PRJ-01b ya había extraído `metadata()` desde `table-engine.ts` hacia `csv-file-format.ts`. La sustitución original por `csvDelimiter()` se aplicó en esa ubicación. Se conservan las validaciones y mensajes traducidos del formato, y no se reintroducen las funciones antiguas duplicadas.

El analizador de colores, los componentes Editor y EditorStatus, editor-editing, los ajustes y sus unitarias coinciden con los archivos originales de TXT-02a. No se añadieron dependencias ni cambios de versión o de CI. La documentación reciente de main se conserva.

## Validación local del código combinado

macOS Apple silicon, Node.js 24, perfiles temporales y datos sintéticos. Las comprobaciones finales se ejecutaron sobre `fb2c73c`.

| Comprobación | Resultado |
|---|---|
| `npm run check` | 0 errores y 0 avisos |
| `npm run build` | Completado |
| Unitarias enfocadas | 257/257 en 14 archivos, 3,11 s |
| E2E combinadas | 39/39, 57,9 s, 1 worker, 0 reintentos |
| Integridad de Git | `git diff --check` sin errores |

Las E2E cubrieron los seis recorridos de AN-1a, cinco de PRJ-01a, cinco de PRJ-01b, 22 de CSV Texto y el comando SQL existente por teclado. Incluyeron fuentes protegidas, copia exacta, cambios externos y reenlace por huella, versión futura intacta, cancelación, recuperación UTF-16 con BOM, archivos malformados, límite de 10 MiB, encabezado y celda rechazados, colores, filas irregulares y desplazamiento hasta la columna 200.

Comando de unitarias:

```sh
npx vitest run tests/workspace-tabs.test.ts tests/csv-analysis-view.test.ts tests/application-menu.test.ts tests/project.test.ts tests/project-sources.test.ts tests/document-csv-view.test.ts tests/csv-column-colors.test.ts tests/settings.test.ts tests/csv-text-codec.test.ts tests/csv-text-model.test.ts tests/csv-view-store.test.ts tests/table-engine.test.ts tests/calculated-csv-save.test.ts tests/e2e-close-electron.test.ts
```

Comando E2E, después de construir:

```sh
npx playwright test --project=shell --project=csv tests/e2e/analysis-tab.spec.ts tests/e2e/project.spec.ts tests/e2e/project-source.spec.ts tests/e2e/csv-text.spec.ts tests/e2e/commands.spec.ts --grep 'analysis-tab.spec.ts|project.spec.ts|project-source.spec.ts|csv-text.spec.ts|muestra bloquea edición y copia' --workers=1 --retries=0
```

Antes de recuperar Proyectos y TXT se verificó además AN-1a por separado en `6ca540e`: 34/34 unitarias y 7/7 E2E sin reintentos, 16,2 s, con tipos y construcción correctos. La tanda final comprueba su integración con los demás bloques.

## Pendiente

Esta evidencia corresponde a trabajo local. No se ejecutaron la suite E2E completa, el empaquetado, CI multiplataforma, lectores de pantalla ni nuevas mediciones de rendimiento de 10 MiB o huella de 1 GiB. Las mediciones históricas recuperadas conservan su fecha y su contexto original. La nueva combinación necesita su calificación antes de publicarse. El panel lateral y «Resumen y gráfico» siguen presentes hasta la entrega AN-1b.
