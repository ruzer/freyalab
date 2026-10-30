import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm,truncate,stat,realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {basename,join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {showPanel} from './panel'
import {runApplicationMenu} from './application-menu'
import {zipFiles} from '../docx'
import es from '../../src/shared/i18n/es.json' with {type:'json'}
import en from '../../src/shared/i18n/en.json' with {type:'json'}
import {defaultSettings} from '../../src/shared/settings'
let app:ElectronApplication,page:Page,folder:string
const palette=()=>page.getByRole('dialog',{name:'Comandos CSV',exact:true})
test.beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-commands-e2e-'));const {ELECTRON_RUN_AS_NODE:_,...env}=process.env;app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('.')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),...(process.env.FREYALAB_PANDOC_TEST_PATH?{FREYALAB_TEST_PANDOC_PATH:process.env.FREYALAB_PANDOC_TEST_PATH}:{})},timeout:60000});page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function open(source:string){const path=join(folder,'data.csv');await writeFile(path,source);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible();return{doc,path}}
async function show(query=''){await page.getByRole('button',{name:'Buscar acción',exact:true}).click();const dialog=palette();await expect(dialog.getByLabel('Buscar comando CSV',{exact:true})).toBeFocused();await dialog.getByLabel('Buscar comando CSV',{exact:true}).fill(query);return dialog}
function command(dialog:Locator,name:string){return dialog.getByRole('button',{name,exact:false})}
async function restartApplication(language=''){
 await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('.')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:language,FREYALAB_USER_DATA:join(folder,'profile')},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
}
async function textContrast(dialog:Locator,selector='h2,p,dt,dd,button:not(:disabled)'){
 await dialog.evaluate(node=>Promise.all(node.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{}))))
 return dialog.evaluate((node,selector)=>{
  function luminance(color:string){const[r,g,b]=color.match(/[\d.]+/g)!.slice(0,3).map(value=>{const channel=Number(value)/255;return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b}
  return Array.from(node.querySelectorAll<HTMLElement>(selector)).filter(element=>element.textContent?.trim()).map(element=>{
   let background:Element|null=element,color=getComputedStyle(element).backgroundColor
   while((color==='rgba(0, 0, 0, 0)'||color==='transparent')&&background?.parentElement){background=background.parentElement;color=getComputedStyle(background).backgroundColor}
   const foreground=luminance(getComputedStyle(element).color),surface=luminance(color)
   return(Math.max(foreground,surface)+.05)/(Math.min(foreground,surface)+.05)
  })
 },selector)
}
type ApplicationMenuEntry={id:string;label:string;enabled:boolean;checked:boolean;accelerator:string|null;role:string|null;submenu:ApplicationMenuEntry[]}
async function applicationMenuTree():Promise<ApplicationMenuEntry[]>{return app.evaluate(({Menu})=>{
 type Entry={id:string;label:string;enabled:boolean;checked:boolean;accelerator:string|null;role:string|null;submenu:Entry[]}
 const walk=(menu:Electron.Menu|null):Entry[]=>(menu?.items??[]).map(item=>({id:item.id,label:item.label,enabled:item.enabled,checked:item.checked,accelerator:item.accelerator??null,role:item.role??null,submenu:walk(item.submenu??null)}))
 return walk(Menu.getApplicationMenu())
})}
function flatApplicationMenu(items:ApplicationMenuEntry[]):ApplicationMenuEntry[]{return items.flatMap(item=>[item,...flatApplicationMenu(item.submenu)])}
async function applicationMenuItem(id:string){return flatApplicationMenu(await applicationMenuTree()).find(item=>item.id===id)}
async function clickApplicationMenu(id:string){await runApplicationMenu(app,id)}

test('APP-01 M4: Word se descubre al iniciar y el menú exporta un DOCX real sin abrir la barra',async()=>{
 test.skip(!process.env.FREYALAB_PANDOC_TEST_PATH,'Requiere Pandoc real externo explícito; no se instala ni se empaqueta.')
 const source='# Informe desde el menú nativo\n\nContenido verificable: Freya, 00123 y México.\n',path=join(folder,'menu-word.md'),output=join(folder,'menu-word.docx')
 await writeFile(path,source);const fileBefore=await stat(path),[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.locator('.preview article')).toContainText('Informe desde el menú nativo')
 // No abrir Exportar ni consultar pandocStatus: se prueba el descubrimiento de Main.
 await expect.poll(async()=>(await applicationMenuItem('export.docx'))?.enabled).toBe(true)
 await app.evaluate(({dialog,BrowserWindow},output)=>{
  Object.defineProperty(dialog,'showSaveDialog',{configurable:true,value:async()=>({canceled:false,filePath:output})})
  const contents=BrowserWindow.getAllWindows()[0].webContents,send=contents.send.bind(contents),state=globalThis as unknown as {nativeWordDispatches:number};state.nativeWordDispatches=0
  contents.send=(channel:string,...args:unknown[])=>{if(channel==='freya:command'&&(args[0]as{id?:string})?.id==='export.docx')state.nativeWordDispatches++;return send(channel,...args)}
 },output)
 await clickApplicationMenu('export.docx')
 await expect.poll(async()=>{try{return(await readFile(output)).subarray(0,2).toString()}catch{return''}},{timeout:30000}).toBe('PK')
 const files=zipFiles(await readFile(output)),xml=files.get('word/document.xml')?.toString()??'',text=xml.replace(/<[^>]*>/g,'')
 expect(text).toContain('Informe desde el menú nativo');expect(text).toContain('Freya, 00123 y México.');expect(xml).not.toMatch(/INCLUDETEXT|INCLUDEPICTURE/)
 expect(await app.evaluate(()=>(globalThis as unknown as {nativeWordDispatches:number}).nativeWordDispatches)).toBe(1)
 expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)).toMatchObject({text:source,revision:doc.revision,dirty:doc.dirty})
 expect(await readFile(path,'utf8')).toBe(source);expect((await stat(path)).mtimeMs).toBe(fileBefore.mtimeMs)
})

