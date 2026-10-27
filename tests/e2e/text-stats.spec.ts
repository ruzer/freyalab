import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,directory:string,serial=0
let runtimeErrors:string[]=[]
interface WorkerProbe {posts:Record<string,unknown>[];replies:Record<string,unknown>[];errors:string[];terminations:number[];hold:boolean;pending:{worker:number;request:number|undefined;deliver:()=>void}[]}
const stats=()=>page.locator('.statusbar .text-stats')
const content=()=>page.locator('.cm-content')
async function instrumentWorkers(){
 await page.evaluate(()=>{
  const target=window as typeof window&{__textStatsProbe?:WorkerProbe};if(target.__textStatsProbe)return
  const probe:WorkerProbe={posts:[],replies:[],errors:[],terminations:[],hold:false,pending:[]};target.__textStatsProbe=probe
  const ids=new WeakMap<Worker,number>();let serial=0
  const id=(worker:Worker)=>{if(!ids.has(worker))ids.set(worker,++serial);return ids.get(worker)!}
  const post=Worker.prototype.postMessage,terminate=Worker.prototype.terminate,descriptor=Object.getOwnPropertyDescriptor(Worker.prototype,'onmessage')!
  Worker.prototype.postMessage=function(message:unknown,...options:unknown[]){
   const data=message as{request?:number;text?:string;selection?:{from?:number;to?:number}|null}
   const item:Record<string,unknown>={worker:id(this),request:data.request,hasText:typeof data.text==='string',textLength:typeof data.text==='string'?data.text.length:null,selection:data.selection?{from:data.selection.from,to:data.selection.to}:null,status:'pending'}
   probe.posts.push(item)
   try{const value=Reflect.apply(post,this,[message,...options]);item.status='sent';return value}
   catch(error){item.status='failed';item.error=String(error);throw error}
  }
  Worker.prototype.terminate=function(){probe.terminations.push(id(this));return Reflect.apply(terminate,this,[])}
  if(!descriptor?.set)throw new Error('Worker.onmessage no tiene descriptor público setter.')
  Object.defineProperty(Worker.prototype,'onmessage',{...descriptor,set:function(this:Worker,callback:Worker['onmessage']){
   const worker=this
   descriptor.set!.call(worker,typeof callback==='function'?function(event:MessageEvent){
    const data=event.data as{request?:number;value?:{words?:number;selected?:number|null};error?:string}
    probe.replies.push({worker:id(worker),request:data.request,words:data.value?.words,selected:data.value?.selected,error:data.error})
    const deliver=()=>callback.call(worker,event)
    if(probe.hold)probe.pending.push({worker:id(worker),request:data.request,deliver});else deliver()
   }:callback)
  }})
  addEventListener('error',event=>probe.errors.push(event.message))
  addEventListener('unhandledrejection',event=>probe.errors.push(String(event.reason)))
 })
}
test.beforeEach(async()=>{
 runtimeErrors=[]
 directory=await mkdtemp(join(tmpdir(),'freya-md003-'));await mkdir(join(directory,'saved'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_SAVE_DIR:join(directory,'saved')}})
 page=await app.firstWindow();page.on('pageerror',error=>runtimeErrors.push(String(error)));await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 if(process.env.FREYALAB_TEXT_STATS_DIAGNOSTIC==='1')await instrumentWorkers()
})
test.afterEach(async()=>{
 if(page){
  const result=await page.evaluate(()=>{const probe=(window as typeof window&{__textStatsProbe?:WorkerProbe}).__textStatsProbe;return probe?{posts:probe.posts,replies:probe.replies,errors:probe.errors,terminations:probe.terminations,pending:probe.pending.map(({worker,request})=>({worker,request})),selection:getSelection()?.toString(),counter:document.querySelector('.text-stats')?.textContent}:null}).catch(error=>({captureError:String(error)}))
  if(result){const value={...result,pageErrors:runtimeErrors};await test.info().attach('worker-diagnostic',{body:Buffer.from(JSON.stringify(value,null,2)),contentType:'application/json'});if(process.env.FREYALAB_TEXT_STATS_DIAGNOSTIC==='1')await writeFile(`/private/tmp/freyalab-lote/3-selection-${test.info().title.includes('CRLF')?'crlf':'lf'}.json`,JSON.stringify(value,null,2))}
 }
 await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})
})
async function open(source:string,extension='md'){
 const path=join(directory,`documento-${++serial}.${extension}`);await writeFile(path,source)
 const [document]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(content()).toBeVisible();return{path,document}
}
async function replace(source:string){await content().click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(source)}
async function current(id:string){return page.evaluate(async id=>(await window.freya.documents()).find(document=>document.id===id),id)}
async function words(count:number){await expect(stats()).toContainText(`${count} palabras`)}
async function selectionProtocol(){
 const result=await page.evaluate(()=>{
  const probe=(window as typeof window&{__textStatsProbe:WorkerProbe}).__textStatsProbe
  return{posts:probe.posts,errors:probe.errors,terminations:probe.terminations}
 })
 const source=result.posts.filter(post=>post.hasText),queries=result.posts.filter(post=>!post.hasText)
 expect(source,'se prepara una sola fuente para este documento').toHaveLength(1)
 expect(queries.length,'la selección consulta el Worker existente').toBeGreaterThan(0)
 expect(queries.every(post=>post.worker===source[0].worker&&post.status==='sent')).toBe(true)
 expect(result.posts.filter(post=>post.status==='failed')).toEqual([])
 expect(result.errors).toEqual([]);expect(runtimeErrors).toEqual([])
 await test.info().attach('protocolo-seleccion-sin-reenvio',{body:Buffer.from(JSON.stringify({sourcePosts:source.length,selectionQueries:queries.length,sourcePostsDuringSelection:0,...result},null,2)),contentType:'application/json'})
}
async function screenshot(name:string){
 if(!process.env.FREYALAB_TEXT_STATS_EVIDENCE_DIR)return
 await expect(page.locator('.preview .render-progress')).toHaveCount(0)
 await mkdir(process.env.FREYALAB_TEXT_STATS_EVIDENCE_DIR,{recursive:true})
 const path=join(process.env.FREYALAB_TEXT_STATS_EVIDENCE_DIR,`md-003-${name}.png`)
 await page.screenshot({path,animations:'disabled'});await test.info().attach(name,{path,contentType:'image/png'})
}

