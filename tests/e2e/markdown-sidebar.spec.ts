import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication|undefined,page:Page,directory:string,fixtures:string,serial=0
const sidebar=()=>page.locator('aside.sidebar')
const tabs=()=>sidebar().getByRole('tablist')
const filesTab=()=>tabs().getByRole('tab',{name:'Archivos',exact:true})
const indexTab=()=>tabs().getByRole('tab',{name:'Índice',exact:true})
const indexPanel=()=>page.getByRole('tabpanel',{name:'Índice del documento',exact:true})
const indexButton=()=>page.locator('.document-tools').getByRole('button',{name:'Índice',exact:true})
const toggleSidebar=()=>page.getByRole('button',{name:'Mostrar u ocultar explorador',exact:true})
const preview=()=>page.locator('.preview')
const article=()=>preview().locator('article.markdown-body')
const mode=(name:string)=>page.getByRole('group',{name:'Modo de edición',exact:true}).getByRole('button',{name,exact:true})
const source=(id:string)=>page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id)?.text,id)
const storedTab=()=>page.evaluate(()=>localStorage.getItem('freya-sidebar-tab'))
const layoutSource='# Manual de FreyaLab\n\n'+Array.from({length:22},(_,i)=>`${i%2?'###':'##'} Sección ${i+1}\n\nTexto de la sección para consultar el índice.\n\n`).join('')

async function launch(open:string[]=[]){
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_FOLDER:fixtures,FREYALAB_TEST_EXPORT_DIR:join(directory,'exports'),...open.length?{FREYALAB_TEST_OPEN:JSON.stringify(open)}:{}}})
 page=await app.firstWindow();await page.waitForLoadState('load');await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 await expect(page.locator('.app-shell .toolbar')).toBeVisible()
 await expect.poll(()=>app!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.isLoading())).toBe(false)
}
async function quit(){if(!app)return;await app.evaluate(async({session,app})=>{await session.defaultSession.flushStorageData();app.exit(0)}).catch(()=>{});await app.close().catch(()=>{});app=undefined}
test.beforeEach(async()=>{
 directory=await mkdtemp(join(tmpdir(),'freya-md007-sidebar-'));fixtures=join(directory,'files')
 await mkdir(fixtures);await mkdir(join(directory,'exports'));await launch()
})
test.afterEach(async()=>{await quit();await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

async function frames(){await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))}
async function settled(){await expect(preview().locator('.render-progress')).toHaveCount(0);await page.evaluate(()=>document.fonts.ready.then(()=>{}));await frames()}
async function open(text:string,name=`pestanas-${++serial}.md`){
 const path=join(fixtures,name);await writeFile(path,text);const[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true')
 return{path,doc}
}
async function reload(){
 const documents=await page.evaluate(()=>window.freya.documents());expect(documents.every(doc=>doc.path&&!doc.dirty),'El reinicio de prueba no debe descartar cambios sin guardar.').toBe(true)
 await quit();await launch(documents.map(doc=>doc.path!))
}
async function preferences(values:Record<string,string|null>){await page.evaluate(values=>{for(const[key,value]of Object.entries(values))if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)},values);await reload()}
async function showPreview(){await mode('Dividido').click();await expect(preview()).toBeVisible();await settled()}
async function replace(id:string,text:string){await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(text);await expect.poll(()=>source(id)).toBe(text);await settled()}
async function evidence(name:string,value:unknown){
 const body=JSON.stringify(value,null,2);await test.info().attach(name,{body:Buffer.from(body),contentType:'application/json'})
 if(process.env.FREYALAB_SIDEBAR_EVIDENCE_DIR){await mkdir(process.env.FREYALAB_SIDEBAR_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.FREYALAB_SIDEBAR_EVIDENCE_DIR,`${name}.json`),body+'\n')}
}
async function layout(){return page.evaluate(()=>{
 const rect=(selector:string)=>{const node=document.querySelector<HTMLElement>(selector);if(!node)return null;const box=node.getBoundingClientRect();return{x:box.x,y:box.y,width:box.width,height:box.height,visible:node.checkVisibility(),clientWidth:node.clientWidth,scrollWidth:node.scrollWidth}}
 return{viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},preferences:Object.fromEntries(['freya-sidebar','freya-sidebar-width','freya-split','freya-theme'].map(key=>[key,localStorage.getItem(key)])),sidebar:rect('aside.sidebar'),editor:rect('.editor-pane'),preview:rect('.preview-pane'),previewDocument:rect('.preview'),rightOutline:rect('aside.outline')}
})}
async function scroll(panel:Locator,top:number|null=null){return panel.evaluate((node,top)=>{
 const root=node as HTMLElement,target=[root,...root.querySelectorAll<HTMLElement>('*')].find(element=>element.clientHeight>0&&element.scrollHeight>element.clientHeight+1&&/(auto|scroll)/.test(getComputedStyle(element).overflowY))
 if(!target)throw new Error('El panel no tiene contenido desplazable para esta prueba.')
 if(top!==null)target.scrollTop=top
 return target.scrollTop
},top)}

