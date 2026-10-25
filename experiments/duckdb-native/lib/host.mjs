// M2 · Anfitrión del proceso auxiliar: arranca el worker (hijo de Node o utilityProcess de Electron), envía operaciones cerradas, mide RSS y CPU
// del proceso auxiliar con `ps` y permite cancelar (interrupt) o matarlo.
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
const sh = promisify(execFile)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function psRss(pid) { try { return Number((await sh('ps', ['-o', 'rss=', '-p', String(pid)])).stdout) * 1024 } catch { return null } }
async function psCpu(pid) { // "m:ss.cc" o "h:mm:ss.cc"
  try {
    const parts = (await sh('ps', ['-o', 'cputime=', '-p', String(pid)])).stdout.trim().split(':').map(Number)
    return parts.reduce((total, part) => total * 60 + part, 0)
  } catch { return null }
}

export class Host {
  // spawn() devuelve {pid, post(message), onMessage(fn), onExit(fn), kill()}
  constructor(spawn, kind) { this.spawn = spawn; this.kind = kind; this.next = 0; this.pending = new Map() }
  async start(install, options) {
    this.child = this.spawn(); this.options = options; this.install = install
    this.exited = new Promise(resolve => this.child.onExit(code => { this.exitedAt = performance.now(); this.alive = false; for (const p of this.pending.values()) p.reject(new Error('el proceso auxiliar terminó')); resolve(code) }))
    this.alive = true
    this.child.onMessage(message => { const p = this.pending.get(message.id); if (p) { this.pending.delete(message.id); message.ok ? p.resolve(message) : p.reject(new Error(message.error)) } })
    return (await this.send('init', {install, options})).versions
  }
  get pid() { return this.child.pid }
  send(type, payload = {}) { return this.request(type, payload).promise }
  request(type, payload = {}) {
    const id = ++this.next
    const promise = new Promise((resolve, reject) => { this.pending.set(id, {resolve, reject}); this.child.post({id, type, ...payload}) })
    return {id, promise}
  }
  cancel(target) { this.child.post({id: ++this.next, type: 'cancel', target}) }
  rss() { return psRss(this.pid) }
  cpu() { return psCpu(this.pid) }
  isRunning() { return psRss(this.pid).then(rss => rss !== null) }
  // Operación medida: tiempo de pared, CPU (cputime del proceso) y RSS máximo muestreado cada 100 ms.
  async call(operation, args, override) {
    let peak = (await this.rss()) ?? 0, stop = false
    const sampler = (async () => { while (!stop) { peak = Math.max(peak, (await this.rss()) ?? 0); await sleep(100) } })()
    const cpu0 = await this.cpu(), t0 = performance.now()
    try {
      const {value} = await this.send('call', {operation, args, override})
      const ms = performance.now() - t0
      return {value, ms, cpuMs: ((await this.cpu()) - cpu0) * 1000, rssPeakBytes: peak}
    } finally { stop = true; await sampler }
  }
  async kill() {
    const t0 = performance.now(); this.child.kill(); await this.exited
    return performance.now() - t0
  }
  // Reinicio completo del proceso auxiliar (mide el arranque en frío: proceso + carga del módulo nativo + primera instancia).
  async restart() { const t0 = performance.now(); await this.stop(); const versions = await this.start(this.install, this.options); this.lastStartMs = performance.now() - t0; return versions }
  async stop() { if (this.alive) { this.child.kill(); await this.exited } }
}
