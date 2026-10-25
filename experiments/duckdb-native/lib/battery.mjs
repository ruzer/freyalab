// M2 · Batería funcional y de rendimiento. La ejecutan igual el runner de Node y el de Electron: solo cambia `client`.
//   client.call(operation, args) → {value, ms, cpuMs, rssPeakBytes}
// Las respuestas se comparan con el oráculo de Python guardado en experiments/large-data-extracts/results/m1-ventas.json (recuentos y sumas
// exactas); los archivos de salida los verifica después verify_outputs.py con los mismos hashes del oráculo.
import {join} from 'node:path'

export const HEADER = 'venta_id,cliente_id,cliente,correo,ciudad,codigo_postal,producto_id,producto,categoria,cantidad,precio_unitario_mxn,descuento_pct,subtotal_mxn,descuento_mxn,iva_mxn,total_mxn,fecha_pedido,fecha_envio,fecha_entrega,estado,notas'.split(',')
const COL = Object.fromEntries(HEADER.map((name, i) => [name, i]))
const WHERE = [{col: COL.ciudad, op: 'eq', value: 'Oaxaca'}, {col: COL.estado, op: 'eq', value: 'entregado'}]
const centsOf = decimal => String(BigInt(decimal.replace('.', '')))

export function expectations(oracle, file) {
  const byTask = Object.fromEntries(oracle.results.filter(r => r.engine === 'python' && r.file === file).map(r => [r.task, r]))
  return byTask
}

export async function battery(client, {files, workDir, oracle, label}) {
  const results = []
  for (const {name, path} of files) {
    const expected = expectations(oracle, name)
    const source = {path, columns: HEADER, delimiter: ',', encoding: 'utf-8'}
    const out = suffix => join(workDir, `${name}-${label}-${suffix}.csv`)
    const steps = [
      ['T1', 'count', {source}, v => v.rows[0].n === expected.T1.result.count],
      ['T2', 'filter_count', {source, conditions: WHERE}, v => v.rows[0].n === expected.T2.result.count],
      ['T3', 'filter_extract', {source, conditions: WHERE, columns: [COL.venta_id, COL.ciudad, COL.producto, COL.total_mxn], output: out('t3')}, v => v.rows === expected.T3.result.count],
      ['T4', 'aggregate', {source, groupBy: [COL.ciudad], sumColumn: COL.total_mxn}, v => JSON.stringify(v.rows.map(r => [r['k' + COL.ciudad], r.n, centsOf(r.sum)])) === JSON.stringify(expected.T4.result.groups.map(g => [g.ciudad, g.count, g.sum_cents]))],
      ['T5', 'replace_literal_to_file', {source, col: COL.ciudad, find: 'Mérida', replace: 'Merida', output: out('t5')}, v => v.rows === expected.T5.result.count],
      ['T6', 'search_count', {source, value: 'Primera línea'}, v => v.rows[0].n === expected.T6.result.count],
      ['sort', 'sort_to_file', {source, keys: [{col: COL.fecha_pedido, desc: false}], output: out('sort')}, v => v.rows === expected.T1.result.count],
      ['positions', 'positions', {source, conditions: WHERE}, v => v.positions.length === expected.T2.result.count]
    ]
    for (const [task, operation, args, check] of steps) {
      const entry = {file: name, task, operation, label}
      try {
        const {value, ms, cpuMs, rssPeakBytes} = await client.call(operation, args)
        Object.assign(entry, {ms, cpuMs, rssPeakBytes, ok: Boolean(check(value)), output: value.output})
        if (value.positions) entry.positions = value.positions.length
      } catch (error) { Object.assign(entry, {ok: false, error: String(error.message).split('\n')[0]}) }
      results.push(entry)
      console.log(`${label} ${name} ${task} ${operation}: ${entry.ms?.toFixed(0)} ms ${entry.ok ? 'coincide' : 'DISCREPA ' + (entry.error ?? '')}`)
    }
  }
  return results
}
