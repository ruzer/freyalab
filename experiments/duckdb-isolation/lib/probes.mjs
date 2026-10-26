// M3 · Qué puede hacer un proceso con DuckDB y Node fuera de su carpeta de trabajo. Se ejecuta DENTRO del proceso que se evalúa
// (hijo confinado, utilityProcess de Electron, proceso sin capa). La instancia de DuckDB del sondeo NO usa la configuración restrictiva del motor:
// así se ve lo que impide el sistema operativo por sí solo.
import net from 'node:net'
import {readFileSync, writeFileSync} from 'node:fs'

export async function probe({duck, secret, hosts, port, forbiddenWrite}) {
  const results = []
  const record = (name, outcome, detail = '') => results.push({name, outcome, detail: String(detail).split('\n')[0].slice(0, 140)})
  const instance = await duck.DuckDBInstance.create(':memory:'), connection = await instance.connect()
  await connection.run('SET autoinstall_known_extensions=false'); await connection.run('SET autoload_known_extensions=false')
  for (const [name, target] of [['DuckDB sin restricciones lee el archivo ajeno', secret], ['DuckDB sin restricciones lee el archivo de hosts', hosts]]) {
    try { const rows = (await connection.runAndReadAll(`select length(content) n from read_text('${target.replaceAll("'", "''")}')`)).getRowObjects(); record(name, !rows.length ? 'denegado' : Number(rows[0].n) > 0 ? 'lee' : 'vacío', rows.length ? `${rows[0].n} bytes` : 'sin filas: el sistema impidió la lectura') }
    catch (error) { record(name, 'denegado', error.message) }
  }
  connection.closeSync(); instance.closeSync()
  for (const [name, target] of [['Node lee el archivo ajeno', secret], ['Node lee el archivo de hosts', hosts]]) {
    try { const n = readFileSync(target).length; record(name, n > 0 ? 'lee' : 'vacío', `${n} bytes`) } catch (error) { record(name, 'denegado', error.code ?? error.message) }
  }
  await new Promise(resolve => {
    const socket = net.connect({host: '127.0.0.1', port: Number(port)}, () => { record('Node abre una conexión TCP a un servidor local', 'conecta'); socket.destroy(); resolve() })
    socket.on('error', error => { record('Node abre una conexión TCP a un servidor local', 'denegado', error.code ?? error.message); resolve() })
    setTimeout(() => { socket.destroy(); record('Node abre una conexión TCP a un servidor local', 'sin respuesta'); resolve() }, 3000)
  })
  try { writeFileSync(forbiddenWrite, 'x'); record('Node escribe fuera de la carpeta de trabajo', 'escribe') } catch (error) { record('Node escribe fuera de la carpeta de trabajo', 'denegado', error.code ?? error.message) }
  return results
}
export const ALLOWED = ['lee', 'conecta', 'escribe']
export const PROBE_NAMES = ['DuckDB sin restricciones lee el archivo ajeno', 'DuckDB sin restricciones lee el archivo de hosts', 'Node lee el archivo ajeno', 'Node lee el archivo de hosts', 'Node abre una conexión TCP a un servidor local', 'Node escribe fuera de la carpeta de trabajo']
export function verdict(results) {
  const by = name => results?.find?.(r => r.name === name)?.outcome
  return {allowed: PROBE_NAMES.filter(n => ALLOWED.includes(by(n))), denied: PROBE_NAMES.filter(n => !ALLOWED.includes(by(n)))}
}
