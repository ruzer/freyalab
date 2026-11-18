import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {closeElectron} from './close-electron'
import {showPanel,showTable} from './panel'
import {t,type Language} from '../../src/shared/i18n'
let app:ElectronApplication,page:Page,folder:string
const fixture='Ciudad,Ingreso,"Crédito ""México"""\r\nOaxaca,10.10,001\r\nPuebla,20.20,002\r\n'
const modifier=process.platform==='darwin'?'Meta':'Control'
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-sql-clarity-'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:test.info().title.match(/\((es|en-XA)\)$/)?.[1]??'es',FREYALAB_USER_DATA:join(folder,'profile')},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 const path=join(folder,'encuesta.csv');await writeFile(path,fixture);await page.evaluate(path=>window.freya.openPaths([path]),path);await showPanel(page,'Análisis')
})
test.afterEach(async()=>{await closeElectron(app);await rm(folder,{recursive:true,force:true})})
const panel=()=>page.locator('.sql-panel')
const editor=()=>panel().getByRole('textbox',{name:'Consulta SQL',exact:true})

test('SIM-2f: ayuda progresiva, estado inicial y acción principal',async()=>{
 await expect(panel().getByText('Solo lectura: tus consultas no cambian el archivo.',{exact:true})).toBeVisible()
 await expect(panel().getByRole('heading',{name:'Análisis local con DuckDB'})).toHaveCount(0)
 const limits=panel().locator('details').filter({has:page.getByText('Límites',{exact:true})})
 await expect(limits).not.toHaveAttribute('open')
 await expect(panel().getByRole('status')).toBeEmpty()
 await expect(panel().getByText('Escribe una consulta y pulsa Ejecutar. Los resultados aparecen aquí.',{exact:true})).toBeVisible()
 await expect(panel().getByRole('button',{name:'Ejecutar consulta',exact:true})).toHaveClass(/btn-primary/)
 await expect(panel().getByText(process.platform==='darwin'?'⌘ Intro':'Ctrl Intro',{exact:true})).toBeVisible()
 await limits.locator(':scope > summary').click()
 await expect(limits).toContainText('256 MiB');await expect(limits).toContainText('Sin acceso SQL a disco, red ni extensiones')
})

test('SIM-2f: fichas insertan el identificador escapado en el cursor, devuelven foco y deshacen en un paso',async()=>{
 await editor().fill('SELECT  FROM datos;');await editor().press('Home');await editor().press('ArrowRight');await editor().press('ArrowRight');await editor().press('ArrowRight');await editor().press('ArrowRight');await editor().press('ArrowRight');await editor().press('ArrowRight');await editor().press('ArrowRight')
 await panel().getByRole('button',{name:'Insertar columna Ingreso',exact:true}).click()
 await expect(editor()).toHaveText('SELECT "Ingreso" FROM datos;',{useInnerText:true});await expect(editor()).toBeFocused()
 await page.keyboard.press(`${modifier}+z`);await expect(editor()).toHaveText('SELECT  FROM datos;',{useInnerText:true})
 const quoted=panel().getByRole('button',{name:'Insertar columna Crédito "México"',exact:true});await quoted.focus();await page.keyboard.press('Enter')
 await expect(editor()).toHaveText('SELECT "Crédito ""México""" FROM datos;',{useInnerText:true});await expect(editor()).toBeFocused()
 await page.keyboard.type(' AS credito');await expect(editor()).toHaveText('SELECT "Crédito ""México""" AS credito FROM datos;',{useInnerText:true})
 expect(await readFile(join(folder,'encuesta.csv'),'utf8')).toBe(fixture)
})

test('SIM-2f: ejecutar con teclado conserva resultados y solo anuncia cambios después de ejecutar',async()=>{
 await editor().fill('SELECT SUM(CAST("Ingreso" AS DECIMAL(10,2))) AS Total FROM datos;')
 await expect(panel().getByRole('status')).toBeEmpty();await editor().press(`${modifier}+Enter`)
 await expect(panel().getByRole('status')).toContainText('Consulta completa',{timeout:30000});await expect(editor()).toHaveText('SELECT SUM(CAST("Ingreso" AS DECIMAL(10,2))) AS Total FROM datos;',{useInnerText:true})
 await expect(panel().getByRole('region',{name:'Resultado SQL',exact:true}).locator('tbody td')).toHaveText('30.30')
 await expect(panel().getByText('1 fila de resultado',{exact:true})).toBeVisible()
 const details=panel().locator('details').filter({has:page.getByText('Detalles del resultado',{exact:true})});await expect(details).not.toHaveAttribute('open');await details.locator(':scope > summary').click();await expect(details).toContainText('DuckDB')
 await editor().press('End');await editor().press('Space');await expect(panel().getByRole('status')).toContainText('Consulta o fuentes actualizadas')
 await showTable(page);expect(await readFile(join(folder,'encuesta.csv'),'utf8')).toBe(fixture)
})

