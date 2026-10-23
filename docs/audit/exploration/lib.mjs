// Utilidades compartidas de las pruebas exploratorias (no forman parte de la suite del producto).
import { _electron as electron } from '@playwright/test'
import electronPath from 'electron'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = dirname(fileURLToPath(import.meta.url))
export const DATA = join(HERE, 'data')
export const SHOTS = process.env.AUDIT_SHOTS ?? join(HERE, 'out')
await mkdir(SHOTS, { recursive: true })
// Perfil, exportaciones y guardado en un directorio temporal; nunca datos del usuario.
export async function launch({ open = [], folder, size = [1440, 900], theme = 'light', profile } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'freyalab-audit-'))
  await mkdir(join(dir, 'exports')); await mkdir(join(dir, 'saved'))
  const { ELECTRON_RUN_AS_NODE: _u, ...clean } = process.env
  const env = { ...clean, FREYALAB_TEST: '1', FREYALAB_USER_DATA: profile ?? join(dir, 'profile'), FREYALAB_TEST_EXPORT_DIR: join(dir, 'exports'), FREYALAB_TEST_SAVE_DIR: join(dir, 'saved') }
  if (open.length) env.FREYALAB_TEST_OPEN = JSON.stringify(open)
  if (folder) env.FREYALAB_TEST_FOLDER = folder
  const app = await electron.launch({ executablePath: electronPath, args: [resolve('out/main/index.js')], env, timeout: 60000 })
  const page = await app.firstWindow()
  await page.waitForFunction(() => !!window.freya)
  await setSize(app, size)
  await page.evaluate(t => { localStorage.setItem('freya-theme', t) }, theme)
  await page.reload(); await page.waitForFunction(() => !!window.freya)
  const errors = []; page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) }); page.on('pageerror', e => errors.push('pageerror: ' + e.message))
  return { app, page, dir, errors, shot: (name, o = {}) => page.screenshot({ path: join(SHOTS, name + '.png'), ...o }) }
}
export async function setSize(app, [w, h]) {
  await app.evaluate(({ BrowserWindow }, [w, h]) => { const win = BrowserWindow.getAllWindows()[0]; win.setMinimumSize(1, 1); win.setSize(w, h); win.center() }, [w, h])
  await new Promise(r => setTimeout(r, 400))
}
export const close = async a => { try { await a.app.evaluate(({ app }) => app.exit(0)) } catch {} }
