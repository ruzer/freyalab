import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {t,type Language} from '../../src/shared/i18n'
import type {DocumentInfo} from '../../src/shared/types'
import {closeElectron} from './close-electron'
import {openAnalysis,showPanel,showTable,openCsvCommands,chartPanel,chartAssign,chartType,openChartSettings,waitChartResult} from './panel'

let app:ElectronApplication,page:Page,folder:string,language:Language
const opened=new Map<string,{source:Buffer;doc:DocumentInfo}>()
// Same thirteen-row source as descriptive-percentiles: no new parser or generator.
const source='\uFEFFID,Grupo,Valor\r\n'+[2,4,4,4,5,5,7,9].map((value,i)=>`${String(i).padStart(5,'0')},visible,${value}`).join('\r\n')+'\r\n00008,oculto,100\r\n9007199254740993,oculto,9007199254740993\r\n00010,oculto,\r\n00011,oculto,"  "\r\n00012,oculto\r\n'
const trendSource='X,Y\n1,2\n2,4\n3,5\n4,4\n5,5\n'
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex')
const tr=(key:string,parameters:Record<string,string|number>={})=>t(key,parameters,language)
const revisionWord=/revisión|revision|rëvïsïön/i
const expected={
 es:{intro:'Solo lectura: tu archivo no cambia.',how:'Cómo se calcula',normalize:'Unificar letras con acento (NFC)',context:'Esta acción no está disponible con la selección actual.',undo:'Este cambio es demasiado grande para poder deshacerlo, así que no se aplicó. Tu documento no cambió.'},
 'en-XA':{
  intro:/^\[Rëád önly: yöür fïlë döës nöt chángë\.~+\]$/,
  how:/^\[Höw ït ïs cálcülátëd~+\]$/,
  normalize:/^\[Ünïfy áccëntëd lëttërs \(NFC\)~+\]$/,
  context:/^\[Thïs áctïön ïs nöt áváïláblë wïth thë cürrënt sëlëctïön\.~+\]$/,
  undo:/^\[Thïs chángë ïs töö lárgë tö ündö, sö ït wás nöt ápplïëd\. Yöür döcümënt dïd nöt chángë\.~+\]$/,
 },
} as const

