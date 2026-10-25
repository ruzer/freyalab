// M3 · Reúne los JSON de los artefactos de la CI (m3-isolation-<so>/m3out/*.json) en tablas Markdown para la evidencia.
//   node ci/aggregate.mjs <carpeta con los artefactos descargados>
import {readdirSync, readFileSync, existsSync} from 'node:fs'
import {join, resolve} from 'node:path'
const root = resolve(process.argv[2])
const OS = ['macos-15', 'macos-15-intel', 'ubuntu-24.04', 'windows-2025']
const label = {'macos-15': 'macOS ARM', 'macos-15-intel': 'macOS Intel', 'ubuntu-24.04': 'Linux x64', 'windows-2025': 'Windows x64'}
const load = (os, name) => { const p = join(root, `m3-isolation-${os}`, 'm3out', name); try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null } }
const out = []
const table = (title, head, rows) => out.push(`\n#### ${title}\n`, `| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`))
const n = v => (v === undefined || v === null ? '—' : v)

// 1 · Aislamiento
const runs = [['isolation-node.json', 'un disparo · Node'], ['isolation-electron.json', 'un disparo · Electron como Node'], ['integration-node.json', 'persistente · padre Node, hijo Node'], ['integration-electron-child.json', 'persistente · padre Node, hijo Electron'], ['integration-electron-main.json', 'persistente · padre Electron'], ['integration-packaged.json', 'persistente · aplicación EMPAQUETADA']]
table('Aislamiento: lo que el proceso con DuckDB todavía puede hacer fuera de su carpeta', ['Plataforma', 'Configuración', 'Resultado'], OS.flatMap(os => runs.map(([file, name]) => {
  const d = load(os, file); if (!d) return [label[os], name, 'sin resultado']
  const v = d.confined?.verdict ?? d.verdict
  if (!v) return [label[os], name, `FALLA: ${String(d.error ?? d.confined?.error ?? 'sin veredicto').split('\n')[0].slice(0, 110)}`]
  const allowed = v.allowed ?? v.confinedStillAllowed ?? [], denied = v.denied ?? v.confinedDenied ?? []
  return [label[os], name, allowed.length ? `**puede: ${allowed.join('; ')}**` : `deniega ${denied.length}/${denied.length}`]
})))

// 2 · utilityProcess
table('`utilityProcess` de Electron (control sin capa)', ['Plataforma', 'Lo que puede hacer'], OS.map(os => {
  const d = load(os, 'integration-electron-main.json') ?? load(os, 'integration-packaged.json'); const v = d?.utilityProcessControl?.verdict
  return [label[os], v ? `${v.allowed.length} de ${v.allowed.length + v.denied.length}: ${v.allowed.join('; ') || 'ninguna'}` : n(d?.utilityProcessControl?.error ?? 'sin resultado')]
}))

// 3 · Arranque y sobrecoste
table('Arranque en frío y sobrecoste de la capa (autocomprobación de M2, sin la batería de seguridad)', ['Plataforma', 'Configuración', 'Arranque sin capa', 'Arranque con capa', 'Autocomprobación sin capa', 'con capa'], OS.flatMap(os => runs.slice(2).map(([file, name]) => {
  const d = load(os, file); return [label[os], name, n(d?.coldStart?.sinCapaMs) + ' ms', n(d?.coldStart?.conCapaMs) + ' ms', n(d?.overhead?.selftestSinCapaMs) + ' ms', n(d?.overhead?.selftestConCapaMs) + ' ms']
})))

// 4 · Matar y memoria
table('Matar a mitad de operación y memoria (padre Node, hijo Node)', ['Plataforma', 'Matar', 'Latido detenido', 'Relanzado', 'Salida parcial', 'RSS base → máximo (40 operaciones)', 'Operación pesada: antes → después → tras reiniciar'], OS.map(os => {
  const d = load(os, 'integration-node.json'); const k = d?.kill, r = d?.recycle
  return [label[os], k ? `${k.killMs} ms` : '—', n(k?.heartbeatStoppedAfterKill), k ? `${k.replacementStartMs} ms` : '—', k ? `${k.outputLeft} bytes` : '—', r ? `${r.baselineRssMB} → ${r.maxRssMB} MB` : '—', r?.heavy ? `${r.heavy.rssBeforeMB} → ${r.heavy.rssAfterMB} → ${r.heavy.rssAfterRestartMB} MB (reinicio ${r.heavy.restartMs} ms)` : '—']
}))

