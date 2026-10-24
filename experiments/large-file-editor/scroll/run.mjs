#!/usr/bin/env node
// PoC 3: desplazamiento virtual escalado con 1 M a 500 M de filas en el Chromium de Electron.
//   node scroll/run.mjs --results results/scroll-10M.json
import {_electron as electron} from '@playwright/test'
import electronPath from 'electron'
import {writeFile,mkdir,mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname,join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,all)=>x.startsWith('--')?[...a,[x.slice(2),all[i+1]]]:a,[]))
const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
const app=await electron.launch({executablePath:electronPath,args:[join(dirname(fileURLToPath(import.meta.url)),'main.cjs'),`--user-data-dir=${await mkdtemp(join(tmpdir(),'fl-scroll-'))}`],env})
const page=await app.firstWindow();await page.waitForFunction(()=>typeof window.setup==='function')
const out={platform:`${process.platform}-${process.arch}`,chromium:await page.evaluate(()=>navigator.userAgent.match(/Chrome\/[\d.]+/)[0]),runs:[]}
for(const total of [1_000_000,10_000_000,50_000_000,100_000_000,500_000_000]){
 const run={total}
 for(const anchored of [false,true]){
  const mode=anchored?'anclado':'ingenuo',info=await page.evaluate(([t,a])=>window.setup(t,a),[total,anchored]);Object.assign(run,{scale:+info.scale.toFixed(1),physicalPx:info.physicalPx,rowsPerScrollbarPixel:+(info.scale/32).toFixed(1)})
  const last=await page.evaluate(()=>window.scrollPhysical(1e9));const audit=await page.evaluate(()=>window.audit())
  const reachesLast=audit.last===total-1
  // ir a una fila concreta: ¿cuánto se desvía la fila superior de la pedida?
  const targets=[0,1,total>>1,Math.floor(total*.9137)+3,total-100,total-30],errors=[]
  for(const r of targets){const top=await page.evaluate(x=>window.gotoRow(x),r);errors.push({pedida:r,fila:top?.i,desvio:top?top.i-r:null,pixelsDeSobra:top?+top.y.toFixed(1):null})}
  const samples=[];for(let k=0;k<40;k++){const p=Math.floor(Math.random()*(info.physicalPx-600));await page.evaluate(x=>window.scrollPhysical(x),p);samples.push(await page.evaluate(()=>window.audit()))}
  run[mode]={reachesLastRow:reachesLast,lastAudit:audit,gotoRowErrors:errors,randomPositions:{samples:samples.length,allContiguous:samples.every(s=>s.contiguous),allSpacing32:samples.every(s=>s.spacing),minVisibleRows:Math.min(...samples.map(s=>s.visibleRows))}}
  if(anchored)run.frames=await page.evaluate(([n,t])=>window.frames(n,t),[400,total])
 }
 out.runs.push(run);console.log(total.toLocaleString('es'),JSON.stringify({scale:run.scale,filasPorPixelDeBarra:run.rowsPerScrollbarPixel,ultimaIngenuo:run.ingenuo.reachesLastRow,ultimaAnclado:run.anclado.reachesLastRow,errIngenuo:run.ingenuo.gotoRowErrors.map(e=>e.desvio),errAnclado:run.anclado.gotoRowErrors.map(e=>e.desvio),frames:run.frames}))
}
await mkdir(dirname(resolve(args.results??'results/scroll.json')),{recursive:true});await writeFile(resolve(args.results??'results/scroll.json'),JSON.stringify(out,null,1)+'\n')
await app.close();process.exit(0)
