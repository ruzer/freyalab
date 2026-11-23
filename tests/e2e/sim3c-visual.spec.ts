import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t,plural,formatNumber} from '../../src/shared/i18n'
import {closeElectron} from './close-electron'
import {traceElectronFailure} from './electron-trace'

type Variant={locale:'es'|'en-XA';theme:'light'|'dark';width:number;height:number}
const variants=new Map<string,Variant>()
const source='ID,Carrera\r\n00123,Ingeniería\r\n9007199254740993, psicologia \r\n'
const fixture=[['datos.csv',source],['a.txt','Hola\n'],['Nombre largo con á y Unicode Ω.txt','Hola\n'],['apuntes.md','# Apuntes\n'],['diagrama.mmd','flowchart LR\n A --> B\n'],['una.csv','ID,N\n00123,1\n'],['Carpeta/b.txt','Hola\n'],['Carpeta/Otro nombre mucho más largo.txt','Hola\n']] as const
let app:ElectronApplication,page:Page,root:string,files:string,csv:string,variant:Variant,stopTrace:(()=>Promise<void>)|undefined,pageErrors:string[]
const label=(key:string,parameters:Record<string,string|number>={})=>t(key,parameters,variant.locale)
const footer=()=>page.locator('footer.statusbar')
test.beforeEach(async({},info)=>{
 stopTrace=undefined;const value=variants.get(info.title);if(!value)throw new Error('Falta la variante visual SIM-3c.');variant=value
 root=await mkdtemp(join(tmpdir(),'freya-sim3c-visual-'));files=join(root,'archivos');await mkdir(files);await mkdir(join(files,'Carpeta'))
 for(const[name,text]of fixture)await writeFile(join(files,name),text);csv=join(files,'datos.csv')
 const {ELECTRON_RUN_AS_NODE:_,FREYALAB_TEST_OPEN:__,FREYALAB_TEST_FOLDER:___,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve(process.env.FREYALAB_TEST_PROJECT_ENTRY??'out/main/index.js')],env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:variant.locale,FREYALAB_TEST_FOLDER:files,FREYALAB_USER_DATA:join(root,'profile')}})
 page=await app.firstWindow();stopTrace=await traceElectronFailure(page.context(),info);pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message))
 await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:variant.width,height:variant.height});await page.emulateMedia({reducedMotion:'reduce'})
 await expect.poll(()=>page.evaluate(()=>({width:innerWidth,height:innerHeight}))).toEqual({width:variant.width,height:variant.height})
 await page.evaluate(theme=>window.freya.setSettings({tema:theme}),variant.theme)
 await expect.poll(()=>page.locator('html').evaluate(node=>node.classList.contains('dark'))).toBe(variant.theme==='dark')
 await expect(page.locator('html')).toHaveAttribute('lang',variant.locale);await page.evaluate(()=>document.fonts.ready)
 await page.evaluate(path=>window.freya.openPaths([path]),csv)
 await expect(page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})).toHaveText('00123')
 await expect(footer().locator(':scope > span.truncate')).toHaveText(plural('csv.status.rows',2,{matched:formatNumber(2,undefined,variant.locale)},variant.locale))
})
test.afterEach(async()=>{
 try{for(const[name,text]of fixture)expect(await readFile(join(files,name),'utf8')).toBe(text);expect(pageErrors).toEqual([]);expect((await page.evaluate(()=>window.freya.documents())).every(doc=>!doc.dirty)).toBe(true)}
 finally{try{await stopTrace?.()}finally{try{await closeElectron(app)}finally{if(root)await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}}
})
async function capture(state:string){await page.screenshot({animations:'disabled',path:test.info().outputPath(`sim3c-${variant.locale}-${variant.theme}-${variant.width}x${variant.height}-${state}.png`)})}
async function actionsReachable(menu:Locator){
 await expect.poll(()=>menu.locator('button,select').evaluateAll(nodes=>nodes.length>0&&nodes.every(node=>{
  const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)
  return r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5&&hit?.closest('button,select')===node
 }))).toBe(true)
}
async function exportLabelReachable(menu:Locator){
 const text=menu.locator('label').filter({has:page.locator('select')});await expect(text).toHaveCount(1)
 await expect.poll(()=>text.evaluate(node=>{
  const dropdown=node.closest('.export-dropdown')!,walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT),rects:DOMRect[]=[]
  while(walker.nextNode())if(walker.currentNode.textContent?.trim()&&!walker.currentNode.parentElement?.closest('select')){const range=document.createRange();range.selectNodeContents(walker.currentNode);rects.push(...Array.from(range.getClientRects()).filter(r=>r.width>0&&r.height>0))}
  return rects.length>0&&rects.every(r=>dropdown.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)))
 })).toBe(true)
}

