// M3 · Anfitrión del proceso confinado: el Host de M2 (operaciones cerradas, medición, cancelación) sobre un proceso lanzado por la capa del sistema operativo.
// `ps` solo ve el envoltorio (bwrap, powershell), así que la memoria se pide al propio worker.
import {Host} from '../../duckdb-native/lib/host.mjs'
import {spawn} from 'node:child_process'
export class ConfinedHost extends Host {
  startTimeoutMs = 90000
  // Sin tiempo máximo, un hijo que no llega a responder (p. ej. Electron con el fusible RunAsNode desactivado) deja colgado al anfitrión.
  async start(install, options) {
    let timer
    const limit = new Promise((_, reject) => { timer = setTimeout(() => { this.child?.kill?.(); reject(new Error(`el proceso auxiliar no respondió en ${this.startTimeoutMs} ms`)) }, this.startTimeoutMs) })
    try { return await Promise.race([super.start(install, options), limit]) } finally { clearTimeout(timer) }
  }
  async rss() { try { return (await this.send('info')).rss } catch { return null } }
  async cpu() { return 0 }
  info() { return this.send('info') }
  // Parada ordenada: el worker termina por su cuenta y el lanzador de Windows alcanza a escribir su resultado (concesiones, tiempos). Si no, se mata.
  async stop() {
    if (!this.alive) return
    try { this.child.post({id: 0, type: 'exit'}) } catch {}
    await Promise.race([this.exited, new Promise(resolve => setTimeout(resolve, 8000))])
    if (this.alive) await super.stop()
  }
}
// Sin capa: el mismo worker como hijo normal (control para medir lo que cuesta la capa).
export function spawnPlain({exe, args, env = {}}) {
  const child = spawn(exe, args, {stdio: ['pipe', 'pipe', 'inherit'], env: {...process.env, ...env}})
  let buffer = ''; const listeners = []
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', chunk => { buffer += chunk; let i; while ((i = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1); if (!line.startsWith('{')) continue; let m; try { m = JSON.parse(line) } catch { continue } for (const fn of listeners) fn(m) } })
  child.stdin.on('error', () => {})
  return {pid: child.pid, child, post: m => child.stdin.write(JSON.stringify(m) + '\n'), onMessage: fn => listeners.push(fn), onExit: fn => child.on('close', code => fn(code)), kill: () => child.kill('SIGKILL')}
}
