# AN-2 · Propuesta de adaptación E2E legacy

Registro original del agente revisor: el parche preparado en `/private/tmp/an2-legacy-test-nav.patch` pasó `git apply --check`. Posteriormente se aplicó y quedó incorporado en 9ee37a9; este ledger conserva la comparación estática previa a su aplicación.

## Cambios por línea original

- `tests/e2e/panel.ts:54–59,76–84`: `openColumnExplorer` usa `showPanel`; `showPanel(Estadísticas)` abre `.advanced-statistics` solo si aún está cerrado. Abrirlo no pulsa Analizar ni Calcular.
- `tests/e2e/ui.spec.ts:9,217–220`: añade `openAnalysis`; verifica foco natural del H2 antes del clic en Más estadísticas, conservando la misma aserción de foco y todas las cifras posteriores.
- `tests/e2e/statistics-reports.spec.ts:15,20,31,33`: selección explícita del informe detallado en dos llamadas legacy y dos aserciones de botón deshabilitado; explorador conserva Markdown. PDF/HTML, recuperación, tablas, límites y contenido esperado se conservan.
- `tests/e2e/descriptive-percentiles.spec.ts:25,45`: informe detallado únicamente para estadísticas generales; perfil conserva Markdown. No se cambian percentiles, varianzas, precisión, procedencia ni valores esperados.
- `tests/e2e/analysis-tab.spec.ts:75,125,142,150`: entradas directas abren Más estadísticas. Se añaden una comprobación del botón Calcular y dos comprobaciones de llamadas `['save']`, antes y después de abrirlo; se conservan la comprobación del botón Analizar y la comprobación posterior de llamadas ya existentes. Estado de invalidación queda acotado a la región legacy para evitar los dos estados visibles. Cancelación y cifras 30/110/130 intactas.
- `tests/e2e/project-source.spec.ts:1,136,141`: entrada directa al avanzado por el helper y etiqueta detallada. Se conservan las comprobaciones de fuente protegida completa y ausencia de MUESTRA LIMITADA; informe del perfil sigue Markdown.
- `tests/e2e/ui-u0.spec.ts:1,145,150`: abre el avanzado y mide su botón `.legacy-statistics`; evita el selector ahora ambiguo de dos formularios. Se conservan idiomas, mediciones, spinner de 12 px y aserciones de anchura/carga.

## Ledger de identidades y aserciones

Conteo estático, sin ejecutar pruebas. Las identidades `test(...)`, etiquetas y entradas de timeout permanecen iguales; solo se añaden tres `expect(...)` descritos arriba.

| Archivo | test | expect | expect.poll |
| --- | --- | --- | --- |
| `tests/e2e/panel.ts` | 0 → 0 | 9 → 9 | 0 → 0 |
| `tests/e2e/ui.spec.ts` | 23 → 23 | 246 → 246 | 10 → 10 |
| `tests/e2e/statistics-reports.spec.ts` | 4 → 4 | 49 → 49 | 4 → 4 |
| `tests/e2e/descriptive-percentiles.spec.ts` | 3 → 3 | 45 → 45 | 1 → 1 |
| `tests/e2e/analysis-tab.spec.ts` | 7 → 7 | 62 → 65 | 4 → 4 |
| `tests/e2e/project-source.spec.ts` | 6 → 6 | 86 → 86 | 0 → 0 |
| `tests/e2e/ui-u0.spec.ts` | 10 → 10 | 91 → 91 | 3 → 3 |

Otros callers inspeccionados sin cambios: `analysis-dock.spec.ts` y `column-menu.spec.ts` abren avanzado mediante entrada contextual (`entry`); `selection-statistics.spec.ts` queda cubierto por `showPanel`; llamadas de SQL y exploración mantienen Abrir informe Markdown. `analysis-describe.spec.ts` usa `openAnalysis`, que conserva el acceso al nuevo flujo sin desplegar avanzado.

No se ejecutaron GUI, compilación ni pruebas. El verde requiere aplicación y validación del padre.
