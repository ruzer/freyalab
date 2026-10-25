// M3 · Integración: el proceso principal (Node o Electron) lanza el motor DuckDB en un proceso hijo DENTRO de la capa del sistema operativo y le pide las
// operaciones cerradas de M2 por un protocolo de líneas JSON. Mide: arranque en frío, sobrecoste de la capa, qué puede hacer el proceso fuera de su
// carpeta, qué ocurre al matarlo y cómo evoluciona su memoria si se reutiliza (política de reciclaje).
import {mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync} from 'node:fs'
import {join, resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import net from 'node:net'
import os from 'node:os'
import {spawnConfined, mechanismName, bwrapAccess} from './confine.mjs'
import {ConfinedHost, spawnPlain} from './confined-host.mjs'
import {probe as probeHere, verdict} from './probes.mjs'
import {settings, runModes} from '../../duckdb-native/lib/modes.mjs'
import {makeFixture} from '../../duckdb-native/lib/selftest.mjs'
import {HEADER} from '../../duckdb-native/lib/battery.mjs'
const here = dirname(fileURLToPath(import.meta.url))
const worker = resolve(here, '..', 'confined-worker.mjs')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const hostsPath = process.platform === 'win32' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : '/etc/hosts'
const round = n => Math.round(n * 10) / 10

export async function integration({exe, execArgs = [], baseEnv = {}, install, work, parent, recycleOps = 40, recycleFactor = 1.5, memoryLimitMB = 0}) {
  const report = {kind: 'M3 integración con proceso confinado', parent, platform: `${os.platform()} ${os.arch()}`, mechanism: mechanismName(), exe, started: new Date().toISOString()}
  if (process.platform === 'linux') report.bubblewrap = bwrapAccess()
  const outside = join(os.tmpdir(), `m3-int-fuera-${process.pid}`); mkdirSync(outside, {recursive: true})
  const secret = join(outside, 'secreto.txt'); writeFileSync(secret, 'SECRETO\n')
  const server = net.createServer(socket => { socket.on('error', () => {}); socket.end('hola') }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const confinedWork = resolve(work, 'confinada'), plainWork = resolve(work, 'sin-capa')
  for (const dir of [confinedWork, plainWork]) mkdirSync(join(dir, 'tmp'), {recursive: true})
  const experiments = resolve(here, '..', '..')
  const readDirs = [dirname(exe), install, experiments]
  const heartbeat = join(confinedWork, 'heartbeat.txt')
  const spawnLayer = () => spawnConfined({exe, args: [...execArgs, worker], workDir: confinedWork, hideDirs: [outside], readDirs, env: {...baseEnv, M3_HEARTBEAT: heartbeat}, memoryLimitMB, timeoutMs: 3600000})
  const confinedHost = () => new ConfinedHost(spawnLayer, 'proceso hijo confinado')
  const threads = '2', memory = '512MB'
  const s = settings({work: confinedWork, install, modes: 'selftest', threads, memory})
  const probeArgs = {secret, hosts: hostsPath, port, forbiddenWrite: join(outside, 'escrito.txt')}
  try {
    // 1 · Arranque en frío y sondeo, con y sin capa (runModes arranca el anfitrión por su cuenta: cada fase usa uno nuevo para no dejar procesos huérfanos).
    const plainEnv = {...baseEnv, M3_HEARTBEAT: join(plainWork, 'heartbeat.txt')}
    const plainHost = () => new ConfinedHost(() => spawnPlain({exe, args: [worker], env: plainEnv}), 'proceso hijo sin capa')
    const plainSettings = settings({work: plainWork, install, modes: 'selftest', threads, memory})
    report.coldStart = {}; report.control = {}
    let probeHost = plainHost(); let t0 = performance.now(); await probeHost.start(resolve(install), plainSettings.options); report.coldStart.sinCapaMs = round(performance.now() - t0)
    report.control.probe = (await probeHost.send('probe', {install: resolve(install), args: {...probeArgs, forbiddenWrite: join(outside, 'escrito-control.txt')}})).results; report.control.verdict = verdict(report.control.probe); await probeHost.stop()
    const plain = plainHost(); const ts = performance.now(); report.control.selftest = (await runModes(plain, plainSettings, 'sin-capa')).selftest; report.control.selftestMs = round(performance.now() - ts); await plain.stop()

    probeHost = confinedHost(); t0 = performance.now()
    await probeHost.start(resolve(install), s.options).catch(error => { report.startError = {message: error.message, stderr: probeHost.child?.stderr, launcher: probeHost.child?.launcherResult?.()}; throw error })
    report.coldStart.conCapaMs = round(performance.now() - t0)
    report.confined = {probe: (await probeHost.send('probe', {install: resolve(install), args: probeArgs})).results}
    // Linux: bubblewrap monta un tmpfs sobre la carpeta ajena, así que una escritura «con éxito» no llega al disco real.
    for (const r of report.confined.probe) if (r.name === 'Node escribe fuera de la carpeta de trabajo' && r.outcome === 'escribe' && !existsSync(probeArgs.forbiddenWrite)) { r.outcome = 'denegado'; r.detail = 'la escritura quedó en un tmpfs efímero; no llegó al disco real' }
    report.confined.verdict = verdict(report.confined.probe)
    const launcherFirst = probeHost.child?.launcherResult?.(); await probeHost.stop()
    const host = confinedHost()
    const cs = performance.now(); const modes = await runModes(host, s, 'confinado'); report.confined.selftest = modes.selftest; report.versions = modes.versions; report.confined.selftestMs = round(performance.now() - cs)
    // La batería de seguridad de M2 abre un servidor HTTP local para ver si DuckDB lo alcanza; dentro de la capa abrir un socket ya es imposible (EPERM): no es aplicable.
    for (const c of report.confined.selftest.checks) if (!c.ok && c.name.startsWith('aislamiento') && /terminó/.test(c.error ?? '')) c.skipped = 'no aplicable dentro de la capa: la batería abre un servidor local y la capa impide abrir sockets'
    report.confined.selftest.allOkExceptSkipped = report.confined.selftest.checks.every(c => c.ok || c.skipped)
    // La comparación justa excluye la batería de seguridad (en la capa se omite) y suma el tiempo de cada comprobación.
    const spent = list => round(list.checks.filter(c => !c.name.startsWith('aislamiento')).reduce((n, c) => n + c.ms, 0))
    report.overhead = {selftestSinCapaMs: spent(report.control.selftest), selftestConCapaMs: spent(report.confined.selftest), nota: 'suma de las comprobaciones de la autocomprobación, sin la batería de seguridad'}
    if (launcherFirst) report.windowsLauncher = launcherFirst

    // 2 · Reutilizar el proceso: memoria tras cada operación y política de reciclaje (se reinicia si el RSS supera `recycleFactor` veces el de la línea base).
    const source = {path: join(confinedWork, 'selftest-ventas.csv'), columns: HEADER, delimiter: ',', encoding: 'utf-8'}
    const base = (await host.info()).rss
    const series = []; let recycles = 0, restartMs = []
    let current = host, baseline = base
    for (let i = 1; i <= recycleOps; i++) {
      const started = performance.now()
      const output = join(confinedWork, `reciclaje-${i}.csv`) // el motor nunca sobrescribe una salida
      await current.call('filter_extract', {source, conditions: [{col: 4, op: 'eq', value: 'Oaxaca'}], columns: [0, 4], output}); rmSync(output, {force: true})
      const ms = performance.now() - started, info = await current.info()
      series.push({op: i, ms: round(ms), rssMB: round(info.rss / 1048576)})
      if (info.rss > baseline * recycleFactor) {
        const r0 = performance.now(); await current.stop(); const next = confinedHost(); await next.start(resolve(install), s.options); restartMs.push(round(performance.now() - r0)); recycles++
        current = next; baseline = (await current.info()).rss
      }
    }
    report.recycle = {ops: recycleOps, baselineRssMB: round(base / 1048576), factor: recycleFactor, series, recycles, restartMs, finalRssMB: series.at(-1).rssMB, maxRssMB: Math.max(...series.map(x => x.rssMB)), medianOpMs: series.map(x => x.ms).sort((a, b) => a - b)[Math.floor(series.length / 2)]}
    // Una operación pesada hincha el proceso y DuckDB no devuelve esa memoria al sistema: se mide y se aplica la política (reiniciar tras la operación).
    const bigPath = join(confinedWork, 'pesado.csv'); makeFixture(bigPath, 450000)
    const heavySource = {path: bigPath, columns: HEADER, delimiter: ',', encoding: 'utf-8'}
    const before = (await current.info()).rss
    const heavy = await current.call('sort_to_file', {source: heavySource, keys: [{col: 6}], output: join(confinedWork, 'pesado-orden.csv')}, {memoryLimit: '2GB'})
    const after = (await current.info()).rss
    const h0 = performance.now(); await current.stop(); const fresh = confinedHost(); await fresh.start(resolve(install), s.options); const heavyRestartMs = performance.now() - h0
    report.recycle.heavy = {fileMB: round(statSync(bigPath).size / 1048576), opMs: round(heavy.ms), rssBeforeMB: round(before / 1048576), rssPeakSampledMB: round(heavy.rssPeakBytes / 1048576), rssAfterMB: round(after / 1048576), restartMs: round(heavyRestartMs), rssAfterRestartMB: round((await fresh.info()).rss / 1048576)}
    rmSync(join(confinedWork, 'pesado-orden.csv'), {force: true})
    await fresh.stop()

    // 3 · Matar el proceso a mitad de una operación: el árbol debe desaparecer (el latido en disco deja de actualizarse) y el anfitrión puede arrancar otro.
    const big = join(confinedWork, 'matar.csv'); makeFixture(big, 150000)
    const victim = confinedHost(); await victim.start(resolve(install), s.options)
    await sleep(300); const alive = existsSync(heartbeat) ? Number(readFileSync(heartbeat, 'utf8')) : 0
    const inFlight = victim.request('call', {operation: 'filter_extract', args: {source: {path: big, columns: HEADER, delimiter: ',', encoding: 'utf-8'}, conditions: [{col: 4, op: 'eq', value: 'Oaxaca'}], columns: [0, 4], output: join(confinedWork, 'matar-salida.csv')}})
    inFlight.promise.catch(() => {})
    await sleep(40); const k0 = performance.now(); const exitedIn = await victim.kill(); const killMs = performance.now() - k0
    const lastBeat = existsSync(heartbeat) ? Number(readFileSync(heartbeat, 'utf8')) : 0
    await sleep(1500); const afterBeat = existsSync(heartbeat) ? Number(readFileSync(heartbeat, 'utf8')) : 0
    const again = confinedHost(); const a0 = performance.now(); await again.start(resolve(install), s.options); const restartMsKilled = performance.now() - a0
    const check = await again.call('count', {source: {path: join(confinedWork, 'selftest-ventas.csv'), columns: HEADER, delimiter: ',', encoding: 'utf-8'}}); await again.stop()
    report.kill = {heartbeat: {aliveAt: alive, lastBeat, afterBeat, now: Date.now()}, killMs: round(killMs), hostSawExitMs: round(exitedIn), heartbeatStoppedAfterKill: afterBeat > 0 && Date.now() - afterBeat >= 1200, replacementStartMs: round(restartMsKilled), replacementCount: Number(check.value.rows[0].n),
      outputLeft: existsSync(join(confinedWork, 'matar-salida.csv')) ? statSync(join(confinedWork, 'matar-salida.csv')).size : 0}
  } catch (error) {
    report.error = String(error.stack ?? error)
  } finally {
    server.close(); rmSync(outside, {recursive: true, force: true})
  }
  return report
}
export {probeHere}
