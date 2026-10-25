// M2 · Escenarios de cancelación, liberación de recursos, derrame a disco y recuperación tras matar el proceso auxiliar.
import {readdirSync, statSync, existsSync, rmSync, mkdirSync} from 'node:fs'
import {join} from 'node:path'
import {HEADER} from './battery.mjs'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const dirBytes = dir => { let total = 0; try { for (const entry of readdirSync(dir, {withFileTypes: true})) { const p = join(dir, entry.name); total += entry.isDirectory() ? dirBytes(p) : statSync(p).size } } catch {} return total }
const entries = dir => { try { return readdirSync(dir).length } catch { return 0 } }
const COL = Object.fromEntries(HEADER.map((n, i) => [n, i]))

export async function cancelScenario(host, {source, workDir, tempDir, repetitions = 5, delay = 300}) {
  const src = {path: source, columns: HEADER, delimiter: ',', encoding: 'utf-8'}
  const out = []
  const before = await host.rss()
  for (let i = 0; i < repetitions; i++) {
    const output = join(workDir, `cancelada-${i}.csv`)
    const job = host.request('call', {operation: 'sort_to_file', args: {source: src, keys: [{col: COL.fecha_pedido}], output}})
    await sleep(delay)
    const t0 = performance.now(); host.cancel(job.id)
    let cancelled = true
    try { await job.promise; cancelled = false } catch (error) { var message = String(error.message).split('\n')[0] }
    const latency = performance.now() - t0
    await sleep(200)
    out.push({repetition: i, cancelled, latencyMs: latency, message: cancelled ? message : null, partialOutputExists: existsSync(output), tempEntriesLeft: entries(tempDir), tempBytesLeft: dirBytes(tempDir), rssAfterBytes: await host.rss()})
  }
  // ¿el motor sigue sirviendo tras cancelar?
  const check = await host.call('count', {source: src})
  return {rssBeforeBytes: before, rounds: out, serves_after_cancel: check.value.rows[0].n > 0}
}

export async function leakScenario(host, {source, workDir, rounds = 40}) {
  const src = {path: source, columns: HEADER, delimiter: ',', encoding: 'utf-8'}
  const samples = [{after: 0, rssBytes: await host.rss()}]
  for (let i = 1; i <= rounds; i++) {
    await host.call(i % 4 === 0 ? 'filter_extract' : 'count', i % 4 === 0 ? {source: src, columns: [0, 4], conditions: [{col: COL.ciudad, op: 'eq', value: 'Oaxaca'}], output: join(workDir, `fuga-${i}.csv`)} : {source: src})
    if (i === 1 || i === 5 || i % 10 === 0) samples.push({after: i, rssBytes: await host.rss()})
  }
  return {rounds, samples}
}

export async function killScenario(host, {source, workDir, tempDir, install, options}) {
  const src = {path: source, columns: HEADER, delimiter: ',', encoding: 'utf-8'}
  const output = join(workDir, 'matada.csv')
  const pid = host.pid
  const job = host.request('call', {operation: 'sort_to_file', args: {source: src, keys: [{col: COL.fecha_pedido}], output}})
  job.promise.catch(() => {})
  await sleep(400)
  const exitMs = await host.kill()
  await sleep(200)
  const result = {pid, exitMs, processGone: !(await host.isRunning()), partialOutputBytes: existsSync(output) ? statSync(output).size : 0, tempEntriesLeft: entries(tempDir), tempBytesLeft: dirBytes(tempDir)}
  // Quien lanza el proceso limpia lo que el proceso muerto no pudo limpiar, y relanza el motor.
  rmSync(output, {force: true}); rmSync(tempDir, {recursive: true, force: true}); mkdirSync(tempDir, {recursive: true})
  const versions = await host.start(install, options)
  const check = await host.call('count', {source: src})
  return {...result, cleanedByLauncher: !existsSync(output) && entries(tempDir) === 0, restarted: Boolean(versions.duckdb), servesAfterRestart: check.value.rows[0].n > 0, newPid: host.pid}
}

export async function startupScenario(host, {source, repetitions = 5}) {
  const src = {path: source, columns: HEADER, delimiter: ',', encoding: 'utf-8'}
  const rounds = []
  for (let i = 0; i < repetitions; i++) {
    await host.restart()
    const first = await host.call('count', {source: src})
    const second = await host.call('count', {source: src})
    rounds.push({startMs: host.lastStartMs, firstCountMs: first.ms, secondCountMs: second.ms, rssAfterBytes: await host.rss()})
  }
  return {rounds}
}

export async function spillScenario(host, {source, workDir, tempDir, memoryLimit = '1GB', threads = 4}) {
  const src = {path: source, columns: HEADER, delimiter: ',', encoding: 'utf-8'}
  const output = join(workDir, `derrame-${memoryLimit}.csv`)
  await host.restart() // proceso nuevo: el RSS de una operación anterior no contamina la medida
  let tempPeak = 0, stop = false
  const sampler = (async () => { while (!stop) { tempPeak = Math.max(tempPeak, dirBytes(tempDir)); await sleep(100) } })()
  let measured, failure
  try { measured = await host.call('sort_to_file', {source: src, keys: [{col: COL.fecha_pedido}], output}, {memoryLimit, threads}) } catch (error) { failure = String(error.message).split('\n')[0] }
  stop = true; await sampler
  return {memoryLimit, threads, ok: Boolean(measured), failure, ms: measured?.ms, rssPeakBytes: measured?.rssPeakBytes, cpuMs: measured?.cpuMs, tempPeakBytes: tempPeak, tempLeftBytes: dirBytes(tempDir), output}
}
