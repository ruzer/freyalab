// M3 · Proceso principal de Electron mínimo (sin ventanas): (1) comprueba qué puede hacer un utilityProcess con DuckDB (no se puede envolver en la capa:
// lo crea Chromium) y (2) ejecuta la integración con un hijo confinado lanzado desde este proceso principal.
//   M3_ARGS='{"install":"…","work":"…","out":"…"}' electron experiments/duckdb-isolation/electron/main.mjs   (o el ejecutable empaquetado)
import {app, utilityProcess} from 'electron'
import {writeFileSync, mkdirSync, rmSync} from 'node:fs'
import {join, dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import net from 'node:net'
import os from 'node:os'
import {integration} from '../lib/integration-core.mjs'
import {verdict} from '../lib/probes.mjs'
const here = dirname(fileURLToPath(import.meta.url))
const args = JSON.parse(process.env.M3_ARGS)
if (args.install === 'app') args.install = app.getAppPath()
app.dock?.hide()
async function utilityControl(install) {
  const outside = join(os.tmpdir(), `m3-util-fuera-${process.pid}`); mkdirSync(outside, {recursive: true})
  const secret = join(outside, 'secreto.txt'); writeFileSync(secret, 'SECRETO\n')
  const server = net.createServer(socket => { socket.on('error', () => {}); socket.end('hola') }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const child = utilityProcess.fork(resolve(here, '..', 'utility-probe.mjs'), [], {serviceName: 'FreyaLab M3 control'})
    const answer = new Promise((ok, fail) => { child.once('message', ok); child.once('exit', code => fail(new Error(`el utilityProcess terminó con ${code}`))); setTimeout(() => fail(new Error('sin respuesta del utilityProcess')), 60000) })
    child.once('spawn', () => child.postMessage({install: resolve(install), args: {secret, hosts: process.platform === 'win32' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : '/etc/hosts', port: server.address().port, forbiddenWrite: join(outside, 'escrito-utility.txt')}}))
    const message = await answer; child.kill()
    return message.ok ? {probe: message.results, verdict: verdict(message.results)} : {error: message.error}
  } catch (error) { return {error: String(error.message)} } finally { server.close(); rmSync(outside, {recursive: true, force: true}) }
}
app.whenReady().then(async () => {
  let code = 0, report = {}
  try {
    report = await integration({exe: process.execPath, baseEnv: {ELECTRON_RUN_AS_NODE: '1'}, install: args.install, work: args.work, parent: `Electron ${process.versions.electron} (proceso principal)`, memoryLimitMB: Number(args.limitMb ?? 0)})
    report.runtime = 'electron como Node (ELECTRON_RUN_AS_NODE=1)'; report.packaged = app.isPackaged
    report.utilityProcessControl = await utilityControl(args.install)
    report.electron = {electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome, modules: process.versions.modules}
    if (report.error) code = 1
  } catch (error) { code = 1; report.error = String(error.stack ?? error) }
  writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n')
  console.log('escrito', args.out, report.error ? 'CON ERROR: ' + report.error.split('\n')[0] : '')
  app.exit(code)
})
