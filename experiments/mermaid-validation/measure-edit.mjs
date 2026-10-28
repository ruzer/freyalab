import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {resolve,dirname,join} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
const root=resolve(process.argv[2]??process.cwd()),phase=process.argv[3]??'before',here=dirname(fileURLToPath(import.meta.url)),destination=join(here,`edit-${phase}`)
assert(['before','after'].includes(phase))
const require=createRequire(join(root,'package.json')),hash=value=>createHash('sha256').update(value).digest('hex'),run=promisify(execFile)
const sources={}
for(const file of ['src/renderer/lib/render.ts','src/renderer/components/Preview.svelte']){
 const text=await readFile(join(root,file),'utf8'),baseline=(await run('git',['show',`4358d91:${file}`],{cwd:root})).stdout
 if(phase==='before')assert.equal(text,baseline,`${file} changed: cannot label this source before`)
 sources[file]={SHA256:hash(text),baselineSHA256:hash(baseline)}
}
await mkdir(destination,{recursive:true})
const {_electron:electron}=require('@playwright/test'),electronPath=require('electron'),{ELECTRON_RUN_AS_NODE:_,...env}=process.env
const app=await electron.launch({chromiumSandbox:true,executablePath:electronPath,args:[join(root,'out/main/index.js')],env:{...env,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(destination,'profile')}})
const result={phase,sources,lockSHA256:hash(await readFile(join(root,'package-lock.json'))),outMainSHA256:hash(await readFile(join(root,'out/main/index.js'))),versions:await app.evaluate(()=>process.versions),samples:[]}
try{
 const page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 await page.getByLabel('Tema',{exact:true}).selectOption('light')
 const warm=join(destination,'warm.mmd');await writeFile(warm,'flowchart LR\n A[Calentar Mermaid] --> B[Listo]')
 await page.evaluate(path=>window.freya.openPaths([path]),warm);await page.locator('.diagram-svg svg').waitFor();await page.locator('.diagram-panel .render-progress').waitFor({state:'detached'})
 await page.evaluate(()=>{
  const state={label:'idle',records:[],tasks:[],beats:0,lastFinished:0};window.__r2=state
  new PerformanceObserver(list=>{for(const entry of list.getEntries())state.tasks.push({start:entry.startTime,duration:entry.duration})}).observe({type:'longtask'})
  setInterval(()=>state.beats++,10)
  const original=window.setTimeout
  window.setTimeout=function(handler,delay,...args){
   if(delay!==150||typeof handler!=='function')return original(handler,delay,...args)
   const label=state.label
   return original((...values)=>{
    const record={label,start:performance.now(),beatsStart:state.beats,end:0,beatsEnd:0,error:null};state.records.push(record)
    let returned
    try{returned=handler(...values)}catch(error){record.error=String(error);throw error}
    Promise.resolve(returned).then(()=>{},error=>{record.error=String(error)}).finally(()=>{record.end=performance.now();record.beatsEnd=state.beats;state.lastFinished=record.end})
    return returned
   },delay,...args)
  }
 })
 for(const count of [5,40]){
  const path=join(destination,`blocks-${count}.md`);await writeFile(path,'# Preparación\n')
  const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
  await page.getByRole('group',{name:'Modo de edición',exact:true}).getByRole('button',{name:'Editar',exact:true}).click();await page.locator('.cm-content').waitFor()
  const hiddenBefore=await page.locator('article.markdown-body').innerHTML()
  const fixture=Array.from({length:count},(_,block)=>'```mermaid\nflowchart LR\n%% bloque '+count+'-'+block+'\n'+Array.from({length:24},(_,node)=>` n${node}[Nodo ${node}] --> n${node+1}[Nodo ${node+1}]`).join('\n')+'\n```').join('\n\n')
  for(const action of ['cold','paragraph-1','paragraph-2','dark-cold','dark-paragraph']){
   const label=`${count}-${action}`
   await page.evaluate(label=>{const state=window.__r2;state.label=label;state.records=[];state.tasks=[];state.lastFinished=0},label)
   if(action==='dark-cold')await page.getByLabel('Tema',{exact:true}).selectOption('dark')
   else{await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+Home');if(action==='cold'){await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(fixture)}else await page.keyboard.insertText(`Pausa ${action}\n\n`)}
   await page.waitForFunction(label=>{const state=window.__r2;return state.records.some(record=>record.label===label&&record.end)&&state.lastFinished&&performance.now()-state.lastFinished>350},label,{timeout:30_000})
   const measurement=await page.evaluate(label=>{
    const state=window.__r2,callbacks=state.records.filter(record=>record.label===label),start=Math.min(...callbacks.map(record=>record.start)),end=Math.max(...callbacks.map(record=>record.end))
    const longtasks=state.tasks.filter(task=>task.start<end&&task.start+task.duration>start)
    return{label,callbacks:callbacks.map(record=>({...record,duration:record.end-record.start,heartbeatsDuring:record.beatsEnd-record.beatsStart})),longtasks,maximumLongTask:Math.max(0,...longtasks.map(task=>task.duration)),totalCallbackWall:callbacks.reduce((sum,record)=>sum+record.end-record.start,0)}
   },label)
   assert(measurement.callbacks.length>0);assert(measurement.callbacks.every(record=>!record.error))
   assert.equal(await page.locator('.cm-diagram-error').count(),0)
   assert.equal(await page.locator('article.markdown-body').innerHTML(),hiddenBefore,'Editar must not publish the hidden article')
   result.samples.push({blocks:count,nodesPerBlock:25,...measurement})
   await writeFile(join(destination,'result.json'),JSON.stringify(result,null,2)+'\n')
  }
  const updated=await page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),doc.id)
  assert(updated.text.includes(fixture));assert.equal(await readFile(path,'utf8'),'# Preparación\n')
  await page.getByLabel('Tema',{exact:true}).selectOption('light')
 }
}finally{await writeFile(join(destination,'result.json'),JSON.stringify(result,null,2)+'\n');await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}
console.log(JSON.stringify(result,null,2))
