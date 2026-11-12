import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {t,type Language} from '../../src/shared/i18n'
import {closeElectron} from './close-electron'
import {openAnalysis,showTable,openCsvCommands} from './panel'
import {readTableRows} from './csv-rows'

let app:ElectronApplication,page:Page,folder:string,path:string,source:Buffer
const digest=(value:Buffer)=>createHash('sha256').update(value).digest('hex')
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-empty-ui-'));path=join(folder,'datos.csv')
 source=await readFile(resolve('tests/fixtures/empty-values.csv'));await writeFile(path,source)
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:test.info().title.match(/\((es|en|en-XA)\)$/)?.[1]??'es',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_FOLDER:folder,FREYALAB_TEST_PROJECT_SOURCE_PATH:path,FREYALAB_TEST_SAVE_PATH:join(folder,'copia.csv'),...(test.info().title.includes('archivo grande')?{FREYALAB_LARGE_BYTES:'1'}:{})},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
 await page.setViewportSize({width:1440,height:900})
 await page.evaluate(path=>window.freya.openPaths([path]),path)
})
test.afterEach(async()=>{await closeElectron(app);await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function information(){
 await openAnalysis(page,'Información')
 const panel=page.getByRole('region',{name:'Vista general de columnas',exact:true})
 await panel.getByRole('button',{name:'Obtener información',exact:true}).click()
 await expect(panel.getByRole('status')).toHaveText(t('info.complete'))
 return panel
}
test('LIM-1 Información muestra porcentaje, desglose y filtra vacíos sin editar',async()=>{
 const panel=await information(),row=panel.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Cantidad',exact:true})})
 const details=row.locator('.quality-breakdown')
 await expect(details.locator('summary')).toHaveText('3 · 43 %')
 await details.locator('summary').click()
 await expect(details.locator('dd')).toHaveText(['1','1','1'])
 for(const name of ['Ver filas vacías','Rellenar vacíos…','Eliminar filas con vacío…'])await expect(details.getByRole('button',{name,exact:true})).toBeVisible()
 for(const theme of ['light','dark']){
  await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme)
  await expect.poll(()=>page.locator('html').evaluate(element=>element.classList.contains('dark'))).toBe(theme==='dark')
  await page.screenshot({animations:'disabled',path:test.info().outputPath(`lim1-info-${theme}-1440x900.png`)})
 }
 const product=panel.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Producto',exact:true})})
 await expect(product.locator('.quality-breakdown')).toHaveCount(0)
 await details.getByRole('button',{name:'Ver filas vacías',exact:true}).click()
 await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
 const grid=page.getByRole('grid',{name:'Tabla de datos',exact:true})
 await expect(grid.locator('.csv-row')).toHaveCount(3)
 await expect(grid.locator('.csv-row [data-column="0"]>span')).toHaveText(['a','a','d'])
 await expect(grid.locator('.csv-row [data-column="1"]>span')).toHaveText(['','50','60'])
 expect((await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(false)
 expect(digest(await readFile(path))).toBe(digest(source))
})

test('LIM-1 el puente prepara solo vacíos, conserva la revisión y rechaza campos ajenos',async()=>{
 const result=await page.evaluate(async()=>{
  const [doc]=await window.freya.documents()
  const edit={type:'structure' as const,operation:'fillEmpty' as const,columns:[2],revision:doc.revision,requestId:crypto.randomUUID(),includeSpaces:true,value:'0'}
  return await window.freya.transformPreview(doc.id,edit)
 })
 expect(result).toMatchObject({rows:7,affected:3,cells:3,empty:{exact:1,missing:1,spaces:1}})
 const rejected=await page.evaluate(async()=>{
  const [doc]=await window.freya.documents(),base={type:'structure',operation:'fillEmpty',columns:[2],revision:doc.revision,requestId:crypto.randomUUID(),includeSpaces:true,value:'0'}
  const invalid=[{...base,query:{offset:0,limit:1,requestId:1}},{...base,rowIds:['1']},{...base,columns:[]},{...base,columns:[-1]},{...base,includeSpaces:'true'},{...base,value:undefined}]
  const call=window.freya.transformPreview as (id:string,request:unknown)=>Promise<unknown>
  return await Promise.all(invalid.map(async request=>{try{await call(doc.id,request);return false}catch{return true}}))
 })
 expect(rejected).toEqual([true,true,true,true,true,true])
 expect((await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(false)
 expect(digest(await readFile(path))).toBe(digest(source))
})

async function headerAction(column:string,action:string){
 await showTable(page)
 await page.getByRole('button',{name:'Acciones de la columna '+column,exact:true}).click()
 await page.getByRole('menuitem',{name:action,exact:true}).click()
}
async function previewEmpty(dialog:ReturnType<Page['getByRole']>){
 await dialog.getByRole('button',{name:'Vista previa',exact:true}).click()
 await expect(dialog.getByRole('button',{name:/^(Rellenar|Eliminar filas)$/,exact:true})).toBeEnabled()
}
async function save(){await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(false)}
async function undo(){await page.getByRole('button',{name:'Deshacer',exact:true}).click()}

test('LIM-1 rellena Mixta, avisa las filas cortas y un solo deshacer conserva bytes tras guardar',async()=>{
 await headerAction('Mixta','Rellenar vacíos de la columna…')
 const dialog=page.getByRole('dialog',{name:'Rellenar vacíos de Mixta',exact:true})
 await dialog.getByRole('textbox',{name:'Valor',exact:true}).fill('0')
 await previewEmpty(dialog)
 await expect(dialog).toContainText('4 celdas')
 await expect(dialog).toContainText('Cantidad');await expect(dialog).toContainText('Alta')
 expect(digest(await readFile(path))).toBe(digest(source))
 await dialog.getByRole('button',{name:'Rellenar',exact:true}).click()
 await expect(dialog).not.toBeVisible()
 expect((await readTableRows(page,20))[6]).toEqual(['d','60','','','0'])
 expect(digest(await readFile(path))).toBe(digest(source))
 const expected='Producto,Precio,Cantidad,Alta,Mixta\na,10,1,2026-01-02,1\nb,20,2,2026-03-04,x\na,30,3,2026-02-01,1\nc,40,4,2026-01-15,0\na,,,2026-02-20,0\na,50,"  ",2026-01-30,0\nd,60,,,0\n'
 await save();expect((await readFile(path)).toString()).toBe(expected)
 await undo();expect((await readTableRows(page,20))[6]).toEqual(['d','60'])
 await save();expect(digest(await readFile(path))).toBe(digest(source))
})

test('LIM-1 Cantidad respeta espacios y el valor anterior usa el orden del archivo',async()=>{
 await headerAction('Cantidad','Rellenar vacíos de la columna…')
 let dialog=page.getByRole('dialog',{name:'Rellenar vacíos de Cantidad',exact:true})
 await dialog.getByRole('textbox',{name:'Valor',exact:true}).fill('00')
 await dialog.getByRole('checkbox',{name:'Contar las celdas con solo espacios como vacías',exact:true}).uncheck()
 await previewEmpty(dialog);await expect(dialog).toContainText('2 celdas')
 await dialog.getByRole('button',{name:'Rellenar',exact:true}).click()
 expect((await readTableRows(page,20)).slice(4).map(row=>row[2])).toEqual(['00','  ','00'])
 await undo()
 await page.getByRole('button',{name:'Cantidad',exact:true}).click()
 await headerAction('Cantidad','Rellenar vacíos de la columna…')
 dialog=page.getByRole('dialog',{name:'Rellenar vacíos de Cantidad',exact:true})
 await dialog.getByRole('combobox',{name:'Rellenar con',exact:true}).selectOption({label:'El valor anterior'})
 await previewEmpty(dialog);await dialog.getByRole('button',{name:'Rellenar',exact:true}).click()
 expect((await readTableRows(page,20)).slice(4).map(row=>row[2])).toEqual(['4','4','4'])
 await undo();expect(digest(await readFile(path))).toBe(digest(source))
})

test('LIM-1 elimina por cualquiera o todas las columnas marcadas y restaura filas completas',async()=>{
 const original=await readTableRows(page,20)
 for(const [mode,remaining] of [['si falta en cualquiera',4],['si faltan en todas',6]] as const){
  await page.getByRole('checkbox',{name:'Seleccionar columna Precio',exact:true}).check()
  await page.getByRole('checkbox',{name:'Seleccionar columna Cantidad',exact:true}).check()
  await headerAction('Cantidad','Eliminar filas con vacío en la columna…')
  const dialog=page.getByRole('dialog',{name:'Eliminar filas con vacío',exact:true})
  await dialog.getByRole('combobox',{name:'Dónde mirar',exact:true}).selectOption({label:'En las columnas marcadas'})
  await dialog.getByRole('combobox',{name:'Eliminar la fila',exact:true}).selectOption({label:mode})
  await previewEmpty(dialog);await dialog.getByRole('button',{name:'Eliminar filas',exact:true}).click()
  expect(await readTableRows(page,20)).toHaveLength(remaining)
  await undo();expect(await readTableRows(page,20)).toEqual(original)
 }
 expect(digest(await readFile(path))).toBe(digest(source))
})

test('LIM-1 fuente protegida permite ver vacíos y bloquea las mutaciones también por el puente',async()=>{
 await page.getByRole('button',{name:'Cerrar datos.csv',exact:true}).click()
 await page.getByRole('button',{name:t('project.create'),exact:true}).press('Enter')
 let dialog=page.getByRole('dialog',{name:t('project.new'),exact:true})
 await dialog.getByRole('button',{name:t('project.pickFolder'),exact:true}).press('Enter')
 await dialog.getByRole('button',{name:t('project.create'),exact:true}).press('Enter')
 const project=page.getByRole('tabpanel',{name:'Proyecto',exact:true})
 await project.getByRole('button',{name:'Añadir fuente…',exact:true}).press('Enter')
 dialog=page.getByRole('dialog',{name:'Añadir fuente…',exact:true})
 await dialog.getByRole('button',{name:'Añadir y calcular huella',exact:true}).press('Enter')
 await expect(project.getByText('Verificada · 🔒 Protegida')).toBeVisible()
 await project.getByRole('button',{name:'Abrir',exact:true}).press('Enter')
 const panel=await information(),row=panel.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Cantidad',exact:true})}),quality=row.locator('.quality-breakdown')
 await quality.locator('summary').click()
 await expect(quality.getByRole('button',{name:'Ver filas vacías',exact:true})).toBeEnabled()
 for(const name of ['Rellenar vacíos…','Eliminar filas con vacío…']){
  const button=quality.getByRole('button',{name,exact:true});await expect(button).toBeDisabled();await expect(button).toHaveAccessibleDescription(t('empty.protected'))
 }
 const attempts=await page.evaluate(async()=>{
  const [doc]=await window.freya.documents(),edit={type:'structure' as const,operation:'fillEmpty' as const,columns:[2],revision:doc.revision,requestId:crypto.randomUUID(),includeSpaces:true,value:'0'}
  return (await Promise.allSettled([window.freya.transformPreview(doc.id,edit),window.freya.tableEdit(doc.id,edit)])).map(item=>item.status)
 })
 expect(attempts).toEqual(['rejected','rejected'])
 await quality.getByRole('button',{name:'Ver filas vacías',exact:true}).press('Enter')
 await expect(page.getByRole('grid',{name:'Tabla de datos'}).locator('.csv-row')).toHaveCount(3)
 expect(digest(await readFile(path))).toBe(digest(source))
})

test('LIM-1 archivo grande permite el filtro completo y explica que limpiar requiere extraer',async()=>{
 expect((await page.evaluate(()=>window.freya.documents()))[0].large).toBe(true)
 await page.getByRole('button',{name:'Acciones de la columna Cantidad',exact:true}).click()
 for(const name of ['Rellenar vacíos de la columna…','Eliminar filas con vacío en la columna…']){
  const button=page.getByRole('menuitem',{name,exact:true});await expect(button).toBeDisabled();await expect(button).toHaveAccessibleDescription(t('empty.large'))
 }
 await page.getByRole('menuitem',{name:'Ver filas vacías de la columna',exact:true}).click()
 await expect(page.getByRole('region',{name:'Búsqueda en archivo grande'})).toContainText('3 de 7 filas')
 expect((await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(false)
 expect(digest(await readFile(path))).toBe(digest(source))
})

test('LIM-1 archivo grande no anuncia un filtro aplicado cuando falla su inicio',async()=>{
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  handlers.set('freya',async(event,...args)=>{
   if(args[0]==='viewStart')throw new Error('Filtro rechazado en la prueba')
   return await original(event,...args)
  })
 })
 await page.getByRole('button',{name:'Acciones de la columna Cantidad',exact:true}).click()
 await page.getByRole('menuitem',{name:'Ver filas vacías de la columna',exact:true}).click()
 await expect(page.getByRole('alert').filter({hasText:'Filtro rechazado en la prueba'}).first()).toBeVisible()
 await expect(page.getByRole('status').filter({hasText:t('empty.viewApplied',{column:'Cantidad'})})).toHaveCount(0)
 expect((await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(false)
 expect(digest(await readFile(path))).toBe(digest(source))
})

test('LIM-1 Texto sin confirmar conserva el diálogo y Cancelar no pierde el borrador',async()=>{
 await page.locator('[data-csv-view]').getByRole('button',{name:'Texto',exact:true}).click()
 const editor=page.getByRole('textbox',{name:t('csvText.editorLabel'),exact:true})
 await editor.press(process.platform==='darwin'?'Meta+End':'Control+End');await editor.press('End');await editor.press('Enter');await editor.pressSequentially('nuevo,70')
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(true)
 await page.locator('.csv-text-tools').getByRole('button',{name:'Analizar',exact:true}).click()
 const dialog=page.getByRole('dialog').filter({has:page.getByRole('button',{name:'Guardar y cambiar',exact:true})})
 for(const name of ['Guardar y cambiar','Descartar cambios y cambiar','Cancelar'])await expect(dialog.getByRole('button',{name,exact:true})).toBeVisible()
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click()
 await expect(editor).toContainText('nuevo,70')
 await expect(page.locator('.analysis-workspace:not([hidden])')).toHaveCount(0)
 expect(digest(await readFile(path))).toBe(digest(source))
})

test('LIM-1 cancelar descarta una vista previa tardía y deja reintentar sin modificar el CSV',async()=>{
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  handlers.set('freya',async(event,...args)=>{
   const result=await original(event,...args)
   if(args[0]==='transformPreview'&&(args[2] as {operation?:string})?.operation==='fillEmpty'&&!Reflect.get(globalThis,'emptyHeld')){
    Reflect.set(globalThis,'emptyHeld',true)
    await new Promise<void>(release=>Reflect.set(globalThis,'emptyRelease',release))
    Reflect.set(globalThis,'emptyReleased',true)
   }
   return result
  })
 })
 await headerAction('Cantidad','Rellenar vacíos de la columna…')
 const dialog=page.getByRole('dialog',{name:'Rellenar vacíos de Cantidad',exact:true})
 await dialog.getByRole('textbox',{name:'Valor',exact:true}).fill('0')
 await dialog.getByRole('button',{name:'Vista previa',exact:true}).click()
 await expect.poll(()=>app.evaluate(()=>!!Reflect.get(globalThis,'emptyHeld'))).toBe(true)
 await expect(dialog.getByRole('progressbar')).toBeVisible()
 await dialog.getByRole('button',{name:'Cancelar preparación',exact:true}).click()
 await expect(dialog.getByRole('status')).toHaveText(t('empty.progress.cancelled'))
 await app.evaluate(()=>Reflect.get(globalThis,'emptyRelease')())
 await expect.poll(()=>app.evaluate(()=>!!Reflect.get(globalThis,'emptyReleased'))).toBe(true)
 // La respuesta posterior del mismo puente sirve de barrera para recibir la vista previa antigua.
 expect((await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(false)
 await expect(dialog.getByRole('button',{name:'Rellenar',exact:true})).toBeDisabled()
 await expect(dialog.locator('table')).toHaveCount(0)
 await previewEmpty(dialog);await expect(dialog).toContainText('3 celdas')
 await page.keyboard.press('Escape');expect(digest(await readFile(path))).toBe(digest(source))
})

test('LIM-1 la paleta encuentra isnull, fillna y dropna y conserva la selección múltiple',async()=>{
 await page.getByRole('checkbox',{name:'Seleccionar columna Cantidad',exact:true}).check()
 for(const [alias,label] of [['isnull','Ver filas vacías de la columna'],['fillna','Rellenar vacíos de la columna…'],['dropna','Eliminar filas con vacío en la columna…']]){
  const commands=await openCsvCommands(page,app),input=commands.getByRole('searchbox',{name:'Buscar comando CSV',exact:true})
  await input.fill(alias);await expect(commands.locator('.command-list button')).toHaveCount(1);await expect(commands.locator('.command-list button')).toContainText(label)
  await input.press('Escape')
 }
 await page.getByRole('checkbox',{name:'Seleccionar columna Precio',exact:true}).check()
 const commands=await openCsvCommands(page,app),input=commands.getByRole('searchbox',{name:'Buscar comando CSV',exact:true})
 await input.fill('dropna');await input.press('Enter')
 const dialog=page.getByRole('dialog',{name:'Eliminar filas con vacío',exact:true})
 await expect(dialog.getByRole('combobox',{name:'Dónde mirar',exact:true})).toHaveValue('marked')
 await expect(dialog).toContainText('Precio');await expect(dialog).toContainText('Cantidad')
 await page.keyboard.press('Escape');expect(digest(await readFile(path))).toBe(digest(source))
})

test('LIM-1 limpiar vacíos funciona en un CSV editable con más de 200 columnas',async()=>{
 await page.getByRole('button',{name:'Cerrar datos.csv',exact:true}).click()
 const wide=join(folder,'ancho.csv'),input=Array.from({length:201},(_,i)=>'C'+i).join(',')+'\n,'+Array(200).fill('1').join(',')+'\n'
 await writeFile(wide,input);await page.evaluate(path=>window.freya.openPaths([path]),wide)
 await headerAction('C0','Rellenar vacíos de la columna…')
 const dialog=page.getByRole('dialog',{name:'Rellenar vacíos de C0',exact:true})
 await expect(dialog).toBeVisible()
 await dialog.getByRole('textbox',{name:'Valor',exact:true}).fill('00')
 await previewEmpty(dialog);await dialog.getByRole('button',{name:'Rellenar',exact:true}).click()
 const rows=await readTableRows(page,20);expect(rows[0]).toHaveLength(201);expect(rows[0][0]).toBe('00');expect(rows[0].slice(1)).toEqual(Array(200).fill('1'))
 expect(await readFile(wide,'utf8')).toBe(input)
 await undo();expect((await readTableRows(page,20))[0][0]).toBe('')
})

test('LIM-1 una protección recibida con el diálogo abierto invalida su vista previa',async()=>{
 await headerAction('Cantidad','Rellenar vacíos de la columna…')
 const dialog=page.getByRole('dialog',{name:'Rellenar vacíos de Cantidad',exact:true})
 await dialog.getByRole('textbox',{name:'Valor',exact:true}).fill('0');await previewEmpty(dialog)
 const [doc]=await page.evaluate(()=>window.freya.documents())
 // El cambio usa el mismo evento público que publica DocumentManager al proteger una fuente.
 await app.evaluate(({BrowserWindow},doc)=>BrowserWindow.getAllWindows()[0].webContents.send('freya:event',{type:'changed',document:{...doc,projectSource:'protected',readonly:true}}),doc)
 await expect(dialog.getByRole('button',{name:'Rellenar',exact:true})).toBeDisabled()
 await expect(dialog.getByRole('textbox',{name:'Valor',exact:true})).toBeDisabled()
 await expect(dialog.getByRole('button',{name:'Vista previa',exact:true})).toBeDisabled()
 await expect(dialog.locator('table')).toHaveCount(0)
 await expect(dialog).toContainText(t('empty.protected'))
 await page.keyboard.press('Escape');expect(digest(await readFile(path))).toBe(digest(source))
})

test('LIM-1 rellenar desde Información actúa sobre todo el documento y pide actualizar el análisis',async()=>{
 await page.getByRole('textbox',{name:'Buscar en tabla',exact:true}).fill('a')
 await expect(page.getByRole('grid',{name:'Tabla de datos'}).locator('.csv-row')).toHaveCount(4)
 const panel=await information(),row=panel.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Cantidad',exact:true})})
 await row.locator('.quality-breakdown>summary').click()
 await row.getByRole('button',{name:'Rellenar vacíos…',exact:true}).click()
 await expect(page.locator('.analysis-workspace:not([hidden])')).toHaveCount(0)
 const dialog=page.getByRole('dialog',{name:'Rellenar vacíos de Cantidad',exact:true})
 await expect(dialog).toContainText(t('empty.scope'))
 await dialog.getByRole('textbox',{name:'Valor',exact:true}).fill('0');await previewEmpty(dialog)
 await dialog.getByRole('button',{name:'Rellenar',exact:true}).click()
 expect((await readTableRows(page,20)).slice(4).map(row=>row[2])).toEqual(['0','0','0'])
 await expect(page.getByRole('textbox',{name:'Buscar en tabla',exact:true})).toHaveValue('a')
 await openAnalysis(page,'Información');await expect(panel.getByRole('status')).toHaveText(t('info.changed'))
 await expect(panel.locator('tbody tr')).toHaveCount(0)
 await panel.getByRole('button',{name:'Obtener información',exact:true}).click()
 await expect(panel.getByRole('status')).toHaveText(t('info.complete'))
 await expect(row.locator('td').nth(3)).toHaveText('0')
 expect(digest(await readFile(path))).toBe(digest(source))
})

for(const language of ['es','en','en-XA'] as Language[])test(`LIM-1 teclado, idiomas y temas (${language})`,async()=>{
 const tr=(key:string,values:Record<string,string|number>={})=>t(key,values,language)
 const measurements:unknown[]=[]
 await page.getByRole('checkbox',{name:'Seleccionar columna Cantidad',exact:true}).check()
 async function fromPalette(){
  const commands=await openCsvCommands(page,app)
  await commands.getByRole('searchbox',{name:'Buscar comando CSV',exact:true}).fill('fillna')
  await commands.getByRole('searchbox',{name:'Buscar comando CSV',exact:true}).press('Enter')
  const dialog=page.getByRole('dialog',{name:tr('empty.fillTitle',{column:'Cantidad'}),exact:true})
  await expect(dialog.getByRole('textbox',{name:tr('empty.value'),exact:true})).toBeFocused()
  return dialog
 }
 for(const theme of ['light','dark']){
  await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme)
  await expect.poll(()=>page.locator('html').evaluate(element=>element.classList.contains('dark'))).toBe(theme==='dark')
  const dialog=await fromPalette()
  await dialog.getByRole('textbox',{name:tr('empty.value'),exact:true}).fill('0')
  await dialog.getByRole('button',{name:tr('empty.preview'),exact:true}).press('Enter')
  await expect(dialog.getByRole('button',{name:tr('empty.applyFill'),exact:true})).toBeEnabled()
  await expect(dialog.getByRole('status')).toContainText(tr('empty.preview.ready'))
  await expect(dialog).not.toContainText('[freya:EMPTY]')
  await dialog.evaluate(async element=>{await Promise.all(element.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{})))})
  const contrast=await dialog.evaluate(dialog=>{
   const rgb=(value:string)=>value.match(/[\d.]+/g)!.slice(0,3).map(Number)
   const light=(value:string)=>rgb(value).map(n=>{const s=n/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4}).reduce((sum,n,index)=>sum+n*[.2126,.7152,.0722][index],0)
   return [dialog,dialog.querySelector('.notice')!,dialog.querySelector('.actions button.primary')!,dialog.querySelector('textarea')!].map(element=>{
    let parent:Element|null=element,background='rgba(0, 0, 0, 0)'
    while(parent&&/rgba\([^)]*,\s*0\)$|transparent/.test(background)){background=getComputedStyle(parent).backgroundColor;parent=parent.parentElement}
    const foreground=getComputedStyle(element).color,a=light(foreground),b=light(background)
    return{element:element.tagName,foreground,background,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
   })
  })
  for(const pair of contrast)expect(pair.ratio).toBeGreaterThanOrEqual(4.5)
  measurements.push({language,theme,contrast})
  const bounds=await dialog.boundingBox();expect(bounds).toBeTruthy();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(900)
  await page.screenshot({animations:'disabled',path:test.info().outputPath(`lim1-${language}-${theme}-1440x900.png`)})
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button',{name:tr('charts.toolbar.findAction'),exact:true})).toBeFocused()
 }
 await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'})
 await page.getByRole('combobox',{name:'Codificación',exact:true}).selectOption('win1252')
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents()))[0].encoding).toBe('win1252')
 await page.getByRole('checkbox',{name:'Seleccionar columna Cantidad',exact:true}).check()
 const dialog=await fromPalette(),value=dialog.getByRole('textbox',{name:tr('empty.value'),exact:true})
 await value.focus();await expect(value).toBeFocused()
 const focus=await value.evaluate(element=>{const css=getComputedStyle(element);return{style:css.outlineStyle,width:parseFloat(css.outlineWidth)}})
 expect(focus.style).not.toBe('none');expect(focus.width).toBeGreaterThanOrEqual(2)
 await value.fill('💡');await dialog.getByRole('button',{name:tr('empty.preview'),exact:true}).press('Enter')
 await expect(dialog.getByRole('alert')).toContainText(tr('empty.error.encoding'))
 await expect(dialog).not.toContainText('[freya:EMPTY]')
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible()
 await expect(page.getByRole('button',{name:tr('charts.toolbar.findAction'),exact:true})).toBeFocused()
 expect(digest(await readFile(path))).toBe(digest(source))
 await writeFile(test.info().outputPath('lim1-contrast.json'),JSON.stringify(measurements,null,2)+'\n')
})
