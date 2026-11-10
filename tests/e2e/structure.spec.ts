import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import { closeElectron } from './close-electron'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {menuItem} from './panel'
import {runApplicationMenu} from './application-menu'
import {readCalculationError,type CalculateColumnEdit} from '../../src/shared/calculated-column'
import {calculationFunctionGroups} from '../../src/shared/calculation-help'
import {t,type Language} from '../../src/shared/i18n'
let app:ElectronApplication,page:Page,folder:string
const original='ID,Partes,Nota\r\n001,a;0007,Café\r\n002,b;;,é\r\n001,a;0007,Otra\r\n'
test.beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-transform-e2e-'));await mkdir(join(folder,'exports'));const {ELECTRON_RUN_AS_NODE:_,...env}=process.env,locale=test.info().title.match(/\[(en|en-XA)\]$/)?.[1]??'es';app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:locale,FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')},timeout:60000});page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})})
test.afterEach(async()=>{await closeElectron(app);await rm(folder,{recursive:true,force:true})})
async function open(source=original,name='data.csv'){const path=join(folder,name);await writeFile(path,source);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);return{doc,path}}
async function dialog(operation:string,columns=['0']){await page.getByLabel('Limpiar datos',{exact:true}).click();await page.getByRole('button',{name:'Transformar documento…',exact:true}).click();const panel=page.getByRole('dialog',{name:'Transformar documento CSV',exact:true});await panel.getByLabel('Transformación CSV',{exact:true}).selectOption(operation);if(operation!=='headers')await panel.getByLabel('Columnas para transformar',{exact:true}).selectOption(columns);return panel}
async function preview(panel:ReturnType<Page['getByRole']>){await panel.getByRole('button',{name:'Vista previa',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Vista previa lista',{timeout:30000})}
async function apply(panel:ReturnType<Page['getByRole']>){await panel.getByRole('button',{name:'Aplicar transformación',exact:true}).click();await expect(panel).toHaveCount(0)}

async function calculationDialog(locale:Language='es'){
 const menu=page.getByLabel(t('charts.toolbar.structure',{},locale),{exact:true})
 await menu.focus();await page.keyboard.press('Enter')
 const action=page.getByRole('button',{name:t('calculate.action',{},locale),exact:true})
 await expect(action).toBeVisible({timeout:3000})
 await action.focus();await page.keyboard.press('Enter')
 return page.getByRole('dialog',{name:t('calculate.action',{},locale),exact:true})
}

test('H15-1: la transformación calculada conserva decimales exactos',async()=>{
 const original='Producto,Precio unitario,Cantidad\nA,10.10,3\nB,0.1,3\n'
 const {doc,path}=await open(original)
 const rows=await page.evaluate(async({id,revision})=>{
  const edit:CalculateColumnEdit={type:'structure',operation:'calculate',name:'Total',position:3,expression:'"Precio unitario" * Cantidad',
   columns:[{index:1,read:'number',scale:2},{index:2,read:'number',scale:0}],onError:'abort',revision,requestId:crypto.randomUUID()}
  await window.freya.transformPreview(id,edit)
  await window.freya.tableEdit(id,edit)
  return (await window.freya.tablePage(id,{offset:0,limit:2,requestId:1})).rows.map(row=>row.cells)
 },doc)
 expect(rows).toEqual([['A','10.10','3','30.30'],['B','0.1','3','0.30']])
 expect(await readFile(path,'utf8')).toBe(original)
})

test('H15-1: las fórmulas que salen de la expresión escalar se rechazan sin cambios',async()=>{
 const original='Producto,Precio unitario,Cantidad\nA,10.10,3\n'
 const {doc,path}=await open(original)
 const before=await page.evaluate(()=>window.freya.documents())
 for(const expression of [
  'Cantidad); SELECT 1; --',
  '(SELECT 1)',
  "read_csv('archivo-privado.csv')",
  'sum(Cantidad)',
  'avg(Cantidad) OVER ()',
 ]){
  const error=await page.evaluate(async({id,revision,expression})=>{
   const edit:CalculateColumnEdit={type:'structure',operation:'calculate',name:'Total',position:3,expression,
    columns:[{index:2,read:'number',scale:0}],onError:'abort',revision,requestId:crypto.randomUUID()}
   try{await window.freya.transformPreview(id,edit);return ''}catch(error){return String(error)}
  },{id:doc.id,revision:doc.revision,expression})
  expect(readCalculationError(error)?.code,expression).toBe('scalar')
  expect(await page.evaluate(()=>window.freya.documents())).toEqual(before)
  expect(await readFile(path,'utf8')).toBe(original)
 }
})

test('H15-1 interfaz: vista previa de filas filtradas, cambio pendiente, guardar y deshacer',async()=>{
 const source='Producto,Precio unitario,Cantidad\r\n"Café",10.10,3\r\nTé,0.1,3\r\n'
 const {doc,path}=await open(source)
 await page.getByLabel('Tema',{exact:true}).selectOption('light')
 await page.getByRole('gridcell',{name:'Fila 2, Cantidad',exact:true}).dblclick()
 const cell=page.getByRole('textbox',{name:'Editar celda',exact:true})
 await cell.fill('4');await cell.press('Enter')
 await expect(page.getByRole('gridcell',{name:'Fila 2, Cantidad',exact:true})).toHaveText('4')
 const product=page.getByRole('button',{name:'Producto',exact:true})
 await product.click();await product.click()
 await expect(page.getByRole('columnheader').first()).toHaveAttribute('aria-sort','descending')
 await menuItem(page,'Filtrar','Filtros por columna');await page.getByLabel('Filtrar Producto',{exact:true}).fill('Café')
 await page.getByLabel('Buscar en tabla',{exact:true}).fill('Café');await expect(page.locator('footer')).toContainText('1 de 2 filas')
 const panel=await calculationDialog()
 await expect(panel.getByLabel('Nombre de la columna',{exact:true})).toBeFocused()
 await panel.getByLabel('Nombre de la columna',{exact:true}).fill('Total')
 const formula=panel.getByLabel('Fórmula',{exact:true})
 await panel.getByLabel('Insertar columna en la fórmula',{exact:true}).selectOption('1')
 await expect(formula).toHaveValue('"Precio unitario"')
 await formula.press('End');await page.keyboard.insertText(' * Cantidad')
 await panel.getByLabel('Cómo leer Precio unitario',{exact:true}).selectOption('number')
 await panel.getByLabel('Decimales de Precio unitario',{exact:true}).fill('2')
 await panel.getByLabel('Cómo leer Cantidad',{exact:true}).selectOption('number')
 await panel.getByRole('button',{name:'Vista previa',exact:true}).press('Enter')
 await expect(panel.getByRole('status')).toContainText('Vista previa lista')
 await expect(panel.getByRole('table')).toContainText('30.30');await expect(panel.getByRole('table')).toContainText('0.40')
 await expect(panel.getByRole('table')).toContainText('Precio unitario: 10.10 · Cantidad: 3')
 await expect(panel.getByRole('button',{name:'Aplicar',exact:true})).toBeInViewport()
 await page.screenshot({path:test.info().outputPath('h15-1-claro-1440x900.png')})
 await panel.getByRole('button',{name:'Aplicar',exact:true}).press('Enter')
 await expect(panel).toHaveCount(0);await expect(page.getByRole('status').filter({hasText:'Columna añadida'})).toHaveText('Columna añadida. Guarda el documento para conservar el cambio.')
 await expect(page.getByLabel('Filas y columnas',{exact:true})).toBeFocused()
 expect(await readFile(path,'utf8')).toBe(source)
 await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(page.getByRole('columnheader',{name:/Total/})).toHaveCount(0)
 await page.getByRole('button',{name:'Rehacer',exact:true}).click();await expect(page.getByRole('columnheader',{name:/Total/})).toHaveCount(1)
 await page.getByRole('button',{name:'Guardar',exact:true}).click()
 const expected='Producto,Precio unitario,Cantidad,Total\r\n"Café",10.10,3,30.30\r\nTé,0.1,4,0.40\r\n'
 await expect.poll(()=>readFile(path,'utf8')).toBe(expected)
 const persisted=await page.evaluate(id=>window.freya.documents().then(all=>all.find(item=>item.id===id)),doc.id)
 expect(persisted?.rowCount).toBe(2)
})

for(const locale of ['en','en-XA'] as const)test(`H15-1 interfaz: traducción, fórmula con acento y medios accesibles [${locale}]`,async()=>{
 const label=(key:string)=>t('calculate.'+key,{},locale)
 await open('Región,Importe\nCafé,1\n')
 await expect(page.locator('html')).toHaveAttribute('lang',locale)
 await page.getByLabel('Tema',{exact:true}).selectOption('dark')
 const panel=await calculationDialog(locale)
 const formula=panel.getByLabel(label('formula'),{exact:true})
 await formula.fill('"Región" * 2')
 await panel.getByRole('button',{name:label('preview'),exact:true}).press('Enter')
 await expect(panel.getByRole('alert')).toContainText(t('calculate.error.textType',{column:'Región'},locale))
 await expect(panel.getByText(label('detail'),{exact:true})).toBeVisible()
 await expect(panel.getByRole('alert').locator('details')).not.toHaveAttribute('open')
 await formula.fill('')
 await formula.focus();await page.keyboard.insertText('"Región" || \' con té\'')
 await panel.getByRole('button',{name:label('preview'),exact:true}).press('Enter')
 await expect(panel.getByRole('status')).toHaveText(label('progress.ready'))
 await expect(panel.getByRole('table')).toContainText('Café con té')
 await page.screenshot({path:test.info().outputPath(`h15-1-oscuro-${locale}-1440x900.png`)})
 if(locale==='en-XA'){
  await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'})
  expect(await page.evaluate(()=>matchMedia('(forced-colors: active)').matches&&matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  await formula.focus();await expect(formula).toBeFocused();await expect(panel).toBeVisible()
  await page.screenshot({path:test.info().outputPath('h15-1-colores-forzados-en-XA-1440x900.png')})
 }
 await page.keyboard.press('Escape');await expect(panel).toHaveCount(0)
 await expect(page.getByLabel(t('charts.toolbar.structure',{},locale),{exact:true})).toBeFocused()
})

test('H15-1 interfaz: explica la fila corta y desactiva el cálculo en una muestra',async()=>{
 const source='A,B\nuno,2\ndos\n',opened=await open(source,'irregular.csv')
 const panel=await calculationDialog()
 await panel.getByLabel('Fórmula',{exact:true}).fill('1')
 await panel.getByRole('button',{name:'Vista previa',exact:true}).press('Enter')
 await expect(panel.getByRole('alert')).toContainText('La fila 2 tiene campos ausentes')
 await expect(panel.getByRole('button',{name:'Aplicar',exact:true})).toBeDisabled()
 await page.keyboard.press('Escape');await expect(panel).toHaveCount(0)
 expect(await readFile(opened.path,'utf8')).toBe(source)
 const {doc}=await open('A\nuno\n'+'x'.repeat(1024*1024+4)+'\n','muestra.csv')
 expect(doc.readonly).toBe(true)
 const menu=page.getByLabel('Filas y columnas',{exact:true})
 await menu.focus();await page.keyboard.press('Enter')
 const action=page.getByRole('button',{name:'Añadir columna calculada…',exact:true})
 await expect(action).toBeDisabled()
 await expect(action).toHaveAccessibleDescription(/solo lectura/)
})

test('H15-2: los ocho ejemplos eligen columnas, ajustan la lectura y calculan',async()=>{
 const source='Precio unitario,Cantidad,Fecha,Nombre,Apellido\n10.10,2, 2026-02-04 ,Ana,López\n0.10,4,2025-11-09,Luz,Pérez\n'
 const {path}=await open(source)
 await page.getByLabel('Tema',{exact:true}).selectOption('light')
 const panel=await calculationDialog()
 for(const [label,expected] of [
  ['Multiplicar',/^20\.20$/],['Porcentaje',/^505(?:\.0+)?$/],['Redondear',/^10\.10$/],['Año',/^2026$/],['Mes',/^2$/],
  ['Juntar textos',/^Ana López$/],['Condición',/^Mayorista$/],['Valor si está vacío',/^10\.10$/],
 ] as const){
  const example=panel.getByRole('button',{name:label,exact:true})
  await expect(example).toBeEnabled({timeout:5000});await example.focus();await page.keyboard.press('Enter')
  await expect(panel.locator('[aria-live="polite"]').filter({hasText:label})).toBeAttached()
  await panel.getByRole('button',{name:'Vista previa',exact:true}).press('Enter')
  await expect(panel.getByRole('status')).toContainText('Vista previa lista')
  await expect(panel.getByRole('row').nth(1).getByRole('cell').last()).toHaveText(expected)
 }
 const help=panel.getByText('Funciones disponibles',{exact:true})
 await help.focus();await page.keyboard.press('Enter')
 await expect(panel.getByText('round',{exact:true})).toBeVisible()
 expect((await panel.locator('[data-calculation-function]').allTextContents()).sort()).toEqual(Object.values(calculationFunctionGroups).flat().sort())
 await page.screenshot({path:test.info().outputPath('h15-2-claro-1440x900.png')})
 expect(await readFile(path,'utf8')).toBe(source)
})

test('H15-2b: los ejemplos encuentran cantidades aunque haya más de 100 000 valores distintos',async()=>{
 const source='Precio,Cantidad\n'+Array.from({length:150000},(_,i)=>`${i}.${String(i%100).padStart(2,'0')},${i%50}\n`).join('')
 const {path}=await open(source)
 const panel=await calculationDialog()
 const multiply=panel.getByRole('button',{name:'Multiplicar',exact:true})
 await expect(multiply).toBeEnabled()
 const year=panel.getByRole('button',{name:'Año',exact:true})
 await expect(year).toBeDisabled()
 await expect(year).toHaveAccessibleDescription(/No hay una columna de fechas AAAA-MM-DD/)
 await multiply.click()
 await expect(panel.getByLabel('Fórmula',{exact:true})).toHaveValue('"Precio" * "Cantidad"')
 await expect(panel.getByLabel('Decimales de Precio',{exact:true})).toHaveValue('2')
 await expect(panel.getByLabel('Decimales de Cantidad',{exact:true})).toHaveValue('0')
 expect(await readFile(path,'utf8')).toBe(source)
})

test('H15-2b: el ejemplo Condition calcula en el idioma de la interfaz [en]',async()=>{
 const source='Price\n11\n10\n'
 const {path}=await open(source)
 const panel=await calculationDialog('en')
 const example=panel.getByRole('button',{name:'Condition',exact:true})
 await expect(example).toBeEnabled()
 await expect(example).toHaveAccessibleDescription('Returns ‘Wholesaler’ above 10 and ‘Retailer’ otherwise.')
 await example.click()
 await panel.getByRole('button',{name:'Preview',exact:true}).click()
 await expect(panel.getByRole('status')).toContainText('Preview ready')
 await expect(panel.getByRole('row').nth(1).getByRole('cell').last()).toHaveText('Wholesaler')
 await expect(panel.getByRole('row').nth(2).getByRole('cell').last()).toHaveText('Retailer')
 expect(await readFile(path,'utf8')).toBe(source)
})

test('H15-2: dejar Resumen cancela su perfilado y permite preparar la fórmula',async()=>{
 const source='Precio,Cantidad,Fecha,Nombre,Apellido\n10.10,2,2026-02-04,Ana,López\n'
 const {path}=await open(source)
 const views=page.locator('[data-csv-view]')
 type Gate={chartRequest?:string;cancelled:boolean;release?:()=>void;restore:()=>void}
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers
  const original=handlers.get('freya');if(!original)throw new Error('No existe el manejador real de freya')
  const state=globalThis as typeof globalThis&{__calculationProfileGate?:Gate}
  const gate:Gate={cancelled:false,restore:()=>handlers.set('freya',original)}
  state.__calculationProfileGate=gate
  // Retiene la primera respuesta real de Gráficos hasta cambiar de vista. El diálogo usa bins:1.
  handlers.set('freya',async(event,operation,...args)=>{
   const request=args[1] as {bins:number;requestId:string}|undefined
   if(operation==='analyzeColumn'&&request?.bins===10&&!gate.chartRequest){
    const result=await original(event,operation,...args)
    gate.chartRequest=request.requestId
    await new Promise<void>(release=>{gate.release=release})
    return result
   }
   if(operation==='cancelAnalysis'&&args[1]===gate.chartRequest)gate.cancelled=true
   return original(event,operation,...args)
  })
 })
 const gateState=()=>app.evaluate(()=>{
  const gate=(globalThis as typeof globalThis&{__calculationProfileGate?:Gate}).__calculationProfileGate
  return {held:!!gate?.chartRequest,cancelled:!!gate?.cancelled}
 })
 try{
  await views.getByRole('button',{name:'Resumen y gráfico',exact:true}).click()
  await expect.poll(gateState).toEqual({held:true,cancelled:false})
  await views.getByRole('button',{name:'Tabla',exact:true}).click()
  await expect.poll(gateState).toEqual({held:true,cancelled:true})
  const panel=await calculationDialog()
  await app.evaluate(()=>{(globalThis as typeof globalThis&{__calculationProfileGate?:Gate}).__calculationProfileGate?.release?.()})
  await panel.getByRole('button',{name:'Multiplicar',exact:true}).click()
  await panel.getByRole('button',{name:'Vista previa',exact:true}).press('Enter')
  await expect(panel.getByRole('status')).toContainText('Vista previa lista')
  await expect(panel.getByRole('table')).toContainText('20.20')
  await page.keyboard.press('Escape')
  await views.getByRole('button',{name:'Resumen y gráfico',exact:true}).click()
  await expect(page.locator('.pivot-result')).toBeVisible()
  expect(await readFile(path,'utf8')).toBe(source)
 }finally{
  await app.evaluate(()=>{
   const state=globalThis as typeof globalThis&{__calculationProfileGate?:Gate}
   state.__calculationProfileGate?.release?.();state.__calculationProfileGate?.restore();delete state.__calculationProfileGate
  }).catch(()=>{})
 }
})

test('H15-2: el encabezado inserta a su derecha y distingue vacío de campo ausente',async()=>{
 const source='ID,Precio,Nota\n1,7,\n2\n', {doc,path}=await open(source)
 await expect(page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})).toBeVisible()
 const column=page.getByLabel('Seleccionar columna ID',{exact:true})
 await column.focus();await page.keyboard.press('Shift+F10')
 const action=page.getByRole('menuitem',{name:'Calcular columna a la derecha',exact:true})
 await expect(action).toBeVisible({timeout:3000});await action.focus();await page.keyboard.press('Enter')
 const panel=page.getByRole('dialog',{name:'Añadir columna calculada…',exact:true})
 await panel.getByLabel('Fórmula',{exact:true}).fill('"Nota"')
 const noDate=panel.getByRole('button',{name:'Año',exact:true})
 await expect(noDate).toBeDisabled();await expect(noDate).toHaveAccessibleDescription(/no hay.*fecha/i)
 await panel.getByRole('button',{name:'Vista previa',exact:true}).press('Enter')
 await expect(panel.getByRole('status')).toContainText('Vista previa lista')
 await expect(panel.getByRole('table')).toContainText('Nota: (vacío)')
 await expect(panel.getByRole('table')).toContainText('Nota: (sin campo)')
 await panel.getByRole('button',{name:'Aplicar',exact:true}).press('Enter')
 await expect(panel).toHaveCount(0)
 await expect(page.getByRole('status').filter({hasText:'Columna añadida'})).toBeVisible()
 await expect(column).toBeFocused()
 const updated=await page.evaluate(id=>window.freya.documents().then(docs=>docs.find(item=>item.id===id)),doc.id)
 expect(updated?.headers).toEqual(['ID','Calculada','Precio','Nota'])
 expect(await readFile(path,'utf8')).toBe(source)
})

test('H15-2: paleta CSV y ayuda por teclado con colores forzados [en-XA]',async()=>{
 await open('Importe,Cantidad\n10.10,2\n')
 await page.getByLabel('Tema',{exact:true}).selectOption('dark')
 const origin=page.getByRole('gridcell',{name:'Fila 1, Importe',exact:true})
 expect(await app.evaluate(({Menu})=>Menu.getApplicationMenu()?.getMenuItemById('edit.commandPalette')?.accelerator)).toBe('CommandOrControl+K')
 await origin.focus();await runApplicationMenu(app,'edit.commandPalette')
 const palette=page.getByRole('dialog',{name:'Comandos CSV',exact:true})
 await expect(palette).toBeVisible({timeout:3000})
 const search=palette.getByLabel('Buscar comando CSV',{exact:true})
 await search.fill('cálcülátëd')
 const command=palette.getByRole('button').filter({has:page.getByText(t('calculate.action',{},'en-XA'),{exact:true})})
 await expect(command).toBeEnabled({timeout:3000});await search.press('Enter')
 const panel=page.getByRole('dialog',{name:t('calculate.action',{},'en-XA'),exact:true})
 const help=panel.getByText(t('calculate.functions.title',{},'en-XA'),{exact:true})
 await help.focus();await page.keyboard.press('Enter')
 await expect(panel.getByText('round',{exact:true})).toBeVisible()
 await page.screenshot({path:test.info().outputPath('h15-2-oscuro-en-XA-1440x900.png')})
 await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'})
 await expect(help).toBeFocused();await expect(help).toBeInViewport()
 expect(await page.evaluate(()=>matchMedia('(forced-colors: active)').matches)).toBe(true)
 await page.screenshot({path:test.info().outputPath('h15-2-colores-forzados-en-XA-1440x900.png')})
 await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);await expect(origin).toBeFocused()
})

