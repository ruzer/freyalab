import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
import { copyFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
const work = await mkdtemp(join(tmpdir(), 'flowB-')); const file = join(work, 'sucio.csv'); await copyFile(join(DATA, 'sucio.csv'), file)
const a = await launch({ open: [file], size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
// does the Operaciones menu close on outside click / Escape?
await page.getByText('Operaciones').first().click()
log('menu open after click:', await page.evaluate(() => !!document.querySelector('details[open]')))
await page.keyboard.press('Escape'); log('after Escape:', await page.evaluate(() => !!document.querySelector('details[open]')))
await page.mouse.click(900, 700); log('after click outside:', await page.evaluate(() => !!document.querySelector('details[open]')))
await a.shot('10a-menu-after-outside-click')
await page.evaluate(() => document.querySelector('details[open]')?.removeAttribute('open'))
// Transform dialog
await page.getByRole('checkbox', { name: 'Seleccionar columna Ciudad' }).check()
await page.getByText('Operaciones').first().click()
await page.getByRole('button', { name: 'Transformar documento…' }).click(); await page.waitForTimeout(600)
await a.shot('10b-transform-dialog')
const dlg = await page.evaluate(() => [...document.querySelectorAll('[role=dialog],.modal')].filter(e => e.offsetParent).map(e => e.innerText.replace(/\n+/g, ' | ')).join('\n---\n'))
log('TRANSFORM DIALOG:', dlg.slice(0, 2500))
await close(a)
