// Spike aislado del espacio de trabajo flexible. No se importa desde src/ ni se ejecuta con `npm test`.
//   npx playwright test --config experiments/flexible-workspace/playwright.config.ts spike.spec.ts
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import electronPath from 'electron'
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

test.describe.configure({ mode: 'serial' })
const SPIKE = resolve('experiments/flexible-workspace/spike')
const results: Record<string, unknown> = {}
const load = (name: string): Promise<any> => import(join(SPIKE, name))
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms))
type Ctx = { app: ElectronApplication; shell: Page; dir: string; ventas: string; clientes: string }

async function boot(): Promise<Ctx> {
  const dir = await mkdtemp(join(tmpdir(), 'freyalab-spike-'))
  const { ELECTRON_RUN_AS_NODE: _, ...env } = process.env
  const app = await electron.launch({ executablePath: electronPath as unknown as string, args: [join(SPIKE, 'main.mjs'), `--user-data-dir=${dir}`], env: { ...(env as Record<string, string>), SPIKE_USER_DATA: dir }, timeout: 60_000 })
  const shell = await app.firstWindow()
  await shell.waitForFunction(() => !!(window as any).shell)
  const docs = (await shell.evaluate(() => (window as any).shell.state())).docs as { id: string; name: string }[]
  return { app, shell, dir, ventas: docs.find(d => d.name === 'ventas.csv')!.id, clientes: docs.find(d => d.name === 'clientes.csv')!.id }
}
const shut = async (ctx: Ctx) => { await ctx.app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await ctx.app.close().catch(() => {}); await rm(ctx.dir, { recursive: true, force: true }) }
const sh = (ctx: Ctx, op: string, ...args: unknown[]): Promise<any> => ctx.shell.evaluate(([name, list]) => (window as any).shell[name as string](...(list as unknown[])), [op, args] as [string, unknown[]])
const state = (ctx: Ctx) => sh(ctx, 'state')
const call = (page: Page, op: string, ...args: unknown[]): Promise<any> => page.evaluate(([name, list]) => (window as any).panel[name as string](...(list as unknown[])), [op, args] as [string, unknown[]])
const events = (page: Page): Promise<any[]> => page.evaluate(() => (window as any).__events)
const raw = (page: Page, envelope: unknown): Promise<any> => page.evaluate(value => (window as any).panel.__raw(value), envelope)
// Una solicitud queda en curso dentro de la ventana para poder cancelarla o esperarla más tarde.
const start = (page: Page, payload: Record<string, unknown>, id = randomUUID()) => page.evaluate(([p, i]) => { const w = window as any; w.__r ??= {}; w.__r[i as string] = w.panel.run(p, i); return i }, [payload, id] as [Record<string, unknown>, string]) as Promise<string>
const result = (page: Page, id: string): Promise<any> => page.evaluate(i => (window as any).__r[i], id)
const run = (column: number, cost = 0, priority = 'interactive') => ({ kind: 'groupCount', column, priority, simulatedCostMs: cost })
const ready = (page: Page) => page.waitForFunction(() => (window as any).__events?.some((e: any) => e.type === 'state' && e.state === 'ready'))
async function panelPage(ctx: Ctx, windowId: number) {
  let found: Page | undefined
  await expect.poll(async () => {
    for (const page of ctx.app.windows()) {
      if (!page.url().endsWith('panel.html')) continue
      const id = await page.evaluate(() => (window as any).panel?.identity?.windowId).catch(() => undefined)
      if (id === windowId) { found = page; return true }
    }
    return false
  }, { timeout: 20_000 }).toBe(true)
  return found!
}
async function detach(ctx: Ctx, docId: string) {
  const t = Date.now(), windowId = (await sh(ctx, 'detach', docId)) as number
  const page = await panelPage(ctx, windowId); await ready(page)
  return { page, windowId, ms: Date.now() - t }
}
const inPanel = (ctx: Ctx, windowId: number, code: string): Promise<string> => ctx.app.evaluate(({ BrowserWindow }, [id, expression]) => BrowserWindow.getAllWindows().find(w => w.webContents.id === id)!.webContents.executeJavaScript(expression as string), [windowId, code] as [number, string])
const memoryMiB = (ctx: Ctx) => ctx.app.evaluate(({ app }) => Math.round(app.getAppMetrics().reduce((sum, item) => sum + item.memory.workingSetSize, 0) / 1024))

test.afterAll(async () => { const path = process.env.SPIKE_RESULTS ?? test.info().outputPath('spike.json'); await writeFile(path, JSON.stringify(results, null, 2)); console.log('RESULTADOS_SPIKE', JSON.stringify(results)) })