test('APP-02: Acerca de muestra versión real, copia sólo diagnóstico y lee licencias del paquete',async()=>{
 const path=join(folder,'CANARIO_DOCUMENTO_PRIVADO.md'),source='# CANARIO_CONTENIDO_PRIVADO\n';await writeFile(path,source);await page.evaluate(path=>window.freya.openPaths([path]),path)
 const metadata=await app.evaluate(({app})=>({version:app.getVersion(),electron:process.versions.electron,chromium:process.versions.chrome,node:process.versions.node,arch:process.arch}))
 expect(metadata.version).toBe((JSON.parse(await readFile('package.json','utf8')) as {version:string}).version)
 const build=execFileSync('git',['rev-parse','--short=7','HEAD'],{encoding:'utf8',timeout:2000}).trim()
 const notices=await readFile('THIRD_PARTY_NOTICES.txt','utf8'),opener=page.locator('.sidebar-bottom .text-button')
 const contrasts:{locale:string;theme:string;minimum:number}[]=[]
 let intercepted=false
 try{
  for(const locale of ['es','en'] as const){
   await page.evaluate(locale=>window.freya.setLanguage(locale),locale)
   for(const theme of ['light','dark'] as const){
    await page.getByLabel('Tema',{exact:true}).selectOption(theme);await opener.focus();await page.keyboard.press('Enter')
    const labels=locale==='es'?{dialog:'Acerca de FreyaLab',copy:'Copiar información',licenses:'Licencias de terceros',updates:'Buscar actualizaciones',copied:'Información copiada.',failed:'No pude copiar la información.'}:{dialog:'About FreyaLab',copy:'Copy information',licenses:'Third-party licenses',updates:'Check for updates',copied:'Information copied.',failed:'Could not copy the information.'}
    const dialog=page.getByRole('dialog'),copy=dialog.getByRole('button',{name:labels.copy,exact:true})
    await expect(copy).toBeVisible();await expect(dialog).toHaveAccessibleName(labels.dialog);await expect(dialog.locator('#about-version')).toHaveText(metadata.version)
    await expect(dialog.locator('[data-info="build"]')).toHaveText(build)
    for(const key of ['electron','chromium','node','arch'] as const)await expect(dialog.locator(`[data-info="${key}"]`)).toHaveText(metadata[key]!)
    await expect(dialog.getByRole('button',{name:labels.updates,exact:true})).toBeDisabled()
    if(!intercepted){
     await app.evaluate(({clipboard})=>{
      const state=globalThis as typeof globalThis&{__freyaAboutClipboard?:{original:typeof clipboard.writeText;values:string[];fail:boolean}}
      state.__freyaAboutClipboard={original:clipboard.writeText,values:[],fail:false}
      clipboard.writeText=async(value:string)=>{const captured=state.__freyaAboutClipboard!;if(captured.fail)throw new Error('CANARIO_ERROR_PRIVADO');captured.values.push(value)}
     });intercepted=true
    }
    await copy.click();await expect(dialog.getByRole('status')).toContainText(labels.copied)
    const copied=await app.evaluate(()=>(globalThis as typeof globalThis&{__freyaAboutClipboard:{values:string[]}}).__freyaAboutClipboard.values.at(-1)!)
    for(const value of Object.values(metadata))expect(copied).toContain(value)
    expect(copied).toContain(build)
    expect(copied).toContain(locale==='es'?'Idioma: es':'Language: en');expect(copied).not.toContain('CANARIO');expect(copied).not.toContain(folder)
    const ratios=await textContrast(dialog)
    const minimum=Math.min(...ratios);expect(minimum).toBeGreaterThanOrEqual(4.5);contrasts.push({locale,theme,minimum})
    for(const size of [{width:1440,height:900},{width:720,height:600}]){
     await page.setViewportSize(size);expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true)
     const box=await dialog.boundingBox();expect(box).not.toBeNull();expect(Math.abs(box!.x+box!.width/2-size.width/2)).toBeLessThanOrEqual(2);expect(Math.abs(box!.y+box!.height/2-size.height/2)).toBeLessThanOrEqual(2)
     if(process.env.FREYALAB_APP02_EVIDENCE==='1')await page.screenshot({path:`docs/evidence/app-02-${locale}-${theme}-${size.width}x${size.height}.png`,animations:'disabled'})
    }
    await page.setViewportSize({width:1440,height:900})
    await app.evaluate(()=>{(globalThis as typeof globalThis&{__freyaAboutClipboard:{fail:boolean}}).__freyaAboutClipboard.fail=true})
    await copy.click();await expect(dialog.getByRole('status')).toContainText(labels.failed);await expect(dialog.getByRole('status')).not.toContainText('CANARIO')
    await app.evaluate(()=>{(globalThis as typeof globalThis&{__freyaAboutClipboard:{fail:boolean}}).__freyaAboutClipboard.fail=false})
    await dialog.getByRole('button',{name:labels.licenses,exact:true}).click();expect(await page.evaluate(()=>window.freya.thirdPartyNotices())).toBe(notices);await expect(dialog.getByRole('textbox',{name:labels.licenses,exact:true})).toHaveValue(notices.replace(/\r\n?/g,'\n'))
    for(let index=0;index<12;index++){await page.keyboard.press('Tab');expect(await dialog.evaluate(node=>node.contains(document.activeElement))).toBe(true)}
    await page.setViewportSize({width:720,height:600});expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true)
    await copy.click();await expect(dialog.getByRole('status')).toContainText(labels.copied);await expect(dialog.getByRole('status')).toBeInViewport({ratio:1})
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();await page.setViewportSize({width:1440,height:900})
   }
  }
  expect(await readFile(path,'utf8')).toBe(source)
  const diagnostic=test.info().outputPath('app-02-diagnostic.json');await writeFile(diagnostic,JSON.stringify({metadata,noticesBytes:Buffer.byteLength(notices),contrasts,packaged:!!process.env.FREYALAB_EXECUTABLE},null,2));await test.info().attach('diagnóstico-sin-datos-personales',{path:diagnostic,contentType:'application/json'})
 }finally{
  if(intercepted)await app.evaluate(({clipboard})=>{const state=globalThis as typeof globalThis&{__freyaAboutClipboard?:{original:typeof clipboard.writeText}};if(state.__freyaAboutClipboard){clipboard.writeText=state.__freyaAboutClipboard.original;delete state.__freyaAboutClipboard}}).catch(()=>{})
 }
})


test('APP-01: menú nativo traducido ofrece acciones de documentos y ayuda',async()=>{
 const labels=await app.evaluate(({Menu})=>Menu.getApplicationMenu()?.items.map(item=>item.label)??[])
 expect(labels).toContain('Archivo');expect(labels).toContain('Edición');expect(labels).toContain('Ver');expect(labels).toContain('Ir');expect(labels).toContain('Ventana');expect(labels).toContain('Ayuda')
})

