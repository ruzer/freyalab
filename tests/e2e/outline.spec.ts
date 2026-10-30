import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import type {EditorView} from '@codemirror/view'

let app:ElectronApplication,page:Page,directory:string,id:string,serial=0
const preview=()=>page.getByRole('document',{name:'Vista previa del documento',exact:true,includeHidden:true})
const outline=()=>page.getByRole('tabpanel',{name:'Índice del documento',exact:true})
const indexTab=()=>page.locator('aside.sidebar').getByRole('tab',{name:'Índice',exact:true})
const filesTab=()=>page.locator('aside.sidebar').getByRole('tab',{name:'Archivos',exact:true})
const outlineScroll=()=>page.locator('#freya-outline-panel .document-outline')
const current=()=>outline().locator('[aria-current="location"]')
const source=()=>page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id)?.text,id)
test.beforeEach(async()=>{
 directory=await mkdtemp(join(tmpdir(),'freya-md007-'));await mkdir(join(directory,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 const resourceGate=!process.env.FREYALAB_EXECUTABLE&&test.info().title.includes('recursos tardíos')
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve(resourceGate?'tests/e2e/outline-image-gate.cjs':'out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_EXPORT_DIR:join(directory,'exports'),...(resourceGate?{FREYALAB_TEST_OUTLINE_GATE:'1',FREYALAB_TEST_OUTLINE_MAIN:resolve('out/main/index.js'),FREYALAB_TEST_OUTLINE_ROOT:resolve('.')} :test.info().title.includes('recursos tardíos')?{FREYALAB_TEST_IMAGE_DELAY_MS:'1500'}:{})}})
 page=await app.firstWindow();await page.waitForLoadState('load');await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900});await expect(page.locator('.app-shell .toolbar')).toBeVisible();await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.isLoading())).toBe(false)
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function frames(){await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))}
async function settled(){await expect(preview().locator('.render-progress')).toHaveCount(0);await page.evaluate(()=>document.fonts.ready.then(()=>{}));await frames()}
async function open(text:string,wait=true){const path=join(directory,`indice-${++serial}.md`);await writeFile(path,text);const[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);id=doc.id;await expect(page.getByRole('tab',{name:doc.name,exact:true})).toHaveAttribute('aria-selected','true');await indexTab().click();await expect(outline()).toBeVisible();await expect(page.locator('.markdown-body')).not.toBeEmpty();if(wait)await settled();return{path,doc}}
const paragraphs=(count:number)=>'Texto de la sección para explorar el índice.\n\n'.repeat(count)
async function geometry(){return preview().evaluate(node=>{
 const box=node.getBoundingClientRect(),top=(node as HTMLElement).scrollTop,height=(node as HTMLElement).clientHeight
 return{top,height,max:(node as HTMLElement).scrollHeight-height,headings:Array.from(node.querySelectorAll<HTMLElement>('article h1,article h2,article h3,article h4,article h5,article h6')).filter(h=>h.checkVisibility()&&h.getBoundingClientRect().height>0).map(h=>({id:h.id,text:h.textContent??'',top:h.getBoundingClientRect().top-box.top-node.clientTop+top}))}
})}
async function expected(){const data=await geometry();if(!data.headings.length)return'';if(data.max>0&&data.max-data.top<=1)return data.headings.at(-1)!.text;return data.headings.filter(h=>h.top<=data.top+.3*data.height).at(-1)?.text??''}
async function scrollTo(top:number){return preview().evaluate((node,top)=>{const started=performance.now();(node as HTMLElement).scrollTop=top;return started},top)}
async function threshold(text:string,delta=1){const data=await geometry(),heading=data.headings.find(h=>h.text===text);expect(heading).toBeDefined();const top=heading!.top-.3*data.height+delta;expect(top).toBeGreaterThan(0);expect(top).toBeLessThan(data.max);const started=await scrollTo(top);await frames();return{top,started,heading:heading!,height:data.height}}
async function scrollIdle(){await preview().evaluate(node=>new Promise<void>(resolve=>{let previous=(node as HTMLElement).scrollTop,equal=0;function sample(){const next=(node as HTMLElement).scrollTop;equal=Math.abs(next-previous)<.01?equal+1:0;previous=next;if(equal>=3)resolve();else requestAnimationFrame(sample)}requestAnimationFrame(sample)}))}
async function evidence(name:string,value:unknown){await test.info().attach(name,{body:Buffer.from(JSON.stringify(value,null,2)),contentType:'application/json'});if(process.env.FREYALAB_OUTLINE_EVIDENCE_DIR){await mkdir(process.env.FREYALAB_OUTLINE_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.FREYALAB_OUTLINE_EVIDENCE_DIR,`${name}-${process.env.FREYALAB_OUTLINE_PHASE??'run'}.json`),JSON.stringify(value,null,2))}}
async function screenshot(theme:string,block:'a'|'b'|'c'='a'){if(process.env.FREYALAB_OUTLINE_SCREENSHOTS==='1'&&process.env.FREYALAB_OUTLINE_EVIDENCE_DIR){await mkdir(process.env.FREYALAB_OUTLINE_EVIDENCE_DIR,{recursive:true});const path=join(process.env.FREYALAB_OUTLINE_EVIDENCE_DIR,`7-${block}-outline-${theme}-1440x900.png`);await page.screenshot({path,animations:'disabled'});await test.info().attach(theme,{path,contentType:'image/png'})}}
async function exportHTML(name:string){const target=join(directory,'exports',name);await app.evaluate((_,path)=>{process.env.FREYALAB_TEST_EXPORT_PATH=path},target);await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByRole('button',{name:'HTML autónomo',exact:true}).click();await expect.poll(()=>readFile(target,'utf8').catch(()=>''),{timeout:30_000}).toContain('<!doctype html>');return readFile(target,'utf8')}
async function replaceSource(text:string){await page.locator('.cm-content').focus();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(text);await expect.poll(source).toBe(text);await settled()}
async function editMode(){await page.getByRole('group',{name:'Modo de edición',exact:true}).getByRole('button',{name:'Editar',exact:true}).click();await expect(outline()).toBeVisible();await frames()}
async function editorSnapshot(){return page.locator('.cm-content').evaluate(node=>{
 // Adaptador exclusivo de prueba: la versión instalada usa cmTile; versiones previas usan cmView.
 const owner=node as HTMLDivElement&{cmTile?:{view:EditorView};cmView?:{view:EditorView}},view=owner.cmTile?.view??owner.cmView?.view
 if(!view)throw new Error('No encontré la vista CodeMirror montada')
 const selection=view.state.selection.main,line=view.state.doc.lineAt(selection.head),box=view.scrollDOM.getBoundingClientRect(),top=box.top+view.scrollDOM.clientTop
 const first=Array.from(node.querySelectorAll<HTMLElement>('.cm-line')).find(element=>{const rect=element.getBoundingClientRect();return rect.bottom>top+.5&&rect.top<box.bottom})
 const firstLine=first?view.state.doc.lineAt(view.posAtDOM(first)).number:undefined
 const cursor=view.coordsAtPos(line.from)
 return{from:selection.from,to:selection.to,head:selection.head,line:line.number,lineFrom:line.from,lineText:line.text,lineTop:view.lineBlockAt(line.from).top+view.documentTop-top,cursorTop:cursor?cursor.top-top:null,firstLine,focused:view.hasFocus,composing:view.composing,compositionStarted:view.compositionStarted,scrollTop:view.scrollDOM.scrollTop,domSelection:getSelection()?.toString()??''}
})}