test('W1/W3: escribir Hola mundo muestra dos palabras y menos de un minuto en la barra',async()=>{
 await open('');await content().click();await page.keyboard.insertText('Hola mundo')
 await test.info().attach('barra-basal',{body:Buffer.from(await page.locator('.statusbar').innerHTML()),contentType:'text/html'})
 await expect(stats()).toContainText('2 palabras')
 await expect(stats()).toContainText('< 1 min')
})

test('W2: títulos, listas, tablas y prosa cuentan; YAML, código cercado, indentado y Mermaid se excluyen',async()=>{
 const source='---\ntitle: Palabras del encabezado excluidas\n---\n\n# Informe final\n\nUn párrafo claro.\n\n- uno\n- dos\n\n| Campo | Dato |\n| --- | --- |\n| tres | cuatro |\n\n```python\nno contar estas palabras\n```\n\n```mermaid\nflowchart LR\n A[Oculto] --> B[También]\n```\n\n    código indentado tampoco cuenta\n'
 const {path,document}=await open(source);await words(11)
 expect(await readFile(path,'utf8')).toBe(source);const state=await current(document.id)
 expect(state?.text).toBe(source);expect(state?.dirty).toBe(false)
})

test('W4: selección CRLF al final del documento conserva offsets, Unicode y el original sin cambios pendientes',async()=>{
 await instrumentWorkers()
 const source='Árbol mundo\r\n\r\n```text\r\noculto secreto\r\n```\r\n\r\nFinal listo'
 const {path,document}=await open(source);await words(4)
 await content().focus();await page.keyboard.press('ControlOrMeta+End')
 for(let index=0;index<5;index++)await page.keyboard.press('Shift+ArrowLeft')
 expect(await page.evaluate(()=>getSelection()?.toString())).toBe('listo')
 await expect(stats()).toContainText('1 de 4 palabras')
 await selectionProtocol()
 expect(await readFile(path,'utf8')).toBe(source);const state=await current(document.id)
 expect(state?.text).toBe(source);expect(state?.dirty).toBe(false)
 await page.getByRole('button',{name:'Guardar',exact:true}).click();expect(await readFile(path,'utf8')).toBe(source)
})