test('cola: prioridad, límite de motores, cancelación, reutilización y tiempo límite (sin Electron)', async () => {
  const { JobQueue } = await load('queue.mjs'), { CodedError } = await load('contract.mjs')
  let alive = 0, peak = 0, destroyed = 0
  const engine = (hang = false) => ({
    create: () => { alive++; peak = Math.max(peak, alive); return { n: alive } },
    run: (_h: unknown, spec: any) => hang ? new Promise(() => {}) : new Promise(done => setTimeout(() => done({ rows: spec.value, engineMs: spec.ms }), spec.ms)),
    destroy: () => { alive--; destroyed++ }
  })
  const sub = (id: string, key: string, priority: string, ms: number, extra: object = {}) => ({ requestId: id, windowId: 1, docId: 'd', revision: 1, key, priority, spec: { label: id, ms, value: key }, ...extra })
  // 1. Prioridad y límite de concurrencia: con 1 hueco, interactive pasa por delante de export y background aunque llegaran después.
  let q = new JobQueue({ engine: engine(), concurrency: 1 })
  const all = [q.submit(sub('slow', 'k0', 'background', 80)), q.submit(sub('bg', 'k1', 'background', 5)), q.submit(sub('ex', 'k2', 'export', 5)), q.submit(sub('ui', 'k3', 'interactive', 5))]
  await Promise.all(all)
  expect(q.stats.order).toEqual(['slow', 'ui', 'ex', 'bg']); expect(peak).toBe(1); expect(alive).toBe(0)
  // 2. Con 2 huecos nunca hay más de 2 motores vivos.
  peak = 0; q = new JobQueue({ engine: engine(), concurrency: 2 })
  await Promise.all(['a', 'b', 'c', 'd', 'e'].map((id, i) => q.submit(sub(id, `m${i}`, 'interactive', 20)))); expect(peak).toBe(2); expect(alive).toBe(0)
  // 3. Cancelar en cola: nunca arranca. Cancelar en ejecución: destruye el motor y libera el hueco aunque el motor no responda.
  q = new JobQueue({ engine: engine(true), concurrency: 1 }); destroyed = 0; alive = 0
  const running = q.submit(sub('r', 'c0', 'interactive', 0)), queued = q.submit(sub('q', 'c1', 'interactive', 0)), next = q.submit(sub('n', 'c2', 'interactive', 0))
  const outcomes = [running, queued].map(p => p.then(() => 'ok', (e: any) => e.code))
  await sleep(20); expect(q.cancel('q')).toBe(true); expect(await outcomes[1]).toBe('E_CANCELLED'); expect(q.stats.cancelledQueued).toBe(1)
  expect(q.cancel('r')).toBe(true); expect(await outcomes[0]).toBe('E_CANCELLED'); expect(destroyed).toBe(1)
  await sleep(20); expect(q.stats.started).toBe(2); expect(q.running.size).toBe(1) // 'n' ocupó el hueco liberado
  q.cancel('n'); await expect(next).rejects.toMatchObject({ code: 'E_CANCELLED' }); expect(alive).toBe(0); expect(q.running.size).toBe(0)
  // 4. Solicitudes idénticas comparten el trabajo; cancelar una no aborta la otra; cancelar ambas sí.
  alive = 0; q = new JobQueue({ engine: engine(), concurrency: 1 })
  const one = q.submit(sub('s1', 'same', 'interactive', 60)), two = q.submit(sub('s2', 'same', 'export', 60)); const twoOutcome = two.catch((e: any) => e.code)
  await sleep(10); q.cancel('s2'); expect(await twoOutcome).toBe('E_CANCELLED')
  const solved = await one; expect(solved.shared).toBe(false); expect(q.stats.started).toBe(1); expect(q.stats.shared).toBe(1); expect(q.stats.cancelledRunning).toBe(0)
  const hit = await q.submit(sub('s3', 'same', 'interactive', 60)); expect(hit.fromCache).toBe(true); expect(q.stats.started).toBe(1)
  q.invalidate('d'); const fresh = await q.submit(sub('s4', 'same', 'interactive', 5)); expect(fresh.fromCache).toBe(false); expect(q.stats.started).toBe(2)
  const both1 = q.submit(sub('b1', 'both', 'interactive', 500)).catch((e: any) => e.code), both2 = q.submit(sub('b2', 'both', 'interactive', 500)).catch((e: any) => e.code)
  await sleep(20); q.cancel('b1'); q.cancel('b2'); expect([await both1, await both2]).toEqual(['E_CANCELLED', 'E_CANCELLED']); expect(q.stats.cancelledRunning).toBe(1); expect(alive).toBe(0)
  // 4b. Cancelar en el mismo instante en que arranca el trabajo (antes de que el motor haya hecho nada) también libera el motor.
  alive = 0; destroyed = 0; q = new JobQueue({ engine: engine(true), concurrency: 1 })
  const instant = q.submit(sub('i', 'inst', 'interactive', 0)).catch((e: any) => e.code); q.cancel('i'); expect(await instant).toBe('E_CANCELLED'); expect(destroyed).toBe(1); expect(alive).toBe(0); expect(q.running.size).toBe(0)
  // 5. Tiempo límite: el trabajo colgado se corta y el siguiente avanza.
  alive = 0; q = new JobQueue({ engine: engine(true), concurrency: 1, timeoutMs: 40 })
  const hung = q.submit(sub('h', 'h0', 'interactive', 0)).catch((e: any) => e.code); const after = q.submit(sub('h2', 'h1', 'interactive', 0)).catch((e: any) => e.code)
  expect(await hung).toBe('E_TIMEOUT'); expect(await after).toBe('E_TIMEOUT'); expect(q.stats.timeouts).toBe(2); expect(alive).toBe(0)
  expect(new CodedError('E_STALE', 'x').code).toBe('E_STALE')
  results.queue = { ok: true, scenarios: ['prioridad', 'concurrencia 1 y 2', 'cancelar en cola y en ejecución', 'compartir/caché/invalidar', 'tiempo límite'] }
})

