import { launch, close, DATA, SHOTS } from './lib.mjs'
import { join } from 'node:path'
import { readdir, readFile, stat } from 'node:fs/promises'
const a = await launch({ open: [join(DATA, 'ventas.csv')], size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
let clicks = 0; const c = s => { clicks++; log(`  [${clicks}] ${s}`) }
const sel = n => page.getByRole('combobox', { name: n })
await page.getByRole('button', { name: 'Gráficos' }).click(); c('Gráficos')
await sel('Columna X del gráfico').selectOption({ label: '2. Ciudad' }); await sel('Tipo de medida del gráfico').selectOption({ index: 1 }); await sel('Resumen del gráfico').selectOption({ label: 'Suma' }); await sel('Columna Y del gráfico').selectOption({ label: '6. Total' })
await page.getByRole('button', { name: 'Generar gráfico' }).click(); await page.waitForTimeout(2000)
// change aggregation
const t = Date.now(); await sel('Resumen del gráfico').selectOption({ label: 'Promedio' }); c('Cálculo = Promedio')
await page.waitForTimeout(800)
log('title right after changing calc (no regenerate):', await page.evaluate(() => [...document.querySelectorAll('.charts-panel *')].filter(e => e.children.length === 0 && /^(Suma|Promedio) de Total por/.test(e.innerText || '')).map(e => e.innerText)))
log('stale notice:', await page.evaluate(() => [...document.querySelectorAll('.charts-panel p')].map(e => e.innerText).filter(t => /actualizad|Pulsa/.test(t)).join(' // ')))
await page.getByRole('button', { name: 'Generar gráfico' }).click(); c('Generar gráfico (again)'); await page.waitForTimeout(2000)
log('title after regenerate:', await page.evaluate(() => [...document.querySelectorAll('.charts-panel *')].filter(e => e.children.length === 0 && /^(Suma|Promedio) de Total por/.test(e.innerText || '')).map(e => e.innerText)))
// local filter
await page.getByRole('button', { name: 'Filtros del gráfico' }).click(); c('Filtros del gráfico'); await page.waitForTimeout(500)
await a.shot('17a-chart-filters')
log('FILTER PANEL:', await page.evaluate(() => { const els = [...document.querySelectorAll('.charts-panel select,.charts-panel input,.charts-panel button')].filter(e => e.offsetParent); return els.map(e => `${e.tagName.toLowerCase()}:${(e.getAttribute('aria-label') || e.innerText || e.placeholder || '').trim().slice(0, 50)}`).filter(x => /ondici|olumna|alor|Añadir|Agregar|Aplicar|Quitar|Operador|Y\/O|Grupo/i.test(x)).join(' ; ') }))
log('exports dir before:', await readdir(join(a.dir, 'exports')))
await page.getByRole('button', { name: 'Exportar gráfico PNG' }).scrollIntoViewIfNeeded()
await page.getByRole('button', { name: 'Exportar gráfico PNG' }).click(); c('Exportar gráfico PNG'); await page.waitForTimeout(2500)
await page.getByRole('button', { name: 'Exportar gráfico SVG' }).click(); c('Exportar gráfico SVG'); await page.waitForTimeout(1500)
const files = await readdir(join(a.dir, 'exports')); log('exports dir after:', files)
for (const f of files) { const p = join(a.dir, 'exports', f); const s = await stat(p); log('  ', f, s.size, 'bytes'); if (f.endsWith('.svg')) { const t = await readFile(p, 'utf8'); log('   svg has title/promedio:', /Promedio/.test(t), '| length', t.length, '| first 160:', t.slice(0, 160).replace(/\n/g, ' ')) } }
log('toast:', await page.locator('.toast').allInnerTexts())
log('total clicks ~', clicks)
await page.getByText('Exportar resultados del análisis').click(); await page.waitForTimeout(400)
log('RESULT EXPORT:', await page.evaluate(() => { const d = [...document.querySelectorAll('details[open]')].map(e => e.innerText.replace(/\n+/g, ' | ')).join(' ## '); return d.slice(0, 1500) }))
await a.shot('17b-result-export')
await close(a)