test('W4: una selección que cruza código usa las mismas exclusiones que el total',async()=>{
 await instrumentWorkers()
 await open('Hola mundo\n\n```text\noculto secreto\n```\n\nFinal listo');await words(4)
 await content().focus();await page.keyboard.press('ControlOrMeta+Home');await page.keyboard.press('Shift+End')
 await expect(stats()).toContainText('2 de 4 palabras')
 await page.keyboard.press('ControlOrMeta+A');await expect(stats()).toContainText('4 de 4 palabras')
 await page.keyboard.press('ArrowRight');await words(4);await expect(stats()).not.toContainText(' de ')
 await selectionProtocol()
})

test('deshacer y rehacer actualizan el contador y conservan un historial de edición',async()=>{
 const {document}=await open('Hola mundo');await words(2)
 await content().focus();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.insertText(' tres cuatro');await words(4)
 expect((await current(document.id))?.dirty).toBe(true)
 await page.keyboard.press('ControlOrMeta+Z');await words(2)
 expect((await current(document.id))?.text).toBe('Hola mundo')
 await page.keyboard.press(process.platform==='darwin'?'ControlOrMeta+Shift+Z':'ControlOrMeta+Y');await words(4)
 expect((await current(document.id))?.text).toBe('Hola mundo tres cuatro')
})

test('W5: cambiar de documento termina el Worker y descarta una respuesta real anterior retenida',async()=>{
 await instrumentWorkers()
 const first=await open('Inicial breve');await words(2)
 await page.evaluate(()=>{(window as typeof window&{__textStatsProbe:WorkerProbe}).__textStatsProbe.hold=true})
 await replace('obsoleto '.repeat(4000))
 // Retener la respuesta genuina después del cálculo: no se sustituye fuente, dato ni motor.
 await page.waitForFunction(()=>{
  const probe=(window as typeof window&{__textStatsProbe:WorkerProbe}).__textStatsProbe
  return probe.pending.some(pending=>probe.replies.some(reply=>reply.worker===pending.worker&&reply.request===pending.request&&reply.words===4000))
 })
 await expect(stats()).toHaveAttribute('aria-busy','true')
 const held=await page.evaluate(()=>{
  const probe=(window as typeof window&{__textStatsProbe:WorkerProbe}).__textStatsProbe,pending=probe.pending.find(pending=>probe.replies.some(reply=>reply.worker===pending.worker&&reply.request===pending.request&&reply.words===4000))!
  return{worker:pending.worker,request:pending.request,terminations:probe.terminations.length}
 })
 const mutations=await stats().evaluateHandle(node=>{
  const values:string[]=[],observer=new MutationObserver(()=>values.push(node.textContent??''))
  observer.observe(node,{subtree:true,childList:true,characterData:true});return{values,observer}
 })
 await page.evaluate(()=>{(window as typeof window&{__textStatsProbe:WorkerProbe}).__textStatsProbe.hold=false})
 const last=await open('Final estable aquí');await words(3)
 const released=await page.evaluate(()=>{
  const probe=(window as typeof window&{__textStatsProbe:WorkerProbe}).__textStatsProbe,pending=probe.pending.splice(0)
  for(const reply of pending)reply.deliver()
  return{released:pending.length,terminations:[...probe.terminations]}
 })
 expect(released.released).toBeGreaterThan(0);expect(released.terminations.length).toBeGreaterThan(held.terminations);expect(released.terminations).toContain(held.worker)
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
 await words(3);expect((await current(last.document.id))?.text).toBe('Final estable aquí')
 const values=await mutations.evaluate(({values,observer})=>{observer.disconnect();return values});await mutations.dispose()
 await test.info().attach('respuesta-real-retenida',{body:Buffer.from(JSON.stringify({held,released,values},null,2)),contentType:'application/json'})
 expect(values.every(value=>!value.includes('4.000')&&!value.includes('4000'))).toBe(true)
 expect(runtimeErrors).toEqual([]);expect((await readFile(first.path,'utf8'))).toBe('Inicial breve')
 await page.getByRole('tab').filter({hasText:first.document.name}).click()
 await expect(stats()).toContainText(/4[.\s]?000 palabras/)
})

