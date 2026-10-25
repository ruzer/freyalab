// M2 · Prototipo de motor DuckDB nativo con LISTA CERRADA de operaciones (experimento desechable, no código de producto).
// Principios que ejercita (RFC §7.4 y docs/design/EXTERNAL-ENGINES.md):
//  - nadie envía SQL: cada operación es una estructura tipada y el SQL sale de plantillas fijas; los literales van como parámetros enlazados;
//  - las columnas se nombran c0, c1… por posición (lo único que se interpola son enteros validados) y el esquema es EXPLÍCITO (sin sniffing);
//  - una instancia de DuckDB por operación, con acceso restringido a la fuente y a la salida (`allowed_paths`), `enable_external_access=false`,
//    extensiones desactivadas, límites de memoria y de disco temporal, y `lock_configuration=true` antes de ejecutar nada;
//  - la salida siempre es un archivo NUEVO dentro de la carpeta de trabajo; si la operación falla o se cancela, se borra.
import {createRequire} from 'node:module'
import {join, resolve, isAbsolute, sep, dirname, basename} from 'node:path'
import {mkdirSync, rmSync, existsSync, realpathSync, lstatSync} from 'node:fs'

export const OPERATIONS = ['count', 'filter_count', 'search_count', 'aggregate', 'filter_extract', 'sort_to_file', 'replace_literal_to_file', 'positions']
const DELIMITERS = new Set([',', ';', '\t', '|'])
const ENCODINGS = new Set(['utf-8', 'utf-16'])

const fail = message => { throw new TypeError(message) }
const isInt = (value, max = 100000) => Number.isInteger(value) && value >= 0 && value < max
const text = (value, name, max = 1024) => (typeof value === 'string' && value.length <= max && !value.includes('\0') ? value : fail(`${name} no válido`))
const ident = name => '"' + text(name, 'nombre de columna', 256).replaceAll('"', '""') + '"'
const literal = value => "'" + value.replaceAll("'", "''") + "'"

export function loadDuckDB(dir) { return createRequire(join(resolve(dir), 'package.json'))('@duckdb/node-api') }

function insideOf(root, path) {
  const real = realpathSync(root)
  const candidate = existsSync(path) ? realpathSync(path) : join(realpathSync(dirname(path)), basename(path))
  return candidate === real || candidate.startsWith(real + sep)
}

function validateSource(source, options) {
  if (!source || typeof source !== 'object') fail('fuente no válida')
  if (!isAbsolute(text(source.path, 'ruta de la fuente'))) fail('la fuente debe ser una ruta absoluta')
  if (!existsSync(source.path)) fail('la fuente no existe')
  if (lstatSync(source.path).isSymbolicLink()) fail('la fuente no puede ser un enlace simbólico')
  if (options.sourceRoot && !insideOf(options.sourceRoot, source.path)) fail('la fuente está fuera de las carpetas autorizadas')
  if (!Array.isArray(source.columns) || source.columns.length < 1 || source.columns.length > 2000) fail('columnas no válidas')
  source.columns.forEach(name => text(name, 'nombre de columna', 256))
  if (!DELIMITERS.has(source.delimiter ?? ',')) fail('separador no admitido')
  if (!ENCODINGS.has(source.encoding ?? 'utf-8')) fail('codificación no admitida (el motor solo recibe UTF-8 o UTF-16)')
  return {path: source.path, columns: source.columns, delimiter: source.delimiter ?? ',', encoding: source.encoding ?? 'utf-8'}
}

function validateOutput(output, options) {
  if (!isAbsolute(text(output, 'ruta de salida'))) fail('la salida debe ser una ruta absoluta')
  if (existsSync(output)) fail('la salida ya existe: nunca se sobrescribe')
  if (!insideOf(options.workDir, output)) fail('la salida debe estar dentro de la carpeta de trabajo')
  return output
}

