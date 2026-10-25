// M2 · Patrón «DuckDB decide, FreyaLab copia los bytes»: DuckDB calcula QUÉ registros coinciden (posiciones) y el índice de FreyaLab (L2) copia esos
// registros desde el original. Mide cada paso y deja el archivo para que verify_pattern.py compare los bytes con los del original.
//   node --experimental-transform-types --no-warnings pattern.mjs --install <@duckdb/node-api> --work <carpeta nueva> --source <csv> --out resultados.json
import {writeFileSync, mkdirSync, openSync, writeSync, closeSync, readSync, statSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {buildIndex, readRecords} from '../../src/main/large-table.ts'
import {loadDuckDB, run} from './lib/engine.mjs'
import {HEADER} from './lib/battery.mjs'
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const work = resolve(args.work), duck = loadDuckDB(args.install), path = resolve(args.source)
mkdirSync(join(work, 'tmp'), {recursive: true})
const options = {workDir: work, tempDir: join(work, 'tmp'), threads: 12, memoryLimit: '4GB', parallel: true}
const COL = Object.fromEntries(HEADER.map((n, i) => [n, i]))
const source = {path, columns: HEADER, delimiter: ',', encoding: 'utf-8'}
const conditions = [{col: COL.ciudad, op: 'eq', value: 'Oaxaca'}, {col: COL.estado, op: 'eq', value: 'entregado'}]
const timed = async fn => { const t0 = performance.now(); const value = await fn(); return {value, ms: performance.now() - t0} }

const index = await timed(() => buildIndex(path, {encoding: 'utf8', bomLength: 0, maxRecord: 1024 * 1024}))
const total = await timed(() => run(duck, 'count', {source}, options).result)
const dataRecords = index.value.records - 1
const reconciles = total.value.rows[0].n === dataRecords
const positions = await timed(() => run(duck, 'positions', {source, conditions}, options).result)
const eol = (() => { const fd = openSync(path, 'r'), b = Buffer.alloc(4096); readSync(fd, b, 0, 4096, 0); closeSync(fd); return b.includes('\r\n') ? '\r\n' : '\n' })()

const output = join(work, 'patron-bytes.csv')
const copy = await timed(async () => {
  const fd = openSync(output, 'wx'), chosen = positions.value.positions // ordinales 1-based de registros de datos = ordinal del índice (0 = cabecera)
  const every = index.value.every
  let written = 0, cursor = 0
  const write = text => { written += writeSync(fd, text) }
  write((await readRecords(index.value, 0, 1))[0] + eol)
  while (cursor < chosen.length) {
    const block = Math.floor(chosen[cursor] / every) * every
    const texts = await readRecords(index.value, block, every)
    while (cursor < chosen.length && chosen[cursor] < block + every) { write(texts[chosen[cursor] - block] + eol); cursor++ }
  }
  closeSync(fd)
  return written
})
const columnar = await timed(() => run(duck, 'filter_extract', {source, conditions, output: join(work, 'patron-duckdb-registro-completo.csv')}, options).result)
const sha = createHash('sha256').update((await import('node:fs')).readFileSync(output)).digest('hex')
const report = {kind: 'M2 patrón DuckDB decide / FreyaLab copia', source: path, sourceBytes: statSync(path).size, eolAssumed: JSON.stringify(eol),
  freyalab: {indexMs: index.ms, records: index.value.records, dataRecords}, duckdb: {countMs: total.ms, count: total.value.rows[0].n, reconcilesWithIndex: reconciles, positionsMs: positions.ms, matches: positions.value.positions.length},
  copy: {ms: copy.ms, bytes: copy.value, output, sha256: sha}, duckdbWholeRecordExtract: {ms: columnar.ms, rows: columnar.value.rows, output: columnar.value.output},
  totalPatternMs: positions.ms + copy.ms}
writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 1))
