# Medición de AC-01

Herramienta interna con Node24 y dependencias bloqueadas ya instaladas. No se empaqueta con la app.

`node experiments/academic-render/measure.mjs /ruta/al/worktree before` compila exclusivamente el módulo render.ts original de main33a5dfd. `after` usa el del worktree. Reutiliza la ventana aislada del montaje A0, sin preload, Node o recursos remotos.

Cada fase procesa tres veces exactamente10MiB del mismo Markdown sintético, con20figuras,20tablas y40referencias. El ensayo pequeño inicial calienta imports; los tiempos incluyen la tubería completa de markdownHTML, no lectura de imágenes ni Mermaid. Se guardan versiones, equipo, hashes, recuentos y mediana, sin umbral absoluto universal. Ejecutar secuencialmente y sin otras sesiones Electron ni cargas pesadas. Los resultados y perfiles quedan ignorados en before/after.
