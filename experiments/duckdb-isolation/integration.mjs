// M3 · Integración con el proceso principal de Node.
//   node integration.mjs --install <@duckdb/node-api> --work <carpeta nueva> --out resultados.json [--runtime node|electron] [--limit-mb 0]
// --runtime electron usa el binario de Electron con ELECTRON_RUN_AS_NODE=1 como hijo (el mismo ABI que el módulo nativo del producto).
import {writeFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {createRequire} from 'node:module'
import {integration} from './lib/integration-core.mjs'
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const runtime = args.runtime ?? 'node'
const exe = runtime === 'electron' ? createRequire(join(process.cwd(), 'package.json'))('electron') : process.execPath
const report = await integration({exe, baseEnv: runtime === 'electron' ? {ELECTRON_RUN_AS_NODE: '1'} : {}, install: resolve(args.install), work: resolve(args.work), parent: `Node ${process.version}`, memoryLimitMB: Number(args['limit-mb'] ?? 0)})
report.runtime = runtime
writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({runtime, verdict: report.confined?.verdict, coldStart: report.coldStart, kill: report.kill, recycle: report.recycle && {recycles: report.recycle.recycles, maxRssMB: report.recycle.maxRssMB, baselineRssMB: report.recycle.baselineRssMB}, selftest: report.confined?.selftest?.checks?.map(c => `${c.ok ? '✓' : '✗'} ${c.name}`), error: report.error?.split('\n')[0]}, null, 1))
process.exit(report.error ? 1 : 0)