test('APP-01: menú cambia de idioma y de documento, conserva Mermaid y la ayuda usa el mismo catálogo',async()=>{
 const dumps:Record<string,ApplicationMenuEntry[]>={}
 for(const locale of ['es','en'] as const){
  await page.evaluate(locale=>window.freya.setLanguage(locale),locale)
  dumps[locale]=await applicationMenuTree()
  expect(dumps[locale].map(item=>item.label)).toEqual(process.platform==='darwin'?[locale==='es'?'FreyaLab':'FreyaLab',...(locale==='es'?['Archivo','Edición','Ver','Ir','Ventana','Ayuda']:['File','Edit','View','Go','Window','Help'])]:locale==='es'?['Archivo','Edición','Ver','Ir','Ventana','Ayuda']:['File','Edit','View','Go','Window','Help'])
  const catalog=await page.evaluate(()=>window.freya.applicationShortcuts())
  for(const item of flatApplicationMenu(dumps[locale])){const command=catalog.commands.find(command=>command.id===item.id);if(command)expect(item.accelerator,`metadato ${item.id}`).toBe(command.accelerator)}
 }
 await page.evaluate(()=>window.freya.setLanguage('es'))
 for(const id of ['file.save','file.saveAs','file.close','go.row','view.mode','view.outline'])expect((await applicationMenuItem(id))?.enabled).toBe(false)
 await clickApplicationMenu('file.newMarkdown');await expect(page.getByRole('tab',{name:'Sin título.md',exact:true})).toHaveCount(1)
 await expect.poll(async()=>(await applicationMenuItem('file.save'))?.enabled).toBe(true)
 for(const id of ['view.mode.edit','view.mode.split','view.mode.preview'])expect((await applicationMenuItem(id))?.accelerator).toBeNull()
 const pandoc=await page.evaluate(()=>window.freya.pandocStatus())
 await expect.poll(async()=>(await applicationMenuItem('file.exports'))?.submenu.map(item=>item.id)).toEqual(['export.pdf','export.html',...(pandoc.available?['export.docx']:[])])
 await clickApplicationMenu('view.mode.preview');await expect(page.getByRole('button',{name:'Vista previa',exact:true})).toHaveClass(/active/)
 await expect.poll(async()=>(await applicationMenuItem('view.mode.preview'))?.checked).toBe(true)
 await clickApplicationMenu('help.shortcuts');const shortcuts=page.getByRole('dialog',{name:'Atajos de teclado',exact:true});await expect(shortcuts).toBeVisible()
 const help=await page.evaluate(()=>window.freya.applicationShortcuts());expect(help.commands.filter(command=>command.id.startsWith('view.mode.')).every(command=>command.accelerator===null)).toBe(true)
 await shortcuts.getByLabel('Buscar acción',{exact:true}).fill('Guardar');await expect(shortcuts.getByRole('cell',{name:'Guardar',exact:true})).toBeVisible();await shortcuts.getByRole('button',{name:'Cerrar',exact:true}).click()
 await clickApplicationMenu('help.licenses');await expect(page.getByRole('textbox',{name:'Licencias de terceros',exact:true})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click()
 await clickApplicationMenu('file.newMermaid');await expect(page.getByRole('tab',{name:'Sin título.mmd',exact:true})).toHaveCount(1)
 await expect.poll(async()=>(await applicationMenuItem('file.exports'))?.submenu.map(item=>item.id)).toEqual(['export.svg','export.png','export.pdf'])
 const modes=page.getByRole('group',{name:'Modo de edición',exact:true});await modes.getByRole('button',{name:'Dividido',exact:true}).click()
 await page.locator('.cm-content').focus();await page.keyboard.insertText('flowchart LR\n A --> B\n')
 const canvas=page.getByRole('region',{name:'Área de desplazamiento del diagrama',exact:true});await expect(canvas.locator('svg')).toBeVisible();await canvas.focus()
 await page.keyboard.press('ControlOrMeta+1');await expect(page.locator('.diagram-toolbar>span').last()).toContainText('100')
 await page.keyboard.press('ControlOrMeta+2');await page.keyboard.press('ControlOrMeta+3');await expect(modes.getByRole('button',{name:'Dividido',exact:true})).toHaveClass(/active/)
 if(process.env.FREYALAB_APP01_EVIDENCE==='1')await writeFile('docs/evidence/app-01-menu-es-en-2026-10-29.json',JSON.stringify(dumps,null,2)+'\n')
})

test('APP-01: acciones de archivo y barra lateral se despachan una sola vez',async()=>{
 await app.evaluate((_electron,folder)=>{process.env.FREYALAB_TEST_SAVE_DIR=folder},folder)
 await clickApplicationMenu('file.newMarkdown');await expect(page.getByRole('tablist',{name:'Documentos abiertos',exact:true}).getByRole('tab')).toHaveCount(1)
 await clickApplicationMenu('file.newMermaid');await expect(page.getByRole('tablist',{name:'Documentos abiertos',exact:true}).getByRole('tab')).toHaveCount(2)
 await clickApplicationMenu('file.newCsv');await expect(page.getByRole('tablist',{name:'Documentos abiertos',exact:true}).getByRole('tab')).toHaveCount(3)
 const kinds=await page.evaluate(async()=>(await window.freya.documents()).map(document=>document.kind));expect(kinds).toEqual(['markdown','mermaid','csv'])
 await page.getByRole('tab',{name:'Sin título.md',exact:true}).click();await page.locator('.cm-content').focus();await page.keyboard.insertText('# Una sola vez\n')
 await clickApplicationMenu('file.save');await expect.poll(()=>readFile(join(folder,'documento.md'),'utf8').catch(()=>null)).toBe('# Una sola vez\n')
 const toggle=page.getByRole('button',{name:'Mostrar u ocultar explorador',exact:true});await toggle.focus();await clickApplicationMenu('view.sidebar');await expect(page.locator('aside.sidebar')).toHaveCount(0)
 await toggle.focus();await clickApplicationMenu('view.sidebar');await expect(page.locator('aside.sidebar')).toBeVisible()
 await clickApplicationMenu('file.close');await expect(page.getByRole('tablist',{name:'Documentos abiertos',exact:true}).getByRole('tab')).toHaveCount(2)
 expect(await page.evaluate(async()=>(await window.freya.documents()).length)).toBe(2)
})

test('APP-01: reciente eliminado se quita de la lista y avisa sin tocar otros archivos',async()=>{
 const path=join(folder,'ya-no-existe.md'),retained=join(folder,'conservado.md');await writeFile(path,'# efímero\n');await writeFile(retained,'# intacto\n')
 const docs=await page.evaluate(async paths=>{const result=[];for(const path of paths)result.push(...await window.freya.openPaths([path]));return result},[retained,path])
 for(const document of docs)await page.getByRole('button',{name:`Cerrar ${document.name}`,exact:true}).click()
 await rm(path);await expect.poll(async()=>(await applicationMenuItem('recent.0'))?.label).toBe('ya-no-existe.md')
 await clickApplicationMenu('recent.0');await expect(page.getByRole('status').filter({hasText:'No encontré «ya-no-existe.md»'})).toBeVisible()
 expect(await page.evaluate(()=>window.freya.recents())).toEqual([await realpath(retained)]);expect(await readFile(retained,'utf8')).toBe('# intacto\n')
 await expect.poll(async()=>(await applicationMenuItem('recent.0'))?.label).toBe('conservado.md')
})

test('APP-01: elementos de archivo, búsqueda y navegación conservan sus acciones',async()=>{
 const source=join(folder,'abrir.md'),copy=join(folder,'copia.md');await writeFile(source,'# Documento abierto\n')
 await app.evaluate(({dialog},input)=>{
  const state=globalThis as unknown as {openRequests:string[][]};state.openRequests=[];delete process.env.FREYALAB_TEST_FOLDER;process.env.FREYALAB_TEST_SAVE_PATH=input.copy
  Object.defineProperty(dialog,'showOpenDialog',{configurable:true,value:async(...args:unknown[])=>{const options=args.at(-1) as {properties:string[]};state.openRequests.push(options.properties);return{canceled:false,filePaths:[options.properties.includes('openDirectory')?input.folder:input.source]}}})
 },{source,copy,folder})
 await clickApplicationMenu('file.open');await expect(page.getByRole('tab',{name:'abrir.md',exact:true})).toHaveCount(1)
 await clickApplicationMenu('file.openFolder');await expect(page.locator('aside.sidebar')).toContainText(basename(folder))
 expect(await app.evaluate(()=>(globalThis as unknown as {openRequests:string[][]}).openRequests)).toEqual([['openFile','multiSelections'],['openDirectory']])
 await clickApplicationMenu('file.saveAs');await expect.poll(()=>readFile(copy,'utf8').catch(()=>null)).toBe('# Documento abierto\n')
 await page.locator('.cm-content').focus();await clickApplicationMenu('search.document');await expect(page.locator('.cm-search input[name="search"]')).toBeFocused()
 await clickApplicationMenu('search.replace');await expect(page.locator('.cm-search input[name="replace"]')).toBeFocused();await page.keyboard.press('Escape')
 await clickApplicationMenu('file.newMermaid');await expect(page.getByRole('tab',{name:'Sin título.mmd',exact:true})).toBeVisible()
 await clickApplicationMenu('go.previousTab');await expect(page.getByRole('tab',{name:'copia.md',exact:true})).toHaveAttribute('aria-selected','true')
 await clickApplicationMenu('go.nextTab');await expect(page.getByRole('tab',{name:'Sin título.mmd',exact:true})).toHaveAttribute('aria-selected','true')
 await open('id,nombre\n00123,Freya\n');await expect(page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true})).toHaveText('Freya');await expect(page.getByRole('button',{name:'Ir a la fila',exact:true})).toBeEnabled();await page.getByRole('grid',{name:'Tabla de datos',exact:true}).focus()
 await clickApplicationMenu('go.row');await expect(page.getByRole('spinbutton',{name:'Número de fila',exact:true})).toBeFocused();await page.keyboard.press('Escape')
 await clickApplicationMenu('edit.commandPalette');await expect(palette()).toBeVisible();await page.keyboard.press('Escape')
 expect(await readFile(source,'utf8')).toBe('# Documento abierto\n')
})

test('APP-01: Ayuda sólo abre enlaces HTTPS fijos y no envía información',async()=>{
 await app.evaluate(({shell})=>{const state=globalThis as unknown as {helpLinks:string[]};state.helpLinks=[];Object.defineProperty(shell,'openExternal',{configurable:true,value:async(url:string)=>{state.helpLinks.push(url)}})})
 for(const id of ['help.documentation','help.releaseNotes','help.issue','help.security'])await clickApplicationMenu(id)
 const version=await app.evaluate(({app})=>app.getVersion())
 await expect.poll(()=>app.evaluate(()=>(globalThis as unknown as {helpLinks:string[]}).helpLinks.slice().sort())).toEqual(['https://github.com/ruzer/freyalab#readme',`https://github.com/ruzer/freyalab/releases/tag/v${encodeURIComponent(version)}`,'https://github.com/ruzer/freyalab/issues/new','https://github.com/ruzer/freyalab/blob/main/SECURITY.md'].sort())
})

for(const kind of ['markdown','mermaid','sql'] as const)test(`APP-01 M5: edición ${kind} usa el historial CodeMirror y no el nativo`,async()=>{
 if(kind==='sql'){await open('id,total\n00123,10\n');await showPanel(page,'Análisis');await expect(page.locator('.sql-editor .cm-content')).toBeVisible()}
 else await clickApplicationMenu(kind==='markdown'?'file.newMarkdown':'file.newMermaid')
 const content=page.locator(kind==='sql'?'.sql-editor .cm-content':'.editor-pane .cm-content');await content.focus()
 const initial=await content.innerText();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.insertText('prueba')
 await expect(content).toContainText('prueba')
 await app.evaluate(({BrowserWindow})=>{const contents=BrowserWindow.getAllWindows()[0].webContents;Object.defineProperty(contents,'undo',{configurable:true,value:()=>{throw new Error('No usar historial nativo en CodeMirror')}})})
 await clickApplicationMenu('edit.undo');await expect(content).not.toContainText('prueba')
 await clickApplicationMenu('edit.redo');await expect(content).toContainText('prueba')
 await clickApplicationMenu('edit.selectAll');expect(await content.evaluate(element=>{const selection=window.getSelection();return !!selection&&!selection.isCollapsed&&element.contains(selection.anchorNode)})).toBe(true)
 await clickApplicationMenu('search.document');await expect(page.locator(kind==='sql'?'.sql-editor .cm-search':'.editor-pane .cm-search')).toBeVisible()
 expect(initial).not.toContain('prueba')
})

