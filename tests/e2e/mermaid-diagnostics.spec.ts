import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
let app:ElectronApplication,page:Page,folder:string,serial=0
const valid='flowchart LR\n A[Inicio] --> B[Fin]'
const broken='flowchart LR\n A --> B\n B -->'
const marks=()=>page.locator('.cm-line.cm-diagram-error')
const mode=(name:string)=>page.getByRole('group',{name:'Modo de edición',exact:true}).getByRole('button',{name,exact:true})
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-mer007-'));await mkdir(join(folder,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function open(text:string,extension='mmd'){
 const path=join(folder,`diagnostico-${++serial}.${extension}`);await writeFile(path,text)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.locator('.cm-content')).toBeVisible();return{doc,path}
}
async function replace(text:string){await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(text)}
test('D1 D3 D5 · .mmd marca EOF real, explica al cursor y corregir permite deshacer sin un paso extra',async()=>{
 const {path,doc}=await open(valid);await expect(page.locator('.diagram-svg svg')).toBeVisible()
 await replace(broken);await expect(marks()).toHaveAttribute('data-diagram-line','3')
 await expect(page.locator('.cm-diagram-gutter [role="img"]')).toHaveAttribute('aria-label',/Error de diagrama/)
 // CM oculta sus márgenes al lector: el anuncio equivalente vive fuera de cm-gutters.
 await expect(page.getByRole('status',{name:'Diagnósticos de diagramas'})).toContainText('Línea 3. Falta completar el diagrama.')
 await marks().click();await expect(page.locator('.cm-tooltip-diagram')).toContainText('Falta completar el diagrama.')
 expect(await page.evaluate(async id=>(await window.freya.documents()).find(d=>d.id===id)?.text,doc.id)).toBe(broken)
 expect(await readFile(path,'utf8')).toBe(valid)
 await replace(valid);await expect(marks()).toHaveCount(0);await expect(page.locator('.diagram-notice')).toHaveCount(0)
 await page.keyboard.press('ControlOrMeta+z');await expect(marks()).toHaveAttribute('data-diagram-line','3')
 await page.keyboard.press('ControlOrMeta+Shift+z');await expect(marks()).toHaveCount(0)
})
test('D2 · dos bloques Markdown, lista/cita y cerca larga usan las líneas absolutas',async()=>{
 const text=['# Informe','','> ````mermaid','> flowchart LR','>  A --> B','>  B -->','> ````','','- Diagrama','','  ```mermaid','  flowchart LR','   A --> B','   B -->','  ```'].join('\r\n')
 await open(text,'md');await expect(marks()).toHaveCount(2)
 expect(await marks().evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-diagram-line')))).toEqual(['6','14'])
 await expect(page.locator('.preview .diagram-error')).toHaveCount(2)
})
test('D3 · Editar valida solo los bloques y no publica el article oculto; no quedan marcas antiguas',async()=>{
 const text='# Inicial\n\n```mermaid\n'+valid+'\n```\n';await open(text,'md')
 await expect(page.locator('.preview svg')).toBeVisible();await mode('Editar').click()
 const before=await page.locator('article.markdown-body').innerHTML()
 await replace('# Cambiado\n\n```mermaid\n'+broken+'\n```\n')
 await expect(marks()).toHaveAttribute('data-diagram-line','6');expect(await page.locator('article.markdown-body').innerHTML()).toBe(before)
 await replace('# Sin diagramas\n');await expect(marks()).toHaveCount(0)
 await mode('Dividido').click();await expect(page.locator('.preview h1')).toHaveText('Sin diagramas');await expect(page.locator('.preview .diagram-error')).toHaveCount(0)
})
test('D6 · tamaño sin ubicación da aviso general y ninguna línea inventada',async()=>{
 await open('```mermaid\nflowchart LR\n%% '+'x'.repeat(50_001)+'\n```\n','md')
 await mode('Editar').click();await expect(page.getByRole('status',{name:'Diagnósticos de diagramas'})).toContainText('El diagrama es demasiado grande.')
 await expect(marks()).toHaveCount(0)
})
for(const theme of ['light','dark'])test(`D4 · icono y contraste real en tema ${theme}`,async()=>{
 await open(broken);await page.getByLabel('Tema',{exact:true}).selectOption(theme)
 await expect(marks()).toHaveCount(1)
 const marker=page.locator('.cm-diagram-gutter [role="img"]');await expect(marker).toHaveText('⚠')
 // El marcador tiene fondo opaco: se mide su contraste real sin adivinar el compuesto del tema.
 const contrast=await marker.evaluate(node=>{const style=getComputedStyle(node),rgb=(value:string)=>value.match(/[\d.]+/g)!.slice(0,3).map(Number),lum=(value:string)=>rgb(value).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}).reduce((a,c,i)=>a+c*[.2126,.7152,.0722][i],0);const a=lum(style.color),b=lum(style.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)})
 await test.info().attach('contraste-marca',{body:Buffer.from(JSON.stringify({theme,contrast})),contentType:'application/json'});expect(contrast).toBeGreaterThanOrEqual(3)
 await page.screenshot({path:resolve(`docs/evidence/mer-007-${theme}-1440x900.png`)})
})
test('D3 · una respuesta de error retenida no resucita marcas de otra generación',async()=>{
 const {doc}=await open(valid);await expect(page.locator('.diagram-svg svg')).toBeVisible()
 await page.evaluate(()=>{
  const original=window.setTimeout,held:(()=>unknown)[]=[]
  const win=window as unknown as {mer007Held:(()=>unknown)[];mer007Restore:()=>void};win.mer007Held=held
  window.setTimeout=((handler:TimerHandler,delay?:number,...args:unknown[])=>{
   if(delay===150&&typeof handler==='function'){held.push(()=>handler(...args));return original(()=>{},0)}
   return original(handler,delay,...args)
  }) as typeof window.setTimeout
  win.mer007Restore=()=>{window.setTimeout=original}
 })
 try{
  await replace(broken);await page.waitForFunction(()=>(window as unknown as {mer007Held:unknown[]}).mer007Held.length>0)
  await page.evaluate(()=>(window as unknown as {mer007Restore:()=>void}).mer007Restore())
  const corrected=valid.replace('Fin','Respuesta actual');await replace(corrected)
  await expect(page.locator('.diagram-svg svg')).toContainText(/Respuesta\s*actual/)
  // Ejecuta el callback antiguo DESPUÉS de la respuesta nueva; no depende de cuánto tarde Mermaid.
  await page.evaluate(async()=>{for(const callback of (window as unknown as {mer007Held:(()=>unknown)[]}).mer007Held)await callback()})
  await expect(marks()).toHaveCount(0);await expect(page.locator('.diagram-notice')).toHaveCount(0)
  expect(await page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id)?.text,doc.id)).toBe(corrected)
 }finally{await page.evaluate(()=>(window as unknown as {mer007Restore?:()=>void}).mer007Restore?.())}
})
test('D6 · tipo desconocido sin línea del parser solo muestra un aviso general',async()=>{
 await open('tipoDesconocido\n A --> B')
 await expect(page.locator('.diagram-notice')).toContainText('No se reconoce el tipo de diagrama.')
 await expect(page.getByRole('status',{name:'Diagnósticos de diagramas'})).toContainText('No se reconoce el tipo de diagrama.')
 await expect(marks()).toHaveCount(0)
})
test('D1 · .mmd CRLF marca la línea real sin normalizar la fuente del usuario',async()=>{
 const text=broken.replaceAll('\n','\r\n'),{doc,path}=await open(text)
 await expect(marks()).toHaveAttribute('data-diagram-line','3')
 expect(await page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id)?.text,doc.id)).toBe(text)
 expect(await readFile(path,'utf8')).toBe(text)
})