// 5 · Tope de memoria (Windows)
const win = load('windows-2025', 'isolation-node.json')
if (win?.memoryCap) out.push('\n#### Tope de memoria de 1 GiB impuesto desde fuera (objeto de trabajo, Windows)\n', '```json', JSON.stringify(win.memoryCap, null, 1).slice(0, 1500), '```')

// 6 · Lanzador de Windows
const lw = load('windows-2025', 'integration-node.json')?.windowsLauncher
if (lw) out.push('\n#### Lanzador de Windows (concesiones)\n', `SID del AppContainer: \`${lw.sid}\``, '', ...(lw.grants ?? []).slice(0, 14).map(g => `- ${g}`))

// 7 · Esquema y lector paralelo
table('Esquema explícito y lector de DuckDB frente al analizador estricto (26 casos hostiles)', ['Plataforma', 'DuckDB', 'Coincide', 'DuckDB rechaza', 'Ambos rechazan', 'Acepta lo que el analizador rechaza', 'Distinto', 'Estrés de trozos'], OS.map(os => {
  const d = load(os, 'schema-parallel.json'); if (!d) return [label[os], 'sin resultado', '', '', '', '', '', '']
  const t = {}; for (const c of d.casos) { const v = c.paralelo.veredicto; t[v] = (t[v] ?? 0) + 1 }
  return [label[os], d.duckdb, n(t.coincide), n(t['duckdb-rechaza']), n(t['ambos-rechazan']), n(t['DUCKDB-ACEPTA-LO-QUE-EL-ANALIZADOR-RECHAZA']), n(t.DISTINTO), d.estres.lecturas.every(l => l.coincide) ? 'idéntico en las 5 configuraciones' : 'DIFIERE']
}))

// 8 · Firma y fusibles
const variants = new Set(); for (const os of OS) for (const v of load(os, 'signing.json')?.variantes ?? []) variants.add(v.variante)
table('Firma, runtime reforzado y fusible `RunAsNode`: ¿carga DuckDB y arranca el hijo confinado?', ['Variante', ...OS.map(os => label[os])], [...variants].map(name => [name, ...OS.map(os => { const v = load(os, 'signing.json')?.variantes?.find(x => x.variante === name); return v ? (v.cargaElMotor ? `sí (${v.autocomprobacion})` : `**no**: ${String(v.error ?? (v.expirado ? 'sin respuesta' : '')).replace(/\|/g, '/').slice(0, 70)}`) : '—' })]))
const inv = OS.map(os => { const d = load(os, 'signing.json')?.inventario; return [label[os], d ? String(d.binarios) : '—', d ? Object.entries(d.porEstado).map(([k, v]) => `${k} ×${v}`).join(' · ') : '—'] })
table('Inventario de binarios nativos del paquete', ['Plataforma', 'Binarios', 'Estado de firma'], inv)

// 9 · Instaladores
table('Instaladores de la mini-aplicación', ['Plataforma', 'Formato', 'Tamaño', 'Instalación', 'Ejecución instalada'], OS.flatMap(os => (load(os, 'installers.json')?.formatos ?? [{formato: '—', error: 'sin resultado'}]).map(f => [label[os], f.formato, f.bytes ? `${Math.round(f.bytes / 1048576)} MiB` : '—', f.instalacion ?? f.error ?? '—', f.ejecucion ? (f.ejecucion.carga ? `DuckDB ${f.ejecucion.duckdb}; hijo ${f.ejecucion.hijoConfinado}; ${f.ejecucion.autocomprobacion}` : '**no carga**: ' + String(f.ejecucion.error).slice(0, 80)) : '—'])))
if (existsSync(join(root, 'm3-isolation-ubuntu-24.04', 'm3out', 'bwrap-default.json.txt'))) out.push('\n#### bubblewrap en Ubuntu 24.04 sin ajustar\n', '`' + readFileSync(join(root, 'm3-isolation-ubuntu-24.04', 'm3out', 'bwrap-default.json.txt'), 'utf8').trim() + '`')
console.log(out.join('\n'))
