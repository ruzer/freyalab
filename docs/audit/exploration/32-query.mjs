import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
const a = await launch({ open: [join(DATA, 'sucio.csv')], size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
await page.getByRole('button', { name: 'Consulta avanzada' }).click(); await page.waitForTimeout(500)
await a.shot('32a-query')
log('QUERY PANEL:', await page.evaluate(() => { const els = [...document.querySelectorAll('main select, main input:not([type=checkbox]), main button, main textarea')].filter(e => e.offsetParent); return els.map(e => `${e.tagName.toLowerCase()}:${(e.getAttribute('aria-label') || e.innerText || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 45)}${e.tagName === 'SELECT' ? '=' + [...e.options].map(o => o.text).join('/').slice(0, 90) : ''}`).filter(x => !/Seleccionar|Editar enc|^button:(Fecha|Ciudad|Cliente|Monto|Estado|Código|Columna 7)/.test(x)).join('\n') }))
log('--- text:', (await page.locator('main').innerText()).split('\n').filter(l => l.trim().length > 40).slice(0, 8).join(' | '))
await close(a)