test('A1/A7: el índice tiene nombre accesible y no marca sección antes del primer umbral',async()=>{
 const original='Introducción antes del primer título.\n\n'.repeat(30)+'# Primero\n\nContenido.\n\n# Segundo\n\nFin.',{path}=await open(original)
 const diagnostic={tabpanelCount:await outline().count(),ariaLabel:await outline().getAttribute('aria-label'),currentCount:await current().count(),rightOutlineCount:await page.locator('aside.outline').count()}
 await test.info().attach('indice-basal',{body:Buffer.from(JSON.stringify(diagnostic,null,2)),contentType:'application/json'})
 if(process.env.FREYALAB_OUTLINE_EVIDENCE_DIR){await mkdir(process.env.FREYALAB_OUTLINE_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.FREYALAB_OUTLINE_EVIDENCE_DIR,`7-a-${process.env.FREYALAB_OUTLINE_PHASE??'run'}.json`),JSON.stringify(diagnostic,null,2))}
 await expect(outline()).toBeVisible();await expect(current()).toHaveCount(0)
 expect(await source()).toBe(original);expect(await readFile(path,'utf8')).toBe(original)
})

test('A1/A2: la sección cambia al cruzar el 30 % medido con geometría real',async()=>{
 await open(Array.from({length:6},(_,i)=>`## Sección ${i+1}\n\n${paragraphs(12)}`).join(''))
 const before=await threshold('Sección 3',-2);await expect(current()).toHaveText('Sección 2')
 const after=await threshold('Sección 3',2);await expect(current()).toHaveText('Sección 3')
 const observed=await page.evaluate(started=>performance.now()-started,after.started)
 await evidence('7-a-umbral',{before,after,observedMsAfterTwoAnimationFrames:observed,timingScope:'Asignación de scroll y dos rAF observados mediante Playwright; no CPU pura del handler.'})
})

test('A2: rueda, teclado, índice y enlace interno mantienen la sección actual',async()=>{
 const original='[Ir a última](#última)\n\n# Inicio\n\n'+paragraphs(25)+'## Medio\n\n'+paragraphs(25)+'## Última\n\nFin.';await open(original)
 await outline().getByRole('button',{name:'Inicio',exact:true}).click();await scrollIdle();await expect(current()).toHaveText('Inicio')
 const first=(await geometry()).top;await page.keyboard.press('PageDown');await expect.poll(async()=>(await geometry()).top).toBeGreaterThan(first);await scrollIdle();await expect(current()).toHaveText(await expected())
 await preview().hover();await page.mouse.wheel(0,550);await scrollIdle();await expect(current()).toHaveText(await expected())
 await outline().getByRole('button',{name:'Medio',exact:true}).click();await scrollIdle();await expect(current()).toHaveText('Medio')
 await page.locator('.markdown-body').getByRole('link',{name:'Ir a última',exact:true}).click();await scrollIdle();await expect(current()).toHaveText('Última')
 expect(await source()).toBe(original)
})

test('A4: al final se marca el último título aunque nunca alcance el umbral',async()=>{
 await open('# Inicio\n\n'+paragraphs(40)+'## Último título\n\nFin.')
 const data=await geometry(),last=data.headings.at(-1)!
 expect(last.top-data.max).toBeGreaterThan(.3*data.height)
 await scrollTo(data.max);await frames();await expect(current()).toHaveText('Último título')
})

test('A6: títulos de details cerrado no cuentan; abrir y cerrar reconstruye la geometría',async()=>{
 await open('# Antes\n\n'+paragraphs(12)+'<details><summary>Más contenido</summary>\n\n## Oculto\n\n'+paragraphs(30)+'</details>\n\n# Después\n\n'+paragraphs(12))
 const details=page.locator('.markdown-body details').first(),hidden=page.locator('.markdown-body h2').filter({hasText:'Oculto'})
 const hiddenGeometry=await hidden.evaluate(node=>{const rect=node.getBoundingClientRect();return{rects:node.getClientRects().length,rect:{top:rect.top,height:rect.height,width:rect.width},visible:node.checkVisibility(),detailsOpen:(node.closest('details') as HTMLDetailsElement|null)?.open}})
 await evidence('7-a-hidden-dom',hiddenGeometry);expect(hiddenGeometry.visible).toBe(false)
 await outline().getByRole('button',{name:'Después',exact:true}).click();await scrollIdle();await expect(current()).toHaveText('Después')
 await outline().getByRole('button',{name:'Oculto',exact:true}).click();await expect(details).toHaveAttribute('open','');await scrollIdle();await expect(current()).toHaveText('Oculto')
 await details.locator('summary').click();await expect(details).not.toHaveAttribute('open','');await frames();await expect(current()).not.toHaveText('Oculto');await expect(current()).toHaveText(await expected())
 await details.locator('summary').click();await frames();await threshold('Oculto');await expect(current()).toHaveText('Oculto')
})

