# Candidato sin publicar — FreyaLab v0.1.0-alpha.3

Commit de código: `238b387413fa5e7b3ebe2b63d0ff52efce8bc8f2`. Versión de la app: `0.1.0-alpha.3`.

- [CI push de main](https://github.com/ruzer/freyalab/actions/runs/42956116818): completada con éxito en los siete trabajos de verificación de Linux, Windows, macOS Apple silicon e Intel.
- [Release candidate](https://github.com/ruzer/freyalab/actions/runs/42963212736): compuerta de main y cuatro trabajos de paquetes completados con éxito, sobre el mismo SHA. No se modificó el candidato al descargarlo.
- Alcance de este corte: incluye las correcciones y funciones de alpha.3; TXT-02a, la nueva pestaña Análisis y Proyectos permanecen fuera. Su desarrollo separado para alpha.4 no cambia estos binarios.

## Archivos comprobados

Los cuatro artefactos de Actions se descargaron en carpetas separadas. Se contrastaron el commit, plataforma, arquitectura, inventario exacto, `candidate.json` y `package-smoke.json`. Los cinco SHA-256 se calcularon de nuevo sobre los binarios descargados, se compararon con los cuatro `SHA256SUMS.txt` originales y se repitieron tras copiarlos al conjunto de adjuntos.

| Archivo | Build | App empaquetada | Instalación/extracción automatizada | SHA-256 |
| --- | --- | --- | --- | --- |
| FreyaLab-0.1.0-alpha.3-linux-amd64.deb | Pasó | 10/10, sin reintentos | Instalación y eliminación mediante apt | `28eccf1906447df34c677a7fc2f14669e9d7027d966e12e260f72d18c08bfaa8` |
| FreyaLab-0.1.0-alpha.3-linux-x86_64.AppImage | Pasó | 10/10, sin reintentos | Extracción y ejecución desde squashfs-root; FUSE pendiente | `477f685ea518db31ded9b0f5945d2b0289f2ba4bb287540f4db8f24bcbda2253` |
| FreyaLab-0.1.0-alpha.3-mac-arm64.dmg | Pasó | 10/10, sin reintentos | App copiada conservando enlaces; DMG desmontado antes de ejecutarla | `3d221c19e0a9243a6f9dcf0c9e4ddab3efcb0a75e1133bea3ec8afde2c9f817f` |
| FreyaLab-0.1.0-alpha.3-mac-x64.dmg | Pasó | 10/10, sin reintentos | App copiada conservando enlaces; DMG desmontado antes de ejecutarla | `a292843fa7748defd93f20fff97806fb9b6f961a18d459d24323e39a0a264921` |
| FreyaLab-0.1.0-alpha.3-win-x64.exe | Pasó | 10/10, sin reintentos | Instalación y desinstalación silenciosas en carpeta temporal | `b25a4bca8b1a939ae958c959b1b1f33848df9a9604a8fe527a37899c6c1ea90c` |

Son **cinco binarios y diez casos de humo por binario: 50 ejecuciones aprobadas**, sin omisiones, fallos ni reintentos en esa selección. Ubuntu ejecutó los diez casos tanto desde AppImage extraída como desde DEB instalado. Las pruebas incluyen apertura, edición y guardado reales de Markdown/CSV, ceros y campos multilínea, exportaciones PDF/HTML, citas y recursos bibliográficos, diagnóstico/licencias, Ajustes y Resumen y gráfico.

La selección de humo del candidato no sustituye ni reduce la cobertura de la CI de main: esa CI ejecutó sus suites completas por área y las pruebas CSV de la aplicación empaquetada.

## CI del commit de código

Valores tomados de los registros de la corrida, no de una medición local. En «rápidas», los casos aprobados al reintento se indican aparte.

| Trabajo | Unitarias aprobadas / omitidas | E2E rápidas aprobadas / omitidas | Perf y solo | E2E CSV del paquete | Duración total |
| --- | --- | --- | --- | --- | --- |
| Ubuntu shell-md | 2640 / 10 | 330 / 7 | En otro job | En otro job | 14m14s |
| Ubuntu csv-package | En otro job | 210 + 1 al reintento / 0 | 59 / 0 | 105 / 1 | 29m59s |
| macOS ARM | 2640 / 10 | 540 + 1 al reintento / 7 | 59 / 0 | 105 / 1 | 64m01s |
| Windows | 2637 / 13 | 545 / 7 | 59 / 0 | 105 / 1 | 50m03s |
| Intel shell-md | 2640 / 10 | 330 / 7 | En otro job | En otro job | 29m37s |
| Intel csv | En otro job | 211 / 0 | 59 / 0 | En otro job | 33m25s |
| Intel package | En otro job | En otro job | En otro job | 105 / 1 | 21m22s |

Se observaron dos casos inestables en el primer intento de main, ambos aprobados al reintento permitido:

- ARM, `csv-summary.spec.ts:142`: el anuncio seguía en «Calculando el resultado…» cuando se esperaba «Resultado actualizado».
- Ubuntu, `csv-text.spec.ts:117`: se esperaba el aviso «Datos de operación no válidos» y se observó «La vista no permite editar.» antes de desaparecer el aviso.

Se conserva este resultado sin atribuirle una causa no demostrada ni afirmar cero reintentos de main. Las 105 E2E CSV del paquete por plataforma pasaron sin reintentos. Las omisiones de las suites generales son las registradas por la CI; no se presentan como comprobaciones aprobadas ni se eliminaron pruebas para este candidato.

## Duración del candidato

| Trabajo | Unitarias | Construcción del paquete | Ejecución/instalación | Total |
| --- | --- | --- | --- | --- |
| macOS Intel | 3m05s | 2m19s | 1m28s | 9m15s |
| macOS ARM | 1m06s | 1m17s | 0m59s | 4m34s |
| Windows | 0m59s | 1m19s | 0m50s | 4m12s |
| Ubuntu | 0m57s | 2m08s | 1m16s | 5m10s |

Los cuatro trabajos ejecutaron tipos, unitarias y licencias antes del empaquetado. Las unitarias del candidato registraron 2640 aprobadas y 10 omitidas en macOS/Linux; 2637 y 13 en Windows. Las diez pruebas de humo seleccionadas por formato registraron cero omisiones y cero reintentos.

## Puertas manuales y límites

- [x] CI push verde sobre el SHA exacto.
- [x] Candidate y cuatro trabajos de empaquetado verdes sobre ese SHA.
- [x] Cinco archivos descargados, identidad y hashes cotejados independientemente.
- [x] Ejecución de los cinco formatos después de su extracción/instalación automatizada.
- [ ] Gatekeeper y cuarentena de una descarga real de ambos DMG.
- [ ] SmartScreen con la descarga real del instalador de Windows.
- [ ] Montaje de AppImage mediante FUSE.
- [ ] Integración manual del escritorio Linux, accesos y asociaciones.
- [ ] Tras publicar: comprobar enlaces de notas en Ayuda y Acerca de desde la app instalada. La URL de una etiqueta aún no publicada no se considera verificada.
- [ ] Publicación por el propietario. Este documento no autoriza ni acredita publicar, crear una etiqueta manual o instalar la app en la laptop.

Los paquetes carecen de firma comercial y notarización. Los sistemas ejecutados son los runners de CI macOS 15 Apple silicon/Intel, Windows Server 2025 y Ubuntu 24.04; no equivalen a comprobaciones manuales en macOS 14 o Windows 11. Los límites de archivos, análisis y el problema conocido de estilos DOCX permanecen descritos en las notas de versión. El candidato no reproduce todas las E2E en cada instalador: realiza la selección de humo indicada.

## Evidencia conservada

Los JSON originales del candidato por plataforma, sus resultados por binario, el inventario verificado, los SHA-256 y el estado de ambos workflows se conservan en `docs/evidence/alpha3-candidato-2026-11-10/`. Los registros completos permanecen enlazados en Actions. No se añadieron secretos ni URLs firmadas.

La alfa.2 continúa archivada como candidato sin publicar en `docs/evidence/release-v0.1.0-alpha.2-candidato.md`. La evidencia de la alfa.1 publicada se conserva sin cambios.
