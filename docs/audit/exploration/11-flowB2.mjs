import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
import { copyFile, mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
const work = await mkdtemp(join(tmpdir(), 'flowB-')); const file = join(work, 'sucio.csv'); await copyFile(join(DATA, 'sucio.csv'), file)
const a = await launch({ open: [file], size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
const cell = (r, c) => page.locator(`[role=gridcell][data-row="${r}"][data-column="${c}"]`)
const selInfo = () => page.evaluate(() => [...document.querySelectorAll('main *')].filter(e => e.children.length === 0 && /Rango:|seleccionad|celdas ·/.test(e.innerText || '')).map(e => e.innerText).join(' / ') || '(no summary)')
let clicks = 0
const step = (s) => { clicks++; log(`  [${clicks}] ${s}`) }
// select the whole Ciudad column: click first cell, extend with keyboard
await cell(0, 1).click(); step('click first Ciudad cell')
await page.keyboard.press('Control+Shift+ArrowDown'); await page.waitForTimeout(300); log('after Ctrl+Shift+Down:', await selInfo())
await page.keyboard.press('Meta+Shift+ArrowDown'); await page.waitForTimeout(300); log('after Cmd+Shift+Down:', await selInfo())
await page.keyboard.press('Shift+End'); await page.waitForTimeout(300); log('after Shift+End:', await selInfo())
await page.keyboard.press('Shift+PageDown'); await page.waitForTimeout(300); log('after Shift+PageDown:', await selInfo())
// Now fall back: click first, scroll, shift-click last
await cell(0, 1).click()
await page.locator('[role=grid]').evaluate(g => { const s = g.querySelector('.csv-viewport, [class*=viewport]') || g; s.scrollTop = s.scrollHeight }); await page.waitForTimeout(500)
const lastRow = await page.evaluate(() => Math.max(...[...document.querySelectorAll('[role=gridcell]')].map(e => +e.dataset.row)))
log('last rendered row index:', lastRow)
await cell(lastRow, 1).click({ modifiers: ['Shift'] }); step('shift-click last Ciudad cell'); log('range:', await selInfo())
await cell(lastRow, 1).click({ button: 'right' }); step('right-click'); await page.waitForTimeout(300)
await page.getByRole('menuitem', { name: 'Mayúsculas en el rango…' }).click(); step('Mayúsculas en el rango…'); await page.waitForTimeout(800)
await a.shot('11a-upper-preview')
log('PREVIEW:', await page.evaluate(() => [...document.querySelectorAll('[role=dialog],.modal,.range-preview')].filter(e => e.offsetParent).map(e => e.innerText.replace(/\n+/g, ' | ').slice(0, 1200)).join('\n')))
await page.getByRole('button', { name: 'Aplicar cambio' }).click(); step('Aplicar cambio'); await page.waitForTimeout(900)
const vals = async () => (await page.locator('[role=gridcell][data-column="1"]').allInnerTexts()).slice(0, 12).join('|')
log('after apply:', await vals(), '| toast:', await page.locator('.toast').allInnerTexts(), '| dirty:', await page.getByText('Editado').count())
await a.shot('11b-after-apply')
await page.getByRole('button', { name: 'Deshacer' }).click(); step('Deshacer'); await page.waitForTimeout(700)
log('after undo:', await vals(), '| dirty:', await page.getByText('Editado').count())
await page.getByRole('button', { name: 'Rehacer' }).click(); await page.waitForTimeout(500)
log('after redo:', await vals())
log('total clicks (incl. selection):', clicks)
await close(a)
