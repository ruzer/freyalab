import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
const file = process.argv[2] ?? 'sucio.csv'
const a = await launch({ open: [join(DATA, file)], size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
const panel = async sel => (await page.locator(sel).first().innerText()).split('\n').filter(l => l.trim()).join(' | ')
await page.getByRole('button', { name: 'Estadísticas' }).click(); await page.waitForTimeout(500)
const t0 = Date.now(); await page.getByRole('button', { name: 'Analizar', exact: true }).click()
await page.waitForFunction(() => !/Analizando/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(600)
log('analyze ms', Date.now() - t0)
const statsRegion = page.locator('section, .stats-panel, [aria-label*="Estadísticas"]').filter({ hasText: 'Estadísticas por columna' }).first()
log('STATS PANEL:', (await statsRegion.innerText().catch(() => 'n/a')).split('\n').filter(l => l.trim()).join(' | ').slice(0, 2500))
await a.shot('07a-stats-analyzed')
// comprender todas
await page.getByText('Comprender todas las columnas').first().click(); await page.waitForTimeout(600); await a.shot('07b-comprender-open')
log('COMPRENDER (before run):', (await statsRegion.innerText()).split('\n').filter(l => l.trim()).join(' | ').slice(-900))
await close(a)
