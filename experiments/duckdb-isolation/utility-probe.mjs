// M3 · Se ejecuta DENTRO de un utilityProcess de Electron: comprueba qué puede hacer sin ninguna capa del sistema operativo.
import {loadDuckDB} from '../duckdb-native/lib/engine.mjs'
import {probe} from './lib/probes.mjs'
process.parentPort.once('message', async ({data}) => {
  try { process.parentPort.postMessage({ok: true, results: await probe({duck: loadDuckDB(data.install), ...data.args})}) } catch (error) { process.parentPort.postMessage({ok: false, error: String(error.message)}) }
})
