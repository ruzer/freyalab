// Validación de F1 (cola de SqlService) sobre la aplicación real: simultaneidad, consultas largas, exportaciones en cola, cancelaciones,
// cierre con trabajos pendientes, paginación y memoria. Opt-in; no forma parte de `npm test` ni de `npm run test:e2e`.
//   npm run build && ./node_modules/.bin/playwright test --config experiments/flexible-workspace/playwright.config.ts f1-validation.spec.ts
// La prueba de tiempo límite (120 s) solo corre con F1_LONG=1.
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import electronPath from 'electron'
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { DocumentInfo, FreyaAPI } from '../../src/shared/types'
declare global { interface Window { freya: FreyaAPI } }

let app: ElectronApplication, page: Page, dir: string
const resultsPath = () => process.env.F1_RESULTS ?? join(tmpdir(), 'f1-validation.json')
// Se guarda al momento: Playwright reinicia el proceso de pruebas tras un fallo y perdería lo acumulado en memoria.
async function record(key: string, value: unknown) { let all: Record<string, unknown> = {}; try { all = JSON.parse(await readFile(resultsPath(), 'utf8')) } catch {} all[key] = value; await writeFile(resultsPath(), JSON.stringify(all, null, 1)) }
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms))
const csv = (rows: number, columns = 3) => Array.from({ length: columns }, (_, c) => c === 0 ? 'Id' : c === 1 ? 'Ciudad' : c === 2 ? 'Valor' : `Campo ${c + 1}`).join(',') + '\n' + Array.from({ length: rows }, (_, r) => Array.from({ length: columns }, (_, c) => c === 0 ? r : c === 1 ? `C${r % 5}` : c === 2 ? r % 97 : (r * c) % 1000).join(',')).join('\n') + '\n'
const small = csv(240), big = csv(100_000), mid = csv(4_000), wide = csv(10_000, 200)
const COUNT = 'SELECT ciudad, count(*) AS n FROM datos GROUP BY 1 ORDER BY 1'
const LONG = 'SELECT count(*) AS n FROM datos a, datos b, datos c' // sobre `mid` (4 000 filas): unos 5 s de cálculo, finita
const FOREVER = 'SELECT count(*) AS n FROM datos a, datos b, datos c' // sobre `big`: no termina antes del tiempo límite

test.beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'freyalab-f1-')); await mkdir(join(dir, 'exports')); await mkdir(join(dir, 'saved'))
  const { ELECTRON_RUN_AS_NODE: _unused, ...env } = process.env
  app = await electron.launch({ chromiumSandbox: true, executablePath: process.env.FREYALAB_EXECUTABLE || electronPath as unknown as string, args: ['--js-flags=--expose-gc', ...process.env.FREYALAB_EXECUTABLE ? [] : [resolve('out/main/index.js')]], env: { ...env as Record<string, string>, FREYALAB_TEST: '1', FREYALAB_USER_DATA: join(dir, 'profile'), FREYALAB_TEST_EXPORT_DIR: join(dir, 'exports'), FREYALAB_TEST_SAVE_DIR: join(dir, 'saved') }, timeout: 60_000 })
  page = await app.firstWindow(); await page.waitForFunction(() => !!window.freya)
  await app.evaluate(({ app }) => { const g = globalThis as any; g.__created = 0; app.on('browser-window-created', () => { g.__created++ }) })
})
test.afterEach(async () => { await app?.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app?.close().catch(() => {}); await rm(dir, { recursive: true, force: true }) })

