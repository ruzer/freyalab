// M2 · Puerta (d) del RFC §7.4: diferencias entre el DuckDB-Wasm que ya usa el producto y el DuckDB nativo. Ejecuta las MISMAS sentencias en los dos
// motores (la dependencia @duckdb/duckdb-wasm es la del proyecto; la nativa vive en una carpeta aislada) y compara resultados y errores.
//   node wasm-parity.mjs --install <@duckdb/node-api> --csv <ventas_10MiB.csv> --edges <carpeta con ragged.csv, extra.csv, unclosed.csv> --out resultados.json
import {createRequire} from 'node:module'
import {join, dirname, resolve} from 'node:path'
import {writeFileSync, readFileSync} from 'node:fs'
import {loadDuckDB} from './lib/engine.mjs'
import {HEADER} from './lib/battery.mjs'
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const require = createRequire(import.meta.url)
const wasm = require('@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs')
const DIST = dirname(require.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs'))
const bundles = {mvp: {mainModule: join(DIST, 'duckdb-mvp.wasm'), mainWorker: join(DIST, 'duckdb-node-mvp.worker.cjs')}, eh: {mainModule: join(DIST, 'duckdb-eh.wasm'), mainWorker: join(DIST, 'duckdb-node-eh.worker.cjs')}}
const wasmDb = await wasm.createDuckDB(bundles, new wasm.VoidLogger(), wasm.NODE_RUNTIME)
await wasmDb.instantiate(() => {}); wasmDb.open({})
const wasmConn = wasmDb.connect()
const native = loadDuckDB(args.install), instance = await native.DuckDBInstance.create(':memory:'), nativeConn = await instance.connect()
const files = {'ventas.csv': resolve(args.csv), 'ragged.csv': join(args.edges, 'ragged.csv'), 'extra.csv': join(args.edges, 'extra.csv'), 'unclosed.csv': join(args.edges, 'unclosed.csv')}
for (const [name, path] of Object.entries(files)) wasmDb.registerFileURL(name, path, wasm.DuckDBDataProtocol.NODE_FS, false)
const plain = value => JSON.stringify(value, (k, v) => (typeof v === 'bigint' ? Number(v) : v))
const runWasm = sql => { try { return {rows: plain(wasmConn.query(sql).toArray().map(r => r.toJSON()))} } catch (error) { return {error: String(error.message).split('\n').slice(0, 2).join(' | ').slice(0, 140)} } }
const realPaths = sql => Object.entries(files).reduce((text, [name, path]) => text.replaceAll(`'${name}'`, `'${path}'`), sql) // el nativo lee las rutas reales; el Wasm, los nombres registrados
const runNative = async sql => { sql = realPaths(sql); try { return {rows: plain((await nativeConn.runAndReadAll(sql)).getRowObjects())} } catch (error) { return {error: String(error.message).split('\n').slice(0, 2).join(' | ').slice(0, 140)} } }
const all = '{' + HEADER.map((_, i) => `'c${i}':'VARCHAR'`).join(',') + '}', four = "{'c0':'VARCHAR','c1':'VARCHAR','c2':'VARCHAR','c3':'VARCHAR'}"
const read = (file, cols, parallel) => `read_csv('${file}', columns=${cols}, auto_detect=false, header=true, delim=',', quote='"', escape='"', strict_mode=true, parallel=${parallel})`
const cases = [
  ['count', `select count(*) n from ${read('ventas.csv', all, true)}`],
  ['filtro Oaxaca y entregado', `select count(*) n from ${read('ventas.csv', all, true)} where c4='Oaxaca' and c19='entregado'`],
  ['búsqueda con salto de línea dentro del campo', `select count(*) n from ${read('ventas.csv', all, true)} where contains(c20,'Primera línea')`],
  ['agregación con suma decimal exacta', `select c4, count(*) n, cast(sum(cast(c15 as decimal(38,2))) as varchar) s from ${read('ventas.csv', all, true)} group by c4 order by c4`],
  ['ordenación (primeras 3 fechas)', `select c16 from ${read('ventas.csv', all, true)} order by c16, c0 limit 3`],
  ['replace literal (recuento de Merida)', `select count(*) n from (select replace(c4,'Mérida','Merida') c from ${read('ventas.csv', all, true)}) where c='Merida'`],
  ...['ragged.csv', 'extra.csv', 'unclosed.csv'].flatMap(f => [true, false].map(p => [`${f} con parallel=${p}`, `select count(*) n from ${read(f, four, p)}`]))
]
const results = []
for (const [name, sql] of cases) {
  const a = runWasm(sql), b = await runNative(sql)
  results.push({name, wasm: a, native: b, same: plain(a) === plain(b), sameOutcomeKind: Boolean(a.error) === Boolean(b.error)})
  console.log(results.at(-1).same ? 'igual   ' : results.at(-1).sameOutcomeKind ? 'mensaje distinto' : 'DIFERENTE', name)
}
const versions = {wasm: runWasm('select version() v').rows, native: (await runNative('select version() v')).rows, wasmPackage: JSON.parse(readFileSync(join(DIST, '..', 'package.json'), 'utf8')).version}
writeFileSync(args.out, JSON.stringify({kind: 'M2 paridad DuckDB-Wasm (producto) frente a DuckDB nativo', versions, results}, null, 2) + '\n')
console.log(JSON.stringify(versions))
