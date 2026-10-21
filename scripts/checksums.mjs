import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
const directory = resolve('release')
const artifacts = (await readdir(directory)).filter(name => /\.(dmg|exe|AppImage|deb)$/.test(name)).sort()
if (!artifacts.length) throw new Error('No release artifacts found')
const hashes = []
for (const name of artifacts) hashes.push(`${createHash('sha256').update(await readFile(join(directory, name))).digest('hex')}  ${name}`)
await writeFile(join(directory, 'SHA256SUMS.txt'), `${hashes.join('\n')}\n`)
await writeFile(join(directory, 'candidate.json'), JSON.stringify({ commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), platform: process.platform, arch: process.arch, node: process.version, artifacts, generatedAt: new Date().toISOString(), publication: 'pending manual release gates' }, null, 2))
