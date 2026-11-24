import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t,type Language} from '../../src/shared/i18n'
import type {DocumentInfo} from '../../src/shared/types'
import {defaultSettings} from '../../src/shared/settings'
import {closeElectron} from './close-electron'
import {traceElectronFailure} from './electron-trace'
import {runApplicationMenu} from './application-menu'
import {openAnalysis,selectAnalysis,showPanel,chartAssign,chartAggregate,chartType,chartPanel,waitChartResult,exportAnalysis,analysisResultExport} from './panel'

const precise='5.52264150943',small='0.0004123'
const futureSettings='{"version":99,"futureOnly":"CONSERVAR_ESTE_ARCHIVO_SINTETICO"}\n'
const source='\uFEFFID,Grupo,Valor,Pequeño,Entero,Flotante\r\n'+[
 `00123,A,${precise},${small},12,0.1`,
 `9007199254740993,A,${precise},${small},12,0.2`,
 `00003,B,${precise},${small},12,`,
 `00004,B,${precise},${small},12,`,
].join('\r\n')+'\r\n'
let app:ElectronApplication,page:Page,folder:string,path:string,doc:DocumentInfo,language:Language,stopTrace:(()=>Promise<void>)|undefined
const tr=(key:string,parameters:Record<string,string|number>={})=>t(key,parameters,language)
const workspace=()=>page.locator('.analysis-workspace:not([hidden])')
const decimalSelect=()=>workspace().getByRole('combobox',{name:language==='es'?'Decimales':tr('analysis.decimals.label'),exact:true})
const describe=()=>workspace().locator('.describe-panel')

