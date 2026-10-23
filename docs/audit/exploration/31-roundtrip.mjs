import { launch, close, DATA as RT } from './lib.mjs'
import { join } from 'node:path'
import { copyFile, mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
for (const name of ['sucio.csv', 'crlf-bom.csv', 'multilinea.csv']) {
  const work = await mkdtemp(join(tmpdir(), 'rt-')); const file = join(work, name); await copyFile(join(RT, name), file)
  const before = await readFile(file)
  const a = await launch({ open: [file] }); const { page } = a
  await page.waitForSelector('[role=grid] [role=gridcell]')
  const c = page.locator('[role=gridcell][data-row="0"][data-column="0"]'); await c.dblclick(); await page.keyboard.press('Meta+a'); await page.keyboard.type('EDITADO'); await page.keyboard.press('Enter'); await page.waitForTimeout(400)
  await page.keyboard.press('Meta+s'); await page.waitForTimeout(900)
  const after = await readFile(file)
  const b = before.toString('utf8'), x = after.toString('utf8')
  const bl = b.split(/(?<=\n)/), al = x.split(/(?<=\n)/)
  const diffs = bl.map((l, i) => l !== al[i] ? JSON.stringify([l.slice(0, 50), (al[i] ?? '').slice(0, 50)]) : null).filter(Boolean)
  console.log(`${name}: bytes ${before.length}→${after.length} | BOM kept: ${before[0] === after[0]} | CRLF kept: ${/\r\n/.test(b) === /\r\n/.test(x)} | lines ${bl.length}→${al.length} | differing lines: ${diffs.length}`, diffs.slice(0, 3).join(' ; '))
  await close(a)
}
