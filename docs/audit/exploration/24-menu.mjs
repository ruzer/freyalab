import { _electron as electron } from '@playwright/test'
import electronPath from 'electron'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
const dir = await mkdtemp(join(tmpdir(), 'fl-')); const { ELECTRON_RUN_AS_NODE: _u, ...clean } = process.env
const app = await electron.launch({ executablePath: electronPath, args: [resolve('out/main/index.js')], env: { ...clean, FREYALAB_TEST: '1', FREYALAB_USER_DATA: join(dir, 'p') } })
const page = await app.firstWindow(); await page.waitForFunction(() => !!window.freya)
console.log('initial size/min:', await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return { size: w.getSize(), min: w.getMinimumSize(), titleBar: w.getTitle() } }))
console.log('app menu:', JSON.stringify(await app.evaluate(({ Menu }) => { const m = Menu.getApplicationMenu(); return m ? m.items.map(i => ({ l: i.label, sub: (i.submenu?.items ?? []).map(s => s.label + (s.accelerator ? ' [' + s.accelerator + ']' : '')).filter(Boolean).slice(0, 30) })) : null })))
await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
