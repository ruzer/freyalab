import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
import { copyFile, readFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
const work = await mkdtemp(join(tmpdir(), 'flowA-')); const file = join(work, 'ventas.csv'); await copyFile(join(DATA, 'ventas.csv'), file)
const before = await readFile(file, 'utf8')
const a = await launch({ open: [file] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const cell = (r, c) => page.locator('[role=row]').nth(r).locator('[role=gridcell]').nth(c)
const log = (...x) => console.log(...x)
log('cells in first body row:', await page.locator('[role=row]').nth(1).locator('[role=gridcell]').count())
log('cell 0,3 html', (await cell(1, 3).evaluate(e => e.outerHTML)).slice(0, 300))
// single click
await cell(1, 3).click(); await a.shot('04a-cell-clicked')
log('after 1 click, focused:', await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 200)))
// typing without edit mode
await page.keyboard.type('77'); await page.waitForTimeout(300)
log('after typing 77 (no Enter/dblclick) cell text:', await cell(1, 3).innerText(), '| dirty badge:', await page.getByText('Editado').count())
await a.shot('04b-after-typing')
// F2 / Enter
await page.keyboard.press('Escape')
await cell(1, 3).click(); await page.keyboard.press('Enter'); await page.waitForTimeout(200)
log('Enter -> editing input present:', await page.locator('[role=gridcell] input, [role=gridcell] textarea').count())
await page.keyboard.press('Escape')
await cell(1, 3).dblclick(); await page.waitForTimeout(200)
log('dblclick -> editing input present:', await page.locator('[role=gridcell] input, [role=gridcell] textarea').count())
await page.keyboard.press('Control+A'); await page.keyboard.type('99'); await a.shot('04c-editing')
await page.keyboard.press('Enter'); await page.waitForTimeout(400)
log('after Enter value:', await cell(1, 3).innerText(), '| dirty:', await page.getByText('Editado').count(), '| status bar:', (await page.locator('footer').innerText()).replace(/\n/g, ' · '))
log('focus moved to:', await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName))
await a.shot('04d-edited-dirty')
// tab title / unsaved marker
log('tab label:', await page.getByRole('tab').first().innerText())
// save with shortcut
await page.keyboard.press('Meta+s'); await page.waitForTimeout(800)
log('toast:', await page.locator('.toast').allInnerTexts(), '| status:', (await page.locator('footer').innerText()).replace(/\n/g, ' · '))
await a.shot('04e-saved')
const after = await readFile(file, 'utf8')
const bl = before.split('\n'), al = after.split('\n'); const diff = bl.map((l, i) => l !== al[i] ? [i, l, al[i]] : null).filter(Boolean)
log('bytes before/after', before.length, after.length, '| differing lines:', JSON.stringify(diff))
// undo after save
await page.getByRole('button', { name: 'Deshacer' }).click(); await page.waitForTimeout(400)
log('after undo (post-save): value', await cell(1, 3).innerText(), 'dirty', await page.getByText('Editado').count())
await page.getByRole('button', { name: 'Rehacer' }).click(); await page.waitForTimeout(300)
// close tab and reopen via API (native dialog can't be driven)
await page.getByRole('button', { name: /Cerrar ventas/ }).click(); await page.waitForTimeout(500)
log('after closing tab, welcome visible:', await page.getByText('Tu siguiente idea').count(), '| recents section:', await page.getByText(/Recientes/i).count())
await a.shot('04f-closed-welcome')
log('body text after close:', (await page.locator('main').innerText()).replace(/\n+/g, ' | ').slice(0, 400))
log('errors', a.errors)
await close(a)
