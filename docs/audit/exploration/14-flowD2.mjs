import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
import { readdir, readFile } from 'node:fs/promises'
const size = process.argv[2] ? process.argv[2].split('x').map(Number) : [1440, 900]
const theme = process.argv[3] ?? 'light'
const a = await launch({ open: [join(DATA, 'ventas.csv')], size, theme }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
let clicks = 0; const c = s => { clicks++; log(`  [${clicks}] ${s}`) }
const sel = n => page.getByRole('combobox', { name: n })
await page.getByRole('button', { name: 'Gráficos' }).click(); c('open Gráficos')
await sel('Columna X del gráfico').selectOption({ label: '2. Ciudad' }); c('X = Ciudad')
await sel('Tipo de medida del gráfico').selectOption({ index: 1 }); c('El valor representa = Número')
await sel('Resumen del gráfico').selectOption({ label: 'Suma' }); c('Cálculo = Suma')
await sel('Columna Y del gráfico').selectOption({ label: '6. Total' }); c('Y = Total')
await sel('Orden del gráfico').selectOption({ label: 'Mayor valor primero' }); c('Orden = Mayor primero (optional)')
await page.getByRole('button', { name: 'Generar gráfico' }).click(); c('Generar gráfico'); await page.waitForTimeout(2500)
await a.shot(`14a-total-by-city-${size.join('x')}-${theme}`)
const geo = await page.evaluate(() => {
  const g = document.querySelector('[role=grid]'); const gr = g.getBoundingClientRect()
  const heading = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /^(Suma|Promedio|Conteo|Mínimo|Máximo|Mediana|Valores únicos) de .* por /.test(e.innerText || ''))
  const chartRoot = heading?.closest('div[class]')?.parentElement
  const el = [...document.querySelectorAll('svg, canvas')].filter(e => e.getBoundingClientRect().width > 300).sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0]
  const r = el?.getBoundingClientRect(); const chain = []; let p = el
  while (p && p !== document.body) { const cs = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(cs.overflowY)) chain.push(`${p.tagName.toLowerCase()}.${(p.className + '').split(' ')[0]} overflowY=${cs.overflowY} clientH=${p.clientHeight} scrollH=${p.scrollHeight} scrollTop=${p.scrollTop}`); p = p.parentElement }
  return { viewportH: innerHeight, chartEl: el?.tagName, chart: r && { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }, gridTop: Math.round(gr.top), visibleChartPx: r ? Math.max(0, Math.min(r.bottom, gr.top) - Math.max(r.top, 0)) : 0, chain }
})
log('GEOMETRY:', JSON.stringify(geo))
log('visible buttons in chart region:', await page.evaluate(() => [...document.querySelectorAll('button')].filter(e => e.offsetParent && /SVG|PNG|PDF|CSV|JSON|Markdown|Guardar|Exportar|Copiar|Filtros/.test(e.innerText + e.getAttribute('aria-label'))).map(e => (e.getAttribute('aria-label') || e.innerText).trim()).join(' ; ')))
const scrolled = await page.evaluate(() => { let p = [...document.querySelectorAll('svg, canvas')].filter(e => e.getBoundingClientRect().width > 300)[0]; while (p && p !== document.body) { if (p.scrollHeight > p.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(p).overflowY)) { p.scrollTop = p.scrollHeight; return `scrolled ${p.tagName}.${(p.className+'').split(' ')[0]} to ${p.scrollTop}` } p = p.parentElement } return 'no scroller' })
log(scrolled); await page.waitForTimeout(400); await a.shot(`14b-scrolled-${size.join('x')}-${theme}`)
log('errors', a.errors)
await close(a)
