import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,directory:string
const wide='flowchart LR\n'+Array.from({length:14},(_,index)=>` N${index}[Primer diagrama ${index}] --> N${index+1}[Primer diagrama ${index+1}]`).join('\n')
const tall='sequenceDiagram\n participant A as Universidad\n participant B as Profesional\n'+Array.from({length:22},(_,index)=>index%2?` B-->>A: Confirmación profesional ${index}`:` A->>B: Segundo diagrama ${index}`).join('\n')
const invalid='flowchart LR\n  R[Inválido'
const fixture='# Guía de diagramas\n\nTexto que se conserva.\n\n```mermaid\n'+wide+'\n```\n\n## Segundo\n\n```mermaid\n'+tall+'\n```\n\n## Error explicativo\n\n```mermaid\n'+invalid+'\n```\n'
const article=()=>page.locator('.preview article.markdown-body')
const expand=()=>article().getByRole('button',{name:/Ampliar/i})
const dialog=()=>page.getByRole('dialog')
const drawing=()=>dialog().locator('.diagram-svg svg')
const canvas=()=>dialog().getByRole('region',{name:'Área de desplazamiento del diagrama',exact:true})
const fit=()=>dialog().getByRole('button',{name:'Ajustar',exact:true})
const closeButton=()=>dialog().getByRole('button',{name:/Cerrar/i})

test.beforeEach(async()=>{
 directory=await mkdtemp(join(tmpdir(),'freya-mer010-'));await mkdir(join(directory,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_EXPORT_DIR:join(directory,'exports')}})
 page=await app.firstWindow();await page.waitForLoadState('load');await expect(page.locator('.toolbar')).toBeVisible()
 const browserWindow=await app.browserWindow(page)
 try{await expect.poll(()=>browserWindow.evaluate(window=>window.webContents.isLoading())).toBe(false)}finally{await browserWindow.dispose()}
 await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

async function open(text=fixture,name='manual.md'){
 const path=join(directory,name);await writeFile(path,text)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await page.getByRole('button',{name:'Vista previa',exact:true}).click()
 await expect(article().locator('.mermaid-render svg')).toHaveCount(2);await expect(article().locator('.diagram-error')).toHaveCount(1)
 await expect(page.locator('.preview .render-progress')).toHaveCount(0)
 return{doc,path}
}
async function settled(){await expect(drawing()).toBeVisible();await expect(dialog().locator('.render-progress')).toHaveCount(0)}
async function documentState(id:string){return page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),id)}
async function unchanged(id:string,path:string){const doc=await documentState(id);expect(doc?.text).toBe(fixture);expect(doc?.dirty).toBe(false);expect(await readFile(path,'utf8')).toBe(fixture)}
async function openExpanded(index=0){const origin=expand().nth(index);await origin.click();await expect(dialog()).toBeVisible();await settled();return origin}
async function geometry(){
 return canvas().evaluate(node=>{
  const root=node.querySelector<SVGSVGElement>('svg')!,bounds=root.getBoundingClientRect(),host=node.getBoundingClientRect(),style=getComputedStyle(node)
  const left=host.left+node.clientLeft+parseFloat(style.paddingLeft),top=host.top+node.clientTop+parseFloat(style.paddingTop)
  const width=node.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=node.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)
  return{outside:{left:Math.max(0,left-bounds.left),top:Math.max(0,top-bounds.top),right:Math.max(0,bounds.right-left-width),bottom:Math.max(0,bounds.bottom-top-height)},scale:bounds.width/root.viewBox.baseVal.width,scroll:{left:node.scrollLeft,top:node.scrollTop},overflow:{x:node.scrollWidth-node.clientWidth,y:node.scrollHeight-node.clientHeight}}
 })
}
async function fitted(){await expect.poll(async()=>Math.max(...Object.values((await geometry()).outside))).toBeLessThanOrEqual(1.5);await expect.poll(async()=>Math.max(...Object.values((await geometry()).overflow))).toBeLessThanOrEqual(1)}
async function attached(name:string,value:unknown){await test.info().attach(name,{body:Buffer.from(JSON.stringify(value,null,2)),contentType:'application/json'})}
async function screenshot(theme:string){
 const folder=process.env.FREYALAB_MER_EXPANDED_EVIDENCE_DIR;if(!folder)return
 await mkdir(folder,{recursive:true});const path=join(folder,`mer-010-ampliado-${theme}-1440x900.png`)
 await page.screenshot({path,animations:'disabled'});await test.info().attach(`diálogo-${theme}`,{path,contentType:'image/png'})
}
async function focusInside(){return dialog().evaluate(node=>node.contains(document.activeElement))}
function focusables(modal:Locator){return modal.locator('button:not(:disabled):visible, [href]:visible, input:not(:disabled):visible, select:not(:disabled):visible, textarea:not(:disabled):visible, [tabindex="0"]:visible')}