async function launch(){
 const {ELECTRON_RUN_AS_NODE:_,FREYALAB_TEST_OPEN:__,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:language,FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')}})
 page=await app.firstWindow();stopTrace=await traceElectronFailure(page.context(),test.info());await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
}
async function open(){
 const [opened]=await page.evaluate(path=>window.freya.openPaths([path]),path);doc=opened
 await expect(page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})).toHaveText('00123')
 await expect(page.getByRole('tab',{name:'precision.csv',exact:true})).toHaveAttribute('aria-selected','true')
}
test.beforeEach(async()=>{
 language=(test.info().title.match(/\((es|en|en-XA)\)$/)?.[1]??'es') as Language
 stopTrace=undefined;folder=await mkdtemp(join(tmpdir(),'freya-sim3d-decimals-'));await mkdir(join(folder,'exports'));path=join(folder,'precision.csv');await writeFile(path,source)
 if(test.info().title.includes('ajustes v1')){
  const legacy=defaultSettings();Reflect.deleteProperty(legacy,'decimalesAnalisis');legacy.tema='dark';legacy.barraLateral.ancho=311.5
  await mkdir(join(folder,'profile'));await writeFile(join(folder,'profile','settings.json'),JSON.stringify(legacy)+'\n')
 }else if(test.info().title.includes('versión futura')){
  await mkdir(join(folder,'profile'));await writeFile(join(folder,'profile','settings.json'),futureSettings)
 }
 await launch();await open()
})
test.afterEach(async()=>{
 try{
  expect(await readFile(path,'utf8')).toBe(source)
  const current=(await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)
  expect(current).toEqual(doc)
 }finally{
  try{
   await app.evaluate(({ipcMain})=>{const state=Reflect.get(globalThis,'sim3dDecimalCompute');if(state){(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,unknown>})._invokeHandlers.set('freya',state.original);Reflect.deleteProperty(globalThis,'sim3dDecimalCompute')}})
   await app.evaluate(async({clipboard})=>{const saved=Reflect.get(globalThis,'sim3dDecimalsClipboard') as import('electron').ClipboardItem[]|undefined;if(saved){if(saved.length)await clipboard.write(saved);else clipboard.clear();Reflect.deleteProperty(globalThis,'sim3dDecimalsClipboard')}})
  }finally{try{await stopTrace?.()}finally{try{await closeElectron(app)}finally{if(folder)await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}}
 }
})
async function calculateDescribe(){
 await openAnalysis(page,'Estadísticas')
 await describe().getByRole('button',{name:tr('describe.calculate'),exact:true}).click()
 await expect(describe().getByRole('status')).toHaveText(tr('describe.complete'))
 await expect(describe().getByRole('table')).toBeVisible()
}
async function metric(metric:string,column:string){
 const headers=await describe().locator('thead th>span').allTextContents(),index=headers.indexOf(column)
 expect(index,`columna ${column} en el resumen`).toBeGreaterThanOrEqual(0)
 return describe().locator('tbody tr').filter({has:page.getByText(tr('describe.metric.'+metric),{exact:true})}).locator('td').nth(index)
}
async function preserveClipboard(){
 // Todos los formatos originales quedan únicamente en memoria de main.
 await app.evaluate(async({clipboard,ClipboardItem})=>{
  const items=(await clipboard.read()).filter(item=>item.types.length)
  const saved=await Promise.all(items.map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))))
  if(saved.length)await clipboard.write(saved);Reflect.set(globalThis,'sim3dDecimalsClipboard',saved)
 })
}
async function selectPart(cell:Locator,characters?:number){
 await cell.click()
 return cell.evaluate((node,characters)=>{
  const text=document.createTreeWalker(node,NodeFilter.SHOW_TEXT).nextNode();if(!text)throw new Error('La celda numérica no tiene texto.')
  const range=document.createRange();range.setStart(text,0);range.setEnd(text,characters??text.textContent!.length)
  const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);return selection.toString()
 },characters)
}
async function selectionState(){return page.evaluate(()=>{
 const selection=window.getSelection()!
 return{text:selection.toString(),ranges:selection.rangeCount,anchorText:selection.anchorNode?.textContent,anchorOffset:selection.anchorOffset,focusText:selection.focusNode?.textContent,focusOffset:selection.focusOffset}
})}
async function nativeCopy(){
 const sentinel='SIM3d-decimales pendiente'
 await app.evaluate(({clipboard},value)=>clipboard.writeText(value),sentinel)
 await page.keyboard.press('ControlOrMeta+C')
 await expect.poll(()=>app.evaluate(({clipboard})=>clipboard.readText())).not.toBe(sentinel)
 return app.evaluate(({clipboard})=>clipboard.readText())
}

test('SIM-3d decimales: selector global accesible con opciones Automático y Más precisión (es)',async()=>{
 await openAnalysis(page,'Información')
 await expect(decimalSelect()).toBeVisible();await expect(decimalSelect()).toHaveValue('auto')
 await expect(decimalSelect().locator('option')).toHaveText(['Automático','Más precisión'])
 await expect(workspace().getByText('Al copiar se copia el valor completo.',{exact:true})).toBeVisible()
})

test('SIM-3d decimales: pequeños no nulos siguen visibles en Estadísticas principal (es)',async()=>{
 await calculateDescribe()
 await expect(await metric('mean','Pequeño')).toHaveText('0.00041')
 await expect(await metric('mean','Entero')).toHaveText('12')
 await expect(await metric('mean','Valor')).toHaveText('5.52')
})

