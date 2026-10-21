import { readFile, readdir, writeFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'))
const sections = ['FreyaLab — third-party notices\n\nGenerated from package-lock.json production dependencies.\nElectron is MIT-licensed; its distribution includes Chromium and other components with separate notices (LICENSES.chromium.html). Preserve those files when distributing.\n']
const missing = []
const mitText = (await readFile(join(root, 'LICENSE'), 'utf8')).replace(/Copyright \(c\) 2026 ruzer\n\n/, '')
for (const [location, entry] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
  if (!location || entry.dev || entry.link) continue
  const directory = join(root, location)
  const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
  const names = (await readdir(directory)).filter(name => /^(licen[sc]e|copying|notice|ofl)(\.|$|-)/i.test(name))
  const texts = []
  for (const name of names) {
    const file = join(directory, name)
    if ((await stat(file)).isFile()) texts.push(`${name}\n${await readFile(file, 'utf8')}`)
  }
  let license = typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license ?? pkg.licenses ?? null)
  if (license === 'null' && texts.some(text => /MIT License|The MIT License/i.test(text))) license = 'MIT (from bundled license text)'
  if (!texts.length && license === 'MIT') texts.push(`The npm package declares MIT but contains no standalone license file. Author metadata: ${JSON.stringify(pkg.author ?? pkg.contributors ?? 'not declared')}. Standard license text follows; upstream source is listed above.\n\n${mitText}`)
  if (!license || license === 'null' || !texts.length) missing.push(`${pkg.name}@${pkg.version}: ${license || 'undeclared'}${texts.length ? '' : ' (license text missing)'}`)
  sections.push(`\n${'='.repeat(78)}\n${pkg.name}@${pkg.version}\nLicense: ${license}\nSource: ${typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? pkg.homepage ?? ''}\n\n${texts.join('\n\n')}`)
}
await writeFile(join(root, 'THIRD_PARTY_NOTICES.txt'), sections.join('\n'), 'utf8')
console.log(`Wrote notices for ${sections.length - 1} production package installations.`)
if (missing.length) {
  console.error(`Manual license review required:\n${missing.join('\n')}`)
  process.exitCode = 1
}
