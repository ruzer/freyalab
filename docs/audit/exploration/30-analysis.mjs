import { launch, close, DATA, SHOTS } from './lib.mjs'
import { join } from 'node:path'
const log = (...x) => console.log(...x)
const a = await launch({ open: [join(DATA, 'ventas.csv')], folder: DATA, size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
// sidebar tree needs the folder opened by UI; use the sidebar button
await page.locator('aside').getByRole('button', { name: 'Abrir carpeta' }).click().catch(e => log('open folder btn fail', e.message.slice(0, 60)))
await page.waitForTimeout(800)
log('sidebar text:', (await page.locator('aside').innerText()).replace(/\n+/g, ' | ').slice(0, 400))
await a.shot('30a-folder')
await page.getByRole('button', { name: 'Análisis', exact: true }).click(); await page.waitForTimeout(1200)
await a.shot('30b-analysis')
const txt = (await page.locator('main').innerText()).split('\n').filter(l => l.trim()).join(' | ')
const i = txt.indexOf('Análisis'); log('ANALYSIS PANEL TEXT:', txt.slice(txt.indexOf('Eliminar columna') + 17, txt.indexOf('Eliminar columna') + 2200))
log('controls:', await page.evaluate(() => [...document.querySelectorAll('main select,main textarea,main input,main [role=tab],main summary')].filter(e => e.offsetParent).map(e => `${e.tagName.toLowerCase()}:${(e.getAttribute('aria-label') || e.innerText || e.placeholder || '').trim().slice(0, 40)}`).filter(x => !/Seleccionar|Buscar|Orden|Primera|Codific|Separ/.test(x)).join(' ; ')))
await close(a)
