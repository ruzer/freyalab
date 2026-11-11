import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t} from '../../src/shared/i18n'
import {runApplicationMenu} from './application-menu'
import {closeElectron} from './close-electron'

let app:ElectronApplication,page:Page,folder:string
const source='Grupo,Valor\nA,10\nA,20\nB,80\n'
const tablist=()=>page.getByRole('tablist',{name:'Documentos abiertos',exact:true})
const tab=(name='datos.csv')=>tablist().getByRole('tab',{name:'Análisis de '+name,exact:true})
const analysis=()=>page.locator('.analysis-workspace:not([hidden])')
const button=(name:string)=>analysis().getByRole('button',{name,exact:true})
const section=(name:string)=>analysis().getByRole('group',{name:'Secciones de análisis',exact:true}).getByRole('button',{name,exact:true})

async function launch(language='es'){
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve(process.env.FREYALAB_AN1_ENTRY??'out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:language,FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports'),FREYALAB_LARGE_BYTES:'2048'},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
}
async function quit(){await closeElectron(app)}
test.beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-analysis-tab-'));await mkdir(join(folder,'exports'));await launch()})
test.afterEach(async()=>{await quit();await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function open(name='datos.csv',text=source){
 const path=join(folder,name);await writeFile(path,text)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
 return {doc,path}
}
async function openAnalysis(){
 await page.getByRole('button',{name:'Analizar',exact:true}).click()
 await expect(analysis()).toBeVisible()
}
async function changeFirstValue(value:string){
 const cell=page.getByRole('gridcell',{name:'Fila 1, Valor',exact:true})
 await cell.dblclick();const input=cell.getByRole('textbox')
 await input.fill(value);await input.press('Enter')
 await expect(cell).toHaveText(value)
}
async function spy(hold=false){
 await app.evaluate(({ipcMain},hold)=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers
  const original=handlers.get('freya')!
  const calls:string[]=[];Reflect.set(globalThis,'freyaAnalysisTabCalls',calls)
  let release:(()=>void)|undefined
  handlers.set('freya',async(event,...args)=>{
   const operation=String(args[0])
   if(['analyzeColumn','stats','sqlRun','cancelAnalysis','sqlCancel','save'].includes(operation))calls.push(operation)
   if(hold&&operation==='stats'){
    const response=await original(event,...args)
    await new Promise<void>(resolve=>{release=resolve});return response
   }
   if(operation==='cancelAnalysis')release?.()
   return original(event,...args)
  })
 },hold)
}
const calls=()=>app.evaluate(()=>Reflect.get(globalThis,'freyaAnalysisTabCalls') as string[])

test('AN-1a abre una pestaña única, enfoca su sección y solo calcula por petición',async()=>{
 await spy()
 const {path}=await open()
 await page.getByRole('grid',{name:'Tabla de datos'}).evaluate(grid=>{grid.scrollTop=grid.scrollHeight})
 await changeFirstValue('11')
 await page.getByRole('button',{name:'Guardar',exact:true}).click()
 await expect.poll(()=>readFile(path,'utf8')).toContain('A,11')
 expect(await calls()).toEqual(['save'])
 await openAnalysis()
 await expect(tab()).toHaveAttribute('aria-selected','true')
 await expect(analysis().getByRole('heading',{name:'Información',exact:true})).toBeFocused()
 expect((await tablist().getByRole('tab').allTextContents()).map(value=>value.trim())).toEqual(['datos.csv','Análisis · datos.csv'])
 await section('Estadísticas').click();await expect(button('Analizar')).toBeVisible()
 await section('SQL').click();await expect(button('Ejecutar consulta')).toBeVisible()
 await section('Información').click();await expect(button('Explorar columnas')).toBeVisible()
 expect(await calls()).toEqual(['save'])
 await button('Ir al CSV').click();await openAnalysis();await expect(tab()).toHaveCount(1)
 for(const name of ['Guardar','Deshacer','Rehacer','Exportar'])await expect(page.locator('.toolbar').getByRole('button',{name,exact:true})).toBeDisabled()
 await expect.poll(()=>app.evaluate(({Menu})=>['file.save','file.saveAs','file.exports'].every(id=>Menu.getApplicationMenu()?.getMenuItemById(id)?.enabled===false))).toBe(true)
 await page.keyboard.press('ControlOrMeta+s');expect(await calls()).toEqual(['save'])
 await runApplicationMenu(app,'file.close');await expect(tab()).toHaveCount(0)
 await expect(tablist().getByRole('tab',{name:'datos.csv',exact:true})).toHaveAttribute('aria-selected','true')
})

test('AN-1a gráficos perfila campos y dibuja solo al elegir; conserva y exporta la configuración',async()=>{
 await spy()
 const {path}=await open()
 await openAnalysis();await section('Gráficos').click()
 const panel=analysis().locator('.charts-panel'),suggestion=panel.getByRole('button',{name:/^Crear:/})
 await expect(suggestion).toBeEnabled();expect(await calls()).toContain('analyzeColumn');expect(await calls()).not.toContain('sqlRun')
 await expect(panel.locator('.pivot-result')).toHaveCount(0)
 await suggestion.click();await expect(panel.locator('.pivot-result tfoot')).toContainText('110')
 await panel.getByLabel('Resumir Valor por',{exact:true}).selectOption('average')
 await expect(panel.locator('.pivot-result tfoot')).toContainText('36.666')
 await expect(analysis().locator('header').getByText('Exportar resultados del análisis',{exact:true})).toBeVisible()
 await panel.locator('.more-options>summary').click();await panel.getByText('Configuraciones guardadas',{exact:true}).click()
 await panel.getByLabel('Nombre de configuración del gráfico').fill('Mi gráfico')
 await panel.getByRole('button',{name:'Guardar configuración',exact:true}).click()
 await expect(panel.locator('option').filter({hasText:'Mi gráfico'})).toHaveCount(1)
 expect(await readFile(path,'utf8')).toBe(source)
 await quit();await launch()
 await expect(tablist().getByRole('tab',{name:/Análisis de/})).toHaveCount(0)
 await page.evaluate(path=>window.freya.openPaths([path]),path)
 await openAnalysis();await section('Gráficos').click()
 const reopened=analysis().locator('.charts-panel')
 await reopened.locator('.more-options>summary').click();await reopened.getByText('Configuraciones guardadas',{exact:true}).click()
 await expect(reopened.locator('option').filter({hasText:'Mi gráfico'})).toHaveCount(1)
})

test('AN-1a reutiliza filtros, columnas y rango de la tabla e invalida los resultados al editar',async()=>{
 await open()
 await page.getByLabel('Buscar en tabla',{exact:true}).fill('A')
 await expect(page.locator('.statusbar')).toContainText('2 de 3 filas')
 await page.getByLabel('Seleccionar columna Valor',{exact:true}).check()
 await page.getByRole('gridcell',{name:'Fila 1, Valor',exact:true}).click()
 await page.getByRole('gridcell',{name:'Fila 2, Valor',exact:true}).click({modifiers:['Shift']})
 await openAnalysis()
 await analysis().getByLabel('Alcance de la vista general',{exact:true}).selectOption('view')
 await analysis().getByLabel('Columnas para explorar',{exact:true}).selectOption('selected')
 await button('Explorar columnas').click()
 await expect(analysis().locator('.scope')).toContainText('2 filas por columna')
 await expect(analysis().locator('tbody tr')).toHaveCount(1)
 await section('Estadísticas').click()
 const explorerToggle=analysis().getByText('Explorar una columna: frecuencias, calidad y distribución',{exact:true})
 await explorerToggle.click()
 const explorer=analysis().getByRole('region',{name:'Exploración de columna',exact:true})
 await explorer.getByLabel('Columna para explorar',{exact:true}).selectOption('1')
 await explorer.getByLabel('Filas para explorar',{exact:true}).selectOption('view')
 await explorer.getByRole('button',{name:'Explorar columna',exact:true}).click()
 await expect(explorer.locator('.scope')).toContainText('Vista filtrada · 2 filas')
 await analysis().getByText('Volver a estadísticas generales',{exact:true}).click()
 await analysis().getByLabel('Columnas para estadísticas',{exact:true}).selectOption('range')
 await button('Analizar').click()
 await expect(analysis().getByRole('region',{name:'Resultados de estadísticas'})).toContainText('30')
 await analysis().getByLabel('Columnas para estadísticas',{exact:true}).selectOption('selected')
 await button('Analizar').click()
 await expect(analysis().getByRole('region',{name:'Resultados de estadísticas'})).toContainText('110')
 await button('Ir al CSV').click();await changeFirstValue('30')
 await tab().click()
 await expect(analysis().getByRole('status')).toContainText('Los datos cambiaron')
 await button('Analizar').click()
 await expect(analysis().getByRole('region',{name:'Resultados de estadísticas'})).toContainText('130')
})

test('AN-1a cancelar análisis no modifica el CSV y cerrar un CSV solo elimina su propio análisis',async()=>{
 await spy(true)
 const {path}=await open()
 await openAnalysis();await section('Estadísticas').click();await button('Analizar').click()
 await expect.poll(calls).toContain('stats')
 await page.getByRole('button',{name:'Cerrar análisis de datos.csv',exact:true}).click()
 await expect.poll(calls).toContain('cancelAnalysis')
 expect(await readFile(path,'utf8')).toBe(source)
 await openAnalysis()
 await open('otro.csv');await openAnalysis()
 await tablist().getByRole('tab',{name:'datos.csv',exact:true}).click();await changeFirstValue('99')
 await app.evaluate(({dialog})=>{
  const responses=[1,2]
  dialog.showMessageBox=(async()=>({response:responses.shift()!,checkboxChecked:false})) as typeof dialog.showMessageBox
 })
 await page.getByRole('button',{name:'Cerrar datos.csv',exact:true}).click()
 await expect(tab()).toBeVisible()
 await page.getByRole('button',{name:'Cerrar datos.csv',exact:true}).click()
 await expect(tab()).toHaveCount(0);await expect(tab('otro.csv')).toBeVisible()
 expect(await readFile(path,'utf8')).toBe(source)
})

test('AN-1a archivo grande abre análisis manual y conserva SQL',async()=>{
 const {doc}=await open('grande.csv','Grupo,Valor\n'+Array.from({length:600},(_,index)=>'A,'+index).join('\n')+'\n')
 expect(doc.large).toBe(true)
 await spy()
 await openAnalysis()
 await expect(section('Información')).toBeDisabled();await expect(section('Estadísticas')).toBeDisabled()
 await expect(section('Información')).toHaveAccessibleDescription(/fase posterior/)
 const panel=analysis().locator('.charts-panel')
 await expect(panel.getByRole('button',{name:/^Crear:/})).toBeEnabled()
 await panel.getByRole('button',{name:/^Crear:/}).click()
 expect(await calls()).not.toContain('sqlRun')
 await panel.getByRole('button',{name:'Generar gráfico',exact:true}).click()
 await expect(panel.locator('.pivot-result')).toBeVisible()
 await section('SQL').click();await button('Ejecutar consulta').click()
 await expect(analysis().locator('.sql-panel tbody tr').first()).toBeVisible()
})

test('AN-1a paleta y pestañas con teclado, Escape conserva la pestaña y capturas de idiomas',async()=>{
 const {path}=await open()
 await runApplicationMenu(app,'edit.commandPalette')
 const search=page.getByRole('searchbox',{name:'Buscar comando CSV',exact:true})
 await search.fill('describe');await search.press('Enter')
 await expect(analysis().getByRole('heading',{name:'Información',exact:true})).toBeFocused()
 await tab().focus();await page.keyboard.press('ArrowLeft')
 const csv=tablist().getByRole('tab',{name:'datos.csv',exact:true})
 await expect(csv).toBeFocused();await page.keyboard.press('ArrowRight');await expect(tab()).toBeFocused()
 await section('SQL').focus();await page.keyboard.press('Enter')
 await expect(analysis().getByRole('heading',{name:'SQL',exact:true})).toBeFocused()
 await page.keyboard.press('Escape');await expect(tab()).toBeVisible()
 await button('Ir al CSV').focus();await page.keyboard.press('Enter');await expect(csv).toHaveAttribute('aria-selected','true');await expect(csv).toBeFocused()
 if(process.env.FREYALAB_AN1_EVIDENCE!=='1')return
 for(const language of ['es','en-XA'] as const){
  if(language==='en-XA'){await quit();await launch(language);await page.evaluate(path=>window.freya.openPaths([path]),path)}
  await page.getByRole('button',{name:t('analysis.tab.open',{},language),exact:true}).click()
  for(const [width,height] of [[1440,900],[900,900]])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height});await page.getByLabel('Tema',{exact:true}).selectOption(theme)
   expect(await analysis().evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true)
   expect(await page.locator('.document-title strong').evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true)
   await page.screenshot({animations:'disabled',path:test.info().outputPath(`an1a-${language}-${theme}-${width}x${height}.png`)})
  }
  await analysis().getByRole('button',{name:t('analysis.tab.return',{},language),exact:true}).click()
 }
})


test('AN-1b ignora la disposición antigua del panel al abrir un perfil existente',async()=>{
 const previous={version:1,dock:{visible:true,width:1800,tab:'sql'}}
 await page.evaluate(previous=>{localStorage.setItem('freya-workspace',JSON.stringify(previous));localStorage.setItem('an1b-preferencia-ajena','conservar')},previous)
 await closeElectron(app,()=>app.evaluate(async({session,app})=>{await session.defaultSession.flushStorageData();app.exit(0)}))
 await launch()
 await page.setViewportSize({width:1920,height:1080})
 await open()
 await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
 await expect(page.locator('.analysis-dock')).toHaveCount(0)
 await expect(tab()).toHaveCount(0)
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('freya-workspace')!))).toEqual(previous)
 expect(await page.evaluate(()=>localStorage.getItem('an1b-preferencia-ajena'))).toBe('conservar')
})
