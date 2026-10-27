import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,directory:string,serial=0
const wide='flowchart LR\n'+Array.from({length:14},(_,index)=>` N${index}[Etapa ${index}] --> N${index+1}[Etapa ${index+1}]`).join('\n')
const tall='sequenceDiagram\n participant A as Universidad\n participant B as Profesional\n'+Array.from({length:22},(_,index)=>index%2?` B-->>A: Respuesta ${index}`:` A->>B: Consulta ${index}`).join('\n')
const canvas=()=>page.getByRole('region',{name:'Área de desplazamiento del diagrama',exact:true})
const svg=()=>page.locator('.diagram-svg svg')
const fit=()=>page.getByRole('button',{name:'Ajustar',exact:true})
const natural=()=>page.getByRole('button',{name:'100 %',exact:true})

test.beforeEach(async()=>{
 directory=await mkdtemp(join(tmpdir(),'freya-mer008-'));await mkdir(join(directory,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_EXPORT_DIR:join(directory,'exports')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function open(source:string,name=`diagrama-${++serial}`){
 const path=join(directory,`${name}.mmd`);await writeFile(path,source)
 const [document]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(svg()).toBeVisible();await settled();return document
}
async function settled(){await expect(page.locator('.diagram-panel .render-progress')).toHaveCount(0)}
async function geometry(){
 return canvas().evaluate(node=>{
  const element=node as HTMLElement,root=node.querySelector<SVGSVGElement>('svg')!,bounds=root.getBoundingClientRect(),host=node.getBoundingClientRect(),style=getComputedStyle(node)
  const left=host.left+node.clientLeft+parseFloat(style.paddingLeft),top=host.top+node.clientTop+parseFloat(style.paddingTop)
  const width=node.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=node.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)
  const viewBox=root.viewBox.baseVal,percentage=Array.from(document.querySelectorAll('.diagram-toolbar>span'),span=>span.textContent??'').find(value=>/\d+(?:[.,]\d+)?\s*%/.test(value))??''
  return{available:{left,top,width,height},svg:{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height},viewBox:{width:viewBox.width,height:viewBox.height},outside:{left:Math.max(0,left-bounds.left),top:Math.max(0,top-bounds.top),right:Math.max(0,bounds.right-left-width),bottom:Math.max(0,bounds.bottom-top-height)},center:{x:bounds.left+bounds.width/2-left-width/2,y:bounds.top+bounds.height/2-top-height/2},overflow:{x:node.scrollWidth-node.clientWidth,y:node.scrollHeight-node.clientHeight},scrollbar:{x:Math.max(0,element.offsetHeight-node.clientHeight-parseFloat(style.borderTopWidth)-parseFloat(style.borderBottomWidth)),y:Math.max(0,element.offsetWidth-node.clientWidth-parseFloat(style.borderLeftWidth)-parseFloat(style.borderRightWidth))},scroll:{left:node.scrollLeft,top:node.scrollTop},percentage,scale:{x:bounds.width/viewBox.width,y:bounds.height/viewBox.height}}
 })
}
async function evidence(name:string){
 const result=await geometry();await test.info().attach(name,{body:Buffer.from(JSON.stringify(result,null,2)),contentType:'application/json'})
 if(process.env.FREYALAB_MER_FIT_EVIDENCE_DIR){const folder=process.env.FREYALAB_MER_FIT_EVIDENCE_DIR;await mkdir(folder,{recursive:true});await writeFile(join(folder,`2-${process.env.FREYALAB_MER_FIT_PHASE??'run'}-${name}.json`),JSON.stringify(result,null,2))}
 return result
}
async function fitted(name:string){
 // Son límites geométricos; no hay esperas o umbrales absolutos de rendimiento.
 await expect.poll(async()=>Math.max(...Object.values((await geometry()).outside))).toBeLessThanOrEqual(1.5)
 await expect.poll(async()=>Math.max(...Object.values((await geometry()).overflow))).toBeLessThanOrEqual(1)
 await expect.poll(async()=>Math.max(...Object.values((await geometry()).scrollbar))).toBeLessThanOrEqual(1)
 const result=await evidence(name)
 expect(Math.abs(result.center.x),'centrado horizontal dentro del área sin relleno').toBeLessThanOrEqual(2)
 expect(Math.abs(result.center.y),'centrado vertical dentro del área sin relleno').toBeLessThanOrEqual(2)
 return result
}
async function percentageMatches(){
 const result=await geometry(),display=Number(result.percentage.replace('%','').replace(/\./g,'').replace(',','.').trim())
 expect(Number.isFinite(display)).toBe(true);expect(display).toBeGreaterThan(0)
 expect(Math.abs(display-result.scale.x*100)).toBeLessThanOrEqual(.51)
 expect(Math.abs(result.scale.x-result.scale.y)).toBeLessThanOrEqual(.005)
}
async function screenshot(name:string){
 if(!process.env.FREYALAB_MER_FIT_EVIDENCE_DIR)return
 const path=join(process.env.FREYALAB_MER_FIT_EVIDENCE_DIR,`2-${process.env.FREYALAB_MER_FIT_PHASE??'run'}-${name}.png`)
 await page.screenshot({path,animations:'disabled'});await test.info().attach(name,{path,contentType:'image/png'})
}

for(const fixture of [{name:'ancho',source:wide},{name:'alto',source:tall}]){
 test(`J1: Ajustar encuadra el diagrama ${fixture.name} completo, centrado y sin desplazamiento`,async()=>{
  await open(fixture.source);await fit().click()
  await evidence(`basal-${fixture.name}`)
  await fitted(`ajustado-${fixture.name}`)
 })
}

test('J2/J4: fit sigue el tamaño del panel hasta que se cambia el zoom manualmente',async()=>{
 await open(wide);await fit().click();const first=await fitted('fit-inicial');await percentageMatches()
 const resizer=page.getByRole('slider',{name:'Ancho del editor',exact:true});await resizer.focus()
 for(let index=0;index<5;index++)await page.keyboard.press('ArrowRight')
 const narrow=await fitted('fit-panel-estrecho');expect(narrow.scale.x).toBeLessThan(first.scale.x);await percentageMatches()
 await page.setViewportSize({width:1280,height:800});await fitted('fit-1280x800');await percentageMatches()
 await page.getByRole('button',{name:'Acercar',exact:true}).click();const manual=await geometry()
 await page.setViewportSize({width:1440,height:900})
 await expect.poll(async()=>Math.abs((await geometry()).scale.x-manual.scale.x)).toBeLessThan(.005)
 await percentageMatches();await evidence('manual-tras-resize')
})

test('J3/J5: 100 % restaura escala natural y origen; atajos se usan con foco en el lienzo',async()=>{
 async function localShortcut(shortcut:string){
  await page.keyboard.press(shortcut)
  expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getZoomFactor()),'el atajo local no cambia el zoom global de Electron').toBe(1)
 }
 await open(tall);await fit().click();await fitted('teclado-fit-inicial')
 await natural().click()
 await expect.poll(async()=>(await geometry()).scale.x).toBeCloseTo(1,2)
 await canvas().evaluate(node=>node.scrollTo({left:100,top:400}))
 expect((await geometry()).scroll.top).toBeGreaterThan(0)
 await natural().click();const original=await evidence('natural-boton')
 expect(original.scroll).toEqual({left:0,top:0});await percentageMatches()
 await canvas().focus();await localShortcut('ControlOrMeta+0');await fitted('teclado-ajustar');await expect(canvas()).toBeFocused()
 await localShortcut('ControlOrMeta+1');await expect.poll(async()=>(await geometry()).scale.x).toBeCloseTo(1,2)
 await localShortcut('ControlOrMeta+Shift+Equal');await expect.poll(async()=>(await geometry()).scale.x).toBeGreaterThan(1)
 await localShortcut('ControlOrMeta+Minus');await percentageMatches()
 for(const name of ['Ajustar','100 %','Acercar','Alejar'])await expect(page.getByRole('button',{name,exact:true})).toBeEnabled()
})

test('el modo ajustado se conserva al volver a la pestaña y cambiar modos o tema',async()=>{
 const first=await open(tall,'alto');await fit().click();await fitted('pestana-alto-inicial')
 await open(wide,'ancho');await fit().click();await fitted('pestana-ancho')
 await page.getByRole('tab',{name:first.name,exact:true}).click();await expect(svg()).toBeVisible();await settled()
 await page.setViewportSize({width:1280,height:800});await fitted('pestana-alto-regreso')
 await page.getByRole('button',{name:'Editar',exact:true}).click();await expect(canvas()).toBeHidden()
 await page.getByRole('button',{name:'Vista previa',exact:true}).click();await fitted('modo-vista-previa')
 await page.getByRole('button',{name:'Dividido',exact:true}).click();await fitted('modo-dividido')
 await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption('dark');await settled();await fitted('tema-oscuro-ajustado');await percentageMatches()
})

test('J4: un diagrama con cientos de nodos puede ajustarse por debajo del antiguo mínimo del 20 %',async()=>{
 test.setTimeout(180_000)
 const source='flowchart TB\n'+Array.from({length:250},(_,index)=>` N${index}[Registro ${index}] --> N${index+1}[Registro ${index+1}]`).join('\n')
 await open(source);await fit().click();const result=await fitted('250-nodos')
 expect(result.scale.x).toBeGreaterThan(0);expect(result.scale.x).toBeLessThan(.2);await percentageMatches()
})

test('viewBox ausente, geometría 1×1 y panel temporalmente cerrado no generan dimensiones inválidas',async()=>{
 await open('flowchart LR\n A[Único]');await fit().click();await fitted('un-nodo')
 await svg().evaluate(node=>{node.removeAttribute('viewBox')})
 await fit().click()
 const without=await svg().evaluate(node=>{const rect=node.getBoundingClientRect();return{width:rect.width,height:rect.height,style:node.getAttribute('style')??''}})
 expect(Number.isFinite(without.width)&&Number.isFinite(without.height)).toBe(true);expect(without.style).not.toMatch(/NaN|Infinity/)
 await svg().evaluate(node=>{node.setAttribute('viewBox','0 0 1 1');node.setAttribute('width','1');node.setAttribute('height','1')})
 await fit().click();await fitted('geometria-1x1');await percentageMatches()
 const previous=await canvas().evaluate(node=>({host:node.getAttribute('style'),parent:node.parentElement!.getAttribute('style')}))
 await canvas().evaluate(node=>{node.style.width='0px';node.style.height='0px';node.parentElement!.style.display='none'})
 await fit().click();expect(await page.locator('.diagram-svg').getAttribute('style')).not.toMatch(/NaN|Infinity/)
 await page.locator('.diagram-canvas').evaluate((node,previous)=>{if(previous.host===null)node.removeAttribute('style');else node.setAttribute('style',previous.host);if(previous.parent===null)node.parentElement!.removeAttribute('style');else node.parentElement!.setAttribute('style',previous.parent)},previous)
 await fit().click();await fitted('panel-restaurado')
})

test('un documento vacío mantiene la ayuda de error y no permite ajustar un dibujo inexistente',async()=>{
 const path=join(directory,'vacio.mmd');await writeFile(path,'')
 await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.locator('.diagram-empty')).toBeVisible()
 for(const name of ['Ajustar','100 %','Acercar','Alejar'])await expect(page.getByRole('button',{name,exact:true})).toBeDisabled()
 await expect(svg()).toHaveCount(0)
})