test('APP-01 M5: campos nativos y celda CSV editan su campo, la rejilla usa el historial CSV',async()=>{
 const {path}=await open('id,nombre\n00123,Freya\n00234,Luna\n')
 const input=page.getByLabel('Buscar en tabla',{exact:true});await input.focus();await page.keyboard.insertText('Freya')
 await clickApplicationMenu('edit.undo');await expect(input).toHaveValue('')
 await clickApplicationMenu('edit.redo');await expect(input).toHaveValue('Freya')
 await input.fill('');const firstCell=page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true});await expect(firstCell).toContainText('Freya')
 await firstCell.dblclick();const cell=page.locator('.cell-input');await expect(cell).toBeFocused();await page.keyboard.press('End');await page.keyboard.insertText('XX')
 await clickApplicationMenu('edit.undo');await expect(cell).toHaveValue('Freya')
 await clickApplicationMenu('edit.redo');await expect(cell).toHaveValue('FreyaXX');await cell.press('Enter')
 const grid=page.getByRole('grid',{name:'Tabla de datos',exact:true});await grid.focus();await clickApplicationMenu('edit.undo');await expect(firstCell).toHaveText('Freya')
 await clickApplicationMenu('edit.redo');await expect(firstCell).toHaveText('FreyaXX')
 expect(await readFile(path,'utf8')).toBe('id,nombre\n00123,Freya\n00234,Luna\n')
 // Sólo intercepta escritura; nunca lee ni modifica el portapapeles de la laptop.
 await app.evaluate(({clipboard})=>{const target=globalThis as unknown as {menuClipboard:string[]};target.menuClipboard=[];Object.defineProperty(clipboard,'writeText',{configurable:true,value:async(value:string)=>{target.menuClipboard.push(value)}})})
 await grid.focus();await clickApplicationMenu('edit.selectAll');await clickApplicationMenu('edit.copy')
 await expect.poll(()=>app.evaluate(()=>{return (globalThis as unknown as {menuClipboard:string[]}).menuClipboard[0]})).toBe('00123\tFreyaXX\n00234\tLuna\n')
})

test('APP-01 M5: copiar, cortar y pegar sólo delegan el comando nativo elegido',async()=>{
 await open('id,nombre\n00123,Freya\n');const input=page.getByLabel('Buscar en tabla',{exact:true});await input.fill('Freya');await input.evaluate(element=>(element as HTMLInputElement).select())
 await app.evaluate(({BrowserWindow})=>{const state=globalThis as unknown as {nativeEdits:string[]};state.nativeEdits=[];const contents=BrowserWindow.getAllWindows()[0].webContents;for(const method of ['copy','cut','paste','pasteAndMatchStyle'] as const)Object.defineProperty(contents,method,{configurable:true,value:()=>state.nativeEdits.push(method)})})
 for(const id of ['edit.copy','edit.cut','edit.paste','edit.pastePlain'])await clickApplicationMenu(id)
 await expect.poll(()=>app.evaluate(()=>(globalThis as unknown as {nativeEdits:string[]}).nativeEdits)).toEqual(['copy','cut','paste','pasteAndMatchStyle'])
 await expect(input).toHaveValue('Freya')
 await input.evaluate(element=>(element as HTMLInputElement).readOnly=true);await input.blur();await input.focus()
 await expect.poll(async()=>(await applicationMenuItem('edit.paste'))?.enabled).toBe(false)
 expect((await applicationMenuItem('edit.cut'))?.enabled).toBe(false);expect((await applicationMenuItem('edit.undo'))?.enabled).toBe(false);expect((await applicationMenuItem('edit.copy'))?.enabled).toBe(true)
})

test('APP-01 integridad: Guardar aplica la celda activa antes de escribir el CSV',async()=>{
 const {path}=await open('id,nombre\n00123,Freya\n00234,Luna\n')
 await page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true}).dblclick();await page.getByRole('textbox',{name:'Editar celda',exact:true}).fill('Freya editada')
 await clickApplicationMenu('file.save');await expect(page.locator('.toast')).toContainText('Archivo guardado')
 expect(await readFile(path,'utf8')).toBe('id,nombre\n00123,Freya editada\n00234,Luna\n')
})

test('APP-01 integridad: Guardar aplica el encabezado activo antes de escribir el CSV',async()=>{
 const {path}=await open('id,nombre\n00123,Freya\n00234,Luna\n')
 await page.getByRole('button',{name:'Editar encabezado 2',exact:true}).click();await page.getByRole('textbox',{name:'Nombre del encabezado',exact:true}).fill('apodo')
 await clickApplicationMenu('file.save');await expect(page.locator('.toast')).toContainText('Archivo guardado')
 expect(await readFile(path,'utf8')).toBe('id,apodo\n00123,Freya\n00234,Luna\n')
})

test('APP-01 integridad: cambiar de documento desde Ventana conserva la celda activa',async()=>{
 const original='id,nombre\n00123,Freya\n00234,Luna\n',{doc,path}=await open(original)
 await clickApplicationMenu('file.newMarkdown');const other=(await page.evaluate(()=>window.freya.documents())).find(value=>value.kind==='markdown')!
 await clickApplicationMenu(`document.${doc.id}`);await expect(page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true})).toBeVisible()
 await page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true}).dblclick();await page.getByRole('textbox',{name:'Editar celda',exact:true}).fill('Freya editada')
 await clickApplicationMenu(`document.${other.id}`);await expect(page.getByRole('tab',{name:other.name,exact:true})).toHaveAttribute('aria-selected','true')
 await clickApplicationMenu(`document.${doc.id}`);await expect(page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true})).toHaveText('Freya editada')
 expect(await readFile(path,'utf8')).toBe(original)
})

test('APP-01 integridad: la última elección de pestaña prevalece mientras se prepara la celda',async()=>{
 const {doc}=await open('id,nombre\n00123,Freya\n');await clickApplicationMenu('file.newMarkdown');const other=(await page.evaluate(()=>window.freya.documents())).find(value=>value.kind==='markdown')!
 await clickApplicationMenu(`document.${doc.id}`);const field=page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true});await field.dblclick();await page.getByRole('textbox',{name:'Editar celda',exact:true}).fill('Freya editada')
 await page.evaluate(names=>{const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('.tabs [role="tab"]'));buttons.find(button=>button.textContent?.includes(names.other))!.click();buttons.find(button=>button.textContent?.includes(names.current))!.click()},{current:doc.name,other:other.name})
 await expect(page.getByRole('tab').filter({hasText:doc.name})).toHaveAttribute('aria-selected','true');await expect(field).toHaveText('Freya editada')
})

test('APP-01 integridad: Guardar como conserva la fuente y copia el borrador de celda',async()=>{
 const source='id,nombre\n00123,Freya\n',{path}=await open(source),copy=join(folder,'copia.csv')
 await app.evaluate((_electron,path)=>{process.env.FREYALAB_TEST_SAVE_PATH=path},copy)
 await page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true}).dblclick();await page.getByRole('textbox',{name:'Editar celda',exact:true}).fill('Freya editada')
 await clickApplicationMenu('file.saveAs');await expect(page.locator('.toast')).toContainText('Archivo guardado')
 expect(await readFile(copy,'utf8')).toBe('id,nombre\n00123,Freya editada\n');expect(await readFile(path,'utf8')).toBe(source)
})

test('APP-01 integridad: Cerrar prepara el borrador y permite cancelar la confirmación existente',async()=>{
 const source='id,nombre\n00123,Freya\n',{doc,path}=await open(source)
 await app.evaluate(({dialog})=>{const state=globalThis as unknown as {closeRequests:string[]};state.closeRequests=[];Object.defineProperty(dialog,'showMessageBox',{configurable:true,value:async(...args:unknown[])=>{state.closeRequests.push((args.at(-1) as {message:string}).message);return{response:1,checkboxChecked:false}}})})
 await page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true}).dblclick();await page.getByRole('textbox',{name:'Editar celda',exact:true}).fill('Freya editada')
 await clickApplicationMenu('file.close');await expect.poll(()=>app.evaluate(()=>(globalThis as unknown as {closeRequests:string[]}).closeRequests.length)).toBe(1)
 await expect(page.getByRole('tab').filter({hasText:doc.name})).toBeVisible();await expect(page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true})).toHaveText('Freya editada')
 expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)?.dirty).toBe(true);expect(await readFile(path,'utf8')).toBe(source)
})

