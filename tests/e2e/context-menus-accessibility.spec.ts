import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator,type TestInfo} from '@playwright/test'
import electronPath from 'electron'
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t} from '../../src/shared/i18n'
import {closeElectron} from './close-electron'
import {traceElectronFailure} from './electron-trace'

type Variant={locale:'es'|'en-XA';theme:'light'|'dark';width:number;height:number}
type Family='cell'|'row'|'markdown'|'tab'|'files'
type Geometry={box:{left:number;top:number;right:number;bottom:number;width:number;height:number};viewport:{width:number;height:number};overflowX:boolean;overflowY:boolean;items:{label:string;height:number;clipped:boolean;overflow:boolean}[]}
const variants=new Map<string,Variant>()
let app:ElectronApplication,page:Page,root:string,files:string,csv:string,markdown:string,readonlyPath:string,variant:Variant,stopTrace:()=>Promise<void>,pageErrors:string[]
const source='Folio,Importe,Ciudad\r\n00123,12.50,Oaxaca\r\n9007199254740993,40,Mérida\r\n'
const markdownSource='Hola mundo\n',readonlyBytes=Buffer.from('Hola\n','utf16le')
const label=(key:string,parameters:Record<string,string|number>={})=>t(key,parameters,variant.locale)
const rootMenu=()=>page.getByRole('menu').first()
const directItems=(menu:Locator)=>menu.locator(':scope > .column-menu-items > [role="menuitem"]')
const keyboardItems=(menu:Locator)=>menu.locator(':scope > .column-menu-items > [role="menuitem"]:not(:disabled)')