test('1-4 · ventana secundaria asociada a un documento, datos por IPC y filtros sincronizados', async () => {
  const ctx = await boot()
  try {
    const before = await memoryMiB(ctx)
    const A = await detach(ctx, ctx.ventas)
    const after = await memoryMiB(ctx)
    expect(A.page.url()).toMatch(/panel\.html$/)
    const hello = (await call(A.page, 'hello')).data
    expect(hello).toMatchObject({ windowId: A.windowId, docId: ctx.ventas, docName: 'ventas.csv', state: 'ready', revision: 1 })
    // El documento queda fijado: cambiar el activo en la ventana principal no cambia el de la secundaria.
    await sh(ctx, 'activate', ctx.clientes)
    expect((await call(A.page, 'hello')).data.docName).toBe('ventas.csv')
    // Datos por IPC: agrupar la columna 0 de 600 filas en 5 ciudades.
    const t = Date.now(); const first = await call(A.page, 'run', run(0)); const roundtrip = Date.now() - t
    expect(first.ok).toBe(true); expect(first.data.rows.map((r: any) => r[0])).toEqual(['CDMX', 'Guadalajara', 'Mérida', 'Monterrey', 'Puebla'])
    expect(first.data.rows.reduce((sum: number, r: any) => sum + r[1], 0)).toBe(600)
    // Filtros sincronizados: main es la fuente de verdad y reenvía la vista con un número de versión.
    const B = await detach(ctx, ctx.clientes), C = await detach(ctx, ctx.ventas)
    await sh(ctx, 'setView', ctx.ventas, { search: 'Mérida' })
    await expect.poll(async () => (await events(A.page)).some(e => e.type === 'view' && e.viewSeq === 1)).toBe(true)
    await expect.poll(async () => (await events(C.page)).some(e => e.type === 'view' && e.viewSeq === 1)).toBe(true)
    expect((await events(B.page)).some(e => e.type === 'view' && e.viewSeq === 1)).toBe(false) // el otro documento no se entera
    const filtered = await call(A.page, 'run', run(0)); expect(filtered.data.rows).toEqual([['Mérida', 120]]); expect(filtered.data.viewSeq).toBe(1)
    await sh(ctx, 'setView', ctx.ventas, { filters: { 1: 'Mochila' }, order: [{ column: 0, descending: true }] })
    expect((await call(C.page, 'run', run(0))).data.rows.reduce((sum: number, r: any) => sum + r[1], 0)).toBe(150)
    for (const page of [A.page, B.page, C.page]) { const seqs = (await events(page)).map(e => e.seq); expect(seqs).toEqual([...seqs].sort((x, y) => x - y)); expect(new Set(seqs).size).toBe(seqs.length) }
    const cacheLater = await call(A.page, 'run', run(0)); expect(cacheLater.data.fromCache).toBe(true)
    const samples: number[] = []; for (let i = 1; i <= 7; i++) { await sh(ctx, 'setView', ctx.ventas, { search: `x${i}` }); const s = Date.now(); await call(A.page, 'run', run(0)); samples.push(Date.now() - s) }
    samples.sort((a, b) => a - b)
    results.window = { openToReadyMs: A.ms, workingSetDeltaMiBFirstPanel: after - before, roundtripMsFirstRun: roundtrip, roundtripMsMedianSimulatedEngine: samples[3] }
  } finally { await shut(ctx) }
})