test('SIM-3d decimales: copia parcial y múltiple usa el valor completo en Estadísticas principal (es)',{tag:'@solo'},async()=>{
 await preserveClipboard();await calculateDescribe()
 const first=await metric('mean','Valor'),last=await metric('mean','Pequeño')
 expect(await selectPart(first,3)).toBe('5.5')
 const partialBefore=await selectionState();expect.soft(await nativeCopy()).toBe(precise);expect(await selectionState()).toEqual(partialBefore)
 await first.click()
 const bounds=await describe().evaluate(node=>{
  const headers=Array.from(node.querySelectorAll('thead th>span')).map(value=>value.textContent)
  const row=Array.from(node.querySelectorAll('tbody tr')).find(row=>row.querySelector('abbr')?.textContent==='Media')!
  const cells=row.querySelectorAll('td'),first=cells[headers.indexOf('Valor')],last=cells[headers.indexOf('Pequeño')]
  const start=document.createTreeWalker(first,NodeFilter.SHOW_TEXT).nextNode()!,end=document.createTreeWalker(last,NodeFilter.SHOW_TEXT).nextNode()!
  const range=document.createRange();range.setStart(start,0);range.setEnd(end,end.textContent!.length)
  const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range)
  return{visible:selection.toString(),first:first.textContent!,last:last.textContent!}
 })
 expect(bounds.visible.startsWith(bounds.first)).toBe(true);expect(bounds.visible.endsWith(bounds.last)).toBe(true)
 const separator=bounds.visible.slice(bounds.first.length,bounds.visible.length-bounds.last.length);expect(separator).toMatch(/^[\t\r\n ]+$/)
 const multipleBefore=await selectionState();expect.soft(await nativeCopy()).toBe(precise+separator+small);expect(await selectionState()).toEqual(multipleBefore)
 await expect(last).toBeVisible()
})


test('SIM-3d formato: copiar Media coincide con el informe Markdown ya generado en ambos modos (es)',{tag:'@solo'},async()=>{
 await preserveClipboard();await calculateDescribe()
 await exportAnalysis(page,'describe.report')
 await expect.poll(()=>page.evaluate(async()=>(await window.freya.documents()).filter(item=>item.kind==='markdown').at(-1)?.text??'')).toContain('| Media (mean) |')
 const report=(await page.evaluate(()=>window.freya.documents())).filter(item=>item.kind==='markdown').at(-1)!
 const meanRow=report.text!.split('\n').find(line=>line.startsWith('| Media (mean) |'))!
 // Valor is the first numeric column in this unchanged source; this is the serialized report, not a formatter oracle.
 const reportMean=meanRow.split('|')[2].trim();expect(reportMean).toBe(precise)
 await page.getByRole('tab',{name:'precision.csv',exact:true}).click();await openAnalysis(page,'Estadísticas')
 for(const mode of ['auto','all'] as const){
  await chooseMode(mode);const mean=await metric('mean','Valor')
  await expect(mean).toHaveText(mode==='auto'?'5.52':precise)
  await expect(mean).toHaveAttribute('title','Valor completo: '+reportMean)
  expect(await selectPart(mean,3)).toBe('5.5')
  const before=await selectionState();expect(await nativeCopy()).toBe(reportMean);expect(await selectionState()).toEqual(before)
 }
 expect((await page.evaluate(()=>window.freya.documents())).find(item=>item.id===report.id)?.text).toBe(report.text)
})