test('APP-01 integridad: Exportar incluye la celda preparada sin guardar el original',async()=>{
 const source='id,nombre\n00123,Freya\n',{doc,path}=await open(source),copy=join(folder,'exportado.csv')
 await app.evaluate((_electron,path)=>{process.env.FREYALAB_TEST_EXPORT_PATH=path},copy)
 await page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true}).dblclick();await page.getByRole('textbox',{name:'Editar celda',exact:true}).fill('Freya editada')
 await clickApplicationMenu('export.csv');await expect(page.locator('.toast')).toContainText('Exportado:')
 expect(await readFile(copy,'utf8')).toBe('id,nombre\n00123,Freya editada\n');expect(await readFile(path,'utf8')).toBe(source)
 expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)?.dirty).toBe(true)
})

test('APP-01 integridad: navegar siguiente y anterior prepara la celda en ambos sentidos',async()=>{
 const source='id,nombre\n00123,Freya\n',{doc,path}=await open(source);await clickApplicationMenu('file.newMarkdown');await expect(page.getByRole('tab',{name:'Sin título.md',exact:true})).toHaveAttribute('aria-selected','true');await clickApplicationMenu(`document.${doc.id}`)
 for(const[leave,back,value]of [['go.nextTab','go.previousTab','Freya siguiente'],['go.previousTab','go.nextTab','Freya anterior']]){
  await page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true}).dblclick();await page.getByRole('textbox',{name:'Editar celda',exact:true}).fill(value)
  await clickApplicationMenu(leave);await expect(page.getByRole('tab',{name:'Sin título.md',exact:true})).toHaveAttribute('aria-selected','true')
  await clickApplicationMenu(back);await expect(page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true})).toHaveText(value)
 }
 expect(await readFile(path,'utf8')).toBe(source)
})

test('APP-01 integridad: un encabezado rechazado bloquea Guardar, Cerrar y navegar aunque pierda foco',async()=>{
 const source='id,nombre\n00123,Freya\n',{doc,path}=await open(source),before=await stat(path),draft='x'.repeat(10001)
 await clickApplicationMenu('file.newMarkdown');const other=(await page.evaluate(()=>window.freya.documents())).find(document=>document.kind==='markdown')!
 await clickApplicationMenu(`document.${doc.id}`);await page.getByRole('button',{name:'Editar encabezado 2',exact:true}).click()
 const input=page.getByRole('textbox',{name:'Nombre del encabezado',exact:true});await input.fill(draft)
 for(const command of ['file.save','file.save','file.close',`document.${other.id}`]){
  await clickApplicationMenu(command);await expect(page.locator('.toast')).toContainText('Datos de operación no válidos');await expect(input).toHaveValue(draft)
  await expect(page.getByRole('tab',{name:'data.csv',exact:true})).toHaveAttribute('aria-selected','true');expect(await readFile(path,'utf8')).toBe(source);expect((await stat(path)).mtimeMs).toBe(before.mtimeMs)
  expect((await page.evaluate(()=>window.freya.documents())).find(document=>document.id===doc.id)).toMatchObject({dirty:false,headers:['id','nombre']})
  await page.getByRole('button',{name:'Cerrar aviso',exact:true}).click();await expect(page.locator('.toast')).toHaveCount(0)
 }
 await input.fill('apodo');await clickApplicationMenu('file.save');await expect.poll(()=>readFile(path,'utf8')).toBe('id,apodo\n00123,Freya\n')
})

test('APP-01 integridad: si preparar la celda falla, no guarda ni descarta el borrador',async()=>{
 const source='id,nombre\n00123,Freya\n',{path}=await open(source),before=await stat(path),size=1024*1024+1
 await page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true}).dblclick();const input=page.getByRole('textbox',{name:'Editar celda',exact:true});await input.fill('x'.repeat(size))
 await clickApplicationMenu('file.save');await expect(page.locator('.toast')).toContainText('Datos de operación no válidos')
 expect(await input.evaluate(element=>(element as HTMLInputElement).value.length)).toBe(size);expect(await readFile(path,'utf8')).toBe(source);expect((await stat(path)).mtimeMs).toBe(before.mtimeMs)
 await expect(page.getByRole('tab',{name:'data.csv',exact:true})).toBeVisible()
})

test('APP-03: el menú abre Ajustes y Escape devuelve el foco',async()=>{
 const origin=page.getByRole('button',{name:'Mostrar u ocultar explorador',exact:true});await origin.focus()
 await clickApplicationMenu('app.settings')
 const dialog=page.getByRole('dialog',{name:'Ajustes',exact:true});await expect(dialog).toBeVisible()
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(origin).toBeFocused()
})

test('APP-03: Ajustes usa teclado, aplica apariencia y restablece sólo su sección',async()=>{
 const source='# Fuente original\n';const path=join(folder,'original.md');await writeFile(path,source);await page.evaluate(path=>window.freya.openPaths([path]),path)
 await clickApplicationMenu('app.settings');const dialog=page.getByRole('dialog',{name:'Ajustes',exact:true})
 await dialog.getByRole('tab',{name:'General',exact:true}).focus();await page.keyboard.press('ArrowDown');await expect(dialog.getByRole('tab',{name:'Apariencia',exact:true})).toHaveAttribute('aria-selected','true')
 await dialog.getByRole('combobox',{name:'Tema',exact:true}).selectOption('dark');await expect(page.locator('html')).toHaveClass(/dark/)
 await expect.poll(()=>page.evaluate(async()=>(await window.freya.settings()).values.tema)).toBe('dark')
 await dialog.getByRole('checkbox',{name:'Mostrar barra lateral',exact:true}).uncheck();await expect(page.locator('aside.sidebar')).toHaveCount(0)
 await dialog.getByRole('combobox',{name:'Vista inicial de Markdown',exact:true}).selectOption('edit')
 await expect(page.getByRole('button',{name:'Dividido',exact:true})).toHaveClass(/active/)
 for(const theme of ['light','dark'] as const){await dialog.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme);await expect.poll(()=>page.evaluate(async()=>(await window.freya.settings()).values.tema)).toBe(theme);await expect.poll(()=>page.locator('html').evaluate(element=>element.classList.contains('dark'))).toBe(theme==='dark');await expect(dialog).toHaveAttribute('aria-busy','false');expect(Math.min(...await textContrast(dialog,'h2,h3,p,label,button:not(:disabled),select:not(:disabled)'))).toBeGreaterThanOrEqual(4.5);if(process.env.FREYALAB_APP01_EVIDENCE==='1')await page.screenshot({path:`docs/evidence/app-03-ajustes-${theme}-1440-2026-10-29.png`,animations:'disabled'})}
 await dialog.getByRole('button',{name:'Restablecer esta sección',exact:true}).click();await expect(dialog.getByRole('combobox',{name:'Tema',exact:true})).toHaveValue('system');await expect(dialog.getByRole('checkbox',{name:'Mostrar barra lateral',exact:true})).toBeChecked()
 await expect.poll(()=>page.evaluate(async()=>(await window.freya.settings()).values.markdown.modoInicial)).toBe('split')
 await dialog.getByRole('tab',{name:'Apariencia',exact:true}).focus();await page.keyboard.press('End');await expect(dialog.getByRole('tab',{name:'Avanzado',exact:true})).toHaveAttribute('aria-selected','true')
 await dialog.getByRole('checkbox',{name:'Mostrar herramientas de desarrollo',exact:true}).check();await expect.poll(()=>page.evaluate(async()=>(await window.freya.settings()).values.avanzado.herramientasDeDesarrollo)).toBe(true)
 await dialog.getByRole('button',{name:'Restablecer esta sección',exact:true}).click();await expect(dialog.getByRole('checkbox',{name:'Mostrar herramientas de desarrollo',exact:true})).not.toBeChecked()
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0)
 expect(await readFile(path,'utf8')).toBe(source)
})

