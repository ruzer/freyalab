import { spawn } from 'node:child_process'
import { expect, it, vi } from 'vitest'
import { closeElectron } from './e2e/close-electron'

it('termina el proceso de prueba si Electron no confirma el cierre', async ({ onTestFinished }) => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    detached: process.platform !== 'win32',
    stdio: 'ignore',
  })
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  })
  const close = vi.fn(() => new Promise<void>(() => {}))
  const closed = closeElectron({
    process: () => child,
    evaluate: vi.fn().mockResolvedValue(undefined),
    close,
  })
  await vi.advanceTimersByTimeAsync(5000)
  await closed
  expect(close).toHaveBeenCalledOnce()
  expect(child.signalCode ?? child.exitCode).not.toBeNull()
})