async function chooseMode(mode:'auto'|'all'){
 await expect(decimalSelect()).toBeEnabled();await decimalSelect().selectOption(mode)
 await expect(decimalSelect()).toHaveValue(mode)
 await expect.poll(()=>page.evaluate(async()=>(await window.freya.settings()).values.decimalesAnalisis)).toBe(mode)
}
async function spyComputations(){
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!,calls:string[]=[]
  Reflect.set(globalThis,'sim3dDecimalCompute',{original,calls})
  handlers.set('freya',(event,...args)=>{if(['analyzeColumn','stats','sqlRun'].includes(String(args[0])))calls.push(String(args[0]));return original(event,...args)})
 })
}
const computationCalls=()=>app.evaluate(()=>[...Reflect.get(globalThis,'sim3dDecimalCompute').calls] as string[])
async function changePresentation(mode:'auto'|'all',verify:()=>Promise<void>){
 const before=await computationCalls();await chooseMode(mode);await verify();expect(await computationCalls()).toEqual(before)
}
async function information(){
 await openAnalysis(page,'Información');const panel=workspace().locator('.columns-overview')
 // Información inicia su primera lectura al pedir la pestaña; no disparar otra.
 await expect(panel.getByRole('status')).toHaveText(tr('info.complete'));await expect(panel.locator('tbody tr')).toHaveCount(6)
 return panel
}
async function explorer(column:number){
 await showPanel(page,'Estadísticas');const advanced=workspace().locator('.advanced-statistics')
 const panel=advanced.locator('.column-explorer')
 if(!await panel.isVisible())await advanced.getByText(tr('statistics.explore'),{exact:true}).click()
 await expect(panel).toBeVisible()
 await panel.locator('form select').first().selectOption(String(column));await panel.locator('form button[type="submit"]').click()
 await expect(panel.locator('.scope')).toBeVisible();await expect(panel.locator('form button[type="submit"]')).toHaveAttribute('aria-busy','false')
 return panel
}
const profileValue=(panel:Locator,name:string)=>panel.locator('dl[aria-label="Perfil de columna"]>div').filter({has:page.getByText(name,{exact:true})}).locator('dd')
async function averageChart(){
 await openAnalysis(page,'Gráficos');await chartAssign(page,'Grupo','rows',true);await chartAssign(page,'Valor','values',true);await chartType(page,'bar')
 await(await chartAggregate(page,'Valor')).selectOption('average');await waitChartResult(page)
 await expect(chartPanel(page).locator('.pivot-result tbody tr')).toHaveCount(2)
 return chartPanel(page).locator('.pivot-result tbody tr').filter({has:page.getByRole('rowheader',{name:'A',exact:true})}).locator('td').first()
}
async function settingsAppearance(){
 await runApplicationMenu(app,'app.settings');const dialog=page.getByRole('dialog',{name:tr('settings.title'),exact:true})
 await expect(dialog).toBeVisible();await dialog.getByRole('tab',{name:tr('settings.section.appearance'),exact:true}).click();return dialog
}
async function reopenApplication(){await stopTrace?.();stopTrace=undefined;await closeElectron(app);await launch();await open()}

test('SIM-3d formato: Automático y Más precisión cambian las cuatro superficies montadas sin recalcular (es)',async()=>{
 await spyComputations();const info=await information();await calculateDescribe();const more=await explorer(2),mean=profileValue(more,'Media')
 await expect(mean).toHaveText('5.52');const chartValue=await averageChart()
 await selectAnalysis(page,'Información')
 await changePresentation('all',async()=>{await expect(info.locator('tbody tr')).toHaveCount(6);await expect(info.locator('span[data-analysis-value="4"]').first()).toHaveText('4')})
 await selectAnalysis(page,'Estadísticas');await expect(mean).toHaveText(precise);await expect(await metric('mean','Valor')).toHaveText(precise)
 await changePresentation('auto',async()=>{await expect(mean).toHaveText('5.52');await expect(await metric('mean','Pequeño')).toHaveText('0.00041')})
 await more.locator('..').locator(':scope>summary').press('Enter');await expect(describe()).toBeVisible()
 await changePresentation('all',async()=>{await expect(await metric('mean','Valor')).toHaveText(precise);await expect(await metric('mean','Pequeño')).toHaveText(small);await expect(await metric('mean','Entero')).toHaveText('12')})
 await selectAnalysis(page,'Gráficos');await expect(chartValue).toHaveText(precise)
 await changePresentation('auto',async()=>{await expect(chartValue).toHaveText('5.52')})
 await selectAnalysis(page,'Información');await expect(decimalSelect()).toHaveValue('auto');await expect(info.locator('tbody tr')).toHaveCount(6)
})