test('A6: el último título DOM cerrado nunca gana la sección al final del documento',async()=>{
 await open('# Visible\n\nTexto visible.\n\n<details><summary>Más</summary>\n\n## Último oculto\n\nTexto interior.\n\n</details>\n\n'+paragraphs(45))
 const details=page.locator('.markdown-body details').first(),hidden=page.locator('.markdown-body h2')
 const inspect=()=>hidden.evaluate(node=>{const rect=node.getBoundingClientRect();return{rects:node.getClientRects().length,rect:{top:rect.top,height:rect.height,width:rect.width},visible:node.checkVisibility(),detailsOpen:(node.closest('details') as HTMLDetailsElement|null)?.open}})
 const before=await inspect();expect(before.visible).toBe(false)
 await details.locator('summary').click();await expect(details).toHaveAttribute('open','');await frames();expect((await inspect()).visible).toBe(true)
 await details.locator('summary').click();await expect(details).not.toHaveAttribute('open','');await frames()
 const after=await inspect();expect(after.visible).toBe(false);await evidence('7-a-hidden-last-dom',{before,after})
 await scrollTo((await geometry()).max);await frames();await expect(current()).toHaveText('Visible')
})

test('A5: recursos tardíos recalculan posiciones sin retrasar el texto saneado',async()=>{
 await writeFile(join(directory,'alta.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="800"><rect width="200" height="800" fill="#007aff"/></svg>')
 const diagram='flowchart TD\n'+Array.from({length:22},(_,i)=>` A${i} --> A${i+1}`).join('\n')
 await open('# Inicio\n\n'+paragraphs(8)+'![Imagen alta](alta.svg)\n\n## Después de imagen\n\n```mermaid\n'+diagram+'\n```\n\n## Después de diagrama\n\n'+paragraphs(25),false)
 await expect(page.locator('.markdown-body')).toContainText('Después de imagen');await expect(preview().locator('.render-progress')).toBeVisible()
 if(!process.env.FREYALAB_EXECUTABLE)await expect.poll(()=>app.evaluate(()=>((globalThis as typeof globalThis&{__freyaA5Gate:{state:()=>{waiting:number}}}).__freyaA5Gate.state().waiting))).toBeGreaterThan(0)
 expect(await page.locator('.markdown-body img').getAttribute('src')).toBeNull()
 const before=await geometry();await threshold('Después de imagen');await expect(current()).toHaveText('Después de imagen')
 if(!process.env.FREYALAB_EXECUTABLE)await app.evaluate(()=>((globalThis as typeof globalThis&{__freyaA5Gate:{release:()=>void}}).__freyaA5Gate.release()))
 await expect(page.locator('.markdown-body img')).toHaveAttribute('src',/^data:/);await expect(page.locator('.mermaid-render svg')).toBeVisible({timeout:40_000});await settled()
 const after=await geometry();expect(after.headings.find(h=>h.text==='Después de imagen')!.top-before.headings.find(h=>h.text==='Después de imagen')!.top).toBeGreaterThan(500)
 await expect(current()).toHaveText(await expected());await threshold('Después de diagrama');await expect(current()).toHaveText('Después de diagrama')
 await evidence('7-a-recursos',{before,after})
})

test('A3/A5: mil títulos no provocan lecturas de headings DOM durante scroll y la fila se desplaza lo mínimo',async()=>{
 await open(Array.from({length:1000},(_,i)=>`## Sección ${i+1}\n\nContenido breve.\n\n`).join(''))
 const data=await geometry(),row=outline().getByRole('button',{name:'Sección 500',exact:true})
 const before=await outlineScroll().evaluate((node,row)=>{if(!row)throw new Error('No existe la fila del índice.');const outer=node.getBoundingClientRect(),inner=row.getBoundingClientRect();return{scroll:node.scrollTop,needed:inner.bottom-(outer.top+node.clientTop+node.clientHeight)}},await row.elementHandle())
 await scrollTo(data.headings[499].top-.3*data.height+1);await frames();await expect(current()).toHaveText('Sección 500');await expect(row).toBeInViewport()
 expect(Math.abs(await outlineScroll().evaluate(node=>node.scrollTop)-before.scroll-before.needed)).toBeLessThan(1.5)
 await page.evaluate(()=>{
  const rectangle=HTMLElement.prototype.getBoundingClientRect,query=Element.prototype.querySelectorAll,docQuery=Document.prototype.querySelectorAll
  const probe={rectangles:0,queries:0,stop:()=>{HTMLElement.prototype.getBoundingClientRect=rectangle;Element.prototype.querySelectorAll=query;Document.prototype.querySelectorAll=docQuery}}
  ;(window as typeof window&{outlineProbe?:typeof probe}).outlineProbe=probe
  HTMLElement.prototype.getBoundingClientRect=function(this:HTMLElement){if(/^H[1-6]$/.test(this.tagName)&&this.closest('.markdown-body'))probe.rectangles++;return rectangle.call(this)}
  Element.prototype.querySelectorAll=function(this:Element,selector:string){if(this.matches('.markdown-body,.preview'))probe.queries++;return query.call(this,selector)} as typeof query
  Document.prototype.querySelectorAll=function(this:Document,selector:string){if(/\bh[1-6]\b|\[id/i.test(selector))probe.queries++;return docQuery.call(this,selector)} as typeof docQuery
 })
 for(const index of [599,699,799,899]){await scrollTo(data.headings[index].top-.3*data.height+1);await frames()}
 const counts=await page.evaluate(()=>{const probe=(window as typeof window&{outlineProbe?:{rectangles:number;queries:number;stop:()=>void}}).outlineProbe!;probe.stop();return{headingRectangles:probe.rectangles,headingQueries:probe.queries}})
 expect(counts).toEqual({headingRectangles:0,headingQueries:0});await expect(current()).toHaveText('Sección 900')
 await evidence('7-a-operaciones-scroll',{titles:1000,scrollEventsRequested:4,counts})
})

test('A: usar el índice no modifica la fuente, dirty ni el HTML exportado',async()=>{
 const original='# Inicio\n\n'+paragraphs(15)+'<details><summary>Más</summary>\n\n## Interior\n\n'+paragraphs(15)+'</details>\n\n## Final\n\nFin.',{path}=await open(original)
 const before=await exportHTML('antes.html');await outline().getByRole('button',{name:'Interior',exact:true}).click();await scrollIdle();await expect(current()).toHaveText('Interior')
 const after=await exportHTML('despues.html');expect(after).toBe(before);expect(await source()).toBe(original);expect(await readFile(path,'utf8')).toBe(original)
 expect(await page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id)?.dirty,id)).toBe(false)
 await expect(page.locator('.markdown-body [aria-current],.markdown-body [data-heading-id]')).toHaveCount(0)
})

