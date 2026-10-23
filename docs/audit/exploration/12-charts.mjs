import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
const a = await launch({ open: [join(DATA, 'ventas.csv')], size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
const t0 = Date.now(); await page.getByRole('button', { name: 'Gráficos' }).click()
await page.waitForSelector('canvas, svg.echarts, [role=img]', { timeout: 20000 }).catch(() => log('no chart element'))
await page.waitForTimeout(1500); log('open charts ms', Date.now() - t0)
await a.shot('12a-charts-default')
const dump = await page.evaluate(() => { const p = [...document.querySelectorAll('main *')].find(e => /Gráficos?$/.test(e.getAttribute('aria-label') || '') ) ; const els = [...document.querySelectorAll('select,input,button,[role=tab],[role=radio],textarea')].filter(e => e.offsetParent !== null); return els.map(e => { const t = e.tagName.toLowerCase(); const lab = e.getAttribute('aria-label') || (e.labels && e.labels[0]?.innerText) || e.innerText || e.placeholder || ''; const extra = t === 'select' ? ' ['+[...e.options].map(o => o.text).join(' / ').slice(0,200)+'] = '+e.options[e.selectedIndex]?.text : t==='input'?` (${e.type}${e.type==='checkbox'?' '+e.checked:' '+e.value})`:''; return `${t}: ${lab.trim().replace(/\s+/g,' ')}${extra}` }) })
log(dump.filter(l => !/Seleccionar (fila|columna)|Editar encabezado|^button: (Fecha|Ciudad|Producto|Cantidad|Precio|Total|Vendedor)$/.test(l)).join('\n'))
log('errors', a.errors)
await close(a)
