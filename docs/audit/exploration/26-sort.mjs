import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
const a = await launch({ open: [join(DATA, 'ventas.csv')] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
const vals = async () => (await page.locator('[role=gridcell][data-column="5"]').allInnerTexts()).slice(0, 8).join(',')
const hdr = () => page.locator('[role=columnheader]').nth(5)
log('header html:', (await hdr().innerHTML()).replace(/\s+/g, ' ').slice(0, 300))
await hdr().locator('button.column-sort, button').nth(0).click(); await page.waitForTimeout(600)
log('click 1 (text order):', await vals(), '| aria-sort', await hdr().getAttribute('aria-sort'), '| header text:', (await hdr().innerText()).replace(/\n/g, ' '))
await hdr().locator('button').nth(0).click(); await page.waitForTimeout(600)
log('click 2:', await vals(), '| aria-sort', await hdr().getAttribute('aria-sort'))
await page.getByRole('checkbox', { name: 'Orden numérico' }).check(); await page.waitForTimeout(700)
log('Orden numérico ON (still desc):', await vals(), '| aria-sort', await hdr().getAttribute('aria-sort'))
await hdr().locator('button').nth(0).click(); await page.waitForTimeout(600)
log('click 3 numeric:', await vals(), '| aria-sort', await hdr().getAttribute('aria-sort'))
await a.shot('26-sorted-numeric')
log('how to clear sort? buttons:', await page.evaluate(() => [...document.querySelectorAll('main button')].filter(e => e.offsetParent && /Quitar|Limpiar|orden/i.test(e.innerText + e.title + e.getAttribute('aria-label'))).map(e => (e.innerText || e.title).trim()).join(' ; ')))
await close(a)
