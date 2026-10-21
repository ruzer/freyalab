# Evidencia

Los workflows adjuntan informes E2E, capturas, resultados de instalación y checksums como artefactos de GitHub Actions. Estos documentos no afirman que los jobs se hayan ejecutado.

Cada evidencia debe identificar commit, plataforma, arquitectura, versiones, comando y resultado. Distinguir: análisis estático, prueba local, CI, paquete ejecutado, instalador comprobado y publicación.

`RELEASE-CHECKLIST.md` es una plantilla pendiente. Las mediciones de rendimiento se generan con `node scripts/performance.mjs`; su salida queda en `test-results/performance.json`, no en el repositorio salvo incorporación explícita y revisada. Los documentos privados nunca se usan como fixtures.

Observación local inicial: [20 de octubre de 2026](local-2026-10-20.md). No sustituye la verificación del commit final ni las comprobaciones multiplataforma.

Integración local más reciente: [12 E2E con Node 24](integration-node24-2026-10-20.md). Los gates de CI y distribución se registran por separado.

## Alfa publicada

- [v0.1.0-alpha.1: gates, entornos y límites](release-v0.1.0-alpha.1.md).
- [Checklist y SHA-256](RELEASE-CHECKLIST.md).