for(const language of ['es','en-XA'] as const)test(`SIM-2f: sección legible y capturas en dos tamaños y temas (${language})`,async()=>{
 const tr=(key:string)=>t(key,{},language as Language)
 await expect(panel().getByText(tr('sql.ui.readonly'),{exact:true})).toBeVisible()
 await expect(panel().getByRole('button',{name:tr('sql.ui.run'),exact:true})).toBeVisible()
 if(language==='en-XA')for(const text of ['Ejecutar consulta','Archivos y nombres para SQL','Asistentes: agrupar, pivotar y cruzar','Análisis SQL y asistentes','Análisis local con DuckDB'])await expect(panel().getByText(text,{exact:true})).toHaveCount(0)
 for(const theme of ['light','dark'] as const){
  await page.getByLabel('Tema',{exact:true}).selectOption(theme)
  await expect.poll(()=>page.locator('html').evaluate(element=>element.classList.contains('dark'))).toBe(theme==='dark')
  for(const [width,height] of [[1440,900],[1280,720]]){
   await page.setViewportSize({width,height})
   await expect.poll(()=>panel().evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true)
   const boxes=await panel().evaluate(element=>{const intro=element.querySelector('.sql-intro')!.getBoundingClientRect(),fields=element.querySelector('.sql-columns')!.getBoundingClientRect(),edit=element.querySelector('.sql-editor')!.getBoundingClientRect();return{introHeight:intro.height,introBottom:intro.bottom,fieldsTop:fields.top,fieldsBottom:fields.bottom,editorTop:edit.top}})
   expect(boxes.introHeight).toBeLessThan(35);expect(boxes.introBottom).toBeLessThanOrEqual(boxes.fieldsTop);expect(boxes.fieldsBottom).toBeLessThanOrEqual(boxes.editorTop)
   await page.screenshot({path:test.info().outputPath(`sim-2f-${language}-${theme}-${width}x${height}.png`),animations:'disabled'})
  }
 }
})

test('SIM-2f: cambiar idioma actualiza el nombre accesible sin reemplazar el editor ni su historial',async()=>{
 await editor().fill('SELECT "Ingreso" FROM datos;')
 const originalEditor=await editor().elementHandle()
 await page.evaluate(()=>window.freya.setLanguage('en'))
 await expect(panel().getByRole('button',{name:'Run query',exact:true})).toBeVisible()
 const englishEditor=panel().getByRole('textbox',{name:'SQL query',exact:true})
 await expect(englishEditor).toBeVisible()
 expect(await originalEditor!.evaluate(element=>element.isConnected)).toBe(true)
 await expect(englishEditor).toHaveText('SELECT "Ingreso" FROM datos;',{useInnerText:true})
 await englishEditor.press(`${modifier}+z`);await expect(englishEditor).toHaveText('SELECT * FROM datos;',{useInnerText:true})
 await page.evaluate(()=>window.freya.setLanguage('es'))
 await expect(editor()).toBeVisible();expect(await originalEditor!.evaluate(element=>element.isConnected)).toBe(true)
})


test('SIM-2f: el texto del botón principal contrasta en claro y oscuro',async()=>{
 const run=panel().getByRole('button',{name:'Ejecutar consulta',exact:true})
 const samples:{theme:string;ink:string;background:string;ratio:number}[]=[]
 const luminance=(rgb:string)=>rgb.match(/[\d.]+/g)!.slice(0,3).map(Number).map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)
 for(const theme of ['light','dark']){
  await page.getByLabel('Tema',{exact:true}).selectOption(theme)
  await expect.poll(async()=>{const colors=await run.locator('span').last().evaluate(element=>({ink:getComputedStyle(element).color,background:getComputedStyle(element.closest('button')!).backgroundColor})),a=luminance(colors.ink),b=luminance(colors.background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}).toBeGreaterThanOrEqual(4.5)
  const colors=await run.locator('span').last().evaluate(element=>({ink:getComputedStyle(element).color,background:getComputedStyle(element.closest('button')!).backgroundColor})),a=luminance(colors.ink),b=luminance(colors.background);samples.push({theme,...colors,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)})
 }
 await test.info().attach('sql-primary-contrast',{body:JSON.stringify(samples,null,2),contentType:'application/json'})
})
