// M2 · ¿Qué hace el *sniffing* de DuckDB con archivos pequeños e irregulares? Registra el dialecto que detecta y lo que devuelve.
//   node sniffing.mjs --install <@duckdb/node-api> --work <carpeta nueva> --out resultados.json
import {writeFileSync, mkdirSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {loadDuckDB} from './lib/engine.mjs'
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const work = resolve(args.work), duck = loadDuckDB(args.install)
mkdirSync(work, {recursive: true})
const H = 'id,zip,nombre,nota'
const fixtures = {fila_corta: `${H}\r\n1,01000,Ana\r\n2,72000,José,x\r\n`, campo_de_mas: `${H}\r\n1,01000,Ana,x,EXTRA\r\n2,72000,José,x\r\n`, regular: `${H}\r\n1,01000,Ana,x\r\n2,72000,José,y\r\n`}
const instance = await duck.DuckDBInstance.create(':memory:'), connection = await instance.connect()
const plain = value => JSON.parse(JSON.stringify(value, (k, v) => (typeof v === 'bigint' ? Number(v) : v)))
const results = []
for (const [name, text] of Object.entries(fixtures)) {
  const path = join(work, name + '.csv'); writeFileSync(path, text)
  const entry = {fixture: name}
  try { const s = (await connection.runAndReadAll('select Delimiter, Quote, Escape, HasHeader, Columns from sniff_csv($1)', [path])).getRowObjects()[0]; entry.sniff = plain({delimiter: s.Delimiter, hasHeader: s.HasHeader, columns: s.Columns}) } catch (error) { entry.sniffError = String(error.message).split('\n')[0] }
  try { const r = (await connection.runAndReadAll('select * from read_csv($1, header=true, all_varchar=true, strict_mode=true, parallel=false)', [path])).getRowObjects(); entry.read = {rows: r.length, columns: Object.keys(r[0] ?? {}), firstRow: plain(r[0])} } catch (error) { entry.readError = String(error.message).split('\n')[0] }
  results.push(entry)
  console.log(name, JSON.stringify(entry).slice(0, 220))
}
writeFileSync(args.out, JSON.stringify({kind: 'M2 sniffing de DuckDB con archivos pequeños e irregulares', version: (await connection.runAndReadAll('select version() v')).getRows()[0][0], results}, null, 2) + '\n')
