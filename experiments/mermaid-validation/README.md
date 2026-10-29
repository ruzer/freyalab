# Verificación A0 de Mermaid

Herramientas internas; no se empaquetan con la aplicación. Usan Node 24, Vite, Playwright y Electron ya instalados. No instalar dependencias nuevas.

- `node experiments/mermaid-validation/run-race.mjs /ruta/al/worktree before` usa el módulo exacto de `4358d91`; `after` usa el archivo del worktree. Cada caso abre un renderer aislado, con la CSP de la app, sin preload/Node y sin solicitudes remotas. Compara colores/contraste de los renders concurrentes contra controles seriales y repite la clave clara para comprobar la caché.
- `node experiments/mermaid-validation/measure-edit.mjs /ruta/al/worktree before` requiere que `render.ts` y `Preview.svelte` de ese worktree sean exactamente los de `4358d91`. Compilar primero esa misma fuente con `npm run build`. Para `after`, construir el candidato y pasar su worktree. El script no construye la app.
- `node experiments/mermaid-validation/check-edit-yields.mjs experiments/mermaid-validation/edit-after/result.json` comprueba cesión del hilo con latidos observados; no usa un umbral absoluto de tiempo.

Antes de medir: ninguna otra sesión de pruebas Electron ni cargas pesadas. Para repetir el baseline después del arreglo, usar un worktree independiente de `4358d91`, con sus dependencias bloqueadas, y pasar esa ruta como argumento. No revertir archivos del checkout del usuario.

Los resultados, perfiles, bundles y PNG se generan en carpetas ignoradas de este directorio. Los ensayos originales de esta entrega y los intentos fallidos del montaje se conservan fuera del repositorio, en `/private/tmp/freyalab-lote2/a0-ux-evidence/mermaid-real/`; el documento de evidencia distingue cada fuente.

R2 mide 5/40 bloques únicos de 25 nodos, carga inicial, dos párrafos sin cambiar los bloques, cambio de tema y otro párrafo. Observa tareas largas y latidos durante callbacks reales del debounce de 150 ms; no reemplaza el parser. Los tiempos de pared y la respuesta del hilo se reportan por separado.