test.beforeEach(async()=>{
 language=(test.info().title.match(/\((es|en-XA)\)$/)?.[1]??'es') as Language
 folder=await mkdtemp(join(tmpdir(),'freya-sim3d-'));opened.clear()
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:language,FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{
 try{
  const documents=await page.evaluate(()=>window.freya.documents())
  for(const[path,{source,doc}]of opened){
   expect(digest(await readFile(path))).toBe(digest(source))
   expect(documents.find(item=>item.id===doc.id)).toEqual(doc)
  }
 }finally{
  try{
   await app.evaluate(async({clipboard})=>{
    const saved=Reflect.get(globalThis,'sim3dSavedClipboard') as import('electron').ClipboardItem[]|undefined
    if(saved){if(saved.length)await clipboard.write(saved);else clipboard.clear();Reflect.deleteProperty(globalThis,'sim3dSavedClipboard')}
   })
  }finally{try{await closeElectron(app)}finally{await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}
 }
})

async function open(text=source,name='datos.csv'){
 const path=join(folder,name),bytes=Buffer.from(text);await writeFile(path,bytes)
 const[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
 await expect(page.getByRole('tab',{name:doc.name,exact:true})).toHaveAttribute('aria-selected','true')
 opened.set(path,{source:bytes,doc})
 return doc
}
async function explorer(){
 await showPanel(page,'Estadísticas')
 const advanced=page.locator('.analysis-workspace:not([hidden]) .advanced-statistics')
 await advanced.getByText(tr('statistics.explore'),{exact:true}).click()
 const panel=advanced.locator('.column-explorer');await expect(panel).toBeVisible()
 await panel.locator('form select').first().selectOption('2')
 await explore(panel)
 return panel
}
async function explore(panel:Locator){
 const submit=panel.locator('form button[type="submit"]')
 await submit.click();await expect(panel.locator('.scope')).toBeVisible();await expect(submit).toHaveAttribute('aria-busy','false')
}
function exactText(actual:string|null,expected:string|RegExp){
 if(typeof expected==='string')expect.soft(actual).toBe(expected)
 else expect.soft(actual).toMatch(expected)
}

test('SIM-3d cifras y title conservan resultados completos en Perfil, Frecuencias y Distribución (es)',async()=>{
 const doc=await open();await expect(page.locator('.csv-row')).toHaveCount(13)
 const panel=await explorer(),mean=panel.locator('dl[aria-label="Perfil de columna"]>div').filter({has:page.getByText('Media',{exact:true})}).locator('dd')
 await expect(mean).toBeVisible()
 expect.soft(await mean.innerText()).toBe('15.56')
 expect.soft(await mean.getAttribute('title')).toBe('Valor exacto: '+String(140/9))
 for(const node of await panel.locator('dd:visible').all()){
  const value=await node.innerText();expect.soft(value.replaceAll(',','')).not.toMatch(/\.\d{3}/)
  if(value!=='—')expect.soft(await node.getAttribute('title')).toMatch(/^Valor exacto: /)
 }
 await panel.locator('.views button').nth(1).click()
 const frequency=panel.locator('tbody tr').filter({has:page.locator('pre').filter({hasText:/^"4"$/})})
 await expect(frequency).toBeVisible();await expect(frequency.locator('td').nth(1)).toHaveText('3')
 expect.soft(await frequency.locator('td').nth(2).innerText()).toBe('23.08 %')
 expect.soft(await frequency.locator('td').nth(2).getAttribute('title')).toBe('Valor exacto: '+String(3/13*100))
 await panel.locator('.views button').nth(2).click()
 await panel.getByRole('spinbutton').fill('3');await explore(panel)
 const bins=panel.locator('tbody tr');await expect(bins).toHaveCount(3)
 await expect(bins.locator('td:last-child')).toHaveText(['8','0','1'])
 expect.soft(await bins.first().locator('td').nth(1).innerText()).toBe('34.67')
 expect.soft(await bins.first().locator('td').nth(1).getAttribute('title')).toBe('Valor exacto: '+String(2+(100-2)/3))
 const rows=await page.evaluate(id=>window.freya.tablePage(id,{offset:0,limit:20,requestId:1}),doc.id)
 expect(rows.rows[0].cells).toEqual(['00000','visible','2'])
 expect(rows.rows[9].cells).toEqual(['9007199254740993','oculto','9007199254740993'])
 expect(rows.rows[12].cells).toEqual(['00012','oculto'])
})

for(const locale of ['es','en-XA'] as const){
 test(`SIM-3d alcance breve y explicación nativa por teclado (${locale})`,async()=>{
  await open();const panel=await explorer(),scope=await panel.locator('.scope').innerText()
  expect.soft(scope).not.toMatch(revisionWord);expect.soft(scope).not.toMatch(/^3\. /);expect.soft(scope).toContain('Valor');expect.soft(scope).toContain('13')
  const intro=panel.locator(':scope>p').filter({hasText:expected[locale].intro})
  expect.soft(await intro.count()).toBe(1)
  const details=panel.locator('details').filter({has:page.locator(':scope>summary').filter({hasText:expected[locale].how})})
  expect.soft(await details.count()).toBe(1)
  if(await details.count()===1){
   await expect(details).not.toHaveAttribute('open','')
   const summary=details.locator(':scope>summary');await summary.focus();await summary.press('Enter');await expect(details).toHaveAttribute('open','')
   expect(await details.innerText()).toMatch(/100.?000/)
   await summary.press('Space');await expect(details).not.toHaveAttribute('open','')
  }
 })

 test(`SIM-3d NFC y motivo genérico usan palabras para estudiantes (${locale})`,async()=>{
  await open()
  const commands=await openCsvCommands(page,app),fill=commands.locator('li').filter({has:page.locator('strong').filter({hasText:/^Rellenar rango…$/})}).getByRole('button')
  await expect(fill).toBeDisabled();await expect(fill).toHaveAttribute('aria-describedby','control-reason-context')
  exactText(await page.locator('#control-reason-context').textContent(),expected[locale].context)
  await page.keyboard.press('Escape')
  await page.getByLabel(tr('charts.toolbar.clean'),{exact:true}).click()
  await page.getByRole('button',{name:'Transformar documento…',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Transformar documento CSV',exact:true}),operation=dialog.getByRole('combobox',{name:'Transformación CSV',exact:true})
  await operation.selectOption('normalize')
  exactText(await operation.locator('option:checked').textContent(),expected[locale].normalize)
  await expect(operation).toHaveValue('normalize');await page.keyboard.press('Escape')
 })

 test(`SIM-3d límite de deshacer explica rechazo real sin aplicar (${locale})`,async()=>{
  const doc=await open('ID,A\n'+'001,\n'.repeat(24),'limite.csv')
  await page.getByRole('button',{name:tr('csv.columnMenu.open',{column:'A'}),exact:true}).click()
  await page.getByRole('menuitem',{name:tr('csv.columnMenu.clean'),exact:true}).click()
  await page.getByRole('menu').last().getByRole('menuitem',{name:tr('csv.columnMenu.emptyFill'),exact:true}).click()
  const dialog=page.getByRole('dialog',{name:tr('empty.fillTitle',{column:'A'}),exact:true})
  await dialog.getByRole('textbox',{name:tr('empty.value'),exact:true}).fill('x'.repeat(900000))
  await dialog.getByRole('button',{name:tr('empty.preview'),exact:true}).click()
  const alert=dialog.getByRole('alert');await expect(alert).toBeVisible()
  exactText(await alert.textContent(),expected[locale].undo)
  await expect(dialog.getByRole('button',{name:tr('empty.applyFill'),exact:true})).toBeDisabled()
  const rows=await page.evaluate(id=>window.freya.tablePage(id,{offset:0,limit:30,requestId:1}),doc.id)
  expect(rows.rows).toHaveLength(24);expect(rows.rows.every(row=>row.cells[0]==='001'&&row.cells[1]==='')).toBe(true)
  await page.keyboard.press('Escape')
 })

 test(`SIM-3d fuentes en memoria mantienen cifras y quitan la revisión de SQL y Gráficos (${locale})`,async()=>{
  await open();await showPanel(page,'Análisis');const sql=page.locator('.analysis-workspace:not([hidden]) .sql-panel')
  const limits=sql.locator('.sql-limits');await limits.locator(':scope>summary').click()
  const sourceLine=limits.locator('p').last();await expect(sourceLine).toContainText('datos.csv')
  expect.soft(await sourceLine.innerText()).not.toMatch(revisionWord)
  const query=sql.getByRole('textbox',{name:tr('sql.ui.query'),exact:true})
  await query.fill('SELECT COUNT(*) AS total FROM datos');await sql.getByRole('button',{name:tr('sql.ui.run'),exact:true}).click()
  await expect(sql.locator('.sql-results tbody td')).toHaveText('13')
  const resultDetails=sql.locator('.sql-result-details');await resultDetails.locator(':scope>summary').click()
  await expect(resultDetails).toContainText('datos.csv');await expect(resultDetails).toContainText('13')
  expect.soft(await resultDetails.innerText()).not.toMatch(revisionWord)
  await showTable(page);await open(trendSource,'tendencia.csv');await openAnalysis(page,'Gráficos')
  await chartAssign(page,'X','rows');await chartAssign(page,'Y','values');await chartType(page,'scatter');await openChartSettings(page)
  await chartPanel(page).getByRole('checkbox',{name:tr('charts.trend.option'),exact:true}).check();await waitChartResult(page)
  const trend=chartPanel(page).locator('.trend-result');await expect(trend).toBeVisible()
  const memory=trend.locator(':scope>p').filter({hasText:/memoria|mëmöry/i});await expect(memory).toHaveCount(1)
  expect.soft(await memory.innerText()).not.toMatch(revisionWord)
 })
}

async function preserveClipboard(){
 // Original OS formats stay only in main-process memory, never in attachments.
 await app.evaluate(async({clipboard,ClipboardItem})=>{
  const items=(await clipboard.read()).filter(item=>item.types.length)
  const saved=await Promise.all(items.map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))))
  if(saved.length)await clipboard.write(saved)
  Reflect.set(globalThis,'sim3dSavedClipboard',saved)
 })
}
async function selectText(value:Locator,partial=false){
 await value.click()
 await value.evaluate((node,partial)=>{
  const range=document.createRange();range.selectNodeContents(node)
  if(partial){const text=document.createTreeWalker(node,NodeFilter.SHOW_TEXT).nextNode();if(!text)throw new Error('No hay texto numérico seleccionable');range.setStart(text,0);range.setEnd(text,2)}
  const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range)
 },partial)
 return page.evaluate(()=>window.getSelection()?.toString()??'')
}
async function nativeCopy(){
 const sentinel='SIM3d copia sintética pendiente'
 await app.evaluate(async({clipboard},value)=>{await clipboard.writeText(value)},sentinel)
 // Real keyboard route and OS clipboard. No execCommand or fabricated copy event.
 await page.keyboard.press('ControlOrMeta+C')
 await expect.poll(()=>app.evaluate(({clipboard})=>clipboard.readText())).not.toBe(sentinel)
 return app.evaluate(({clipboard})=>clipboard.readText())
}

test('SIM-3d control: Copiar por teclado alcanza el portapapeles real en Análisis (es)',{tag:'@solo'},async({},info)=>{
 await preserveClipboard();await open();const panel=await explorer()
 const label=panel.locator('dl[aria-label="Perfil de columna"] dt').filter({hasText:/^Media$/})
 expect(await selectText(label)).toBe('Media')
 const route=await page.evaluate(()=>({activeElement:document.activeElement?.tagName,rangeCount:window.getSelection()?.rangeCount,selected:window.getSelection()?.toString()}))
 const copyMenuEnabled=await app.evaluate(({Menu})=>Menu.getApplicationMenu()?.getMenuItemById('edit.copy')?.enabled??false)
 await info.attach('sim3d-copy-route',{body:Buffer.from(JSON.stringify({...route,copyMenuEnabled,limit:'Keyboard events plus real OS clipboard; physical hardware accelerator not asserted.'})),contentType:'application/json'})
 expect(await nativeCopy()).toBe('Media')
})

test('SIM-3d copia completa conserva cifra y porcentaje; parcial, varias e identificador copian visible (es)',{tag:'@solo'},async()=>{
 await preserveClipboard();await open();const panel=await explorer()
 const notice='Cifras redondeadas a 2 decimales. Al copiar un valor completo se copia exacto.'
 expect.soft(await panel.getByText(notice,{exact:true}).count()).toBe(1)
 const mean=panel.locator('dl[aria-label="Perfil de columna"]>div').filter({has:page.getByText('Media',{exact:true})}).locator('dd')
 const median=panel.locator('dl[aria-label="Perfil de columna"]>div').filter({has:page.getByText('Mediana',{exact:true})}).locator('dd')
 const visibleMean=await mean.innerText(),visibleMedian=await median.innerText()
 await selectText(mean);expect.soft(await nativeCopy()).toBe(String(140/9))
 const partial=await selectText(mean,true);expect(partial).toBe(visibleMean.slice(0,2));expect(await nativeCopy()).toBe(partial)
 await mean.click()
 const visibleMultiple=await panel.evaluate(node=>{
  const values=Array.from(node.querySelectorAll('dl[aria-label="Perfil de columna"]>div'))
  const first=values.find(value=>value.querySelector('dt')?.textContent==='Media'),last=values.find(value=>value.querySelector('dt')?.textContent==='Mediana')
  if(!first||!last)throw new Error('No se alcanzaron dos cifras visibles')
  const range=document.createRange();range.setStartBefore(first);range.setEndAfter(last)
  const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);return selection?.toString()??''
 })
 expect(visibleMultiple).toContain(visibleMean);expect(visibleMultiple).toContain(visibleMedian)
 expect(await nativeCopy()).toBe(visibleMultiple)
 await panel.locator('.views button').nth(1).click()
 const frequency=panel.locator('tbody tr').filter({has:page.locator('pre').filter({hasText:/^"4"$/})})
 await selectText(frequency.locator('td').nth(2));expect.soft(await nativeCopy()).toBe(String(3/13*100)+' %')
 await panel.locator('form select').first().selectOption('0');await explore(panel)
 const identifier=panel.locator('pre').filter({hasText:/^"00000"$/})
 const visibleIdentifier=await selectText(identifier);expect(visibleIdentifier).toBe('"00000"');expect(await nativeCopy()).toBe(visibleIdentifier)
 await showTable(page);await open('ID,Grupo,Valor\n00000,x,5.52264150943\n','precision.csv')
 const precision=await explorer(),preciseMean=precision.locator('dl[aria-label="Perfil de columna"]>div').filter({has:page.getByText('Media',{exact:true})}).locator('dd')
 expect.soft(await preciseMean.innerText()).toBe('5.52')
 expect.soft(await preciseMean.getAttribute('title')).toBe('Valor exacto: 5.52264150943')
 await selectText(preciseMean);expect.soft(await nativeCopy()).toBe('5.52264150943')
})
