import { launch, close, DATA, SHOTS } from './lib.mjs'
import { join } from 'node:path'
const a = await launch({ open: [join(DATA, 'ventas.csv')], size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
const sel = n => page.getByRole('combobox', { name: n })
await page.getByRole('button', { name: 'Gráficos' }).click(); await page.waitForTimeout(500)
const controls = () => page.evaluate(() => [...document.querySelectorAll('.charts-panel select, .charts-panel input, .charts-panel button')].filter(e => e.offsetParent).map(e => { const l = e.getAttribute('aria-label') || e.innerText || ''; return e.tagName === 'SELECT' ? `${l.trim()}=${e.options[e.selectedIndex]?.text}` : null }).filter(Boolean).join(' ; '))
const types = ['Histograma', 'Barras', 'Líneas', 'Dispersión', 'Mapa de calor', 'Diagrama de caja']
for (const t of types) {
  await sel('Tipo de gráfico').selectOption({ label: t }); await page.waitForTimeout(300)
  log(`\n== ${t} :: defaults ::`, await controls())
  const btn = page.getByRole('button', { name: 'Generar gráfico' })
  log('   Generar enabled by default?', await btn.isEnabled())
  const msgs = await page.evaluate(() => [...document.querySelectorAll('.charts-panel p, .charts-panel [role=status], .charts-panel [role=alert]')].map(e => e.innerText.trim()).filter(Boolean))
  log('   help/messages:', msgs.slice(0, 6).join(' // '))
}
await close(a)
