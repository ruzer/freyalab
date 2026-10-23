import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
import { copyFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
const work = await mkdtemp(join(tmpdir(), 'k-')); const file = join(work, 'ventas.csv'); await copyFile(join(DATA, 'ventas.csv'), file)
const a = await launch({ open: [file] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
const cell = (r, c) => page.locator(`[role=gridcell][data-row="${r}"][data-column="${c}"]`)
await cell(0, 3).dblclick(); await page.keyboard.press('Meta+a'); await page.keyboard.type('123'); await page.keyboard.press('Enter'); await page.waitForTimeout(400)
log('after edit:', await cell(0, 3).innerText(), '| dirty', await page.getByText('Editado').count())
await page.keyboard.press('Meta+z'); await page.waitForTimeout(500); log('Cmd+Z (focus on body) ->', await cell(0, 3).innerText())
await cell(0, 3).click(); await page.keyboard.press('Meta+z'); await page.waitForTimeout(500); log('Cmd+Z (cell focused) ->', await cell(0, 3).innerText())
await cell(0, 3).click(); await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(500); log('Cmd+Shift+Z ->', await cell(0, 3).innerText())
await cell(0, 3).click(); await page.keyboard.press('Meta+f'); await page.waitForTimeout(300); log('Cmd+F focus ->', await page.evaluate(() => document.activeElement?.getAttribute('aria-label')))
await page.keyboard.press('Escape')
// copy / paste between cells
await cell(1, 3).click(); await page.keyboard.press('Meta+c'); await cell(2, 3).click(); await page.keyboard.press('Meta+v'); await page.waitForTimeout(800)
log('copy (1,3) paste (2,3) -> dialog/preview:', await page.evaluate(() => [...document.querySelectorAll('[role=dialog],.modal')].filter(e => e.offsetParent).map(e => e.innerText.replace(/\n+/g, ' | ').slice(0, 200))), '| cell(2,3) =', await cell(2, 3).innerText())
await a.shot('25a-paste')
// Search & highlight
await page.keyboard.press('Escape')
await page.getByRole('textbox', { name: 'Buscar en tabla' }).fill('Mérida'); await page.waitForTimeout(900)
log('search "Mérida": counter =', await page.locator('main').getByText(/\d+ de 240 filas/).first().innerText(), '| marks:', await page.locator('mark, .match, .search-hit').count())
await a.shot('25b-search')
await page.getByRole('textbox', { name: 'Buscar en tabla' }).fill('Mérida ')  // trailing space typical typo
await page.waitForTimeout(700); log('search "Mérida␣" counter =', await page.locator('main').getByText(/\d+ de 240 filas/).first().innerText())
await page.getByRole('textbox', { name: 'Buscar en tabla' }).fill('zzz'); await page.waitForTimeout(700)
log('search no results: text =', (await page.locator('main').innerText()).split('\n').filter(l => /No hay|sin resultados|0 de 240|Ninguna/i.test(l)).slice(0, 3))
await a.shot('25c-search-empty')
log('errors', a.errors)
await close(a)
