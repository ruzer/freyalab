# Checklist de publicación — v0.1.0-alpha.1

- [Prerelease publicada](https://github.com/ruzer/freyalab/releases/tag/v0.1.0-alpha.1).
- Commit de código: `7851ee284d3bc6a068cbeffc6088af8e5a3cf46a`.
- [CI de main](https://github.com/ruzer/freyalab/actions/runs/39529554737): satisfactoria.
- [Paquetes e instalación](https://github.com/ruzer/freyalab/actions/runs/39529581811): satisfactorios.
- Licencia MIT y avisos incluidos; DMG arm64 inspeccionado.
- Capturas y rendimiento: documentos y screenshots en esta carpeta.

| Archivo | Build | App empaquetada | Instalación/extracción | SHA-256 |
|---|---|---|---|---|
| FreyaLab-0.1.0-alpha.1-mac-arm64.dmg | Pasó | 17 E2E pasaron | passed: copied application with preserved symlinks; source DMG detached before launch | `57e2d9e332cfb96bc0f1a8bd4052f3c190c5d817e3a8d66fe97a5af4bc9d014b` |
| FreyaLab-0.1.0-alpha.1-mac-x64.dmg | Pasó | 17 E2E pasaron | passed: copied application with preserved symlinks; source DMG detached before launch | `53eb16f1053afd8f9635808194ea061f60366b9068519d725170301b3a86e499` |
| FreyaLab-0.1.0-alpha.1-win-x64.exe | Pasó | 17 E2E pasaron | passed: silent installation and uninstallation in temporary directory | `d6634cde9192e024085cd6c69c9dc17c79eb6ef14d931cd92dd02f9a8e36d284` |
| FreyaLab-0.1.0-alpha.1-linux-x86_64.AppImage | Pasó | 17 E2E pasaron | passed: AppImage extraction | `333290c2d858c243d8b64a6d1e1c7a386c02ab826ab8f43497500469748c4762` |
| FreyaLab-0.1.0-alpha.1-linux-amd64.deb | Pasó | 17 E2E pasaron | passed: apt installation | `a6fde2503ccf40c8a47d591bf1c1242e8b63a2efc0a32fbf62d845a56f9c015b` |

Pruebas manuales de Gatekeeper/SmartScreen, montaje FUSE de AppImage e integración del escritorio: pendientes. Alfa sin firma comercial ni notarización. No se presentan como comprobadas las versiones mínimas de sistema no usadas en CI. [Detalle de evidencia](release-v0.1.0-alpha.1.md).