test('APP-03: Archivos y Avanzado confirman sus acciones y conservan los documentos',async()=>{
 const source='# Documento conservado\n',path=join(folder,'conservado.md');await writeFile(path,source);await page.evaluate(path=>window.freya.openPaths([path]),path)
 const before=await page.evaluate(()=>window.freya.recents())
 await app.evaluate(({dialog,shell})=>{
  const state=globalThis as unknown as {settingsQuestions:number;settingsResponses:number[];settingsFolders:string[]};state.settingsQuestions=0;state.settingsResponses=[1,0,1,0];state.settingsFolders=[]
  Object.defineProperty(dialog,'showMessageBox',{configurable:true,value:async()=>{state.settingsQuestions++;return{response:state.settingsResponses.shift()??1,checkboxChecked:false}}})
  Object.defineProperty(shell,'openPath',{configurable:true,value:async(path:string)=>{state.settingsFolders.push(path);return''}})
 })
 await clickApplicationMenu('app.settings');const dialog=page.getByRole('dialog',{name:'Ajustes',exact:true})
 await expect.poll(async()=>(await applicationMenuItem('file.close'))?.enabled).toBe(false)
 await dialog.getByRole('tab',{name:'Archivos',exact:true}).click();const clear=dialog.getByRole('button',{name:'Borrar lista de archivos recientes',exact:true})
 await clear.click();await expect(dialog).toHaveAttribute('aria-busy','false');expect(await page.evaluate(()=>window.freya.recents())).toEqual(before)
 await clear.click();await expect.poll(()=>page.evaluate(()=>window.freya.recents())).toEqual([])
 await dialog.getByRole('tab',{name:'Avanzado',exact:true}).click();await dialog.getByRole('checkbox',{name:'Mostrar herramientas de desarrollo',exact:true}).check()
 await expect.poll(()=>page.evaluate(async()=>(await window.freya.settings()).values.avanzado.herramientasDeDesarrollo)).toBe(true)
 await expect.poll(async()=>!!await applicationMenuItem('view.devTools')).toBe(true)
 await dialog.getByRole('button',{name:'Mostrar la carpeta de datos',exact:true}).click();await expect(dialog).toHaveAttribute('aria-busy','false')
 const data=await app.evaluate(({app})=>app.getPath('userData'));expect(await app.evaluate(()=>(globalThis as unknown as {settingsFolders:string[]}).settingsFolders)).toEqual([data])
 const reset=dialog.getByRole('button',{name:'Restablecer todos los ajustes',exact:true});await reset.click();await expect(dialog).toHaveAttribute('aria-busy','false');expect((await page.evaluate(()=>window.freya.settings())).values.avanzado.herramientasDeDesarrollo).toBe(true)
 await reset.click()
 const systemLanguages=await app.evaluate(({app})=>app.getPreferredSystemLanguages()),language=/^es(?:-|$)/i.test(systemLanguages[0]??'')?'es':'en'
 await expect.poll(()=>page.evaluate(()=>window.freya.language())).toEqual({preference:'sistema',language})
 const labels=language==='es'?es:en,restored=page.getByRole('dialog',{name:labels['settings.title'],exact:true})
 await expect(restored.getByRole('checkbox',{name:labels['settings.devTools'],exact:true})).not.toBeChecked()
 expect((await page.evaluate(()=>window.freya.settings())).values).toEqual(defaultSettings())
 expect(await app.evaluate(()=>(globalThis as unknown as {settingsQuestions:number}).settingsQuestions)).toBe(4)
 expect(await page.evaluate(()=>window.freya.recents())).toEqual([]);expect(await readFile(path,'utf8')).toBe(source)
 if(await app.evaluate(({app})=>app.isPackaged))await expect.poll(async()=>await applicationMenuItem('view.devTools')).toBeUndefined()
 await page.keyboard.press('Escape');await expect(page.getByRole('tab',{name:'conservado.md',exact:true})).toBeVisible()
})

test('APP-03 S15-S16: todas las secciones conservan contraste, foco y espacio en es y en',async()=>{
 if(process.env.FREYALAB_APP01_EVIDENCE==='1'&&process.platform==='darwin')await writeFile('docs/evidence/app-01-macos-permissions-2026-10-29.json',JSON.stringify(await app.evaluate(({systemPreferences})=>({accessibility:systemPreferences.isTrustedAccessibilityClient(false),screen:systemPreferences.getMediaAccessStatus('screen'),prompted:false})),null,2)+'\n')
 const reports:{locale:string;theme:string;viewport:{width:number;height:number};section:string;minimum:number}[]=[]
 const sections=[['general','General','General'],['appearance','Apariencia','Appearance'],['files','Archivos','Files'],['updates','Actualizaciones','Updates'],['privacy','Privacidad','Privacy'],['advanced','Avanzado','Advanced']] as const
 for(const locale of ['es','en'] as const){
  await page.evaluate(locale=>window.freya.setLanguage(locale),locale);await expect(page.locator('html')).toHaveAttribute('lang',locale)
  await clickApplicationMenu('app.settings');const dialog=page.getByRole('dialog',{name:locale==='es'?'Ajustes':'Settings',exact:true})
  for(const theme of ['light','dark'] as const){
   await page.evaluate(theme=>window.freya.setSettings({tema:theme}),theme);await expect.poll(()=>page.locator('html').evaluate(element=>element.classList.contains('dark'))).toBe(theme==='dark')
   for(const viewport of [{width:1440,height:900},{width:720,height:600}]){
    await page.setViewportSize(viewport)
    for(const [section,es,en] of sections){
     const tab=dialog.getByRole('tab',{name:locale==='es'?es:en,exact:true});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true')
     await expect(dialog.getByRole('tabpanel')).toHaveAttribute('aria-labelledby',`settings-tab-${section}`)
     expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true)
     expect(await dialog.getByRole('tabpanel').evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true)
     const box=await dialog.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width);expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height)
     const close=dialog.getByRole('button',{name:locale==='es'?'Cerrar':'Close',exact:true});await close.focus();await page.keyboard.press('Tab');await expect(tab).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(close).toBeFocused()
     const minimum=Math.min(...await textContrast(dialog,'h2,h3,p,label,button:not(:disabled),select:not(:disabled)'));expect(minimum).toBeGreaterThanOrEqual(4.5)
     reports.push({locale,theme,viewport,section,minimum})
     if(process.env.FREYALAB_APP01_EVIDENCE==='1')await page.screenshot({path:`docs/evidence/app-03-${locale}-${theme}-${viewport.width}x${viewport.height}-${section}-2026-10-29.png`,animations:'disabled'})
    }
   }
  }
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0)
 }
 expect(reports).toHaveLength(48)
 if(process.env.FREYALAB_APP01_EVIDENCE==='1')await writeFile('docs/evidence/app-03-sections-2026-10-29.json',JSON.stringify(reports,null,2)+'\n')
})

test('APP-03: versión futura deja los ajustes de solo lectura y conserva todos sus bytes',async()=>{
 await expect.poll(()=>page.evaluate(async()=>(await window.freya.settings()).migrationPending)).toBe(false)
 const path=join(folder,'profile','settings.json'),future='{"version":99,"privado":"CANARIO_NO_SOBRESCRIBIR"}\n';await writeFile(path,future)
 await restartApplication('es');await expect.poll(()=>page.evaluate(async()=>(await window.freya.settings()).readonly)).toBe(true)
 await clickApplicationMenu('app.settings');const dialog=page.getByRole('dialog',{name:'Ajustes',exact:true});await dialog.getByRole('tab',{name:'Apariencia',exact:true}).click()
 await expect(dialog.getByRole('combobox',{name:'Tema',exact:true})).toBeDisabled();await expect(dialog.getByRole('checkbox',{name:'Mostrar barra lateral',exact:true})).toBeDisabled();await expect(dialog.getByRole('button',{name:'Restablecer esta sección',exact:true})).toBeDisabled()
 await dialog.getByRole('tab',{name:'Avanzado',exact:true}).click();await expect(dialog.getByRole('button',{name:'Restablecer todos los ajustes',exact:true})).toBeDisabled()
 expect(await readFile(path,'utf8')).toBe(future);await page.keyboard.press('Escape')
})

