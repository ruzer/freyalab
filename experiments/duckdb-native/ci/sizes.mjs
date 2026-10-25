// Tamaño que añade el motor al empaquetado (carpeta desempaquetada de @duckdb/*) y del paquete completo. Imprime JSON.
import {readdirSync, statSync} from 'node:fs'
import {join, resolve} from 'node:path'
const bytes = dir => { let n = 0; for (const e of readdirSync(dir, {withFileTypes: true})) { const p = join(dir, e.name); n += e.isDirectory() ? bytes(p) : statSync(p).size } return n }
const release = join(resolve(process.argv[2]), 'release')
const find = (dir, name) => { for (const e of readdirSync(dir, {withFileTypes: true})) { const p = join(dir, e.name); if (e.isDirectory()) { if (e.name === name) return p; const r = find(p, name); if (r) return r } } }
const unpacked = find(release, 'app.asar.unpacked')
const result = {platform: process.platform, arch: process.arch, packageBytes: bytes(release), unpackedDuckDBBytes: unpacked ? bytes(join(unpacked, 'node_modules', '@duckdb')) : null, unpackedEntries: unpacked ? readdirSync(join(unpacked, 'node_modules', '@duckdb')) : null}
console.log(JSON.stringify(result))
