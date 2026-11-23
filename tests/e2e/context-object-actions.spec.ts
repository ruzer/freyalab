import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import type {DocumentInfo} from '../../src/shared/types'
import {t} from '../../src/shared/i18n'
import {closeElectron} from './close-electron'
import {traceElectronFailure} from './electron-trace'
import {readTableRows} from './csv-rows'
import {runApplicationMenu} from './application-menu'
import {openAnalysis} from './panel'

let app:ElectronApplication,page:Page,folder:string,files:string,csv:string,markdown:string,csvDoc:DocumentInfo
let stopTrace=async()=>{}
const source='Folio,Importe,Ciudad\r\n00123,12.50,Oaxaca\r\n9007199254740993,40,Mérida\r\n'
const text='Hola mundo\n'
const records=[['00123','12.50','Oaxaca'],['9007199254740993','40','Mérida']]
const tab=(id:string)=>page.locator('[id='+JSON.stringify('workspace-tab-'+id)+']')
const menu=(name:string)=>page.getByRole('menu',{name,exact:true})
const tree=()=>page.locator('.tree-scroll')
const toolbar=()=>page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true})
const documents=()=>page.evaluate(()=>window.freya.documents())
async function document(id:string){const value=(await documents()).find(item=>item.id===id);expect(value).toBeDefined();return value!}
async function tableState(){const doc=await document(csvDoc.id);return{id:doc.id,dirty:doc.dirty,revision:doc.revision,rowCount:doc.rowCount,headers:doc.headers,csvView:doc.csvView}}
async function unchanged(before:Awaited<ReturnType<typeof tableState>>){expect(await tableState()).toEqual(before);expect(await readTableRows(page,10)).toEqual(records);expect(await readFile(csv,'utf8')).toBe(source)}
async function closeSurfaces(){
 await page.getByLabel('Buscar en tabla',{exact:true}).click()
 for(const summary of await toolbar().locator('details[open]>summary').all())await summary.click()
 await expect(page.getByRole('menu')).toHaveCount(0)
}
async function openObjectMenu(kind:'range'|'row'){
 await closeSurfaces()
 const origin=kind==='range'?page.getByRole('gridcell',{name:'Fila 1, Importe',exact:true}):page.getByRole('button',{name:'Seleccionar fila 1',exact:true})
 await origin.click({button:'right'})
 const opened=menu(kind==='range'?'Acciones del rango':'Acciones de filas');await expect(opened).toBeVisible();return opened
}
async function onlyClose(opened:Locator){
 await expect(opened.getByRole('menuitem')).toHaveCount(1)
 await expect(opened.getByRole('menuitem',{name:'Cerrar',exact:true})).toBeVisible()
 await expect(opened.getByRole('menuitem',{name:'Mostrar en la carpeta',exact:true})).toHaveCount(0)
}

