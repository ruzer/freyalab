// Imprime la ruta del ejecutable de la mini-aplicación empaquetada (electron-builder --dir) en release/.
import {readdirSync, statSync} from 'node:fs'
import {join, resolve} from 'node:path'
const release = join(resolve(process.argv[2]), 'release')
const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(e => (e.isDirectory() ? (e.name.endsWith('.app') ? [join(dir, e.name)] : walk(join(dir, e.name))) : [join(dir, e.name)]))
const found = walk(release)
let exe
if (process.platform === 'darwin') { const app = found.find(p => p.endsWith('.app')); exe = join(app, 'Contents', 'MacOS', 'M3DuckDB') }
else if (process.platform === 'win32') exe = found.find(p => /M3DuckDB\.exe$/i.test(p))
else exe = found.find(p => /(^|[\\/])m3duckdb$/i.test(p)) ?? found.find(p => /unpacked[\\/][^\\/]+$/.test(p) && !/\.(so|pak|bin|dat|json|txt|html|lic)$/i.test(p) && (statSync(p).mode & 0o111) && !/chrome|crashpad|libffmpeg|vk_|libEGL|libGLES|libvulkan|resources/i.test(p))
if (!exe) throw new Error('no se encontró el ejecutable en ' + release)
console.log(exe)
