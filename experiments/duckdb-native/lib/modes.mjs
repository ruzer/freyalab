// M2 · Orquesta los modos de prueba sobre un Host (hijo de Node o utilityProcess). Compartido por run-host.mjs y electron/main.mjs.
import {readFileSync, mkdirSync, statSync, readdirSync} from 'node:fs'
import {join, resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {battery} from './battery.mjs'
import {selftest} from './selftest.mjs'
import {cancelScenario, leakScenario, killScenario, spillScenario, startupScenario} from './scenarios.mjs'
const here = dirname(fileURLToPath(import.meta.url))

export function settings(args) {
  const workDir = resolve(args.work), tempDir = join(workDir, 'tmp')
  mkdirSync(tempDir, {recursive: true})
  return {workDir, tempDir, modes: (args.modes ?? 'battery').split(','), install: resolve(args.install),
    big: args.big ?? '/private/tmp/FreyaLab-pruebas/ventas_1GiB.csv', small: args.small ?? '/private/tmp/FreyaLab-pruebas/ventas_100MiB.csv',
    fresh: args.fresh === 'true', options: {workDir, tempDir, threads: Number(args.threads ?? 12), memoryLimit: args.memory ?? '4GB', parallel: true}, spill: (args.spill ?? '4GB,1GB,512MB').split(',')}
}

export async function runModes(host, s, label) {
  const report = {}
  report.versions = await host.start(s.install, s.options)
  if (s.modes.includes('selftest')) report.selftest = await selftest(host, s)
  if (s.modes.includes('battery')) { const oracle = JSON.parse(readFileSync(join(here, '../../large-data-extracts/results/m1-ventas.json'), 'utf8')); const client = s.fresh ? {call: async (...a) => { await host.restart(); return host.call(...a) }} : host; report.battery = await battery(client, {files: [s.small, s.big].map(path => ({name: path.split('/').pop(), path})), workDir: s.workDir, oracle, label}) }
  if (s.modes.includes('startup')) report.startup = await startupScenario(host, {source: s.small})
  if (s.modes.includes('security')) { const r = await host.send('security', {root: join(s.workDir, 'seguridad')}); report.security = {locked: r.locked, closed: r.closed} }
  if (s.modes.includes('cancel')) report.cancel = await cancelScenario(host, {source: s.big, workDir: s.workDir, tempDir: s.tempDir})
  if (s.modes.includes('leak')) report.leak = await leakScenario(host, {source: s.small, workDir: s.workDir})
  if (s.modes.includes('spill')) { report.spill = []; for (const memoryLimit of s.spill) report.spill.push(await spillScenario(host, {source: s.big, workDir: s.workDir, tempDir: s.tempDir, memoryLimit})) }
  if (s.modes.includes('kill')) report.kill = await killScenario(host, {source: s.big, workDir: s.workDir, tempDir: s.tempDir, install: s.install, options: s.options})
  return report
}
