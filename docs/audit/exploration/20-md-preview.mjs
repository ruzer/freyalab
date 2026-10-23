import { launch, close, DATA, SHOTS } from './lib.mjs'
import { join } from 'node:path'
import { writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
const dir = await mkdtemp(join(tmpdir(), 'md-')); const f = join(dir, 'informe.md')
await writeFile(f, `# Informe de ventas

Texto con **negrita**, *cursiva* y un [enlace](https://example.com). Fórmula: $E=mc^2$.

> [!NOTE]
> Esto es un callout estilo GitHub/Obsidian.

- [x] Tarea hecha
- [ ] Tarea pendiente

| Ciudad | Total |
| --- | --- |
| Mérida | 1200 |
| Puebla | 900 |

![Logo inexistente](logo.png)

\`\`\`python
print("hola")
\`\`\`

\`\`\`mermaid
flowchart LR
  A[Inicio] --> B[Proceso]
  B --> C[Fin]
\`\`\`

\`\`\`mermaid
flowchart LR
  A[Inicio] -> B[Proceso
\`\`\`
`)
const theme = process.argv[2] ?? 'light'
const a = await launch({ open: [f], size: [1440, 900], theme }); const { page } = a
const log = (...x) => console.log(...x)
await page.waitForSelector('.cm-content')
const t0 = Date.now()
for (const ms of [1000, 3000, 6000, 10000]) { await page.waitForTimeout(ms - (Date.now() - t0 > ms ? 0 : (Date.now() - t0))); log(`t=${ms}ms mermaid svgs:`, await page.locator('[role=document] svg').count(), '| code blocks:', await page.locator('[role=document] pre').count()) }

await a.shot(`20a-md-split-${theme}`)
log('PREVIEW text:', (await page.locator('[role=document]').first().innerText()).replace(/\n+/g, ' | ').slice(0, 900))
log('images in preview:', await page.evaluate(() => [...document.querySelectorAll('[role=document] img')].map(i => `${i.alt}:${i.complete}:${i.naturalWidth}`)))
log('mermaid svgs:', await page.locator('[role=document] svg').count(), '| error blocks:', await page.locator('[role=document] .mermaid-error, [role=document] [role=alert]').count())
log('callout rendered as blockquote?', await page.evaluate(() => { const b = document.querySelector('[role=document] blockquote'); return b ? b.className + ' :: ' + b.innerText.slice(0, 80) : 'none' }))
log('outline entries:', await page.locator('.outline button').allInnerTexts())
log('mode buttons:', await page.locator('.mode-switch button').allInnerTexts())
// modes
for (const m of ['Editar', 'Vista previa', 'Dividido']) { await page.locator('.mode-switch button', { hasText: m }).click(); await page.waitForTimeout(500); if (m === 'Vista previa') await a.shot(`20b-md-preview-${theme}`) }
log('errors', a.errors)
await close(a)
