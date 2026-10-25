// M3 · Preparación para firma y notarización, SIN firmar de verdad (no hay certificado ni se notariza nada):
//   1. inventario de los binarios nativos del paquete (lo que una firma comercial tendría que cubrir) con su estado de firma;
//   2. macOS: la aplicación EMPAQUETADA con DuckDB nativo, re-firmada AD HOC en variantes (sin runtime reforzado, con runtime reforzado sin y con
//      `disable-library-validation`), y se comprueba si carga el módulo nativo y lanza su hijo confinado en cada una;
//   3. todas las plataformas: el fusible `RunAsNode` de Electron desactivado (endurecimiento habitual) rompe el diseño «Electron como Node» del hijo.
//   node signing.mjs --app <carpeta empaquetada: release/…-unpacked | M3DuckDB.app> --exe <ejecutable> --work <carpeta nueva> --out resultados.json
import {mkdirSync, cpSync, readdirSync, lstatSync, openSync, readSync, closeSync, writeFileSync, rmSync, existsSync, readFileSync} from 'node:fs'
import {join, resolve, dirname, basename, relative} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {flipFuses, FuseVersion, FuseV1Options} from '@electron/fuses'
const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const work = resolve(args.work), appDir = resolve(args.app), exeRel = relative(appDir, resolve(args.exe))
mkdirSync(work, {recursive: true})
const run = (cmd, argv, options = {}) => { const r = spawnSync(cmd, argv, {encoding: 'utf8', ...options}); return {status: r.status, out: ((r.stdout ?? '') + (r.stderr ?? '')).trim()} }