test('A: indicador visible en claro/oscuro dentro de la barra izquierda',async()=>{
 await open(Array.from({length:35},(_,i)=>`## Sección ${i+1}\n\n${paragraphs(3)}`).join(''))
 const styles=[]
 for(const theme of ['light','dark']){
  await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme);await settled();await threshold('Sección 18');await expect(current()).toHaveText('Sección 18')
  const transition=await current().evaluate(node=>({background:getComputedStyle(node).backgroundColor,color:getComputedStyle(node).color,animations:node.getAnimations().length}))
  await current().evaluate(node=>Promise.all(node.getAnimations().map(animation=>animation.finished.catch(()=>{}))))
  const measured=await current().evaluate(node=>{
   const style=getComputedStyle(node),canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d')!
   function rgb(value:string){ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3)}
   const luminance=(values:number[])=>values.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)
   const text=rgb(style.color),background=rgb(style.backgroundColor),a=luminance(text),b=luminance(background)
   return{text,background,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),boxShadow:style.boxShadow,fontWeight:style.fontWeight}
  })
  await evidence(`7-a-contraste-${theme}`,{transition,measured})
  expect(measured.contrast).toBeGreaterThanOrEqual(4.5);expect(measured.boxShadow).toMatch(/inset/);expect(measured.boxShadow).toContain('2px');styles.push({theme,...measured})
  await current().focus();await screenshot(theme)
 }
 expect((await page.locator('aside.sidebar').boundingBox())!.width).toBe(240)
 for(const width of[1100,850]){await page.setViewportSize({width,height:900});await expect(outline()).toBeVisible();expect((await page.locator('aside.sidebar').boundingBox())!.width).toBe(240);await expect(page.locator('aside.outline')).toHaveCount(0)}
 await evidence('7-a-estilos',styles)
})

test('A: cambiar a un documento sin títulos no conserva una sección obsoleta',async()=>{
 await open('# Primero\n\n'+paragraphs(25));await expect(current()).toHaveText('Primero')
 await open('Documento sin títulos.');await expect(outline()).toBeVisible();await expect(outline()).toContainText('Este documento no tiene títulos');await expect(current()).toHaveCount(0)
 await open('# Otro\n\n'+paragraphs(25));await expect(current()).toHaveText('Otro')
})

test('A3: al reaparecer el panel, la sección que cambió oculta queda visible',async()=>{
 await open(Array.from({length:100},(_,i)=>`## H${String(i+1).padStart(3,'0')}\n\nx\n\n`).join('')+'cola\n\n'.repeat(35))
 await filesTab().click();await expect(outline()).toBeHidden()
 await scrollTo((await geometry()).max);await frames()
 await indexTab().click();await expect(outline()).toBeVisible()
 await expect(current()).toHaveText('H100');await expect(current()).toBeInViewport()
})
test('B1/B2: contraer una rama oculta descendientes y mantiene botones separados',async()=>{
 await open('# Manual\n\n## Introducción\n\nTexto.\n\n### Requisitos\n\nTexto.\n\n## Configuración\n\nTexto.\n\n# Apéndice\n\nFin.')
 await evidence('7-b-baseline',{buttons:await outline().getByRole('button').allTextContents(),collapseButtons:await outline().getByRole('button',{name:'Contraer sección Manual',exact:true}).count()})
 const collapse=outline().getByRole('button',{name:'Contraer sección Manual',exact:true});await expect(collapse).toBeVisible()
 await expect(collapse).toHaveAttribute('aria-expanded','true');await expect(outline().getByRole('button',{name:'Manual',exact:true})).toBeVisible()
 await collapse.click();await expect(outline().getByRole('button',{name:'Expandir sección Manual',exact:true})).toHaveAttribute('aria-expanded','false')
 await expect(outline().getByRole('button',{name:'Introducción',exact:true})).toHaveCount(0);await expect(outline().getByRole('button',{name:'Requisitos',exact:true})).toHaveCount(0)
 await expect(outline().getByRole('button',{name:'Introducción',exact:true,includeHidden:true}).locator('..')).toHaveAttribute('hidden','')
 await expect(outline().getByRole('button',{name:'Apéndice',exact:true})).toBeVisible()
 await outline().getByRole('button',{name:'Expandir sección Manual',exact:true}).click();await expect(outline().getByRole('button',{name:'Requisitos',exact:true})).toBeVisible()
})

test('B1: niveles ausentes y saltos no crean filas vacías y conservan la jerarquía',async()=>{
 await open('## Solo nivel dos\n\n### Hijo de dos\n\n# Raíz\n\n### Salto nivel tres\n\n## Hermana nivel dos\n\n### Nieta\n\n# Fin\n')
 await expect(outline().locator('.outline-row')).toHaveCount(7)
 const indent=(name:string)=>outline().getByRole('button',{name,exact:true}).locator('..').evaluate(node=>Number.parseFloat((node as HTMLElement).style.paddingLeft))
 expect(await indent('Hijo de dos')).toBeGreaterThan(await indent('Solo nivel dos'))
 expect(await indent('Salto nivel tres')).toBe(await indent('Hermana nivel dos'));expect(await indent('Nieta')).toBeGreaterThan(await indent('Hermana nivel dos'))
 await outline().getByRole('button',{name:'Contraer sección Raíz',exact:true}).click()
 for(const name of ['Salto nivel tres','Hermana nivel dos','Nieta'])await expect(outline().getByRole('button',{name,exact:true})).toHaveCount(0)
 await expect(outline().getByRole('button',{name:'Hijo de dos',exact:true})).toBeVisible();await expect(outline().getByRole('button',{name:'Fin',exact:true})).toBeVisible()
})

test('B1/B5: títulos repetidos en otros padres y hermanos tienen contracción independiente',async()=>{
 await open('# Uno\n\n## Repetido\n\n### Hijo primero\n\n# Dos\n\n## Repetido\n\n### Hijo segundo\n\n## Repetido\n\n### Hijo tercero\n')
 const controls=outline().getByRole('button',{name:'Contraer sección Repetido',exact:true});await expect(controls).toHaveCount(3);await controls.nth(1).click()
 await expect(outline().getByRole('button',{name:'Hijo segundo',exact:true})).toHaveCount(0)
 await expect(outline().getByRole('button',{name:'Hijo primero',exact:true})).toBeVisible();await expect(outline().getByRole('button',{name:'Hijo tercero',exact:true})).toBeVisible()
 await outline().getByRole('button',{name:'Expandir sección Repetido',exact:true}).click();await expect(outline().getByRole('button',{name:'Hijo segundo',exact:true})).toBeVisible()
})