// El primer rojo contractual debe ser la ausencia de Ampliar, después de renderizar SVG y error reales.
test('V1/V2: solo los dos diagramas válidos ofrecen Ampliar; diálogo accesible y Esc devuelve el foco',async()=>{
 const {doc,path}=await open();await expect(expand()).toHaveCount(2)
 await expect(article().locator('.diagram-error').getByRole('button',{name:/Ampliar/i})).toHaveCount(0)
 const origin=await openExpanded()
 await expect(dialog()).toHaveAttribute('aria-modal','true');await expect(dialog()).toHaveAccessibleName(/flujo|flowchart/i)
 await expect(dialog().locator('.diagram-panel')).toHaveCount(1);await unchanged(doc.id,path)
 await page.keyboard.press('Escape');await expect(dialog()).toHaveCount(0);await expect(origin).toBeFocused()
 await expect(page.locator('dialog .diagram-panel')).toHaveCount(0);await unchanged(doc.id,path)
})

test('V2: Enter abre, Tab y Mayús Tab quedan dentro, Cerrar restaura foco y Esc no cierra otro diálogo',async()=>{
 await open();const origin=expand().first();await origin.focus();await page.keyboard.press('Enter');await settled()
 const controls=focusables(dialog());await expect.poll(()=>controls.count()).toBeGreaterThan(2)
 await controls.first().focus();await page.keyboard.press('Shift+Tab');await expect(controls.last()).toBeFocused()
 await page.keyboard.press('Tab');await expect(controls.first()).toBeFocused()
 for(let index=0;index<8;index++){await page.keyboard.press('Tab');expect(await focusInside()).toBe(true)}
 // Diálogo nativo auxiliar exclusivamente de prueba: Esc debe afectar al superior, no al visor que queda debajo.
 await page.evaluate(()=>{const extra=document.createElement('dialog');extra.id='mer010-dialogo-auxiliar';extra.setAttribute('aria-label','Otro diálogo de prueba');const button=document.createElement('button');button.textContent='Control auxiliar';extra.append(button);document.body.append(extra);extra.showModal()})
 await expect(page.getByRole('dialog',{name:'Otro diálogo de prueba',exact:true})).toBeVisible();await page.keyboard.press('Escape')
 await expect(page.getByRole('dialog',{name:'Otro diálogo de prueba',exact:true})).toHaveCount(0)
 await page.locator('#mer010-dialogo-auxiliar').evaluate(node=>node.remove());await expect(dialog()).toBeVisible()
 await closeButton().click();await expect(dialog()).toHaveCount(0);await expect(origin).toBeFocused()
})

test('V3: el visor existente ajusta, amplía, vuelve al tamaño natural y permite desplazarse',async()=>{
 const {doc,path}=await open();await openExpanded();await fit().click();await fitted()
 await dialog().getByRole('button',{name:'100 %',exact:true}).click();await expect.poll(async()=>(await geometry()).scale).toBeCloseTo(1,2)
 expect((await geometry()).overflow.x).toBeGreaterThan(0);await canvas().focus();await page.keyboard.press('ArrowRight')
 await expect.poll(async()=>(await geometry()).scroll.left).toBeGreaterThan(0)
 await dialog().getByRole('button',{name:'Acercar',exact:true}).click();await expect.poll(async()=>(await geometry()).scale).toBeGreaterThan(1)
 await dialog().getByRole('button',{name:'Alejar',exact:true}).click();await expect.poll(async()=>(await geometry()).scale).toBeCloseTo(1,2)
 await canvas().focus();await page.keyboard.press('ControlOrMeta+0');await fitted()
 expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getZoomFactor())).toBe(1)
 await attached('geometría-ajustada',await geometry());await page.keyboard.press('Escape');await unchanged(doc.id,path)
})

