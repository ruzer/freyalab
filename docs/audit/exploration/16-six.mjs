import { launch, close, DATA, SHOTS } from './lib.mjs'
import { join } from 'node:path'
const a = await launch({ open: [join(DATA, 'ventas.csv')], size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
const sel = n => page.getByRole('combobox', { name: n })
await page.getByRole('button', { name: 'Gráficos' }).click(); await page.waitForTimeout(500)
const set = async (n, label) => { await sel(n).selectOption({ label }); await page.waitForTimeout(120) }
const run = async (name, cfg, extra) => {
  await set('Tipo de gráfico', cfg.type)
  for (const [k, v] of Object.entries(cfg.set ?? {})) await set(k, v)
  const btn = page.getByRole('button', { name: 'Generar gráfico' })
  const enabled = await btn.isEnabled(); if (!enabled) { log(`${name}: Generar DISABLED`); return }
  await btn.click(); await page.waitForTimeout(2200)
  const msg = await page.evaluate(() => [...document.querySelectorAll('.charts-panel p, .charts-panel [role=status], .charts-panel [role=alert]')].map(e => e.innerText.trim()).filter(t => /listo|error|No se|omit|Sin datos|No hay|no puede|límite/i.test(t)).join(' // '))
  log(`${name}: ${msg}`)
  const plot = page.locator('.plot-scroll').first()
  if (await plot.count()) { await plot.scrollIntoViewIfNeeded(); await plot.screenshot({ path: join(SHOTS, `16-${name}.png`) }) }
}
await run('dispersion-precio-total', { type: 'Dispersión', set: { 'Columna X del gráfico': '5. Precio', 'Columna Y del gráfico': '6. Total' } })
await run('mapa-calor-ciudad-producto', { type: 'Mapa de calor', set: { 'Columna X del gráfico': '2. Ciudad', 'Columna Y del gráfico': '3. Producto' } })
await run('caja-ciudad-total', { type: 'Diagrama de caja', set: { 'Columna X del gráfico': '2. Ciudad', 'Columna Y del gráfico': '6. Total' } })
log('errors', a.errors)
await close(a)
