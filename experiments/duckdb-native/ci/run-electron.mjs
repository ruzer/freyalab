// Lanza Electron (sin empaquetar: --exe dev, o el ejecutable empaquetado) con los argumentos en la variable M2_ARGS, de forma portable.
//   node ci/run-electron.mjs --exe <ruta|dev> --install <ruta|app> --work <carpeta nueva> --out <json> --modes selftest
import {spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const here = join(dirname(fileURLToPath(import.meta.url)), '..')
const {exe, ...rest} = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []))
const dev = exe === 'dev'
const binary = dev ? createRequire(join(process.cwd(), 'package.json'))('electron') : exe
const run = spawnSync(binary, dev ? [join(here, 'electron', 'main.mjs')] : [], {stdio: 'inherit', env: {...process.env, M2_ARGS: JSON.stringify(rest)}})
process.exit(run.status ?? 1)