const open = async (name: string, text: string): Promise<DocumentInfo> => { const path = join(dir, name); await writeFile(path, text); return (await page.evaluate(p => window.freya.openPaths([p]), path))[0] }
type Outcome = { ok: true; rows: number; at: number } | { ok: false; error: string; at: number }
const run = (doc: DocumentInfo, sql = COUNT, requestId = crypto.randomUUID()) => ({ requestId, done: page.evaluate(({ id, revision, requestId, sql }) => window.freya.sqlRun({ requestId, sources: [{ id, revision }], sql }).then(r => ({ ok: true as const, rows: r.returnedRows, at: performance.now() }), e => ({ ok: false as const, error: String(e.message ?? e), at: performance.now() })), { id: doc.id, revision: doc.revision, requestId, sql }) as Promise<Outcome> })
const cancel = (requestId: string) => page.evaluate(id => window.freya.sqlCancel(id), requestId)
const exportOnce = (doc: DocumentInfo) => page.evaluate(doc => window.freya.exportChartResult(doc.id, { requestId: crypto.randomUUID(), revision: doc.revision, format: 'json', protectFormulas: true, configuration: { headers: doc.headers!, options: { kind: 'bar', x: 1, y: -1, bins: 10, aggregate: 'count', descending: false, measureType: 'text' }, where: { conditions: [], filterMode: 'all' } } }).then(() => ({ ok: true as const, at: performance.now() }), e => ({ ok: false as const, error: String(e.message ?? e), at: performance.now() })), doc)
const created = () => app.evaluate(() => (globalThis as any).__created as number)
const windows = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
const heapMiB = () => app.evaluate(async () => { const g = globalThis as any; g.gc?.(); await new Promise(r => setTimeout(r, 60)); g.gc?.(); return Math.round(process.memoryUsage().heapUsed / 104857.6) / 10 })
function watchWindows() { let max = 0, stop = false; const loop = (async () => { while (!stop) { max = Math.max(max, await windows()); await sleep(20) } })(); return { finish: async () => { stop = true; await loop; return max } } }
const messageOf = (outcome: Outcome) => outcome.ok ? 'ok' : outcome.error

test('V1 · consultas simultáneas: todas terminan, en orden y con un solo motor', async () => {
  const doc = await open('grande.csv', big), windows = watchWindows(), n = 6
  const t = Date.now(); const all = Array.from({ length: n }, (_, i) => run(doc, i % 2 ? COUNT : `SELECT count(*) AS n${i} FROM datos`)); const outcomes = await Promise.all(all.map(r => r.done)); const total = Date.now() - t
  const max = await windows.finish()
  expect(outcomes.map(messageOf)).toEqual(Array(n).fill('ok'))
  const finishing = outcomes.map(o => o.at); expect(finishing).toEqual([...finishing].sort((a, b) => a - b)) // mismo nivel de prioridad: orden de llegada
  expect(max).toBeLessThanOrEqual(2); expect(await created()).toBe(n)
  await record('V1', { solicitudes: n, totalMs: total, msPorSolicitud: Math.round(total / n), maxVentanas: max, motoresCreados: n })
})

test('V2 · consulta larga: las demás esperan, se ve «En cola» y cancelarla libera el hueco enseguida', async () => {
  const doc = await open('media.csv', mid)
  await page.evaluate(() => { (window as any).__events = []; window.freya.onEvent(e => { if (e.type === 'analysis') (window as any).__events.push(e.progress) }) })
  const long = run(doc, LONG); await sleep(400)
  const waiting = [run(doc), run(doc, 'SELECT 1 AS uno')]; await sleep(600)
  const settledEarly = await Promise.race([Promise.all(waiting.map(w => w.done)).then(() => 'terminaron'), sleep(1500).then(() => 'esperan')])
  const queuedEvents = await page.evaluate(() => (window as any).__events.filter((e: any) => String(e.phase).startsWith('En cola')).map((e: any) => e.requestId))
  const t = Date.now(); await cancel(long.requestId); const [l, ...rest] = await Promise.all([long.done, ...waiting.map(w => w.done)]); const cancelToNextMs = Date.now() - t
  expect(settledEarly === 'esperan' || l.ok).toBe(true) // si la «larga» fuera demasiado corta en esta máquina, la prueba no demuestra espera y se anota
  expect(l.ok ? 'terminó antes de cancelarse' : messageOf(l)).toContain(l.ok ? 'terminó' : 'Análisis cancelado.')
  expect(rest.every(o => o.ok)).toBe(true)
  expect(queuedEvents.sort()).toEqual(waiting.map(w => w.requestId).sort())
  await expect.poll(windows).toBe(1)
  await record('V2', { esperaronMientrasCorriaLaLarga: settledEarly === 'esperan', avisosEnCola: queuedEvents.length, largaCancelada: !l.ok, msDesdeCancelarHastaTerminarLasSiguientes: cancelToNextMs })
})