test('SIM-3d formato: copia conserva texto, unidad, identificadores, fila e inversa en ambos modos (es)',{tag:'@solo'},async()=>{
 await preserveClipboard();await information()
 const info=workspace().locator('.columns-overview'),emptyPercent=info.locator('tbody tr').filter({has:page.getByRole('rowheader',{name:'Flotante',exact:true})}).locator('span[data-analysis-unit=" %"]')
 await expect(emptyPercent).toHaveText('50 %');expect(await selectPart(emptyPercent,1)).toBe('5');const percentSelection=await selectionState();expect(await nativeCopy()).toBe('50 %');expect(await selectionState()).toEqual(percentSelection)
 await calculateDescribe()
 for(const mode of ['auto','all'] as const){
  await chooseMode(mode);const first=await metric('mean','Valor')
  await first.click();await first.evaluate(node=>{const text=document.createTreeWalker(node,NodeFilter.SHOW_TEXT).nextNode()!,selection=window.getSelection()!;selection.setBaseAndExtent(text,2,text,0)})
  const inverse=await selectionState();expect(inverse.anchorOffset).toBe(2);expect(inverse.focusOffset).toBe(0);expect(await nativeCopy()).toBe(precise);expect(await selectionState()).toEqual(inverse)
  const parts=await describe().evaluate(node=>{
   const names=Array.from(node.querySelectorAll('thead th>span')).map(value=>value.textContent),row=Array.from(node.querySelectorAll('tbody tr')).find(row=>row.querySelector('abbr')?.textContent==='Media')!
   const start=document.createTreeWalker(row.querySelector('th')!,NodeFilter.SHOW_TEXT).nextNode()!,last=row.querySelectorAll('td')[names.indexOf('Pequeño')],end=document.createTreeWalker(last,NodeFilter.SHOW_TEXT).nextNode()!
   const range=document.createRange();range.setStart(start,0);range.setEnd(end,end.textContent!.length);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range)
   return{visible:selection.toString(),first:row.querySelectorAll('td')[names.indexOf('Valor')].textContent!,last:last.textContent!}
  })
  expect(parts.visible).toContain('Media');expect(parts.visible).toMatch(/[\t\n]/)
  const expected=parts.visible.replace(parts.first,precise).replace(parts.last,small),before=await selectionState()
  expect(await nativeCopy()).toBe(expected);expect(await selectionState()).toEqual(before)
 }
 const floating=await explorer(5),sum=profileValue(floating,'Suma');await expect(sum).toHaveText('0.3');await expect(sum).toHaveAttribute('title','Valor completo: '+String(0.1+0.2));await selectPart(sum);expect(await nativeCopy()).toBe(String(0.1+0.2))
 const more=await explorer(0);await more.locator('.views button').nth(1).click()
 const identifier=more.locator('pre').filter({hasText:/^"00123"$/});expect(await selectPart(identifier)).toBe('"00123"');expect(await nativeCopy()).toBe('"00123"')
 await selectAnalysis(page,'SQL');const input=workspace().getByRole('textbox',{name:tr('sql.ui.query'),exact:true});await input.fill('texto 00123 5.52');await input.focus();await input.press('ControlOrMeta+A');expect(await nativeCopy()).toBe('texto 00123 5.52')
})

test('SIM-3d formato: CSV y JSON exportan los resultados completos sin redondear (es)',async()=>{
 const value=await averageChart();await chooseMode('auto');await expect(value).toHaveText('5.52')
 await exportAnalysis(page,'analysis.export.json')
 const jsonPath=join(folder,'exports','precision.analisis.json')
 await expect.poll(()=>readFile(jsonPath,'utf8').then(JSON.parse).catch(()=>null)).not.toBeNull()
 const json=JSON.parse(await readFile(jsonPath,'utf8')) as {rows:string[][];metadata:{source:string;dirty:boolean;revision:number}}
 expect(json.metadata).toMatchObject({source:'precision.csv',dirty:false,revision:doc.revision});expect(json.rows).toHaveLength(2)
 for(const row of json.rows)expect(row[1]).toBe(precise)
 await chooseMode('all');await expect(value).toHaveText(precise);await exportAnalysis(page,'analysis.export.csv')
 await analysisResultExport(page).getByRole('button',{name:tr('charts.ui.export'),exact:true}).click()
 const csvPath=join(folder,'exports','precision.analisis.csv'),contextPath=csvPath+'.contexto.json'
 await expect.poll(()=>readFile(contextPath,'utf8').then(JSON.parse).catch(()=>null)).not.toBeNull()
 const {parse}=await import('csv-parse/sync'),csv=parse(await readFile(csvPath,'utf8')) as string[][]
 expect(csv.slice(1)).toEqual(json.rows);expect(JSON.parse(await readFile(contextPath,'utf8')).rows).toEqual(json.rows)
})

