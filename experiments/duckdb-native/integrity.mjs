// M2 · Integridad frente al índice de FreyaLab (L2) y a un analizador estricto (csv-parse): el motor no es el validador.
//   node --experimental-transform-types --no-warnings integrity.mjs --install <@duckdb/node-api> --work <carpeta nueva> --out resultados.json
// Para cada fixture: recuento de registros del índice de FreyaLab, veredicto de csv-parse estricto y recuento (o error) de DuckDB con el lector
// paralelo y con el no paralelo; después, si la operación se delegaría (R2/R3 de docs/design/EXTERNAL-ENGINES.md).
import {writeFileSync, mkdirSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {parse} from 'csv-parse/sync'
import iconv from 'iconv-lite'
import {buildIndex} from '../../src/main/large-table.ts'
import {loadDuckDB, run} from './lib/engine.mjs'
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const work = resolve(args.work), duck = loadDuckDB(args.install)
mkdirSync(join(work, 'tmp'), {recursive: true})
const H = 'id,zip,nombre,nota'
const fixtures = [
  ['regular', `${H}\r\n00123,01000,Ana,x\r\n2,72000,José,y\r\n3,97000,Zoë,z\r\n`, 'utf8'],
  ['campos_entrecomillados_multilinea', `${H}\r\n1,01000,"a, b","línea 1\nlínea 2"\r\n2,72000,"dice ""hola""","l1\r\nl2"\r\n3,97000,,\r\n`, 'utf8'],
  ['fila_corta', `${H}\r\n1,01000,Ana\r\n2,72000,José,x\r\n`, 'utf8'],
  ['campo_de_mas', `${H}\r\n1,01000,Ana,x,EXTRA\r\n2,72000,José,x\r\n`, 'utf8'],
  ['comilla_sin_cerrar_a_mitad', `${H}\r\n1,01000,Ana,x\r\n2,72000,"José,y\r\n3,97000,Zoë,z\r\n`, 'utf8'],
  ['comilla_sin_cerrar_en_el_ultimo_registro', `${H}\r\n1,01000,Ana,x\r\n2,72000,Zoë,"z\r\n`, 'utf8'],
  ['sin_salto_de_linea_final', `${H}\r\n1,01000,Ana,x\r\n2,72000,José,y`, 'utf8'],
  ['bom_utf8', '﻿' + `${H}\r\n1,01000,Ana,x\r\n2,72000,José,y\r\n`, 'utf8bom'],
  ['utf16_le_con_bom', `${H}\r\n1,01000,Ana,x\r\n2,72000,José,y\r\n`, 'utf16bom'],
  ['utf16_longitud_impar', `${H}\r\n1,01000,Ana,x\r\n`, 'utf16odd']
]
const encodeOf = (text, kind) => kind === 'utf16bom' ? Buffer.concat([Buffer.from([0xff, 0xfe]), iconv.encode(text, 'utf16le')]) : kind === 'utf16odd' ? Buffer.concat([Buffer.from([0xff, 0xfe]), iconv.encode(text, 'utf16le'), Buffer.from([0])]) : Buffer.from(text, 'utf8')
const results = []
for (const [name, text, kind] of fixtures) {
  const path = join(work, `${name}.csv`)
  writeFileSync(path, encodeOf(text, kind))
  const entry = {fixture: name, bytes: encodeOf(text, kind).length}
  const utf16 = kind.startsWith('utf16'), bom = kind === 'utf8bom' ? 3 : utf16 ? 2 : 0
  try { const index = await buildIndex(path, {encoding: utf16 ? 'utf16le' : 'utf8', bomLength: bom, maxRecord: 1024 * 1024}); entry.freyalab = {records: index.records, dataRecords: index.records - 1} } catch (error) { entry.freyalab = {error: String(error.message).slice(0, 120)} }
  try {
    if (utf16 && (encodeOf(text, kind).length - 2) % 2) throw new Error('UTF-16 con un número impar de bytes: decodificación incompleta')
    const decoded = utf16 ? iconv.decode(Buffer.from(encodeOf(text, kind).subarray(2)), 'utf16le') : encodeOf(text, kind).toString('utf8').replace(/^﻿/, '')
    const rows = parse(decoded, {relax_column_count: false, skip_empty_lines: false, bom: false})
    entry.strict = {ok: true, dataRecords: rows.length - 1}
  } catch (error) { entry.strict = {ok: false, error: String(error.message).slice(0, 120)} }
  const source = {path, columns: ['id', 'zip', 'nombre', 'nota'], delimiter: ',', encoding: utf16 ? 'utf-16' : 'utf-8'}
  entry.duckdb = {}
  for (const parallel of [true, false]) {
    try { const r = await run(duck, 'count', {source}, {workDir: work, tempDir: join(work, 'tmp'), threads: 2, memoryLimit: '512MB', parallel}).result; entry.duckdb[parallel ? 'parallel' : 'serial'] = {count: r.rows[0].n} }
    catch (error) { entry.duckdb[parallel ? 'parallel' : 'serial'] = {error: String(error.message).split('\n').slice(0, 2).join(' | ').slice(0, 150)} }
  }
  // Veredicto: se delega solo si csv-parse estricto acepta y el recuento del motor coincide con el del índice (R2 y R3).
  const expected = entry.freyalab.dataRecords
  entry.delegate = {allowed_by_strict: entry.strict.ok, strict_matches_index: entry.strict.ok && entry.strict.dataRecords === expected, parallel_reconciles: entry.duckdb.parallel.count === expected, serial_reconciles: entry.duckdb.serial.count === expected}
  entry.delegate.verdict = !entry.strict.ok || !entry.delegate.strict_matches_index ? 'se rechaza antes de delegar (R2)' : entry.delegate.parallel_reconciles ? 'se delega y el recuento cuadra' : 'se delega pero el recuento NO cuadra (R3 lo detiene)'
  results.push(entry)
  console.log(name.padEnd(42), 'índice', entry.freyalab.dataRecords ?? 'error', '| estricto', entry.strict.ok ? entry.strict.dataRecords : 'rechaza', '| paralelo', entry.duckdb.parallel.count ?? 'error', '| serie', entry.duckdb.serial.count ?? 'error')
}
writeFileSync(args.out, JSON.stringify({kind: 'M2 integridad frente al índice de FreyaLab', node: process.version, results}, null, 2) + '\n')
