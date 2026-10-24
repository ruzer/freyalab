// Mide el espacio que ocupan los controles sobre la primera fila y cuántas filas/columnas caben, a 1440×900 y 1280×720.
//   npm run build && OUT=docs/evidence node experiments/ux-redesign/measure-layout.mjs . etiqueta
// Con un CSV sintético de 1 240 filas × 7 columnas; guarda capturas claras (y oscuras si encuentra el selector de tema).
import {_electron as electron} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
const [,, tree, label]=process.argv
const out=resolve(process.env.OUT??'.'),folder=await mkdtemp(join(tmpdir(),'ux-'))
const cities=['Cd. de México','Oaxaca de Juárez','Guadalajara','Monterrey','Mérida','Puebla'],states=['Pagado','Pendiente','Cancelado']
const rows=['Folio,Ciudad,Fecha,Categoría,Unidades,Importe_MXN,Estado',...Array.from({length:1240},(_,i)=>`F${String(i+1).padStart(5,'0')},${cities[i%6]},2026-0${1+i%9}-${String(1+i%28).padStart(2,'0')},Cat ${i%4},${1+i%12},${(100+i*7.3).toFixed(2)},${states[i%3]}`)]
const file=join(folder,'ventas_mexico_2026_q3.csv');await writeFile(file,rows.join('\n')+'\n')
const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
const app=await electron.launch({executablePath:electronPath,args:[resolve(tree,'out/main/index.js')],env:{...env,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile')}})
const page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
await page.evaluate(p=>window.freya.openPaths([p]),file);await page.getByRole('grid').waitFor()
const results={}
for(const [w,h] of [[1440,900],[1280,720]]){
 await app.evaluate(({BrowserWindow},[w,h])=>{const win=BrowserWindow.getAllWindows()[0];win.setContentSize(w,h)},[w,h]);await page.waitForTimeout(600)
 const m=await page.evaluate(()=>{
  const box=s=>document.querySelector(s)?.getBoundingClientRect(),grid=box('[role=grid]'),header=document.querySelector('[role=columnheader]')?.getBoundingClientRect()
  const cells=[...document.querySelectorAll('[role=gridcell][data-column="0"]')],limit=Math.min(box('main').bottom,box('footer')?.top??innerHeight)
  const rows=cells.filter(c=>{const r=c.getBoundingClientRect();return r.top>=grid.top+(header?.height??0)-1&&r.bottom<=limit+1}).length
  const cols=[...document.querySelectorAll('[role=columnheader]')].filter(c=>{const r=c.getBoundingClientRect();return r.left>=grid.left-1&&r.right<=grid.right+1}).length
  const firstRow=cells[0]?.getBoundingClientRect()
  const strips=['header.toolbar','.tabs','.csv-toolbar','.csv-operations','.csv-options','.selection-bar','footer.statusbar'].map(s=>[s,Math.round(box(s)?.height??0)])
  const controls=[...document.querySelectorAll('.csv-toolbar button,.csv-toolbar input,.csv-operations button,.csv-operations summary,.csv-options select,.csv-options button,.csv-options input')].length
  return {gridTop:Math.round(grid.top),headerBottom:Math.round(header?.bottom??0),firstRowTop:Math.round(firstRow?.top??0),visibleRows:rows,visibleColumns:cols,tableHeight:Math.round(grid.height),strips:Object.fromEntries(strips),controlsInCsvBars:controls}
 })
 results[`${w}x${h}`]=m
 await page.screenshot({path:join(out,`${label}-${w}x${h}-claro.png`)})
}
// tema oscuro: el botón de tema
const theme=page.locator('.sidebar-bottom select').first();if(await theme.count()){await theme.selectOption('dark');await page.waitForTimeout(400);await page.screenshot({path:join(out,`${label}-1280x720-oscuro.png`)})}
console.log(JSON.stringify(results,null,1))
await app.evaluate(({app})=>app.exit(0)).catch(()=>{});process.exit(0)