test('APP-01: menú y ayuda conservan los identificadores en pseudolocalización',async()=>{
 await restartApplication('en-XA');await expect(page.locator('html')).toHaveAttribute('lang','en-XA')
 const tree=await applicationMenuTree();expect(flatApplicationMenu(tree).find(item=>item.id==='file.open')?.label).not.toBe('Open…')
 expect((await applicationMenuItem('file.open'))?.accelerator).toBeTruthy()
 await clickApplicationMenu('help.shortcuts');await expect(page.locator('dialog')).toBeVisible();expect((await page.evaluate(()=>window.freya.applicationShortcuts())).commands.some(command=>command.id==='file.save')).toBe(true)
 if(process.env.FREYALAB_APP01_EVIDENCE==='1')await writeFile('docs/evidence/app-01-menu-en-XA-2026-10-29.json',JSON.stringify(tree,null,2)+'\n')
 await page.keyboard.press('Escape');await clickApplicationMenu('app.settings');const dialog=page.getByRole('dialog'),tab=dialog.getByRole('tab',{selected:true})
 for(const theme of ['light','dark'] as const){
  await page.evaluate(theme=>window.freya.setSettings({tema:theme}),theme);await expect.poll(()=>page.locator('html').evaluate(element=>element.classList.contains('dark'))).toBe(theme==='dark')
  for(const viewport of [{width:1440,height:900},{width:720,height:600}]){
   await page.setViewportSize(viewport);expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);expect(await dialog.getByRole('tabpanel').evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true)
   const box=await dialog.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width);expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height)
   const close=dialog.locator('footer button');await close.focus();await page.keyboard.press('Tab');await expect(tab).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(close).toBeFocused()
   expect(Math.min(...await textContrast(dialog,'h2,h3,p,label,button:not(:disabled),select:not(:disabled)'))).toBeGreaterThanOrEqual(4.5)
   if(process.env.FREYALAB_APP01_EVIDENCE==='1')await page.screenshot({path:`docs/evidence/app-03-en-XA-${theme}-${viewport.width}x${viewport.height}-general-2026-10-29.png`,animations:'disabled'})
  }
 }
})


test('APP-03: migra el perfil anterior una vez y conserva ajustes sin modificar documentos',async()=>{
 expect(await page.evaluate(()=>typeof window.freya.settings)).toBe('function')
 const keys=['freya-theme','freya-sidebar','freya-sidebar-width','freya-sidebar-tab','freya-split']
 const previous={'freya-theme':'dark','freya-sidebar':'false','freya-sidebar-width':'300.5','freya-sidebar-tab':'outline','freya-split':'62.5'}
 await expect.poll(()=>page.evaluate(async()=>(await window.freya.settings()).migrationPending)).toBe(false)
 await page.evaluate(values=>{for(const[key,value]of Object.entries(values))localStorage.setItem(key,value);localStorage.setItem('ajeno','NO_MIGRAR')},previous)
 await app.evaluate(async({app})=>{const fs=process.getBuiltinModule('node:fs').promises,path=process.getBuiltinModule('node:path');await fs.rm(path.join(app.getPath('userData'),'settings.json'),{force:true})})
 await page.reload();await page.waitForFunction(()=>!!window.freya)
 await expect.poll(()=>page.evaluate(async()=>(await window.freya.settings()).migrationPending)).toBe(false)
 expect(await page.evaluate(()=>window.freya.settings())).toMatchObject({readonly:false,values:{tema:'dark',barraLateral:{visible:false,ancho:300.5,pestana:'outline'},division:62.5}})
 expect(await page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),keys)).toEqual(keys.map(()=>null))
 expect(await page.evaluate(()=>localStorage.getItem('ajeno'))).toBe('NO_MIGRAR')
 await expect(page.locator('html')).toHaveClass(/dark/);await expect(page.locator('aside.sidebar')).toHaveCount(0)
 const first=join(folder,'FUENTE_CANARIO.md'),source='# FUENTE_CANARIO\n\nDATOS_CANARIO_SIN_TRADUCIR\n';await writeFile(first,source)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),first)
 await page.evaluate(()=>window.freya.setSettings({tema:'light',barraLateral:{visible:true,ancho:280},division:40,markdown:{modoInicial:'preview'}}))
 await expect(page.getByLabel('Tema',{exact:true})).toHaveValue('light');await expect.poll(()=>page.locator('html').evaluate(element=>element.classList.contains('dark'))).toBe(false)
 await expect(page.locator('aside.sidebar')).toHaveCSS('width','280px');await expect(page.getByRole('button',{name:'Dividido',exact:true})).toHaveClass(/active/)
 const second=join(folder,'SEGUNDA_FUENTE_CANARIO.md');await writeFile(second,'# Otra fuente\n');await page.evaluate(path=>window.freya.openPaths([path]),second)
 await expect(page.getByRole('button',{name:'Vista previa',exact:true})).toHaveClass(/active/)
 await page.getByLabel('Tema',{exact:true}).selectOption('dark');await expect.poll(()=>page.evaluate(async()=>(await window.freya.settings()).values.tema)).toBe('dark')
 await page.getByLabel('Tema',{exact:true}).selectOption('light');await expect.poll(()=>page.evaluate(async()=>(await window.freya.settings()).values.tema)).toBe('light')
 await page.evaluate(()=>window.freya.setLanguage('en'))
 expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)).toEqual(doc)
 const settingsPath=join(folder,'profile','settings.json'),raw=await readFile(settingsPath,'utf8')
 expect(JSON.parse(raw)).toMatchObject({version:1,idioma:'en',tema:'light',barraLateral:{visible:true,ancho:280,pestana:'outline'},division:40,markdown:{modoInicial:'preview'}})
 expect(raw).not.toContain('CANARIO');expect(raw).not.toContain(folder);expect(raw).not.toContain('NO_MIGRAR')
 await page.evaluate(()=>localStorage.setItem('freya-theme','dark'));await page.reload();await page.waitForFunction(()=>!!window.freya)
 await expect(page.getByLabel('Tema',{exact:true})).toHaveValue('light');expect(await page.evaluate(()=>localStorage.getItem('freya-theme'))).toBe('dark');await expect(page.getByRole('button',{name:'Vista previa',exact:true})).toHaveClass(/active/)
 await restartApplication()
 await expect(page.locator('html')).toHaveAttribute('lang','en');expect(await page.evaluate(()=>window.freya.language())).toEqual({preference:'en',language:'en'})
 await expect(page.getByLabel('Tema',{exact:true})).toHaveValue('light');await expect(page.locator('aside.sidebar')).toHaveCSS('width','280px')
 expect(await readFile(settingsPath,'utf8')).toBe(raw);expect(await readFile(first,'utf8')).toBe(source)
})


test('AC-03/04: el paquete lee los cinco CSL y el DOCX interno con sus hashes oficiales',async()=>{
  const manifest=JSON.parse(await readFile('src/main/csl/manifest.json','utf8')) as {styles:{file:string;bytes:number;sha256:string}[]}
  const reference=JSON.parse(await readFile('src/main/docx-reference/manifest.json','utf8')) as {sha256:string}
  expect(manifest.styles.map(style=>style.file)).toEqual(['apa.csl','ieee.csl','nlm-citation-sequence.csl','chicago-author-date.csl','modern-language-association.csl'])
  const expected=[...manifest.styles.map(({file,bytes,sha256})=>({file,bytes,sha256})),{file:'docx-reference.docx',bytes:(await stat('src/main/docx-reference.docx')).size,sha256:reference.sha256}]
  const actual=await app.evaluate(({app},{expected,developmentMain})=>{
    const fs=process.getBuiltinModule('node:fs') as typeof import('node:fs'),path=process.getBuiltinModule('node:path') as typeof import('node:path'),crypto=process.getBuiltinModule('node:crypto') as typeof import('node:crypto')
    // En desarrollo getAppPath() ya puede ser out/main; no volver a añadirlo.
    const mainDirectory=app.isPackaged?path.join(app.getAppPath(),'out','main'):developmentMain,directory=path.join(mainDirectory,'chunks'),names=fs.readdirSync(directory)
    const resources=expected.map(resource=>{
      const extension=path.extname(resource.file),stem=resource.file.slice(0,-extension.length),matches=names.filter(name=>name===resource.file||(name.startsWith(stem+'-')&&name.endsWith(extension)))
      if(matches.length!==1)throw new Error(`Se esperaba un recurso compilado para ${resource.file}; se encontraron ${matches.length}.`)
      const file=path.join(directory,matches[0]),bytes=fs.readFileSync(file)
      return{file:resource.file,bytes:bytes.byteLength,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),compiled:path.relative(mainDirectory,file),unpacked:app.isPackaged&&fs.existsSync(path.join(app.getAppPath()+'.unpacked',path.relative(app.getAppPath(),file)))}
    })
    return{packaged:app.isPackaged,mainDirectory,resources}
  },{expected,developmentMain:resolve('out/main')})
  await test.info().attach('recursos-academicos-leidos-por-electron',{body:Buffer.from(JSON.stringify({expected,...actual},null,2)),contentType:'application/json'})
  expect(actual.packaged).toBe(!!process.env.FREYALAB_EXECUTABLE)
  expect(actual.resources).toMatchObject(expected)
  expect(actual.mainDirectory.replaceAll('\\','/')).not.toContain('/out/main/out/main')
  if(process.env.FREYALAB_EXECUTABLE){expect(actual.mainDirectory.replaceAll('\\','/')).toMatch(/\.asar\/out\/main$/);expect(actual.resources.some(resource=>resource.unpacked)).toBe(false)}
})