test.beforeEach(async({},info)=>{
 stopTrace=async()=>{}
 const selected=variants.get(info.title);if(!selected)throw new Error('Falta la variante de la prueba contextual.')
 variant=selected;root=await mkdtemp(join(tmpdir(),'freya-context-accessibility-'));files=join(root,'datos')
 await mkdir(files);await mkdir(join(files,'Carpeta'))
 csv=join(files,'encuesta.csv');markdown=join(files,'apuntes.md');readonlyPath=join(files,'lectura.txt')
 await writeFile(csv,source);await writeFile(markdown,markdownSource);await writeFile(readonlyPath,readonlyBytes)
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:variant.locale,FREYALAB_USER_DATA:join(root,'profile'),FREYALAB_TEST_FOLDER:files}})
 page=await app.firstWindow();stopTrace=await traceElectronFailure(page.context(),info)
 pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));await page.waitForFunction(()=>!!window.freya)
 await page.setViewportSize({width:variant.width,height:variant.height})
 await expect.poll(()=>page.evaluate(()=>({width:innerWidth,height:innerHeight}))).toEqual({width:variant.width,height:variant.height})
 await page.emulateMedia({reducedMotion:'reduce'})
 await page.evaluate(theme=>window.freya.setSettings({tema:theme}),variant.theme)
 await expect.poll(()=>page.locator('html').evaluate(element=>element.classList.contains('dark'))).toBe(variant.theme==='dark')
 await expect(page.locator('html')).toHaveAttribute('lang',variant.locale)
 await page.evaluate(async()=>{await document.fonts.ready})
 await page.locator('.toolbar-left').getByRole('button',{name:label('dialog.folder.title'),exact:true}).press('Enter')
 await expect(page.locator('.tree-scroll').getByRole('button',{name:'encuesta.csv',exact:true})).toBeVisible()
 await page.evaluate(path=>window.freya.openPaths([path]),csv)
 await expect(page.locator('.csv-scroll[role="grid"]')).toHaveAttribute('aria-rowcount','3')
 await expect(page.locator('.csv-cell[data-row="0"][data-column="1"]')).toHaveText('12.50')
})
test.afterEach(async()=>{
 try{await stopTrace?.()}
 finally{try{await closeElectron(app)}finally{if(root)await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}
})

async function structure(menu:Locator):Promise<string[]>{
 return menu.evaluate(element=>Array.from(element.querySelectorAll('[role="menuitem"],[role="separator"],.column-menu-title')).filter(item=>item.closest('[role="menu"]')===element).map(item=>{
  if(item.getAttribute('role')==='separator')return '|'
  const copy=item.cloneNode(true) as HTMLElement;copy.querySelectorAll('kbd,svg,[aria-hidden="true"]').forEach(child=>child.remove())
  return copy.textContent?.trim().replace(/\s+/g,' ')??''
 }))
}
async function geometry(menu:Locator):Promise<Geometry>{
 return menu.evaluate(element=>{
  const box=element.getBoundingClientRect(),items=Array.from(element.querySelectorAll<HTMLElement>('[role="menuitem"]')).filter(item=>item.closest('[role="menu"]')===element)
  return{box:{left:box.left,top:box.top,right:box.right,bottom:box.bottom,width:box.width,height:box.height},viewport:{width:innerWidth,height:innerHeight},overflowX:element.scrollWidth>element.clientWidth+1,overflowY:element.scrollHeight>element.clientHeight+1,items:items.map(item=>{
   const rect=item.getBoundingClientRect()
   return{label:item.textContent?.trim()??'',height:rect.height,clipped:rect.left<box.left||rect.right>box.right||rect.top<box.top||rect.bottom>box.bottom,overflow:item.scrollWidth>item.clientWidth+1||item.scrollHeight>item.clientHeight+1}
  })}
 })
}
function violations(value:Geometry,referenceHeight:number):string[]{
 const problems:string[]=[],box=value.box
 if(box.width<=0||box.height<=0||box.left<0||box.top<0||box.right>value.viewport.width||box.bottom>value.viewport.height)problems.push('menu-outside-viewport')
 if(value.overflowX||value.overflowY)problems.push('menu-scrolls-or-clips')
 if(!value.items.length)problems.push('no-menuitems')
 for(const item of value.items){
  // La geometría puede redondearse a subpíxeles, pero no a una segunda línea recortada.
  if(Math.abs(item.height-30)>.75||Math.abs(item.height-referenceHeight)>.75)problems.push('row-height:'+item.label)
  if(item.clipped||item.overflow)problems.push('clipped-item:'+item.label)
 }
 return problems
}
async function measure(menu:Locator,referenceHeight:number){
 await expect(menu).toBeVisible()
 await expect.poll(async()=>violations(await geometry(menu),referenceHeight)).toEqual([])
 return geometry(menu)
}
async function walkKeyboard(menu:Locator,origin:Locator){
 const items=keyboardItems(menu),count=await items.count();expect(count).toBeGreaterThan(0)
 await expect(items.first()).toBeFocused()
 await page.keyboard.press('ArrowDown');await expect(items.nth(count===1?0:1)).toBeFocused()
 await page.keyboard.press('ArrowUp');await expect(items.first()).toBeFocused()
 await page.keyboard.press('End');await expect(items.last()).toBeFocused()
 await page.keyboard.press('ArrowDown');await expect(items.first()).toBeFocused()
 await page.keyboard.press('ArrowUp');await expect(items.last()).toBeFocused()
 await page.keyboard.press('Home');await expect(items.first()).toBeFocused()
 await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);await expect(origin).toBeFocused()
}
async function captureFamily(info:TestInfo,family:Family,origin:Locator,expected:string[],referenceHeight:number,measurements:Record<string,Geometry>){
 await origin.click({button:'right'});let menu=rootMenu();await expect(menu).toBeVisible()
 if(family==='files')await expect(menu.getByRole('menuitem',{name:label('csvText.openText'),exact:true})).toBeEnabled()
 expect(await structure(menu)).toEqual(expected)
 measurements[family]=await measure(menu,referenceHeight)
 await page.screenshot({path:info.outputPath(`sim1h-${family}-${variant.locale}-${variant.theme}-${variant.width}x${variant.height}.png`),animations:'disabled'})
 await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);await expect(origin).toBeFocused()
 await origin.press('Shift+F10');menu=rootMenu();await expect(menu).toBeVisible();expect(await structure(menu)).toEqual(expected)
 if(family==='files')await expect(menu.getByRole('menuitem',{name:label('csvText.openText'),exact:true})).toBeEnabled()
 await walkKeyboard(menu,origin)
 await origin.press('ContextMenu');menu=rootMenu();await expect(menu).toBeVisible();expect(await structure(menu)).toEqual(expected)
 if(family==='files')await expect(menu.getByRole('menuitem',{name:label('csvText.openText'),exact:true})).toBeEnabled()
 await page.keyboard.press('Tab');await expect(page.getByRole('menu')).toHaveCount(0)
}
async function cleanKeyboard(origin:Locator,title:string,actions:string[],referenceHeight:number){
 await origin.press('Shift+F10');const menu=rootMenu(),clean=menu.getByRole('menuitem',{name:label('csv.columnMenu.clean'),exact:true})
 await clean.focus();await clean.press('ArrowRight')
 let child=page.getByRole('menu',{name:label('csv.columnMenu.cleanLabel',{column:title}),exact:true})
 await expect(child).toBeVisible();expect(await structure(child)).toEqual(actions)
 await measure(child,referenceHeight);await expect(directItems(child).first()).toBeFocused()
 await child.press('End');await expect(directItems(child).last()).toBeFocused()
 await child.press('ArrowLeft');await expect(child).toHaveCount(0);await expect(clean).toBeFocused()
 await clean.press('Enter');child=page.getByRole('menu',{name:label('csv.columnMenu.cleanLabel',{column:title}),exact:true});await expect(child).toBeVisible()
 await child.press('Escape');await expect(child).toHaveCount(0);await expect(clean).toBeFocused()
 await menu.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);await expect(origin).toBeFocused()
}
async function disabledWithReason(item:Locator,reason:'selection'|'readonly'){
 await expect(item).toBeDisabled();await expect(item).toHaveAccessibleDescription(label('ui.reason.'+reason))
 await expect(item).toHaveAttribute('title',label('ui.reason.'+reason))
}