// ---- Inventario ---------------------------------------------------------------------------------------------------------------------------------
const MAGICS = new Set(['cffaedfe', 'cafebabe', 'bebafeca', 'cefaedfe', '7f454c46', '4d5a9000', '4d5a5000', '4d5a0000'])
const NATIVE_EXT = /\.(node|dylib|so|dll|exe)$/i
function isBinary(path) { try { const fd = openSync(path, 'r'), b = Buffer.alloc(4); readSync(fd, b, 0, 4, 0); closeSync(fd); const hex = b.toString('hex'); return MAGICS.has(hex) || (hex.startsWith('4d5a') && true) } catch { return false } }
function walk(dir, found = []) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) walk(path, found)
    else if (entry.isFile() && (NATIVE_EXT.test(entry.name) || isBinary(path))) found.push(path)
  }
  return found
}
function signState(path) {
  if (process.platform === 'darwin') {
    const r = run('codesign', ['-dvv', path]); const t = r.out
    if (/code object is not signed/.test(t)) return {firmado: false}
    return {firmado: true, adhoc: /Signature=adhoc/.test(t), runtimeReforzado: /flags=0x[0-9a-f]*\(.*runtime/.test(t), equipo: (t.match(/TeamIdentifier=(\S+)/) ?? [])[1] ?? null}
  }
  if (process.platform === 'win32') {
    const r = run('powershell', ['-NoProfile', '-Command', `(Get-AuthenticodeSignature -LiteralPath '${path.replaceAll("'", "''")}').Status`])
    return {firmado: r.out === 'Valid', estado: r.out.split('\n').pop()}
  }
  return {firmado: null, nota: 'Linux: AppImage y deb no se firman con certificado; la integridad se publica con SHA-256'}
}
function inventory(root) {
  const files = walk(root).filter(path => !/node_modules[\\/]electron[\\/]/.test(path))
  const rows = files.map(path => ({archivo: relative(root, path), bytes: lstatSync(path).size, ...signState(path)}))
  const interesting = rows.filter(r => /\.node$|duckdb/i.test(r.archivo))
  const byState = {}; for (const r of rows) { const key = r.firmado === null ? 'sin aplicar' : r.firmado ? (r.adhoc ? 'firma ad hoc' : 'firmado') + (r.runtimeReforzado ? ' + runtime reforzado' : '') : 'SIN FIRMAR'; byState[key] = (byState[key] ?? 0) + 1 }
  return {binarios: rows.length, porEstado: byState, nativosDelMotor: interesting}
}

const report = {kind: 'M3 firma y notarización: preparación (sin firmar de verdad)', platform: `${process.platform} ${process.arch}`, app: basename(appDir)}
report.inventario = inventory(appDir)

// ---- Ejecución de la aplicación empaquetada ----------------------------------------------------------------------------------------------------
function execute(label, exe) {
  const out = join(work, `${label}.json`), cwd = process.cwd()
  rmSync(out, {force: true})
  const script = [join(here, 'ci', 'run-electron.mjs'), '--exe', exe, '--install', 'app', '--work', join(work, `trabajo-${label}`), '--out', out]
  const [cmd, argv] = process.platform === 'linux' ? ['xvfb-run', ['-a', process.execPath, ...script]] : [process.execPath, script]
  const started = performance.now()
  // Las copias en Linux pierden el setuid de chrome-sandbox: esta prueba no trata del sandbox de Chromium.
  const r = spawnSync(cmd, argv, {encoding: 'utf8', timeout: 90000, cwd, env: {...process.env, ...(process.platform === 'linux' && label !== 'original' ? {ELECTRON_DISABLE_SANDBOX: '1'} : {})}})
  const entry = {variante: label, ms: Math.round(performance.now() - started), salida: r.status, expirado: r.error?.code === 'ETIMEDOUT'}
  if (existsSync(out)) {
    const d = JSON.parse(readFileSync(out, 'utf8'))
    entry.cargaElMotor = Boolean(d.versions?.duckdb); entry.duckdb = d.versions?.duckdb ?? null
    entry.hijoConfinado = d.confined?.verdict ? {denegado: d.confined.verdict.denied.length, permitido: d.confined.verdict.allowed.length} : null
    entry.autocomprobacion = d.confined?.selftest ? `${d.confined.selftest.checks.filter(c => c.ok).length}/${d.confined.selftest.checks.length}` : null
    entry.error = d.error ? String(d.error).split('\n')[0].slice(0, 200) : d.startError?.message?.slice(0, 200) ?? null
  } else entry.error = ((r.stderr ?? '') + (r.stdout ?? '')).split('\n').filter(Boolean).slice(-4).join(' | ').slice(0, 300) || 'sin resultado'
  return entry
}
// En macOS `fs.cpSync` deja el binario del framework sin poder abrirse para escribir (EPERM al cambiar los fusibles): se copia con `cp -R`, que conserva enlaces y atributos.
const copyApp = label => {
  const target = join(work, label, basename(appDir)); mkdirSync(dirname(target), {recursive: true})
  if (process.platform === 'win32') cpSync(appDir, target, {recursive: true, verbatimSymlinks: true}); else spawnSync('cp', ['-R', appDir, target])
  return target
}

report.variantes = []
report.variantes.push({...execute('original', resolve(args.exe)), nota: 'tal como lo deja electron-builder'})

// Fusible RunAsNode desactivado: el mismo binario deja de obedecer ELECTRON_RUN_AS_NODE (todas las plataformas).
{
  const copy = copyApp('fusible-runasnode-off'), exe = join(copy, exeRel)
  try {
    await flipFuses(process.platform === 'darwin' ? copy : exe, {version: FuseVersion.V1, resetAdHocDarwinSignature: process.platform === 'darwin', [FuseV1Options.RunAsNode]: false})
    report.variantes.push({...execute('fusible-runasnode-off', exe), nota: 'fusible RunAsNode desactivado; en macOS re-firmado ad hoc por la propia herramienta'})
  } catch (error) { report.variantes.push({variante: 'fusible-runasnode-off', error: String(error.message).slice(0, 200)}) }
}

if (process.platform === 'darwin') {
  const entitlements = dlv => `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>com.apple.security.cs.allow-jit</key><true/><key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>${dlv ? '<key>com.apple.security.cs.disable-library-validation</key><true/>' : ''}</dict></plist>`
  // Firma como lo hace electron-builder: primero los nativos sueltos (no los cubre --deep: están en Resources), luego frameworks, luego los ayudantes y al final la aplicación.
  // Los ayudantes y la aplicación llevan las mismas excepciones (`entitlementsInherit`).
  const resign = (label, {hardened, dlv, identity = '-', nativeIdentity, keychain}) => {
    const copy = copyApp(label), ent = join(work, `${label}.entitlements.plist`); writeFileSync(ent, entitlements(dlv))
    const natives = walk(copy).filter(p => /\.(node|dylib)$/.test(p) && !/\.framework[\\/]/.test(p)), log = []
    const sign = (id, target, extra = []) => { const r = run('codesign', ['--force', '--sign', id, ...(keychain ? ['--keychain', keychain] : []), '--timestamp=none', ...(hardened ? ['--options', 'runtime'] : []), ...extra, target]); if (r.status !== 0) log.push(`${basename(target)}: ${r.out.split('\n').pop()}`); return r.status === 0 }
    for (const file of natives) sign(nativeIdentity ?? identity, file)
    const frameworks = join(copy, 'Contents', 'Frameworks')
    for (const name of readdirSync(frameworks)) { const bundle = join(frameworks, name); if (name.endsWith('.framework')) sign(identity, bundle, ['--deep']) }
    for (const name of readdirSync(frameworks)) { const bundle = join(frameworks, name); if (name.endsWith('.app')) sign(identity, bundle, ['--entitlements', ent]) }
    sign(identity, copy, ['--entitlements', ent])
    const verify = run('codesign', ['--verify', '--deep', '--strict', copy])
    const state = run('codesign', ['-dvv', join(copy, 'Contents', 'MacOS', basename(exeRel))]).out
    const native = natives.find(p => /duckdb.*\.node$/.test(p) || /\.node$/.test(p)), nativeState = native ? run('codesign', ['-dvv', native]).out : ''
    const team = text => (text.match(/TeamIdentifier=(\S+(?: set)?)/) ?? [])[1] ?? null
    return {...execute(label, join(copy, exeRel)), firma: {hardened, disableLibraryValidation: dlv, identidad: identity === '-' ? 'ad hoc' : 'certificado autofirmado de prueba', verificacion: verify.status === 0 ? 'correcta' : verify.out.split('\n').pop(), equipoDeLaAplicacion: team(state), equipoDelNativo: team(nativeState), erroresDeFirma: log.slice(0, 4)}}
  }
  report.variantes.push({...resign('adhoc-sin-runtime', {hardened: false, dlv: false}), nota: 'firma ad hoc, sin runtime reforzado'})
  report.variantes.push({...resign('adhoc-runtime-sin-dlv', {hardened: true, dlv: false}), nota: 'ad hoc + runtime reforzado, validación de bibliotecas activa: una firma ad hoc no tiene equipo y dyld rechaza hasta el Electron Framework'})
  report.variantes.push({...resign('adhoc-runtime-con-dlv', {hardened: true, dlv: true}), nota: 'ad hoc + runtime reforzado + com.apple.security.cs.disable-library-validation'})
  // Con un certificado autofirmado de prueba (llavero temporal, solo en la CI) la firma sí lleva un identificador de equipo y se puede ver qué hace la validación de bibliotecas.
  if (process.env.CI) {
    try {
      const dir = join(work, 'identidades'); mkdirSync(dir, {recursive: true}); const keychain = join(dir, 'm3.keychain-db'), password = 'm3-prueba'
      run('security', ['create-keychain', '-p', password, keychain]); run('security', ['set-keychain-settings', '-lut', '3600', keychain]); run('security', ['unlock-keychain', '-p', password, keychain])
      const identity = (cn, ou) => {
        writeFileSync(join(dir, `${ou}.cnf`), `[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=${cn}\nOU=${ou}\nO=Experimento M3\n[ext]\nbasicConstraints=critical,CA:false\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=critical,codeSigning\n`)
        run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, `${ou}.key`), '-out', join(dir, `${ou}.crt`), '-days', '2', '-config', join(dir, `${ou}.cnf`)])
        run('openssl', ['pkcs12', '-export', '-inkey', join(dir, `${ou}.key`), '-in', join(dir, `${ou}.crt`), '-out', join(dir, `${ou}.p12`), '-passout', 'pass:m3'])
        run('security', ['import', join(dir, `${ou}.p12`), '-k', keychain, '-P', 'm3', '-T', '/usr/bin/codesign'])
        return cn
      }
      const A = identity('M3 Equipo A', 'M3TEAMAAAA'), B = identity('M3 Equipo B', 'M3TEAMBBBB')
      run('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', password, keychain])
      const listed = run('security', ['find-identity', '-p', 'codesigning', keychain]).out
      const hash = cn => (listed.split('\n').find(l => l.includes(`"${cn}"`)) ?? '').match(/[0-9A-F]{40}/)?.[0]
      if (!hash(A) || !hash(B)) report.variantes.push({variante: 'identidades-de-prueba', error: 'no se pudieron crear: ' + listed.slice(0, 300)})
      else {
        report.variantes.push({...resign('equipo-unico-sin-dlv', {hardened: true, dlv: false, identity: hash(A), keychain}), nota: 'todo (incluido el nativo) firmado con el mismo equipo, runtime reforzado y SIN disable-library-validation'})
        report.variantes.push({...resign('nativo-de-otro-equipo', {hardened: true, dlv: false, identity: hash(A), nativeIdentity: hash(B), keychain}), nota: 'el módulo nativo conserva una firma de OTRO equipo (error típico si no se vuelve a firmar)'})
        report.variantes.push({...resign('nativo-de-otro-equipo-con-dlv', {hardened: true, dlv: true, identity: hash(A), nativeIdentity: hash(B), keychain}), nota: 'igual, pero con disable-library-validation'})
      }
      run('security', ['delete-keychain', keychain])
    } catch (error) { report.variantes.push({variante: 'identidades-de-prueba', error: String(error.message).slice(0, 200)}) }
  }
  const gate = run('spctl', ['--assess', '--type', 'execute', '--verbose=2', appDir]); report.gatekeeper = {salida: gate.status, texto: gate.out.split('\n').slice(0, 2).join(' | '), nota: 'sin certificado de Developer ID ni notarización Gatekeeper rechaza la aplicación: es lo esperado'}
}
writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({inventario: report.inventario.porEstado, variantes: report.variantes.map(v => ({v: v.variante, carga: v.cargaElMotor, hijo: v.hijoConfinado, auto: v.autocomprobacion, error: v.error, firma: v.firma ? `${v.firma.verificacion} · equipo app ${v.firma.equipoDeLaAplicacion} · equipo nativo ${v.firma.equipoDelNativo}` : undefined}))}, null, 1))