test('V4: el tema del sistema cambia con el diálogo abierto y conserva foco y ajuste',async()=>{
 await page.emulateMedia({colorScheme:'light'});await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption('system')
 await open();const origin=await openExpanded();await fit().click();await fitted()
 const colors=()=>drawing().evaluate(node=>Array.from(node.querySelectorAll('text,.node rect,.edgePath path'),element=>{const style=getComputedStyle(element);return{fill:style.fill,stroke:style.stroke}}))
 const light=await colors();await screenshot('light')
 await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveClass(/dark/);await settled();await fitted()
 await expect.poll(async()=>JSON.stringify(await colors())).not.toBe(JSON.stringify(light));await screenshot('dark')
 await expect(dialog()).toHaveAccessibleName(/flujo|flowchart/i);await closeButton().click();await expect(origin).toBeFocused()
})

test('V5: el segundo botón abre el diagrama de secuencia elegido y no el primero',async()=>{
 const {doc,path}=await open();const origin=await openExpanded(1)
 await expect(dialog()).toHaveAccessibleName(/secuencia|sequence/i);await expect(drawing()).toContainText('Confirmación profesional')
 await expect(drawing()).not.toContainText(/Primer\s*diagrama/);await fit().click();await fitted()
 await dialog().getByRole('button',{name:'100 %',exact:true}).click();expect((await geometry()).overflow.y).toBeGreaterThan(0)
 await closeButton().click();await expect(origin).toBeFocused();await unchanged(doc.id,path)
})

test('V5: una fuente modificada actualiza el visor o avisa, sin mostrar una copia obsoleta en silencio',async()=>{
 const {doc,path}=await open();await openExpanded()
 const updated=fixture.replaceAll('Primer diagrama','Fuente actualizada')
 // API pública existente: actualiza memoria y emite opened para el mismo documento, sin escribir el archivo.
 await page.evaluate(async({id,text,path})=>{await window.freya.update(id,text);await window.freya.openPaths([path])},{id:doc.id,text:updated,path})
 await expect.poll(async()=>{
  const svgUpdated=await drawing().count()>0&&(await drawing().textContent())?.includes('Fuente actualizada')
  const notices=await page.getByRole('status').allTextContents(),alerts=await page.getByRole('alert').allTextContents()
  const warned=[...notices,...alerts].some(text=>/cambi[oó]|actualiz.*diagrama|diagrama.*actualiz|vuelve.*ampliar|ya no.*disponible/i.test(text))
  return!!svgUpdated||warned
 }).toBe(true)
 if(await dialog().isVisible())await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'Editar',exact:true}).click();await expect(page.locator('.cm-content')).toBeVisible()
 expect((await documentState(doc.id))?.text).toBe(updated);expect(await readFile(path,'utf8')).toBe(fixture)
})

test('V5: ampliar el SVG anterior durante el debounce avisa del snapshot obsoleto',async()=>{
 const {doc,path}=await open(),updated=fixture.replaceAll('Primer diagrama','Fuente actualizada durante debounce')
 // Solo se retienen las tareas de 150 ms de esta prueba; no se congela el reloj ni se modifica producto.
 await page.evaluate(()=>{
  const target=window as typeof window&{__mer010HeldTimers?:{count:()=>number;release:()=>void}}
  const originalSet=window.setTimeout,originalClear=window.clearTimeout,held=new Map<number,{handler:TimerHandler;args:unknown[]}>();let serial=-1
  window.setTimeout=((handler:TimerHandler,delay?:number,...args:unknown[])=>{
   if(delay===150){const id=serial--;held.set(id,{handler,args});return id}
   return originalSet(handler,delay,...args)
  }) as typeof window.setTimeout
  window.clearTimeout=((id?:number)=>{if(id===undefined||!held.delete(id))originalClear(id)}) as typeof window.clearTimeout
  target.__mer010HeldTimers={count:()=>held.size,release:()=>{
   window.setTimeout=originalSet;window.clearTimeout=originalClear
   const queue=[...held.values()];held.clear();delete target.__mer010HeldTimers
   for(const {handler,args} of queue)originalSet(handler,0,...args)
  }}
 })
 try{
  await page.evaluate(async({id,text,path})=>{await window.freya.update(id,text);await window.freya.openPaths([path])},{id:doc.id,text:updated,path})
  await expect.poll(()=>page.evaluate(()=>(window as typeof window&{__mer010HeldTimers?:{count:()=>number}}).__mer010HeldTimers?.count()??0)).toBeGreaterThan(0)
  await expect(article().locator('.mermaid-render svg').first()).toContainText(/Primer\s*diagrama/)
  expect((await documentState(doc.id))?.text).toBe(updated)
  await expand().first().click();await expect(dialog()).toBeVisible()
  await expect(dialog().getByRole('status').filter({hasText:/documento cambió/i})).toContainText(/vuelve a ampliar/i)
 }finally{
  await page.evaluate(()=>(window as typeof window&{__mer010HeldTimers?:{release:()=>void}}).__mer010HeldTimers?.release())
 }
 await expect(page.locator('.preview .render-progress')).toHaveCount(0);await settled()
 await closeButton().click();await expect(dialog()).toHaveCount(0)
 await expect(article().locator('.mermaid-render svg').first()).toContainText(/Fuente\s*actualizada\s*durante\s*debounce/)
 expect((await documentState(doc.id))?.text).toBe(updated);expect(await readFile(path,'utf8')).toBe(fixture)
})

