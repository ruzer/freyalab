import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t,type Language} from '../../src/shared/i18n'
import {closeElectron} from './close-electron'
import {openAnalysis} from './panel'

let app:ElectronApplication,page:Page,folder:string,path:string
const source='Producto,Precio,Cantidad\na,10,1\nb,20,2\na,30,3\nc,40,4\na,,\na,50,\n'
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-sim2e-'));path=join(folder,'encuesta.csv');await writeFile(path,source)
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:test.info().title.match(/\((es|en|en-XA)\)$/)?.[1]??'es',FREYALAB_USER_DATA:join(folder,'profile')},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true}).locator('.csv-row')).toHaveCount(6)
})
test.afterEach(async()=>{await closeElectron(app);await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

for(const language of ['es','en','en-XA'] as Language[])test(`SIM-2e estadísticas legibles (${language})`,async()=>{
 const tr=(key:string)=>t(key,{},language)
 await openAnalysis(page,'Estadísticas')
 const panel=page.getByRole('region',{name:tr('describe.title'),exact:true}),calculate=panel.getByRole('button',{name:tr('describe.calculate'),exact:true})
 await calculate.focus();await calculate.press('Enter')
 await expect(panel.getByRole('status')).toHaveText(tr('describe.complete'))
 for(const theme of ['light','dark']){
  await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme)
  await expect.poll(()=>page.locator('html').evaluate(element=>element.classList.contains('dark'))).toBe(theme==='dark')
  for(const [width,height]of [[1440,900],[1280,720]]){
   await page.setViewportSize({width,height});await page.mouse.move(0,0)
   await page.screenshot({animations:'disabled',path:test.info().outputPath(`sim2e-${language}-${theme}-${width}x${height}.png`)})
  }
 }
 const expectedMetrics=['count','mean','std','min','25%','50%','75%','max']
 await expect(panel.locator('tbody th')).toHaveText(expectedMetrics.map(metric=>tr('describe.metric.'+metric)))
 for(const metric of expectedMetrics){
  const label=tr('describe.metric.'+metric),help=label+' · '+t('describe.pandasMetric',{metric},language)+' · '+tr('describe.help.'+metric)
  const header=panel.getByRole('rowheader',{name:help,exact:true})
  await expect(header).toHaveAttribute('scope','row');await expect(header.locator('abbr')).toHaveAttribute('title',help)
 }
 await expect(panel.locator('tbody tr').nth(2).locator('td')).toHaveText(['15.81','1.29'])
 await expect(panel.locator('tbody tr').nth(2).locator('td').first()).toHaveAttribute('title',t('columnAnalysis.exactValue',{value:'15.8113883008419'},language))
 await expect(panel.locator('tbody tr').nth(1).locator('td')).toHaveText(['30','2.5'])
 await expect(panel.locator('caption')).toHaveText(tr('describe.scope.all'))
 expect(await panel.getByRole('status').evaluate(element=>element.getBoundingClientRect().height)).toBeLessThanOrEqual(1)
 const table=await panel.locator('table').boundingBox(),container=await panel.locator('.describe-scroll').boundingBox()
 expect(table!.width).toBeLessThan(container!.width-50)
 await panel.locator('summary').filter({hasText:tr('describe.how')}).press('Enter')
 await expect(panel.locator('details')).toContainText(t('describe.revision',{revision:0},language))
 await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'})
 await calculate.focus();await expect(calculate).toBeFocused();await expect(panel.getByRole('table')).toBeVisible()
 expect(await readFile(path,'utf8')).toBe(source)
})