test('P1/P2/P9: pestañas accesibles por teclado y ancho recuperado sin panel derecho',async()=>{
 await page.evaluate(()=>{for(const[key,value]of Object.entries({'freya-sidebar':'true','freya-sidebar-width':'240','freya-split':'50','freya-sidebar-tab':'files'}))localStorage.setItem(key,value)})
 await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption('light')
 const{path,doc}=await open(layoutSource);await showPreview()
 const sourceHashes=Object.fromEntries(await Promise.all(['src/renderer/App.svelte','src/renderer/style.css','src/renderer/components/Tree.svelte','out/main/index.js','out/renderer/index.html'].map(async name=>[name,createHash('sha256').update(await readFile(resolve(name))).digest('hex')])))
 const before={sourceSha256:createHash('sha256').update(layoutSource).digest('hex'),sourceHashes,mode:'split',theme:'light',...await layout()}
 await evidence(process.env.FREYALAB_SIDEBAR_BASELINE==='1'?'md007-p-baseline-layout':'md007-p-before-roles',before)
 if(process.env.FREYALAB_SIDEBAR_BASELINE==='1')await writeFile(process.env.FREYALAB_SIDEBAR_BASELINE_JSON||'/private/tmp/freyalab-lote/7-p-baseline-layout.json',JSON.stringify(before,null,2)+'\n')
 // El montaje basal adjunta sus medidas antes de fallar por la ausencia real de las pestañas.
 await expect(tabs()).toBeVisible();await expect(filesTab()).toHaveAttribute('aria-selected','true');await expect(indexTab()).toHaveAttribute('aria-selected','false')
 for(const tab of[filesTab(),indexTab()])expect(await tab.evaluate(node=>{const panel=document.getElementById(node.getAttribute('aria-controls')??'');return{exists:!!panel,role:panel?.getAttribute('role')}})).toEqual({exists:true,role:'tabpanel'})
 await filesTab().focus();await page.keyboard.press('ArrowRight');await expect(indexTab()).toBeFocused();await expect(indexTab()).toHaveAttribute('aria-selected','true');await expect(indexPanel()).toBeVisible()
 await page.keyboard.press('Home');await expect(filesTab()).toBeFocused();await expect(filesTab()).toHaveAttribute('aria-selected','true')
 await page.keyboard.press('End');await expect(indexTab()).toBeFocused();await page.keyboard.press('ArrowLeft');await expect(filesTab()).toBeFocused()
 await indexTab().click();await expect(indexPanel()).toContainText('Sección 22');await expect(page.locator('aside.outline')).toHaveCount(0)
 await expect(sidebar().getByRole('combobox',{name:'Tema',exact:true})).toBeVisible();await expect(sidebar().getByRole('button',{name:'FreyaLab alfa',exact:true})).toBeVisible()
 const after={sourceSha256:before.sourceSha256,sourceHashes,mode:'split',theme:'light',...await layout()};await evidence('md007-p-index-visible-layout',after)
 const referencePath=process.env.FREYALAB_SIDEBAR_BASELINE_JSON
 if(referencePath&&process.env.FREYALAB_SIDEBAR_BASELINE!=='1'){
  const reference=JSON.parse(await readFile(referencePath,'utf8')) as typeof before
  expect(reference.sourceSha256).toBe(after.sourceSha256);expect(reference.viewport).toEqual(after.viewport);expect(reference.preferences).toEqual(after.preferences)
  expect(reference.sidebar?.width).toBe(240);expect(after.sidebar?.width).toBe(240)
  const gain=after.previewDocument!.width-reference.previewDocument!.width;await evidence('md007-p-width-comparison',{referencePath,reference,after,gainPx:gain});expect(gain).toBeGreaterThanOrEqual(185)
 }else await evidence('md007-p-width-comparison',{status:'Referencia basal no suministrada; la geometría actual se adjunta y no acredita una comparación anterior/posterior.'})
 expect(await source(doc.id)).toBe(layoutSource);expect(await readFile(path,'utf8')).toBe(layoutSource)
})

