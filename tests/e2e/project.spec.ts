import {expect,test,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t} from '../../src/shared/i18n'

let app:ElectronApplication,page:Page,root:string,folder:string
const manifest=()=>join(folder,'proyecto.freyalab')
test.beforeEach(async({},info)=>{
 root=await mkdtemp(join(tmpdir(),'freya-project-e2e-'));folder=join(root,'Censo');await mkdir(folder)
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,
  args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],
  env:{...process.env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:info.title.endsWith('[en-XA]')?'en-XA':'es',FREYALAB_USER_DATA:join(root,'profile'),FREYALAB_TEST_FOLDER:folder}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
})
test.afterEach(async()=>{if(app?.process().exitCode===null)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
const projectTab=()=>page.getByRole('tab',{name:'Proyecto',exact:true})
const projectPanel=()=>page.getByRole('tabpanel',{name:'Proyecto',exact:true})

async function openNative(id:string){
 await app.evaluate(({Menu},id)=>{const item=Menu.getApplicationMenu()?.getMenuItemById(id);if(!item)throw new Error('No se encontró el comando de menú '+id);item.click()},id)
}

test('crea con el teclado, abre por carpeta, manifiesto y menú de recientes',async()=>{
 await page.getByRole('button',{name:'Crear proyecto',exact:true}).press('Enter')
 const dialog=page.getByRole('dialog',{name:'Nuevo proyecto',exact:true})
 await dialog.getByRole('button',{name:'Elegir carpeta…'}).press('Enter')
 await expect(dialog.getByRole('textbox',{name:'Nombre',exact:true})).toHaveValue('Censo')
 await dialog.getByRole('textbox',{name:'Nombre',exact:true}).fill('Población')
 await dialog.getByRole('checkbox',{name:'Crear estructura sugerida'}).press('Space')
 await dialog.getByRole('button',{name:'Crear proyecto',exact:true}).press('Enter')
 await expect(projectTab()).toHaveAttribute('aria-selected','true')
 await expect(projectPanel()).toContainText('Población')
 await expect(projectPanel()).toContainText('Todavía no hay fuentes')
 const original=await readFile(manifest(),'utf8')
 expect(JSON.parse(original)).toMatchObject({name:'Población',version:1,sources:[],recipes:[],results:[]})
 expect((await readdir(folder)).sort()).toEqual(['01_raw','02_datasets','03_charts','04_reports','proyecto.freyalab'])

 await projectTab().press('Home')
 await expect(page.getByRole('tab',{name:'Archivos',exact:true})).toBeFocused()
 await page.getByRole('tab',{name:'Archivos',exact:true}).press('End')
 await expect(projectTab()).toBeFocused()
 await projectPanel().getByRole('button',{name:'Cerrar proyecto'}).press('Enter')
 await expect(projectTab()).toHaveCount(0)
 await openNative('file.openFolder')
 await expect(projectTab()).toHaveAttribute('aria-selected','true')
 await projectPanel().getByRole('button',{name:'Cerrar proyecto'}).press('Enter')
 await page.evaluate(path=>window.freya.openPaths([path]),manifest())
 await expect(projectTab()).toHaveAttribute('aria-selected','true')
 await projectPanel().getByRole('button',{name:'Cerrar proyecto'}).press('Enter')
 await openNative('project.recent.0')
 await expect(projectPanel()).toContainText('Población')
 expect(await readFile(manifest(),'utf8')).toBe(original)
 await rm(folder,{recursive:true})
 await projectPanel().getByRole('button',{name:'Cerrar proyecto'}).press('Enter')
 await expect(page.getByText('No está en su ruta: Censo',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Quitar de recientes: Censo'}).press('Enter')
 await expect(page.getByText('No está en su ruta: Censo',{exact:true})).toHaveCount(0)
})

test('una versión futura se abre en solo lectura y conserva todos sus bytes',async()=>{
 const original='{"format":"freyalab-project","version":2,"id":"future","name":"El futuro","datosDesconocidos":{"keep":true}}'
 await writeFile(manifest(),original)
 await openNative('file.openFolder')
 await expect(projectPanel()).toContainText('El futuro')
 await expect(projectPanel().getByRole('status')).toContainText('solo lectura')
 await expect(projectPanel().getByRole('button',{name:'Renombrar proyecto'})).toHaveCount(0)
 await projectPanel().getByRole('button',{name:'Cerrar proyecto'}).click()
 expect(await readFile(manifest(),'utf8')).toBe(original)
})


test('Cancelar limpia la carpeta elegida y no crea el manifiesto',async()=>{
 await page.getByRole('button',{name:'Crear proyecto',exact:true}).press('Enter')
 const dialog=page.getByRole('dialog',{name:'Nuevo proyecto',exact:true})
 await dialog.getByRole('button',{name:'Elegir carpeta…'}).press('Enter')
 await expect(dialog.getByRole('textbox',{name:'Nombre',exact:true})).toHaveValue('Censo')
 await dialog.press('Escape')
 await expect(dialog).toHaveCount(0)
 expect(await page.evaluate(async()=>{try{await window.freya.projectCreate('Proyecto cancelado',false);return true}catch{return false}})).toBe(false)
 expect(await readdir(folder)).toEqual([])
})

for(const locale of ['es','en-XA'] as const)test(`proyecto se muestra en los dos temas a 1440 × 900 [${locale}]`,async({},info)=>{
 const tr=(key:string)=>t(key,{},locale)
 await page.setViewportSize({width:1440,height:900})
 await page.getByRole('button',{name:tr('project.create'),exact:true}).click()
 const dialog=page.getByRole('dialog',{name:tr('project.new'),exact:true})
 await dialog.getByRole('button',{name:tr('project.pickFolder')}).click()
 await dialog.getByRole('button',{name:tr('project.create'),exact:true}).click()
 const tab=page.getByRole('tab',{name:tr('project.tab'),exact:true})
 await expect(tab).toBeFocused()
 const panel=page.getByRole('tabpanel',{name:tr('project.tab'),exact:true})
 await expect(panel).toContainText(tr('project.noSources'))
 for(const theme of ['light','dark']){
  await page.getByRole('combobox',{name:'Tema'}).selectOption(theme)
  if(theme==='dark')await expect(page.locator('html')).toHaveClass(/dark/)
  else await expect(page.locator('html')).not.toHaveClass(/dark/)
  const path=info.outputPath(`prj-01a-${locale}-${theme}-1440x900.png`)
  await page.screenshot({animations:'disabled',path})
  await info.attach(`${locale}-${theme}`,{path,contentType:'image/png'})
 }
})
