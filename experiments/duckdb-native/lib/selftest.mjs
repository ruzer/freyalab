// M2 · Autocomprobación portátil: genera un CSV de ~10 MiB con fixtures hostiles (campos multilínea, comillas), ejecuta las operaciones cerradas
// en el proceso auxiliar y compara con valores esperados calculados al generar. Sirve en Node, en Electron sin empaquetar y en la aplicación
// EMPAQUETADA (CI de las cuatro plataformas). La validación contra el oráculo de Python y el índice de FreyaLab es local (battery.mjs, integrity.mjs).
import {writeFileSync, mkdirSync, statSync, existsSync} from 'node:fs'
import {join} from 'node:path'
import {HEADER} from './battery.mjs'

const CITIES = ['Oaxaca', 'Puebla', 'Mérida', 'Guadalajara'], STATES = ['entregado', 'pendiente', 'cancelado']
const NOTES = ['', 'Entrega en recepción', 'Paquete con accesorios, revisar', 'Cliente solicita "factura"', 'Primera línea\nSegunda línea']
const COL = Object.fromEntries(HEADER.map((n, i) => [n, i]))
const quote = value => (/[",\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value)

export function makeFixture(path, rows = 45000) {
  let seed = 20261025
  const next = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n }
  const expected = {rows, oaxacaEntregado: 0, primera: 0, groups: new Map(), merida: 0}
  const lines = [HEADER.join(',')]
  for (let i = 1; i <= rows; i++) {
    const record = HEADER.map(() => '')
    const city = CITIES[next(4)], state = STATES[next(3)], note = NOTES[next(5)], cents = 100 + next(2000000)
    record[COL.venta_id] = `V-${String(i).padStart(12, '0')}`; record[COL.ciudad] = city; record[COL.estado] = state; record[COL.notas] = note
    record[COL.producto] = `Producto ${next(50)}`; record[COL.total_mxn] = `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
    record[COL.fecha_pedido] = `2025-${String(1 + next(12)).padStart(2, '0')}-${String(1 + next(28)).padStart(2, '0')}`; record[COL.codigo_postal] = String(1000 + next(90000)).padStart(5, '0')
    lines.push(record.map(quote).join(','))
    if (city === 'Oaxaca' && state === 'entregado') expected.oaxacaEntregado++
    if (note.includes('Primera línea')) expected.primera++
    if (city === 'Mérida') expected.merida++
    const group = expected.groups.get(city) ?? {n: 0, cents: 0n}; group.n++; group.cents += BigInt(cents); expected.groups.set(city, group)
  }
  writeFileSync(path, lines.join('\r\n') + '\r\n')
  return expected
}

export async function selftest(host, s) {
  mkdirSync(s.workDir, {recursive: true})
  const path = join(s.workDir, 'selftest-ventas.csv'), expected = makeFixture(path)
  const source = {path, columns: HEADER, delimiter: ',', encoding: 'utf-8'}
  const out = name => join(s.workDir, `selftest-${name}.csv`)
  const checks = []
  const check = async (name, fn) => { const t0 = performance.now(); try { const detail = await fn(); checks.push({name, ok: true, ms: performance.now() - t0, detail}) } catch (error) { checks.push({name, ok: false, ms: performance.now() - t0, error: String(error.message).split('\n')[0]}) } }
  const is = (got, want, label) => { if (got !== want) throw new Error(`${label}: ${got} ≠ ${want}`); return got }
  const call = async (op, args) => (await host.call(op, args)).value
  await check('count', async () => is((await call('count', {source})).rows[0].n, expected.rows, 'registros'))
  await check('filter_count', async () => is((await call('filter_count', {source, conditions: [{col: COL.ciudad, op: 'eq', value: 'Oaxaca'}, {col: COL.estado, op: 'eq', value: 'entregado'}]})).rows[0].n, expected.oaxacaEntregado, 'Oaxaca y entregado'))
  await check('search_count (campo multilínea)', async () => is((await call('search_count', {source, value: 'Primera línea'})).rows[0].n, expected.primera, 'con «Primera línea»'))
  await check('aggregate (suma exacta en céntimos)', async () => {
    const rows = (await call('aggregate', {source, groupBy: [COL.ciudad], sumColumn: COL.total_mxn})).rows
    for (const r of rows) { const e = expected.groups.get(r['k' + COL.ciudad]); is(r.n, e.n, r['k' + COL.ciudad]); is(String(BigInt(r.sum.replace('.', ''))), String(e.cents), 'suma ' + r['k' + COL.ciudad]) }
    return rows.length
  })
  await check('filter_extract', async () => {
    const v = await call('filter_extract', {source, conditions: [{col: COL.ciudad, op: 'eq', value: 'Oaxaca'}, {col: COL.estado, op: 'eq', value: 'entregado'}], columns: [COL.venta_id, COL.ciudad, COL.total_mxn], output: out('extracto')})
    is(v.rows, expected.oaxacaEntregado, 'filas extraídas')
    const again = await call('count', {source: {path: v.output, columns: ['venta_id', 'ciudad', 'total_mxn'], delimiter: ',', encoding: 'utf-8'}})
    return is(again.rows[0].n, expected.oaxacaEntregado, 'recuento del extracto')
  })
  await check('replace_literal_to_file', async () => {
    const v = await call('replace_literal_to_file', {source, col: COL.ciudad, find: 'Mérida', replace: 'Merida', output: out('reemplazo')})
    is(v.rows, expected.rows, 'filas')
    const left = await call('filter_count', {source: {...source, path: v.output}, conditions: [{col: COL.ciudad, op: 'eq', value: 'Mérida'}]})
    const now = await call('filter_count', {source: {...source, path: v.output}, conditions: [{col: COL.ciudad, op: 'eq', value: 'Merida'}]})
    is(left.rows[0].n, 0, 'Mérida restantes'); return is(now.rows[0].n, expected.merida, 'Merida nuevas')
  })
  await check('sort_to_file', async () => { const v = await call('sort_to_file', {source, keys: [{col: COL.fecha_pedido}], output: out('orden')}); return is(v.rows, expected.rows, 'filas') })
  await check('positions', async () => is((await call('positions', {source, conditions: [{col: COL.ciudad, op: 'eq', value: 'Oaxaca'}]})).positions.length, expected.groups.get('Oaxaca').n, 'posiciones'))
  await check('el original no cambió de tamaño', async () => statSync(path).size > 0)
  await check('aislamiento y operaciones cerradas dentro del proceso auxiliar', async () => {
    const r = await host.send('security', {root: join(s.workDir, 'seguridad')})
    const bad = [...r.locked, ...r.closed].filter(item => !item.ok)
    if (bad.length) throw new Error('fallan: ' + bad.map(b => b.name).join('; '))
    return {locked: r.locked.length, closed: r.closed.length, interruptMs: r.locked.find(x => x.latencyMs !== undefined)?.latencyMs}
  })
  await check('matar el proceso auxiliar a mitad de operación y relanzarlo', async () => {
    const job = host.request('call', {operation: 'sort_to_file', args: {source, keys: [{col: COL.fecha_pedido}], output: out('matada')}}); job.promise.catch(() => {})
    const exitMs = await host.kill()
    await host.start(s.install, s.options)
    const v = await call('count', {source})
    is(v.rows[0].n, expected.rows, 'recuento tras relanzar')
    return {exitMs, partialLeft: existsSync(out('matada'))}
  })
  return {rows: expected.rows, bytes: statSync(path).size, checks, allOk: checks.every(c => c.ok)}
}