test('P4/P8: Índice abre la barra oculta, alterna a Archivos y recuerda la pestaña al reabrir',async()=>{
 await open(layoutSource);await toggleSidebar().click();await expect(sidebar()).toHaveCount(0);await expect(indexButton()).toHaveAttribute('aria-pressed','false')
 await indexButton().click();await expect(sidebar()).toBeVisible();await expect(indexTab()).toHaveAttribute('aria-selected','true');await expect(indexButton()).toHaveAttribute('aria-pressed','true')
 await indexButton().click();await expect(filesTab()).toHaveAttribute('aria-selected','true');await expect(indexButton()).toHaveAttribute('aria-pressed','false')
 await indexButton().click();await toggleSidebar().click();await expect(sidebar()).toHaveCount(0);await expect(indexPanel()).toBeHidden();await expect(page.getByLabel('Buscar archivo',{exact:true})).toBeHidden()
 await toggleSidebar().click();await expect(indexTab()).toHaveAttribute('aria-selected','true');await expect(indexPanel()).toBeVisible();await expect(indexButton()).toHaveAttribute('aria-pressed','true')
})

test('P5: preferencia ausente o inválida usa Archivos y una elección válida sobrevive a recargar',async()=>{
 await open(layoutSource)
 for(const value of[null,'no-es-una-pestana','OUTLINE']){await preferences({'freya-sidebar-tab':value});await expect(filesTab()).toHaveAttribute('aria-selected','true')}
 await indexTab().click();await expect.poll(storedTab).toBe('outline');await reload();await expect(indexTab()).toHaveAttribute('aria-selected','true');await expect(indexPanel()).toBeVisible()
 await filesTab().click();await expect.poll(storedTab).toBe('files');await reload();await expect(filesTab()).toHaveAttribute('aria-selected','true')
})

test('P5: almacenamiento bloqueado no impide abrir el documento ni alternar las pestañas',async()=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 await page.context().addInitScript(()=>{
  const w=window as unknown as {__mdSidebarStorage:{reads:number;beforeBootstrap:boolean}}
  w.__mdSidebarStorage={reads:0,beforeBootstrap:!document.querySelector('.app-shell')}
  Storage.prototype.getItem=function(){w.__mdSidebarStorage.reads++;throw new DOMException('Almacenamiento bloqueado','SecurityError')};Storage.prototype.setItem=function(){throw new DOMException('Almacenamiento bloqueado','SecurityError')}
 })
 // La carga inicial ya terminó: recargar antes abortaría su loadFile y cerraría la app.
 await Promise.all([page.waitForEvent('load'),app!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.reload())]);await expect(page.locator('.app-shell .toolbar')).toBeVisible()
 const blocked=await page.evaluate(()=>{
  const initial={...(window as unknown as {__mdSidebarStorage:{reads:number;beforeBootstrap:boolean}}).__mdSidebarStorage}
  let read=false,write=false;try{localStorage.getItem('__storage_test__')}catch{read=true}try{localStorage.setItem('__storage_test__','value')}catch{write=true}
  return{...initial,read,write}
 });expect(blocked.beforeBootstrap).toBe(true);expect(blocked.reads).toBeGreaterThan(0);expect(blocked.read).toBe(true);expect(blocked.write).toBe(true);await evidence('md007-p-storage-blocked',{...blocked,scope:'Denegación comprobada antes del bootstrap, incluidas lecturas iniciales de la aplicación.'})
 const{doc,path}=await open(layoutSource);await expect(filesTab()).toHaveAttribute('aria-selected','true')
 await indexTab().click();await expect(indexPanel()).toContainText('Manual de FreyaLab');await filesTab().click();await expect(filesTab()).toHaveAttribute('aria-selected','true')
 expect(errors).toEqual([]);expect(await source(doc.id)).toBe(layoutSource);expect(await readFile(path,'utf8')).toBe(layoutSource)
})