test('SIM-3d formato: preferencia global persiste al reabrir y comparte Apariencia (es)',async()=>{
 await openAnalysis(page,'Información');await chooseMode('all')
 await page.evaluate(()=>window.freya.setSettings({tema:'dark'}));expect((await page.evaluate(()=>window.freya.settings())).values.decimalesAnalisis).toBe('all')
 const dialog=await settingsAppearance();await expect(dialog.getByRole('combobox',{name:'Decimales',exact:true})).toHaveValue('all');await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0)
 await reopenApplication();await openAnalysis(page,'Información');await expect(decimalSelect()).toHaveValue('all');await expect(page.locator('html')).toHaveClass(/dark/)
 const stored=JSON.parse(await readFile(join(folder,'profile','settings.json'),'utf8'));expect(stored.decimalesAnalisis).toBe('all')
 await chooseMode('auto');expect((await page.evaluate(()=>window.freya.settings())).values.tema).toBe('dark')
})

test('SIM-3d decimales: restablecer Apariencia devuelve Automático y conserva otras secciones (es)',async()=>{
 const defaults=defaultSettings()
 const before=await page.evaluate(()=>window.freya.setSettings({
  decimalesAnalisis:'all',tema:'dark',
  barraLateral:{visible:false,ancho:311.5,pestana:'outline'},
  markdown:{modoInicial:'edit'},editor:{tabIndents:true,indent:'tab',csvColumnColors:false},division:61.25,
  actualizaciones:{buscarAlIniciar:false,ultimaComprobacion:'2026-11-20T12:34:56.000Z',versionesOmitidas:['0.1.0-beta.1']},
  avanzado:{herramientasDeDesarrollo:true},
 }))
 expect(before.values).toMatchObject({decimalesAnalisis:'all',tema:'dark',editor:{indent:'tab',csvColumnColors:false}})
 await runApplicationMenu(app,'app.settings')
 const dialog=page.getByRole('dialog',{name:'Ajustes',exact:true})
 await dialog.getByRole('tab',{name:'Apariencia',exact:true}).click()
 const decimals=dialog.getByRole('combobox',{name:'Decimales',exact:true})
 await expect(decimals).toHaveValue('all')
 const expected={...before.values,tema:defaults.tema,decimalesAnalisis:'auto',barraLateral:defaults.barraLateral,markdown:defaults.markdown,editor:defaults.editor,division:defaults.division}
 await dialog.getByRole('button',{name:'Restablecer esta sección',exact:true}).click()
 await expect.poll(()=>page.evaluate(async()=>(await window.freya.settings()).values)).toEqual(expected)
 await expect(decimals).toHaveValue('auto')
 await expect(dialog).toHaveAttribute('aria-busy','false')
 expect(JSON.parse(await readFile(join(folder,'profile','settings.json'),'utf8'))).toEqual(expected)
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0)
})

test('SIM-3d formato: ajustes v1 sin la nueva propiedad conservan las preferencias (es)',async()=>{
 await openAnalysis(page,'Información');await expect(decimalSelect()).toHaveValue('auto')
 expect(await page.evaluate(()=>window.freya.settings())).toMatchObject({readonly:false,values:{version:1,decimalesAnalisis:'auto',tema:'dark',barraLateral:{ancho:311.5}}})
 expect(await readdir(join(folder,'profile'))).not.toContain('settings.json.bak')
})

