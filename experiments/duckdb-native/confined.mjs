// M2 · Se ejecuta DENTRO de una capa de aislamiento del sistema operativo (os-layer.mjs): comprueba que el motor sigue funcionando y que el sistema
// operativo, y no solo la configuración de DuckDB, impide leer un archivo ajeno y abrir conexiones de red. La instancia de DuckDB del sondeo NO usa
// la configuración restrictiva del motor: así se ve lo que el sistema operativo impide por sí solo.
import net from 'node:net'
import {readFileSync, existsSync, statSync} from 'node:fs'
import {join} from 'node:path'
import {loadDuckDB, run} from './lib/engine.mjs'
import {makeFixture} from './lib/selftest.mjs'
import {HEADER} from './lib/battery.mjs'
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const duck = loadDuckDB(args.install), results = []
const record = (name, outcome, detail = '') => results.push({name, outcome, detail: String(detail).split('\n')[0].slice(0, 140)})
try {
  const path = join(args.work, 'selftest-ventas.csv')
  const source = {path, columns: HEADER, delimiter: ',', encoding: 'utf-8'}
  const options = {workDir: args.work, tempDir: join(args.work, 'tmp'), threads: 2, memoryLimit: '512MB', parallel: true}
  const v = await run(duck, 'filter_extract', {source, conditions: [{col: 4, op: 'eq', value: 'Oaxaca'}], columns: [0, 4], output: join(args.work, `salida-${args.tag}.csv`)}, options).result
  record('la operación cerrada funciona dentro de la capa', v.rows > 0 ? 'funciona' : 'sin filas', `${v.rows} filas`)
} catch (error) { record('la operación cerrada funciona dentro de la capa', 'falla', error.message) }
const instance = await duck.DuckDBInstance.create(':memory:'), connection = await instance.connect()
await connection.run('SET autoinstall_known_extensions=false'); await connection.run('SET autoload_known_extensions=false')
for (const [name, target] of [['DuckDB sin restricciones lee el archivo ajeno', args.secret], ['DuckDB sin restricciones lee /etc/hosts', '/etc/hosts']]) {
  try { const rows = (await connection.runAndReadAll(`select length(content) n from read_text('${target}')`)).getRowObjects(); record(name, Number(rows[0].n) > 0 ? 'lee' : 'vacío', `${rows[0].n} bytes`) } catch (error) { record(name, 'denegado', error.message) }
}
for (const [name, target] of [['Node lee el archivo ajeno', args.secret], ['Node lee /etc/hosts', '/etc/hosts']]) {
  try { const n = readFileSync(target).length; record(name, n > 0 ? 'lee' : 'vacío', `${n} bytes`) } catch (error) { record(name, 'denegado', error.code ?? error.message) }
}
await new Promise(resolve => {
  const socket = net.connect({host: '127.0.0.1', port: Number(args.port)}, () => { record('Node abre una conexión TCP a un servidor local', 'conecta'); socket.destroy(); resolve() })
  socket.on('error', error => { record('Node abre una conexión TCP a un servidor local', 'denegado', error.code ?? error.message); resolve() })
  setTimeout(() => { socket.destroy(); record('Node abre una conexión TCP a un servidor local', 'sin respuesta'); resolve() }, 3000)
})
try { (await import('node:fs')).writeFileSync(args.forbiddenWrite, 'x'); record('Node escribe fuera de la carpeta de trabajo', 'escribe') } catch (error) { record('Node escribe fuera de la carpeta de trabajo', 'denegado', error.code ?? error.message) }
connection.closeSync(); instance.closeSync()
console.log('CONFINED_RESULT ' + JSON.stringify(results))
