import { launch, close, setSize, DATA } from './lib.mjs'
import { join } from 'node:path'
const a = await launch({ open: [join(DATA, 'ventas.csv')], size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
const metrics = () => page.evaluate(() => {
  const g = document.querySelector('[role=grid]'); const gr = g.getBoundingClientRect(); const rows = [...document.querySelectorAll('[role=gridcell][data-column="0"]')].filter(e => { const r = e.getBoundingClientRect(); return r.top >= gr.top + 40 && r.bottom <= gr.bottom + 1 }).length
  const bodyOverflowX = document.documentElement.scrollWidth - innerWidth
  const tb = document.querySelector('.toolbar'); const tbr = tb.getBoundingClientRect()
  const clipped = [...document.querySelectorAll('.toolbar button, .toolbar-right *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) }).map(e => (e.innerText || e.getAttribute('aria-label') || '').trim()).filter(Boolean)
  return { vw: innerWidth, vh: innerHeight, gridTop: Math.round(gr.top), chromePct: Math.round(gr.top / innerHeight * 100), gridH: Math.round(gr.height), visibleRows: rows, pageOverflowX: bodyOverflowX, toolbarH: Math.round(tbr.height), toolbarClipped: clipped }
})
for (const [w, h] of [[2560, 1440], [1920, 1080], [1440, 900], [1366, 768], [1280, 800], [1280, 720], [1024, 768], [900, 600]]) {
  await setSize(a.app, [w, h]); await page.waitForTimeout(500)
  log(`CSV ${w}x${h}:`, JSON.stringify(await metrics()))
}
await setSize(a.app, [900, 600]); await a.shot('27a-csv-900x600')
await page.getByRole('button', { name: 'Gráficos' }).click(); await page.waitForTimeout(500)
await a.shot('27b-charts-900x600')
log('charts @900x600:', JSON.stringify(await page.evaluate(() => { const p = document.querySelector('.charts-panel'); const r = p.getBoundingClientRect(); const g = document.querySelector('[role=grid]').getBoundingClientRect(); return { panelH: Math.round(r.height), panelScrollH: p.scrollHeight, gridVisibleH: Math.max(0, Math.round(innerHeight - 30 - g.top)), gridTop: Math.round(g.top) } })))
log('errors', a.errors)
await close(a)
