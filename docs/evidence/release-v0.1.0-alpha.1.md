# FreyaLab v0.1.0-alpha.1 — evidencia de publicación

[Prerelease publicada](https://github.com/ruzer/freyalab/releases/tag/v0.1.0-alpha.1) el 21 de octubre de 2026 (UTC).

Commit de código: `7851ee284d3bc6a068cbeffc6088af8e5a3cf46a`.

- [CI de main](https://github.com/ruzer/freyalab/actions/runs/39529554737): satisfactoria en macOS 15 arm64, macOS 15 Intel, Windows Server 2025 x64 y Ubuntu 24.04 x64. Cada entorno ejecutó comprobación de tipos, 28 pruebas unitarias y 17 E2E.
- [Candidato del mismo commit](https://github.com/ruzer/freyalab/actions/runs/39529581811): construcción, licencias y comprobaciones de paquetes satisfactorias en las cuatro arquitecturas/entornos. Las 17 pruebas E2E se repitieron sobre cada formato empaquetado.
- [Revisión de implementación](https://github.com/ruzer/freyalab/pull/1) y [cierre de licencia/PDF](https://github.com/ruzer/freyalab/pull/2).

| Artefacto | Construcción | Ejecución empaquetada | Instalación/extracción comprobada |
|---|---|---|---|
| macOS arm64 DMG | Pasó | 17 E2E pasaron | App copiada conservando enlaces; DMG desmontado antes de ejecutarla |
| macOS x64 DMG | Pasó | 17 E2E pasaron | App copiada conservando enlaces; DMG desmontado antes de ejecutarla |
| Windows x64 NSIS | Pasó | 17 E2E pasaron | Instalación y desinstalación silenciosas en carpeta temporal |
| Ubuntu x64 AppImage | Pasó | 17 E2E pasaron | Extracción AppImage; ejecutable extraído comprobado |
| Ubuntu x64 DEB | Pasó | 17 E2E pasaron | Instalación mediante apt, ejecución y eliminación del paquete |

Los checksums SHA-256 de los cinco binarios están en `SHA256SUMS.txt`. Los informes por plataforma se conservan junto a esta evidencia. También se inspeccionó el DMG final arm64 para comprobar que contiene la licencia MIT de FreyaLab y los avisos de terceros.

## Límites de la evidencia

Objetivos de producto: macOS 14+, Windows 11 y Ubuntu 24.04. Los resultados anteriores identifican los sistemas de CI realmente usados; no equivalen a una prueba manual en todas las versiones de esos sistemas.

La alfa no tiene firma comercial ni notarización. La experiencia de descarga con cuarentena/Gatekeeper, SmartScreen y la integración manual con el escritorio siguen pendientes. No se afirma que esas comprobaciones manuales hayan pasado. Las advertencias de firma conocidas forman parte de la distribución de esta alfa; no se recomienda desactivar protecciones globales.

AppImage se comprobó mediante extracción, sin afirmar que se verificó su montaje FUSE o su integración con el escritorio. CSV mayores de 50MiB son muestras limitadas, sin edición o análisis integral de archivos de GB. No hay telemetría, cuenta ni actualización automática.

Rendimiento y capturas: `docs/evidence/` en el repositorio. Son mediciones y recorridos concretos, no garantías universales ni una aprobación visual manual de todos los sistemas.

[Transferencia de los artefactos verificados](https://github.com/ruzer/freyalab/actions/runs/39531488296): satisfactoria. Los ocho hashes remotos se contrastaron con los archivos locales antes de publicar. La rama operativa se cerró sin integrar cambios en la aplicación.
