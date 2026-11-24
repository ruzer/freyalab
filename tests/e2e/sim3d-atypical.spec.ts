import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {createHash} from 'node:crypto'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t} from '../../src/shared/i18n'
import type {DocumentInfo} from '../../src/shared/types'
import {closeElectron} from './close-electron'
import {traceElectronFailure} from './electron-trace'
import {openAnalysis,chartAssign,chartType,chartPanel,waitChartResult,openChartData} from './panel'

const source=Buffer.from('Grupo,Valor\r\n00123,1\r\n00123,2\r\n00123,3\r\n00123,4\r\n00123,100.12345\r\n')
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex')
let app:ElectronApplication,page:Page,folder:string,path:string,doc:DocumentInfo
let stopTrace:(()=>Promise<void>)|undefined

test.beforeEach(async()=>{
 stopTrace=undefined;folder=await mkdtemp(join(tmpdir(),'freya-sim3d-atypical-'));path=join(folder,'atipico.csv');await writeFile(path,source)
 const {ELECTRON_RUN_AS_NODE:_,FREYALAB_TEST_OPEN:__,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile')},timeout:60000})
 page=await app.firstWindow();stopTrace=await traceElectronFailure(page.context(),test.info());await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 ;[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 expect(doc).toMatchObject({kind:'csv',rowCount:5,dirty:false,revision:0})
 await expect(page.getByRole('gridcell',{name:'Fila 1, Grupo',exact:true})).toHaveText('00123')
})

test.afterEach(async()=>{
 try{
  const bytes=await readFile(path);expect(bytes).toEqual(source);expect(digest(bytes)).toBe(digest(source))
  const current=(await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)
  expect(current).toEqual(doc)
 }finally{
  try{
   await app?.evaluate(async({clipboard})=>{
    const saved=Reflect.get(globalThis,'sim3dAtypicalClipboard') as import('electron').ClipboardItem[]|undefined
    if(saved){if(saved.length)await clipboard.write(saved);else clipboard.clear();Reflect.deleteProperty(globalThis,'sim3dAtypicalClipboard')}
   })
  }finally{try{await stopTrace?.()}finally{try{await closeElectron(app)}finally{if(folder)await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}}
 }
})

async function preserveClipboard(){
 // Los formatos originales permanecen solo en memoria de main.
 await app.evaluate(async({clipboard,ClipboardItem})=>{
  const items=(await clipboard.read()).filter(item=>item.types.length)
  const saved=await Promise.all(items.map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))))
  if(saved.length)await clipboard.write(saved);Reflect.set(globalThis,'sim3dAtypicalClipboard',saved)
 })
}

async function selectOutlierPart(cell:Locator){
 await cell.click()
 return cell.evaluate(node=>{
  // Sirve tanto para la lista cruda anterior como para sus futuros spans numéricos.
  const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT)
  let text:Node|null=null,start=-1
  while(walker.nextNode()){start=walker.currentNode.textContent?.indexOf('100.')??-1;if(start>=0){text=walker.currentNode;break}}
  if(!text)throw new Error('La lista de atípicos no contiene el valor esperado.')
  const range=document.createRange();range.setStart(text,start);range.setEnd(text,start+4)
  const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range)
  return selection.toString()
 })
}

const selectionState=()=>page.evaluate(()=>{
 const selection=window.getSelection()!
 return{text:selection.toString(),ranges:selection.rangeCount,anchorText:selection.anchorNode?.textContent,anchorOffset:selection.anchorOffset,focusText:selection.focusNode?.textContent,focusOffset:selection.focusOffset}
})

async function nativeCopy(){
 const sentinel='SIM3d atípico pendiente'
 await app.evaluate(({clipboard},value)=>clipboard.writeText(value),sentinel)
 await page.keyboard.press('ControlOrMeta+C')
 await expect.poll(()=>app.evaluate(({clipboard})=>clipboard.readText())).not.toBe(sentinel)
 return app.evaluate(({clipboard})=>clipboard.readText())
}

test('SIM-3d Caja: atípico fraccional muestra dos decimales y copia exacto sin cambiar el identificador (es)',{tag:'@solo'},async()=>{
 await preserveClipboard();await openAnalysis(page,'Gráficos')
 await chartAssign(page,'Grupo','rows',true);await chartAssign(page,'Valor','values',true);await chartType(page,'box');await waitChartResult(page)
 const data=await openChartData(page)
 await expect(data.getByRole('columnheader',{name:t('charts.head.atypical'),exact:true})).toBeVisible()
 await expect(data.locator('tbody tr')).toHaveCount(1)
 const headers=await data.locator('thead th').allTextContents(),row=data.locator('tbody tr').first()
 const cell=(key:string)=>row.locator('td').nth(headers.indexOf(t('charts.head.'+key)))
 await expect(row.locator('td').first()).toHaveText('00123')
 await expect(cell('outliers')).toHaveText('1');await expect(cell('count')).toHaveText('5')
 const atypical=cell('atypical')
 await expect.soft(atypical).toHaveText('[100.12]')
 expect.soft(await atypical.locator('[title]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('title')))).toEqual(['Valor completo: 100.12345'])
 expect(await selectOutlierPart(atypical)).toBe('100.')
 const before=await selectionState()
 expect.soft(await nativeCopy()).toBe('100.12345')
 expect(await selectionState()).toEqual(before)
 await expect(row.locator('td').first()).toHaveText('00123')
 await expect(chartPanel(page).locator('.plot svg')).toBeVisible()
})