for(const locale of ['es','en-XA'] as const)for(const theme of ['light','dark'] as const)for(const [width,height] of [[1440,900],[1280,720]]){
 const name=`SIM-1h cinco menús: forma, teclado, motivos y geometría [${locale}/${theme}/${width}x${height}]`
 variants.set(name,{locale,theme,width,height})
 test(name,async({},info)=>{
  const measurements:Record<string,Geometry>={}
  // La referencia es el menú de columna existente, no otra implementación de menús.
  const column=page.getByRole('button',{name:label('csv.columnMenu.open',{column:'Importe'}),exact:true})
  await column.press('Enter');const columnMenu=page.getByRole('menu',{name:label('csv.columnMenu.label'),exact:true})
  await expect(columnMenu).toBeVisible();await expect(directItems(columnMenu).first()).toBeFocused()
  await expect.poll(async()=>violations(await geometry(columnMenu),30)).toEqual([])
  const reference=await geometry(columnMenu),referenceHeight=reference.items[0].height;measurements.column=reference
  await columnMenu.press('Escape');await expect(column).toBeFocused()

  const cell=page.locator('.csv-cell[data-row="0"][data-column="1"]'),cellTitle=label('csv.context.cell',{column:'Importe',row:1})
  await expect(cell).toHaveAttribute('role','gridcell')
  await captureFamily(info,'cell',cell,[cellTitle,...['cut','copy','paste'].map(id=>label('csv.context.'+id)),'|',label('csv.context.fill'),label('csv.context.clear'),label('csv.columnMenu.clean'),'|',label('csv.context.rangeStatistics')],referenceHeight,measurements)
  await cleanKeyboard(cell,cellTitle,['trim','upper','lower','replace'].map(id=>label('csv.context.'+id)),referenceHeight)

  // Las filas se identifican por su semántica y posición, sin traducir los datos del CSV.
  const row=page.locator('.csv-scroll[role="grid"] [role="row"][aria-rowindex="2"] > button.row-number'),rowTitle=label('csv.context.row',{row:1})
  await captureFamily(info,'row',row,[rowTitle,label('csv.context.insertRowBefore'),label('csv.context.insertRowAfter'),label('csv.context.duplicateRows.one'),'|',label('csv.columnMenu.clean'),'|',label('csv.context.deleteRows.one')],referenceHeight,measurements)
  await cleanKeyboard(row,rowTitle,['rows-trim','rows-upper','rows-lower'].map(id=>label('csv.context.'+id)),referenceHeight)

  await page.evaluate(path=>window.freya.openPaths([path]),markdown)
  const editor=page.locator('.cm-content');await expect(editor).toHaveText('Hola mundo');await editor.focus();await editor.press('ControlOrMeta+Home')
  await captureFamily(info,'markdown',editor,[...['cut','copy','paste','pastePlain'].map(id=>label('menu.edit.'+id)),'|',label('menu.edit.selectAll')],referenceHeight,measurements)
  await editor.focus();await editor.press('ControlOrMeta+Home');await editor.press('Shift+F10');const text=rootMenu();await expect(text).toBeVisible()
  await disabledWithReason(text.getByRole('menuitem',{name:label('menu.edit.cut'),exact:true}),'selection')
  await disabledWithReason(text.getByRole('menuitem',{name:label('menu.edit.copy'),exact:true}),'selection')
  await expect(text.getByRole('menuitem',{name:label('menu.edit.paste'),exact:true})).toBeEnabled()
  await text.press('Escape');await expect(editor).toBeFocused()

  const tab=page.getByRole('tab',{name:'encuesta.csv',exact:true})
  await captureFamily(info,'tab',tab,['encuesta.csv',label('context.close'),'|',label('project.showFolder')],referenceHeight,measurements)

  const file=page.locator('.tree-scroll').getByRole('button',{name:'encuesta.csv',exact:true})
  // captureFamily espera la disponibilidad de Texto antes de recorrer cada apertura.
  await captureFamily(info,'files',file,['encuesta.csv',label('csvText.openTable'),label('csvText.openText'),'|',label('project.showFolder')],referenceHeight,measurements)

  // El fixture real sin BOM se abre pendiente de codificación, por tanto de solo lectura.
  await page.evaluate(path=>window.freya.openPaths([path]),readonlyPath)
  const readEditor=page.locator('.cm-content');await expect(readEditor).toHaveAttribute('contenteditable','false');await readEditor.focus();await readEditor.press('Shift+F10')
  const readMenu=rootMenu();await expect(readMenu).toBeVisible()
  for(const id of ['cut','paste'])await disabledWithReason(readMenu.getByRole('menuitem',{name:label('menu.edit.'+id),exact:true}),'readonly')
  await expect(readMenu.getByRole('menuitem',{name:label('menu.edit.selectAll'),exact:true})).toBeEnabled()
  await readMenu.press('Escape');await expect(readEditor).toBeFocused()

  await writeFile(info.outputPath(`sim1h-geometry-${locale}-${theme}-${width}x${height}.json`),JSON.stringify(measurements,null,2)+'\n')
  expect(pageErrors).toEqual([])
  expect((await page.evaluate(()=>window.freya.documents())).every(document=>!document.dirty)).toBe(true)
  expect(await readFile(csv,'utf8')).toBe(source);expect(await readFile(markdown,'utf8')).toBe(markdownSource);expect(await readFile(readonlyPath)).toEqual(readonlyBytes)
 })
}
