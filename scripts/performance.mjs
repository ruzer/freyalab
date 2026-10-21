import { _electron as electron } from '@playwright/test'
import electronPath from 'electron'
import { mkdtemp, open, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir, cpus, totalmem, release } from 'node:os'
import { join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

let commit = 'uncommitted'
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim() } catch {}
const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim())
const buildHashes = Object.fromEntries(await Promise.all(['out/main/index.js','out/main/table-worker.js'].map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])))
const temp = await mkdtemp(join(tmpdir(), 'freyalab-bench-'))
const input = join(temp, 'fifty-mib.csv')
const large = join(temp, 'one-gib.csv')
const handle = await open(input, 'w')
const row = '000124,' + 'Artículo de ejemplo para Freya '.repeat(10) + ',12,Almacén norte\n'
const chunk = row.repeat(1000)
let bytes = await handle.write('Código,Artículo,Existencias,Ubicación\n').then(result => result.bytesWritten)
while (bytes + Buffer.byteLength(chunk) < 50 * 1024 ** 2) bytes += await handle.write(chunk).then(result => result.bytesWritten)
await handle.close()
const largeHandle = await open(large, 'w')
await largeHandle.write('Código,Artículo\n' + '000124,Muestra\n'.repeat(250))
await largeHandle.truncate(1024 ** 3)
await largeHandle.close()
let app
try {
  const started = performance.now()
  const { ELECTRON_RUN_AS_NODE: _unused, ...cleanEnv } = process.env
  app = await electron.launch({ executablePath: electronPath, args: [resolve('out/main/index.js')], env: { ...cleanEnv, FREYALAB_TEST: '1', FREYALAB_USER_DATA: join(temp, 'profile') } })
  const page = await app.firstWindow()
  await page.waitForFunction(() => !!window.freya)
  const startupMs = performance.now() - started
  const result = await page.evaluate(async ({ input, large }) => {
    const gaps = []
    let previous = performance.now()
    const heartbeat = setInterval(() => { const now = performance.now(); gaps.push(now - previous); previous = now }, 25)
    const mark = performance.now()
    const [doc] = await window.freya.openPaths([input])
    const opened = performance.now()
    const query = { search: 'Almacén', offset: 0, limit: 40, requestId: 1 }
    const filtered = await window.freya.tablePage(doc.id, query)
    const filteredAt = performance.now()
    await window.freya.tablePage(doc.id, { ...query, requestId: 2, sort: { column: 2, numeric: true, descending: false } })
    const sortedAt = performance.now()
    const [sample] = await window.freya.openPaths([large])
    const sampleAt = performance.now()
    if (!sample.readonly) throw new Error('A GB file must open only as a read-only sample')
    clearInterval(heartbeat)
    gaps.sort((a,b) => a-b)
    return { heartbeatP95Ms: gaps[Math.floor(gaps.length * .95)] ?? null, heartbeatMaxMs: gaps.at(-1) ?? null, openCsvMs: opened - mark, filterMs: filteredAt - opened, sortMs: sortedAt - filteredAt, sampleGiBMs: sampleAt - sortedAt, matched: filtered.matched, sampleReadonly: sample.readonly }
  }, { input, large })
  const metrics = await app.evaluate(({ app }) => app.getAppMetrics())
  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/performance.json', JSON.stringify({ commit, dirty, buildHashes, platform: process.platform, arch: process.arch, os: release(), cpu: cpus()[0]?.model, memoryBytes: totalmem(), node: process.version, csvBytes: bytes, startupMs, ...result, metrics, measuredAt: new Date().toISOString(), note: 'One local observation; not a universal speed guarantee. GB access covers only a bounded sample.' }, null, 2))
  console.log(JSON.stringify({ startupMs, csvBytes: bytes, ...result }, null, 2))
} finally { await app?.close(); await rm(temp, { recursive: true, force: true }) }
