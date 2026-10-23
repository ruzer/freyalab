import { launch, close, DATA, SHOTS } from './lib.mjs'
import { join } from 'node:path'
import { writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
const dir = await mkdtemp(join(tmpdir(), 'md-')); const f = join(dir, 'doc.md')
await writeFile(f, '# Informe\n\n```python\nprint("hola")\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nFin.\n')
const a = await launch({ open: [f], size: [1440, 900] }); const { page } = a
const log = (...x) => console.log(...x)
await page.waitForSelector('.cm-content')
const text = async () => JSON.stringify(await page.locator('.cm-content').innerText())
const clickLine = async (t) => { await page.locator('.cm-line', { hasText: t }).first().click() }
// 1) caret inside code fence + Mermaid
await clickLine('print'); await page.getByRole('button', { name: /Mermaid/ }).click(); await page.waitForTimeout(500)
log('1) caret in code fence + ◇ Mermaid ->', await text())
await page.getByRole('button', { name: 'Deshacer' }).click(); await page.waitForTimeout(400)
log('   after Deshacer ->', await text())
// 2) caret inside table + Bloque de código
await clickLine('| 1 | 2 |'); await page.getByText('Insertar ▾').click(); await page.getByRole('button', { name: 'Bloque de código' }).click(); await page.waitForTimeout(500)
log('2) caret in table + Bloque de código ->', await text())
await a.shot('19a-md-nested')
await page.getByRole('button', { name: 'Deshacer' }).click(); await page.waitForTimeout(400)
log('   after Deshacer ->', await text())
// 3) Tabla inside table
await clickLine('| 1 | 2 |'); await page.getByRole('button', { name: /Tabla/ }).click(); await page.waitForTimeout(400)
log('3) caret in table + ⊞ Tabla ->', await text())
await close(a)
