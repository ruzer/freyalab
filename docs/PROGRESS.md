# Estado de implementación

Este registro separa código escrito de comprobaciones y publicación. Las casillas solo se marcan con evidencia concreta enlazada al commit o ejecución correspondiente.

| Entrega | Implementación | Verificación | Evidencia |
|---|---|---|---|
| 1. Repositorio y base visual | Implementada | Local satisfactoria; CI en revisión | [PR #1](https://github.com/ruzer/freyalab/pull/1), capturas en evidence/screenshots |
| 2. Archivos y recuperación | Implementada | E2E local y paquete macOS arm64 satisfactorios | [Integración](evidence/integration-node24-2026-10-20.md) |
| 3. Markdown y PDF | Implementada | PDF multipágina y recorrido UI satisfactorios | Integración y capturas |
| 4. CSV/TSV | Implementada hasta límites de alfa | Pruebas de motor e integración satisfactorias | 14 pruebas de motor; muestra de 1 GiB no editable |
| 5. Diagramas y exportaciones | Implementada | SVG, PNG completo, HTML y CSV satisfactorios | Integración; exportación no reemplaza documentos abiertos |
| 6. Fidelidad y robustez | Implementada, revisión continua | 23 unitarias; 12 E2E locales; falta CI final | evidence/ |
| 7. Alfa pública | Candidato local construido | DMG arm64 copiado y ejecutado; otras plataformas pendientes | Gate de publicación abierto |

Las primeras seis entregas se presentan como siete commits temáticos dentro de PR #1 para revisar la aplicación integrada. No se afirma que cada commit intermedio compile por separado.

## Gate de alfa

- [ ] Código integrado en `main` con revisión.
- [ ] CI obligatoria satisfactoria sobre el SHA de publicación.
- [ ] Comprobaciones funcionales y de seguridad.
- [ ] Capturas visuales y rendimiento documentados.
- [ ] Paquetes construidos y ejecutados por plataforma/arquitectura.
- [ ] Instalación probada de cada formato publicado.
- [ ] Licencias y avisos incluidos.
- [ ] Checksums de los archivos finales.
- [ ] Prerelease publicada con límites y advertencias de alfa.

No hay una publicación completada mientras estos gates no tengan evidencia.
