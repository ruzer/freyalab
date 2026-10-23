import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
import { copyFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
const work = await mkdtemp(join(tmpdir(), 'edit-')); const file = join(work, 'ventas.csv'); await copyFile(join(DATA, 'ventas.csv'), file)
const a = await launch({ open: [file] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
const cell = (r, c) => page.locator(`[role=gridcell][data-row="${r}"][data-column="${c}"]`)
const sel = () => page.evaluate(() => [...document.querySelectorAll('[role=gridcell][aria-selected=true]')].map(e => e.dataset.row + ',' + e.dataset.column).join(' '))
const overlays = () => page.evaluate(() => [...document.querySelectorAll('[role=dialog],[role=menu],.dropdown,.context-menu,.modal,.popover,[role=listbox]')].filter(e => e.offsetParent !== null).map(e => (e.getAttribute('aria-label') || e.className) + ' :: ' + e.innerText.replace(/\n+/g, ' | ').slice(0, 700)))
// 1 keyboard nav
await cell(0, 3).click(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown'); log('1) after click(0,3)+Right+Down selected:', await sel())
await page.keyboard.press('Enter'); await page.keyboard.type('5'); await page.keyboard.press('Enter'); await page.waitForTimeout(300)
log('1) after edit+Enter: selected', await sel(), '| active:', await page.evaluate(() => document.activeElement?.tagName + ' ' + (document.activeElement?.getAttribute('aria-label') ?? '')))
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(150); log('1) ArrowDown after commit -> selected:', await sel())
await page.keyboard.press('Tab'); log('1) Tab ->', await sel(), '| active', await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName))
await page.keyboard.press('F2'); log('1) F2 -> edit input:', await page.locator('[role=gridcell] input,[role=gridcell] textarea').count()); await page.keyboard.press('Escape')
await page.keyboard.press('Delete'); await page.waitForTimeout(300); log('1) Delete key on cell -> overlay:', await overlays()); await a.shot('05a-delete')
await page.keyboard.press('Escape')
// 2 range selection
await cell(1, 1).click(); await cell(3, 3).click({ modifiers: ['Shift'] }); log('2) shift-range selected count:', (await sel()).split(' ').length); await a.shot('05b-range')
log('2) footer:', (await page.locator('.table-footer, .selection-summary, footer').allInnerTexts()).map(x => x.replace(/\n/g, ' ')).join(' || '))
log('2) bottom bar text:', await page.evaluate(() => { const els = [...document.querySelectorAll('main *')].filter(e => e.children.length === 0 && /Selección|selección|celdas|Suma|Promedio/.test(e.innerText || '')); return els.map(e => e.innerText).slice(0, 6) }))
// 3 context menus
await cell(2, 2).click({ button: 'right' }); await page.waitForTimeout(300); log('3) right-click cell:', await overlays()); await a.shot('05c-ctx-cell'); await page.keyboard.press('Escape')
await page.getByRole('columnheader').nth(1).click({ button: 'right' }); await page.waitForTimeout(300); log('3) right-click column header:', await overlays()); await a.shot('05d-ctx-col'); await page.keyboard.press('Escape')
await page.getByRole('button', { name: 'Seleccionar fila 3' }).click({ button: 'right' }); await page.waitForTimeout(300); log('3) right-click row header:', await overlays()); await a.shot('05e-ctx-row'); await page.keyboard.press('Escape')
// 4 Operaciones menu & Comandos
await page.getByText('Operaciones').first().click(); await page.waitForTimeout(300); log('4) Operaciones:', await page.evaluate(() => document.querySelector('details[open]')?.innerText.replace(/\n+/g, ' | '))); await a.shot('05f-ops')
await page.getByText('Operaciones').first().click()
await page.keyboard.press('Meta+k'); await page.waitForTimeout(400); log('4) Meta+K overlays:', await overlays()); await a.shot('05g-palette'); await page.keyboard.press('Escape')
// 5 filters
await page.getByRole('button', { name: /Filtros/ }).click(); await page.waitForTimeout(400); log('5) Filtros:', await overlays()); await a.shot('05h-filters')
log('errors', a.errors); await close(a)
