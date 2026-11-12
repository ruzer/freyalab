import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {t} from '../../src/shared/i18n'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {closeElectron} from './close-electron'
import {openAnalysis,showTable,openCsvCommands} from './panel'

let app:ElectronApplication,page:Page,folder:string,path:string
const source='Producto,Precio,Cantidad,Alta,Mixta\na,10,1,2026-01-02,1\nb,20,2,2026-03-04,x\na,30,3,2026-02-01,1\nc,40,4,2026-01-15,\na,,,2026-02-20,\na,50,,2026-01-30,\n'
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-describe-ui-'));path=join(folder,'datos.csv');await writeFile(path,source)
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:test.info().title.match(/\((es|en|en-XA)\)$/)?.[1]??'es',FREYALAB_USER_DATA:join(folder,'profile')},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900});await page.evaluate(path=>window.freya.openPaths([path]),path)
})
test.afterEach(async()=>{await closeElectron(app);await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function spy(hold?:'profile'|'stats'){
 await app.evaluate(({ipcMain},hold)=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  const calls:{operation:string;column:number;profileOnly:boolean;revision:number}[]=[];Reflect.set(globalThis,'describeCalls',calls)
  handlers.set('freya',async(event,...args)=>{
   const operation=String(args[0]),request=(args[operation==='stats'?4:2]??{}) as Record<string,unknown>
   if(['stats','analyzeColumn','cancelAnalysis'].includes(operation))calls.push({operation,column:operation==='stats'?(args[3] as number[])[0]:Number(request.column),profileOnly:request.profileOnly===true,revision:Number(request.revision)})
   const result=await original(event,...args)
   if((hold==='profile'&&operation==='analyzeColumn'&&request.profileOnly||hold==='stats'&&operation==='stats')&&!Reflect.get(globalThis,'describeHeld')){Reflect.set(globalThis,'describeHeld',true);await new Promise<void>(release=>Reflect.set(globalThis,'describeRelease',release))}
   return result
  })
 },hold)
}
const calls=()=>app.evaluate(()=>Reflect.get(globalThis,'describeCalls') as {operation:string;column:number;profileOnly:boolean;revision:number}[])
const release=()=>app.evaluate(()=>Reflect.get(globalThis,'describeRelease')?.())

test('AN-2 muestra describe por petición con el fixture aprobado y conserva la fuente',async()=>{
 await spy()
 await openAnalysis(page,'Estadísticas')
 expect(await calls()).toEqual([])
 await expect(page.getByRole('button',{name:'Calcular',exact:true})).toBeVisible()
 const panel=page.getByRole('region',{name:'Resumen estadístico',exact:true})
 await expect(panel.getByRole('table')).toHaveCount(0)
 await panel.getByRole('button',{name:'Calcular',exact:true}).click()
 await expect(panel.getByRole('table')).toBeVisible()
 await expect(panel.locator('thead th').first()).toHaveText('Estadística')
 await expect(panel.locator('thead th>span')).toHaveText(['Precio','Cantidad'])
 await expect(panel.locator('thead th>small')).toHaveText(['Número','Número'])
 await expect(panel.locator('tbody tr')).toHaveCount(8)
 for(const [index,values] of [['5','4'],['30','2.5'],['15.8114','1.291'],['10','1'],['20','1.75'],['30','2.5'],['40','3.25'],['50','4']].entries())await expect(panel.locator('tbody tr').nth(index).locator('td')).toHaveText(values)
 await expect(panel.locator('tbody tr').nth(2).locator('td').first()).toHaveAttribute('title','15.811388300841896')
 const numericCalls=await calls()
 expect(numericCalls).toHaveLength(7)
 for(let column=0;column<5;column++)expect(numericCalls.filter(call=>call.column===column)).toHaveLength(column===1||column===2?2:1)
 await app.evaluate(()=>{Reflect.get(globalThis,'describeCalls').length=0})
 await panel.getByRole('checkbox',{name:'Incluir texto y fechas',exact:true}).check()
 await panel.getByRole('button',{name:'Calcular',exact:true}).click()
 await expect(panel.locator('tbody tr')).toHaveCount(11)
 await expect(panel.locator('tbody tr').nth(0).locator('td')).toHaveText(['6','5','4','6','3'])
 await expect(panel.locator('tbody tr').nth(1).locator('td')).toHaveText(['3','','','6','2'])
 await expect(panel.locator('tbody tr').nth(2).locator('td')).toHaveText(['a','','','','1'])
 await expect(panel.locator('tbody tr').nth(3).locator('td')).toHaveText(['4','','','','2'])
 await expect(panel.locator('tbody tr').nth(6).locator('td')).toHaveText(['','10','1','2026-01-02',''])
 const allCalls=await calls();expect(allCalls).toHaveLength(10)
 for(let column=0;column<5;column++)expect(allCalls.filter(call=>call.column===column)).toHaveLength(2)
 expect(await readFile(path,'utf8')).toBe(source)
})

test('AN-2 coordina el cálculo avanzado con describe sin lanzar consultas al desplegar',async()=>{
 await openAnalysis(page,'Estadísticas')
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  const calls:string[]=[];Reflect.set(globalThis,'describeLegacyCalls',calls)
  handlers.set('freya',async(event,...args)=>{
   if(['stats','analyzeColumn'].includes(String(args[0])))calls.push(String(args[0]))
   const result=await original(event,...args)
   if(args[0]==='stats'&&!Reflect.get(globalThis,'describeLegacyHeld')){Reflect.set(globalThis,'describeLegacyHeld',true);await new Promise<void>(release=>Reflect.set(globalThis,'describeLegacyRelease',release))}
   return result
  })
 })
 const advanced=page.locator('.advanced-statistics'),panel=page.getByRole('region',{name:'Resumen estadístico',exact:true})
 await advanced.locator(':scope>summary').click()
 expect(await app.evaluate(()=>Reflect.get(globalThis,'describeLegacyCalls'))).toEqual([])
 await advanced.getByRole('button',{name:'Analizar',exact:true}).click()
 await expect.poll(()=>app.evaluate(()=>Reflect.get(globalThis,'describeLegacyHeld'))).toBe(true)
 await expect(panel.getByRole('button',{name:'Calcular',exact:true})).toBeDisabled()
 await app.evaluate(()=>Reflect.get(globalThis,'describeLegacyRelease')?.())
 await expect(advanced.getByRole('status')).toHaveText('Análisis completo.')
 await expect(panel.getByRole('button',{name:'Calcular',exact:true})).toBeEnabled()
 expect(await readFile(path,'utf8')).toBe(source)
})

