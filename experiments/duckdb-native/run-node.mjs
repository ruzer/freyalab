// M2 · Runner de Node: la batería funcional/rendimiento con el motor de lista cerrada, en el proceso de Node (sin Electron).
//   node run-node.mjs --install <carpeta-con-@duckdb/node-api> --work <carpeta-nueva-fuera-del-repo> --out resultados.json [--threads 12] [--parallel true|false]
import {readFileSync, writeFileSync, mkdirSync, statSync} from 'node:fs'
import {join, resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import os from 'node:os'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {loadDuckDB, run} from './lib/engine.mjs'
import {battery} from './lib/battery.mjs'
const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const workDir = resolve(args.work), duck = loadDuckDB(args.install)
mkdirSync(join(workDir, 'tmp'), {recursive: true})
const SOURCES = (args.sources ?? '/private/tmp/FreyaLab-pruebas/ventas_100MiB.csv,/private/tmp/FreyaLab-pruebas/ventas_1GiB.csv').split(',')
const oracle = JSON.parse(readFileSync(join(here, '../large-data-extracts/results/m1-ventas.json'), 'utf8'))
const options = {workDir, tempDir: join(workDir, 'tmp'), threads: Number(args.threads ?? 12), memoryLimit: args.memory ?? '4GB', parallel: (args.parallel ?? 'true') === 'true'}
const sh = promisify(execFile)
const rss = async () => Number((await sh('ps', ['-o', 'rss=', '-p', String(process.pid)])).stdout) * 1024

const client = {
  async call(operation, a) {
    let peak = await rss(), stop = false
    const sampler = (async () => { while (!stop) { peak = Math.max(peak, await rss()); await new Promise(r => setTimeout(r, 100)) } })()
    const cpu0 = process.cpuUsage(), t0 = performance.now()
    try { const value = await run(duck, operation, a, options).result; return {value, ms: performance.now() - t0, cpuMs: (process.cpuUsage(cpu0).user + process.cpuUsage(cpu0).system) / 1000, rssPeakBytes: peak} }
    finally { stop = true; await sampler }
  }
}
const files = SOURCES.map(path => ({name: path.split('/').pop(), path}))
const started = new Date().toISOString()
const results = await battery(client, {files, workDir, oracle, label: 'node'})
writeFileSync(args.out, JSON.stringify({kind: 'M2 batería en Node', started, options, node: process.version, platform: `${os.platform()} ${os.arch()}`,
  sources: files.map(f => ({...f, bytes: statSync(f.path).size})), results}, (k, v) => (typeof v === 'bigint' ? Number(v) : v), 2) + '\n')