test('B2/B3: Tab recorre flecha y título; Intro y Espacio alternan sin perder el foco',async()=>{
 await open('# Manual\n\n## Hijo\n\nTexto.\n\n# Otro\n\nFin.')
 const collapse=()=>outline().getByRole('button',{name:'Contraer sección Manual',exact:true}),expand=()=>outline().getByRole('button',{name:'Expandir sección Manual',exact:true})
 await collapse().focus();await page.keyboard.press('Tab');await expect(outline().getByRole('button',{name:'Manual',exact:true})).toBeFocused()
 await page.keyboard.press('Shift+Tab');await expect(collapse()).toBeFocused();await page.keyboard.press('Enter');await expect(expand()).toBeFocused();await expect(expand()).toHaveAttribute('aria-expanded','false')
 await page.keyboard.press('Tab');await expect(outline().getByRole('button',{name:'Manual',exact:true})).toBeFocused();await page.keyboard.press('Tab');await expect(outline().getByRole('button',{name:'Otro',exact:true})).toBeFocused()
 await page.keyboard.press('Shift+Tab');await page.keyboard.press('Shift+Tab');await expect(expand()).toBeFocused();await page.keyboard.press('Space');await expect(collapse()).toBeFocused();await expect(collapse()).toHaveAttribute('aria-expanded','true')
 await expect(outline().getByRole('button',{name:'Hijo',exact:true})).toBeVisible()
})

test('B4: se marca el ancestro cerrado sin expandirlo y se recupera el hijo al abrir',async()=>{
 await open('# Raíz\n\n'+paragraphs(8)+'## Rama\n\n'+paragraphs(8)+'### Interior\n\n'+paragraphs(25)+'# Después\n\n'+paragraphs(10))
 await threshold('Interior');await expect(current()).toHaveText('Interior');const top=(await geometry()).top
 await outline().getByRole('button',{name:'Contraer sección Rama',exact:true}).click();await expect(current()).toHaveText('Rama');await expect(outline().getByRole('button',{name:'Expandir sección Rama',exact:true})).toHaveAttribute('aria-expanded','false')
 expect(Math.abs((await geometry()).top-top)).toBeLessThan(1)
 await outline().getByRole('button',{name:'Contraer sección Raíz',exact:true}).click();await expect(current()).toHaveText('Raíz')
 await outline().getByRole('button',{name:'Expandir sección Raíz',exact:true}).click();await expect(current()).toHaveText('Rama');await expect(outline().getByRole('button',{name:'Expandir sección Rama',exact:true})).toHaveAttribute('aria-expanded','false')
 await outline().getByRole('button',{name:'Expandir sección Rama',exact:true}).click();await expect(current()).toHaveText('Interior');expect(Math.abs((await geometry()).top-top)).toBeLessThan(1)
})

test('B5: contracción por documento sobrevive tema y pestañas y se descarta al cerrar',async()=>{
 const first=await open('# Primero\n\n## Rama\n\n### Dentro\n\nTexto.');await outline().getByRole('button',{name:'Contraer sección Rama',exact:true}).click()
 await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption('dark');await settled();await expect(outline().getByRole('button',{name:'Expandir sección Rama',exact:true})).toBeVisible()
 await filesTab().click();await expect(outline()).toBeHidden();await indexTab().click();await expect(outline().getByRole('button',{name:'Expandir sección Rama',exact:true})).toBeVisible()
 const second=await open('# Segundo\n\n## Rama\n\n### Dentro del segundo\n\nTexto.');await expect(outline().getByRole('button',{name:'Contraer sección Rama',exact:true})).toHaveAttribute('aria-expanded','true')
 await page.getByRole('tab',{name:first.doc.name,exact:true}).click();id=first.doc.id;await settled();await expect(outline().getByRole('button',{name:'Expandir sección Rama',exact:true})).toBeVisible();await expect(outline().getByRole('button',{name:'Dentro',exact:true})).toHaveCount(0)
 await page.getByRole('tab',{name:second.doc.name,exact:true}).click();id=second.doc.id;await settled();await expect(outline().getByRole('button',{name:'Contraer sección Rama',exact:true})).toBeVisible()
 await page.getByRole('button',{name:`Cerrar ${first.doc.name}`,exact:true}).click();const[reopened]=await page.evaluate(path=>window.freya.openPaths([path]),first.path);id=reopened.id;await settled();await expect(outline().getByRole('button',{name:'Contraer sección Rama',exact:true})).toHaveAttribute('aria-expanded','true')
})

test('B5: la ruta conserva contracción cuando otra sección cambia los ids globales',async()=>{
 const original='# A\n\n## Rama\n\n### Interior\n\n# B\n\n## Rama\n\n### Otro\n';await open(original)
 const before=await outline().getByRole('button',{name:'Rama',exact:true}).first().getAttribute('data-heading-id');await outline().getByRole('button',{name:'Contraer sección Rama',exact:true}).first().click()
 await replaceSource('# Nuevo\n\n## Rama\n\n### Nueva\n\n'+original)
 const collapsedRow=outline().getByRole('button',{name:'Expandir sección Rama',exact:true}).locator('..')
 expect(await collapsedRow.locator('[data-heading-id]').getAttribute('data-heading-id')).not.toBe(before)
 await expect(outline().getByRole('button',{name:'Interior',exact:true})).toHaveCount(0);await expect(outline().getByRole('button',{name:'Nueva',exact:true})).toBeVisible();await expect(outline().getByRole('button',{name:'Otro',exact:true})).toBeVisible()
})

test('B5: renombrar o eliminar una ruta descarta su estado en lugar de transferirlo',async()=>{
 const original='# Manual\n\n## Rama\n\n### Dentro\n';await open(original);await outline().getByRole('button',{name:'Contraer sección Rama',exact:true}).click()
 await replaceSource(original.replace('## Rama','## Renombrada'));await expect(outline().getByRole('button',{name:'Contraer sección Renombrada',exact:true})).toHaveAttribute('aria-expanded','true');await expect(outline().getByRole('button',{name:'Dentro',exact:true})).toBeVisible()
 await replaceSource(original);await expect(outline().getByRole('button',{name:'Contraer sección Rama',exact:true})).toHaveAttribute('aria-expanded','true')
 await outline().getByRole('button',{name:'Contraer sección Rama',exact:true}).click();await replaceSource('# Manual\n\nSin ramas.');await replaceSource(original);await expect(outline().getByRole('button',{name:'Contraer sección Rama',exact:true})).toHaveAttribute('aria-expanded','true')
})