test('AN-2 Información presenta dimensiones, tipos y calidad con distintos sin vacíos',async()=>{
 await openAnalysis(page,'Información')
 const panel=page.getByRole('region',{name:'Vista general de columnas',exact:true})
 await expect(panel.getByRole('button',{name:'Obtener información',exact:true})).toBeEnabled()
 await panel.getByRole('button',{name:'Obtener información',exact:true}).click()
 await expect(panel.locator('.file-summary')).toContainText('6 filas × 5 columnas')
 await expect(panel.locator('.file-summary')).toContainText('UTF-8')
 await expect(panel.locator('.type-chips')).toContainText('2 numéricas')
 await expect(panel.locator('.type-chips')).toContainText('1 fecha')
 await expect(panel.locator('.type-chips')).toContainText('1 categórica')
 await expect(panel.locator('.type-chips')).toContainText('1 mixta')
 await expect(panel.locator('thead th')).toHaveText(['#','Columna','Tipo probable','Con contenido','Vacíos','Distintos','Detalle'])
 const mixed=panel.locator('tbody tr').nth(4)
 await expect(mixed.locator('td').nth(2)).toHaveText('3')
 await expect(mixed.locator('td').nth(3).locator('summary')).toHaveText('3 · 50 %')
 await expect(mixed.locator('td').nth(4).locator('summary')).toHaveText('2')
 await expect(mixed.locator('.quality-breakdown>summary')).toHaveAccessibleName('3 · 50 % · Desglose de vacíos de Mixta');await expect(mixed.locator('.distinct-detail>summary')).toHaveAccessibleName('2 · Detalle de valores distintos sin vacíos de Mixta')
 expect(await readFile(path,'utf8')).toBe(source)
})