function conditionsSql(conditions, source, params) {
  if (conditions === undefined) return ''
  if (!Array.isArray(conditions) || conditions.length > 16) fail('condiciones no válidas')
  const parts = conditions.map(condition => {
    if (!isInt(condition.col, source.columns.length)) fail('columna fuera de rango')
    params.push(text(condition.value, 'valor'))
    const slot = `$${params.length}`
    if (condition.op === 'eq') return `c${condition.col} = ${slot}`
    if (condition.op === 'contains') return `contains(c${condition.col}, ${slot})`
    return fail('operador no admitido')
  })
  return parts.length ? ' WHERE ' + parts.join(' AND ') : ''
}

function projection(source, columns) {
  const list = columns ?? source.columns.map((_, i) => i)
  if (!Array.isArray(list) || list.length < 1) fail('proyección no válida')
  return list.map(i => (isInt(i, source.columns.length) ? `c${i} AS ${ident(source.columns[i])}` : fail('columna fuera de rango'))).join(', ')
}

// Devuelve {sql, params, output?, kind}. `parallel` por defecto true: el lector no paralelo de DuckDB descarta en silencio un registro con comilla sin cerrar (M2).
export function plan(operation, args, options) {
  if (!OPERATIONS.includes(operation)) fail('operación no permitida')
  const source = validateSource(args.source, options)
  const params = [source.path]
  const read = `read_csv($1, columns={${source.columns.map((_, i) => `'c${i}': 'VARCHAR'`).join(', ')}}, auto_detect=false, header=true, delim=${literal(source.delimiter)}, quote='"', escape='"', strict_mode=true, parallel=${options.parallel ?? true}, encoding=${literal(source.encoding)})`
  const copy = (select, output) => `COPY (${select}) TO ${literal(output)} (FORMAT CSV, HEADER)`
  switch (operation) {
    case 'count': return {sql: `SELECT count(*) AS n FROM ${read}`, params, source}
    case 'filter_count': return {sql: `SELECT count(*) AS n FROM ${read}${conditionsSql(args.conditions, source, params)}`, params, source}
    case 'search_count': {
      params.push(text(args.value, 'valor'))
      return {sql: `SELECT count(*) AS n FROM ${read} WHERE ${source.columns.map((_, i) => `contains(c${i}, $2)`).join(' OR ')}`, params, source}
    }
    case 'aggregate': {
      if (!Array.isArray(args.groupBy) || args.groupBy.length < 1 || !args.groupBy.every(i => isInt(i, source.columns.length)) || !isInt(args.sumColumn, source.columns.length)) fail('agregación no válida')
      const keys = args.groupBy.map(i => `c${i}`).join(', ')
      return {sql: `SELECT ${args.groupBy.map(i => `c${i} AS k${i}`).join(', ')}, count(*) AS n, CAST(SUM(CAST(c${args.sumColumn} AS DECIMAL(38,2))) AS VARCHAR) AS sum FROM ${read} GROUP BY ${keys} ORDER BY ${keys}`, params, source}
    }
    case 'filter_extract': {
      const output = validateOutput(args.output, options)
      return {sql: copy(`SELECT ${projection(source, args.columns)} FROM ${read}${conditionsSql(args.conditions, source, params)}`, output), params, source, output}
    }
    case 'sort_to_file': {
      const output = validateOutput(args.output, options)
      if (!Array.isArray(args.keys) || args.keys.length < 1 || args.keys.length > 8) fail('claves no válidas')
      const order = args.keys.map(key => `c${isInt(key.col, source.columns.length) ? key.col : fail('columna fuera de rango')} ${key.desc ? 'DESC' : 'ASC'}`).join(', ')
      return {sql: copy(`SELECT ${projection(source)} FROM ${read} ORDER BY ${order}`, output), params, source, output}
    }
    case 'replace_literal_to_file': {
      const output = validateOutput(args.output, options)
      if (!isInt(args.col, source.columns.length)) fail('columna fuera de rango')
      params.push(text(args.find, 'texto a buscar'), text(args.replace, 'texto de reemplazo'))
      const select = source.columns.map((name, i) => (i === args.col ? `replace(c${i}, $2, $3) AS ${ident(name)}` : `c${i} AS ${ident(name)}`)).join(', ')
      return {sql: copy(`SELECT ${select} FROM ${read}`, output), params, source, output}
    }
    case 'positions': {
      const where = conditionsSql(args.conditions, source, params)
      return {sql: `SELECT rn FROM (SELECT row_number() OVER () AS rn, * FROM ${read})${where} ORDER BY rn`, params, source}
    }
  }
}