test.beforeEach(async({},info)=>{
 stopTrace=async()=>{}
 folder=await mkdtemp(join(tmpdir(),'freya-context-objects-'));files=join(folder,'datos');await mkdir(files);await mkdir(join(files,'Carpeta'))
 csv=join(files,'encuesta.csv');markdown=join(files,'apuntes.md');await writeFile(csv,source);await writeFile(markdown,text)
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_TEST_FOLDER:files,FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();stopTrace=await traceElectronFailure(page.context(),info);await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1280,height:720})
 await page.locator('.toolbar-left').getByRole('button',{name:'Abrir carpeta',exact:true}).click()
 await expect(tree().getByRole('button',{name:'encuesta.csv',exact:true})).toBeVisible()
 const [opened]=await page.evaluate(path=>window.freya.openPaths([path]),csv);expect(opened).toBeDefined();csvDoc=opened!
 await expect(page.getByRole('gridcell',{name:'Fila 1, Folio',exact:true})).toBeVisible()
 expect(await readTableRows(page,10)).toEqual(records);expect((await document(csvDoc.id)).dirty).toBe(false)
})
test.afterEach(async()=>{
 try{await stopTrace();expect(await readFile(csv,'utf8')).toBe(source);expect(await readFile(markdown,'utf8')).toBe(text)}
 finally{try{if(app)await closeElectron(app)}finally{await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}
})

test('SIM-1h los 22 destinos de rango y fila siguen presentes sin modificar los datos',async()=>{
 const before=await tableState()
 type Route={context:'range'|'row';place:'root'|'clean'|'document'|'structure'|'edit';name:string;nativeId?:string}
 const routes:Route[]=[
  ...['Copiar','Cortar…','Pegar…','Rellenar…','Vaciar…'].map(name=>({context:'range' as const,place:'root' as const,name})),
  ...['Quitar espacios…','Mayúsculas…','Minúsculas…','Reemplazar…'].map(name=>({context:'range' as const,place:'clean' as const,name})),
  {context:'range',place:'document',name:'Transformar documento…'},
  {context:'range',place:'root',name:'Estadísticas de la selección'},
  ...['Insertar arriba','Insertar abajo','Duplicar fila','Eliminar fila'].map(name=>({context:'row' as const,place:'root' as const,name})),
  ...['Quitar espacios','Mayúsculas','Minúsculas'].map(name=>({context:'row' as const,place:'clean' as const,name})),
  {context:'row',place:'document',name:'Transformar documento…'},
  {context:'row',place:'structure',name:'Copiar como Markdown'},
  {context:'row',place:'edit',name:'Deshacer',nativeId:'edit.undo'},
  {context:'row',place:'edit',name:'Rehacer',nativeId:'edit.redo'},
 ]
 expect(routes).toHaveLength(22)
 for(const route of routes){
  const opened=await openObjectMenu(route.context)
  let action:Locator
  if(route.place==='root'||route.place==='clean'){
   if(route.place==='clean'){await opened.getByRole('menuitem',{name:'Limpiar',exact:true}).click();await expect(page.getByRole('menu')).toHaveCount(2);action=page.getByRole('menu').last().getByRole('menuitem',{name:route.name,exact:true})}
   else action=opened.getByRole('menuitem',{name:route.name,exact:true})
  }else{
   await closeSurfaces()
   if(route.place==='edit'){
    action=page.locator('.toolbar-right').getByRole('button',{name:route.name,exact:true})
    // Sin historial solo se exige presencia en barra y en el menú nativo Edición.
    const native=await app.evaluate(({Menu},id)=>{const parent=Menu.getApplicationMenu()?.items.find(item=>item.submenu?.getMenuItemById(id)),item=parent?.submenu?.getMenuItemById(id);return{parent:parent?.label.replace(/&/g,''),visible:item?.visible??false}},route.nativeId!)
    expect(native).toEqual({parent:'Edición',visible:true})
   }else{
    await toolbar().getByLabel(t(route.place==='document'?'charts.toolbar.clean':'charts.toolbar.structure'),{exact:true}).click()
    action=toolbar().getByRole('button',{name:route.name,exact:true})
   }
  }
  await expect(action,`${route.context}: ${route.name}`).toBeVisible()
  if(route.place!=='edit')await expect(action,`${route.context}: ${route.name}`).toBeEnabled()
  await closeSurfaces();await unchanged(before)
 }
 // El destino retirado de los dos menús abre el asistente existente y se descarta sin aplicar.
 await toolbar().getByLabel(t('charts.toolbar.clean'),{exact:true}).click()
 await toolbar().getByRole('button',{name:'Transformar documento…',exact:true}).click()
 const transform=page.getByRole('dialog',{name:'Transformar documento CSV',exact:true});await expect(transform).toBeVisible()
 await transform.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(transform).toHaveCount(0)
 await unchanged(before)
})

test('SIM-1h Cerrar apunta a la pestaña sucia de fondo y las pestañas sin ruta o de análisis solo cierran',async()=>{
 const before=await tableState(),[md]=await page.evaluate(path=>window.freya.openPaths([path]),markdown)
 const editor=page.locator('.editor-pane .cm-content');await expect(editor).toHaveText('Hola mundo');await editor.focus();await editor.press('ControlOrMeta+End');await page.keyboard.insertText('Borrador')
 await expect.poll(async()=>(await document(md.id)).text).toBe('Hola mundo\nBorrador');expect((await document(md.id)).dirty).toBe(true)
 await tab(csvDoc.id).click();await expect(tab(csvDoc.id)).toHaveAttribute('aria-selected','true')
 const draft=await document(md.id)
 await app.evaluate(({dialog})=>{
  const questions:{message:string;buttons:string[]|undefined;defaultId:number|undefined;cancelId:number|undefined}[]=[];Reflect.set(globalThis,'contextObjectQuestions',questions)
  Object.defineProperty(dialog,'showMessageBox',{configurable:true,value:async(...args:unknown[])=>{const options=args.at(-1) as Electron.MessageBoxOptions;questions.push({message:options.message,buttons:options.buttons,defaultId:options.defaultId,cancelId:options.cancelId});return{response:1,checkboxChecked:false}}})
 })
 const questions=()=>app.evaluate(()=>Reflect.get(globalThis,'contextObjectQuestions') as {message:string;buttons:string[];defaultId:number;cancelId:number}[])
 await tab(md.id).click({button:'right'});await expect(menu('apuntes.md')).toBeVisible();await menu('apuntes.md').getByRole('menuitem',{name:'Cerrar',exact:true}).click()
 await expect.poll(questions).toEqual([{message:'¿Guardar los cambios de apuntes.md?',buttons:['Guardar','Cancelar','Descartar cambios'],defaultId:0,cancelId:1}])
 await expect(tab(csvDoc.id)).toHaveAttribute('aria-selected','true');await expect(tab(md.id)).toBeVisible()
 expect(await document(md.id)).toMatchObject({id:md.id,text:draft.text,dirty:true});await unchanged(before)

 await runApplicationMenu(app,'file.newMarkdown')
 const untitled=page.getByRole('tab',{name:'Sin título.md',exact:true});await expect(untitled).toBeVisible()
 await untitled.click({button:'right'});await onlyClose(menu('Sin título.md'))
 await menu('Sin título.md').getByRole('menuitem',{name:'Cerrar',exact:true}).click();await expect(untitled).toHaveCount(0)
 expect(await questions()).toHaveLength(1)
 await tab(csvDoc.id).click();await openAnalysis(page)
 const analysis=page.getByRole('tab',{name:'Análisis de encuesta.csv',exact:true});await expect(analysis).toBeVisible()
 await analysis.click({button:'right'});await onlyClose(menu('Análisis · encuesta.csv'))
 await menu('Análisis · encuesta.csv').getByRole('menuitem',{name:'Cerrar',exact:true}).click();await expect(analysis).toHaveCount(0)
 await expect(tab(csvDoc.id)).toHaveAttribute('aria-selected','true')
 expect((await documents()).map(doc=>doc.id).sort()).toEqual([csvDoc.id,md.id].sort())
 expect(await document(md.id)).toMatchObject({text:draft.text,dirty:true});expect(await questions()).toHaveLength(1)
 await unchanged(before)
})

test('SIM-1h Mostrar usa el objeto elegido y Abrir de Archivos reutiliza los documentos y vistas',async()=>{
 await app.evaluate(({shell})=>{const shown:string[]=[];Reflect.set(globalThis,'contextObjectReveals',shown);shell.showItemInFolder=(path:string)=>{shown.push(path)}})
 const reveals=()=>app.evaluate(()=>Reflect.get(globalThis,'contextObjectReveals') as string[])
 const file=tree().getByRole('button',{name:'apuntes.md',exact:true})
 await file.click();await expect(page.locator('.editor-pane .cm-content')).toHaveText('Hola mundo')
 const md=(await documents()).find(doc=>doc.name==='apuntes.md')!;expect(md).toBeDefined();expect(md.id).not.toBe(csvDoc.id)
 await tab(csvDoc.id).click();await file.click({button:'right'});await expect(menu('apuntes.md')).toBeVisible()
 await menu('apuntes.md').getByRole('menuitem',{name:'Abrir',exact:true}).click();await expect(tab(md.id)).toHaveAttribute('aria-selected','true')
 expect((await documents()).filter(doc=>doc.name==='apuntes.md').map(doc=>doc.id)).toEqual([md.id]);expect((await document(md.id)).text).toBe(text)
 await tab(csvDoc.id).click();await tab(md.id).click({button:'right'})
 await menu('apuntes.md').getByRole('menuitem',{name:'Mostrar en la carpeta',exact:true}).click()
 await expect.poll(reveals).toEqual([md.path]);await expect(tab(csvDoc.id)).toHaveAttribute('aria-selected','true')
 await file.click({button:'right'});await menu('apuntes.md').getByRole('menuitem',{name:'Mostrar en la carpeta',exact:true}).click()
 await expect.poll(reveals).toEqual([md.path,await realpath(markdown)])
 const directory=tree().getByRole('button',{name:'Carpeta',exact:true});await directory.click({button:'right'})
 await menu('Carpeta').getByRole('menuitem',{name:'Mostrar en la carpeta',exact:true}).click()
 await expect.poll(reveals).toEqual([md.path,await realpath(markdown),await realpath(join(files,'Carpeta'))])

 const csvFile=tree().getByRole('button',{name:'encuesta.csv',exact:true})
 await csvFile.click({button:'right'});const csvMenu=menu('Abrir CSV')
 await expect(csvMenu.getByRole('menuitem',{name:'Abrir como tabla',exact:true})).toBeEnabled();await expect(csvMenu.getByRole('menuitem',{name:'Abrir como texto',exact:true})).toBeEnabled()
 await csvMenu.getByRole('menuitem',{name:'Abrir como texto',exact:true}).click();await expect(page.locator('.editor-pane .cm-content')).toBeVisible()
 await expect.poll(async()=>(await document(csvDoc.id)).csvView).toBe('text')
 await csvFile.click({button:'right'});await menu('Abrir CSV').getByRole('menuitem',{name:'Abrir como tabla',exact:true}).click()
 await expect(page.getByRole('gridcell',{name:'Fila 1, Folio',exact:true})).toBeVisible()
 expect(await readTableRows(page,10)).toEqual(records);expect(await document(csvDoc.id)).toMatchObject({id:csvDoc.id,csvView:'table',dirty:false})
 expect((await documents()).map(doc=>doc.id).sort()).toEqual([csvDoc.id,md.id].sort())
 expect(await reveals()).toEqual([md.path,await realpath(markdown),await realpath(join(files,'Carpeta'))])
 expect(await readFile(csv,'utf8')).toBe(source);expect(await readFile(markdown,'utf8')).toBe(text)
})