test('V3 · inanición: una exportación en cola termina aunque haya consultas interactivas continuas', async () => {
  const doc = await open('datos.csv', small), n = 5
  const order = await page.evaluate(async ({ doc, n }) => {
    const done: string[] = [], sql = (tag: string) => `SELECT '${tag}' AS tag FROM datos LIMIT 1`
    const hold = window.freya.sqlRun({ requestId: crypto.randomUUID(), sources: [{ id: doc.id, revision: doc.revision }], sql: 'SELECT count(*) AS n FROM datos' }).then(() => { done.push('inicial') })
    await new Promise(r => setTimeout(r, 200))
    const exported = window.freya.exportChartResult(doc.id, { requestId: crypto.randomUUID(), revision: doc.revision, format: 'json', protectFormulas: true, configuration: { headers: doc.headers!, options: { kind: 'bar', x: 1, y: -1, bins: 10, aggregate: 'count', descending: false, measureType: 'text' }, where: { conditions: [], filterMode: 'all' } } }).then(() => { done.push('EXPORTACIÓN') })
    // Dos paneles que lanzan una consulta nueva en cuanto termina la suya: siempre hay una interactiva esperando.
    const chain = async (panel: string) => { for (let i = 0; i < n; i++) { await window.freya.sqlRun({ requestId: crypto.randomUUID(), sources: [{ id: doc.id, revision: doc.revision }], sql: sql(`${panel}${i}`) }); done.push(`${panel}${i}`) } }
    await Promise.all([hold, chain('SQL'), chain('GRÁFICO'), exported]); return done
  }, { doc, n })
  const position = order.indexOf('EXPORTACIÓN')
  await record('V3', { trabajos: order.length, posicionDeLaExportacion: position + 1, ultimaPosicion: order.length, orden: order })
  expect(position, `la exportación terminó en el puesto ${position + 1} de ${order.length}: ${order.join(' > ')}`).toBeLessThan(order.length - 1)
  expect(position).toBeLessThanOrEqual(3) // en cola detrás de la inicial: como mucho la adelantan dos interactivas
})

test('V4 · cancelar pendientes y activas: los cancelados no crean motor y el resto avanza en orden', async () => {
  const doc = await open('media.csv', mid)
  const active = run(doc, LONG); await sleep(500)
  const q = [run(doc, 'SELECT 1 AS a'), run(doc, 'SELECT 2 AS b'), run(doc, 'SELECT 3 AS c'), run(doc, 'SELECT 4 AS d')]; await sleep(200)
  await cancel(q[1].requestId); await cancel(q[2].requestId); await cancel(active.requestId)
  const [a, ...queued] = await Promise.all([active.done, ...q.map(r => r.done)])
  expect(messageOf(a)).toContain('Análisis cancelado.')
  expect(queued.map(messageOf).map(m => m.includes('Análisis cancelado.') ? 'cancelada' : m)).toEqual(['ok', 'cancelada', 'cancelada', 'ok'])
  expect(queued[0].at).toBeLessThan(queued[3].at)
  expect(await created()).toBe(3) // la larga y las dos que sí corrieron; las canceladas en cola nunca crearon motor
  await expect.poll(windows).toBe(1)
  await record('V4', { motoresCreados: await created(), canceladasEnCola: 2, canceladaActiva: 1, ventanasAlFinal: await windows() })
})

