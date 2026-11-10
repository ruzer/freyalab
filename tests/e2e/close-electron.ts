import { execFileSync } from 'node:child_process'
import { once } from 'node:events'
import type { ElectronApplication } from '@playwright/test'

const CLOSE_MS = 5_000

export async function closeElectron(
  app?: Pick<ElectronApplication, 'evaluate' | 'close' | 'process'>,
  exit?: () => Promise<unknown>,
) {
  if (!app) return
  let child
  try { child = app.process() } catch { return } // Playwright ya liberó la aplicación.
  let timer: NodeJS.Timeout | undefined
  try {
    const close = async () => {
      if (child.exitCode === null && child.signalCode === null) {
        await (exit?.() ?? app.evaluate(({ app }) => app.exit(0))).catch(() => {})
      }
      await app.close()
    }
    const closed = await Promise.race([
      close().then(() => true, () => false),
      new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), CLOSE_MS) }),
    ])
    if (closed || !child.pid || child.exitCode !== null || child.signalCode !== null) return
    // Playwright inicia un shell en Windows y un grupo separado en Unix.
    console.warn(`[e2e] Cierre de Electron incompleto. Terminando el proceso de prueba ${child.pid}.`)
    const exited = once(child, 'exit', { signal: AbortSignal.timeout(CLOSE_MS) })
    try {
      try {
        if (process.platform === 'win32') {
          execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            timeout: CLOSE_MS, killSignal: 'SIGKILL', stdio: 'pipe',
          })
        } else {
          process.kill(-child.pid, 'SIGKILL')
        }
      } catch (error) {
        await exited.catch(() => { throw error })
      }
      await exited
    } catch (error) {
      throw new Error(`[e2e] No se pudo terminar el proceso de Electron ${child.pid}.`, { cause: error })
    }
  } finally {
    clearTimeout(timer)
  }
}
