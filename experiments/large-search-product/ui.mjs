import { _electron as electron } from '@playwright/test'
import electronPath from 'electron'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
const folder=resolve(process.argv[2]),path='/private/tmp/FreyaLab-pruebas/ventas_1GiB.csv';await mkdir(folder,{recursive:true})
const {ELECTRON_RUN_AS_NODE:_,...env}=process.env,app=await electron.launch({chromiumSandbox:true,executablePath:electronPath,args:[resolve('out/main/index.js')],env:{...env,FREYALAB_TEST:'1',FREYALAB_USER_DATA:resolve(folder,'ui-profile')}})
try{
 const page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900});const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);await page.getByLabel('Buscar en tabla',{exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('[aria-label="Buscar en tabla"]').disabled)
 const results=[]
 for(const needle of ['12345','V-']){
  await page.evaluate(()=>{window.__csvLongTasks=[];assertSupported();function assertSupported(){if(!PerformanceObserver.supportedEntryTypes.includes('longtask'))throw new Error('Long-task observer unavailable')}window.__csvObserver=new PerformanceObserver(list=>window.__csvLongTasks.push(...list.getEntries().map(entry=>({startTime:entry.startTime,duration:entry.duration}))));window.__csvObserver.observe({type:'longtask'})})
  const start=performance.now();await page.getByLabel('Buscar en tabla',{exact:true}).fill(needle);await page.getByLabel('Buscar en tabla',{exact:true}).press('Enter');let state
  do{await new Promise(resolve=>setTimeout(resolve,100));state=await page.evaluate(id=>window.freya.tableViewState(id),doc.id)}while(!state||state.status==='running')
  await page.waitForFunction(count=>document.querySelector('[role=grid][aria-label="Tabla de datos"]').getAttribute('aria-rowcount')===String(count+1),state.matched);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const longTasks=await page.evaluate(()=>{window.__csvObserver.disconnect();return window.__csvLongTasks});results.push({needle,wallMs:performance.now()-start,state,longTasks});await writeFile(resolve(folder,'ui-raw.json'),JSON.stringify({viewport:[1440,900],path,results},null,2)+'\n');assert.equal(state.status,'complete');assert.equal(longTasks.filter(task=>task.duration>50).length,0,JSON.stringify(longTasks))
 }
 console.log(JSON.stringify(results))
}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