test('AN-2 cancelar conserva la fuente y permite pasar a la vista avanzada sin respuestas tardías',async()=>{
 await spy('profile');await openAnalysis(page,'Estadísticas')
 const panel=page.getByRole('region',{name:'Resumen estadístico',exact:true}),advanced=page.locator('.advanced-statistics')
 await panel.getByRole('button',{name:'Calcular',exact:true}).click();await expect.poll(()=>app.evaluate(()=>Reflect.get(globalThis,'describeHeld'))).toBe(true)
 await advanced.locator(':scope>summary').click()
 await expect(advanced.getByRole('button',{name:'Analizar',exact:true})).toBeDisabled()
 await expect(panel.getByRole('button',{name:'Cancelar cálculo',exact:true})).toBeEnabled()
 await panel.getByRole('button',{name:'Cancelar cálculo',exact:true}).click();await release()
 await expect(panel.getByRole('status')).toHaveText('Cálculo cancelado.')
 await expect(advanced.getByRole('button',{name:'Analizar',exact:true})).toBeEnabled()
 await expect(panel.getByRole('table')).toHaveCount(0)
 expect((await calls()).filter(call=>call.operation==='stats')).toEqual([])
 expect(await readFile(path,'utf8')).toBe(source)
})

test('AN-2 entrar en el explorador cancela describe pendiente antes de activar el otro análisis',async()=>{
 await spy('profile');await openAnalysis(page,'Estadísticas')
 const panel=page.getByRole('region',{name:'Resumen estadístico',exact:true}),advanced=page.locator('.advanced-statistics')
 await panel.getByRole('button',{name:'Calcular',exact:true}).click();await expect.poll(()=>app.evaluate(()=>Reflect.get(globalThis,'describeHeld'))).toBe(true)
 await advanced.locator(':scope>summary').click();await advanced.getByText('Explorar una columna: frecuencias, calidad y distribución',{exact:true}).click()
 await expect(page.locator('.describe-panel [role=status]')).toHaveText('Cálculo cancelado.')
 const explorer=page.getByRole('region',{name:'Exploración de columna',exact:true})
 await explorer.getByRole('button',{name:'Explorar columna',exact:true}).click();await expect(explorer.getByRole('status')).toHaveText('Exploración completa.')
 await release()
 const operations=(await calls()).map(call=>call.operation);expect(operations.indexOf('cancelAnalysis')).toBeGreaterThanOrEqual(0);expect(operations.indexOf('cancelAnalysis')).toBeLessThan(operations.lastIndexOf('analyzeColumn'))
 expect(await readFile(path,'utf8')).toBe(source)
})

test('AN-2 descarta la respuesta anterior cuando cambia la revisión y recalcula con los valores actuales',async()=>{
 await spy('stats');await openAnalysis(page,'Estadísticas')
 const panel=page.getByRole('region',{name:'Resumen estadístico',exact:true})
 await panel.getByRole('button',{name:'Calcular',exact:true}).click();await expect.poll(()=>app.evaluate(()=>Reflect.get(globalThis,'describeHeld'))).toBe(true)
 await showTable(page);await page.getByRole('gridcell',{name:'Fila 1, Precio',exact:true}).dblclick();await page.getByLabel('Editar celda',{exact:true}).fill('20');await page.getByLabel('Editar celda',{exact:true}).press('Enter')
 await openAnalysis(page,'Estadísticas');await release()
 await expect(panel.getByRole('table')).toHaveCount(0)
 await panel.getByRole('button',{name:'Calcular',exact:true}).click()
 await expect(panel.locator('tbody tr').nth(1).locator('td').first()).toHaveText('32')
 await expect(panel.locator('caption')).toContainText('Revisión 1')
 expect(await readFile(path,'utf8')).toBe(source)
})


test('AN-2 la paleta describe abre estadísticas sin empezar a calcular',async()=>{
 await spy();const palette=await openCsvCommands(page,app),search=palette.getByRole('searchbox',{name:'Buscar comando CSV',exact:true});await search.fill('describe')
 expect(await palette.getByRole('button',{name:/^Resumen estadístico describe:/}).count()).toBe(1);await search.press('Enter')
 await expect(page.getByRole('region',{name:'Resumen estadístico',exact:true})).toBeVisible();expect(await calls()).toEqual([])
})


