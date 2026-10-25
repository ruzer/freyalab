// M3 · Prepara, FUERA del repositorio, una mini-aplicación de Electron con el motor DuckDB y el anfitrión confinado, para comprobar en la CI que la
// aplicación EMPAQUETADA lanza su proceso hijo dentro de la capa del sistema operativo.
//   node ci/stage-app.mjs --out <carpeta nueva> --duckdb 2.0.0-r.1 --electron-dist <node_modules/electron/dist> --electron-version <x.y.z>
// Instala SOLO @duckdb/node-api (sin scripts, sin lockfile) en esa carpeta; no toca package.json ni el lockfile del proyecto.
import {cpSync, mkdirSync, writeFileSync, existsSync} from 'node:fs'
import {join, resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
const experiments = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const out = resolve(args.out)
if (existsSync(out)) throw new Error('la carpeta de preparación ya existe')
mkdirSync(join(out, 'experiments'), {recursive: true})
cpSync(join(experiments, 'duckdb-native', 'lib'), join(out, 'experiments', 'duckdb-native', 'lib'), {recursive: true})
cpSync(join(experiments, 'duckdb-isolation'), join(out, 'experiments', 'duckdb-isolation'), {recursive: true, filter: source => !/[\\/]ci([\\/]|$)/.test(source)})
writeFileSync(join(out, 'package.json'), JSON.stringify({name: 'freyalab-m3-duckdb', version: '0.0.0', private: true, main: 'experiments/duckdb-isolation/electron/main.mjs', type: 'module', author: 'experimento M3', description: 'Experimento M3 (no es FreyaLab)', homepage: 'https://example.invalid', dependencies: {'@duckdb/node-api': args.duckdb}}, null, 2))
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock'], {cwd: out, stdio: 'inherit', shell: process.platform === 'win32'})
writeFileSync(join(out, 'electron-builder.json'), JSON.stringify({
  appId: 'io.github.ruzer.freyalab.m3', productName: 'M3DuckDB', directories: {output: 'release'}, asar: true,
  asarUnpack: ['node_modules/@duckdb/**/*', 'experiments/duckdb-isolation/windows/**/*'], files: ['experiments/**/*', 'package.json', 'node_modules/**/*'], npmRebuild: false, nodeGypRebuild: false, buildDependenciesFromSource: false,
  electronVersion: args['electron-version'], electronDist: resolve(args['electron-dist']), mac: {target: 'dir', identity: null}, win: {target: 'dir'}, linux: {target: 'dir', category: 'Utility', maintainer: 'experimento M3 <m3@example.invalid>'}
}, null, 2))
console.log('preparado en', out)
