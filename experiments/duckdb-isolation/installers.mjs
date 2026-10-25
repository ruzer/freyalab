// M3 · La mini-aplicación (Electron + DuckDB nativo + hijo confinado) en los FORMATOS DE INSTALADOR del producto, instalada como lo hace scripts/package-smoke.mjs:
//   macOS: DMG montado y copiado · Windows: NSIS silencioso en una carpeta temporal y desinstalación · Linux: AppImage extraída y DEB con apt (solo en la CI).
// En cada uno se ejecuta la aplicación INSTALADA (autocomprobación con hijo confinado). Sin firma comercial ni notarización: esos pasos siguen pendientes.
//   node installers.mjs --app <mini-aplicación preparada por ci/stage-app.mjs> --work <carpeta nueva> --out resultados.json
import {readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync, cpSync} from 'node:fs'
import {join, resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const app = resolve(args.app), work = resolve(args.work)
mkdirSync(work, {recursive: true})
const run = (cmd, argv, options = {}) => { const r = spawnSync(cmd, argv, {encoding: 'utf8', timeout: 900000, ...options}); return {status: r.status, out: ((r.stdout ?? '') + (r.stderr ?? '')).trim()} }
const sudo = (...argv) => run('sudo', argv)
const report = {kind: 'M3 instaladores de la mini-aplicación', platform: `${process.platform} ${process.arch}`, formatos: []}

// 1. Construir los instaladores con electron-builder (mismos destinos que el producto).
const base = JSON.parse(readFileSync(join(app, 'electron-builder.json'), 'utf8'))
base.directories = {output: 'release-installers'}
if (process.platform === 'darwin') base.mac = {target: ['dmg'], identity: null}
else if (process.platform === 'win32') base.win = {target: ['nsis']}
else base.linux = {target: ['AppImage', 'deb'], category: 'Utility', maintainer: 'experimento M3 <m3@example.invalid>'}
writeFileSync(join(app, 'electron-builder-installers.json'), JSON.stringify(base, null, 2))
const t0 = performance.now()
const build = run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['electron-builder', '--projectDir', app, '--config', join(app, 'electron-builder-installers.json'), '--publish', 'never'], {shell: process.platform === 'win32'})
report.construccion = {segundos: Math.round((performance.now() - t0) / 1000), salida: build.status, cola: build.status === 0 ? undefined : build.out.split('\n').slice(-8).join(' | ').slice(0, 600)}
const release = join(app, 'release-installers')
const files = existsSync(release) ? readdirSync(release) : []

// 2. Ejecutar la autocomprobación sobre la aplicación instalada.
function selftest(label, exe) {
  const out = join(work, `integracion-${label}.json`)
  const script = [join(here, 'ci', 'run-electron.mjs'), '--exe', exe, '--install', 'app', '--work', join(work, `trabajo-${label}`), '--out', out]
  const [cmd, argv] = process.platform === 'linux' ? ['xvfb-run', ['-a', process.execPath, ...script]] : [process.execPath, script]
  const r = spawnSync(cmd, argv, {encoding: 'utf8', timeout: 180000})
  if (!existsSync(out)) return {carga: false, error: ((r.stderr ?? '') + (r.stdout ?? '')).split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 400) || 'sin resultado'}
  const d = JSON.parse(readFileSync(out, 'utf8'))
  return {carga: Boolean(d.versions?.duckdb), duckdb: d.versions?.duckdb, hijoConfinado: d.confined?.verdict ? `${d.confined.verdict.denied.length} denegados/${d.confined.verdict.allowed.length} permitidos` : null, autocomprobacion: d.confined?.selftest ? `${d.confined.selftest.checks.filter(c => c.ok).length}/${d.confined.selftest.checks.length}` : null, error: d.error ? String(d.error).split('\n')[0].slice(0, 200) : d.startError?.message ?? null}
}
const entry = (formato, extra) => { const f = files.find(n => n.endsWith(formato)); return {formato, archivo: f, bytes: f ? statSync(join(release, f)).size : null, ...extra} }

