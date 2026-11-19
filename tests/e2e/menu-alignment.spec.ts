import {expect,test,_electron as electron,type ElectronApplication,type Locator,type Page} from '@playwright/test'
import electronPath from 'electron'
import {copyFile,mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t,type Language} from '../../src/shared/i18n'
import {closeElectron} from './close-electron'

let app:ElectronApplication,page:Page,folder:string,path:string,language:Language,errors:string[]
const source='ID,Valor,Nota\n001,12,Conservar\n002,30,Sin cambios\n'

test.beforeEach(async({},info)=>{
 language=info.title.endsWith('[en-XA]')?'en-XA':'es'
 folder=await mkdtemp(join(tmpdir(),'freya-menu-alignment-'));const files=join(folder,'datos');await mkdir(files);path=join(files,'encuesta.csv');await writeFile(path,source)
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:language,FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_FOLDER:files}})
 page=await app.firstWindow();errors=[];page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.freya)
 await page.locator('.toolbar-left').getByRole('button',{name:t('dialog.folder.title',{},language),exact:true}).press('Enter')
 await expect(page.locator('.tree-scroll').getByRole('button',{name:'encuesta.csv',exact:true})).toBeVisible()
 await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})).toBeVisible()
})
test.afterEach(async()=>{
 try{expect(errors).toEqual([]);expect(await readFile(path,'utf8')).toBe(source)}
 finally{try{await closeElectron(app)}finally{await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}
})

// Range mide el contenido dibujado (icono + texto cuando existe), no la caja flex del botón.
async function contentOffsets(elements:Locator){
 return elements.evaluateAll(nodes=>nodes.map(node=>{
  const range=document.createRange();range.selectNodeContents(node)
  const content=range.getBoundingClientRect(),box=node.getBoundingClientRect()
  return {label:node.textContent?.trim(),offset:content.left-box.left,width:content.width,height:content.height}
 }))
}
async function fitsViewport(menu:Locator){
 await expect.poll(()=>menu.evaluate(element=>{const box=element.getBoundingClientRect();return box.width>0&&box.height>0&&box.left>=0&&box.top>=0&&box.right<=innerWidth&&box.bottom<=innerHeight})).toBe(true)
}

for(const locale of ['es','en-XA'] as const)test(`SIM-1g: Nuevo, columna y Archivos alinean su contenido y conservan el teclado [${locale}]`,async({},info)=>{
 const newButton=page.getByRole('button',{name:'Nuevo',exact:true}),newMenu=page.locator('.toolbar-left .dropdown')
 const columnButton=page.getByRole('button',{name:t('csv.columnMenu.open',{column:'Valor'},language),exact:true}),columnMenu=page.getByRole('menu',{name:t('csv.columnMenu.label',{},language),exact:true})
 const fileButton=page.locator('.tree-scroll').getByRole('button',{name:'encuesta.csv',exact:true})
 const measurements:{view:string;menu:string;items:Awaited<ReturnType<typeof contentOffsets>>}[]=[]
 for(const [width,height] of [[1440,900],[1280,720]])for(const theme of ['light','dark'] as const){
  await page.setViewportSize({width,height})
  await expect.poll(()=>page.evaluate(()=>({width:innerWidth,height:innerHeight}))).toEqual({width,height})
  await page.evaluate(theme=>window.freya.setSettings({tema:theme}),theme)
  await expect.poll(()=>page.locator('html').evaluate(element=>element.classList.contains('dark'))).toBe(theme==='dark')
  await expect.poll(()=>page.locator('.toolbar').evaluate(element=>getComputedStyle(element).backgroundColor)).toBe(theme==='dark'?'rgb(32, 32, 36)':'rgb(242, 242, 247)')
  await page.evaluate(async()=>{await document.fonts.ready})
  await newButton.press('Enter');await expect(newMenu).toBeVisible()
  await columnButton.press('Enter');await expect(columnMenu).toBeVisible();await expect(newMenu).toBeVisible()
  await fitsViewport(newMenu);await fitsViewport(columnMenu)
  await page.mouse.move(width-8,height-8)
  const phase=process.env.FREYALAB_SIM1G_PHASE??'check',name=`sim1g-${phase}-${locale}-${theme}-${width}x${height}.png`,capture=info.outputPath(name)
  await page.screenshot({path:capture,animations:'disabled'})
  if(process.env.FREYALAB_SIM1G_EVIDENCE){await mkdir(process.env.FREYALAB_SIM1G_EVIDENCE,{recursive:true});await copyFile(capture,join(process.env.FREYALAB_SIM1G_EVIDENCE,name))}
  for(const [menu,items] of [['Nuevo',newMenu.locator('button')],['Columna',columnMenu.getByRole('menuitem')],['Título de columna',columnMenu.locator('.dropdown-label')]] as const){
   const offsets=await contentOffsets(items);measurements.push({view:`${locale}/${theme}/${width}x${height}`,menu,items:offsets})
   expect.soft(offsets.length,`${menu}: hay contenido visible`).toBeGreaterThan(0)
   expect.soft(offsets.filter(item=>item.width<=0||item.height<=0||item.offset<0||item.offset>12),`${menu}: cada bloque visual empieza entre 0 y 12 px`).toEqual([])
  }
  await columnMenu.press('Escape');await expect(columnButton).toBeFocused();await expect(columnMenu).toHaveCount(0)
  await newButton.press('Enter');await expect(newMenu).toHaveCount(0)
  await fileButton.press('Shift+F10')
  const fileMenu=page.getByRole('menu',{name:t('csvText.menu',{},language),exact:true}),items=fileMenu.getByRole('menuitem')
  await expect(fileMenu).toBeVisible();await expect(items).toHaveCount(2)
  await expect(items.last()).toBeEnabled();await expect(items.first()).toBeFocused();await fitsViewport(fileMenu)
  const offsets=await contentOffsets(items);measurements.push({view:`${locale}/${theme}/${width}x${height}`,menu:'Archivos (ContextMenu)',items:offsets})
  expect.soft(offsets.filter(item=>item.width<=0||item.height<=0||item.offset<0||item.offset>12),'ContextMenu conserva la alineación heredada').toEqual([])
  await fileMenu.press('End');await expect(items.last()).toBeFocused()
  await fileMenu.press('Escape');await expect(fileMenu).toHaveCount(0);await expect(fileButton).toBeFocused()
 }
 await writeFile(info.outputPath('geometry.json'),JSON.stringify(measurements,null,2)+'\n')
 expect((await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(false)
})