test('B6: títulos largos muestran dos líneas, tooltip y nombre completo en claro/oscuro',async()=>{
 const title='Manual de FreyaLab para estudiantes y profesionales que necesitan consultar documentos extensos sin perder el contexto de las secciones y todas sus instrucciones de trabajo'
 await open(`# ${title}\n\n${paragraphs(5)}## Rama contraída\n\n${paragraphs(5)}### Sección actual\n\n${paragraphs(25)}`);await threshold('Sección actual');await outline().getByRole('button',{name:'Contraer sección Rama contraída',exact:true}).click()
 const measured=[]
 for(const theme of ['light','dark']){
  await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme);await settled();await expect(current()).toHaveText('Rama contraída')
  const label=outline().getByRole('button',{name:title,exact:true});await expect(label).toHaveAttribute('title',title);await expect(label).toHaveAccessibleName(title)
  const layout=await label.locator('span').evaluate(node=>{const style=getComputedStyle(node);return{height:node.getBoundingClientRect().height,lineHeight:Number.parseFloat(style.lineHeight),clamp:style.getPropertyValue('-webkit-line-clamp'),text:node.textContent}})
  expect(layout.clamp).toBe('2');expect(layout.height).toBeLessThanOrEqual(2*layout.lineHeight+1);expect(layout.text).toBe(title);measured.push({theme,...layout})
  await screenshot(theme,'b')
 }
 await evidence('7-b-titulos-largos',measured)
})

test('B: contraer ramas no modifica fuente, dirty ni HTML exportado',async()=>{
 const original='# Manual\n\n## Capítulo\n\n### Detalle\n\nTexto.\n';const{path}=await open(original),before=await exportHTML('b-antes.html')
 await outline().getByRole('button',{name:'Contraer sección Manual',exact:true}).click();await expect(outline().getByRole('button',{name:'Detalle',exact:true})).toHaveCount(0)
 const after=await exportHTML('b-despues.html');expect(after).toBe(before);expect(await source()).toBe(original);expect(await readFile(path,'utf8')).toBe(original)
 expect(await page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id)?.dirty,id)).toBe(false)
})