test('AN-2 describe conserva el ámbito filtrado, el informe y las columnas marcadas',async()=>{
 await page.getByLabel('Buscar en tabla',{exact:true}).fill('a');await expect(page.locator('footer')).toContainText('4 de 6 filas')
 await openAnalysis(page,'Estadísticas');const panel=page.getByRole('region',{name:'Resumen estadístico',exact:true})
 await panel.getByLabel('Alcance de las estadísticas',{exact:true}).selectOption('view');await panel.getByRole('button',{name:'Calcular',exact:true}).click()
 await expect(panel.locator('tbody tr').nth(0).locator('td')).toHaveText(['3','2','2']);await expect(panel.locator('tbody tr').nth(1).locator('td')).toHaveText(['30','2','1'])
 await panel.getByRole('button',{name:'Abrir informe Markdown',exact:true}).click();const report=(await page.evaluate(()=>window.freya.documents())).find(doc=>doc.kind==='markdown')!
 expect(report.text).toContain('"Vista filtrada"');expect(report.text).toContain('"search": "a"');expect(report.text).not.toContain('Rango de la vista');expect(report.text).toContain('| std | 20 | 1.4142135623730951 | 0 |')
 await page.getByRole('tab',{name:'Análisis de datos.csv',exact:true}).click();await showTable(page)
 await page.getByLabel('Buscar en tabla',{exact:true}).fill('b');await expect(page.locator('footer')).toContainText('1 de 6 filas');await openAnalysis(page,'Estadísticas')
 await expect(panel.getByRole('table')).toHaveCount(0);await panel.getByRole('button',{name:'Calcular',exact:true}).click();await expect(panel.locator('tbody tr').nth(0).locator('td')).toHaveText(['1','1']);await expect(panel.locator('tbody tr').nth(1).locator('td')).toHaveText(['20','2']);await expect(panel.locator('tbody tr').nth(2).locator('td')).toHaveText(['',''])
 await showTable(page);await page.getByLabel('Seleccionar columna Precio',{exact:true}).check();await openAnalysis(page,'Estadísticas');await panel.getByLabel('Alcance de las estadísticas',{exact:true}).selectOption('selected');await panel.getByRole('button',{name:'Calcular',exact:true}).click()
 await expect(panel.locator('thead th>span')).toHaveText(['Precio']);await expect(panel.locator('tbody tr').nth(0).locator('td')).toHaveText(['5']);await expect(panel.locator('caption')).toContainText('Columnas marcadas');expect(await readFile(path,'utf8')).toBe(source)
})

for(const language of ['es','en-XA'] as const)test(`AN-2 cien columnas y teclado conservan la tabla accesible sin desbordamiento (${language})`,async()=>{
 const tr=(key:string)=>t(key,{},language),wide=join(folder,'cien.csv'),text=Array.from({length:100},(_,i)=>'Campo '+i).join(',')+'\n'+Array.from({length:250},(_,row)=>Array.from({length:100},(_,col)=>String(row+col)).join(',')).join('\n')+'\n'
 await writeFile(wide,text);await page.evaluate(path=>window.freya.openPaths([path]),wide);await openAnalysis(page,'Estadísticas');const panel=page.getByRole('region',{name:tr('describe.title'),exact:true}),button=panel.getByRole('button',{name:tr('describe.calculate'),exact:true})
 await expect(button).toBeEnabled();await button.focus();await button.press('Enter');await expect(panel.getByRole('status')).toHaveText(tr('describe.complete'));await expect(panel.locator('thead th')).toHaveCount(101);await expect(panel.locator('tbody tr')).toHaveCount(8)
 await expect(panel.getByRole('columnheader',{name:/Campo 0/})).toHaveAttribute('scope','col');await expect(panel.getByRole('rowheader',{name:/std/})).toHaveAttribute('scope','row');await expect(panel.getByRole('rowheader',{name:/std/})).toHaveAccessibleName('std · '+tr('describe.help.std'))
 const scroller=panel.getByRole('region',{name:tr('describe.results'),exact:true});await scroller.focus();await scroller.press('ArrowRight');await expect.poll(()=>scroller.evaluate(node=>node.scrollLeft)).toBeGreaterThan(0)
 const sticky=await panel.locator('tbody th').first().boundingBox(),box=await scroller.boundingBox();expect(Math.abs(sticky!.x-box!.x)).toBeLessThan(2);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 for(const theme of ['light','dark']){await page.getByLabel('Tema',{exact:true}).selectOption(theme);await expect.poll(()=>page.locator('html').evaluate(node=>node.classList.contains('dark'))).toBe(theme==='dark');await scroller.evaluate(node=>node.scrollLeft=0);await page.mouse.move(0,0);await page.screenshot({animations:'disabled',path:test.info().outputPath(`an2-describe-100-${language}-${theme}-1440x900.png`)})}
 await page.emulateMedia({forcedColors:'active'});await button.focus();await expect(button).toBeFocused();await expect(panel.getByRole('table')).toBeVisible();await page.emulateMedia({forcedColors:'none'})
 await openAnalysis(page,'Información');const info=page.getByRole('region',{name:tr('info.title'),exact:true}),infoButton=info.getByRole('button',{name:tr('info.calculate'),exact:true});await expect(infoButton).toBeEnabled();await infoButton.focus();await infoButton.press('Enter');await expect(info.getByRole('status')).toHaveText(tr('info.complete'));await expect(info.locator('tbody tr')).toHaveCount(50)
 for(const theme of ['light','dark']){await page.getByLabel('Tema',{exact:true}).selectOption(theme);await expect.poll(()=>page.locator('html').evaluate(node=>node.classList.contains('dark'))).toBe(theme==='dark');await page.mouse.move(0,0);await page.screenshot({animations:'disabled',path:test.info().outputPath(`an2-info-100-${language}-${theme}-1440x900.png`)})}
 expect(await readFile(wide,'utf8')).toBe(text)
})

