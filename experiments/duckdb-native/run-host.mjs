// M2 · Motor en un PROCESO AUXILIAR de Node (child_process.fork).
//   node run-host.mjs --install <carpeta con @duckdb/node-api> --work <carpeta nueva fuera del repo> --out resultados.json --modes battery,security,cancel,leak,kill,spill
import {fork} from 'node:child_process'
import {writeFileSync} from 'node:fs'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import os from 'node:os'
import {Host} from './lib/host.mjs'
import {settings, runModes} from './lib/modes.mjs'
const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const s = settings(args)
const spawn = () => {
  const child = fork(join(here, 'node-worker.mjs'), [], {stdio: ['ignore', 'inherit', 'inherit', 'ipc'], serialization: 'advanced'})
  return {pid: child.pid, post: m => child.send(m), onMessage: f => child.on('message', f), onExit: f => child.on('exit', f), kill: () => child.kill('SIGKILL')}
}
const host = new Host(spawn, 'proceso hijo de Node (child_process.fork)')
const report = {kind: 'M2 proceso auxiliar', host: host.kind, started: new Date().toISOString(), platform: `${os.platform()} ${os.arch()}`, options: s.options}
try { Object.assign(report, await runModes(host, s, 'hijo-node')) } finally { await host.stop() }
writeFileSync(args.out, JSON.stringify(report, (k, v) => (typeof v === 'bigint' ? Number(v) : ArrayBuffer.isView(v) ? {length: v.length} : v), 2) + '\n')
console.log('escrito', args.out)
