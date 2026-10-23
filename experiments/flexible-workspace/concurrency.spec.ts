// Reproducción de caja negra sobre la aplicación real: cómo se comporta hoy SqlService cuando dos consumidores piden consultas.
// No modifica src/. Ejecutar desde la raíz tras `npm run build` (ver README).
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import electronPath from 'electron'
import { mkdtemp, mkdir, rm, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { DocumentInfo, FreyaAPI } from '../../src/shared/types'
declare global { interface Window { freya: FreyaAPI } }
test.describe.configure({ mode: 'serial' })
let app: ElectronApplication, page: Page, dir: string
const results: Record<string, unknown> = {}
const big = 'Id,Ciudad,Valor\n' + Array.from({ length: 100_000 }, (_, i) => `${i},C${i % 50},${i % 977}`).join('\n') + '\n'
const small = 'Id,Ciudad,Valor\n' + Array.from({ length: 240 }, (_, i) => `${i},C${i % 5},${i % 97}`).join('\n') + '\n'
const SQL = 'SELECT ciudad, count(*) AS n FROM datos GROUP BY 1 ORDER BY 1'
// Consulta deliberadamente larga para mantener el motor ocupado; se cancela siempre antes de terminar.
const SLOW = 'SELECT count(*) AS n FROM datos a CROSS JOIN datos b'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const open = async (name: string, text: string): Promise<DocumentInfo> => { const path = join(dir, name); await writeFile(path, text); return (await page.evaluate(p => window.freya.openPaths([p]), path))[0] }
const run = (doc: DocumentInfo, sql = SQL, requestId = crypto.randomUUID()) => ({ requestId, promise: page.evaluate(({ id, revision, requestId, sql }) => window.freya.sqlRun({ requestId, sources: [{ id, revision }], sql }).then(r => ({ ok: true as const, rows: r.returnedRows, at: performance.now() }), e => ({ ok: false as const, error: String(e.message ?? e), at: performance.now() })), { id: doc.id, revision: doc.revision, requestId, sql }) })
const windowsNow = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
const metrics = () => app.evaluate(({ app }) => app.getAppMetrics().map(m => ({ type: m.type, pid: m.pid, mb: Math.round(m.memory.workingSetSize / 1024) })))

test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'freyalab-fw-')); await mkdir(join(dir, 'exports')); await mkdir(join(dir, 'saved'))
  const { ELECTRON_RUN_AS_NODE: _unused, ...env } = process.env
  app = await electron.launch({ chromiumSandbox: true, executablePath: electronPath as unknown as string, args: [resolve('out/main/index.js')], env: { ...env as Record<string, string>, FREYALAB_TEST: '1', FREYALAB_USER_DATA: join(dir, 'profile'), FREYALAB_TEST_EXPORT_DIR: join(dir, 'exports'), FREYALAB_TEST_SAVE_DIR: join(dir, 'saved') }, timeout: 60_000 })
  page = await app.firstWindow(); await page.waitForFunction(() => !!window.freya)
})
test.afterAll(async () => {
  console.log('RESULTADOS ' + JSON.stringify(results))
  await writeFile(process.env.CONCURRENCY_RESULTS ?? test.info().outputPath('concurrency.json'), JSON.stringify(results, null, 1))
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); await rm(dir, { recursive: true, force: true })
})

test('S1: una consulta nueva cancela la que está en curso (el último gana)', async () => {
  const doc = await open('grande.csv', big)
  const base = await windowsNow()
  const a = run(doc, SLOW); await sleep(800)
  const during = await windowsNow()
  const t0 = Date.now(); const b = run(doc)
  const [ra, rb] = await Promise.all([a.promise, b.promise])
  results.S1 = { A: ra.ok ? 'completada' : ra.error, B: rb.ok ? 'completada' : rb.error, ventanasBase: base, ventanasConUnaConsulta: during, msHastaTerminarB: Date.now() - t0 }
  expect(ra.ok).toBe(false); expect((ra as { error: string }).error).toContain('Análisis cancelado.'); expect(rb.ok).toBe(true)
})

test('S2: el resultado paginable de una consulta se pierde cuando otra empieza', async () => {
  const doc = await open('pequeno.csv', small)
  const x = run(doc); const rx = await x.promise; expect(rx.ok).toBe(true)
  const page0 = await page.evaluate(id => window.freya.sqlPage(id, 0).then(() => 'disponible', e => String(e.message)), x.requestId)
  const y = run(doc); await y.promise
  const stale = await page.evaluate(id => window.freya.sqlPage(id, 0).then(() => 'disponible', e => String(e.message)), x.requestId)
  results.S2 = { antes: page0, despuesDeOtraConsulta: stale }
  expect(page0).toBe('disponible'); expect(stale).toContain('El resultado ya no está disponible')
})