for(const locale of ['es','en-XA'] as const)for(const theme of ['light','dark'] as const)for(const [width,height]of [[1440,900],[1280,720]] as const){
 const title=`SIM-3c visual: ${locale} ${theme} ${width}×${height}`;variants.set(title,{locale,theme,width,height})
 test(title,async()=>{
  const toolbar=page.locator('header.toolbar'),newButton=toolbar.getByRole('button',{name:'Nuevo',exact:true})
  await newButton.focus();await newButton.press('Enter');const newMenu=toolbar.locator('.toolbar-left .dropdown');await expect(newMenu).toBeVisible();await actionsReachable(newMenu);await capture('nuevo');await newButton.press('Enter');await expect(newMenu).toHaveCount(0)
  const exportButton=toolbar.getByRole('button',{name:label('menu.file.exports'),exact:true})
  await exportButton.focus();await exportButton.press('Enter');const exportMenu=toolbar.locator('.export-dropdown');await expect(exportMenu).toBeVisible();await actionsReachable(exportMenu);await exportLabelReachable(exportMenu);await capture('exportar');await exportButton.press('Enter');await expect(exportMenu).toHaveCount(0)
  await page.getByRole('gridcell',{name:'Fila 1, ID',exact:true}).click();await expect.poll(async()=>(await footer().locator('.csv-status > span[role="status"]').textContent())?.endsWith(plural('csv.status.cells',1,{},locale))).toBe(true);await capture('celda')
  await page.getByRole('button',{name:'Seleccionar fila 1',exact:true}).click();const selectedRows=plural('csv.status.selectedRows',1,{},locale);await expect(footer().locator('.csv-status > span').filter({hasText:selectedRows})).toHaveText(selectedRows);await capture('fila')
  await page.getByLabel('Seleccionar columna Carrera',{exact:true}).check();await page.getByLabel(label('charts.toolbar.clean'),{exact:true}).click()
  await expect(page.locator('.dropdown-note')).toContainText(label('csv.status.markedScope',{rows:plural('filas',1,{},locale),columns:plural('csv.status.columns',1,{},locale)}));await capture('alcance');await page.keyboard.press('Escape')
  await page.locator('.toolbar-left').getByRole('button',{name:label('dialog.folder.title'),exact:true}).press('Enter')
  const tree=page.locator('.tree-scroll');await expect(tree.getByRole('button',{name:'Carpeta',exact:true})).toBeVisible();await tree.getByRole('button',{name:'Carpeta',exact:true}).press('Enter');await expect(tree.getByRole('button',{name:'b.txt',exact:true})).toBeVisible()
  const positions=()=>tree.locator('button.tree-item').evaluateAll(nodes=>nodes.map(node=>({name:node.querySelector(':scope>.truncate')?.textContent,padding:parseFloat(getComputedStyle(node).paddingLeft),x:node.querySelector(':scope>.truncate')!.getBoundingClientRect().left,icons:node.querySelectorAll('svg').length})))
  await expect.poll(async()=>{const rows=await positions(),levels=[...new Set(rows.map(row=>row.padding))];return levels.length===2&&rows.every(row=>row.icons>0)&&levels.every(level=>{const names=rows.filter(row=>row.padding===level);return names.length>1&&Math.max(...names.map(row=>row.x))-Math.min(...names.map(row=>row.x))<=.75})}).toBe(true)
  await capture('explorador');await test.info().attach('alineacion',{body:JSON.stringify({locale,theme,viewport:{width,height},positions:await positions()}),contentType:'application/json'})
  await page.evaluate(path=>window.freya.openPaths([path]),join(files,'apuntes.md'));await expect(page.getByRole('tab',{name:'apuntes.md',exact:true})).toHaveAttribute('aria-selected','true')
  await page.getByRole('tab',{name:'datos.csv',exact:true}).press('Enter');await expect(footer().locator(':scope > span.truncate')).toHaveText(plural('csv.status.rows',2,{matched:formatNumber(2,undefined,locale)},locale))
  await page.getByRole('tab',{name:'apuntes.md',exact:true}).press('Enter');await expect(footer().locator(':scope > span.truncate')).toHaveText('apuntes.md');await expect(footer().locator('.csv-status')).toHaveCount(0);await capture('markdown')
  await page.evaluate(path=>window.freya.openPaths([path]),join(files,'una.csv'));await expect(footer().locator(':scope > span.truncate')).toHaveText(plural('csv.status.rows',1,{matched:formatNumber(1,undefined,locale)},locale))
 })
}
