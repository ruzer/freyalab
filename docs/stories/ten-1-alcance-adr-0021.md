# TEN-1 · Alcance y reutilización

Base inicial: `a8dfc7f8b27871f3a7288cc8b3f536a583859c8e`. La historia autorizada está en el PR documental #165, con SHA-256 `f139e5a7dd9cb8472cae1398423f3e0ec99fd7b02b9a163b6892c6d556bf8b89`; se conserva intacta. Esta nota se registra antes del código.

## Alcance mínimo

Una opción de tendencia para la dispersión sin series. DuckDB calcula sobre los mismos pares numéricos y filtros del gráfico antes del límite de dibujo. La consulta existente devuelve además pendiente, ordenada, R², r, n y los extremos necesarios para dibujar la recta; no se añade un trabajo ni canal IPC. ECharts reutiliza una serie de línea. La interfaz y las exportaciones comparten la interpretación de los resultados.

Se conservan cancelación, revisión, origen real, límites, presets anteriores, CSV estándar y la pareja CSV/contexto JSON. La opción no calcula en otros tipos ni con «Separar por». No hay nuevos motores, dependencias, ajustes, regresiones adicionales, valores p ni intervalos.

## Precisiones de implementación

- TEN-1 usa sus cuatro cifras significativas explícitas; AN-2 conserva sus cuatro decimales. `formatNumber` mantiene el formato del idioma actual: `es-MX` usa punto decimal. Los títulos accesibles y las exportaciones conservan la precisión completa.
- La tendencia describe la fuente real del gráfico. Cuando SQL lee el original completo desde disco aunque el editor muestre una muestra, no se afirma que la tendencia use esa muestra. Se conserva y comprueba la procedencia existente.
- El objeto `trend: {slope, intercept, r2, r, n}` se incorpora al JSON normal y al JSON de contexto del CSV. El CSV sigue siendo estándar, sin filas de metadatos propietarias.
- Los valores NULL/no finitos se presentan como no disponibles. Con Y constante, R² es no aplicable aunque DuckDB devuelva 1. La ausencia de recta conserva marcada la opción y explica su causa.

## Siete respuestas del ADR 0021

1. **Does a tool already do this?** DuckDB calcula la regresión y ECharts dibuja la línea; `simple-statistics` aporta el oráculo de pruebas.
2. **Is there a skill we can reuse?** Se reutilizan el cambio mínimo, rojo/verde, accesibilidad y los patrones locales de pruebas SQL/exportación; no se instala ninguna herramienta.
3. **Can it be integrated through CLI, API, or MCP?** Se usan las bibliotecas y el puente SQL existentes. Las herramientas de desarrollo permanecen fuera del producto.
4. **How mature, secure, and maintained is it (release cadence, maintainers, license)?** Se mantienen las versiones fijadas: DuckDB-Wasm 1.33.1-dev57.0 (MIT), ECharts 6.1.0 (Apache-2.0) y simple-statistics 7.12.1 (ISC), con el aislamiento y las validaciones existentes. No se decide una adopción nueva.
5. **What maintenance cost does it add?** Una opción, resultados agregados opcionales y su presentación/serialización. Se preserva literalmente el SQL anterior cuando la opción no aplica.
6. **What is the minimum glue LAB must write?** Extender el resumen y parser del gráfico, conectar casilla/línea/texto y admitir la opción en la validación de presets/exportaciones.
7. **Does writing our own code add value?** Integrar la capacidad permite describir la relación en FreyaLab. Reimplementar la regresión o calcular sobre los puntos limitados no aporta valor.

## Verificación prevista

Rojo primero con los cinco puntos y tolerancia 1e-12 frente al oráculo. Después: X/Y constantes, menos de tres pares, no finitos/exclusiones, pendiente negativa, filtros, bloqueo con series, cancelación/revisión y ausencia de cálculo al entrar. El fixture generado de 300 000 filas compara la tendencia de toda la fuente con el oráculo y demuestra que no depende de los 2 000 puntos dibujados. Se comprueban presets, SVG/PNG, JSON, contexto CSV, Markdown, teclado y capturas claro/oscuro es/en-XA. No se debilitan las comprobaciones existentes.
