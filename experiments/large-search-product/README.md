# L4a/L5a · medidas del producto

Este banco usa `LargeViews`, su pool y su lista reales, `buildIndex`, `readRecords`, el worker de producción y `compileTableQuery`. No traslada las cifras S0 a una fuente distinta. No instala dependencias. Se ejecuta sólo con lease CPU/Electron exclusivo; los fixtures y raw quedan fuera del repositorio.

Preparar con Node 24, desde este worktree:

```sh
node experiments/large-search-product/build.mjs /private/tmp/freyalab-lote2/evidence-csv/product-final
node experiments/large-search-product/manifest.mjs /private/tmp/freyalab-lote2/evidence-csv/product-final
```

Sólo dentro de la ventana exclusiva se generan los dos fixtures adicionales (el script usa `wx`, no sobrescribe):

```sh
node experiments/large-search-product/fixtures.mjs /private/tmp/freyalab-lote2/evidence-csv/product-final
node node_modules/electron/cli.js experiments/large-search-product/launch.cjs /private/tmp/freyalab-lote2/evidence-csv/product-final/bench.mjs /private/tmp/freyalab-lote2/evidence-csv/product-final/manifest.json /private/tmp/freyalab-lote2/evidence-csv/product-final
node experiments/large-search-product/verify.mjs /private/tmp/freyalab-lote2/evidence-csv/product-final
```

Una sola sesión Electron, proceso utility nuevo por muestra, y se espera su salida antes de abrir el siguiente. Índice antes de cada consulta: caché caliente; tiempo de índice separado. El RSS máximo incluye todos los hilos del proceso y la apertura del índice. El coordinador real conserva listas y ACK de resultados en todas las variantes.

O0 usa un worker, sin prefiltro ni separación parcial; O1 sólo añade prefiltro; O2 añade separación parcial; O3 añade cuatro rangos. Apagar palancas son opciones internas del escáner/gestor, nunca campos de IPC ni ajustes visibles. Tres series de ventas 100 MiB/1 GiB: termina en `00000` (≈0,001 %), termina en `0` (10 %), empieza por `V-` (100 %), búsqueda global ASCII y Unicode. El prefiltro no se aplica a `ends`/`starts`: esos casos muestran su coste sin atribuirle una ganancia inexistente; las dos búsquedas globales miden O1. El archivo ancho irregular conserva la referencia O0 de S0, con tres series de tres agujas.

Además: 1/2/4/8 workers con todas las coincidencias; una coincidencia; páginas de 200 filas desde una lista de al menos 1 M (nueve desplazamientos, cuenta real de llamadas/bytes de `FileHandle.read`, mediana ≤50 ms); caché de la misma consulta; cancelación regex `(a+)+b` con campos de 64 KiB sobre 1 GiB (1/2/4/8); y 10.000.000 coincidencias desde un fixture de 10.000.001 filas. La lista se inspecciona sólo desde este banco para registrar su presupuesto real sin añadir una API pública. RSS <1 GiB, lista ≤128 MiB y cancelación <1 s se comprueban; una infracción detiene la serie y conserva raw.

`build.mjs` congela SHA de fuente y bundle/mapa; `verify.mjs` exige igualdad al terminar. No ejecutarlo en CI. El observador de tareas de interfaz se mide por separado en la aplicación real; este banco no prueba la respuesta del renderer.
