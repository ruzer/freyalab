# Evidencia

Los workflows adjuntan informes E2E, capturas, resultados de instalación y checksums como artefactos de GitHub Actions. Estos documentos no afirman que los jobs se hayan ejecutado.

Cada evidencia debe identificar commit, plataforma, arquitectura, versiones, comando y resultado. Distinguir: análisis estático, prueba local, CI, paquete ejecutado, instalador comprobado y publicación.

`RELEASE-CHECKLIST.md` es una plantilla pendiente. Las mediciones de rendimiento se generan con `node scripts/performance.mjs`; su salida queda en `test-results/performance.json`, no en el repositorio salvo incorporación explícita y revisada. Los documentos privados nunca se usan como fixtures.

Observación local inicial: [20 de octubre de 2026](local-2026-10-20.md). No sustituye la verificación del commit final ni las comprobaciones multiplataforma.

Integración local inicial: [12 E2E con Node 24](integration-node24-2026-10-20.md).

Desarrollo DW-04b: [vista general de columnas](csv-column-overview-2026-10-22.md), con pruebas, mediciones y límites propios. Los gates de CI, paquete e instalación se registran por separado.

## Alfa publicada

- [v0.1.0-alpha.1: gates, entornos y límites](release-v0.1.0-alpha.1.md).
- [Checklist y SHA-256](RELEASE-CHECKLIST.md).

DW-04c: [varianza y percentiles](descriptive-percentiles-2026-10-22.md), con controles progresivos, métodos compartidos e informes completos.

I0 y E1: [contrato tipado y extracto no destructivo de archivos grandes](i0-e1-extracto-2026-10-25.md), con medición de 100 MiB y 1 GiB, bytes idénticos al oráculo y límites propios.

M3: [aislamiento, integración con Electron, memoria, empaquetado y firma de DuckDB nativo](m3-aislamiento-2026-10-25.md), con CI en las cuatro plataformas, hallazgos de Windows y límites propios.
