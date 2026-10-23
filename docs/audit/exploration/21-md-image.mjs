import { launch, close, DATA, SHOTS } from './lib.mjs'
import { join } from 'node:path'
import { writeFile, mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
const log = (...x) => console.log(...x)
const body = (img) => `# Informe\n\n${img}\n\n\`\`\`mermaid\nflowchart LR\n  A[Inicio] --> B[Proceso]\n  B --> C[Fin]\n\`\`\`\n\n\`\`\`mermaid\nflowchart LR\n  A[Inicio] -> B[Proceso\n\`\`\`\n`
for (const [name, img] of [['con-imagen-rota', '![Logo](logo.png)'], ['sin-imagen', 'Sin imagen.']]) {
  const dir = await mkdtemp(join(tmpdir(), 'md-')); const f = join(dir, `${name}.md`); await writeFile(f, body(img))
  const a = await launch({ open: [f], size: [1440, 900] }); const { page } = a
  await page.waitForSelector('.cm-content'); await page.waitForTimeout(4000)
  log(`\n== ${name}`)
  log('mermaid diagrams (svg):', await page.locator('[role=document] .mermaid-render svg').count(), '| error blocks:', await page.locator('[role=document] pre.diagram-error').allInnerTexts(), '| raw code blocks:', await page.locator('[role=document] pre code.language-mermaid').count())
  log('toast:', await page.locator('.toast').allInnerTexts())
  await a.shot(`21-${name}`)
  await page.getByRole('button', { name: '⇧ Exportar ▾' }).click(); await page.waitForTimeout(300)
  log('export menu:', await page.evaluate(() => [...document.querySelectorAll('.dropdown button')].filter(e => e.offsetParent).map(e => e.innerText.replace(/\n+/g, ' / ')).join(' ; ')))
  await page.locator('.dropdown button', { hasText: /HTML/ }).first().click(); await page.waitForTimeout(2500)
  log('after export HTML -> toast:', await page.locator('.toast').allInnerTexts(), '| files:', await readdir(join(a.dir, 'exports')))
  await close(a)
}