test('P3: CSV, texto y Mermaid muestran Archivos sin sobrescribir la preferencia de Markdown',async()=>{
 const md=await open(layoutSource,'manual.md');await indexTab().click();await expect.poll(storedTab).toBe('outline')
 for(const[name,text]of[['datos.csv','Id,Valor\n00123,4\n'],['notas.txt','Texto sin índice.\n'],['diagrama.mmd','flowchart LR\n A --> B\n']]){
  await open(text,name);await expect(indexTab()).toHaveAttribute('aria-disabled','true');await expect(indexTab()).toHaveAttribute('title','El índice está disponible en documentos Markdown');await expect(filesTab()).toHaveAttribute('aria-selected','true');expect(await storedTab()).toBe('outline')
  await filesTab().focus();for(const key of['ArrowRight','Home','End']){await page.keyboard.press(key);await expect(filesTab()).toHaveAttribute('aria-selected','true');expect(await storedTab()).toBe('outline')}
  await page.getByRole('tab',{name:'manual.md',exact:true}).click();await expect(indexTab()).toHaveAttribute('aria-selected','true');await expect(indexTab()).not.toHaveAttribute('aria-disabled','true');await expect(indexPanel()).toContainText('Manual de FreyaLab')
 }
 expect(await source(md.doc.id)).toBe(layoutSource)
})

test('P6: las dos pestañas comparten ancho, límites y recuerdo del divisor',async()=>{
 await open(layoutSource);let slider=page.getByRole('slider',{name:'Ancho del explorador',exact:true})
 await expect(slider).toHaveAttribute('aria-valuemin','180');await expect(slider).toHaveAttribute('aria-valuemax','420');await expect(slider).toHaveAttribute('aria-valuenow','240')
 await slider.focus();await page.keyboard.press('ArrowRight');await expect(slider).toHaveAttribute('aria-valuenow','250');await indexTab().click();expect((await sidebar().boundingBox())!.width).toBe(250)
 const box=(await slider.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+70,box.y+box.height/2);await page.mouse.up()
 await expect(slider).toHaveAttribute('aria-valuenow','320');await filesTab().click();expect((await sidebar().boundingBox())!.width).toBe(320);await reload();slider=page.getByRole('slider',{name:'Ancho del explorador',exact:true});await expect(slider).toHaveAttribute('aria-valuenow','320')
 await slider.focus();for(let i=0;i<12;i++)await page.keyboard.press('ArrowRight');await expect(slider).toHaveAttribute('aria-valuenow','420')
 for(let i=0;i<26;i++)await page.keyboard.press('ArrowLeft');await expect(slider).toHaveAttribute('aria-valuenow','180');await indexTab().click();expect((await sidebar().boundingBox())!.width).toBe(180)
})