test('C1: el índice permanece disponible en Editar y el botón Índice lo alterna',async()=>{
 await open('# Inicio\n\nTexto inicial.\n\n## Destino\n\nContenido final.')
 await page.getByRole('group',{name:'Modo de edición',exact:true}).getByRole('button',{name:'Editar',exact:true}).click()
 await evidence('7-c-baseline',{editorCount:await page.locator('.cm-content').count(),outlineCount:await outline().count(),outlineVisible:await outline().isVisible(),source:await source()})
 await expect(outline()).toBeVisible();await expect(outline().getByRole('button',{name:'Destino',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Índice',exact:true}).click();await expect(outline()).toHaveCount(0)
 await page.getByRole('button',{name:'Índice',exact:true}).click();await expect(outline()).toBeVisible()
})

test('C2/C5: navegar enfoca el inicio del título arriba sin editar ni crear pasos de deshacer',async()=>{
 const original='# Inicio\n\n'+paragraphs(30)+'## Destino\n\n'+paragraphs(35),{path}=await open(original),before=await exportHTML('c-antes.html')
 await editMode();await outline().getByRole('button',{name:'Destino',exact:true}).click()
 await expect.poll(editorSnapshot).toMatchObject({lineText:'## Destino',focused:true})
 const alignment=[];for(let index=0;index<4;index++){await frames();alignment.push(await editorSnapshot())}await evidence('7-c-align-before',alignment)
 // scrollIntoView alinea el cursor; el bloque incluye el leading de la fuente.
 await expect.poll(async()=>{const state=await editorSnapshot();return Math.abs(state.cursorTop??Infinity)<2&&state.firstLine===state.line}).toBe(true)
 const moved=await editorSnapshot();expect(moved.from).toBe(moved.lineFrom);expect(moved.to).toBe(moved.from);expect(moved.firstLine).toBe(moved.line);expect(moved.domSelection).toBe('')
 expect(await source()).toBe(original);expect(await readFile(path,'utf8')).toBe(original);expect(await page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id)?.dirty,id)).toBe(false)
 const after=await exportHTML('c-despues.html');expect(after).toBe(before)
 await page.locator('.cm-content').focus();await page.keyboard.insertText('!');await expect.poll(source).toBe(original.slice(0,moved.from)+'!'+original.slice(moved.from))
 await page.keyboard.press('ControlOrMeta+Z');await expect.poll(source).toBe(original)
 await page.keyboard.press(process.platform==='darwin'?'ControlOrMeta+Shift+Z':'ControlOrMeta+Y');await expect.poll(source).toBe(original.slice(0,moved.from)+'!'+original.slice(moved.from))
 await evidence('7-c-navegacion',{...moved,htmlUnchanged:before===after,sourceBeforeTypingUnchanged:true})
})

test('C4: ATX, Setext, duplicados, front matter, Unicode y contenedores llevan a su línea real',async()=>{
 const fixtures=[
  {name:'ATX y Setext',text:'# Uno\n\n## Dos ##\n\nTres\n====\n\nCuatro\n----\n',targets:[{name:'Uno',line:1},{name:'Dos',line:3},{name:'Tres',line:5},{name:'Cuatro',line:8}]},
  {name:'Duplicados',text:'# Uno\n\nTexto.\n\n# Uno\n\nFin.',targets:[{name:'Uno',occurrence:0,line:1},{name:'Uno',occurrence:1,line:5}]},
  {name:'BOM, CRLF, propiedades y símbolos',text:'\ufeff---\r\ntitle: Uno\r\n---\r\n\r\n# 🐕\r\n\r\n## !!!\r\n\r\nSetext\r\n====\r\n',targets:[{name:'🐕',line:5},{name:'!!!',line:7},{name:'Setext',line:9}]},
  {name:'Cita y lista',text:'> ## Cita **fuerte**\n\n- ### Lista\n\n  Texto.\n\n# Final\n',targets:[{name:'Cita fuerte',line:1},{name:'Lista',line:3},{name:'Final',line:7}]},
  {name:'Details estándar cerrado',text:'<details><summary>Más</summary>\n\n# Interior\n\n</details>\n\n# Exterior\n',targets:[{name:'Interior',line:3},{name:'Exterior',line:7}]}
 ]
 const destinations=[]
 for(const fixture of fixtures){
  const{path}=await open(fixture.text);await editMode()
  for(const target of fixture.targets){
   await outline().getByRole('button',{name:target.name,exact:true}).nth('occurrence'in target?target.occurrence!:0).click()
   await expect.poll(async()=>(await editorSnapshot()).line).toBe(target.line)
   const moved=await editorSnapshot();expect(moved.from).toBe(moved.lineFrom);expect(moved.to).toBe(moved.from);expect(moved.focused).toBe(true);destinations.push({fixture:fixture.name,target:target.name,...moved})
  }
  expect(await source()).toBe(fixture.text);expect(await readFile(path,'utf8')).toBe(fixture.text)
 }
 await evidence('7-c-destinos',destinations)
})

test('C3: la sección actual sigue la primera línea realmente visible, no el margen virtualizado',async()=>{
 const prefix=paragraphs(12),original=prefix+Array.from({length:6},(_,i)=>`# Sección ${i+1}\n\n${paragraphs(16)}`).join('')
 await open(original);await editMode();await expect(current()).toHaveCount(0)
 const headings=original.split('\n').flatMap((text,index)=>text.startsWith('# ')?[{line:index+1,text:text.slice(2)}]:[]),samples=[]
 for(let index=0;index<4;index++){
  const previousScroll=(await editorSnapshot()).scrollTop
  await page.locator('.cm-scroller').hover();await page.mouse.wheel(0,700);await frames()
  await expect.poll(async()=>{const view=await editorSnapshot(),wanted=headings.filter(heading=>heading.line<=(view.firstLine??0)).at(-1)?.text??'',actual=await current().count()?await current().textContent():'';return view.scrollTop>previousScroll&&(view.firstLine??0)>1&&actual===wanted}).toBe(true)
  const view=await editorSnapshot();expect(view.firstLine).toBeGreaterThan(1);samples.push({...view,current:await current().count()?await current().textContent():''})
 }
 await page.locator('.cm-content').focus();await page.keyboard.press('PageDown');await frames()
 await expect.poll(async()=>{const view=await editorSnapshot(),wanted=headings.filter(heading=>heading.line<=(view.firstLine??0)).at(-1)?.text??'';return(await current().count()?await current().textContent():'')===wanted}).toBe(true)
 expect(await source()).toBe(original);await evidence('7-c-primera-linea',samples)
})

test('C3: títulos dentro de cita y lista marcan su sección al inicio real de la línea',async()=>{
 const original='> ## Cita\n\nTexto inicial.\n\n- ### Lista\n\n  Texto de la lista.\n\n# Final\n\n'+paragraphs(20)
 await open(original);await editMode();const observations=[]
 for(const target of [{name:'Cita',line:'> ## Cita'},{name:'Lista',line:'- ### Lista'}]){
  await outline().getByRole('button',{name:target.name,exact:true}).click();await expect.poll(async()=>(await editorSnapshot()).lineText).toBe(target.line)
  const state=await editorSnapshot();observations.push({target:target.name,...state});await evidence('7-c-contenedores',observations)
  expect(state.from).toBe(state.lineFrom);expect(state.to).toBe(state.from);await expect(current()).toHaveText(target.name)
 }
 expect(await source()).toBe(original)
})

test('C4: el título HTML sin pareja y sus duplicados avisan sin mover el cursor a otro título',async()=>{
 const original='<details><summary>Más</summary>\n# Uno\n</details>\n\n# Uno\n\n# Seguro\n'
 await open(original);await editMode();await page.locator('.cm-content').focus();await page.keyboard.press('ControlOrMeta+Home')
 const before=await editorSnapshot();await expect(outline().getByRole('button',{name:'Uno',exact:true})).toHaveCount(2)
 for(let occurrence=0;occurrence<2;occurrence++){
  await outline().getByRole('button',{name:'Uno',exact:true}).nth(occurrence).click()
  await expect(page.locator('.toast')).toContainText('Ese título no se puede localizar en el editor')
  const after=await editorSnapshot();expect(after.from).toBe(before.from);expect(after.to).toBe(before.to)
 }
 await outline().getByRole('button',{name:'Seguro',exact:true}).click();await expect.poll(async()=>(await editorSnapshot()).line).toBe(7);expect(await source()).toBe(original)
})

test('C4: una entrada del render anterior se rechaza antes de actualizar el índice',async()=>{
 const original='# Inicio\n\nTexto.\n\n## Destino\n\nFin.',changed='# Nuevo\n\n'+original
 await open(original);await editMode()
 const result=await page.locator('.cm-content').evaluate((node,changed)=>{
  const owner=node as HTMLDivElement&{cmTile?:{view:EditorView};cmView?:{view:EditorView}},view=owner.cmTile?.view??owner.cmView?.view
  if(!view)throw new Error('No encontré la vista CodeMirror montada')
  const stale=Array.from(document.querySelectorAll<HTMLButtonElement>('#freya-outline-panel button')).find(button=>(button.getAttribute('aria-label')??button.textContent?.trim())==='Destino');if(!stale)throw new Error('Falta la entrada anterior')
  view.dispatch({changes:{from:0,to:view.state.doc.length,insert:changed},selection:{anchor:0},userEvent:'input'})
  const before=view.state.selection.main.head;stale.click()
  return{before,after:view.state.selection.main.head,staleLabel:stale.getAttribute('aria-label')}
 },changed)
 expect(result.after).toBe(result.before);await expect(page.locator('.toast')).toContainText('Ese título no se puede localizar en el editor');await expect.poll(source).toBe(changed)
 await evidence('7-c-snapshot-anterior',result)
})

test('C4: el árbol incompleto termina cubriendo el título mil sin saltos aproximados ni cambios',async()=>{
 test.setTimeout(60_000)
 const original=Array.from({length:1000},(_,i)=>`## Sección ${i+1}\n\n${paragraphs(4)}`).join(''),{path}=await open(original);await editMode()
 await page.locator('.cm-content').focus();await page.keyboard.press('ControlOrMeta+Home');const before=await editorSnapshot(),targetLine=original.slice(0,original.indexOf('## Sección 1000\n')).split('\n').length,observed:number[]=[]
 await expect.poll(async()=>{await outline().getByRole('button',{name:'Sección 1000',exact:true}).click();const moved=await editorSnapshot();observed.push(moved.line);return moved.line},{timeout:30_000}).toBe(targetLine)
 expect(observed.every(line=>line===before.line||line===targetLine)).toBe(true)
 const moved=await editorSnapshot();expect(moved.from).toBe(moved.lineFrom);expect(moved.to).toBe(moved.from);expect(moved.focused).toBe(true)
 expect(await source()).toBe(original);expect(await readFile(path,'utf8')).toBe(original);expect(await page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id)?.dirty,id)).toBe(false)
 await evidence('7-c-mil-titulos',{titles:1000,targetLine,observed,moved,sourceUnchanged:true})
})

