import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,readdir,rm,stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {tmpdir,cpus,totalmem,release} from 'node:os'
import {join,resolve} from 'node:path'
const sha256=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex')
function fixture(label:string,bytes?:number){
 const prefix=`# ED01 ${label} INICIO\n\n`,suffix=`\n\n# ED01 ${label} FIN\n\nFinal visible.\n`,paragraph='CUERPO-ED01: Texto sintetico para comprobar el rango completo de una seccion, sin datos privados. '.repeat(2)+'\n\n'
 if(!bytes)return prefix+paragraph.repeat(32)+suffix
 const available=bytes-Buffer.byteLength(prefix+suffix),repeat=Math.floor(available/paragraph.length),body=paragraph.repeat(repeat)+'X'.repeat(available-repeat*paragraph.length)
 return prefix+body+suffix
}

test('ED-01: tiempos reales de plegar y desplegar con AST preparado, pequeño y 10 MiB',{tag:'@perf'},async()=>{
 test.setTimeout(240000)
 const directory=await mkdtemp(join(tmpdir(),'freya-ed01-perf-'));let app:ElectronApplication|undefined,page:Page
 const snapshots:Record<string,string>={}
 for(const path of ['src/renderer/components/Editor.svelte','src/renderer/lib/markdown-tasks.ts','src/renderer/lib/markdown-editing.ts','package.json','package-lock.json','out/main/index.js','out/renderer/index.html'])snapshots[path]=sha256(await readFile(path))
 for(const file of await readdir('out/renderer/assets'))if(file.endsWith('.js'))snapshots['out/renderer/assets/'+file]=sha256(await readFile(join('out/renderer/assets',file)))
 try{
  const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
  app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(directory,'profile')}})
  page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
  const bootstrap=join(directory,'preparar.md');await writeFile(bootstrap,'# Preparar\n\nEditor.');await page.evaluate(path=>window.freya.openPaths([path]),bootstrap);await page.getByRole('button',{name:'Editar',exact:true}).click()
  const hardware={platform:process.platform,arch:process.arch,release:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,memoryBytes:totalmem(),node:process.version,electron:await app.evaluate(()=>process.versions)},results=[]
  for(const [label,target]of [['PEQUENO',undefined],['GRANDE',10*1024*1024]]as const){
   const source=fixture(label,target),path=join(directory,`${label}.md`);if(target)expect(Buffer.byteLength(source)).toBe(target);await writeFile(path,source);const original=await stat(path),[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path),prepareStarted=performance.now()
   expect(doc.readonly).toBe(false);await page.getByRole('button',{name:'Índice',exact:true}).click()
   const panel=page.getByRole('tabpanel',{name:'Índice del documento',exact:true});await expect(panel.getByRole('button',{name:`ED01 ${label} FIN`,exact:true})).toBeVisible({timeout:120000})
   let navigationAttempts=0
   await expect.poll(async()=>{navigationAttempts++;await panel.getByRole('button',{name:`ED01 ${label} FIN`,exact:true}).click();return await page.locator('.cm-content').evaluate(node=>node===document.activeElement)&&await page.locator('.cm-content .cm-line').filter({hasText:`ED01 ${label} FIN`}).count()>0},{timeout:120000}).toBe(true)
   // goToHeading sólo navega cuando syntaxTreeAvailable cubre toda la fuente exacta.
   await page.getByRole('button',{name:'Índice',exact:true}).click();await expect(panel).not.toBeVisible();await expect(page.locator('.render-progress')).toHaveCount(0,{timeout:120000});await page.locator('.cm-content').focus();await page.keyboard.press('ControlOrMeta+Home')
   await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));const prepareMs=performance.now()-prepareStarted
   async function action(fold:boolean){
    const started=await page.evaluate(()=>performance.now())
    if(fold)await page.locator('.cm-foldGutter [title="Plegar sección"]').first().click();else await page.locator('.cm-foldPlaceholder').click()
    const observed=await page.locator('.cm-content').evaluate((node,{started,label})=>new Promise<{elapsedMs:number;folded:boolean;lastHeadingVisible:boolean;bodyVisible:boolean}>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
     const lines=Array.from(node.querySelectorAll('.cm-line'),line=>line.textContent??'');done({elapsedMs:performance.now()-started,folded:!!node.querySelector('.cm-foldPlaceholder'),lastHeadingVisible:lines.some(line=>line.includes(`ED01 ${label} FIN`)),bodyVisible:lines.some(line=>line.includes('CUERPO-ED01'))})
    }))),{started,label})
    expect(observed.folded).toBe(fold);if(fold)expect(observed.lastHeadingVisible).toBe(true);else expect(observed.bodyVisible).toBe(true)
    return observed
   }
   const first={fold:await action(true),unfold:await action(false)},samples=[]
   for(let i=0;i<5;i++)samples.push({fold:await action(true),unfold:await action(false)})
   const current=(await page.evaluate(()=>window.freya.documents())).find(item=>item.id===doc.id);expect(current?.text).toBe(source);expect(current?.dirty).toBe(false);expect(await readFile(path,'utf8')).toBe(source);const after=await stat(path);expect([after.size,after.mtimeMs,after.ino]).toEqual([original.size,original.mtimeMs,original.ino])
   const median=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]
   results.push({label,bytes:Buffer.byteLength(source),sourceSHA256:sha256(source),prepareMs,navigationAttempts,astPreparation:'Navegar al encabezado final desde el índice enfocó el editor en esa línea; goToHeading exige syntaxTreeAvailable completo y fuente exacta. Índice cerrado antes de medir.',rangeVerified:'Tras plegar el primer encabezado, el encabezado final se vuelve visible; tras desplegar, el cuerpo vuelve a aparecer.',first,samples,medianFoldMs:median(samples.map(value=>value.fold.elapsedMs)),medianUnfoldMs:median(samples.map(value=>value.unfold.elapsedMs)),textUnchanged:true,dirty:false,originalFileUnchanged:true})
  }
  for(const [path,digest]of Object.entries(snapshots))expect(sha256(await readFile(path))).toBe(digest)
  const report={main:{folding:'no disponible en la interfaz',foldMs:null,unfoldMs:null,comparison:'N/D, aprobado por el propietario; no se inventa una operación ni 0 ms.'},method:'Latencia observable desde clic real hasta dos requestAnimationFrame; primera operación y cinco muestras posteriores por separado; preparación del AST excluida.',hardware,snapshots,results,largeVersusSmall:{foldRatio:results[1].medianFoldMs/results[0].medianFoldMs,unfoldRatio:results[1].medianUnfoldMs/results[0].medianUnfoldMs},notVerified:['rendimiento universal','lector de pantalla físico','caché fría del sistema operativo']}
  await test.info().attach('ed01-plegado-tiempos',{body:Buffer.from(JSON.stringify(report,null,2)),contentType:'application/json'})
  if(process.env.FREYALAB_ED01_EVIDENCE==='1')await writeFile('docs/evidence/ed-01-tiempos.json',JSON.stringify(report,null,2)+'\n')
 }finally{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
})
