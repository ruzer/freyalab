// M2 · ¿Escribe igual `COPY … TO … (FORMAT CSV)` en versiones distintas de DuckDB? Mismo CSV de entrada, DuckDB nativo 2.0.0 y la CLI instalada.
//   node copy-format.mjs --install <@duckdb/node-api> --cli /opt/homebrew/bin/duckdb --work <carpeta nueva> --out resultados.json
import {writeFileSync, readFileSync, mkdirSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {loadDuckDB} from './lib/engine.mjs'
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const work = resolve(args.work), duck = loadDuckDB(args.install)
mkdirSync(work, {recursive: true})
const input = join(work, 'entrada.csv')
const text = 'a,b,c,d\r\n1,,"",x\r\n2," espacios ","con ""comillas""","línea 1\nlínea 2"\r\n3,"con,coma",ñ,"€"\r\n'
writeFileSync(input, text)
const sql = out => `COPY (SELECT * FROM read_csv('${input}', header=true, all_varchar=true, strict_mode=true, delim=',', quote='"', escape='"', parallel=true)) TO '${out}' (FORMAT CSV, HEADER)`
const instance = await duck.DuckDBInstance.create(':memory:'), connection = await instance.connect()
const nativeOut = join(work, 'salida-nativo.csv'), cliOut = join(work, 'salida-cli.csv')
await connection.run(sql(nativeOut))
const version = (await connection.runAndReadAll('select version() v')).getRows()[0][0]
execFileSync(args.cli, ['-no-init', '-batch', '-c', sql(cliOut)])
const cliVersion = execFileSync(args.cli, ['--version'], {encoding: 'utf8'}).trim()
const show = path => JSON.stringify(readFileSync(path, 'utf8'))
const result = {kind: 'M2 formato de salida de COPY entre versiones', input: JSON.stringify(text), native: {version, output: show(nativeOut)}, cli: {version: cliVersion, output: show(cliOut)}, identical: readFileSync(nativeOut).equals(readFileSync(cliOut))}
writeFileSync(args.out, JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 1))