test('C5: Dividido y Vista previa conservan el desplazamiento de lectura sin mover el cursor',async()=>{
 const original='# Primera\n\n'+paragraphs(20)+'## Segunda\n\n'+paragraphs(20)+'## Tercera\n\n'+paragraphs(30)
 await open(original);await editMode();await outline().getByRole('button',{name:'Segunda',exact:true}).click();await expect.poll(async()=>(await editorSnapshot()).lineText).toBe('## Segunda');const before=await editorSnapshot()
 await page.getByRole('group',{name:'Modo de edición',exact:true}).getByRole('button',{name:'Dividido',exact:true}).click();await settled()
 await expect.poll(async()=>await current().count()?await current().textContent():'').toBe(await expected())
 await outline().getByRole('button',{name:'Tercera',exact:true}).click();await scrollIdle();await expect(current()).toHaveText('Tercera');const split=await editorSnapshot();expect(split.from).toBe(before.from)
 await page.getByRole('group',{name:'Modo de edición',exact:true}).getByRole('button',{name:'Vista previa',exact:true}).click();await settled();await outline().getByRole('button',{name:'Segunda',exact:true}).click();await scrollIdle();await expect(current()).toHaveText('Segunda')
 await expect(page.locator('.cm-content')).toHaveCount(0);await editMode();expect((await editorSnapshot()).from).toBe(before.from);expect(await source()).toBe(original)
})

test('C: un clic durante composición IME sintética no roba el foco ni mueve el cursor',async()=>{
 const original='# Inicio\n\nTexto.\n\n## Destino\n\nContenido.';await open(original);await editMode();await page.locator('.cm-content').focus();await page.keyboard.press('ControlOrMeta+Home')
 await page.locator('.cm-content').dispatchEvent('compositionstart',{data:''});await expect.poll(async()=>(await editorSnapshot()).compositionStarted).toBe(true)
 const before=await editorSnapshot();await outline().getByRole('button',{name:'Destino',exact:true}).click();const after=await editorSnapshot()
 expect(after.from).toBe(before.from);expect(after.to).toBe(before.to);expect(after.focused).toBe(true);expect(after.compositionStarted).toBe(true)
 await outline().getByRole('button',{name:'Contraer sección Inicio',exact:true}).click();await expect(page.locator('.cm-content')).toBeFocused();expect((await editorSnapshot()).compositionStarted).toBe(true);expect(await source()).toBe(original)
 await page.locator('.cm-content').dispatchEvent('compositionend',{data:''});await expect.poll(async()=>(await editorSnapshot()).compositionStarted).toBe(false)
 await outline().getByRole('button',{name:'Expandir sección Inicio',exact:true}).click();await outline().getByRole('button',{name:'Destino',exact:true}).click();await expect.poll(async()=>(await editorSnapshot()).lineText).toBe('## Destino')
 await evidence('7-c-ime-sintetico',{before,after,scope:'Eventos compositionstart/end sintéticos y clics Playwright; no IME físico del sistema.'})
})

test('C: modo Editar conserva contraste, árbol y barra en claro/oscuro a 1440 por 900',async()=>{
 const original='# Manual de FreyaLab\n\n'+paragraphs(8)+'## Consultar resultados\n\n'+paragraphs(8)+'### Interpretar el informe\n\n'+paragraphs(30)
 await open(original);await editMode();await outline().getByRole('button',{name:'Interpretar el informe',exact:true}).click();await expect.poll(async()=>(await editorSnapshot()).lineText).toBe('### Interpretar el informe')
 await outline().getByRole('button',{name:'Contraer sección Consultar resultados',exact:true}).click();await expect(current()).toHaveText('Consultar resultados')
 const layouts=[]
 for(const theme of ['light','dark']){
  await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme);await frames();await expect(outline()).toBeVisible();await expect(current()).toHaveText('Consultar resultados');await expect(current()).toBeInViewport()
  const bounds=await page.locator('.document-tools').boundingBox();expect(bounds!.height).toBeLessThanOrEqual(43);layouts.push({theme,barHeight:bounds!.height,editor:await editorSnapshot()});await screenshot(theme,'c')
 }
 expect(await source()).toBe(original);await evidence('7-c-temas',layouts)
})

test('C2: el título final sin cuerpo queda arriba del editor y navegar no consume el siguiente deshacer',async()=>{
 const original='# Inicio\n\n'+paragraphs(45)+'## Fin del archivo',edited=original.replace('# Inicio','# Inicio editado'),{path}=await open(original)
 await editMode();await replaceSource(edited)
 const beforeNavigation=await page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),id)
 // Una edición conocida permite comprobar que navegar no añade otro paso al historial.
 await outline().getByRole('button',{name:'Fin del archivo',exact:true}).click()
 await expect.poll(editorSnapshot).toMatchObject({lineText:'## Fin del archivo',focused:true})
 const aligned=[];for(let index=0;index<4;index++){await frames();aligned.push(await editorSnapshot())};await evidence('7-c-eof-align',aligned)
 await expect.poll(async()=>{const moved=await editorSnapshot();return moved.firstLine===moved.line&&Math.abs(moved.cursorTop??Infinity)<2}).toBe(true)
 const moved=await editorSnapshot();expect(moved.from).toBe(moved.lineFrom);expect(moved.to).toBe(moved.lineFrom)
 expect(await source()).toBe(edited);expect(await readFile(path,'utf8')).toBe(original)
 expect(await page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id)?.dirty,id)).toBe(beforeNavigation?.dirty)
 await page.keyboard.press('ControlOrMeta+Z');await expect.poll(source).toBe(original)
 await page.keyboard.press(process.platform==='darwin'?'ControlOrMeta+Shift+Z':'ControlOrMeta+Y');await expect.poll(source).toBe(edited)
 expect(await readFile(path,'utf8')).toBe(original)
})