test('S3: exportar resultados cancela la consulta en curso y a la inversa', async () => {
  const doc = await open('grande2.csv', big)
  const config = { headers: doc.headers!, options: { kind: 'bar' as const, x: 1, y: -1, bins: 10, aggregate: 'count' as const, descending: false, measureType: 'text' as const }, where: { conditions: [], filterMode: 'all' as const } }
  const exportOnce = () => page.evaluate(({ doc, config }) => window.freya.exportChartResult(doc.id, { requestId: crypto.randomUUID(), revision: doc.revision, configuration: config, format: 'json', protectFormulas: true }).then(p => ({ ok: true as const, path: String(p) }), e => ({ ok: false as const, error: String(e.message ?? e) })), { doc, config })
  // a) gráfico en curso, luego exportación: la exportación gana y el gráfico se cancela
  const chart = run(doc, SLOW); await sleep(800); const exportDuringChart = exportOnce()
  const [rc, re] = await Promise.all([chart.promise, exportDuringChart])
  // b) exportación en curso, luego gráfico: el gráfico gana y la exportación se cancela
  const exportFirst = exportOnce(); await sleep(600); const chart2 = run(doc)
  const [re2, rc2] = await Promise.all([exportFirst, chart2.promise])
  results.S3 = { graficoLuegoExportar: { grafico: rc.ok ? 'completada' : rc.error, exportacion: re.ok ? 'completada' : re.error }, exportarLuegoGrafico: { exportacion: re2.ok ? 'completada' : re2.error, grafico: rc2.ok ? 'completada' : rc2.error }, archivosExportados: (await readdir(join(dir, 'exports'))).length }
  expect(rc.ok).toBe(false); expect(re.ok).toBe(true); expect(re2.ok).toBe(false); expect(rc2.ok).toBe(true)
})

test('S4: cancelar con un identificador viejo no afecta a la consulta nueva', async () => {
  const doc = await open('pequeno2.csv', small)
  const old = run(doc); await old.promise
  const fresh = run(doc); await page.evaluate(id => window.freya.sqlCancel(id), old.requestId)
  const r = await fresh.promise
  results.S4 = { consultaNueva: r.ok ? 'completada' : r.error }
  expect(r.ok).toBe(true)
})

test('M1: coste real del motor: tiempo y memoria por consulta, en serie', async () => {
  const doc = await open('medida.csv', big), small1 = await open('medida-pequena.csv', small)
  const timings: Record<string, number[]> = { filas240: [], filas100000: [] }
  for (const [key, d] of [['filas240', small1], ['filas100000', doc]] as const) for (let i = 0; i < 3; i++) { const t = Date.now(); const r = await run(d).promise; expect(r.ok).toBe(true); timings[key].push(Date.now() - t) }
  // pico de memoria durante una consulta de 100 000 filas
  const base = await metrics(); let peak = 0, peakTabs = 0, peakWindows = 0; let stop = false
  const sampler = (async () => { while (!stop) { const m = await metrics(); peak = Math.max(peak, m.reduce((s, x) => s + x.mb, 0)); peakTabs = Math.max(peakTabs, m.filter(x => x.type === 'Tab').length); peakWindows = Math.max(peakWindows, await windowsNow()); await sleep(100) } })()
  await run(doc).promise; stop = true; await sampler; await sleep(500)
  const after = await metrics()
  results.M1 = { msPorConsulta: timings, memoriaMiBAntes: base.reduce((s, x) => s + x.mb, 0), picoMiB: peak, memoriaMiBDespues: after.reduce((s, x) => s + x.mb, 0), procesosRendererMaximos: peakTabs, ventanasMaximas: peakWindows, ventanasDespues: await windowsNow() }
})

test('M2: ancho mínimo del panel de gráficos sin desbordamiento y latencia del gráfico', async () => {
  const doc = await open('panel.csv', small)
  await expect(page.getByRole('grid')).toBeVisible()
  await page.getByRole('button', { name: 'Gráficos', exact: true }).click(); await expect(page.locator('.charts-panel')).toBeVisible()
  const widths: Record<string, unknown> = {}
  for (const w of [320, 360, 400, 440, 480, 520, 560]) {
    widths[w] = await page.evaluate(w => { const p = document.querySelector('.charts-panel') as HTMLElement; p.style.width = w + 'px'; p.style.maxWidth = w + 'px'; const plot = p.querySelector('.plot-scroll') as HTMLElement; return { desborda: p.scrollWidth > p.clientWidth + 1, anchoDelGrafico: Math.round(plot.getBoundingClientRect().width), desplazaElGrafico: plot.scrollWidth > plot.clientWidth + 1 } }, w)
  }
  await page.evaluate(() => { const p = document.querySelector('.charts-panel') as HTMLElement; p.style.width = ''; p.style.maxWidth = '' })
  const lat: number[] = []
  for (let i = 0; i < 5; i++) { await page.getByRole('combobox', { name: 'Columna X del gráfico' }).selectOption({ label: i % 2 ? '2. Ciudad' : '3. Valor' }); const t = Date.now(); await page.getByRole('button', { name: 'Generar gráfico' }).click(); await expect(page.getByText('Gráfico listo.')).toBeVisible({ timeout: 30_000 }); lat.push(Date.now() - t); await page.getByRole('combobox', { name: 'Columna X del gráfico' }).selectOption({ label: '2. Ciudad' }) }
  results.M2 = { anchosDelPanel: widths, msParaGenerarGrafico240Filas: lat.sort((a, b) => a - b) }
  void doc
})

