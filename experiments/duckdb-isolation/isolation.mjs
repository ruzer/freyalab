// M3 · Capa de aislamiento del sistema operativo alrededor del proceso que ejecuta DuckDB, en las cuatro plataformas, con el runtime elegido.
//   node isolation.mjs --install <@duckdb/node-api> --work <carpeta nueva> --out resultados.json [--runtime node|electron] [--exe <ruta>]
// --runtime electron usa el binario de Electron con ELECTRON_RUN_AS_NODE=1 (el mismo ABI que el módulo nativo del producto).
import {mkdirSync, writeFileSync, rmSync, existsSync} from 'node:fs'
import {join, resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'
import net from 'node:net'
import os from 'node:os'
import {confinedRun, mechanismName, electronNodeArgs} from './lib/confine.mjs'
import {makeFixture} from '../duckdb-native/lib/selftest.mjs'
const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const work = resolve(args.work), install = resolve(args.install), runtime = args.runtime ?? 'node'
const outside = join(os.tmpdir(), `m3-fuera-${process.pid}`)
mkdirSync(join(work, 'tmp'), {recursive: true}); mkdirSync(outside, {recursive: true})
const secret = join(outside, 'secreto.txt'); writeFileSync(secret, 'SECRETO\n')
makeFixture(join(work, 'selftest-ventas.csv'), 20000)
const exe = args.exe ?? (runtime === 'electron' ? createRequire(join(process.cwd(), 'package.json'))('electron') : process.execPath)
const baseEnv = runtime === 'electron' ? {ELECTRON_RUN_AS_NODE: '1'} : {}
const server = net.createServer(socket => { socket.on('error', () => {}); socket.end('hola') }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const confinedScript = resolve(here, '../duckdb-native/confined.mjs')
const hostsPath = process.platform === 'win32' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : '/etc/hosts'
const nodeFlags = runtime === 'electron' ? electronNodeArgs() : []
const scriptArgs = (tag, dir) => [confinedScript, '--install', install, '--work', dir, '--secret', secret, '--port', String(port), '--forbiddenWrite', join(outside, `escrito-${tag}.txt`), '--tag', tag]
const parse = text => { const line = (text ?? '').split(/\r?\n/).find(l => l.startsWith('CONFINED_RESULT ')); return line ? JSON.parse(line.slice(16)) : null }

const control = spawnSync(exe, scriptArgs('control', work), {encoding: 'utf8', timeout: 180000, env: {...process.env, ...baseEnv}})
const controlResults = parse(control.stdout)
const confinedWork = join(work, 'confinada'); mkdirSync(join(confinedWork, 'tmp'), {recursive: true})
makeFixture(join(confinedWork, 'selftest-ventas.csv'), 20000)
const readDirs = [runtime === 'electron' ? dirname(exe) : exe, install, resolve(here, '..'), ...(runtime === 'electron' ? [dirname(dirname(exe))] : [])]
const confined = confinedRun({exe, args: [...nodeFlags, ...scriptArgs('confinada', confinedWork)], workDir: confinedWork, hideDirs: [outside], readDirs, env: baseEnv, timeoutMs: 180000})
const confinedResults = parse(confined.stdout)
const wrote = existsSync(join(outside, 'escrito-confinada.txt'))
if (Array.isArray(confinedResults)) for (const r of confinedResults) if (r.name === 'Node escribe fuera de la carpeta de trabajo' && r.outcome === 'escribe' && !wrote) { r.outcome = 'denegado'; r.detail = 'la escritura quedó en un tmpfs efímero; no llegó al disco real' }

// Tope de memoria (solo Windows lo impone desde fuera; en el resto se informa «sin tope»).
const heavyArgs = ['--install', install, '--work', join(work, 'heavy'), '--limit', '2GB', '--rows', '60000000']
const heavyScript = resolve(here, 'heavy.mjs')
const heavyControl = spawnSync(exe, [heavyScript, ...heavyArgs], {encoding: 'utf8', timeout: 300000, env: {...process.env, ...baseEnv}})
const heavyCapped = process.platform === 'win32' ? confinedRun({exe, args: [...nodeFlags, heavyScript, '--install', install, '--work', join(work, 'heavy-cap'), '--limit', '2GB', '--rows', '60000000'], workDir: join(work, 'heavy-cap'), readDirs, env: baseEnv, memoryLimitMB: 1024, timeoutMs: 300000}) : null
const heavyParse = text => { const l = (text ?? '').split(/\r?\n/).find(x => x.startsWith('HEAVY_RESULT ')); return l ? JSON.parse(l.slice(13)) : null }

server.close(); rmSync(outside, {recursive: true, force: true})
const by = (list, name) => list?.find?.(r => r.name === name)?.outcome
const names = ['Node lee el archivo ajeno', 'Node lee /etc/hosts', 'Node abre una conexión TCP a un servidor local', 'Node escribe fuera de la carpeta de trabajo', 'DuckDB sin restricciones lee el archivo ajeno']
const allowedWords = ['lee', 'conecta', 'escribe']
const verdict = Array.isArray(confinedResults) && Array.isArray(controlResults) ? {
  worksInside: by(confinedResults, 'la operación cerrada funciona dentro de la capa') === 'funciona',
  controlCanDo: names.filter(n => allowedWords.includes(by(controlResults, n))),
  confinedDenied: names.filter(n => !allowedWords.includes(by(confinedResults, n))),
  confinedStillAllowed: names.filter(n => allowedWords.includes(by(confinedResults, n)))} : null
const report = {kind: 'M3 capa de aislamiento del sistema operativo', platform: `${process.platform} ${process.arch}`, runtime, exe: runtime === 'electron' ? 'binario de Electron con ELECTRON_RUN_AS_NODE=1' : 'node', node: process.version,
  mechanism: mechanismName(), hostsPath, control: controlResults ?? {error: (control.stderr ?? '').slice(0, 400), status: control.status}, confined: confinedResults ?? {error: (confined.stderr ?? '').slice(0, 600), stdout: (confined.stdout ?? '').slice(0, 300), launcher: confined.launcher, launcherOutput: confined.launcherOutput, status: confined.status},
  verdict, memoryCap: {control: heavyParse(heavyControl.stdout), capped1GiB: heavyCapped ? {result: heavyParse(heavyCapped.stdout), exitCode: heavyCapped.status, timedOut: heavyCapped.timedOut, stderr: (heavyCapped.stderr ?? '').slice(0, 300), launcher: heavyCapped.launcher} : 'no se impone desde fuera en esta plataforma'}}
writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({mechanism: report.mechanism, runtime, verdict, memoryCap: report.memoryCap}, null, 1))