test('5 · concurrencia: ya no gana la última solicitud', async () => {
  const ctx = await boot()
  try {
    const A = await detach(ctx, ctx.ventas), B = await detach(ctx, ctx.clientes)
    const a = await start(A.page, run(0, 1500))
    await expect.poll(async () => (await state(ctx)).queue.started).toBe(1)
    const b = await start(B.page, run(0, 100))
    await expect.poll(async () => (await events(B.page)).some(e => e.type === 'progress' && e.requestId === b && e.phase === 'queued')).toBe(true)
    const [ra, rb] = [await result(A.page, a), await result(B.page, b)]
    expect([ra.ok, rb.ok]).toEqual([true, true])
    const s = await state(ctx)
    expect(s.queue).toMatchObject({ cancelledRunning: 0, cancelledQueued: 0, completed: 2, maxEngines: 1 })
    expect(s.order).toEqual([`interactive:${a.slice(0, 4)}`, `interactive:${b.slice(0, 4)}`])
    results.noLastWins = { sequence: 'A en curso, B llega después', aCompleted: ra.ok, bCompleted: rb.ok, cancelled: s.queue.cancelledRunning, maxEngines: s.queue.maxEngines }
  } finally { await shut(ctx) }
})

test('5 · prioridades entre ventanas', async () => {
  const ctx = await boot()
  try {
    const A = await detach(ctx, ctx.ventas), B = await detach(ctx, ctx.clientes)
    const slow = await start(A.page, run(0, 1200))
    await expect.poll(async () => (await state(ctx)).queue.started).toBe(1)
    const bg = await start(B.page, run(0, 30, 'background')), ex = await start(A.page, run(1, 30, 'export')), ui = await start(B.page, run(1, 30, 'interactive'))
    for (const [page, id] of [[A.page, slow], [B.page, bg], [A.page, ex], [B.page, ui]] as const) expect((await result(page, id)).ok).toBe(true)
    const order = (await state(ctx)).order as string[]
    expect(order.map(label => label.split(':')[0])).toEqual(['interactive', 'interactive', 'export', 'background'])
    expect(order[1]).toBe(`interactive:${ui.slice(0, 4)}`)
    results.priority = { order: order.map(label => label.split(':')[0]) }
  } finally { await shut(ctx) }
})

test('5 · cancelar una solicitud: en cola, en ejecución, ajena y reutilizada', async () => {
  const ctx = await boot()
  try {
    const A = await detach(ctx, ctx.ventas), B = await detach(ctx, ctx.clientes), baseline = 3
    const running = await start(A.page, run(0, 4000))
    await expect.poll(async () => (await state(ctx)).windows).toBe(baseline + 1) // main + 2 paneles + el motor oculto
    const queuedA = await start(A.page, run(1, 30)), queuedB = await start(B.page, run(0, 30))
    expect((await raw(A.page, { v: 1, windowId: A.windowId, docId: ctx.ventas, requestId: running, op: 'run', payload: run(2) })).error.code).toBe('E_SCHEMA') // id reutilizado
    expect((await call(A.page, 'cancel', queuedA)).data).toEqual({ cancelled: true })
    expect((await result(A.page, queuedA)).error.code).toBe('E_CANCELLED')
    expect((await call(B.page, 'cancel', running)).error.code).toBe('E_OWNER') // otra ventana no puede cancelar la solicitud
    expect((await state(ctx)).queue.cancelledRunning).toBe(0)
    const t = Date.now(); expect((await call(A.page, 'cancel', running)).data).toEqual({ cancelled: true })
    await expect.poll(async () => (await state(ctx)).windows, { intervals: [10, 20, 50] }).toBeLessThanOrEqual(baseline + 1)
    const cancelToNextStartMs = Date.now() - t
    expect((await result(A.page, running)).error.code).toBe('E_CANCELLED')
    expect((await result(B.page, queuedB)).ok).toBe(true) // el hueco liberado lo usa la siguiente solicitud
    const s = await state(ctx)
    expect(s.queue).toMatchObject({ started: 2, cancelledQueued: 1, cancelledRunning: 1, maxEngines: 1, engines: 0 })
    await expect.poll(async () => (await state(ctx)).windows).toBe(baseline) // sin motores residuales
    expect(s.owners).toBe(0)
    results.cancel = { queuedNeverStarted: true, runningDestroysEngine: true, foreignCancelRejected: 'E_OWNER', requestIdReuseRejected: 'E_SCHEMA', cancelToNextStartMs, residualEngines: 0 }
  } finally { await shut(ctx) }
})

