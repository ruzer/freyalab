# Checklist de publicación — v0.1.0-alpha.2 (22b871f)

- Commit de código `22b871fc68f81dcf10291f0281ea3a666cc5b0cc`.
- [CI de main](https://github.com/ruzer/freyalab/actions/runs/41971176672), completada con éxito en los cuatro trabajos de verificación de Linux, Windows, macOS Apple silicon y macOS Intel.
- [Release candidate](https://github.com/ruzer/freyalab/actions/runs/41982542841), completado con éxito en `verify-main` y los cuatro trabajos de empaquetado.

| Archivo | Build | App empaquetada | Instalación/extracción | SHA-256 |
|---|---|---|---|---|
| FreyaLab-0.1.0-alpha.2-mac-arm64.dmg | Pasó | Pasó | App copiada y DMG desmontado antes de ejecutar las pruebas | `65d8e66005872cd83d03717c9907b1ab3770ff2e36f71066938437ab368b9c9b` |
| FreyaLab-0.1.0-alpha.2-mac-x64.dmg | Pasó | Pasó | App copiada y DMG desmontado antes de ejecutar las pruebas | `4433a017a43a4e84441beeadcf410068ad000cb4aebf3383e4a018d10a2d43da` |
| FreyaLab-0.1.0-alpha.2-win-x64.exe | Pasó | Pasó | Instalación y desinstalación silenciosas comprobadas en un directorio temporal | `3b0de78660a3cce385b84f566e7569c653f5db39b91d7f373523c34214d4161a` |
| FreyaLab-0.1.0-alpha.2-linux-x86_64.AppImage | Pasó | Pasó | Extracción AppImage completada | `f6943ed80af4d3ec45a625d5a73ae1330aa59ff2e199996c2d5a122d6e274777` |
| FreyaLab-0.1.0-alpha.2-linux-amd64.deb | Pasó | Pasó | Instalación mediante apt comprobada | `e8fe96b99b167876bd342786adf15662510952f6289c37aa6f6ad97f901e99e8` |

Los SHA-256 proceden de los archivos `SHA256SUMS.txt` de este candidato y se cotejaron de nuevo con los cinco archivos descargados. Los cuatro trabajos confirmaron el commit de código, construyeron los paquetes y completaron las pruebas automatizadas del paquete. Los cinco archivos tienen resultado `passed` en `packagedExecution` de sus respectivos `test-results/package-smoke.json`.

Comprobaciones manuales pendientes de Gatekeeper y SmartScreen, montaje de AppImage con FUSE e integración del escritorio de Linux. La publicación sigue pendiente de esos gates manuales.
