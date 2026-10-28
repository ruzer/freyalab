# L4a · S0 reproducible

Banco aislado, sin dependencias nuevas. Usa `buildIndex`, `recordBatches`, `splitFields`, `readRecords`, `compileTableQuery` y `runOperation` del producto; `pickFields` procede del experimento existente. No habilita búsquedas en la aplicación.

`scan.ts` compara la búsqueda global con `csv-parse/sync` usando las opciones estrictas de `operations.ts` (su función privada `fieldsOf` no se exporta). La condición de una columna se compara también con `runOperation` real. El candidato rápido añade en el banco una validación mínima de comillas y UTF-8 antes de descartar registros por bytes; el separador tolerante del producto, por sí solo, no equivale al motor estricto.

`bench.ts` se ejecuta como un `utilityProcess` de Electron. Los rangos parten de los puntos del índice disperso y usan `worker_threads` dentro de ese proceso. Cada rango solo consume sus ordinales: `recordBatches` puede anticipar lectura al completar el último bloque. Se transfiere un `Uint32Array` con ordinal, posición y longitud; esta representación está limitada explícitamente a fixtures menores de 4 GiB. No decide la representación de producción ni su tope.

Preparación con Node 24 y los módulos ya instalados:

```sh
node experiments/large-search-s0/build.mjs /private/tmp/freya-search-s0
ln -s "$PWD/node_modules" /private/tmp/freya-search-s0/node_modules
node /private/tmp/freya-search-s0/parity.mjs --parity /private/tmp/freya-search-s0/hostile
node experiments/large-file-editor/gen-fixture.mjs --size 529MiB --profile wide --seed 28 --out /private/tmp/freya-search-s0/fixtures
```

Los fixtures de ventas proceden de `experiments/large-data-extracts/generate_sales.py`; no se escriben dentro del repositorio. La evidencia compacta conserva las solicitudes de cada muestra y las huellas de los fixtures y del código. Las solicitudes se guardan como una lista JSON y se pasan al lanzador:

```sh
node node_modules/electron/cli.js experiments/large-search-s0/launch.cjs /private/tmp/freya-search-s0/bench.mjs /private/tmp/freya-search-s0/manifest.json /private/tmp/freya-search-s0
```

El lanzador usa una sola sesión Electron y un proceso de tablas nuevo por muestra, para que el RSS máximo sea independiente. Cada línea de `raw.ndjson` guarda solicitud, resultado y versiones reales. Hay aserciones de paridad, cobertura de ordinales, límite de memoria y cancelación; un error detiene la serie. Los archivos CSV y los resultados extensos permanecen fuera del repositorio.

`parity.mjs` conserva también el desacuerdo conocido de finales mixtos y emite `totalParity: false`. Que termine sin fallar sus aserciones confirma los casos registrados; no levanta el bloqueo de interpretación ni autoriza B1.

Las mediciones requieren una ventana exclusiva sin compilaciones, pruebas u otras mediciones pesadas. No ejecutar este banco en la CI ni junto con otra sesión Electron.