test('5 · solicitudes idénticas de dos ventanas comparten un solo trabajo', async () => {
  const ctx = await boot()
  try {
    const A = await detach(ctx, ctx.ventas), B = await detach(ctx, ctx.ventas)
    const x1 = await start(A.page, run(0, 800))
    await expect.poll(async () => (await state(ctx)).queue.started).toBe(1)
    const x2 = await start(B.page, run(0, 800))
    await expect.poll(async () => (await state(ctx)).queue.shared).toBe(1)
    await call(B.page, 'cancel', x2)
    expect((await result(B.page, x2)).error.code).toBe('E_CANCELLED')
    const first = await result(A.page, x1); expect(first.ok).toBe(true)
    let s = await state(ctx); expect(s.queue).toMatchObject({ started: 1, cancelledRunning: 0 })
    const again = await call(B.page, 'run', run(0, 800)); expect(again.data.fromCache).toBe(true); s = await state(ctx); expect(s.queue.started).toBe(1)
    results.sharing = { engineRunsForThreeIdenticalRequests: s.queue.started, cacheHits: s.queue.cacheHits, cancelOneSubscriberKeepsJob: true }
  } finally { await shut(ctx) }
})

test('IPC: lista permitida, identidad y rechazos', async () => {
  const ctx = await boot()
  try {
    const A = await detach(ctx, ctx.ventas), docA = ctx.ventas, windowId = A.windowId
    const surface = await A.page.evaluate(() => ({ keys: Object.keys((window as any).panel).sort(), shell: typeof (window as any).shell, freya: typeof (window as any).freya, require: typeof (window as any).require, process: typeof (window as any).process }))
    expect(surface.keys).toEqual(['__raw', 'cancel', 'close', 'getView', 'hello', 'identity', 'onEvent', 'reattach', 'run'].sort())
    expect([surface.shell, surface.freya, surface.require, surface.process]).toEqual(['undefined', 'undefined', 'undefined', 'undefined'])
    const base = { v: 1, windowId, docId: docA, op: 'getView', payload: {} }
    const code = async (envelope: unknown) => (await raw(A.page, envelope)).error?.code
    const rejected = {
      otraVentana: await code({ ...base, windowId: windowId + 999 }), otroDocumento: await code({ ...base, docId: ctx.clientes }),
      operacionDesconocida: await code({ ...base, op: 'openFile', payload: { path: '/etc/hosts' } }), campoExtra: await code({ ...base, payload: { path: '/etc/hosts' } }),
      versionDistinta: await code({ ...base, v: 2 }), propiedadExtraEnSobre: await code({ ...base, admin: true }),
      columnaFueraDeRango: await code({ ...base, op: 'run', requestId: randomUUID(), payload: run(999) }), costeAbsurdo: await code({ ...base, op: 'run', requestId: randomUUID(), payload: run(0, 1e9) }),
      tipoDeConsultaLibre: await code({ ...base, op: 'run', requestId: randomUUID(), payload: { kind: 'sql', column: 0, sql: 'COPY datos TO \'/tmp/x\'' } }),
      sobreRevisionAntigua: await code({ ...base, op: 'run', requestId: randomUUID(), revision: 7, payload: run(0) }),
      sinSolicitud: await code({ ...base, op: 'run', payload: run(0) }), mensajeBasura: await code('hola')
    }
    expect(rejected).toEqual({ otraVentana: 'E_WINDOW', otroDocumento: 'E_DOC', operacionDesconocida: 'E_SCHEMA', campoExtra: 'E_SCHEMA', versionDistinta: 'E_SCHEMA', propiedadExtraEnSobre: 'E_SCHEMA', columnaFueraDeRango: 'E_SCHEMA', costeAbsurdo: 'E_SCHEMA', tipoDeConsultaLibre: 'E_SCHEMA', sobreRevisionAntigua: 'E_STALE', sinSolicitud: 'E_SCHEMA', mensajeBasura: 'E_SCHEMA' })
    // La ventana principal no puede usar el canal del panel; el panel no puede abrir ventanas ni navegar.
    expect((await sh(ctx, 'rawPanelOp', base)).error.code).toBe('E_SENDER')
    const count = (await state(ctx)).windows
    expect(await A.page.evaluate(() => (window as any).open('about:blank') === null)).toBe(true)
    await A.page.evaluate(() => { location.href = 'https://example.com/' }).catch(() => {}); await sleep(300)
    expect(A.page.url()).toMatch(/panel\.html$/); expect((await state(ctx)).windows).toBe(count)
    results.ipc = { exposedOperations: surface.keys.filter(key => key !== '__raw' && key !== 'identity' && key !== 'onEvent'), rejected }
  } finally { await shut(ctx) }
})