export async function openInstance(duck, spec, options) {
  mkdirSync(options.tempDir, {recursive: true})
  const instance = await duck.DuckDBInstance.create(':memory:')
  const connection = await instance.connect()
  const set = sql => connection.run(sql)
  // Orden del RFC §7.2: todo lo ajustable ANTES de bloquear.
  await set('SET autoinstall_known_extensions=false')
  await set('SET autoload_known_extensions=false')
  await set(`SET custom_extension_repository=${literal(join(options.workDir, 'sin-repositorio'))}`)
  await set(`SET threads=${isInt(options.threads, 257) ? options.threads : fail('threads')}`)
  await set(`SET memory_limit=${literal(/^\d+(MB|GB)$/.test(options.memoryLimit) ? options.memoryLimit : fail('memory_limit'))}`)
  await set(`SET temp_directory=${literal(options.tempDir)}`)
  await set(`SET max_temp_directory_size=${literal(/^\d+(MB|GB)$/.test(options.maxTemp ?? '8GB') ? options.maxTemp ?? '8GB' : fail('max_temp_directory_size'))}`)
  await set('SET preserve_insertion_order=true')
  // Devolver la memoria al sistema tras cada tarea (M2: sin esto el proceso conserva su máximo de RSS tras cerrar la instancia).
  if (options.allocatorFlushThreshold) await set(`SET allocator_flush_threshold=${literal(/^\d+(KB|MB)$/.test(options.allocatorFlushThreshold) ? options.allocatorFlushThreshold : fail('allocator_flush_threshold'))}`)
  if (options.allocatorBackgroundThreads) await set('SET allocator_background_threads=true')
  const files = [spec.source.path, ...(spec.output ? [spec.output] : [])]
  await set(`SET allowed_paths=[${files.map(literal).join(', ')}]`)
  await set(`SET allowed_directories=[${literal(options.tempDir + sep)}]`)
  await set('SET enable_external_access=false')
  await set('SET lock_configuration=true')
  return {instance, connection}
}

// Ejecuta UNA operación. Devuelve {result, cancel}: `cancel()` llama a interrupt(). Si falla o se cancela se borra la salida parcial.
export function run(duck, operation, args, options) {
  const spec = plan(operation, args, options)
  let connection, instance, cancelled = false
  const promise = (async () => {
    try {
      ;({instance, connection} = await openInstance(duck, spec, options))
      if (cancelled) throw new Error('INTERRUPT Error: cancelada antes de empezar')
      const prepared = await connection.prepare(spec.sql)
      spec.params.forEach((value, index) => prepared.bindVarchar(index + 1, value))
      const reader = await prepared.runAndReadAll()
      if (operation === 'positions') return {positions: Int32Array.from(reader.getColumns()[0], Number)}
      if (spec.output) return {output: spec.output, rows: Number(reader.getRows()[0]?.[0] ?? 0)}
      return {rows: reader.getRowObjects().map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])))}
    } catch (error) {
      if (spec.output) rmSync(spec.output, {force: true})
      throw error
    } finally {
      try { connection?.closeSync() } catch {}
      try { instance?.closeSync() } catch {}
    }
  })()
  return {result: promise, cancel() { cancelled = true; try { connection?.interrupt() } catch {} }}
}