test('V5 · cierre de la aplicación con trabajos pendientes, una exportación y cancelaciones en carrera', async () => {
  const doc = await open('media.csv', mid), pids = [app.process().pid!]
  const running = run(doc, LONG); await sleep(500)
  const pending = [run(doc), run(doc, 'SELECT 1 AS uno'), run(doc, COUNT)], exported = exportOnce(doc); await sleep(200)
  pids.push(...await app.evaluate(({ app }) => app.getAppMetrics().map(m => m.pid)))
  const settled = Promise.allSettled([running.done, ...pending.map(p => p.done), exported])
  const closed = app.waitForEvent('close', { timeout: 20_000 }); const t = Date.now()
  void app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.isVisible())!.close()).catch(() => {})
  void cancel(running.requestId).catch(() => {}); void cancel(pending[0].requestId).catch(() => {}) // cancelaciones mientras se cierra
  await closed; const exitMs = Date.now() - t; await settled
  const alive = [...new Set(pids)].filter(pid => { try { process.kill(pid, 0); return true } catch { return false } })
  expect(alive, `procesos vivos tras cerrar: ${alive.join(',')}`).toEqual([])
  await record('V5', { salidaMs: exitMs, procesosVivosTrasCerrar: alive.length, trabajosPendientesAlCerrar: pending.length + 2 })
})

test('V6 · resultados paginados íntegros mientras la cola trabaja y errores claros cuando dejan de valer', async () => {
  const doc = await open('grande.csv', big)
  const first = run(doc, 'SELECT * FROM datos ORDER BY CAST(id AS INTEGER) LIMIT 5000'); expect(await first.done).toMatchObject({ ok: true, rows: 5000 })
  const busy = [run(doc, COUNT), run(doc, 'SELECT count(*) AS n FROM datos')] // la cola trabaja mientras se pagina
  const ids: number[] = []
  for (let offset = 0; offset < 5000; offset += 100) { const p = await page.evaluate(({ id, offset }) => window.freya.sqlPage(id, offset), { id: first.requestId, offset }); expect(p.rows).toHaveLength(100); ids.push(...p.rows.map(r => Number(r[0]))) }
  await Promise.all(busy.map(b => b.done))
  expect(ids).toEqual(Array.from({ length: 5000 }, (_, i) => i))
  const message = (id: string) => page.evaluate(id => window.freya.sqlPage(id, 0).then(() => 'disponible', e => String(e.message ?? e)), id)
  const edited = run(doc, 'SELECT * FROM datos LIMIT 10'); await edited.done
  await page.evaluate(id => window.freya.tableEdit(id, { type: 'cell', rowId: '1', column: 1, value: 'cambio' }), doc.id)
  const afterEdit = await message(edited.requestId)
  await cancel(first.requestId); const afterCancel = await message(first.requestId)
  const clean = await open('limpio.csv', small), closing = run(clean, 'SELECT 1 AS uno'); expect(await closing.done).toMatchObject({ ok: true }); await page.evaluate(id => window.freya.close(id), clean.id)
  const afterClose = await message(closing.requestId)
  expect(afterEdit).toContain('cambió'); expect(afterCancel).toContain('ya no está disponible'); expect(afterClose).toContain('ya no está disponible')
  await record('V6', { paginasLeidasConLaColaActiva: 50, idsEnOrden: true, trasEditar: afterEdit, trasCancelar: afterCancel, trasCerrarElDocumento: afterClose })
})

test('V7 · memoria: los resultados retenidos se liberan al cancelar y al cerrar el documento', async () => {
  const doc = await open('ancha.csv', wide)
  const baseline = await heapMiB(); const ids: string[] = []
  for (let i = 0; i < 3; i++) { const r = run(doc, `SELECT * FROM datos WHERE ${i} = ${i}`); ids.push(r.requestId); expect(await r.done).toMatchObject({ ok: true, rows: 10000 }) }
  const retained = await heapMiB()
  for (const id of ids) await cancel(id)
  const afterCancel = await heapMiB()
  // Resultados que nadie cancela (p. ej. tras recargar el renderer) y un documento que se cierra.
  const orphan = run(doc, 'SELECT * FROM datos'); expect(await orphan.done).toMatchObject({ ok: true, rows: 10000 }); const orphanHeld = await heapMiB()
  await page.evaluate(id => window.freya.close(id), doc.id); await sleep(300); const afterClose = await heapMiB()
  await record('V7', { heapBaseMiB: baseline, heapConTresResultadosMiB: retained, heapTrasCancelarMiB: afterCancel, heapConUnResultadoHuerfanoMiB: orphanHeld, heapTrasCerrarElDocumentoMiB: afterClose })
  expect(retained - baseline).toBeGreaterThan(20) // el ensayo mide algo
  expect(afterCancel - baseline, 'cancelar libera lo retenido').toBeLessThan((retained - baseline) * 0.25)
  expect(afterClose - baseline, 'cerrar el documento libera el resultado que nadie canceló').toBeLessThan((orphanHeld - afterCancel) * 0.25 + 5)
})