test('AN-2 ciento veinte columnas se rechazan antes de consultar y conservan el archivo',async()=>{
 const wide=join(folder,'limite.csv'),text=Array.from({length:120},(_,i)=>'C'+i).join(',')+'\n'+Array(120).fill('1').join(',')+'\n';await writeFile(wide,text);await page.evaluate(path=>window.freya.openPaths([path]),wide);await spy();await openAnalysis(page,'Estadísticas')
 await page.getByRole('button',{name:'Calcular',exact:true}).click();await expect(page.locator('.toast[role=status]')).toContainText('100 columnas');expect(await calls()).toEqual([]);expect(await readFile(wide,'utf8')).toBe(text)
})


test('AN-2 la cardinalidad textual no disponible no elimina las estadísticas numéricas exactas',async()=>{
 const file=join(folder,'muchos-distintos.csv'),text='Medida,Texto\n'+Array.from({length:100001},(_,i)=>i+',valor-'+i).join('\n')+'\n';await writeFile(file,text);await page.evaluate(path=>window.freya.openPaths([path]),file);await spy();await openAnalysis(page,'Estadísticas')
 const panel=page.getByRole('region',{name:'Resumen estadístico',exact:true});await panel.getByRole('checkbox',{name:'Incluir texto y fechas',exact:true}).check();await panel.getByRole('button',{name:'Calcular',exact:true}).click();await expect(panel.getByRole('status')).toHaveText('Resumen parcial: algunas columnas no tienen un resumen exacto disponible.');await expect(panel.locator('tbody tr').nth(4).locator('td')).toHaveText(['50,000','']);await expect(panel.locator('thead th').last()).toContainText('No disponible');expect(await calls()).toHaveLength(4);expect(await readFile(file,'utf8')).toBe(text)
})

// Casos de revisión: la fuente y el presupuesto vienen del motor, no de readonly ni del número de llamadas.
test('AN-2 revisión: una muestra conserva su ámbito en selector, caption e informe',async()=>{
 const file=join(folder,'muestra.csv'),text='Precio\n'+'2\n'.repeat(250)+'x'.repeat(1024*1024+1)+'\n';await writeFile(file,text)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),file);expect(doc).toMatchObject({readonly:true,rowCount:200});expect(doc.large).not.toBe(true)
 await openAnalysis(page,'Estadísticas');const panel=page.getByRole('region',{name:'Resumen estadístico',exact:true}),scope=panel.getByLabel('Alcance de las estadísticas',{exact:true})
 await expect(panel.getByRole('button',{name:'Calcular',exact:true})).toBeEnabled()
 expect.soft(await scope.locator('option[value=all]').textContent()).toBe('Todos los registros de la muestra');expect.soft(await scope.locator('option[value=view]').textContent()).toBe('Vista filtrada de la muestra')
 for(const [value,label] of [['all','Todos los registros de la muestra'],['view','Vista filtrada de la muestra']]){
  await scope.selectOption(value);await panel.getByRole('button',{name:'Calcular',exact:true}).click();await expect(panel.getByRole('status')).toHaveText('Resumen calculado.')
  expect.soft(await panel.locator('caption').textContent()).toContain(label);expect.soft(await panel.locator('caption').textContent()).not.toContain('Documento completo')
  await expect(panel.locator('tbody tr').first().locator('td')).toHaveText('200');await panel.getByRole('button',{name:'Abrir informe Markdown',exact:true}).click()
  const report=(await page.evaluate(()=>window.freya.documents())).filter(doc=>doc.kind==='markdown').at(-1)!.text!
  expect.soft(report).toContain('MUESTRA LIMITADA');expect.soft(report).toContain(JSON.stringify(label));expect.soft(report).not.toContain('Documento completo')
  await page.getByRole('tab',{name:'Análisis de muestra.csv',exact:true}).click()
 }
 expect(await readFile(file,'utf8')).toBe(text)
})