test('paleta CSV: búsqueda sin acentos, teclado, rango, foco y vista previa comparten edición y deshacer',async()=>{
 const source='ID,Texto\n00123,ábol\n9007199254740993,otro\n',{path}=await open(source),before=await page.evaluate(()=>window.freya.documents()),first=page.getByRole('gridcell',{name:'Fila 1, Texto',exact:true}),last=page.getByRole('gridcell',{name:'Fila 2, Texto',exact:true})
 await first.click();await page.keyboard.press('Shift+ArrowDown');await clickApplicationMenu('edit.commandPalette');const dialog=palette();await expect(dialog).toContainText('Rango: filas 1–2, columnas 2–2.');await expect(dialog.getByLabel('Buscar comando CSV',{exact:true})).toBeFocused();await dialog.getByLabel('Buscar comando CSV',{exact:true}).fill('mayusculas rango');await expect(dialog.locator('.command-list button')).toHaveCount(1);await expect(command(dialog,'Mayúsculas en el rango')).toBeEnabled();await dialog.getByLabel('Buscar comando CSV',{exact:true}).press('ArrowDown');await expect(command(dialog,'Mayúsculas en el rango')).toBeFocused();await page.keyboard.press('Enter');const preview=page.getByRole('dialog',{name:'Mayúsculas en el rango',exact:true});await expect(preview.getByRole('button',{name:'Aplicar cambio',exact:true})).toBeEnabled();expect(await page.evaluate(()=>window.freya.documents())).toEqual(before);await preview.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(last).toBeFocused()
 await clickApplicationMenu('edit.commandPalette');await dialog.getByLabel('Buscar comando CSV',{exact:true}).fill('mayusculas rango');await dialog.getByLabel('Buscar comando CSV',{exact:true}).press('Enter');await expect(preview.getByRole('button',{name:'Aplicar cambio',exact:true})).toBeEnabled();await preview.getByRole('button',{name:'Aplicar cambio',exact:true}).click();await expect(first).toHaveText('ÁBOL');await expect(last).toHaveText('OTRO');await first.focus();await page.keyboard.press('ControlOrMeta+z');await expect(first).toHaveText('ábol');await expect(last).toHaveText('otro');expect(await readFile(path,'utf8')).toBe(source)
})

test('paleta CSV: estructura usa filas y columnas marcadas, consulta y restauración sin mutar originales',async()=>{
 const source='ID,N\n00123,4\n9007199254740993,8\n',{path}=await open(source),cell=page.getByRole('gridcell',{name:'Fila 1, ID',exact:true});await cell.focus();await clickApplicationMenu('edit.commandPalette');let dialog=palette();await dialog.getByLabel('Buscar comando CSV',{exact:true}).fill('duplicar filas');await expect(command(dialog,'Duplicar filas seleccionadas')).toBeDisabled();await page.keyboard.press('Enter');await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(cell).toBeFocused()
 await page.getByRole('button',{name:'Seleccionar fila 1',exact:true}).click();dialog=await show('duplicar filas');await expect(command(dialog,'Duplicar filas seleccionadas')).toBeEnabled();await dialog.getByLabel('Buscar comando CSV',{exact:true}).press('Enter');await expect(page.locator('footer')).toContainText('3 de 3 filas');await expect(page.getByRole('gridcell',{name:'Fila 2, ID',exact:true})).toHaveText('00123')
 dialog=await show('deshacer');await dialog.getByLabel('Buscar comando CSV',{exact:true}).press('Enter');await expect(page.locator('footer')).toContainText('2 de 2 filas');expect((await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(false)
 await page.getByLabel('Seleccionar columna ID',{exact:true}).check();dialog=await show('duplicar columna');await expect(command(dialog,'Duplicar columna seleccionada')).toBeEnabled();await page.keyboard.press('Escape');await page.getByLabel('Seleccionar columna N',{exact:true}).check();dialog=await show('duplicar columna');await expect(command(dialog,'Duplicar columna seleccionada')).toBeDisabled();await page.keyboard.press('Escape')
 dialog=await show('consulta avanzada');await dialog.getByLabel('Buscar comando CSV',{exact:true}).press('Enter');await expect(page.getByRole('heading',{name:'Consulta avanzada',exact:true})).toBeFocused();await page.getByRole('button',{name:'Cerrar consulta avanzada',exact:true}).click();dialog=await show('comando inexistente zzqq');await expect(dialog).toContainText('No hay comandos que coincidan');await page.keyboard.press('Enter');await expect(dialog).toBeVisible();await page.keyboard.press('Escape');expect(await readFile(path,'utf8')).toBe(source)
})

test('paleta CSV: muestra bloquea edición y copia, conserva análisis y navegación en ambos temas',{tag:'@perf'},async()=>{
 const path=join(folder,'sample.csv');await writeFile(path,'ID,N\n'+'00123,4\n'.repeat(250));await truncate(path,50*1024*1024+1);const before=await stat(path),[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);expect(doc.readonly).toBe(true)
 for(const [theme,width,height] of [['light',1440,900],['dark',1280,800]] as const){await page.getByLabel('Tema',{exact:true}).selectOption(theme);await expect.poll(()=>page.locator('html').evaluate(node=>node.classList.contains('dark'))).toBe(theme==='dark');await page.setViewportSize({width,height});const dialog=await show();await expect(dialog).toContainText('Muestra de solo lectura');await expect(command(dialog,'Añadir fila')).toBeDisabled();await expect(command(dialog,'Transformar documento')).toBeDisabled();await expect(command(dialog,'Copiar como Markdown')).toBeDisabled();expect(await dialog.locator('.command-list').evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);await page.screenshot({path:test.info().outputPath(`csv-commands-${theme}-${width}x${height}.png`)});await dialog.getByLabel('Buscar comando CSV',{exact:true}).fill('análisis SQL');await expect(command(dialog,'Análisis SQL y asistentes')).toBeEnabled();await page.keyboard.press('ArrowDown');await expect(command(dialog,'Análisis SQL y asistentes')).toBeFocused();await page.keyboard.press('Home');await page.keyboard.press('End');await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Buscar acción',exact:true})).toBeFocused()}
 const dialog=await show('análisis SQL');await dialog.getByLabel('Buscar comando CSV',{exact:true}).press('Enter');await expect(page.getByRole('region',{name:'Análisis SQL y asistentes',exact:true})).toBeVisible();expect((await page.evaluate(()=>window.freya.documents()))[0]).toEqual(doc);expect((await stat(path)).size).toBe(before.size);expect((await stat(path)).mtimeMs).toBe(before.mtimeMs)
})

test('paleta CSV: paginar deshabilita el rango sin perder foco y mantiene disponible Transformar',async()=>{
 const source='ID,N\n'+Array.from({length:300},(_,i)=>`${String(i).padStart(5,'0')},9007199254740993`).join('\n')+'\n',{path}=await open(source),grid=page.getByRole('grid',{name:'Tabla de datos',exact:true});await expect(page.locator('footer')).toContainText('300 de 300 filas');await page.getByRole('gridcell',{name:'Fila 1, ID',exact:true}).click();await clickApplicationMenu('edit.commandPalette');const dialog=palette();await command(dialog,'Copiar rango').focus()
 const state=await grid.evaluate(element=>new Promise<{copyDisabled:boolean;transformDisabled:boolean}>((resolve,reject)=>{
  const toolbar=document.querySelector('footer')!,dialog=document.querySelector('dialog')!,buttons=Array.from(dialog.querySelectorAll<HTMLButtonElement>('.command-list button')),copy=buttons.find(button=>button.querySelector('strong')?.textContent==='Copiar rango')!,transform=buttons.find(button=>button.querySelector('strong')?.textContent==='Transformar documento…')!
  const timer=setTimeout(()=>{observer.disconnect();reject(new Error('No se observó la paginación.'))},10000),observer=new MutationObserver(()=>{if(!toolbar.textContent?.includes('Procesando…'))return;clearTimeout(timer);observer.disconnect();resolve({copyDisabled:copy.disabled,transformDisabled:transform.disabled})});observer.observe(toolbar,{childList:true,subtree:true,characterData:true});element.scrollTop=element.scrollHeight
 }))
 expect(state).toEqual({copyDisabled:true,transformDisabled:false});await expect(dialog.getByLabel('Buscar comando CSV',{exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Buscar acción',exact:true})).toBeFocused();expect((await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(false);expect(await readFile(path,'utf8')).toBe(source)
})
