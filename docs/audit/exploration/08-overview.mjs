import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
const a = await launch({ open: [join(DATA, 'sucio.csv')], size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
const region = () => page.locator('section, div').filter({ hasText: 'Estadísticas por columna' }).last()
await page.getByRole('button', { name: 'Estadísticas' }).click(); await page.waitForTimeout(400)
await page.getByText('Comprender todas las columnas').first().click(); await page.waitForTimeout(400)
const t0 = Date.now(); await page.getByRole('button', { name: 'Explorar columnas' }).click()
await page.waitForFunction(() => !/Explorando|Analizando/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(800)
log('explore ms', Date.now() - t0)
await a.shot('08a-overview')
const txt = (await page.locator('main').innerText()).split('\n').filter(l => l.trim()).join(' | ')
const i = txt.indexOf('Volver a estad'); log(txt.slice(i, i + 3000))
await close(a)
