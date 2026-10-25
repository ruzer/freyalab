// M2 · Proceso principal de Electron mínimo (sin ventanas): lanza el motor DuckDB en un utilityProcess y ejecuta los mismos modos que run-host.mjs.
//   M2_ARGS='{"install":"…","work":"…","out":"…","modes":"battery,security"}' electron experiments/duckdb-native/electron/main.mjs
import {app, utilityProcess} from 'electron'
import {writeFileSync} from 'node:fs'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import os from 'node:os'
import {Host} from '../lib/host.mjs'
import {settings, runModes} from '../lib/modes.mjs'
const here = dirname(fileURLToPath(import.meta.url))
const args = JSON.parse(process.env.M2_ARGS)
if (args.install === 'app') args.install = app.getAppPath() // aplicación empaquetada: @duckdb/node-api está dentro de app.asar (nativos en app.asar.unpacked)
app.dock?.hide()
// Con `selftest`, la misma aplicación empaquetada se comprueba sola (CI de empaquetado): una operación real y salida.
const spawn = () => {
  const child = utilityProcess.fork(args.worker ?? join(here, 'worker.mjs'), [], {serviceName: 'FreyaLab DuckDB M2'})
  let ready = false; const queue = []
  child.once('spawn', () => { ready = true; queue.splice(0).forEach(m => child.postMessage(m)) })
  return {get pid() { return child.pid }, post: m => (ready ? child.postMessage(m) : queue.push(m)), onMessage: f => child.on('message', f), onExit: f => child.on('exit', f), kill: () => child.kill()}
}
app.whenReady().then(async () => {
  let code = 0, report
  const host = new Host(spawn, 'utilityProcess de Electron')
  try {
    const s = settings(args)
    report = {kind: 'M2 proceso auxiliar', host: host.kind, started: new Date().toISOString(), platform: `${os.platform()} ${os.arch()}`, options: s.options,
      main: {electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome, modules: process.versions.modules}}
    Object.assign(report, await runModes(host, s, 'utility'))
  } catch (error) { code = 1; report = {...report, error: String(error.stack ?? error)} } finally { await host.stop() }
  writeFileSync(args.out, JSON.stringify(report, (k, v) => (typeof v === 'bigint' ? Number(v) : ArrayBuffer.isView(v) ? {length: v.length} : v), 2) + '\n')
  console.log('escrito', args.out)
  app.exit(code)
})
