// Resumen en Markdown de los JSON de M3 (para el resumen del trabajo de GitHub Actions). Uso: node ci/summarize.mjs <carpeta con los JSON>
import {readdirSync, readFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
const dir = resolve(process.argv[2])
const lines = [`### M3 · ${process.platform} ${process.arch}`]
const short = list => (list?.length ? list.join('; ') : 'ninguna')
for (const name of readdirSync(dir).filter(n => n.endsWith('.json')).sort()) {
  let d; try { d = JSON.parse(readFileSync(join(dir, name), 'utf8')) } catch { lines.push(`- **${name}**: JSON ilegible`); continue }
  lines.push(`\n**${name}**`)
  if (d.error) lines.push(`- ERROR: ${String(d.error).split('\n')[0]}`)
  if (d.mechanism) lines.push(`- Capa: ${d.mechanism}`)
  const v = d.confined?.verdict ?? d.verdict
  if (v) lines.push(`- Dentro de la capa, el proceso aún puede: **${short(v.allowed ?? v.confinedStillAllowed)}**`, `- Denegado: ${short(v.denied ?? v.confinedDenied)}`)
  if (d.control?.verdict) lines.push(`- Sin capa puede: ${short(d.control.verdict.allowed)}`)
  if (d.utilityProcessControl?.verdict) lines.push(`- utilityProcess de Electron (sin capa) puede: **${short(d.utilityProcessControl.verdict.allowed)}**`)
  if (d.coldStart) lines.push(`- Arranque en frío: sin capa ${d.coldStart.sinCapaMs} ms · con capa ${d.coldStart.conCapaMs} ms`)
  if (d.overhead) lines.push(`- Autocomprobación: sin capa ${d.overhead.selftestSinCapaMs} ms · con capa ${d.overhead.selftestConCapaMs} ms`)
  const st = d.confined?.selftest; if (st) lines.push(`- Autocomprobación en la capa: ${st.checks.filter(c => c.ok).length}/${st.checks.length} correctas${st.checks.filter(c => c.skipped).length ? ` (${st.checks.filter(c => c.skipped).length} no aplicable)` : ''}${st.checks.filter(c => !c.ok && !c.skipped).map(c => ` · FALLA ${c.name}: ${c.error}`).join('')}`)
  if (d.kill) lines.push(`- Matar a mitad de operación: ${d.kill.killMs} ms · latido detenido: ${d.kill.heartbeatStoppedAfterKill} · relanzado en ${d.kill.replacementStartMs} ms · salida parcial: ${d.kill.outputLeft} bytes`)
  if (d.recycle) lines.push(`- Memoria (${d.recycle.ops} operaciones pequeñas): línea base ${d.recycle.baselineRssMB} MB, máximo ${d.recycle.maxRssMB} MB, reciclajes ${d.recycle.recycles}`, `- Operación pesada: antes ${d.recycle.heavy?.rssBeforeMB} MB → después ${d.recycle.heavy?.rssAfterMB} MB → tras reiniciar ${d.recycle.heavy?.rssAfterRestartMB} MB (reinicio ${d.recycle.heavy?.restartMs} ms)`)
  if (d.memoryCap) lines.push(`- Tope de memoria 1 GiB (objeto de trabajo): ${typeof d.memoryCap.capped1GiB === 'string' ? d.memoryCap.capped1GiB : JSON.stringify(d.memoryCap.capped1GiB.result ?? {salida: d.memoryCap.capped1GiB.exitCode, stderr: d.memoryCap.capped1GiB.stderr?.slice(0, 120)})}`)
  if (d.casos) {
    const tally = {}; for (const c of d.casos) for (const m of ['paralelo', 'no_paralelo', 'paralelo_1_hilo']) tally[`${m}: ${c[m].veredicto}`] = (tally[`${m}: ${c[m].veredicto}`] ?? 0) + 1
    lines.push(`- DuckDB ${d.duckdb}, ${d.casos.length} casos hostiles: ${Object.entries(tally).map(([k, v]) => `${k} ×${v}`).join(' · ')}`, `- Peligrosos (DuckDB acepta o interpreta distinto): ${d.peligrosos.map(p => `${p.caso} [${p.modo}]`).join('; ') || 'ninguno'}`, `- Estrés de fronteras de trozo (${d.estres.archivo.mib} MiB, ${d.estres.archivo.filas} filas): ${d.estres.lecturas.map(l => `${l.modo} → ${l.coincide ?? l.error}`).join(' · ')}`)
  }
  if (d.variantes) {
    lines.push(`- Inventario de binarios: ${d.inventario.binarios} (${Object.entries(d.inventario.porEstado).map(([k, v]) => `${k} ×${v}`).join(' · ')})`)
    for (const v of d.variantes) lines.push(`  - ${v.variante}: ${v.cargaElMotor ? `carga DuckDB ${v.duckdb}, hijo confinado ${v.hijoConfinado ? `${v.hijoConfinado.denegado} denegados/${v.hijoConfinado.permitido} permitidos` : '—'}, autocomprobación ${v.autocomprobacion}` : `NO CARGA${v.expirado ? ' (sin respuesta en 90 s)' : ''}: ${String(v.error ?? '').slice(0, 220)}`}${v.firma ? ` · firma ${v.firma.verificacion}, equipo app ${v.firma.equipoDeLaAplicacion}, equipo nativo ${v.firma.equipoDelNativo}` : ''}`)
    if (d.gatekeeper) lines.push(`- Gatekeeper: ${d.gatekeeper.texto}`)
  }
  if (d.formatos) {
    lines.push(`- Construcción de instaladores: ${d.construccion.segundos} s, salida ${d.construccion.salida}${d.construccion.cola ? ' · ' + d.construccion.cola : ''}`)
    for (const f of d.formatos) lines.push(`  - ${f.formato}: ${f.bytes ? Math.round(f.bytes / 1048576) + ' MiB' : '—'} · ${f.instalacion ?? f.error} · ${f.ejecucion ? (f.ejecucion.carga ? `DuckDB ${f.ejecucion.duckdb}, hijo ${f.ejecucion.hijoConfinado}, autocomprobación ${f.ejecucion.autocomprobacion}` : 'NO CARGA: ' + f.ejecucion.error) : ''}${f.desinstalacion ? ' · desinstalación ' + f.desinstalacion : ''}`)
  }
  if (d.windowsLauncher) lines.push(`- Lanzador de Windows: SID ${d.windowsLauncher.sid}, concesiones: ${(d.windowsLauncher.grants ?? []).join(' | ')}`)
  if (d.bubblewrap) lines.push(`- bubblewrap: ${JSON.stringify(d.bubblewrap)}`)
  if (d.confined?.error ?? d.confined?.stdout !== undefined) lines.push(`- confined: ${JSON.stringify(d.confined).slice(0, 400)}`)
}
console.log(lines.join('\n'))