test('6 · cerrar solo la secundaria; 7 · fallo del renderer; documento editado o cerrado', async () => {
  const ctx = await boot()
  try {
    const checksum = async (id: string) => (await state(ctx)).docs.find((d: any) => d.id === id).checksum
    const sumVentas = await checksum(ctx.ventas), sumClientes = await checksum(ctx.clientes)
    const A = await detach(ctx, ctx.ventas), B = await detach(ctx, ctx.clientes), baseline = 3
    // 6. Cerrar A con una consulta en curso: se libera el motor, B sigue y los datos no cambian.
    const inFlight = await start(A.page, run(0, 5000)); await expect.poll(async () => (await state(ctx)).windows).toBe(baseline + 1)
    const waiting = await start(B.page, run(0, 30))
    await sh(ctx, 'closePanel', A.windowId)
    await expect.poll(async () => (await state(ctx)).panels.length).toBe(1)
    expect((await result(B.page, waiting)).ok).toBe(true)
    await expect.poll(async () => (await state(ctx)).windows).toBe(2) // main + B, sin motores huérfanos
    expect((await state(ctx)).queue).toMatchObject({ cancelledRunning: 1, engines: 0 })
    expect(await checksum(ctx.ventas)).toBe(sumVentas); expect(await checksum(ctx.clientes)).toBe(sumClientes)
    expect((await ctx.shell.evaluate(() => (window as any).__events)).some((e: any) => e.type === 'panel-closed' && e.docId === ctx.ventas)).toBe(true)
    void inFlight
    // 7. Fallo del renderer de B con una consulta en curso: el resto sigue, B se recarga y recupera su vista desde main.
    const C = await detach(ctx, ctx.ventas)
    await sh(ctx, 'setView', ctx.clientes, { search: 'Puebla' }); await expect.poll(async () => (await events(B.page)).some(e => e.type === 'view' && e.view.search === 'Puebla')).toBe(true)
    const running = await start(B.page, run(0, 5000)); await expect.poll(async () => (await state(ctx)).windows).toBe(4)
    const other = await start(C.page, run(1, 30)); const t = Date.now()
    await sh(ctx, 'crashPanel', B.windowId)
    expect((await result(C.page, other)).ok).toBe(true) // la otra ventana no se entera
    await expect.poll(async () => { const s = await state(ctx); return s.counters.crashes === 1 && s.panels.find((p: any) => p.windowId === B.windowId)?.state === 'ready' }, { timeout: 20_000 }).toBe(true)
    const recoveryMs = Date.now() - t
    // Playwright no se vuelve a conectar a un destino que se cayó, así que se comprueba el renderer recargado desde main.
    const hello = JSON.parse(await inPanel(ctx, B.windowId, 'window.panel.hello().then(JSON.stringify)')).data
    expect(hello).toMatchObject({ docId: ctx.clientes, state: 'ready' }); expect(hello.view.search).toBe('Puebla')
    const again = JSON.parse(await inPanel(ctx, B.windowId, `window.panel.run({kind:'groupCount',column:0,priority:'interactive',simulatedCostMs:0}).then(JSON.stringify)`))
    expect(again.data.rows).toEqual([['Puebla', 60]])
    expect(await inPanel(ctx, B.windowId, '__events.map(e => e.seq).join(",")')).toMatch(/^\d+(,\d+)*$/) // el renderer nuevo recibió un estado completo al cargar
    await expect.poll(async () => (await state(ctx)).windows).toBe(3) // main + B + C, sin motor huérfano
    expect(await checksum(ctx.clientes)).toBe(sumClientes); void running
    // Documento editado: la ventana pasa a «stale», se rechaza lo viejo y lo nuevo se calcula con la revisión nueva.
    const slowOld = await start(C.page, run(0, 2000)); await expect.poll(async () => (await state(ctx)).queue.engines).toBe(1)
    const startedBefore = (await state(ctx)).queue.started
    expect(await sh(ctx, 'editDoc', ctx.ventas)).toBe(2)
    expect((await result(C.page, slowOld)).error.code).toBe('E_STALE')
    await expect.poll(async () => (await events(C.page)).some(e => e.type === 'state' && e.state === 'stale' && e.revision === 2)).toBe(true)
    expect((await call(C.page, 'run', run(0), randomUUID(), 1)).error.code).toBe('E_STALE')
    const fresh = await call(C.page, 'run', run(0)); expect(fresh.ok).toBe(true); expect(fresh.data.revision).toBe(2); expect(fresh.data.fromCache).toBe(false)
    expect((await state(ctx)).queue.started).toBeGreaterThan(startedBefore)
    // Documento cerrado en la ventana principal: la secundaria lo dice con claridad y no conserva referencias inválidas.
    const pending = await start(C.page, run(1, 3000)); await expect.poll(async () => (await state(ctx)).queue.engines).toBe(1)
    await sh(ctx, 'closeDoc', ctx.ventas)
    expect((await result(C.page, pending)).error).toMatchObject({ code: 'E_DOC_CLOSED', message: expect.stringContaining('ventas.csv') })
    await expect.poll(async () => (await events(C.page)).some(e => e.type === 'state' && e.state === 'closed')).toBe(true)
    expect((await call(C.page, 'getView')).error.code).toBe('E_DOC_CLOSED'); expect((await call(C.page, 'run', run(0))).error.code).toBe('E_DOC_CLOSED')
    const s = await state(ctx); expect(s.panels.find((p: any) => p.windowId === C.windowId)).toMatchObject({ state: 'closed', docResolved: false }); expect(s.owners).toBe(0)
    expect((await call(C.page, 'hello')).data).toMatchObject({ state: 'closed', docName: 'ventas.csv' }) // sigue respondiendo; sin revisión ni vista
    expect((await call(C.page, 'close')).data).toEqual({ closing: true })
    await expect.poll(async () => (await state(ctx)).panels.length).toBe(1)
    results.lifecycle = { closeSecondaryOnly: true, orphanEnginesAfterClose: 0, crashRecoveryMs: recoveryMs, viewRestoredAfterCrash: true, otherWindowUnaffected: true, staleRejected: 'E_STALE', closedDocument: 'E_DOC_CLOSED', crashes: s.counters.crashes }
  } finally { await shut(ctx) }
})