test('transformaciones visuales: documento completo, originales, Unicode, encabezados, duplicados y deshacer',async()=>{
 const {path}=await open();await page.getByLabel('Buscar en tabla',{exact:true}).fill('001');await expect(page.locator('footer')).toContainText('2 de 3 filas')
 let panel=await dialog('split',['1']);await expect(panel).toContainText('incluye filas ocultas');await preview(panel);await expect(panel.locator('dl')).toContainText('Columnas añadidas3');await apply(panel)
 await page.getByLabel('Buscar en tabla',{exact:true}).fill('');await expect(page.getByRole('gridcell',{name:'Fila 2, Partes',exact:true})).toHaveText('b;;');await expect(page.getByRole('gridcell',{name:'Fila 1, Partes_2',exact:true})).toHaveText('0007');expect((await page.evaluate(()=>window.freya.documents()))[0].rowCount).toBe(3)
 await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(page.getByRole('columnheader')).toHaveCount(3)
 panel=await dialog('combine',['1','0']);await panel.getByLabel('Separador de transformación',{exact:true}).selectOption('|');await panel.getByLabel('Nombre de columna combinada',{exact:true}).fill('Clave completa');await preview(panel);await apply(panel);await expect(page.getByRole('gridcell',{name:'Fila 1, Clave completa',exact:true})).toHaveText('001|a;0007');await page.getByRole('button',{name:'Deshacer',exact:true}).click()
 panel=await dialog('normalize',['2']);await preview(panel);await apply(panel);await expect(page.getByRole('gridcell',{name:'Fila 1, Nota',exact:true})).toHaveText('Café');await page.getByRole('button',{name:'Deshacer',exact:true}).click()
 panel=await dialog('headers');await preview(panel);await apply(panel);await expect(page.getByRole('columnheader').first()).toContainText('id');await page.getByRole('button',{name:'Deshacer',exact:true}).click()
 panel=await dialog('deduplicate',['0','1']);await preview(panel);await expect(panel.locator('dl')).toContainText('Filas por eliminar1')
 for(const theme of ['light','dark']){await panel.getByRole('button',{name:'Cerrar',exact:true}).click();await page.getByLabel('Tema',{exact:true}).selectOption(theme);panel=await dialog('deduplicate',['0','1']);await preview(panel);await page.screenshot({path:test.info().outputPath(`csv-transform-${theme}-1440x900.png`)})}
 await page.setViewportSize({width:1280,height:800});await page.screenshot({path:test.info().outputPath('csv-transform-dark-1280x800.png')});await apply(panel);await expect(page.locator('footer')).toContainText('2 de 2 filas');await expect(page.getByRole('gridcell',{name:'Fila 1, Nota',exact:true})).toHaveText('Café');await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(page.locator('footer')).toContainText('3 de 3 filas');expect(await readFile(path,'utf8')).toBe(original)
 const cell=page.getByRole('gridcell',{name:'Fila 1, ID',exact:true});await cell.click();await page.keyboard.press(process.platform==='darwin'?'Meta+Shift+t':'Control+Shift+t');await expect(page.getByRole('dialog',{name:'Transformar documento CSV',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(cell).toBeFocused()
 await cell.click({button:'right'});await page.getByRole('menuitem',{name:'Transformar documento…',exact:true}).click();await expect(page.getByRole('dialog',{name:'Transformar documento CSV',exact:true})).toBeVisible();await page.keyboard.press('Escape')
})

test('transformaciones: cancela trabajo real, invalida revisión obsoleta y rechaza mensajes inválidos',async()=>{
 const {doc,path}=await open('A,N\n'+'é,00123\n'.repeat(50000)),before=await page.evaluate(()=>window.freya.documents())
 for(const apply of [false,true]){
  const error=await page.evaluate(async({doc,apply})=>{const request={type:'structure' as const,operation:'normalize' as const,columns:[0],revision:doc.revision,requestId:crypto.randomUUID()};const unsubscribe=window.freya.onEvent(event=>{if(event.type==='analysis'&&event.progress?.requestId===request.requestId&&event.progress.rows>=513)void window.freya.cancelAnalysis(doc.id,request.requestId)});try{await(apply?window.freya.tableEdit(doc.id,request):window.freya.transformPreview(doc.id,request));return ''}catch(error){return String(error)}finally{unsubscribe()}},{doc,apply});expect(error).toContain('cancelada');expect(await page.evaluate(()=>window.freya.documents())).toEqual(before)
 }
 const cancelPanel=await dialog('normalize',['0']);await preview(cancelPanel)
 // Exercise immediate cancellation before the asynchronous commit acknowledgement.
 await cancelPanel.getByRole('button',{name:'Aplicar transformación',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();queueMicrotask(()=>{const cancel=[...document.querySelectorAll<HTMLButtonElement>('dialog button')].find(button=>button.textContent==='Cancelar preparación');if(!cancel)throw new Error('No aparece la cancelación');cancel.click()})})
 await expect(cancelPanel.getByRole('status')).toContainText('cancelada');expect(await page.evaluate(()=>window.freya.documents())).toEqual(before);await cancelPanel.getByRole('button',{name:'Cerrar',exact:true}).click()
 const panel=await dialog('combine',['0','1']);await preview(panel);await page.evaluate(id=>window.freya.tableEdit(id,{type:'cell',rowId:'1',column:1,value:'9007199254740993'}),doc.id);await panel.getByRole('button',{name:'Aplicar transformación',exact:true}).click();await expect(panel.getByRole('status')).toContainText('tabla cambió');expect((await page.evaluate(()=>window.freya.documents()))[0].headers).toEqual(['A','N']);await panel.getByRole('button',{name:'Cerrar',exact:true}).click()
 const invalid=await page.evaluate(async id=>{try{await window.freya.transformPreview(id,{type:'structure',operation:'execute',columns:[0],revision:0,requestId:crypto.randomUUID()} as never);return false}catch{return true}},doc.id);expect(invalid).toBe(true);expect(await readFile(path,'utf8')).toBe('A,N\n'+'é,00123\n'.repeat(50000))
})

test('transformación conserva recuperación, un paso de deshacer y guardado en disco',async()=>{
 const {doc,path}=await open();const updated=await page.evaluate(async doc=>window.freya.tableEdit(doc.id,{type:'structure',operation:'combine',columns:[0,1],separator:' | ',name:'Combinada',revision:doc.revision,requestId:crypto.randomUUID()}),doc)
 await expect.poll(async()=>await page.evaluate(()=>window.freya.recoveries()),{timeout:10000}).not.toEqual([])
 const recovered=await page.evaluate(async()=>{const [entry]=await window.freya.recoveries();return window.freya.recover(entry.id)})
 expect(recovered.headers).toEqual(['Combinada','ID','Partes','Nota']);await page.evaluate(id=>window.freya.undo(id),recovered.id)
 const copy=await page.evaluate(id=>window.freya.export(id,{format:'csv',table:{scope:'all'}}),recovered.id);expect(await readFile(copy!,'utf8')).toBe(original);expect(await readFile(path,'utf8')).toBe(original)
 await page.evaluate(id=>window.freya.save(id),updated.id);expect(await readFile(path,'utf8')).toContain('001 | a;0007');expect(await readFile(path,'utf8')).toContain('\r\n')
})

test('transformaciones: el menú abre durante la paginación, con ratón y teclado, sin cambiar el rango ni los datos',async()=>{
 const source='ID,N\n'+Array.from({length:300},(_,i)=>`${String(i).padStart(5,'0')},9007199254740993`).join('\n')+'\n',{doc,path}=await open(source),before=await page.evaluate(()=>window.freya.documents()),grid=page.getByRole('grid',{name:'Tabla de datos',exact:true}),cell=page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})
 for(const keyboard of [false,true]){
  await expect(cell).toBeVisible();await expect(page.locator('footer')).toContainText('300 de 300 filas');await cell.click()
  if(keyboard)await cell.press('Shift+F10');else await cell.click({button:'right'})
  const menu=page.getByRole('menu',{name:'Acciones del rango',exact:true});await expect(menu).toBeVisible()
  // El observador activa la acción en la misma entrega del DOM que marca la carga, antes de la respuesta IPC.
  const state=await grid.evaluate((element,keyboard)=>new Promise<{disabled:boolean;loading:boolean;otherDisabled:boolean}>((resolve,reject)=>{
   const toolbar=document.querySelector('footer')!,menu=document.querySelector('.range-context')!,button=[...menu.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Transformar documento…')!
   const timeout=setTimeout(()=>{observer.disconnect();reject(new Error('No se observó la carga de otra página.'))},10000)
   const observer=new MutationObserver(()=>{if(!toolbar.textContent?.includes('Procesando…'))return;observer.disconnect();clearTimeout(timeout);const result={disabled:button.disabled,loading:true,otherDisabled:[...menu.querySelectorAll<HTMLButtonElement>('button')].filter(item=>item!==button).every(item=>item.disabled)};if(!keyboard)button.click();resolve(result)})
   observer.observe(toolbar,{childList:true,subtree:true,characterData:true});element.scrollTop=element.scrollHeight
  }),keyboard)
  expect(state).toEqual({disabled:false,loading:true,otherDisabled:true});if(keyboard){await expect(menu.getByRole('menuitem',{name:'Transformar documento…',exact:true})).toBeFocused();await page.screenshot({path:test.info().outputPath('csv-context-transform-keyboard.png')});await page.keyboard.press('Enter')}const panel=page.getByRole('dialog',{name:'Transformar documento CSV',exact:true});await expect(panel).toBeVisible();await expect(menu).toHaveCount(0);await expect(panel.getByLabel('Columnas para transformar',{exact:true})).toHaveValues(['0'])
  await page.keyboard.press('Escape');await expect(cell).toBeFocused();await expect(page.getByRole('status').filter({hasText:'Rango: filas 1–1, columnas 1–1'})).toBeVisible()
 }
 expect((await page.evaluate(()=>window.freya.documents())).find(d=>d.id===doc.id)).toEqual(before[0]);expect(await page.evaluate(()=>window.freya.recoveries())).toEqual([]);expect(await readFile(path,'utf8')).toBe(source)
})