test('ajustar no modifica la fuente ni el SVG exportado que guarda el renderizador',async()=>{
 const doc=await open(tall)
 async function exported(){
  const name=doc.name.replace(/\.mmd$/,'.svg'),path=join(directory,'exports',name);await rm(path,{force:true})
  await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByRole('button',{name:'Imagen SVG',exact:true}).click()
  await expect.poll(()=>readdir(join(directory,'exports'))).toContain(name);return readFile(path,'utf8')
 }
 const before=await exported();await fit().click();await fitted('sin-cambiar-exportacion');await natural().click()
 expect(await exported()).toBe(before)
 const current=await page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),doc.id)
 expect(current?.text).toBe(tall);expect(current?.dirty).toBe(false)
})

test('J1–J5: ambos temas y tamaños conservan encuadre y controles; capturas 1440×900 y 1280×800',async()=>{
 await open(tall)
 for(const theme of ['light','dark'])for(const [width,height] of [[1440,900],[1280,800]]){
  await page.setViewportSize({width,height});await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme);await settled();await fit().click()
  await fitted(`${theme}-${width}x${height}`);await percentageMatches();await screenshot(`fit-${theme}-${width}x${height}`)
 }
})

test('el ajuste sigue siendo geométrico al aumentar el zoom de Chromium al 150 %',async()=>{
 await open(tall);const initial=await page.evaluate(()=>window.devicePixelRatio)
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1.5))
 await expect.poll(()=>page.evaluate(()=>window.devicePixelRatio)).toBeGreaterThan(initial)
 await fit().click();await fitted('zoom-chromium-150');await percentageMatches()
 // Es zoom de Chromium en una ventana aislada: no acredita ajustes físicos de monitor/OS.
})

test('zoom manual desde un ajuste 1×1 mantiene la dirección de acercar y alejar',async()=>{
 await open('flowchart LR\n A[Único]')
 await svg().evaluate(node=>node.setAttribute('viewBox','0 0 1 1'));await fit().click()
 const initial=(await geometry()).scale.x;expect(initial).toBeGreaterThan(5)
 await page.getByRole('button',{name:'Acercar',exact:true}).click()
 await expect.poll(async()=>(await geometry()).scale.x).toBeGreaterThan(initial)
 const enlarged=(await geometry()).scale.x
 await page.getByRole('button',{name:'Alejar',exact:true}).click()
 await expect.poll(async()=>(await geometry()).scale.x).toBeLessThan(enlarged)
 expect((await geometry()).scale.x).toBeCloseTo(initial,1)
})
