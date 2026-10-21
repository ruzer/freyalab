# Paquete macOS arm64 — 20 de octubre de 2026

Código de aplicación: `57617161681849f533d2dc7c88f9badccfba34ff`. Node 24.22.0, Apple M2 Max.

Se generó `FreyaLab-0.1.0-alpha.1-mac-arm64.dmg` con `npm run dist -- --arm64 --publish never`. Se montó en lectura, se copió FreyaLab.app a una carpeta temporal conservando enlaces simbólicos y se desmontó el DMG **antes** de iniciar la copia instalada. Las doce pruebas de Electron sobre esa copia pasaron en 18.5 s.

Se detectó y corrigió un fallo del script inicial: `fs.cp` reescribía enlaces del framework hacia la imagen montada. La comprobación corregida usa `verbatimSymlinks: true` y exige ejecución independiente de la imagen.

Esta prueba acredita el paquete local Apple silicon y el recorrido de copia/ejecución. No acredita descarga con cuarentena, notarización, Intel, Windows o Linux. El instalador carece de firma comercial; las advertencias de Gatekeeper para una descarga pública se documentan por separado. No habilita publicación hasta completar CI y candidatos del commit final de main.
