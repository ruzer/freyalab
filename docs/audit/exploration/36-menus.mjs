import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
const a = await launch({ open: [join(DATA, 'ventas.csv')], size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
const items = () => page.evaluate(() => [...document.querySelectorAll('[role=menu] [role=menuitem], [role=menu] button')].filter(e => e.offsetParent).map(e => e.innerText.trim().replace(/\n/g, ' ')).join(' ; '))
await page.getByRole('button', { name: 'Seleccionar fila 3' }).click({ button: 'right' }); await page.waitForTimeout(300); log('ROW MENU:', await items()); await page.keyboard.press('Escape')
await page.locator('[role=gridcell][data-row="2"][data-column="2"]').click({ button: 'right' }); await page.waitForTimeout(300); log('CELL MENU (no range):', await items()); await page.keyboard.press('Escape')
await page.getByText('Operaciones').first().click(); await page.getByRole('button', { name: 'Transformar documento…' }).click(); await page.waitForTimeout(500)
log('TRANSFORM operations:', await page.evaluate(() => [...document.querySelectorAll('select')].filter(e => e.offsetParent && /Operación/i.test((e.labels?.[0]?.innerText || e.getAttribute('aria-label') || ''))).map(e => [...e.options].map(o => o.text).join(' / ')).join(' || ')))
await close(a)