test('P7: alternar conserva árbol expandido, búsqueda, resultados y desplazamiento de ambos paneles',async()=>{
 const text=Array.from({length:80},(_,i)=>`## Apartado ${i+1}\n\nTexto breve.\n\n`).join('');await open(text,'indice-largo.md')
 await mkdir(join(fixtures,'A carpeta'));await writeFile(join(fixtures,'A carpeta','interno.md'),'# Interior\n')
 await Promise.all(Array.from({length:40},(_,i)=>writeFile(join(fixtures,`objetivo-${String(i+1).padStart(2,'0')}.md`),'# Archivo\n')))
 await page.locator('.toolbar-left').getByRole('button',{name:'Abrir carpeta',exact:true}).click();await expect(page.locator('.folder-root')).toHaveAttribute('title',fixtures)
 const branch=sidebar().getByRole('button',{name:'A carpeta',exact:true});await branch.click();await expect(branch).toHaveAttribute('aria-expanded','true');await expect(sidebar().getByRole('button',{name:'interno.md',exact:true})).toBeVisible()
 const tree=sidebar().locator('.tree-scroll'),treeTop=await scroll(tree,240);expect(treeTop).toBeGreaterThan(0)
 await indexTab().click();await expect(indexPanel()).toContainText('Apartado 80')
 // La sección inicial y su ajuste geométrico deben terminar antes de probar un desplazamiento manual sin cambio de sección.
 await expect(indexPanel().locator('[aria-current=location]')).toHaveCount(1)
 await indexPanel().evaluate(async()=>{await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))})
 const section=await indexPanel().locator('[aria-current=location]').getAttribute('data-heading-id'),indexTop=await scroll(indexPanel(),220);expect(indexTop).toBeGreaterThan(0)
 await filesTab().click();await expect(branch).toHaveAttribute('aria-expanded','true');await expect.poll(()=>scroll(tree)).toBe(treeTop)
 await page.getByLabel('Buscar archivo',{exact:true}).fill('objetivo');await expect(sidebar().locator('.file-search-status')).toHaveText('40 archivos encontrados');const names=await sidebar().locator('.file-search-result').allTextContents(),searchTop=await scroll(tree,180);expect(searchTop).toBeGreaterThan(0)
 await indexTab().click();await expect(indexPanel().locator('[aria-current=location]')).toHaveAttribute('data-heading-id',section!);await expect.poll(()=>scroll(indexPanel())).toBe(indexTop);await filesTab().click();await expect(page.getByLabel('Buscar archivo',{exact:true})).toHaveValue('objetivo');expect(await sidebar().locator('.file-search-result').allTextContents()).toEqual(names);await expect.poll(()=>scroll(tree)).toBe(searchTop)
})

test('P7 activo: pulsar el documento ya activo conserva el índice y la fuente',async()=>{
 const text='# Manual\n\nContenido sin cambios.\n',{doc,path}=await open(text,'manual-activo.md');await indexTab().click();await expect(indexPanel()).toContainText('Manual')
 await page.getByRole('tab',{name:'manual-activo.md',exact:true}).click();await expect(indexPanel()).toContainText('Manual')
 expect(await source(doc.id)).toBe(text);expect(await readFile(path,'utf8')).toBe(text)
})

test('P9/P10: Índice disponible en ventana estrecha y demanda render en Editar solo mientras se ve',async()=>{
 await open('# Inicial\n\nPárrafo.\n','inicial.md');await showPreview();await mode('Editar').click();const{doc,path}=await open('# Segundo\n\nTexto editable.\n','segundo.md');await settled();await expect(preview()).toBeHidden();await expect(article()).toBeEmpty()
 await indexButton().click();await expect(indexPanel()).toContainText('Segundo');await settled();await expect(preview()).toBeHidden();const rendered=await article().innerHTML()
 await filesTab().click();await replace(doc.id,'# Tercero\n\nTexto cambiado.\n');expect(await article().innerHTML()).toBe(rendered)
 await indexButton().click();await expect(indexPanel()).toContainText('Tercero');await settled();const beforeHidden=await article().innerHTML();await toggleSidebar().click();await replace(doc.id,'# Cuarto\n\nTexto cambiado otra vez.\n');expect(await article().innerHTML()).toBe(beforeHidden)
 await toggleSidebar().click();await expect(indexPanel()).toContainText('Cuarto');await expect(preview()).toBeHidden()
 expect(await app!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getMinimumSize()[0])).toBeLessThanOrEqual(850)
 for(const width of[850,720]){await app!.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setSize(width,720),width);expect(await app!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getSize()[0])).toBeLessThanOrEqual(width);await page.setViewportSize({width,height:720});await expect(indexPanel()).toBeVisible();expect((await indexPanel().boundingBox())!.width).toBeGreaterThan(0);await expect(page.locator('aside.outline')).toHaveCount(0)}
 for(const[name,text]of[['sin-titulos.md','Un párrafo sin títulos.\n'],['vacio.md','']]){await open(text,name);await expect(indexPanel()).toContainText('Este documento no tiene títulos')}
 expect(await source(doc.id)).toBe('# Cuarto\n\nTexto cambiado otra vez.\n');expect(await readFile(path,'utf8')).toBe('# Segundo\n\nTexto editable.\n')
})