test('7 · un renderer que se cae en bucle no se recarga indefinidamente', async () => {
  const ctx = await boot()
  try {
    const A = await detach(ctx, ctx.ventas), pending = () => state(ctx).then(s => s.panels.find((p: any) => p.windowId === A.windowId)?.state)
    for (let i = 1; i <= 3; i++) {
      await sh(ctx, 'crashPanel', A.windowId)
      await expect.poll(async () => (await state(ctx)).counters.crashes).toBe(i)
      await expect.poll(pending, { timeout: 20_000 }).toBe('ready')
    }
    await sh(ctx, 'crashPanel', A.windowId)
    await expect.poll(pending).toBe('error'); await sleep(1500)
    expect(await pending()).toBe('error') // sin nueva recarga
    expect((await state(ctx)).counters.crashes).toBe(4)
    expect((await ctx.shell.evaluate(() => (window as any).__events)).some((e: any) => e.type === 'panel-error' && e.windowId === A.windowId)).toBe(true)
    await sh(ctx, 'closePanel', A.windowId); await expect.poll(async () => (await state(ctx)).panels.length).toBe(0)
    expect((await state(ctx)).windows).toBe(1)
    results.restartBudget = { restartsAllowed: 3, fourthCrashLeavesError: true, mainNotifiedAndCanClose: true }
  } finally { await shut(ctx) }
})

