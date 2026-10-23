// Cola de consultas con prioridades, cancelación por solicitud, reutilización de resultados y un límite de concurrencia.
// El «motor» es inyectable: en producción sería la ventana oculta de DuckDB-Wasm que ya usa SqlService (una por trabajo).
// Invariante que se comprueba: nunca hay más motores vivos que `concurrency`, y liberar uno no depende de que el motor responda.
import { CodedError } from './contract.mjs'
const rank = { interactive: 0, export: 1, background: 2 }
export class JobQueue {
  constructor({ engine, concurrency = 1, cacheSize = 16, timeoutMs = 0 }) {
    Object.assign(this, { engine, concurrency, cacheSize, timeoutMs, queue: [], running: new Set(), cache: new Map(), byKey: new Map(), seq: 0 })
    this.stats = { started: 0, completed: 0, cancelledQueued: 0, cancelledRunning: 0, timeouts: 0, cacheHits: 0, shared: 0, engines: 0, maxEngines: 0, order: [] }
  }
  submit(sub, notify = () => {}) {
    const hit = this.cache.get(sub.key)
    if (hit) { this.stats.cacheHits++; return Promise.resolve({ ...hit.result, fromCache: true, shared: false }) }
    return new Promise((resolve, reject) => {
      let job = this.byKey.get(sub.key)
      if (job) this.stats.shared++
      else { job = { key: sub.key, docId: sub.docId, revision: sub.revision, priority: sub.priority, spec: sub.spec, subs: new Map(), state: 'queued', n: ++this.seq }; this.byKey.set(sub.key, job); this.queue.push(job) }
      // Una solicitud compartida hereda la mayor prioridad entre sus suscriptores.
      if (rank[sub.priority] < rank[job.priority]) job.priority = sub.priority
      job.subs.set(sub.requestId, { resolve, reject, windowId: sub.windowId, notify })
      notify({ phase: job.state === 'running' ? 'running' : 'queued', position: this.queue.indexOf(job) })
      this.pump()
    })
  }
  pump() {
    while (this.running.size < this.concurrency && this.queue.length) {
      this.queue.sort((a, b) => rank[a.priority] - rank[b.priority] || a.n - b.n)
      const job = this.queue.shift(); this.running.add(job); void this.start(job)
    }
  }
  async start(job) {
    job.state = 'running'; this.stats.started++; this.stats.order.push(job.spec.label ?? job.key); this.stats.engines++; this.stats.maxEngines = Math.max(this.stats.maxEngines, this.stats.engines)
    for (const sub of job.subs.values()) sub.notify({ phase: 'running' })
    const timer = this.timeoutMs ? setTimeout(() => { this.stats.timeouts++; this.cancelJob(job, 'E_TIMEOUT', 'La consulta superó el tiempo límite.') }, this.timeoutMs) : undefined
    try {
      job.handle = this.engine.create() // síncrono a propósito: el motor queda registrado antes de esperar nada y siempre se puede destruir
      const result = await this.engine.run(job.handle, job.spec)
      if (job.aborted) return
      this.stats.completed++; this.remember(job, result)
      let first = true
      for (const sub of job.subs.values()) { sub.resolve({ ...result, fromCache: false, shared: !first }); first = false }
      job.subs.clear()
    } catch (error) {
      if (!job.aborted) for (const sub of job.subs.values()) sub.reject(error instanceof CodedError ? error : new CodedError('E_INTERNAL', String(error.message ?? error)))
      job.subs.clear()
    } finally {
      clearTimeout(timer); this.dispose(job); this.release(job)
    }
  }
  dispose(job) { if (job.handle !== undefined && !job.disposed) { job.disposed = true; try { this.engine.destroy(job.handle) } catch {} } }
  release(job) {
    if (job.released) return
    job.released = true; this.stats.engines--; this.running.delete(job)
    if (this.byKey.get(job.key) === job) this.byKey.delete(job.key)
    this.pump()
  }
  remember(job, result) { this.cache.set(job.key, { docId: job.docId, revision: job.revision, result }); while (this.cache.size > this.cacheSize) this.cache.delete(this.cache.keys().next().value) }
  // Cancela una solicitud. El trabajo solo se aborta si ya no le queda ningún suscriptor.
  cancel(requestId, code = 'E_CANCELLED', message = 'Solicitud cancelada.') {
    for (const job of [...this.queue, ...this.running]) {
      const sub = job.subs.get(requestId); if (!sub) continue
      job.subs.delete(requestId); sub.reject(new CodedError(code, message))
      if (job.subs.size === 0) this.abort(job)
      return true
    }
    return false
  }
  cancelWhere(predicate, code, message) { let n = 0; for (const job of [...this.queue, ...this.running]) for (const [id, sub] of [...job.subs]) if (predicate(sub, job)) { this.cancel(id, code, message); n++ } return n }
  cancelJob(job, code, message) { for (const sub of job.subs.values()) sub.reject(new CodedError(code, message)); job.subs.clear(); this.abort(job) }
  abort(job) {
    if (job.aborted) return
    job.aborted = true
    if (job.state === 'queued') { this.queue = this.queue.filter(item => item !== job); if (this.byKey.get(job.key) === job) this.byKey.delete(job.key); this.stats.cancelledQueued++; return }
    this.stats.cancelledRunning++
    this.dispose(job); this.release(job) // sin esperar a que el motor responda ni a que termine de cargar
  }
  invalidate(docId) { for (const [key, entry] of this.cache) if (entry.docId === docId) this.cache.delete(key) }
}
