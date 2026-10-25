// M3 · Proceso auxiliar con protocolo por líneas JSON (stdin → mensajes, stdout → respuestas). Es el MISMO núcleo que el hijo de Node y el utilityProcess de M2
// (duckdb-native/lib/worker-core.mjs), más lo que hace falta para evaluar la capa: `probe` (qué puede hacer el proceso fuera de su carpeta),
// `info` (memoria y CPU propias) y un latido en disco (M3_HEARTBEAT) para comprobar que el proceso de verdad murió.
import {createInterface} from 'node:readline'
import {writeFileSync} from 'node:fs'
import {attach} from '../duckdb-native/lib/worker-core.mjs'
import {loadDuckDB} from '../duckdb-native/lib/engine.mjs'
import {probe} from './lib/probes.mjs'
// JSON no representa BigInt ni arrays tipados (la IPC de Node y de Electron sí): se convierten a número y a lista. Un producto real no enviaría posiciones por mensaje, las escribiría a un archivo.
const plain = (key, value) => (typeof value === 'bigint' ? Number(value) : ArrayBuffer.isView(value) && !(value instanceof DataView) ? Array.from(value, x => (typeof x === 'bigint' ? Number(x) : x)) : value)
const out = message => process.stdout.write(JSON.stringify(message, plain) + '\n')
const listeners = []
attach({on: (event, fn) => { if (event === 'message') listeners.push(fn) }, postMessage: out})
if (process.env.M3_HEARTBEAT) setInterval(() => { try { writeFileSync(process.env.M3_HEARTBEAT, String(Date.now())) } catch {} }, 100)
const lines = createInterface({input: process.stdin})
lines.on('line', async line => {
  let message; try { message = JSON.parse(line) } catch { return }
  if (message.type === 'exit') process.exit(0)
  if (message.type === 'info') { const m = process.memoryUsage(); out({id: message.id, ok: true, rss: m.rss, external: m.external, heapUsed: m.heapUsed, cpu: process.cpuUsage(), pid: process.pid}); return }
  if (message.type === 'probe') {
    try { out({id: message.id, ok: true, results: await probe({duck: loadDuckDB(message.install), ...message.args})}) } catch (error) { out({id: message.id, ok: false, error: String(error.message)}) }
    return
  }
  for (const fn of listeners) fn({data: message})
})
lines.on('close', () => process.exit(0))