test('4 · cierre de la ventana principal: sin datos pendientes y con documento modificado', async () => {
  // Sin cambios pendientes: cerrar la principal cierra todo, aunque haya paneles y consultas.
  let ctx = await boot()
  try {
    const A = await detach(ctx, ctx.ventas); await start(A.page, run(0, 8000)); await expect.poll(async () => (await state(ctx)).queue.engines).toBe(1)
    const closed = ctx.app.waitForEvent('close'); const t = Date.now()
    void sh(ctx, 'requestClose').catch(() => {}) // la página desaparece antes de contestar
    await closed; results.closeClean = { exitMs: Date.now() - t, panelsOpen: 1, queryRunning: true }
  } finally { await shut(ctx) }
  // Con un documento modificado: se pide confirmación, la secundaria no cambia el resultado y el cierre no queda bloqueado.
  ctx = await boot()
  try {
    const A = await detach(ctx, ctx.ventas); await sh(ctx, 'editDoc', ctx.clientes)
    const slow = await start(A.page, run(0, 3000)); await expect.poll(async () => (await state(ctx)).queue.engines).toBe(1)
    await sh(ctx, 'requestClose')
    await expect.poll(async () => (await ctx.shell.evaluate(() => (window as any).__events)).find((e: any) => e.type === 'confirm-close')?.docs).toEqual(['clientes.csv'])
    let s = await state(ctx); expect(s.closePending).toBe(true); expect(s.panels.length).toBe(1)
    expect((await call(A.page, 'hello')).data.state).toBe('ready') // la secundaria sigue operativa mientras se decide
    await sh(ctx, 'resolveClose', 'cancel'); s = await state(ctx); expect(s.closePending).toBe(false); expect(s.docs.find((d: any) => d.name === 'clientes.csv').dirty).toBe(true)
    await sh(ctx, 'requestClose'); await expect.poll(async () => (await state(ctx)).closePending).toBe(true)
    const closed = ctx.app.waitForEvent('close'); const t = Date.now()
    void sh(ctx, 'resolveClose', 'discard').catch(() => {}); await closed
    results.closeDirty = { confirmationShownOnce: true, cancelKeepsEverything: true, exitMsAfterDiscard: Date.now() - t }
    void slow
  } finally { await shut(ctx) }
})

test('persistencia: esquema versionado, escritura atómica, recuperación y ventana fuera de pantalla', async () => {
  const { layout, defaults, load: loadLayout, save, fitBounds } = await load('layout-store.mjs')
  const dir = await mkdtemp(join(tmpdir(), 'freyalab-layout-')), path = join(dir, 'workspace-layout.json')
  try {
    expect(await loadLayout(path)).toEqual({ layout: defaults(), recovered: false })
    const value = { version: 1, dock: { visible: true, width: 520, tab: 'sql' }, panel: { width: 700, height: 640, x: 40, y: 60, tab: 'resumen' } }
    await save(path, value); expect((await loadLayout(path)).layout).toEqual(value)
    expect((await readdir(dir)).sort()).toEqual(['workspace-layout.json']) // sin temporales
    expect(Object.keys(JSON.parse(await readFile(path, 'utf8'))).sort()).toEqual(['dock', 'panel', 'version'])
    await expect(save(path, { ...value, dock: { ...value.dock, width: 10 } })).rejects.toThrow(); await expect(save(path, { ...value, rows: [['a']] })).rejects.toThrow(); await expect(save(path, { ...value, version: 2 })).rejects.toThrow()
    expect((await loadLayout(path)).layout).toEqual(value) // un guardado inválido no toca el archivo
    await writeFile(path, '{"version":1,"dock":'); const broken = await loadLayout(path)
    expect(broken).toEqual({ layout: defaults(), recovered: true }); expect(await readFile(`${path}.invalid`, 'utf8')).toBe('{"version":1,"dock":')
    await writeFile(path, JSON.stringify({ ...value, csvPreview: [['secreto']] })); expect((await loadLayout(path)).recovered).toBe(true) // claves ajenas (p. ej. datos) no se aceptan
    expect(layout.safeParse({ ...value, version: 2 }).success).toBe(false)
    const primary = { workArea: { x: 0, y: 25, width: 1440, height: 875 } }, second = { workArea: { x: 1440, y: 0, width: 1920, height: 1080 } }
    const centered = fitBounds({ width: 700, height: 640, x: 3000, y: 100 }, [primary])
    expect(centered).toEqual({ x: 370, y: 143, width: 700, height: 640 }) // el segundo monitor ya no está
    expect(fitBounds({ width: 700, height: 640, x: 3000, y: 100 }, [primary, second])).toEqual({ x: 3000, y: 100, width: 700, height: 640 })
    expect(fitBounds({ width: 700, height: 640, x: -5000, y: -5000 }, [primary])).toMatchObject({ width: 700, height: 640, x: 370 })
    expect(fitBounds({ width: 4000, height: 3000 }, [primary])).toEqual({ x: 0, y: 25, width: 1440, height: 875 })
    expect(fitBounds({ width: 700, height: 640, x: 1400, y: 100 }, [primary])).toMatchObject({ x: 370 }) // con solo 40 px asomando no se puede agarrar la barra de título
    results.persistence = { atomicNoTemp: true, invalidKept: true, unknownKeysRejected: true, offscreenRecovered: true }
  } finally { await rm(dir, { recursive: true, force: true }) }
})
