import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,folder:string,id:string,serial=0
const valid='flowchart LR\n  A[Inicio] --> B[Fin]'
const broken='flowchart LR\n  A[Inicio] --> B[Fin'
const content=()=>page.locator('.cm-content')
const notice=()=>page.locator('.diagram-notice')
const status=()=>notice().getByRole('status')
const drawing=()=>page.locator('.diagram-svg')
const source=()=>page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id)?.text,id)

test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-mer001-'));await mkdir(join(folder,'saved'));await mkdir(join(folder,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function open(text=valid,extension='mmd'){
 const path=join(folder,`diagrama-${++serial}.${extension}`);await writeFile(path,text)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);id=doc.id;await expect(content()).toBeVisible();return{doc,path}
}
async function replace(text:string){await content().click();await page.keyboard.press('ControlOrMeta+A');if(text)await page.keyboard.insertText(text);else await page.keyboard.press('Backspace');await expect.poll(source).toBe(text)}
async function settled(){await expect(page.locator('.diagram-panel .render-progress')).toHaveCount(0)}
async function spanishError(){
 await expect(notice()).toBeVisible();await expect(status()).toHaveAttribute('aria-live','polite')
 expect(await notice().innerText()).not.toMatch(/Parse error|Expecting|No diagram type detected|Lexical error|got ['"]/i)
 expect(await page.locator('body').innerText()).not.toMatch(/Parse error on line|No diagram type detected|Lexical error/i)
 await expect(notice().locator('details')).not.toHaveAttribute('open','')
}

// Se usa el renderizador real, sin simular Mermaid ni retrasar artificialmente sus respuestas.
test('último dibujo válido: romper y corregir conserva SVG atenuado, aviso español y selección de fuente',async()=>{
 await open();await expect(drawing().locator('svg')).toBeVisible();await settled()
 const previous=await drawing().locator('svg').evaluate(node=>node.outerHTML)
 await replace(broken);await spanishError();await settled()
 await expect(status()).toContainText('Mostrando la última versión válida.')
 await expect(drawing()).toHaveAttribute('inert','');await expect(drawing()).toHaveAttribute('aria-hidden','true')
 expect(await drawing().locator('svg').evaluate(node=>node.outerHTML)).toBe(previous)
 expect(Number(await drawing().evaluate(node=>getComputedStyle(node).opacity))).toBeCloseTo(.45,2)
 for(const label of ['Alejar','Acercar','Ajustar'])await expect(page.getByRole('button',{name:label,exact:true})).toBeDisabled()
 await notice().getByText('Ver detalle técnico',{exact:true}).click()
 const raw=await notice().locator('details pre').innerText(),line=/Parse error on line\s+(\d+)/i.exec(raw)
 expect(line).not.toBeNull();await expect(status()).toContainText(new RegExp(`línea ${line![1]}(?:\\D|$)`,'i'))
 await replace('flowchart LR\n  A[Corregido] --> B[Guardado]');await expect(notice()).toHaveCount(0);await expect(drawing()).not.toHaveAttribute('inert','');await expect(drawing()).toContainText('Corregido')
 await expect(page.getByRole('button',{name:'Acercar',exact:true})).toBeEnabled();expect(await source()).toContain('Corregido')
})

for(const [format,label] of [['svg','Imagen SVG'],['png','Imagen PNG'],['pdf','Documento PDF']]){
 test(`exportación ${format}: el error bloquea la última vista válida sin crear archivos ni cambiar el texto`,async()=>{
  const {path}=await open();await expect(drawing().locator('svg')).toBeVisible();await replace(broken);await spanishError();await settled()
  await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByRole('button',{name:label,exact:true}).click()
  await expect(page.locator('.toast')).toContainText('Corrige el diagrama antes de exportar.');await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await readdir(join(folder,'exports'))).toEqual([]);expect(await source()).toBe(broken);expect(await readFile(path,'utf8')).toBe(valid)
 })
}

test('exportar inmediatamente después de romper la fuente espera el render pendiente y no guarda el dibujo anterior',async()=>{
 await open();await expect(drawing().locator('svg')).toBeVisible();await settled()
 await content().click();await page.keyboard.press('ControlOrMeta+A')
 const started=Date.now();await page.keyboard.insertText(broken)
 // Los clics DOM, sin esperas entre ellos, permiten pulsar antes del debounce real de 150 ms.
 const result=await page.evaluate(async started=>{
  const click=(label:string)=>{const button=Array.from(document.querySelectorAll<HTMLButtonElement>('.toolbar button')).find(node=>node.textContent?.trim()===label);if(!button)throw new Error(`Falta el control ${label}`);button.click()}
  click('Exportar');await Promise.resolve();const rendering=!!document.querySelector('.diagram-panel .render-progress');click('Imagen SVG');return{elapsedMs:Date.now()-started,rendering}
 },started)
 await test.info().attach('tiempo-hasta-exportar',{body:Buffer.from(JSON.stringify(result)),contentType:'application/json'})
 expect(result.rendering).toBe(true)
 await expect(page.locator('.toast')).toContainText('Corrige el diagrama antes de exportar.');expect(await readdir(join(folder,'exports'))).toEqual([]);expect(await source()).toBe(broken)
})

test('cerrar una pestaña limpia mientras espera exportar cancela la salida de su vista destruida',async()=>{
 const {path,doc}=await open()
 const result=await page.evaluate(async name=>{
  const started=Date.now()
  const click=(label:string)=>{const button=Array.from(document.querySelectorAll<HTMLButtonElement>('.toolbar button')).find(node=>node.textContent?.trim()===label);if(!button)throw new Error(`Falta el control ${label}`);button.click()}
  click('Exportar');await Promise.resolve();click('Imagen SVG')
  for(let i=0;i<4;i++)await Promise.resolve()
  const waiting=Array.from(document.querySelectorAll<HTMLButtonElement>('.toolbar button')).some(node=>node.textContent?.includes('Exportando'))
  const close=Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-close')).find(node=>node.getAttribute('aria-label')===`Cerrar ${name}`);if(!close)throw new Error('Falta el botón para cerrar la pestaña');close.click()
  return{waiting,elapsedMs:Date.now()-started}
 },doc.name)
 await test.info().attach('cierre-durante-exportacion',{body:Buffer.from(JSON.stringify(result)),contentType:'application/json'})
 expect(result.waiting).toBe(true)
 await expect(page.getByRole('tab')).toHaveCount(0);await expect(page.locator('.toast')).toContainText('Corrige el diagrama antes de exportar.')
 expect(await readdir(join(folder,'exports'))).toEqual([]);expect(await readFile(path,'utf8')).toBe(valid)
})

test('primer error: ejemplo mínimo seleccionable por teclado y detalle técnico plegado sin inglés visible',async()=>{
 await open(broken);await spanishError();await expect(drawing()).toHaveCount(0)
 const example=page.getByRole('textbox',{name:'Ejemplo mínimo Mermaid',exact:true})
 await expect(example).toHaveValue('flowchart LR\n  A --> B');await expect(example).toHaveAttribute('readonly','')
 await example.focus();await page.keyboard.press('ControlOrMeta+A')
 expect(await example.evaluate(node=>{const input=node as HTMLTextAreaElement;return input.value.slice(input.selectionStart,input.selectionEnd)})).toBe('flowchart LR\n  A --> B')
 const summary=notice().getByText('Ver detalle técnico',{exact:true});await summary.focus();await page.keyboard.press('Enter')
 await expect(notice().locator('details')).toHaveAttribute('open','');await expect(notice().locator('details pre')).toContainText('Parse error')
 await page.keyboard.press('Enter');await expect(notice().locator('details')).not.toHaveAttribute('open','');expect(await source()).toBe(broken)
})

test('fuente vacía y espacios: ayuda en español sin dibujo ficticio ni modificación del archivo',async()=>{
 const {path}=await open('');await spanishError();await expect(status()).toContainText(/escrib|vacío|definición/i);await expect(drawing()).toHaveCount(0)
 await replace('   \n\t');await spanishError();await expect(drawing()).toHaveCount(0);expect(await source()).toBe('   \n\t');expect(await readFile(path,'utf8')).toBe('')
})

test('Markdown: varios errores, línea relativa al bloque y HTML técnico tratado como texto',async()=>{
 const payload='<img src=x onerror="window.__mermaidInjected=1">'
 await open('# Informe\n\nTexto previo.\n\n```mermaid\n'+broken+'\n```\n\n```mermaid\nnoExiste '+payload+'\n```\n\n```mermaid\n'+valid+'\n```\n','md')
 const blocks=page.locator('.markdown-body .diagram-error');await expect(blocks).toHaveCount(2);await expect(page.locator('.markdown-body .mermaid-render svg')).toBeVisible()
 for(const block of await blocks.all()){
  expect(await block.innerText()).not.toMatch(/Parse error|Expecting|No diagram type detected|Lexical error/i)
  const details=block.locator('details');await expect(details).not.toHaveAttribute('open','')
  await block.getByText('Ver detalle técnico',{exact:true}).click();await expect(details).toHaveAttribute('open','')
 }
 const raw=await blocks.first().locator('details pre').innerText(),line=/Parse error on line\s+(\d+)/i.exec(raw);expect(line).not.toBeNull()
 const explanation=await blocks.first().locator('details').evaluate(node=>{const clone=node.parentElement!.cloneNode(true) as HTMLElement;clone.querySelectorAll('details').forEach(details=>details.remove());return clone.textContent})
 expect(explanation).toMatch(new RegExp(`línea ${line![1]} del diagrama`,'i'))
 // Mermaid cambia las comillas dobles por simples antes de producir este error.
 await expect(blocks.nth(1).locator('details pre')).toContainText('<img src=x onerror=');await expect(blocks.nth(1).locator('details pre')).toContainText('window.__mermaidInjected=1');await expect(blocks.locator('img,script')).toHaveCount(0)
 expect(await page.evaluate(()=>(window as unknown as Record<string,unknown>).__mermaidInjected)).toBeUndefined()
 await expect(page.locator('.markdown-body p').first()).toHaveText('Texto previo.')
})

test('error sin parpadeo ni anuncios repetidos: el status permanece mientras cambia solo el detalle',async()=>{
 await open('tipoDesconocido');await spanishError();await settled()
 await status().evaluate(node=>{
  node.setAttribute('data-mer001-identity','original')
  const state=window as unknown as {mer001Announcements:number};state.mer001Announcements=0
  new MutationObserver(()=>state.mer001Announcements++).observe(node,{childList:true,characterData:true,subtree:true})
 })
 await replace('tipoDesconocidoExtra');await settled();await expect(notice().locator('details pre')).toContainText('tipoDesconocidoExtra')
 await expect(status()).toHaveAttribute('data-mer001-identity','original');expect(await page.evaluate(()=>(window as unknown as {mer001Announcements:number}).mer001Announcements)).toBe(0)
 await replace(broken);await spanishError();await expect(notice().locator('details pre')).toContainText('Parse error');await settled()
 expect(await page.evaluate(()=>(window as unknown as {mer001Announcements:number}).mer001Announcements)).toBeGreaterThan(0)
})

test('Markdown: cambiar un párrafo o detalle conserva el anunciador y descarta renders obsoletos',async()=>{
 const markdown=(text:string,diagram:string)=>`# Informe\n\n${text}\n\n\`\`\`mermaid\n${diagram}\n\`\`\`\n`
 await open(markdown('Texto inicial.','tipoDesconocido'),'md')
 const preview=page.locator('.preview'),announcer=preview.getByRole('status'),block=preview.locator('.diagram-error')
 await expect(block).toBeVisible();await expect(announcer).toHaveAttribute('aria-live','polite');await expect(announcer).toContainText('Diagrama 1.')
 await announcer.evaluate(node=>{
  node.setAttribute('data-mer001-identity','original')
  const state=window as unknown as {mer001MarkdownAnnouncements:number};state.mer001MarkdownAnnouncements=0
  new MutationObserver(()=>state.mer001MarkdownAnnouncements++).observe(node,{childList:true,characterData:true,subtree:true})
 })
 await replace(markdown('Texto corregido.','tipoDesconocidoExtra'))
 await expect(preview.locator('.markdown-body p').first()).toHaveText('Texto corregido.');await expect(block.locator('details pre')).toContainText('tipoDesconocidoExtra')
 await expect(announcer).toHaveAttribute('data-mer001-identity','original');expect(await page.evaluate(()=>(window as unknown as {mer001MarkdownAnnouncements:number}).mer001MarkdownAnnouncements)).toBe(0)
 const large='flowchart TD\n'+Array.from({length:80},(_,i)=>`N${i}[Paso ${i}] --> N${i+1}`).join('\n')
 await replace(markdown('Solicitud anterior.',large));await page.waitForTimeout(170)
 await replace(markdown('Solicitud rota.',broken));await replace(markdown('Solicitud final.','flowchart LR\n  A[Final] --> B[Lista]'))
 await expect(preview.locator('.mermaid-render')).toContainText('Final',{timeout:40_000});await expect(block).toHaveCount(0);await expect(preview.locator('.render-progress')).toHaveCount(0);await expect(announcer).toBeEmpty()
 await page.waitForTimeout(250);await expect(block).toHaveCount(0);await expect(preview.locator('.markdown-body p').first()).toHaveText('Solicitud final.')
})

test('debounce y generaciones: termina con la fuente más nueva sin que aparezca un error obsoleto',async()=>{
 await open();await expect(drawing().locator('svg')).toBeVisible()
 const large='flowchart TD\n'+Array.from({length:80},(_,i)=>`N${i}[Paso ${i}] --> N${i+1}`).join('\n')
 await replace(large);await page.waitForTimeout(170) // permite iniciar un render real antes de solicitar las versiones siguientes
 await replace(broken);await replace('flowchart LR\n  A[Versión final] --> B[Lista]')
 await expect(drawing()).toContainText('Versión final',{timeout:40_000});await settled();await expect(notice()).toHaveCount(0)
 await page.waitForTimeout(250);await expect(notice()).toHaveCount(0);await expect(drawing()).not.toHaveAttribute('inert','')
})

test('diagrama superior al límite real de Mermaid: no sustituye la última vista por un error SVG ni permite exportarlo',async()=>{
 await open('flowchart LR\n  A[Maximum text size in diagram exceeded] --> B[Etiqueta válida]');await expect(drawing().locator('svg')).toBeVisible();await expect(notice()).toHaveCount(0);await expect(drawing()).toContainText(/Maximum\s*text\s*size\s*in\s*diagram\s*exceeded/)
 for(const length of [49_999,50_000]){
  const base=`flowchart LR\n  A[${length}] --> B[Fin]\n%% `,boundary=base+'x'.repeat(length-base.length)
  expect(boundary.length).toBe(length);await replace(boundary);await settled();await expect(notice()).toHaveCount(0);await expect(drawing()).toContainText(String(length));await expect(drawing()).not.toContainText('Maximum text size')
 }
 const previous=await drawing().locator('svg').evaluate(node=>node.outerHTML)
 const large='flowchart LR\n  A[Inicio] --> B[Fin]\n%% '+ 'x'.repeat(50_001)
 await replace(large);await spanishError();await settled()
 expect(await drawing().locator('svg').evaluate(node=>node.outerHTML)).toBe(previous)
 await expect(drawing()).toHaveAttribute('inert','');await expect(status()).not.toContainText('Maximum text size')
 await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByRole('button',{name:'Imagen SVG',exact:true}).click()
 await expect(page.locator('.toast')).toContainText('Corrige el diagrama antes de exportar.');expect(await readdir(join(folder,'exports'))).toEqual([])
 expect(await source()).toBe(large)
})

test('tema con error activo: conserva el dibujo, aviso accesible y contraste en claro y oscuro',async()=>{
 await open();await expect(drawing().locator('svg')).toBeVisible();await replace(broken);await spanishError();await settled()
 const previous=await drawing().locator('svg').evaluate(node=>node.outerHTML)
 for(const theme of ['light','dark']){
  await page.getByLabel('Tema',{exact:true}).selectOption(theme);await spanishError();await settled()
  expect(await drawing().locator('svg').evaluate(node=>node.outerHTML)).toBe(previous)
  await expect(status()).toHaveAttribute('aria-live','polite')
  const colors=await status().evaluate(node=>{
   const channels=(value:string)=>value.match(/[\d.]+/g)!.map(Number),stack:number[][]=[]
   for(let current:Element|null=node;current;current=current.parentElement)stack.unshift(channels(getComputedStyle(current).backgroundColor))
   let background=[255,255,255];for(const color of stack){const alpha=color[3]??1;background=background.map((value,index)=>color[index]*alpha+value*(1-alpha))}
   return{foreground:channels(getComputedStyle(node).color).slice(0,3),background}
  })
  const luminance=(rgb:number[])=>rgb.map(channel=>{const value=channel/255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)
  const values=[luminance(colors.foreground),luminance(colors.background)].sort((a,b)=>a-b),ratio=(values[1]+.05)/(values[0]+.05)
  expect(ratio).toBeGreaterThanOrEqual(4.5);await test.info().attach(`contraste-${theme}`,{body:Buffer.from(JSON.stringify({theme,...colors,ratio})),contentType:'application/json'})
  if(process.env.FREYALAB_MER_EVIDENCE)await page.screenshot({path:resolve(`docs/evidence/mer-001-${theme}-1440x900.png`)})
 }
})
