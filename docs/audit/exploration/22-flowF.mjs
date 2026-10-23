import { launch, close, DATA, SHOTS } from './lib.mjs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
const a = await launch({ size: [1440, 900] }); const { page } = a
const log = (...x) => console.log(...x)
let clicks = 0; const c = s => { clicks++; log(`  [${clicks}] ${s}`) }
await page.getByRole('button', { name: '＋ Nuevo ▾' }).click(); c('Nuevo ▾')
await page.locator('.dropdown button', { hasText: 'Diagrama Mermaid' }).click(); c('Diagrama Mermaid'); await page.waitForTimeout(2000)
await a.shot('22a-new-mermaid')
log('TOOLBAR:', await page.evaluate(() => [...document.querySelectorAll('.document-tools button, .document-tools summary, .document-tools .tag')].filter(e => e.offsetParent).map(e => (e.getAttribute('aria-label') || e.innerText).trim()).join(' ; ')))
log('EDITOR initial:', JSON.stringify(await page.locator('.cm-content').innerText()))
log('PREVIEW has svg:', await page.locator('svg').count(), '| right pane text:', (await page.locator('.preview-pane, .diagram, section[aria-label*=iagrama]').first().innerText().catch(() => 'n/a')).slice(0, 200))
log('buttons in main:', await page.evaluate(() => [...document.querySelectorAll('main button')].filter(e => e.offsetParent).map(e => (e.getAttribute('aria-label') || e.innerText || e.title).trim()).filter(Boolean).join(' ; ')))
// break syntax
await page.locator('.cm-content').click(); await page.keyboard.press('Meta+ArrowDown'); await page.keyboard.type('\n  C -> D[')
await page.waitForTimeout(1500); await a.shot('22b-mermaid-error')
log('after syntax error: toast:', await page.locator('.toast').allInnerTexts(), '| error element:', await page.evaluate(() => [...document.querySelectorAll('[role=alert],.diagram-error,.error')].filter(e => e.offsetParent).map(e => e.innerText.slice(0, 300))))
log('svg still shown while invalid?', await page.locator('main svg').count())
await page.getByRole('button', { name: 'Deshacer' }).click(); await page.waitForTimeout(1200)
// export menu
await page.getByRole('button', { name: '⇧ Exportar ▾' }).click(); c('Exportar ▾'); await page.waitForTimeout(300)
log('export menu:', await page.evaluate(() => [...document.querySelectorAll('.dropdown button')].filter(e => e.offsetParent).map(e => e.innerText.replace(/\n+/g, ' / ')).join(' ; ')))
await page.locator('.dropdown button', { hasText: /SVG/ }).first().click(); c('SVG'); await page.waitForTimeout(1500)
log('exports:', await readdir(join(a.dir, 'exports')), '| toast', await page.locator('.toast').allInnerTexts())
log('errors', a.errors)
await close(a)
