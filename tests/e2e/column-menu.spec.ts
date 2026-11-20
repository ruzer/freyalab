import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import { closeElectron } from './close-electron'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {analysisRegion,showTable} from './panel'
import {readTableRows} from './csv-rows'
import {t} from '../../src/shared/i18n'

// R1-3 · Limpieza contextual: cada cabecera de columna tiene un menú ▾ con ordenar, filtrar, estadísticas y limpieza con vista previa.
let app:ElectronApplication,page:Page,folder:string
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-column-menu-'));await mkdir(join(folder,'saved'));await mkdir(join(folder,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:test.info().title.match(/\((es|en|en-XA)\)$/)?.[1]??'es',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
})
test.afterEach(async()=>{await closeElectron(app);await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

// Cinco filas: tres cambiarían a mayúsculas (la 1.ª, la 3.ª y la 4.ª), «GUADALAJARA» y «PUEBLA» ya lo están; Folio conserva ceros a la izquierda.
const source='Folio,Ciudad,Importe\n00123, oaxaca de juárez ,10\n00124,GUADALAJARA,20\n00125,mérida  ,30\n00126,Cd. de México,40\n00127,PUEBLA,50\n'
async function open(text=source){const path=join(folder,'ventas.csv');await writeFile(path,text);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);await expect(page.getByRole('gridcell',{name:'Fila 1, Folio',exact:true})).toBeVisible();return{doc,path}}
const cell=(row:number,column:string)=>page.getByRole('gridcell',{name:`Fila ${row}, ${column}`,exact:true})
const columnButton=(name:string)=>page.getByRole('button',{name:`Acciones de la columna ${name}`,exact:true})
const menu=()=>page.getByRole('menu',{name:'Acciones de columnas',exact:true})
async function cleanAction(name:string){await menu().getByRole('menuitem',{name:'Limpiar',exact:true}).click();await page.getByRole('menu').last().getByRole('menuitem',{name,exact:true}).click()}
const state=(id:string)=>page.evaluate(id=>window.freya.documents().then(list=>list.find(item=>item.id===id)),id)
const cities=()=>page.evaluate(async()=>{const [doc]=await window.freya.documents();return(await window.freya.tablePage(doc.id,{offset:0,limit:500,requestId:991})).rows.map(row=>row.cells[1])})

test('cada cabecera tiene un menú ▾ visible con ordenar, filtrar, estadísticas y limpieza', async()=>{
 await open()
 await expect(columnButton('Ciudad')).toBeVisible() // sin pasar el ratón por encima
 await columnButton('Ciudad').click();await expect(menu()).toBeVisible()
 for(const name of ['Ordenar de menor a mayor','Ordenar de mayor a menor','Filtrar esta columna','Estadísticas de la columna','Duplicar columna','Eliminar columna'])
  await expect(menu().getByRole('menuitem',{name,exact:true}),name).toBeVisible()
 await expect(menu().locator('.dropdown-label')).toHaveText('Ciudad')
 await menu().getByRole('menuitem',{name:'Limpiar',exact:true}).click()
 for(const name of ['Mayúsculas…','Minúsculas…','Quitar espacios…','Quitar filas duplicadas…'])await expect(page.getByRole('menu').last().getByRole('menuitem',{name,exact:true}),name).toBeVisible()
})

test('el menú se maneja con teclado: Enter lo abre, las flechas recorren y Escape devuelve el foco al botón', async()=>{
 await open()
 await columnButton('Ciudad').focus();await page.keyboard.press('Enter');await expect(menu()).toBeVisible()
 const items=menu().getByRole('menuitem');await expect(items.nth(0)).toBeFocused() // al abrirse enfoca la primera acción
 await page.keyboard.press('ArrowDown');await expect(items.nth(1)).toBeFocused()
 await page.keyboard.press('Escape');await expect(menu()).toHaveCount(0);await expect(columnButton('Ciudad')).toBeFocused()
})

test('mayúsculas en la columna: alcance, vista previa antes → después, recuento, confirmación y un paso de deshacer', async()=>{
 const {doc,path}=await open()
 await columnButton('Ciudad').click();await cleanAction('Mayúsculas…')
 const dialog=page.getByRole('dialog',{name:'Mayúsculas en la columna «Ciudad»',exact:true});await expect(dialog).toBeVisible()
 await expect(dialog).toContainText('columna «Ciudad»');await expect(dialog).toContainText('5 filas')            // alcance
 await expect(dialog.getByRole('status')).toContainText('3 de 5 celdas cambiarán.')                             // vista previa automática: sin pulsar «Vista previa»
 const table=dialog.getByRole('table');await expect(table.locator('tbody tr')).toHaveCount(3)
 await expect(table.locator('tbody tr').first()).toContainText(' oaxaca de juárez ');await expect(table.locator('tbody tr').first()).toContainText(' OAXACA DE JUÁREZ ') // antes y después
 expect(await cities()).toEqual([' oaxaca de juárez ','GUADALAJARA','mérida  ','Cd. de México','PUEBLA']);expect((await state(doc.id))?.dirty).toBe(false) // nada cambia hasta confirmar
 await dialog.getByRole('button',{name:'Aplicar cambio',exact:true}).click();await expect(dialog).toHaveCount(0)
 await expect(cell(1,'Ciudad')).toHaveText(' OAXACA DE JUÁREZ ');await expect(cell(4,'Ciudad')).toHaveText('CD. DE MÉXICO');await expect(cell(1,'Folio')).toHaveText('00123')
 expect((await state(doc.id))?.dirty).toBe(true);expect(await readFile(path,'utf8')).toBe(source)               // el archivo solo cambia al guardar
 await page.getByRole('button',{name:'Deshacer',exact:true}).click()
 expect(await cities()).toEqual([' oaxaca de juárez ','GUADALAJARA','mérida  ','Cd. de México','PUEBLA']);expect((await state(doc.id))?.dirty).toBe(false) // un solo paso
})

test('quitar espacios y minúsculas: acceso desde Limpiar y solo tocan esa columna', async()=>{
 const {doc}=await open()
 await columnButton('Ciudad').click();await cleanAction('Quitar espacios…')
 let dialog=page.getByRole('dialog',{name:'Quitar espacios en la columna «Ciudad»',exact:true});await expect(dialog.getByRole('status')).toContainText('2 de 5 celdas cambiarán.')
 // Controla la ventana real de 150 ms; no mide latencia ni sustituye respuestas.
 await page.clock.install({time:0});await page.clock.pauseAt(1)
 try{
  await app.evaluate(({ipcMain},target)=>{
   type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
   const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
   let release!:()=>void;const response=new Promise<void>(resolve=>{release=resolve})
   const barrier={armed:false,selected:false,release,restore:()=>handlers.set('freya',original)}
   Reflect.set(globalThis,'columnReloadBarrier',barrier)
   handlers.set('freya',async(event,...args)=>{
    const hold=barrier.armed&&!barrier.selected&&args[0]==='page'&&args[1]===target&&(args[2] as {limit?:number})?.limit===200
    if(hold)barrier.selected=true
    const result=await original(event,...args)
    if(hold)await response
    return result
   })
  },doc.id)
 await dialog.getByRole('button',{name:'Aplicar cambio',exact:true}).click();await expect(dialog).toHaveCount(0)
 expect(await cities()).toEqual(['oaxaca de juárez','GUADALAJARA','mérida','Cd. de México','PUEBLA'])
 await expect(cell(1,'Ciudad')).toHaveText('oaxaca de juárez');await expect(cell(3,'Ciudad')).toHaveText('mérida')
 await columnButton('Ciudad').click();await menu().getByRole('menuitem',{name:'Limpiar',exact:true}).click()
 const lower=page.getByRole('menu').last().getByRole('menuitem',{name:'Minúsculas…',exact:true})
 await expect(lower).toHaveAttribute('aria-disabled','false')
 await app.evaluate(()=>{Reflect.get(globalThis,'columnReloadBarrier').armed=true})
 const box=await lower.boundingBox();expect(box).not.toBeNull()
 try{
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down()
  await page.clock.runFor(150);await page.mouse.up()
 }finally{await app.evaluate(()=>Reflect.get(globalThis,'columnReloadBarrier').release())}
 dialog=page.getByRole('dialog',{name:'Minúsculas en la columna «Ciudad»',exact:true});await expect(dialog.getByRole('status')).toContainText('3 de 5 celdas cambiarán.')
 await dialog.getByRole('button',{name:'Aplicar cambio',exact:true}).click()
 expect(await cities()).toEqual(['oaxaca de juárez','guadalajara','mérida','cd. de méxico','puebla'])
 expect(await page.evaluate(async()=>{const [doc]=await window.freya.documents();return(await window.freya.tablePage(doc.id,{offset:0,limit:5,requestId:992})).rows.map(row=>row.cells[0]+'|'+row.cells[2])})).toEqual(['00123|10','00124|20','00125|30','00126|40','00127|50'])
 expect((await state(doc.id))?.dirty).toBe(true)
 }finally{
  await app.evaluate(()=>{const barrier=Reflect.get(globalThis,'columnReloadBarrier');barrier?.release();barrier?.restore();Reflect.deleteProperty(globalThis,'columnReloadBarrier')})
  await page.clock.resume()
 }
})

test('una búsqueda cambiada durante la edición y otra posterior conservan la consulta vigente',async()=>{
 const {doc,path}=await open(),search=page.getByLabel('Buscar en tabla',{exact:true}),grid=page.getByRole('grid',{name:'Tabla de datos',exact:true})
 await expect(cell(1,'Ciudad')).toHaveText(' oaxaca de juárez ')
 await page.clock.install({time:0});await page.clock.pauseAt(1)
 try{
  await app.evaluate(({ipcMain},target)=>{
   type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
   const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
   let release!:()=>void;const response=new Promise<void>(resolve=>{release=resolve})
   const barrier={held:false,edit:null as unknown,edits:[] as unknown[],pages:[] as unknown[],release,restore:()=>handlers.set('freya',original)}
   Reflect.set(globalThis,'columnQueryEditBarrier',barrier)
   handlers.set('freya',async(event,...args)=>{
    const result=await original(event,...args)
    if(args[0]==='page'&&args[1]===target&&(args[2] as {limit?:number})?.limit===200){const page=result as {revision:number;matched:number};barrier.pages.push({query:args[2],revision:page.revision,matched:page.matched})}
    if(args[0]==='edit'&&args[1]===target){const edit={documentId:args[1],change:args[2],revision:(result as {revision:number}).revision};barrier.edits.push(edit);if(!barrier.held){barrier.edit=edit;barrier.held=true;await response}}
    return result
   })
  },doc.id)
  await cell(1,'Ciudad').dblclick();const editor=page.getByRole('textbox',{name:'Editar celda',exact:true})
  await editor.fill('Oaxaca editada');await editor.press('Enter')
  await expect.poll(()=>app.evaluate(()=>Reflect.get(globalThis,'columnQueryEditBarrier').held)).toBe(true)
  const held=await app.evaluate(()=>Reflect.get(globalThis,'columnQueryEditBarrier').edit)
  expect(held).toMatchObject({documentId:doc.id,change:{type:'cell',column:1,value:'Oaxaca editada'},revision:doc.revision+1})
  await expect(search).toBeEnabled();await search.fill('GUADALAJARA');await expect(search).toHaveValue('GUADALAJARA')
  await test.info().attach('held-real-edit-and-query',{body:JSON.stringify({edit:held,editorVisible:await editor.isVisible(),search:await search.inputValue(),searchEnabled:await search.isEnabled()}),contentType:'application/json'})
  await app.evaluate(()=>Reflect.get(globalThis,'columnQueryEditBarrier').release())
  // Sin avanzar el reloj: la lectura explícita debe usar la búsqueda escrita durante la edición.
  await expect(grid).toHaveAttribute('aria-rowcount','2');await expect(cell(1,'Ciudad')).toHaveText('GUADALAJARA')
  // Un cambio posterior conserva su propia recarga programada; no se cancela desde load().
  await search.fill('mérida');await page.clock.runFor(150)
  await expect(grid).toHaveAttribute('aria-rowcount','2');await expect(cell(1,'Ciudad')).toHaveText('mérida  ')
  expect(await app.evaluate(()=>Reflect.get(globalThis,'columnQueryEditBarrier').edits)).toEqual([held])
  expect(await cities()).toEqual(['Oaxaca editada','GUADALAJARA','mérida  ','Cd. de México','PUEBLA'])
  expect(await page.evaluate(async()=>{const [doc]=await window.freya.documents();return(await window.freya.tablePage(doc.id,{offset:0,limit:5,requestId:992})).rows.map(row=>row.cells[0]+'|'+row.cells[2])})).toEqual(['00123|10','00124|20','00125|30','00126|40','00127|50'])
  expect((await state(doc.id))?.dirty).toBe(true);expect(await readFile(path,'utf8')).toBe(source)
 }finally{
  try{try{
   const operations=await app.evaluate(()=>{const b=Reflect.get(globalThis,'columnQueryEditBarrier');return b?{held:b.held,edit:b.edit,edits:b.edits,pages:b.pages}:null})
   await test.info().attach('query-after-real-edit',{body:JSON.stringify({operations,search:await search.inputValue()}),contentType:'application/json'})
  }finally{await app.evaluate(()=>{const barrier=Reflect.get(globalThis,'columnQueryEditBarrier');barrier?.release();barrier?.restore();Reflect.deleteProperty(globalThis,'columnQueryEditBarrier')})}}
  finally{await page.clock.resume()}
 }
})

test('con una búsqueda activa solo cambian las filas visibles y el diálogo avisa de las ocultas', async()=>{
 await open()
 await page.getByLabel('Buscar en tabla',{exact:true}).fill('guadalajara');await expect(page.getByRole('grid',{name:'Tabla de datos'})).toHaveAttribute('aria-rowcount','2')
 await columnButton('Ciudad').click();await cleanAction('Minúsculas…')
 const dialog=page.getByRole('dialog',{name:'Minúsculas en la columna «Ciudad»',exact:true})
 await expect(dialog).toContainText('1 fila de la vista actual');await expect(dialog).toContainText('4 filas ocultas')
 await expect(dialog.getByRole('status')).toContainText('1 de 1 celdas cambiarán.')
 await dialog.getByRole('button',{name:'Aplicar cambio',exact:true}).click()
 expect(await cities()).toEqual([' oaxaca de juárez ','guadalajara','mérida  ','Cd. de México','PUEBLA']) // las ocultas no se tocan
})

test('si no hay nada que cambiar la vista previa lo dice y no deja confirmar', async()=>{
 await open('Folio,Ciudad\n1,ya\n2,en\n3,minúsculas\n')
 await columnButton('Ciudad').click();await cleanAction('Minúsculas…')
 const dialog=page.getByRole('dialog',{name:'Minúsculas en la columna «Ciudad»',exact:true})
 await expect(dialog.getByRole('status')).toContainText('0 de 3 celdas cambiarán.');await expect(dialog.getByRole('button',{name:'Aplicar cambio',exact:true})).toBeDisabled()
})

test('«Filtrar esta columna» muestra los filtros y lleva el foco al de esa columna', async()=>{
 await open()
 await columnButton('Ciudad').click();await menu().getByRole('menuitem',{name:'Filtrar esta columna',exact:true}).click()
 await expect(page.getByLabel('Filtrar Ciudad',{exact:true})).toBeFocused()
})

test('«Estadísticas de la columna» abre Análisis con esa columna marcada', async()=>{
 await page.setViewportSize({width:1920,height:1080})
 await open()
 await columnButton('Ciudad').click();await menu().getByRole('menuitem',{name:'Estadísticas de la columna',exact:true}).click()
 const panel=await analysisRegion(page,'Estadísticas por columna');await expect(panel).toBeVisible();await expect(panel.getByLabel('Columnas para estadísticas',{exact:true})).toHaveValue('selected')
 await showTable(page)
 await expect(page.getByLabel('Seleccionar columna Ciudad',{exact:true})).toBeChecked();await expect(page.getByLabel('Seleccionar columna Folio',{exact:true})).not.toBeChecked()
})

test('«Quitar filas duplicadas de la columna…» abre la transformación con la columna ya elegida y sin cambiar nada', async()=>{
 const {doc}=await open('Folio,Ciudad\n1,Oaxaca\n2,Oaxaca\n3,Mérida\n')
 await columnButton('Ciudad').click();await cleanAction('Quitar filas duplicadas…')
 const dialog=page.getByRole('dialog',{name:'Transformar documento CSV',exact:true});await expect(dialog).toBeVisible()
 await expect(dialog.getByLabel('Transformación CSV',{exact:true})).toHaveValue('deduplicate')
 await expect(dialog.getByLabel('Columnas para transformar',{exact:true})).toHaveValues(['1'])
 await dialog.getByRole('button',{name:'Vista previa',exact:true}).click();await expect(dialog).toContainText('Vista previa lista. El documento sigue intacto.');await expect(dialog.locator('dl')).toContainText('Filas afectadas')
 expect((await state(doc.id))?.dirty).toBe(false)
})

test.describe('SIM-1a',()=>{
 const entries=['right','button','shift','context'] as const
 const mainItems=['Ordenar de menor a mayor','Ordenar de mayor a menor','Filtrar esta columna','Ver filas vacías','Limpiar','Estadísticas de la columna','Insertar a la izquierda','Insertar a la derecha','Duplicar columna','Calcular columna a la derecha','Eliminar columna']
 const cleanItems=['Rellenar vacíos…','Eliminar filas con vacío…','Quitar filas duplicadas…','Quitar espacios…','Mayúsculas…','Minúsculas…']
 const cleaning=(root:Locator)=>root.getByRole('menuitem',{name:/^Limpiar(?:\s*[▸›])?$/})
 const child=()=>page.getByRole('menu').last()
 const names=async(root:Locator)=>(await root.getByRole('menuitem').allTextContents()).map(value=>value.replace(/\s*[▸›]\s*$/u,'').trim())
 async function enter(entry:typeof entries[number]){
  const mark=page.getByLabel('Seleccionar columna Ciudad',{exact:true})
  if(entry==='button')await columnButton('Ciudad').click()
  else if(entry==='right')await mark.click({button:'right'})
  else{await mark.focus();await page.keyboard.press(entry==='shift'?'Shift+F10':'ContextMenu')}
  await expect(menu()).toBeVisible();return menu()
 }
 test.beforeEach(async()=>{await page.setViewportSize({width:1280,height:720})})

 test('los cuatro accesos muestran la misma lista y el nombre sin filas, sin alterar el documento',async()=>{
  const {doc,path}=await open(),before=await state(doc.id),beforeRows=await readTableRows(page,500)
  await page.getByLabel('Seleccionar columna Ciudad',{exact:true}).check()
  const observed:{entry:typeof entries[number];items:string[];lines:string[]}[]=[]
  for(const entry of entries){
   const root=await enter(entry)
   observed.push({entry,items:await names(root),lines:(await root.innerText()).split('\n').map(value=>value.trim()).filter(Boolean)})
   await page.keyboard.press('Escape');await expect(menu()).toHaveCount(0)
   await expect(page.getByLabel('Seleccionar columna Ciudad',{exact:true})).toBeChecked()
  }
  for(const result of observed){
   expect.soft(result.items,result.entry).toEqual(mainItems)
   expect.soft(result.lines,result.entry).toContain('Ciudad')
   for(const obsolete of ['Vista de la tabla','Limpiar la columna · con vista previa','Estructura','Más'])expect.soft(result.lines,result.entry).not.toContain(obsolete)
   expect.soft(result.lines.some(line=>/\b\d+\s+filas?\b/u.test(line)),result.entry).toBe(false)
  }
  expect(await readTableRows(page,500)).toEqual(beforeRows);expect(await state(doc.id)).toEqual(before);expect(await readFile(path,'utf8')).toBe(source)
 })

 test('las veinte acciones siguen alcanzables por su jerarquía y por las cuatro salidas existentes',async()=>{
  const {doc,path}=await open(),before=await state(doc.id),beforeRows=await readTableRows(page,500)
  const routes=[...mainItems.filter(name=>name!=='Limpiar').map(name=>({place:'column' as const,name})),...cleanItems.map(name=>({place:'clean' as const,name})),{place:'document' as const,name:'Transformar documento…'},{place:'structure' as const,name:'Copiar como Markdown'},{place:'app' as const,name:'Deshacer'},{place:'app' as const,name:'Rehacer'}]
  expect(routes).toHaveLength(20)
  const toolbar=page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true})
  for(const route of routes){
   let action:Locator
   if(route.place==='column'||route.place==='clean'){
    const root=await enter('button')
    if(route.place==='clean'){await cleaning(root).click();await expect(page.getByRole('menu')).toHaveCount(2);action=child().getByRole('menuitem',{name:route.name,exact:true})}
    else action=root.getByRole('menuitem',{name:route.name,exact:true})
   }else if(route.place==='app')action=page.getByRole('button',{name:route.name,exact:true})
   else{await toolbar.getByLabel(route.place==='document'?t('charts.toolbar.clean'):'Filas y columnas',{exact:true}).click();action=toolbar.getByRole('button',{name:route.name,exact:true})}
   await expect(action,route.name).toBeVisible();if(route.place!=='app')await expect(action,route.name).toBeEnabled()
   await page.getByLabel('Buscar en tabla',{exact:true}).click();await expect(page.getByRole('menu')).toHaveCount(0)
  }
  const root=await enter('button')
  for(const removed of ['Transformar documento…','Copiar como Markdown','Deshacer edición CSV','Rehacer edición CSV'])await expect(root.getByRole('menuitem',{name:removed,exact:true})).toHaveCount(0)
  await page.keyboard.press('Escape')
  expect(await readTableRows(page,500)).toEqual(beforeRows);expect(await state(doc.id)).toEqual(before);expect(await readFile(path,'utf8')).toBe(source)
 })

 test('el submenú respeta niveles de teclado, retorno de foco, Tab y cierre fuera',async()=>{
  const {doc,path}=await open(),before=await state(doc.id),beforeRows=await readTableRows(page,500),button=columnButton('Ciudad')
  await button.focus();await page.keyboard.press('Enter');await expect(menu()).toBeVisible();await expect(menu().getByRole('menuitem').first()).toBeFocused()
  await expect(button).toHaveAttribute('aria-haspopup','menu');await expect(button).toHaveAttribute('aria-expanded','true')
  const trigger=cleaning(menu());await trigger.focus();await expect(trigger).toHaveAttribute('aria-haspopup',/^(menu|true)$/)
  await page.keyboard.press('ArrowRight');await expect(page.getByRole('menu')).toHaveCount(2);expect(await names(child())).toEqual(cleanItems)
  await expect(trigger).toHaveAttribute('aria-expanded','true');await expect(child().getByRole('menuitem').first()).toBeFocused()
  await page.keyboard.press('ArrowDown');await expect(child().getByRole('menuitem').nth(1)).toBeFocused()
  await page.keyboard.press('End');await expect(child().getByRole('menuitem').last()).toBeFocused()
  await page.keyboard.press('Home');await expect(child().getByRole('menuitem').first()).toBeFocused()
  await page.keyboard.press('ArrowLeft');await expect(page.getByRole('menu')).toHaveCount(1);await expect(trigger).toBeFocused();await expect(trigger).toHaveAttribute('aria-expanded','false')
  await page.keyboard.press('Enter');await expect(page.getByRole('menu')).toHaveCount(2);await expect(child().getByRole('menuitem').first()).toBeFocused()
  await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(1);await expect(trigger).toBeFocused()
  await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);await expect(button).toBeFocused()
  await enter('button');await cleaning(menu()).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('menu')).toHaveCount(2)
  await page.keyboard.press('Tab');await expect(page.getByRole('menu')).toHaveCount(0)
  expect(await page.evaluate(()=>document.activeElement?.closest('[role="menu"]')===null)).toBe(true)
  await enter('button');await cleaning(menu()).click();await expect(page.getByRole('menu')).toHaveCount(2)
  await page.getByLabel('Buscar en tabla',{exact:true}).click();await expect(page.getByRole('menu')).toHaveCount(0);await expect(page.getByLabel('Buscar en tabla',{exact:true})).toBeFocused()
  expect(await readTableRows(page,500)).toEqual(beforeRows);expect(await state(doc.id)).toEqual(before);expect(await readFile(path,'utf8')).toBe(source)
 })

 test('raíz e hijo caben sin scroll a 1280×720 y el hijo cambia de lado según el espacio real',async()=>{
  const headers=['Folio',...Array.from({length:19},(_,index)=>'Campo '+(index+1))],records=[['00123',...headers.slice(1).map((_,index)=>String(index))],['9007199254740993',...headers.slice(1).map((_,index)=>'á '+index)]]
  const text=headers.join(',')+'\r\n'+records.map(row=>row.join(',')).join('\r\n')+'\r\n',{doc,path}=await open(text),before=await state(doc.id)
  const grid=page.getByRole('grid',{name:'Tabla de datos',exact:true})
  const headerAt=(x:number)=>page.getByRole('columnheader').evaluateAll((elements,x)=>{const box=elements.map(element=>element.getBoundingClientRect()).find(box=>box.width>0&&box.height>0&&box.left+2<x&&box.right-2>x);return box?{top:box.top,bottom:box.bottom}:null},x)
  for(const edge of ['left','right'] as const){
   const box=await grid.boundingBox();expect(box).not.toBeNull();const x=box!.x+(edge==='left'?80:box!.width-24)
   await expect.poll(()=>headerAt(x)).not.toBeNull();const header=await headerAt(x)
   await page.mouse.click(x,(header!.top+header!.bottom)/2,{button:'right'});await expect(menu()).toBeVisible()
   await cleaning(menu()).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('menu')).toHaveCount(2)
   const rootBox=await menu().boundingBox(),childBox=await child().boundingBox();expect(rootBox).not.toBeNull();expect(childBox).not.toBeNull()
   if(edge==='left')expect(childBox!.x).toBeGreaterThanOrEqual(rootBox!.x+rootBox!.width-1)
   else expect(childBox!.x+childBox!.width).toBeLessThanOrEqual(rootBox!.x+1)
   for(const pane of [menu(),child()]){
    const bounds=await pane.boundingBox();expect(bounds).not.toBeNull();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.y).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(1281);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(721)
    await expect.poll(()=>pane.evaluate(element=>element.scrollHeight<=element.clientHeight+1&&element.scrollWidth<=element.clientWidth+1)).toBe(true)
   }
   await page.getByLabel('Buscar en tabla',{exact:true}).click();await expect(page.getByRole('menu')).toHaveCount(0)
  }
  expect(await readTableRows(page,500)).toEqual(records);expect(await state(doc.id)).toEqual(before);expect(await readFile(path,'utf8')).toBe(text)
 })

 test('con marcas múltiples conserva los destinos y motivos distintos de cada entrada',async()=>{
  const {doc,path}=await open(),before=await state(doc.id),beforeRows=await readTableRows(page,500),folio=page.getByLabel('Seleccionar columna Folio',{exact:true}),city=page.getByLabel('Seleccionar columna Ciudad',{exact:true})
  await folio.check();await city.check()
  for(const entry of entries){
   const root=await enter(entry)
   await expect(folio).toBeChecked();await expect(city).toBeChecked()
   await expect(root.getByRole('menuitem',{name:'Ordenar de menor a mayor',exact:true})).toBeDisabled();await expect(root.getByRole('menuitem',{name:'Duplicar columna',exact:true})).toBeDisabled()
   for(const name of ['Filtrar esta columna','Estadísticas de la columna']){
    const action=root.getByRole('menuitem',{name,exact:true})
    if(entry==='button')await expect(action).toBeEnabled()
    else{await expect(action).toBeDisabled();await expect(action).toHaveAccessibleDescription(/.+/)}
   }
   await expect(root.getByRole('menuitem',{name:'Ver filas vacías',exact:true})).toBeEnabled()
   await cleaning(root).click();await expect(page.getByRole('menu')).toHaveCount(2)
   await expect(child().getByRole('menuitem',{name:'Rellenar vacíos…',exact:true})).toBeEnabled()
   const upper=child().getByRole('menuitem',{name:'Mayúsculas…',exact:true})
   if(entry==='button')await expect(upper).toBeEnabled()
   else{await expect(upper).toBeDisabled();await expect(upper).toHaveAccessibleDescription(/.+/)}
   await child().getByRole('menuitem',{name:'Rellenar vacíos…',exact:true}).click()
   const fill=page.getByRole('dialog',{name:'Rellenar vacíos de Ciudad',exact:true});await expect(fill).toBeVisible();await page.keyboard.press('Escape');await expect(fill).toHaveCount(0)
   if(entry==='button'){
    await enter('button');await cleaning(menu()).click();await child().getByRole('menuitem',{name:'Mayúsculas…',exact:true}).click()
    const preview=page.getByRole('dialog',{name:'Mayúsculas en la columna «Ciudad»',exact:true});await expect(preview).toBeVisible();await page.keyboard.press('Escape');await expect(preview).toHaveCount(0)
   }
   await expect(page.getByRole('menu')).toHaveCount(0);await expect(folio).toBeChecked();await expect(city).toBeChecked()
  }
  expect(await readTableRows(page,500)).toEqual(beforeRows);expect(await state(doc.id)).toEqual(before);expect(await readFile(path,'utf8')).toBe(source)
 })
 for(const language of ['es','en-XA'] as const)test(`capturas posteriores y teclado conservan datos en ambos temas y tamaños (${language})`,async()=>{
  const tr=(key:string,parameters:Record<string,string|number>={})=>t(key,parameters,language)
  const {doc,path}=await open(),before=await state(doc.id),beforeRows=await readTableRows(page,500),observations=[]
  const destination=resolve('../sim1a-evidence/after');await mkdir(destination,{recursive:true})
  await expect(page.locator('html')).toHaveAttribute('lang',language)
  const button=page.getByRole('button',{name:tr('csv.columnMenu.open',{column:'Ciudad'}),exact:true})
  for(const theme of ['light','dark'] as const)for(const [width,height] of [[1440,900],[1280,720]]){
   await page.setViewportSize({width,height});await page.getByLabel('Tema',{exact:true}).selectOption(theme)
   await expect.poll(()=>page.locator('html').evaluate(element=>element.classList.contains('dark'))).toBe(theme==='dark')
   await button.focus();await page.keyboard.press('Enter')
   const root=page.getByRole('menu',{name:tr('csv.columnMenu.label'),exact:true}),trigger=root.getByRole('menuitem',{name:tr('csv.columnMenu.clean'),exact:true})
   await expect(root.getByRole('menuitem')).toHaveCount(11);await expect(root.getByRole('menuitem').first()).toBeFocused();await expect(root.locator('.dropdown-label')).toHaveText('Ciudad')
   await trigger.focus();await page.keyboard.press('ArrowRight')
   const clean=page.getByRole('menu',{name:tr('csv.columnMenu.cleanLabel',{column:'Ciudad'}),exact:true})
   await expect(clean.getByRole('menuitem')).toHaveCount(6);await expect(clean.getByRole('menuitem').first()).toBeFocused()
   await expect(clean.getByRole('menuitem',{name:tr('csv.columnMenu.emptyFill'),exact:true})).toBeVisible()
   await page.keyboard.press('End');await expect(clean.getByRole('menuitem',{name:tr('csv.columnMenu.column-lower'),exact:true})).toBeFocused()
   await page.keyboard.press('ArrowUp');await expect(clean.getByRole('menuitem',{name:tr('csv.columnMenu.column-upper'),exact:true})).toBeFocused()
   for(const pane of [root,clean]){
    await expect.poll(()=>pane.evaluate(element=>element.scrollHeight<=element.clientHeight+1&&element.scrollWidth<=element.clientWidth+1)).toBe(true)
    const bounds=await pane.boundingBox();expect(bounds).not.toBeNull();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.y).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width+1);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(height+1)
   }
   const screenshot=join(destination,`sim1a-after-${language}-${theme}-${width}x${height}.png`)
   await page.screenshot({path:screenshot,animations:'disabled'})
   observations.push({language,theme,width,height,screenshot,root:await root.boundingBox(),child:await clean.boundingBox(),rootItems:await root.getByRole('menuitem').allTextContents(),childItems:await clean.getByRole('menuitem').allTextContents()})
   await page.keyboard.press('ArrowLeft');await expect(clean).toHaveCount(0);await expect(trigger).toBeFocused()
   await page.keyboard.press('Escape');await expect(root).toHaveCount(0);await expect(button).toBeFocused()
  }
  expect(await readTableRows(page,500)).toEqual(beforeRows);expect(await state(doc.id)).toEqual(before);expect(await readFile(path,'utf8')).toBe(source)
  await writeFile(join(destination,`observaciones-${language}.json`),JSON.stringify({language,fixture:source,observations},null,2)+'\n')
 })

 test('colores forzados mantienen hojas, foco y cierre por nivel (es)',async()=>{
  const {doc,path}=await open(),before=await state(doc.id)
  await page.emulateMedia({forcedColors:'active'});expect(await page.evaluate(()=>matchMedia('(forced-colors:active)').matches)).toBe(true)
  await enter('button');await expect(menu().getByRole('menuitem',{name:'Eliminar columna',exact:true})).toBeVisible()
  await cleaning(menu()).focus();await page.keyboard.press('ArrowRight');await expect(child().getByRole('menuitem').first()).toBeFocused()
  await page.keyboard.press('End');await expect(child().getByRole('menuitem').last()).toBeFocused()
  await page.screenshot({path:test.info().outputPath('sim1a-forced-colors-1280x720.png'),animations:'disabled'})
  await page.keyboard.press('Escape');await expect(cleaning(menu())).toBeFocused()
  await page.keyboard.press('Escape');await expect(columnButton('Ciudad')).toBeFocused()
  expect(await state(doc.id)).toEqual(before);expect(await readFile(path,'utf8')).toBe(source)
 })

})