test('AN-2 revisión: std de un valor y top/freq de fecha se presentan vacíos',async()=>{
 const file=join(folder,'una-fecha.csv'),text='Precio,Alta,Vacía\n7,2026-02-01,\n';await writeFile(file,text);await page.evaluate(path=>window.freya.openPaths([path]),file);await openAnalysis(page,'Estadísticas')
 const panel=page.getByRole('region',{name:'Resumen estadístico',exact:true});await panel.getByRole('checkbox',{name:'Incluir texto y fechas',exact:true}).check();await panel.getByRole('button',{name:'Calcular',exact:true}).click();await expect(panel.getByRole('status')).toHaveText('Resumen calculado.');await expect(panel.locator('tbody tr')).toHaveCount(11)
 expect.soft(await panel.locator('tbody tr').nth(0).locator('td').allTextContents()).toEqual(['1','1','0'])
 for(const row of [2,3,5])expect.soft(await panel.locator('tbody tr').nth(row).locator('td').allTextContents()).toEqual(['','',''])
 await panel.getByRole('button',{name:'Abrir informe Markdown',exact:true}).click();const report=(await page.evaluate(()=>window.freya.documents())).filter(doc=>doc.kind==='markdown').at(-1)!.text!
 expect.soft(report).toContain('| std |  |  |  |');expect.soft(report).toContain('| top |  |  |  |');expect.soft(report).not.toContain('—');expect(await readFile(file,'utf8')).toBe(text)
})

test('AN-2 revisión: el presupuesto agregado incluye posiciones ausentes antes de consultar',async()=>{
 const file=join(folder,'posiciones.csv'),text=Array.from({length:100},(_,i)=>'Campo '+i).join(',')+'\n'+'1\n'.repeat(20001);await writeFile(file,text);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),file);expect(doc).toMatchObject({readonly:false,rowCount:20001});await spy();await openAnalysis(page,'Estadísticas')
 await page.getByRole('button',{name:'Calcular',exact:true}).click();await expect(page.locator('.toast[role=status]>span')).toHaveText(t('info.error.cells'))
 expect(await calls()).toEqual([]);expect(await readFile(file,'utf8')).toBe(text)
})


for(const language of ['es','en','en-XA'] as const)test(`Información: distintos sin vacíos conserva repeticiones y el archivo (${language})`,async()=>{
 const tr=(key:string,parameters:Record<string,string|number>={})=>t(key,parameters,language)
 await openAnalysis(page,'Información');const panel=page.getByRole('region',{name:tr('info.title'),exact:true})
 await panel.getByRole('button',{name:tr('info.calculate'),exact:true}).click();await expect(panel.getByRole('status')).toHaveText(tr('info.complete'))
 const mixed=panel.locator('tbody tr').nth(4),detail=mixed.locator('.distinct-detail')
 await expect(detail.locator('summary')).toHaveText('2');await expect(detail.locator('summary')).toHaveAccessibleName('2 · '+tr('info.distinctHelp',{name:'Mixta'}))
 await detail.locator('summary').focus();await detail.locator('summary').press('Enter')
 await expect(detail.locator('p').first()).toHaveText(tr('info.distinctExplanation'))
 await expect(detail.locator('p').nth(1)).toHaveText(tr('info.repetitions',{count:'3'}))
 await panel.getByRole('button',{name:tr('info.report'),exact:true}).click()
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).filter(doc=>doc.kind==='markdown').at(-1)?.text).toContain(tr('info.report.unique'))
 const report=(await page.evaluate(()=>window.freya.documents())).filter(doc=>doc.kind==='markdown').at(-1)!.text!
 expect(report).toContain(tr('info.report.unique'));expect(report).toContain(tr('info.report.repetitions'))
 expect(report.split('\n').find(line=>line.includes('5. Mixta'))).toContain('| 6 | 3 | 0 | 3 | 0 | 2 | 3 |')
 expect(await readFile(path,'utf8')).toBe(source)
})
