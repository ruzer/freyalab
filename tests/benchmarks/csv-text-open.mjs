// Diagnóstico local de TXT-01; Node 24, build actual y una sola sesión Electron.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdir,readFile,readdir,rm,stat,writeFile,appendFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {performance} from 'node:perf_hooks'
import os from 'node:os'
const root=process.cwd(),output=resolve(process.argv[2]??join(os.tmpdir(),`freya-txt-bench-${Date.now()}`)),require=createRequire(join(root,'package.json'))
const { _electron:electron }=require('@playwright/test'),electronPath=require('electron')
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),sha=bytes=>createHash('sha256').update(bytes).digest('hex')
assert.equal(git('status','--porcelain','--','src','package.json','package-lock.json','electron.vite.config.ts'),'','Primero congela las fuentes del producto')
await mkdir(output,{recursive:false});await mkdir(join(output,'files'))
const productFiles=git('ls-files','src','package.json','package-lock.json','electron.vite.config.ts').split('\n'),product={}
for(const path of productFiles)product[path]=sha(await readFile(join(root,path)))
const builtFiles=['out/renderer/index.html','out/preload/index.cjs',...(await readdir(join(root,'out/main'))).filter(name=>name.endsWith('.js')).map(name=>'out/main/'+name),...(await readdir(join(root,'out/renderer/assets'))).filter(name=>/^index-.*\.(js|css)$/.test(name)).map(name=>'out/renderer/assets/'+name)],built={}
for(const path of builtFiles)built[path]=sha(await readFile(join(root,path)))
await writeFile(join(output,'source.json'),JSON.stringify({built,head:git('rev-parse','HEAD'),product,scriptSHA:sha(await readFile(new URL(import.meta.url))),host:{date:new Date().toISOString(),platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0].model,ramBytes:os.totalmem(),node:process.version},protocol:'3 repeticiones, app/perfil nuevo, 250 ms de reposo antes y después, contenido real + doble RAF; memoria=sum workingSetSize KiB de app.getAppMetrics ×1024 menos reposo; sin GC forzado'},null,2))
async function fingerprint(path){const info=await stat(path,{bigint:true});return{sha256:sha(await readFile(path)),size:info.size.toString(),mtimeNs:info.mtimeNs.toString()}}
const fixtures=[]
for(const mib of [2,5,9]){
 const size=mib*1024*1024,header='ID,Nombre,Importe\n',row='00123,Ana,1500.50\n',rows=Math.floor((size-Buffer.byteLength(header)-5)/Buffer.byteLength(row)),remaining=size-Buffer.byteLength(header)-rows*Buffer.byteLength(row),text=header+row.repeat(rows)+'1,'+'x'.repeat(remaining-5)+',0\n',path=join(output,'files',`${mib}MiB.csv`)
 assert.equal(Buffer.byteLength(text),size);await writeFile(path,text);fixtures.push({name:`${mib}MiB`,path,rows:rows+1,fingerprint:await fingerprint(path)})
}
const longPath=join(output,'files','linea-1000000.csv'),longText='ID,Nombre\n00123,'+'x'.repeat(1000000-6)+'\n';await writeFile(longPath,longText)
const long={name:'linea-1000000-bytes',path:longPath,rows:1,fingerprint:await fingerprint(longPath)}
await writeFile(join(output,'fixtures.json'),JSON.stringify([...fixtures,long],null,2))
const pause=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds)),results=[]
async function run(fixture,view,repetition){
 const profile=join(output,`profile-${fixture.name}-${view}-${repetition}`);let app
 try{
  const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
  app=await electron.launch({executablePath:electronPath,chromiumSandbox:true,args:[join(root,'out/main/index.js')],env:{...environment,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:profile}})
  const page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'Abrir',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready.then(()=>true));await pause(250)
  const memory=()=>app.evaluate(({app})=>app.getAppMetrics().map(({pid,type,memory})=>({pid,type,workingSetSize:memory.workingSetSize})))
  const idle=await memory(),before=await fingerprint(fixture.path);assert.deepEqual(before,fixture.fingerprint)
  const start=performance.now(),document=await page.evaluate(async({path,view})=>{const doc=await window.freya.csvOpen(path,view);return{id:doc.id,csvView:doc.csvView,readonly:doc.readonly,rowCount:doc.rowCount,textLength:doc.text?.length}},{path:fixture.path,view})
  assert.equal(document.csvView,view);assert.equal(document.readonly,false)
  if(view==='table'){await page.getByRole('grid',{name:'Tabla de datos',exact:true}).getByRole('gridcell').first().waitFor();assert.equal(await page.getByRole('grid',{name:'Tabla de datos',exact:true}).getByRole('gridcell').first().textContent(),'00123');assert.equal(document.rowCount,fixture.rows)}
  else{await page.getByRole('textbox',{name:'Editor CSV como texto',exact:true}).waitFor();await page.locator('.cm-line').first().waitFor();assert.equal(await page.locator('.cm-line').first().textContent(),fixture===long?'ID,Nombre':'ID,Nombre,Importe');assert.equal(document.textLength,Number(fixture.fingerprint.size));if(fixture===long)await page.waitForFunction(()=>document.querySelectorAll('.cm-line')[1]?.textContent?.startsWith('00123,'))}
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(null)))))
  const visibleMs=performance.now()-start;await pause(250);const loaded=await memory(),sum=values=>values.reduce((total,value)=>{assert(Number.isFinite(value.workingSetSize)&&value.workingSetSize>=0);return total+value.workingSetSize*1024},0),idleBytes=sum(idle),loadedBytes=sum(loaded)
  assert(idleBytes>0&&loadedBytes>0);assert.deepEqual(await fingerprint(fixture.path),before)
  const result={fixture:fixture.name,view,repetition,visibleMs,idleBytes,loadedBytes,extraBytes:loadedBytes-idleBytes,idle,loaded,versions:await app.evaluate(()=>({electron:process.versions.electron,node:process.versions.node,chrome:process.versions.chrome,arch:process.arch})),loadAverage:os.loadavg()};results.push(result);await appendFile(join(output,'results.jsonl'),JSON.stringify(result)+'\n');console.log(JSON.stringify({fixture:result.fixture,view,repetition,visibleMs,extraBytes:result.extraBytes}))
 }finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
}
for(let repetition=1;repetition<=3;repetition++)for(const fixture of fixtures)for(const view of repetition===2?['text','table']:['table','text'])await run(fixture,view,repetition)
for(let repetition=1;repetition<=3;repetition++)await run(long,'text',repetition)
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)],summary=[]
for(const fixture of [...fixtures,long])for(const view of fixture===long?['text']:['table','text']){const rows=results.filter(result=>result.fixture===fixture.name&&result.view===view);assert.equal(rows.length,3);summary.push({fixture:fixture.name,view,visibleMs:median(rows.map(row=>row.visibleMs)),extraMiB:median(rows.map(row=>row.extraBytes))/1024/1024,samples:rows.map(({visibleMs,extraBytes})=>({visibleMs,extraMiB:extraBytes/1024/1024}))})}
for(const [path,hash]of Object.entries({...product,...built}))assert.equal(sha(await readFile(join(root,path))),hash)
await writeFile(join(output,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({complete:true,output,summary}))
