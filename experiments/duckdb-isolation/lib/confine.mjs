// M3 · Ejecuta un programa dentro de una capa de aislamiento del sistema operativo.
//   macOS: sandbox-exec · Linux: bubblewrap · Windows: AppContainer + objeto de trabajo (windows/appcontainer.ps1).
// Se usa con un proceso hijo propio (no con un utilityProcess, que lo crea Chromium y no se puede envolver).
//   confinedRun   → ejecuta y espera (una operación = un proceso).
//   spawnConfined → proceso persistente con protocolo por líneas JSON en stdin/stdout (en Windows, el lanzador reenvía las tuberías: -Relay).
import {spawn, spawnSync} from 'node:child_process'
import {mkdirSync, readFileSync, existsSync, realpathSync} from 'node:fs'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))

// Electron en modo Node dentro de un AppContainer de Windows aborta («Unable to open nul device needed for initialization»): hay que arrancarlo con --no-stdio-init.
export const electronNodeArgs = () => (process.platform === 'win32' ? ['--no-stdio-init'] : [])

export function mechanismName() {
  return process.platform === 'darwin' ? 'sandbox-exec (perfil SBPL, solo escritura en la carpeta de trabajo, sin red)'
    : process.platform === 'linux' ? 'bubblewrap (sistema de archivos de solo lectura salvo la carpeta de trabajo, sin red)'
    : 'AppContainer de Windows sin capacidades + objeto de trabajo (límite de memoria y cierre del árbol)'
}

// Ubuntu 24.04 restringe los espacios de nombres de usuario sin privilegios (AppArmor): bwrap falla salvo que se relaje (sysctl) o se use sudo.
let bwrapMode
export function bwrapAccess() {
  if (bwrapMode) return bwrapMode
  const probe = cmd => spawnSync(cmd[0], [...cmd.slice(1), '--ro-bind', '/', '/', '--unshare-net', 'true'], {encoding: 'utf8'})
  const plain = probe(['bwrap'])
  if (!plain.error && plain.status === 0) return (bwrapMode = {sudo: false, unprivileged: true})
  const root = probe(['sudo', '-n', 'bwrap'])
  return (bwrapMode = {sudo: !root.error && root.status === 0, unprivileged: false, detail: (plain.stderr ?? '').split('\n')[0].slice(0, 160)})
}

// Orden completa (programa + argumentos) para ejecutar `exe args` dentro de la capa.
// opciones: exe, args[], workDir, hideDirs[] (rutas que no debe ver), readDirs[] (Windows: se les concede lectura), env, memoryLimitMB, timeoutMs
export function confinedCommand({exe, args, workDir, hideDirs = [], readDirs = [], env = {}, memoryLimitMB = 0, timeoutMs = 120000}, {relay = false} = {}) {
  mkdirSync(workDir, {recursive: true})
  if (process.platform === 'darwin') {
    const real = p => (existsSync(p) ? realpathSync(p) : p)
    const work = real(workDir)
    const profile = `(version 1)(allow default)(deny network*)(deny file-read* ${hideDirs.map(d => `(subpath "${real(d)}")`).join(' ')} (literal "/private/etc/hosts"))(deny file-write*)(allow file-write* (subpath "${work}") (literal "/dev/null") (literal "/dev/tty") (literal "/dev/dtracehelper"))`
    return {cmd: 'sandbox-exec', args: ['-p', profile, exe, ...args]}
  }
  if (process.platform === 'linux') {
    const base = ['--ro-bind', '/', '/', '--dev', '/dev', '--proc', '/proc', '--bind', workDir, workDir, ...hideDirs.flatMap(d => ['--tmpfs', d]), '--ro-bind', '/dev/null', '/etc/hosts', '--unshare-net', '--die-with-parent', exe, ...args]
    const access = bwrapAccess()
    return access.unprivileged || !access.sudo ? {cmd: 'bwrap', args: base} : {cmd: 'sudo', args: ['-n', '-E', 'bwrap', ...base]}
  }
  const resultFile = join(workDir, 'appcontainer-result.json')
  const quote = a => (/[\s"]/.test(a) ? `"${a.replaceAll('"', '\\"')}"` : a)
  return {cmd: 'powershell', resultFile, args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(here, '..', 'windows', 'appcontainer.ps1').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1'), '-Exe', exe, '-Arguments', args.map(quote).join(' '),
    '-WorkDir', workDir, '-ReadDirs', readDirs.join(','), '-MemoryLimitMB', String(memoryLimitMB), '-TimeoutSec', String(Math.round(timeoutMs / 1000)), '-ResultFile', resultFile,
    '-ExtraEnv', Object.entries(env).map(([k, v]) => `${k}=${v}`).join(','), ...(relay ? ['-Relay'] : [])]}
}

export function confinedRun(options) {
  const {workDir, env = {}, timeoutMs = 120000} = options
  const {cmd, args, resultFile} = confinedCommand(options)
  const run = spawnSync(cmd, args, {encoding: 'utf8', timeout: timeoutMs + (resultFile ? 60000 : 0), env: {...process.env, ...(resultFile ? {} : env)}})
  if (!resultFile) return {stdout: run.stdout ?? '', stderr: run.stderr ?? '', status: run.status, timedOut: run.error?.code === 'ETIMEDOUT'}
  const meta = existsSync(resultFile) ? JSON.parse(readFileSync(resultFile, 'utf8').replace(/^﻿/, '')) : {error: 'sin resultado del lanzador', launcherStderr: (run.stderr ?? '').slice(0, 600)}
  const read = name => (existsSync(join(workDir, name)) ? readFileSync(join(workDir, name), 'utf8') : '')
  return {stdout: read('stdout.txt'), stderr: read('stderr.txt'), status: meta.exitCode, timedOut: Boolean(meta.timedOut), launcher: meta, launcherOutput: (run.stdout ?? '').slice(0, 400)}
}

// Proceso persistente. Devuelve la interfaz que espera lib/host.mjs de M2: {pid, post, onMessage, onExit, kill} más stderr y, en Windows, el resultado del lanzador.
// En macOS/Linux `env` viaja en el entorno del hijo; en Windows lo aplica el lanzador al proceso confinado.
export function spawnConfined(options) {
  const {env = {}} = options
  const {cmd, args, resultFile} = confinedCommand(options, {relay: true})
  const child = spawn(cmd, args, {stdio: ['pipe', 'pipe', 'pipe'], env: {...process.env, ...(resultFile ? {} : env)}})
  let buffer = '', stderr = ''
  const listeners = []
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    buffer += chunk
    let i
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1)
      if (!line.startsWith('{')) continue
      let message; try { message = JSON.parse(line) } catch { continue }
      for (const fn of listeners) fn(message)
    }
  })
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000) })
  child.stdin.on('error', () => {}) // el hijo puede morir con mensajes en vuelo
  return {
    pid: child.pid, child, command: cmd,
    post: message => child.stdin.write(JSON.stringify(message) + '\n'),
    onMessage: fn => listeners.push(fn),
    onExit: fn => child.on('close', code => fn(code)),
    kill: () => child.kill('SIGKILL'),
    get stderr() { return stderr },
    launcherResult: () => (resultFile && existsSync(resultFile) ? JSON.parse(readFileSync(resultFile, 'utf8').replace(/^﻿/, '')) : null)
  }
}