test('SIM-3d formato: versión futura deja los controles en solo lectura y conserva sus bytes (es)',async()=>{
 await openAnalysis(page,'Información');await expect(decimalSelect()).toBeVisible();await expect(decimalSelect()).toHaveValue('auto');await expect(decimalSelect()).toBeDisabled()
 expect((await page.evaluate(()=>window.freya.settings())).readonly).toBe(true)
 const dialog=await settingsAppearance();await expect(dialog.getByRole('combobox',{name:'Decimales',exact:true})).toHaveValue('auto');await expect(dialog.getByRole('combobox',{name:'Decimales',exact:true})).toBeDisabled();await expect(dialog).toContainText(tr('settings.futureVersion'))
 expect(await readFile(join(folder,'profile','settings.json'),'utf8')).toBe(futureSettings);await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0)
})

for(const locale of ['es','en-XA'] as const)for(const[width,height]of [[1440,900],[1280,720]] as const){
 test(`SIM-3d formato: teclado, temas, tamaño ${width}×${height} y colores forzados (${locale})`,async()=>{
  await calculateDescribe();await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'})
  await expect(decimalSelect()).toHaveAccessibleName(tr('analysis.decimals.label'));await decimalSelect().focus();await expect(decimalSelect()).toBeFocused()
  await decimalSelect().press('Tab');await expect(decimalSelect()).not.toBeFocused();await page.keyboard.press('Shift+Tab');await expect(decimalSelect()).toBeFocused()
  await chooseMode('all');await expect(await metric('mean','Valor')).toHaveText(precise)
  for(const theme of ['light','dark'] as const){
   await page.evaluate(theme=>window.freya.setSettings({tema:theme}),theme);await expect.poll(()=>page.locator('html').evaluate(node=>node.classList.contains('dark'))).toBe(theme==='dark');await page.evaluate(()=>document.fonts.ready)
   await expect.poll(()=>decimalSelect().evaluate(node=>{const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0&&rect.left>=0&&rect.right<=innerWidth+.5&&rect.top>=0&&rect.bottom<=innerHeight+.5})).toBe(true)
   const header=workspace().locator('header')
   await test.info().attach(`header-${locale}-${theme}-${width}`,{body:JSON.stringify(await header.evaluate(root=>[...root.children].map(node=>{const b=node.getBoundingClientRect();return{class:node.className,x:b.x,y:b.y,width:b.width,height:b.height}}))),contentType:'application/json'})
   await expect.poll(()=>header.evaluate(root=>Array.from(root.querySelectorAll<HTMLElement>('button,select')).filter(node=>node.getClientRects().length&&getComputedStyle(node).visibility==='visible').flatMap(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit&&node.contains(hit)?[]:[node.getAttribute('aria-label')||node.textContent?.trim()||node.tagName]}))).toEqual([])
   await page.screenshot({animations:'disabled',path:test.info().outputPath(`sim3d-decimals-${locale}-${theme}-${width}x${height}.png`)})
  }
  await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});await decimalSelect().focus();await expect(decimalSelect()).toBeFocused();await expect(decimalSelect()).toBeEnabled();await chooseMode('auto')
  await expect(await metric('mean','Pequeño')).toHaveText('0.00041');await expect(await metric('mean','Entero')).toHaveText('12')
 })
}

