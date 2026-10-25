// M2 · Lógica del proceso auxiliar, común al hijo de Node y al utilityProcess de Electron. `port` ofrece on('message', ({data})) y postMessage.
import {loadDuckDB, run} from './engine.mjs'
import {lockedInstanceAttempts, closedOperationAttempts} from './security.mjs'

export function attach(port) {
  let duck, options
  const jobs = new Map()
  port.on('message', async ({data: message}) => {
    const {id, type} = message
    const reply = payload => port.postMessage({id, ...payload})
    try {
      if (type === 'init') {
        duck = loadDuckDB(message.install); options = message.options
        const version = (await (await (await duck.DuckDBInstance.create(':memory:')).connect()).runAndReadAll('select version() v')).getRows()[0][0]
        reply({ok: true, versions: {duckdb: version, node: process.versions.node, electron: process.versions.electron ?? null, napi: process.versions.napi, modules: process.versions.modules}})
      } else if (type === 'call') {
        const job = run(duck, message.operation, message.args, {...options, ...message.override})
        jobs.set(id, job)
        const value = await job.result
        reply({ok: true, value})
      } else if (type === 'cancel') {
        jobs.get(message.target)?.cancel()
      } else if (type === 'rss') {
        reply({ok: true, rss: process.memoryUsage().rss})
      } else if (type === 'security') {
        reply({ok: true, locked: await lockedInstanceAttempts(duck, message.root), closed: await closedOperationAttempts(duck, message.root)})
      } else reply({ok: false, error: 'tipo de mensaje no permitido'})
    } catch (error) {
      reply({ok: false, error: String(error.message)})
    } finally { jobs.delete(id) }
  })
}
