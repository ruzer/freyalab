// M3 · Ejecuta un programa dentro de una capa de aislamiento del sistema operativo y devuelve su salida.
//   macOS: sandbox-exec · Linux: bubblewrap · Windows: AppContainer + objeto de trabajo (windows/appcontainer.ps1).
// Se usa con un proceso hijo propio (no con un utilityProcess, que lo crea Chromium).
import {spawnSync} from 'node:child_process'
import {mkdirSync, readFileSync, existsSync, realpathSync} from 'node:fs'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))

export function mechanismName() {
  return process.platform === 'darwin' ? 'sandbox-exec (perfil SBPL, solo escritura en la carpeta de trabajo, sin red)'
    : process.platform === 'linux' ? 'bubblewrap (sistema de archivos de solo lectura salvo la carpeta de trabajo, sin red)'
    : 'AppContainer de Windows sin capacidades + objeto de trabajo (límite de memoria y cierre del árbol)'
}

// opciones: exe, args[], workDir, hideDirs[] (rutas que no debe ver), readDirs[] (Windows: se les concede lectura), env, memoryLimitMB, timeoutMs
export function confinedRun({exe, args, workDir, hideDirs = [], readDirs = [], env = {}, memoryLimitMB = 0, timeoutMs = 120000}) {
  mkdirSync(workDir, {recursive: true})
  if (process.platform === 'darwin') {
    const real = p => (existsSync(p) ? realpathSync(p) : p)
    const work = real(workDir)
    const profile = `(version 1)(allow default)(deny network*)(deny file-read* ${hideDirs.map(d => `(subpath "${real(d)}")`).join(' ')} (literal "/private/etc/hosts"))(deny file-write*)(allow file-write* (subpath "${work}") (literal "/dev/null") (literal "/dev/tty") (literal "/dev/dtracehelper"))`
    const run = spawnSync('sandbox-exec', ['-p', profile, exe, ...args], {encoding: 'utf8', timeout: timeoutMs, env: {...process.env, ...env}})
    return {stdout: run.stdout ?? '', stderr: run.stderr ?? '', status: run.status, timedOut: run.error?.code === 'ETIMEDOUT'}
  }
  if (process.platform === 'linux') {
    const base = ['--ro-bind', '/', '/', '--dev', '/dev', '--proc', '/proc', '--bind', workDir, workDir, ...hideDirs.flatMap(d => ['--tmpfs', d]), '--ro-bind', '/dev/null', '/etc/hosts', '--unshare-net', '--die-with-parent']
    const attempt = (cmd, pre = []) => spawnSync(cmd, [...pre, ...base, exe, ...args], {encoding: 'utf8', timeout: timeoutMs, env: {...process.env, ...env}})
    let run = attempt('bwrap')
    if (run.error || /Operation not permitted|setting up uid map|Permission denied/.test(run.stderr ?? '')) run = attempt('sudo', ['-E', 'bwrap'])
    return {stdout: run.stdout ?? '', stderr: run.stderr ?? '', status: run.status, timedOut: run.error?.code === 'ETIMEDOUT'}
  }
  // Windows
  const resultFile = join(workDir, 'appcontainer-result.json')
  const quote = a => (/[\s"]/.test(a) ? `"${a.replaceAll('"', '\\"')}"` : a)
  const run = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(here, '..', 'windows', 'appcontainer.ps1'), '-Exe', exe, '-Arguments', args.map(quote).join(' '),
    '-WorkDir', workDir, '-ReadDirs', readDirs.join(','), '-MemoryLimitMB', String(memoryLimitMB), '-TimeoutSec', String(Math.round(timeoutMs / 1000)), '-ResultFile', resultFile,
    '-ExtraEnv', Object.entries(env).map(([k, v]) => `${k}=${v}`).join(',')], {encoding: 'utf8', timeout: timeoutMs + 60000})
  const meta = existsSync(resultFile) ? JSON.parse(readFileSync(resultFile, 'utf8').replace(/^\uFEFF/, '')) : {error: 'sin resultado del lanzador', launcherStderr: (run.stderr ?? '').slice(0, 600)}
  const read = name => (existsSync(join(workDir, name)) ? readFileSync(join(workDir, name), 'utf8') : '')
  return {stdout: read('stdout.txt'), stderr: read('stderr.txt'), status: meta.exitCode, timedOut: Boolean(meta.timedOut), launcher: meta, launcherOutput: (run.stdout ?? '').slice(0, 400)}
}
