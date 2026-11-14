import { execFileSync } from 'node:child_process'
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { removePackage, withCleanup } from '../scripts/package-smoke-support.mjs'

it('preserva el error de la prueba y el de limpieza cuando ambos fallan', async () => {
 const timeout = Object.assign(new Error('Playwright agotó su tiempo'), { code: 'ETIMEDOUT' })
 const locked = Object.assign(new Error('Archivo de paquete bloqueado'), { code: 'EPERM' })
 await expect(withCleanup(() => { throw timeout }, () => { throw locked })).rejects.toMatchObject({
  cause: timeout, errors: [timeout, locked], message: expect.stringContaining(timeout.message)
 })
 await expect(withCleanup(() => { throw timeout }, () => {})).rejects.toBe(timeout)
 await expect(withCleanup(() => {}, () => { throw locked })).rejects.toBe(locked)
})

it.skipIf(process.platform !== 'win32')('Windows: un hijo sobreviviente al timeout bloquea el paquete hasta cerrarlo', async () => {
 const directory = await mkdtemp(join(tmpdir(), 'freya-package-lock-'))
 const executable = join(directory, 'locked-node.exe')
 const marker = join(directory, 'pid')
 let pid: number | undefined
 try {
  await copyFile(process.execPath, executable)
  const start = `
   const [exe, marker] = process.argv.slice(1);
   const child = require('node:child_process').spawn(exe, ['-e', 'setInterval(()=>{},1000)'], { detached:true, stdio:'ignore', windowsHide:true });
   require('node:fs').writeFileSync(marker, String(child.pid));
   child.unref();
   setInterval(()=>{},1000);
  `
  expect(() => execFileSync(process.execPath, ['-e', start, executable, marker], { timeout: 2_000 })).toThrow(expect.objectContaining({ code: 'ETIMEDOUT' }))
  pid = Number(await readFile(marker, 'utf8'))
  expect(pid).toBeGreaterThan(0)
  expect(process.kill(pid, 0)).toBe(true)
  await expect(rm(executable)).rejects.toMatchObject({ code: expect.stringMatching(/^(EPERM|EBUSY|EACCES)$/) })
  await removePackage(directory)
  expect(() => process.kill(pid!, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }))
  pid = undefined
 } finally {
  if (pid) try { process.kill(pid) } catch {}
  await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
 }
})
