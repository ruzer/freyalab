import { launch, close, DATA, SHOTS } from './lib.mjs'
import { join } from 'node:path'
const log = (...x) => console.log(...x)
const t0 = Date.now()
const a = await launch({ open: [join(DATA, 'grande.csv')], size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]', { timeout: 60000 }); log('open ms', Date.now() - t0)
await page.waitForTimeout(800)
await a.shot('29a-big-csv')
log('banner/warning text:', await page.evaluate(() => [...document.querySelectorAll('.warning-banner, .banner, [role=alert], [role=status]')].filter(e => e.offsetParent).map(e => e.innerText.replace(/\n+/g, ' | ')).join(' ## ')))
log('status:', (await page.locator('footer').innerText()).replace(/\n/g, ' · '))
log('rows counter:', await page.locator('main').getByText(/de [\d.,\s]+ filas/).first().innerText().catch(() => '?'))
log('disabled controls:', await page.evaluate(() => [...document.querySelectorAll('main button:disabled, header button:disabled')].map(b => (b.innerText || b.getAttribute('aria-label') || '').trim()).filter(Boolean).join(' ; ')))
log('can edit cell? dblclick ->', await (async () => { await page.locator('[role=gridcell][data-row="0"][data-column="2"]').dblclick(); await page.waitForTimeout(300); return await page.locator('[role=gridcell] input').count() })())
await close(a)