try {
  if (process.platform === 'darwin') {
    const dmg = files.find(n => n.endsWith('.dmg')), e = entry('.dmg', {})
    if (!dmg) e.error = 'no se generó el DMG'
    else {
      const mount = join(work, 'montaje'); mkdirSync(mount, {recursive: true})
      const attach = run('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, join(release, dmg)])
      if (attach.status !== 0) e.error = 'no se pudo montar: ' + attach.out.slice(-200)
      else {
        let install
        try { const name = readdirSync(mount).find(n => n.endsWith('.app')); install = join(work, 'instalada', name); mkdirSync(dirname(install), {recursive: true}); run('cp', ['-R', join(mount, name), install]) } finally { run('hdiutil', ['detach', mount]) }
        e.instalacion = 'DMG montado, aplicación copiada con enlaces simbólicos y DMG desmontado'
        e.ejecucion = selftest('dmg', join(install, 'Contents', 'MacOS', 'M3DuckDB'))
      }
    }
    report.formatos.push(e)
  } else if (process.platform === 'win32') {
    const setup = files.find(n => n.endsWith('.exe') && !/uninstall/i.test(n)), e = entry('.exe', {})
    if (!setup) e.error = 'no se generó el instalador NSIS'
    else {
      const install = join(work, 'instalada')
      const inst = run(join(release, setup), ['/S', `/D=${install}`])
      const exe = join(install, 'M3DuckDB.exe')
      if (!existsSync(exe)) e.error = 'la instalación silenciosa no dejó el ejecutable: ' + inst.out.slice(-200)
      else {
        e.instalacion = 'NSIS silencioso en carpeta temporal'
        e.ejecucion = selftest('nsis', exe)
        const uninstall = readdirSync(install).find(n => /^uninstall.*\.exe$/i.test(n))
        if (uninstall) { const u = run(join(install, uninstall), ['/S']); e.desinstalacion = u.status === 0 ? 'correcta' : `salida ${u.status}` } else e.desinstalacion = 'sin desinstalador'
      }
    }
    report.formatos.push(e)
  } else {
    const image = files.find(n => n.endsWith('.AppImage')), deb = files.find(n => n.endsWith('.deb'))
    const a = entry('.AppImage', {})
    if (!image) a.error = 'no se generó la AppImage'
    else {
      run(join(release, image), ['--appimage-extract'], {cwd: work}) // el producto la extrae igual: la CI no tiene FUSE
      const extracted = join(work, 'squashfs-root')
      if (process.env.CI === 'true') { sudo('chown', 'root:root', join(extracted, 'chrome-sandbox')); sudo('chmod', '4755', join(extracted, 'chrome-sandbox')) }
      a.instalacion = 'AppImage extraída'; a.ejecucion = selftest('appimage', join(extracted, 'm3duckdb'))
    }
    report.formatos.push(a)
    const d = entry('.deb', {})
    if (!deb) d.error = 'no se generó el DEB'
    else if (process.env.CI !== 'true') d.error = 'la instalación del DEB solo se prueba en ejecutores desechables (CI)'
    else {
      const inst = sudo('apt-get', 'install', '-y', join(release, deb))
      if (inst.status !== 0) d.error = 'apt-get install: ' + inst.out.slice(-200)
      else {
        d.instalacion = 'apt-get install'
        const dir = ['/opt/M3DuckDB', '/opt/m3duckdb'].find(existsSync)
        d.ejecucion = dir ? selftest('deb', join(dir, 'm3duckdb')) : {carga: false, error: 'no se encontró /opt/M3DuckDB'}
        d.desinstalacion = sudo('apt-get', 'remove', '-y', 'freyalab-m3-duckdb').status === 0 ? 'correcta' : 'falló'
      }
    }
    report.formatos.push(d)
  }
} catch (error) { report.error = String(error.stack ?? error).slice(0, 400) }
writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report.formatos.map(f => ({formato: f.formato, MiB: f.bytes ? Math.round(f.bytes / 1048576) : null, instalacion: f.instalacion, ejecucion: f.ejecucion, error: f.error})), null, 1), report.construccion)