// Columnas visibles de la tabla con un panel acoplado a la derecha, emulado reduciendo el ancho de la rejilla (la tabla ocupa todo el alto).
const wide = Array.from({ length: 14 }, (_, c) => c === 0 ? 'Id' : c === 1 ? 'Ciudad' : c === 2 ? 'Valor' : `Campo ${c + 1}`).join(',') + '\n' + Array.from({ length: 120 }, (_, i) => Array.from({ length: 14 }, (_, c) => c === 0 ? i : c === 1 ? `C${i % 5}` : c === 2 ? i % 97 : `v${c}-${i % 13}`).join(',')).join('\n') + '\n'
test('M3: columnas visibles de la tabla con un panel acoplado y tamaño del gráfico', async () => {
  await open('ancha.csv', wide); await expect(page.getByRole('grid')).toBeVisible()
  const grid: Record<string, Record<string, number>> = {}
  for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720]] as const) {
    await app.evaluate(({ BrowserWindow }, [w, h]) => { const win = BrowserWindow.getAllWindows()[0]; win.setContentSize(w, h) }, [width, height]); await sleep(400)
    grid[`${width}x${height}`] = await page.evaluate(() => {
      const scroll = document.querySelector('.csv-scroll') as HTMLElement, original = scroll.getBoundingClientRect().width, out: Record<string, number> = { anchoDeLaTabla: Math.round(original) }
      for (const dock of [0, 360, 480, 520, 560]) {
        scroll.style.flex = 'none'; scroll.style.width = Math.max(200, original - dock) + 'px'
        const box = scroll.getBoundingClientRect()
        out[`columnasConDock${dock}`] = [...scroll.querySelectorAll('[role=columnheader]')].filter(h => { const r = h.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1 }).length
      }
      scroll.style.flex = ''; scroll.style.width = ''
      return out
    })
  }
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 900)); await sleep(300)
  const total = await page.evaluate(() => document.querySelectorAll('.csv-scroll [role=columnheader]').length)
  // Tamaño del gráfico generado con el panel a 520 px.
  await page.getByRole('button', { name: 'Gráficos', exact: true }).click(); await expect(page.locator('.charts-panel')).toBeVisible()
  await page.getByRole('combobox', { name: 'Columna X del gráfico' }).selectOption({ label: '2. Ciudad' }); await page.getByRole('button', { name: 'Generar gráfico' }).click(); await expect(page.getByText('Gráfico listo.')).toBeVisible({ timeout: 30_000 })
  const chart = await page.evaluate(() => { const panel = document.querySelector('.charts-panel') as HTMLElement; panel.style.width = '520px'; panel.style.maxWidth = '520px'; const svg = panel.querySelector('.plot svg') as SVGElement, controls = [...panel.children].filter(c => !(c as HTMLElement).querySelector('.plot')).reduce((sum, c) => sum + (c as HTMLElement).getBoundingClientRect().height, 0); return { svgAncho: Math.round(svg.getBoundingClientRect().width), svgAlto: Math.round(svg.getBoundingClientRect().height), alturaDelPanel: Math.round(panel.getBoundingClientRect().height), alturaDeControles: Math.round(controls) } })
  results.M3 = { columnasTotales: total, ventanas: grid, grafico520: chart }
})

// Coste de una ventana secundaria con el renderer real (misma página y preload que la ventana principal; sin documentos).
test('M4: memoria de una segunda ventana con el renderer real', async () => {
  const total = () => app.evaluate(({ app }) => Math.round(app.getAppMetrics().reduce((sum, item) => sum + item.memory.workingSetSize, 0) / 1024))
  const deltas: number[] = []
  for (let i = 0; i < 3; i++) {
    await sleep(1500); const before = await total()
    await app.evaluate(async ({ BrowserWindow }, [renderer, preload]) => { const win = new BrowserWindow({ width: 900, height: 700, show: true, webPreferences: { sandbox: true, contextIsolation: true, preload } }); (globalThis as any).__second = win; await win.loadFile(renderer) }, [resolve('out/renderer/index.html'), resolve('out/preload/index.cjs')] as [string, string])
    await sleep(2500); const during = await total()
    await app.evaluate(() => { (globalThis as any).__second.destroy() }); await sleep(1000)
    deltas.push(during - before)
  }
  results.M4 = { deltaMiBPorVentana: deltas, ventanasDespues: await windowsNow() }
})
