// M3 · Consulta pesada con DuckDB nativo para comprobar un tope de memoria impuesto desde fuera (objeto de trabajo de Windows).
//   node heavy.mjs --install <@duckdb/node-api> --work <carpeta> --limit 2GB --rows 60000000
import {createRequire} from 'node:module'
import {join, resolve} from 'node:path'
import {mkdirSync} from 'node:fs'
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const duck = createRequire(join(resolve(args.install), 'package.json'))('@duckdb/node-api')
mkdirSync(join(args.work, 'tmp'), {recursive: true})
const started = performance.now()
try {
  const instance = await duck.DuckDBInstance.create(':memory:'), connection = await instance.connect()
  await connection.run(`SET memory_limit='${args.limit}'`); await connection.run('SET threads=2'); await connection.run(`SET temp_directory='${join(args.work, 'tmp').replaceAll('\\', '/')}'`)
  const n = (await connection.runAndReadAll(`select count(*) n from (select i from range(${Number(args.rows)}) t(i) order by hash(i))`)).getRows()[0][0]
  console.log('HEAVY_RESULT ' + JSON.stringify({ok: true, rows: Number(n), ms: Math.round(performance.now() - started), rssMB: Math.round(process.memoryUsage().rss / 1048576)}))
} catch (error) {
  console.log('HEAVY_RESULT ' + JSON.stringify({ok: false, error: String(error.message).split('\n')[0].slice(0, 160), ms: Math.round(performance.now() - started), rssMB: Math.round(process.memoryUsage().rss / 1048576)}))
}
