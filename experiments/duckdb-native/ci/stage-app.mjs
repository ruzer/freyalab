// M2 · Prepara, FUERA del repositorio, una mini-aplicación de Electron con el motor DuckDB para comprobar el empaquetado en la CI.
//   node ci/stage-app.mjs --out <carpeta nueva> --duckdb 2.0.0-r.1 --electron-dist <node_modules/electron/dist> --electron-version <x.y.z>
// Instala SOLO @duckdb/node-api (sin scripts, sin lockfile) en esa carpeta; no toca package.json ni el lockfile del proyecto.
import {cpSync, mkdirSync, writeFileSync, existsSync} from 'node:fs'
import {join, resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
const here = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const out = resolve(args.out)
if (existsSync(out)) throw new Error('la carpeta de preparación ya existe')
mkdirSync(join(out, 'electron'), {recursive: true})
cpSync(join(here, 'electron'), join(out, 'electron'), {recursive: true})
cpSync(join(here, 'lib'), join(out, 'lib'), {recursive: true})
writeFileSync(join(out, 'package.json'), JSON.stringify({name: 'freyalab-m2-duckdb', version: '0.0.0', private: true, main: 'electron/main.mjs', type: 'module', author: 'experimento M2', dependencies: {'@duckdb/node-api': args.duckdb}}, null, 2))
execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock'], {cwd: out, stdio: 'inherit', shell: process.platform === 'win32'})
writeFileSync(join(out, 'electron-builder.json'), JSON.stringify({
  appId: 'io.github.ruzer.freyalab.m2', productName: 'M2DuckDB', directories: {output: 'release'}, asar: true,
  asarUnpack: ['node_modules/@duckdb/**/*'], files: ['electron/**/*', 'lib/**/*', 'package.json', 'node_modules/**/*'], npmRebuild: false, nodeGypRebuild: false, buildDependenciesFromSource: false,
  electronVersion: args['electron-version'], electronDist: resolve(args['electron-dist']), mac: {target: 'dir', identity: null}, win: {target: 'dir'}, linux: {target: 'dir', category: 'Utility', maintainer: 'experimento M2 <m2@example.invalid>'}
}, null, 2))
console.log('preparado en', out)
