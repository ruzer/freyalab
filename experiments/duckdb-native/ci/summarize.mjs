// Resume en Markdown los JSON de la CI (autocomprobaciones, capa del sistema operativo, tamaños) para el resumen del trabajo.
import {readdirSync, readFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
const dir = resolve(process.argv[2])
const out = [`### ${process.platform} ${process.arch}`, '']
for (const name of readdirSync(dir).filter(n => n.endsWith('.json')).sort()) {
  const j = JSON.parse(readFileSync(join(dir, name), 'utf8'))
  out.push(`**${name}**`)
  if (j.selftest) {
    out.push(`- anfitrión: ${j.host}; DuckDB ${j.versions?.duckdb}; Node ${j.versions?.node}${j.versions?.electron ? '; Electron ' + j.versions.electron : ''}; todo correcto: **${j.selftest.allOk}**`)
    for (const c of j.selftest.checks) out.push(`  - ${c.ok ? '✅' : '❌'} ${c.name} (${c.ms.toFixed(0)} ms)${c.ok ? '' : ' — ' + c.error}`)
  } else if (j.kind?.includes('sistema operativo')) {
    out.push(`- mecanismo: ${j.mechanism ?? 'ninguno'}; ${j.note || ''}`)
    if (j.verdict) out.push(`- funciona dentro: ${j.verdict.worksInside}; el control puede todo: ${j.verdict.controlCanDoEverything}; denegado: ${j.verdict.confinedDenied.join('; ') || '—'}; sigue permitido: ${j.verdict.confinedStillAllowed.join('; ') || '—'}`)
  } else out.push('```json', JSON.stringify(j).slice(0, 600), '```')
  out.push('')
}
console.log(out.join('\n'))