test('V7b · ciclos de ejecutar y cancelar no acumulan memoria ni procesos', async () => {
  const doc = await open('ancha.csv', wide), heaps: number[] = [], processes: number[] = []
  for (let i = 0; i < 12; i++) { const r = run(doc, 'SELECT * FROM datos'); await r.done; await cancel(r.requestId); heaps.push(await heapMiB()); processes.push(await app.evaluate(({ app }) => app.getAppMetrics().length)) }
  await record('V7b', { heapPorCicloMiB: heaps, procesosPorCiclo: processes })
  expect(Math.max(...processes) - Math.min(...processes)).toBeLessThanOrEqual(1)
  expect(heaps.at(-1)! - heaps[1]).toBeLessThan(15)
  await expect.poll(windows).toBe(1)
})

test('V8 · documento cerrado o editado mientras la solicitud espera o corre', async () => {
  const slow = await open('media.csv', mid), other = await open('otra.csv', small)
  // a) la solicitud espera detrás de una larga y su documento se cierra antes de que le toque
  const long = run(slow, LONG); await sleep(500); const waitingForClosed = run(other); await sleep(200)
  await page.evaluate(id => window.freya.close(id), other.id)
  const next = run(slow, 'SELECT 1 AS uno'); await sleep(100); await cancel(long.requestId)
  const [closedOutcome, nextOutcome] = await Promise.all([waitingForClosed.done, next.done])
  expect(closedOutcome.ok).toBe(false); expect(messageOf(closedOutcome)).toMatch(/ya no está abierto|cambió|Análisis cancelado/); expect(nextOutcome).toMatchObject({ ok: true })
  // b) el documento se edita mientras su solicitud corre
  const running = run(slow, LONG); await sleep(600)
  await page.evaluate(id => window.freya.tableEdit(id, { type: 'cell', rowId: '1', column: 1, value: 'editado' }), slow.id)
  await cancel(running.requestId) // la interfaz cancela al editar; aquí se comprueba que el hueco queda libre de todos modos
  const afterEdit = await run((await page.evaluate(() => window.freya.documents())).find(d => d.name === 'media.csv')!, 'SELECT 1 AS uno').done
  expect(afterEdit).toMatchObject({ ok: true }); await expect.poll(windows).toBe(1)
  await record('V8', { esperandoConDocumentoCerrado: messageOf(closedOutcome), siguienteSolicitud: 'ok', trasEditarElHuecoQuedaLibre: true })
})

test('V9 · tiempo límite de 120 s: la solicitud falla con un mensaje claro y la cola sigue', async () => {
  test.skip(!process.env.F1_LONG, 'Tarda más de dos minutos; ejecutar con F1_LONG=1')
  test.setTimeout(300_000)
  const doc = await open('grande.csv', big), runaway = run(doc, FOREVER); await sleep(300); const next = run(doc, 'SELECT 1 AS uno'); const t = Date.now()
  const [a, b] = await Promise.all([runaway.done, next.done])
  expect(messageOf(a)).toContain('superó dos minutos'); expect(b).toMatchObject({ ok: true }); await expect.poll(windows).toBe(1)
  await record('V9', { msHastaElTiempoLimite: Date.now() - t, siguiente: 'ok' })
})
