// M2 · Comprobaciones de aislamiento que se ejecutan DENTRO del proceso auxiliar (Node hijo o utilityProcess de Electron).
//  1) `lockedInstanceAttempts`: SQL libre contra una instancia configurada igual que la del motor. Demuestra qué impide DuckDB aunque algo
//     consiguiera ejecutar SQL (no es lo que la interfaz permite: allí nadie envía SQL).
//  2) `closedOperationAttempts`: lo que rechaza la capa de operaciones cerradas antes de llegar a DuckDB.
import {mkdirSync, writeFileSync, symlinkSync, existsSync, readFileSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import http from 'node:http'
import {openInstance, run} from './engine.mjs'

const plain = value => JSON.stringify(value, (k, v) => (typeof v === 'bigint' ? Number(v) : v)).slice(0, 120)

export async function lockedInstanceAttempts(duck, root) {
  const allowed = join(root, 'permitido'), outside = join(root, 'fuera'), temp = join(root, 'tmp')
  for (const dir of [allowed, outside, temp]) mkdirSync(dir, {recursive: true})
  writeFileSync(join(allowed, 'ok.csv'), 'a,b\n1,uno\n2,dos\n')
  writeFileSync(join(allowed, 'otro.csv'), 'a,b\n9,nueve\n')
  writeFileSync(join(outside, 'secreto.csv'), 'a,b\nSECRETO,x\n')
  if (!existsSync(join(allowed, 'enlace.csv'))) symlinkSync(join(outside, 'secreto.csv'), join(allowed, 'enlace.csv'))
  const hits = []
  const server = http.createServer((req, res) => { hits.push(req.url); res.end('a,b\nred,1\n') })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const output = join(allowed, 'salida-permitida.csv')
  const spec = {source: {path: join(allowed, 'ok.csv')}, output}
  const {instance, connection} = await openInstance(duck, spec, {workDir: root, tempDir: temp, threads: 2, memoryLimit: '512MB', maxTemp: '1GB'})
  const results = []
  const attempt = async (name, sql, expect) => {
    let outcome, detail
    try { const rows = (await connection.runAndReadAll(sql)).getRowObjects(); outcome = 'permitido'; detail = plain(rows) } catch (error) { outcome = 'denegado'; detail = String(error.message).split('\n')[0].slice(0, 120) }
    results.push({name, expect, outcome, ok: outcome === expect, detail })
  }
  await attempt('leer la fuente autorizada', `select count(*) n from read_csv('${join(allowed, 'ok.csv')}')`, 'permitido')
  await attempt('leer otro archivo de la misma carpeta', `select * from read_csv('${join(allowed, 'otro.csv')}')`, 'denegado')
  await attempt('leer un archivo fuera de la carpeta', `select * from read_csv('${join(outside, 'secreto.csv')}')`, 'denegado')
  await attempt('recorrido con ../', `select * from read_csv('${join(allowed, '..', 'fuera', 'secreto.csv')}')`, 'denegado')
  await attempt('enlace simbólico dentro de la carpeta que apunta fuera', `select * from read_csv('${join(allowed, 'enlace.csv')}')`, 'denegado')
  await attempt('read_text de /etc/hosts', `select * from read_text('/etc/hosts')`, 'denegado')
  await attempt('glob de /etc', `select * from glob('/etc/*')`, 'denegado')
  await attempt('listar la carpeta autorizada', `select * from glob('${join(allowed, '*')}')`, 'denegado')
  await attempt('COPY fuera de lo autorizado', `copy (select 1 a) to '${join(outside, 'escape.csv')}'`, 'denegado')
  await attempt('COPY al archivo de salida autorizado', `copy (select 1 a) to '${output}' (format csv)`, 'permitido')
  await attempt('COPY a otro archivo de la misma carpeta', `copy (select 1 a) to '${join(allowed, 'otra-salida.csv')}'`, 'denegado')
  await attempt('ATTACH de una base en disco', `attach '${join(root, 'base.duckdb')}'`, 'denegado')
  await attempt('read_csv por HTTP a un servidor local', `select * from read_csv('http://127.0.0.1:${port}/x.csv')`, 'denegado')
  await attempt('INSTALL httpfs', 'install httpfs', 'denegado')
  await attempt('LOAD httpfs', 'load httpfs', 'denegado')
  for (const [name, sql] of [['reactivar el acceso externo', 'set enable_external_access=true'], ['ampliar allowed_paths', `set allowed_paths=['/etc/hosts']`],
    ['subir memory_limit', "set memory_limit='64GB'"], ['cambiar temp_directory', "set temp_directory='/tmp'"], ['activar autoinstall', 'set autoinstall_known_extensions=true'],
    ['desbloquear la configuración', 'set lock_configuration=false']]) await attempt(`${name} tras bloquear`, sql, 'denegado')
  // Límites: una consulta que pide más memoria y disco temporal que los límites falla limpiamente (no ocupa toda la máquina).
  await attempt('ordenar 200 M de filas con 512 MB y 1 GB de temporales', 'select count(*) from (select i from range(200000000) t(i) order by hash(i))', 'denegado')
  // Cancelación de una consulta infinita.
  const started = performance.now()
  const long = connection.runAndReadAll('select count(*) from range(100000000000) t(i) where hash(i) % 7 = 3')
  await new Promise(resolve => setTimeout(resolve, 300))
  connection.interrupt()
  let cancelMs
  try { await long; cancelMs = null } catch { cancelMs = performance.now() - started - 300 }
  results.push({name: 'cancelar con interrupt() una consulta de 10^11 filas', expect: 'cancelada', outcome: cancelMs === null ? 'terminó' : 'cancelada', ok: cancelMs !== null, detail: cancelMs === null ? '' : `${cancelMs.toFixed(1)} ms tras interrupt()`, latencyMs: cancelMs})
  connection.closeSync(); instance.closeSync(); server.close()
  results.push({name: 'peticiones HTTP recibidas por el servidor local', expect: '0', outcome: String(hits.length), ok: hits.length === 0, detail: ''})
  rmSync(output, {force: true})
  return results
}

export async function closedOperationAttempts(duck, root) {
  const dir = join(root, 'cerradas'), work = join(dir, 'trabajo'), source = join(dir, 'fuente')
  mkdirSync(work, {recursive: true}); mkdirSync(source, {recursive: true})
  const csv = join(source, 'v.csv')
  writeFileSync(csv, 'id,ciudad,total\r\n1,Oaxaca,10.50\r\n2,Mérida,3.00\r\n')
  writeFileSync(join(dir, 'fuera.csv'), 'id,ciudad,total\r\n1,X,1.00\r\n')
  if (!existsSync(join(source, 'enlace.csv'))) symlinkSync(join(dir, 'fuera.csv'), join(source, 'enlace.csv'))
  writeFileSync(join(work, 'existe.csv'), 'x')
  const options = {workDir: work, tempDir: join(work, 'tmp'), threads: 2, memoryLimit: '512MB', sourceRoot: source}
  const src = {path: csv, columns: ['id', 'ciudad', 'total'], delimiter: ',', encoding: 'utf-8'}
  const results = []
  const attempt = async (name, operation, args, expect) => {
    let outcome, detail
    try { const value = await run(duck, operation, args, options).result; outcome = 'permitido'; detail = plain(value) } catch (error) { outcome = 'rechazado'; detail = String(error.message).split('\n')[0].slice(0, 110) }
    results.push({name, expect, outcome, ok: outcome === expect, detail})
  }
  await attempt('operación válida', 'count', {source: src}, 'permitido')
  await attempt('operación que no está en la lista', 'attach_database', {source: src}, 'rechazado')
  await attempt('SQL en lugar de operación', 'select 1; drop table x', {source: src}, 'rechazado')
  await attempt('valor con comillas y punto y coma (se enlaza como literal)', 'search_count', {source: src, value: "'; DROP TABLE x; --"}, 'permitido')
  await attempt('valor con NUL', 'search_count', {source: src, value: 'a\0b'}, 'rechazado')
  await attempt('columna fuera de rango', 'filter_count', {source: src, conditions: [{col: 99, op: 'eq', value: 'x'}]}, 'rechazado')
  await attempt('columna con texto en vez de entero', 'filter_count', {source: src, conditions: [{col: '1; drop', op: 'eq', value: 'x'}]}, 'rechazado')
  await attempt('operador no permitido', 'filter_count', {source: src, conditions: [{col: 1, op: 'like', value: '%'}]}, 'rechazado')
  await attempt('nombre de columna con comillas (se cita)', 'filter_extract', {source: {...src, columns: ['id', 'ciu"dad', 'total']}, columns: [1], output: join(work, 'comillas.csv')}, 'permitido')
  await attempt('fuente fuera de las carpetas autorizadas', 'count', {source: {...src, path: join(dir, 'fuera.csv')}}, 'rechazado')
  await attempt('fuente que es un enlace simbólico', 'count', {source: {...src, path: join(source, 'enlace.csv')}}, 'rechazado')
  await attempt('fuente con ruta relativa', 'count', {source: {...src, path: 'v.csv'}}, 'rechazado')
  await attempt('separador no admitido', 'count', {source: {...src, delimiter: "'"}}, 'rechazado')
  await attempt('codificación no admitida (Windows-1252)', 'count', {source: {...src, encoding: 'windows-1252'}}, 'rechazado')
  await attempt('salida fuera de la carpeta de trabajo', 'filter_extract', {source: src, columns: [0], output: join(dir, 'escapa.csv')}, 'rechazado')
  await attempt('salida que ya existe (nunca se sobrescribe)', 'filter_extract', {source: src, columns: [0], output: join(work, 'existe.csv')}, 'rechazado')
  await attempt('salida con ../ que sale de la carpeta', 'filter_extract', {source: src, columns: [0], output: join(work, '..', 'escapa2.csv')}, 'rechazado')
  await attempt('texto de 2 000 caracteres', 'search_count', {source: src, value: 'x'.repeat(2000)}, 'rechazado')
  return results
}
