import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t,type Language} from '../../src/shared/i18n'
import type {DocumentInfo} from '../../src/shared/types'
import {closeElectron} from './close-electron'
import {traceElectronFailure} from './electron-trace'
import {openAnalysis,selectAnalysis} from './panel'

const precise='5.52264150943',small='0.0004123'
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
 await launch();await open()
})
test.afterEach(async()=>{
 try{
  expect(await readFile(path,'utf8')).toBe(source)
  const current=(await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)
  expect(current).toEqual(doc)
 }finally{
  try{
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

test('SIM-3d decimales: selector global accesible con opciones 2 y Todos (es)',async()=>{
 await openAnalysis(page,'Información')
 await expect(decimalSelect()).toBeVisible();await expect(decimalSelect()).toHaveValue('2')
 await expect(decimalSelect().locator('option')).toHaveText(['2',tr('analysis.decimals.all')])
})

test('SIM-3d decimales: pequeños no nulos siguen visibles en Estadísticas principal (es)',async()=>{
 await calculateDescribe()
 await expect(await metric('mean','Pequeño')).toHaveText('0.00041')
 await expect(await metric('mean','Entero')).toHaveText('12')
 await expect(await metric('mean','Valor')).toHaveText('5.52')
})

test('SIM-3d decimales: copia parcial y múltiple usa 15 cifras en Estadísticas principal (es)',{tag:'@solo'},async()=>{
 await preserveClipboard();await calculateDescribe()
 const first=await metric('mean','Valor'),last=await metric('mean','Pequeño')
 expect(await selectPart(first,2)).toBe('5.')
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
