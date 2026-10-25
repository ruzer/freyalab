// M2 · Capa de aislamiento del sistema operativo alrededor del proceso que ejecuta DuckDB.
//   node os-layer.mjs --install <@duckdb/node-api> --work <carpeta nueva> --out resultados.json
// macOS: sandbox-exec (obsoleto pero presente). Linux: bubblewrap (con sudo si hace falta). Windows: sin mecanismo probado → «pendiente».
// Compara una ejecución de CONTROL (sin capa) con una CONFINADA: el control debe poder leer, escribir y conectar; la confinada no.
import {spawnSync} from 'node:child_process'
import {mkdirSync, writeFileSync, rmSync, realpathSync} from 'node:fs'
import {join, resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import net from 'node:net'
import os from 'node:os'
import {makeFixture} from './lib/selftest.mjs'
const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const work = resolve(args.work), install = resolve(args.install), outside = join(os.tmpdir(), `m2-fuera-${process.pid}`)
mkdirSync(join(work, 'tmp'), {recursive: true}); mkdirSync(outside, {recursive: true})
const secret = join(outside, 'secreto.txt'), forbiddenWrite = join(outside, 'escrito-fuera.txt')
writeFileSync(secret, 'SECRETO\n')
makeFixture(join(work, 'selftest-ventas.csv'), 20000)
const server = net.createServer(socket => socket.end('hola')); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port, node = process.execPath
const confinedArgs = tag => [join(here, 'confined.mjs'), '--install', install, '--work', work, '--secret', secret, '--port', String(port), '--forbiddenWrite', forbiddenWrite + '.' + tag, '--tag', tag]
const parse = run => { const line = (run.stdout ?? '').split('\n').find(l => l.startsWith('CONFINED_RESULT ')); return line ? JSON.parse(line.slice(16)) : {error: ((run.stderr ?? '') + (run.error?.message ?? '')).slice(0, 400), status: run.status} }
const control = parse(spawnSync(node, confinedArgs('control'), {encoding: 'utf8', timeout: 120000}))
let mechanism = null, confined = null, note = ''
if (process.platform === 'darwin') {
  mechanism = 'sandbox-exec (perfil SBPL)'
  const real = realpathSync(outside) // SBPL compara rutas reales: /var/folders es un enlace a /private/var/folders (el mismo tropiezo que /etc → /private/etc en el RFC)
  const profile = `(version 1)(allow default)(deny network*)(deny file-read* (subpath "${real}") (literal "/private/etc/hosts"))(deny file-write* (subpath "${real}"))`
  confined = parse(spawnSync('sandbox-exec', ['-p', profile, node, ...confinedArgs('confinada')], {encoding: 'utf8', timeout: 120000}))
} else if (process.platform === 'linux') {
  mechanism = 'bubblewrap (--ro-bind / /, --unshare-net, tmpfs sobre la carpeta ajena, /dev/null sobre /etc/hosts)'
  const base = ['--ro-bind', '/', '/', '--dev', '/dev', '--proc', '/proc', '--bind', work, work, '--tmpfs', outside, '--ro-bind', '/dev/null', '/etc/hosts', '--unshare-net', '--die-with-parent']
  let run = spawnSync('bwrap', [...base, node, ...confinedArgs('confinada')], {encoding: 'utf8', timeout: 120000})
  if (!parse(run).length) run = spawnSync('sudo', ['-E', 'bwrap', ...base, node, ...confinedArgs('confinada')], {encoding: 'utf8', timeout: 120000})
  confined = parse(run)
} else { note = 'Sin mecanismo de aislamiento del sistema operativo probado en esta plataforma: pendiente (AppContainer/token restringido + objeto de trabajo).' }
// Una escritura «permitida» dentro de un tmpfs que la capa montó sobre la carpeta ajena (Linux) no llega al disco real: se comprueba desde fuera.
const reached = (await import('node:fs')).existsSync(forbiddenWrite + '.confinada')
if (Array.isArray(confined)) for (const r of confined) if (r.name === 'Node escribe fuera de la carpeta de trabajo' && r.outcome === 'escribe' && !reached) { r.outcome = 'denegado'; r.detail = 'la escritura quedó en un tmpfs efímero de la capa; no llegó al disco real' }
server.close(); rmSync(outside, {recursive: true, force: true})
const by = (list, name) => list?.find?.(r => r.name === name)?.outcome
const names = ['Node lee el archivo ajeno', 'Node lee /etc/hosts', 'Node abre una conexión TCP a un servidor local', 'Node escribe fuera de la carpeta de trabajo', 'DuckDB sin restricciones lee el archivo ajeno']
const verdict = confined && Array.isArray(confined) ? {
  worksInside: by(confined, 'la operación cerrada funciona dentro de la capa') === 'funciona',
  controlCanDoEverything: names.every(n => ['lee', 'conecta', 'escribe'].includes(by(control, n))),
  confinedDenied: names.filter(n => !['lee', 'conecta', 'escribe'].includes(by(confined, n))),
  confinedStillAllowed: names.filter(n => ['lee', 'conecta', 'escribe'].includes(by(confined, n)))} : null
const report = {kind: 'M2 capa de aislamiento del sistema operativo', platform: `${process.platform} ${process.arch}`, node: process.version, mechanism, note, control, confined, verdict}
writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(verdict ?? {note}, null, 1))
