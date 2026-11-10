import {strict as assert} from 'node:assert'
import {mkdir,mkdtemp,open,readFile,rm} from 'node:fs/promises'
import {tmpdir,arch,cpus,release,totalmem} from 'node:os'
import {join,resolve} from 'node:path'
import electronPath from 'electron'
import {_electron as electron} from '@playwright/test'

// npm run build && node experiments/prj-01b/fingerprint.mjs
const root=await mkdtemp(join(tmpdir(),'freya-project-measure-'))
let app
try{
 const folder=join(root,'proyecto'),source=join(folder,'datos.csv'),bytes=Number(process.env.FREYALAB_MEASURE_MIB??1024)*2**20
 await mkdir(folder)
 const file=await open(source,'wx')
 try{
  const header=Buffer.from('id;region;ventas\n'),row=Buffer.from('001;Centro;50\n'),chunk=Buffer.alloc(2**20-2**20%row.length).fill(row)
  await file.writeFile(header)
  for(let pending=bytes-header.length;pending>0;pending-=chunk.length)await file.writeFile(chunk.subarray(0,Math.min(chunk.length,pending)))
 }finally{await file.close()}
 app=await electron.launch({executablePath:electronPath,args:[resolve('out/main/index.js')],
  env:{...process.env,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(root,'profile'),FREYALAB_TEST_FOLDER:folder,FREYALAB_TEST_PROJECT_SOURCE_PATH:source}})
 const page=await app.firstWindow()
 await page.setViewportSize({width:1440,height:900})
 await page.waitForFunction(()=>!!window.freya)
 await page.evaluate(async()=>{await window.freya.projectPickFolder();await window.freya.projectCreate('Huella sintética',false)})
 const manifestPath=join(folder,'proyecto.freyalab'),before=await readFile(manifestPath)
 const measured=await page.evaluate(async()=>{
  const {project}=await window.freya.projectState()
  const draft=await window.freya.projectPickSource()
  const request=crypto.randomUUID()
  let cancelAt=null
  const cancel=window.freya.onEvent(({sourceProgress})=>{
   if(sourceProgress?.requestId===request&&sourceProgress.bytes>=sourceProgress.total/2&&sourceProgress.bytes<sourceProgress.total&&cancelAt===null){
    cancelAt=sourceProgress.bytes
    void window.freya.projectCancelSource(request)
   }
  })
  const {encoding,delimiter,header,eol}=draft.format
  const aborted=await window.freya.projectRegisterSource(project.id,draft.id,{encoding,delimiter,header,eol},request)
  cancel()
  return{cancelAt,aborted}
 })
 assert.equal(measured.aborted,false)
 assert.ok(measured.cancelAt>=bytes/2&&measured.cancelAt<bytes)
 assert.deepEqual(await readFile(manifestPath),before)
 await page.getByRole('button',{name:'Añadir fuente…',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Añadir fuente…',exact:true})
 await dialog.getByRole('button',{name:'Añadir y calcular huella',exact:true}).waitFor()
 const captured=process.argv[2]?(async()=>{
  await dialog.getByRole('progressbar').waitFor()
  await page.screenshot({path:process.argv[2],animations:'disabled'})
 })():Promise.resolve()
 await page.evaluate(()=>{
  const gaps=[],events=[],start=performance.now()
  let frame=0,last=start
  const measure=now=>{gaps.push(now-last);last=now;frame=requestAnimationFrame(measure)}
  frame=requestAnimationFrame(measure)
  const unsubscribe=window.freya.onEvent(({sourceProgress})=>{if(sourceProgress)events.push(sourceProgress.bytes)})
  window.finishProjectMeasurement=()=>{cancelAnimationFrame(frame);unsubscribe();const sorted=gaps.slice(1).sort((a,b)=>a-b);return{ms:performance.now()-start,frames:gaps.length,frameP99:sorted[Math.floor(sorted.length*.99)],frameMax:sorted.at(-1),events:events.length,firstBytes:events[0],lastBytes:events.at(-1)}}
 })
 await dialog.getByRole('button',{name:'Añadir y calcular huella',exact:true}).click()
 await dialog.waitFor({state:'hidden'})
 const result=await page.evaluate(()=>window.finishProjectMeasurement())
 await captured
 const [registered]=JSON.parse(await readFile(manifestPath,'utf8')).sources
 assert.equal(registered.bytes,bytes)
 assert.equal(result.lastBytes,bytes)
 assert.equal(registered.schema.columns.length,3)
 console.log(JSON.stringify({arch:arch(),os:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,memoryGiB:totalmem()/2**30,bytes,...measured,...result,sha256:registered.sha256},null,2))
}finally{
 if(app?.process().exitCode===null)await app.evaluate(({app})=>app.exit(0)).catch(()=>{})
 await app?.close().catch(()=>{})
 await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200})
}