test('W6: el anuncio cortés cambia de documento y permanece estable al escribir o mover la selección',async()=>{
 await open('Hola mundo');await words(2)
 const announcement=page.locator('.statusbar [role="status"][aria-live="polite"]')
 await expect(announcement).toHaveCount(1);await expect(announcement).not.toBeEmpty()
 const before=await announcement.textContent(),observed=await announcement.evaluateHandle(node=>{
  const changes:string[]=[],observer=new MutationObserver(()=>changes.push(node.textContent??''))
  observer.observe(node,{subtree:true,childList:true,characterData:true});return{changes,observer}
 })
 await content().focus();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.insertText(' más');await words(3)
 await page.keyboard.press('Shift+ArrowLeft');await expect(stats()).toContainText(' de ')
 expect(await announcement.textContent()).toBe(before)
 expect(await observed.evaluate(({changes,observer})=>{observer.disconnect();return changes})).toEqual([]);await observed.dispose()
 await open('Uno dos tres cuatro cinco');await words(5)
 await expect(announcement).not.toHaveText(before??'')
})

test('MD y TXT muestran estadísticas también en Vista previa; CSV y Mermaid no las muestran',async()=>{
 await open('Hola mundo');await words(2)
 await page.getByRole('button',{name:'Vista previa',exact:true}).click();await words(2)
 await page.getByRole('button',{name:'Editar',exact:true}).click()
 await open('```text\nHola mundo\n```','txt');await words(3)
 const csv=join(directory,'datos.csv');await writeFile(csv,'nombre,valor\nFreya,1\n')
 await page.evaluate(path=>window.freya.openPaths([path]),csv);await expect(stats()).toHaveCount(0)
 await open('flowchart LR\n A[Inicio] --> B[Fin]','mmd');await expect(stats()).toHaveCount(0)
})

test('W1/W3: puntuación, acentos, vacío y límites de lectura siguen la regla de 200 palabras por minuto',async()=>{
 await open('¡Hola, café! 2026.','txt');await words(3);await expect(stats()).toContainText('< 1 min')
 await open('Hola 世界','txt');await words(2)
 for(const [count,time] of [[0,'< 1 min'],[199,'< 1 min'],[200,'1 min'],[201,'2 min']] as const){
  await open('palabra '.repeat(count),'txt');await words(count);await expect(stats()).toContainText(time)
 }
})

test('una muestra TXT de solo lectura cuenta el primer MiB y lo identifica sin presentar el total del archivo',async()=>{
 // El archivo supera el límite, pero la app solo carga su muestra de 1 MiB: no es un benchmark de edición 10 MiB en CI.
 const line='hola mundo '.repeat(80)+'\n',bytes=10*1024*1024+1,source=Buffer.alloc(bytes,32)
 source.write(line.repeat(Math.floor(bytes/line.length)),0,'ascii')
 const expected=source.subarray(0,1024*1024).toString('utf8').trim().split(/\s+/).length,path=join(directory,'muestra.txt')
 await writeFile(path,source);const [document]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 expect(document.readonly).toBe(true);expect(document.text?.length).toBe(1024*1024)
 await expect(stats()).toContainText(/Muestra/i)
 await expect.poll(async()=>{const value=(await stats().innerText()).match(/([\d.\s\u202f]+)\s+palabras/);return value?Number(value[1].replace(/\D/g,'')):null}).toBe(expected)
 await expect(stats()).toHaveAttribute('title',/primer MiB/i)
 expect((await current(document.id))?.dirty).toBe(false);expect((await readFile(path)).equals(source)).toBe(true)
})

test('W6: ayuda en español, ambos temas y barra sin desbordamiento a 1440 y 1280 px',async()=>{
 await open('# Informe accesible\n\n'+'palabra '.repeat(1240));await expect(stats()).toContainText(/1[.\s]?242 palabras/)
 await expect(stats()).toHaveAttribute('title',/metadatos.*bloques de código/i)
 await expect(stats()).toHaveAttribute('title',/200 palabras por minuto/i)
 for(const theme of ['light','dark'])for(const [width,height] of [[1440,900],[1280,800]]){
  await page.setViewportSize({width,height});await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme)
  const layout=await page.locator('.statusbar').evaluate(node=>{const bar=node.getBoundingClientRect(),stats=node.querySelector('.text-stats')!.getBoundingClientRect();return{bar:{left:bar.left,right:bar.right},stats:{left:stats.left,right:stats.right},overflow:node.scrollWidth-node.clientWidth}})
  expect(layout.overflow).toBeLessThanOrEqual(1);expect(layout.stats.left).toBeGreaterThanOrEqual(layout.bar.left);expect(layout.stats.right).toBeLessThanOrEqual(layout.bar.right+1)
  await screenshot(`${theme}-${width}x${height}`)
 }
})