test('V5: cerrar la pestaña limpia elimina el diálogo y permite editar el siguiente documento',async()=>{
 const {path}=await open();await openExpanded();await page.keyboard.press('ControlOrMeta+W')
 await expect(dialog()).toHaveCount(0);await expect(page.locator('dialog .diagram-panel')).toHaveCount(0)
 await expect(page.getByRole('tablist',{name:'Documentos abiertos',exact:true}).getByRole('tab')).toHaveCount(0)
 const next=join(directory,'siguiente.md');await writeFile(next,'Texto editable después del visor.\n');const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),next)
 await page.getByRole('button',{name:'Editar',exact:true}).click();await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.insertText('Continuación')
 await expect.poll(async()=>(await documentState(doc.id))?.text).toContain('Continuación');expect(await readFile(path,'utf8')).toBe(fixture)
})

test('pantalla pequeña: diálogo contenido en el viewport, ajuste válido y cierre por teclado',async()=>{
 await page.setViewportSize({width:720,height:600});await open();await openExpanded(1);await fit().click();await fitted()
 const bounds=await dialog().boundingBox();expect(bounds).not.toBeNull();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.y).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(721);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(601)
 expect(await drawing().evaluate(node=>node.getAttribute('style')??'')).not.toMatch(/NaN|Infinity/);await page.keyboard.press('Escape');await expect(dialog()).toHaveCount(0)
})

test('exportación HTML e impresión: el documento conserva sus SVG sin botones ni diálogo ampliado',async()=>{
 const {doc,path}=await open();await openExpanded()
 // Es emulación CSS de impresión en Chromium, no una prueba de impresora ni de un PDF exportado.
 await page.emulateMedia({media:'print'});await expect(page.locator('dialog[open]')).toBeHidden();await expect(article().locator('.mermaid-render svg').first()).toBeVisible()
 await page.emulateMedia({media:'screen'});await expect(dialog()).toBeVisible();await closeButton().click()
 await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByRole('button',{name:'HTML autónomo',exact:true}).click()
 await expect.poll(async()=>(await readdir(join(directory,'exports'))).filter(name=>name.endsWith('.html')).length).toBe(1)
 const [name]=(await readdir(join(directory,'exports'))).filter(name=>name.endsWith('.html')),html=await readFile(join(directory,'exports',name),'utf8')
 const exported=await page.evaluate(html=>{const doc=new DOMParser().parseFromString(html,'text/html');return{svg:doc.querySelectorAll('svg').length,errors:doc.querySelectorAll('.diagram-error').length,controls:doc.querySelectorAll('button,dialog,[aria-modal],.diagram-toolbar').length,scripts:doc.querySelectorAll('script').length,text:doc.body.textContent??''}},html)
 expect(exported.svg).toBe(2);expect(exported.errors).toBe(1);expect(exported.controls).toBe(0);expect(exported.scripts).toBe(0);expect(exported.text).not.toMatch(/Ampliar|Cerrar vista ampliada/)
 await unchanged(doc.id,path)
})
