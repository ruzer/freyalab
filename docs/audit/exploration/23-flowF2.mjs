import { launch, close, DATA, SHOTS } from './lib.mjs'
import { readdir, stat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
const theme = process.argv[2] ?? 'light'
const a = await launch({ size: [1440, 900], theme }); const { page } = a
const log = (...x) => console.log(...x)
await page.getByRole('button', { name: '＋ Nuevo ▾' }).click()
await page.locator('.dropdown button', { hasText: 'Diagrama Mermaid' }).click(); await page.waitForTimeout(1200)
await page.locator('.cm-content').click()
await page.keyboard.type('flowchart TD\n  A[Inicio] --> B{¿Datos limpios?}\n  B -->|Sí| C[Analizar]\n  B -->|No| D[Limpiar]\n  D --> B\n  C --> E[Exportar]')
await page.waitForTimeout(1500)
log('editor text:', JSON.stringify(await page.locator('.cm-content').innerText()))
log('svg shown:', await page.locator('.diagram-svg svg').count(), '| error:', await page.locator('.diagram-error').count())
await page.locator('.cm-line').first().click(); await page.waitForTimeout(800); await a.shot(`23a-flowchart-${theme}`)
const z = () => page.locator('.diagram-toolbar span').nth(2).innerText()
await page.getByRole('button', { name: 'Acercar' }).click(); await page.getByRole('button', { name: 'Acercar' }).click(); log('zoom after 2x +:', await z())
await page.getByRole('button', { name: 'Ajustar' }).click(); log('zoom after Ajustar:', await z())
for (const fmt of [/SVG/, /PNG/, /PDF/]) { await page.getByRole('button', { name: '⇧ Exportar ▾' }).click(); await page.waitForTimeout(250); await page.locator('.dropdown button', { hasText: fmt }).first().click(); await page.waitForTimeout(2500) }
const dir = join(a.dir, 'exports'); const files = await readdir(dir); for (const f of files) log('  export', f, (await stat(join(dir, f))).size, 'bytes')
log('toast:', await page.locator('.toast').allInnerTexts())
log('status bar:', (await page.locator('footer').innerText()).replace(/\n/g, ' · '), '| tab:', (await page.getByRole('tab').first().innerText()).replace(/\n/g, ' '))
log('errors', a.errors)
await close(a)
