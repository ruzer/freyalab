// Sonda: ¿aparece el aviso «La tabla ya no está abierta.» justo después de abrir un CSV?
//   npm run build && node experiments/ux-redesign/probe-open-toast.mjs . /ruta/ventas_10MiB.csv
// Repetirla varias veces: es una carrera, no ocurre siempre (en `main` sin cambios apareció en 4 de 6 aperturas del CSV de 10 MiB).
import {_electron as electron} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
const [,, tree, file]=process.argv,folder=await mkdtemp(join(tmpdir(),'probe-'))
const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
const app=await electron.launch({executablePath:electronPath,args:[resolve(tree,'out/main/index.js')],env:{...env,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile')}})
const page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1440,900))
await page.evaluate(p=>window.freya.openPaths([p]),resolve(file));await page.getByRole('grid').waitFor();await page.waitForTimeout(500)
const toasts=await page.locator('.toast').allInnerTexts();console.log(toasts.length?`AVISO: ${JSON.stringify(toasts)}`:'sin avisos')
await app.evaluate(({app})=>app.exit(0)).catch(()=>{});process.exit(0)