for(const locale of ['es','en-XA'] as const)for(const mode of ['auto','all'] as const)test(`SIM-3d exportación: Estadísticas CSV y JSON conservan valores completos (${mode}) (${locale})`,async()=>{
 await calculateDescribe();await chooseMode(mode)
 const mean=await metric('mean','Valor');await expect(mean).toHaveText(mode==='auto'?'5.52':precise)
 await exportAnalysis(page,'analysis.export.json')
 const jsonPath=join(folder,'exports','precision.analisis.json')
 await expect.poll(()=>readFile(jsonPath,'utf8').then(JSON.parse).catch(()=>null)).not.toBeNull()
 const data=JSON.parse(await readFile(jsonPath,'utf8')) as {columns:string[];rows:(string|number|null)[][];metadata:{source:string;revision:number;sample:boolean}}
 expect(data.metadata).toMatchObject({source:'precision.csv',revision:doc.revision,sample:false})
 const column=data.columns.indexOf('Valor');expect(column).toBeGreaterThan(0)
 const row=data.rows.find(row=>row[0]===tr('describe.metric.mean'));expect(row).toBeDefined();expect(row![column]).toBe(Number(precise))
 expect(data.rows.find(row=>row[0]===tr('describe.metric.mean'))![data.columns.indexOf('Pequeño')]).toBe(Number(small))
 expect(data.rows.find(row=>row[0]===tr('describe.metric.mean'))![data.columns.indexOf('Flotante')]).toBe((0.1+0.2)/2)
 await exportAnalysis(page,'analysis.export.csv')
 const csvPath=join(folder,'exports','precision.analisis.csv'),contextPath=csvPath+'.contexto.json'
 await expect.poll(()=>readFile(contextPath,'utf8').then(JSON.parse).catch(()=>null)).not.toBeNull()
 const {parse}=await import('csv-parse/sync'),csv=parse(await readFile(csvPath,'utf8')) as string[][]
 expect(csv[0]).toEqual(data.columns)
 expect(csv.slice(1)).toEqual(data.rows.map(row=>row.map(value=>value===null?'':String(value))))
 const context=JSON.parse(await readFile(contextPath,'utf8'));expect(context.rows).toEqual(data.rows)
 await expect(mean).toHaveText(mode==='auto'?'5.52':precise)
})

for(const locale of ['es','en-XA'] as const)test(`SIM-3d exportación: Perfil JSON y estadísticas detalladas CSV conservan sus resultados (${locale})`,async()=>{
 const more=await explorer(2);await expect(profileValue(more,'Media')).toHaveText('5.52')
 await exportAnalysis(page,'analysis.export.json')
 const jsonPath=join(folder,'exports','precision.analisis.json')
 await expect.poll(()=>readFile(jsonPath,'utf8').then(JSON.parse).catch(()=>null)).not.toBeNull()
 const json=JSON.parse(await readFile(jsonPath,'utf8')) as {rows:(string|number|null)[][];metadata:{kind:string;partial:boolean;scope:string}}
 expect(json.metadata).toMatchObject({kind:'profile',partial:false});expect(json.metadata.scope).toContain('Valor')
 expect(json.rows.find(row=>row[0]==='Media')?.[1]).toBe(Number(precise))
 await more.locator('..').locator(':scope>summary').press('Enter');await expect(more).toHaveCount(0)
 const advanced=workspace().locator('.advanced-statistics')
 await advanced.getByRole('button',{name:tr('statistics.analyze'),exact:true}).click()
 await expect(advanced.getByRole('status')).toHaveText(tr('statistics.complete'))
 await exportAnalysis(page,'statistics.export.detailedCsv')
 const csvPath=join(folder,'exports','precision.analisis.csv'),contextPath=csvPath+'.contexto.json'
 await expect.poll(()=>readFile(contextPath,'utf8').then(JSON.parse).catch(()=>null)).not.toBeNull()
 const context=JSON.parse(await readFile(contextPath,'utf8')) as {columns:string[];rows:(string|number|null)[][];metadata:{kind:string}}
 expect(context.metadata.kind).toBe('statistics')
 const meanIndex=context.columns.indexOf(tr('statistics.field.average'));expect(meanIndex).toBeGreaterThan(0)
 expect(context.rows.find(row=>row[0]==='Valor')?.[meanIndex]).toBe(Number(precise))
 const {parse}=await import('csv-parse/sync'),csv=parse(await readFile(csvPath,'utf8')) as string[][]
 expect(csv.slice(1)).toEqual(context.rows.map(row=>row.map(value=>value===null?'':String(value))))
})
