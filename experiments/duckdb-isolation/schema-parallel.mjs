// M3 · Esquema explícito y lector paralelo de DuckDB frente a un analizador estricto independiente (csv-parse, el mismo que valida E1).
//   node schema-parallel.mjs --install <@duckdb/node-api> --work <carpeta nueva> --out resultados.json [--stress-mib 64] [--fixture <csv grande>]
// Para cada caso hostil del corpus y cada modo (paralelo / no paralelo) clasifica el comportamiento de DuckDB:
//   coincide · duckdb-rechaza (más estricto: seguro) · ambos-rechazan · DUCKDB-ACEPTA-LO-QUE-EL-ANALIZADOR-RECHAZA · DISTINTO (ambos aceptan pero los valores no coinciden)
// Las dos últimas son las peligrosas: un motor externo no puede aceptar en silencio lo que el motor propio rechaza o interpretar distinto un registro.
import {mkdirSync, writeFileSync, rmSync, createWriteStream} from 'node:fs'
import {join, resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {once} from 'node:events'
import {parse as parseSync} from 'csv-parse/sync'
import {parse as parseStream} from 'csv-parse'
import {createReadStream} from 'node:fs'
import {loadDuckDB} from '../duckdb-native/lib/engine.mjs'
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const work = resolve(args.work), duck = loadDuckDB(args.install)
mkdirSync(work, {recursive: true})
const literal = value => "'" + value.replaceAll("'", "''") + "'"
const bytes = text => Buffer.from(text, 'utf8')

// Analizador estricto, igual que el de E1 (src/main/operations.ts): delimitador de registro por terminador, columnas relajadas, sin saltar líneas vacías.
function oracle(buffer, {delimiter = ',', cr = false} = {}) {
  try { return {ok: true, rows: parseSync(buffer.toString('utf8'), {delimiter, bom: true, relax_column_count: true, skip_empty_lines: false, record_delimiter: cr ? ['\r'] : ['\r\n', '\n']})} }
  catch (error) { return {ok: false, error: `${error.code ?? 'ERROR'}: ${String(error.message).split('\n')[0].slice(0, 120)}`} }
}
const mkRead = (path, columns, {parallel, delimiter = ',', maxLine, bufferSize} = {}) => ({
  sql: `select * from read_csv($1, columns={${Array.from({length: columns}, (_, i) => `'c${i}': 'VARCHAR'`).join(', ')}}, auto_detect=false, header=true, delim=${literal(delimiter)}, quote='"', escape='"', strict_mode=true, parallel=${parallel}, encoding='utf-8'${maxLine ? `, max_line_size=${maxLine}` : ''}${bufferSize ? `, buffer_size=${bufferSize}` : ''})`,
  params: [path]
})
async function duckRows(path, columns, options, threads = 4) {
  const instance = await duck.DuckDBInstance.create(':memory:'), connection = await instance.connect()
  try {
    await connection.run(`SET threads=${threads}`); await connection.run('SET autoinstall_known_extensions=false'); await connection.run('SET autoload_known_extensions=false')
    const {sql, params} = mkRead(path, columns, options)
    const reader = await connection.runAndReadAll(sql, params)
    return {ok: true, rows: reader.getRows().map(row => row.map(value => (value === null ? '' : String(value))))}
  } catch (error) { return {ok: false, error: String(error.message).split('\n')[0].slice(0, 160)} }
  finally { connection.closeSync(); instance.closeSync() }
}
const same = (a, b) => a.length === b.length && a.every((row, i) => row.length === b[i].length && row.every((cell, j) => cell === b[i][j]))
function classify(expected, got) {
  if (!expected.ok && !got.ok) return 'ambos-rechazan'
  if (expected.ok && !got.ok) return 'duckdb-rechaza'
  if (!expected.ok && got.ok) return 'DUCKDB-ACEPTA-LO-QUE-EL-ANALIZADOR-RECHAZA'
  return same(expected.rows.slice(1), got.rows) ? 'coincide' : 'DISTINTO'
}

// ---- Corpus hostil -------------------------------------------------------------------------------------------------------------------------------
const H = 'id,zip,nombre,nota'
const big = 'x'.repeat(1.5 * 1024 * 1024)
const cases = [
  ['regular CRLF', `${H}\r\n1,01000,Ana,hola\r\n2,72000,José,adiós\r\n`],
  ['regular LF', `${H}\n1,01000,Ana,hola\n2,72000,José,adiós\n`],
  ['fin de línea mixto', `${H}\r\n1,01000,Ana,a\n2,72000,José,b\r\n3,0,Eva,c\n`],
  ['solo CR', `${H}\r1,01000,Ana,hola\r2,72000,José,adiós\r`, {cr: true}],
  ['sin salto final', `${H}\r\n1,01000,Ana,hola\r\n2,72000,José,adiós`],
  ['líneas vacías intermedias', `${H}\r\n1,01000,Ana,hola\r\n\r\n2,72000,José,adiós\r\n`],
  ['campo multilínea entre comillas', `${H}\r\n1,01000,Ana,"línea 1\r\nlínea 2"\r\n2,72000,José,b\r\n`],
  ['comillas dobladas', `${H}\r\n1,01000,Ana,"dijo ""hola"""\r\n2,72000,José,""""\r\n`],
  ['comilla en medio de un campo sin comillas', `${H}\r\n1,01000,Ana,a"b\r\n2,72000,José,c\r\n`],
  ['texto tras la comilla de cierre', `${H}\r\n1,01000,Ana,"abc"def\r\n2,72000,José,c\r\n`],
  ['espacio antes de la comilla', `${H}\r\n1,01000,Ana, "abc"\r\n2,72000,José,c\r\n`],
  ['comilla sin cerrar al final del archivo', `${H}\r\n1,01000,Ana,hola\r\n2,72000,José,"sin cerrar\r\n3,0,Eva,c\r\n`],
  ['comilla sin cerrar en el último registro', `${H}\r\n1,01000,Ana,hola\r\n2,72000,José,"sin cerrar`],
  ['barra invertida antes de la comilla', `${H}\r\n1,01000,Ana,"a\\"b"\r\n2,72000,José,c\r\n`],
  ['fila corta', `${H}\r\n1,01000,Ana\r\n2,72000,José,x\r\n`],
  ['fila con campo de más', `${H}\r\n1,01000,Ana,x,EXTRA\r\n2,72000,José,x\r\n`],
  ['campo vacío final', `${H}\r\n1,01000,Ana,\r\n2,72000,José,\r\n`],
  ['BOM UTF-8', `﻿${H}\r\n1,01000,Ana,hola\r\n`],
  ['byte NUL en un campo', `${H}\r\n1,01000,Ana,a\u0000b\r\n2,72000,José,c\r\n`],
  ['solo encabezado', `${H}\r\n`],
  ['archivo vacío', ''],
  ['una columna con salto entre comillas', 'a\r\n"x\r\ny"\r\nz\r\n', {columns: 1}],
  ['registro de 1,5 MiB (entre el tope de FreyaLab y el de DuckDB)', `${H}\r\n1,01000,Ana,${big}\r\n2,72000,José,b\r\n`],
  ['punto y coma', 'id;zip;nombre;nota\r\n1;01000;Ana;"a;b"\r\n', {delimiter: ';'}],
  ['tabulador', 'id\tzip\tnombre\tnota\r\n1\t01000\tAna\t"a\tb"\r\n', {delimiter: '\t'}]
]
const invalid = Buffer.concat([bytes(`${H}\r\n1,01000,Ana,`), Buffer.from([0xff, 0xfe, 0x41]), bytes('\r\n2,72000,José,c\r\n')])
const results = []
for (const [name, content, options = {}] of cases) {
  const path = join(work, `caso-${results.length}.csv`), buffer = typeof content === 'string' ? bytes(content) : content
  writeFileSync(path, buffer)
  const columns = options.columns ?? 4, expected = oracle(buffer, options)
  const entry = {caso: name, bytes: buffer.length, analizador: expected.ok ? {registros: expected.rows.length} : {error: expected.error}}
  for (const [label, parallel, threads] of [['paralelo', true, 4], ['no_paralelo', false, 4], ['paralelo_1_hilo', true, 1]]) {
    const got = await duckRows(path, columns, {parallel, delimiter: options.delimiter}, threads)
    entry[label] = {veredicto: classify(expected, got), ...(got.ok ? {filas: got.rows.length} : {error: got.error})}
  }
  if (name.startsWith('registro de 1,5')) { const got = await duckRows(path, columns, {parallel: true, maxLine: 1048576}); entry.con_tope_de_1_MiB = {veredicto: classify({ok: false, error: 'FreyaLab rechaza registros de más de 1 MiB'}, got), ...(got.ok ? {filas: got.rows.length} : {error: got.error})} }
  results.push(entry)
}
{ // bytes UTF-8 no válidos: el analizador de E1 decodifica con TextDecoder estricto y rechaza; DuckDB con encoding utf-8 debería rechazar
  const path = join(work, 'caso-utf8-invalido.csv'); writeFileSync(path, invalid)
  let expected; try { new TextDecoder('utf-8', {fatal: true}).decode(invalid); expected = oracle(invalid) } catch (error) { expected = {ok: false, error: 'UTF-8 no válido'} }
  const entry = {caso: 'bytes UTF-8 no válidos', bytes: invalid.length, analizador: {error: expected.error}}
  for (const [label, parallel, threads] of [['paralelo', true, 4], ['no_paralelo', false, 4], ['paralelo_1_hilo', true, 1]]) { const got = await duckRows(path, 4, {parallel}, threads); entry[label] = {veredicto: classify(expected, got), ...(got.ok ? {filas: got.rows.length} : {error: got.error})} }
  results.push(entry)
}
const dangerous = results.flatMap(r => ['paralelo', 'no_paralelo', 'paralelo_1_hilo'].filter(m => /^(DUCKDB|DISTINTO)/.test(r[m].veredicto)).map(m => ({caso: r.caso, modo: m, veredicto: r[m].veredicto})))

// ---- Estrés de fronteras de trozo -----------------------------------------------------------------------------------------------------------------
// Un archivo con campos multilínea entre comillas, comillas dobladas y longitudes variables: cada frontera de trozo (buffer_size) cae en sitios distintos.
async function makeStress(path, mib) {
  const out = createWriteStream(path); let seed = 20261025, size = 0, rows = 0
  const next = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n }
  const write = async text => { size += Buffer.byteLength(text); if (!out.write(text)) await once(out, 'drain') }
  await write('id,zip,nombre,nota\r\n')
  while (size < mib * 1024 * 1024) {
    rows++
    const pad = 'abc "q" , ; \r\n\n'.repeat(next(40)) + 'z'.repeat(next(300))
    await write(`${rows},${String(next(99999)).padStart(5, '0')},"Nombre ""${next(1000)}""\r\nlínea 2",${next(2) ? '"' + pad.replaceAll('"', '""') + '"' : 'simple'}\r\n`)
  }
  out.end(); await once(out, 'finish'); return {rows, size}
}
const stressMiB = Number(args['stress-mib'] ?? 64)
const stressPath = join(work, 'estres.csv'), made = await makeStress(stressPath, stressMiB)
const canonical = rows => { const hash = createHash('sha256'); for (const row of rows) hash.update(row.map(f => `${Buffer.byteLength(f)}:${f}`).join(',') + '\n'); return hash.digest('hex') }
const streamRows = path => new Promise((ok, no) => { const rows = []; createReadStream(path).pipe(parseStream({delimiter: ',', bom: true, relax_column_count: true, skip_empty_lines: false, record_delimiter: ['\r\n', '\n']})).on('data', r => rows.push(r)).on('end', () => ok(rows)).on('error', no) })
const reference = await streamRows(stressPath)
const stress = {archivo: {mib: stressMiB, filas: made.rows, bytes: made.size}, referencia: {filas: reference.length - 1, sha256: canonical(reference.slice(1))}, lecturas: []}
for (const [label, options] of [['paralelo, trozo por defecto', {parallel: true}], ['no paralelo', {parallel: false}], ['paralelo, trozo de 8 MiB', {parallel: true, bufferSize: 8 << 20}], ['paralelo, trozo de 1 MiB', {parallel: true, bufferSize: 1 << 20}], ['paralelo, trozo de 256 KiB', {parallel: true, bufferSize: 256 << 10}]]) {
  const t0 = performance.now(), got = await duckRows(stressPath, 4, options), ms = Math.round(performance.now() - t0)
  stress.lecturas.push(got.ok ? {modo: label, ms, filas: got.rows.length, sha256: canonical(got.rows), coincide: got.rows.length === reference.length - 1 && canonical(got.rows) === stress.referencia.sha256} : {modo: label, ms, error: got.error})
}
rmSync(stressPath, {force: true})

const report = {kind: 'M3 esquema explícito y lector paralelo de DuckDB frente al analizador estricto', platform: `${process.platform} ${process.arch}`, node: process.version, duckdb: (await (await (await (await duck.DuckDBInstance.create(':memory:')).connect()).runAndReadAll('select version() v')).getRows())[0][0],
  lector: "read_csv(columns={c0:'VARCHAR',…}, auto_detect=false, header=true, quote='\"', escape='\"', strict_mode=true, encoding='utf-8')", peligrosos: dangerous, casos: results, estres: stress}
writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n')
const tally = {}; for (const r of results) for (const m of ['paralelo', 'no_paralelo', 'paralelo_1_hilo']) tally[`${m}: ${r[m].veredicto}`] = (tally[`${m}: ${r[m].veredicto}`] ?? 0) + 1
console.log(JSON.stringify({duckdb: report.duckdb, resumen: tally, peligrosos: dangerous, estres: stress.lecturas.map(l => `${l.modo}: ${l.coincide ?? l.error}`)}, null, 1))
