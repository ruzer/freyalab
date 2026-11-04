# Checklist de publicación — v0.1.0-alpha.2

- Commit de código `de5daa91d4cd3162cb2d70d171d4a8b1ec3b4302`.
- [CI de main](https://github.com/ruzer/freyalab/actions/runs/41777635723).
- [Release candidate](https://github.com/ruzer/freyalab/actions/runs/41778039720).

| Archivo | Build | App empaquetada | Instalación/extracción | SHA-256 |
|---|---|---|---|---|
| FreyaLab-0.1.0-alpha.2-mac-arm64.dmg | Pasó | Inconclusa por límite de 10 min | App copiada y DMG desmontado antes de ejecutar las pruebas | `7734945e14d475098d68b370a04f706915b9059d55ae1fbf6147c93e5e9219a0` |
| FreyaLab-0.1.0-alpha.2-mac-x64.dmg | Pasó | Inconclusa por límite de 10 min | App copiada y DMG desmontado antes de ejecutar las pruebas | `8159baa384acd349315863b8545a7ba8e9018361ba86b1d623a4b93e1a8f1f0e` |
| FreyaLab-0.1.0-alpha.2-win-x64.exe | Pasó | Inconclusa. P5 falló y la limpieza terminó con EPERM | Instalación silenciosa comprobada. Desinstalación pendiente | `4153cbeca5c58d1abfb63b13204b25373a10c905a3450363b197d2f25215248c` |
| FreyaLab-0.1.0-alpha.2-linux-x86_64.AppImage | Pasó | Inconclusa por límite de 10 min | Extracción AppImage completada | `77c5cca88aadea59fa12886377d50fc64dff5bf1bb2d0edf730ad73d9efcab2d` |
| FreyaLab-0.1.0-alpha.2-linux-amd64.deb | Pasó | Pendiente | Pendiente | `2406df30f639a77fe97b28f1444698f899614fc4d777b9133390d374f235e040` |

Los SHA-256 se calcularon sobre los cinco archivos descargados de Release candidate. Los cuatro trabajos confirmaron el commit de código y construyeron los paquetes. La comprobación automatizada quedó inconclusa y el workflow omitió su paso de checksums.

Comprobaciones manuales pendientes de Gatekeeper y SmartScreen, montaje de AppImage con FUSE e integración del escritorio.
