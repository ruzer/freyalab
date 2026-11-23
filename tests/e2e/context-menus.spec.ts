import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {closeElectron} from './close-electron'
import {traceElectronFailure} from './electron-trace'

let app:ElectronApplication,page:Page,folder:string,files:string,csv:string,markdown:string,stopTrace:()=>Promise<void>
const source='Folio,Importe,Ciudad\r\n00123,12.50,Oaxaca\r\n9007199254740993,40,Mérida\r\n'
test.beforeEach(async({},info)=>{
 folder=await mkdtemp(join(tmpdir(),'freya-context-shared-'));files=join(folder,'datos');await mkdir(files);await mkdir(join(files,'Carpeta'))
 csv=join(files,'encuesta.csv');markdown=join(files,'apuntes.md');await writeFile(csv,source);await writeFile(markdown,'Hola mundo\n')
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_TEST_FOLDER:files,FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();stopTrace=await traceElectronFailure(page.context(),info);await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1280,height:720})
 await page.locator('.toolbar-left').getByRole('button',{name:'Abrir carpeta',exact:true}).click()
 await expect(page.locator('.tree-scroll').getByRole('button',{name:'encuesta.csv',exact:true})).toBeVisible()
 await page.evaluate(path=>window.freya.openPaths([path]),csv)
 await expect(page.getByRole('gridcell',{name:'Fila 1, Folio',exact:true})).toBeVisible()
})
test.afterEach(async()=>{
 try{await stopTrace?.();expect(await readFile(csv,'utf8')).toBe(source)}
 finally{try{await closeElectron(app)}finally{await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}
})
async function structure(menu:Locator){
 return menu.evaluate(node=>Array.from(node.querySelectorAll('[role="menuitem"],[role="separator"],.column-menu-title')).filter(item=>item.closest('[role="menu"]')===node).map(item=>{
  if(item.getAttribute('role')==='separator')return '|'
  const copy=item.cloneNode(true) as HTMLElement;copy.querySelectorAll('kbd,svg,[aria-hidden="true"]').forEach(child=>child.remove())
  return copy.textContent?.trim().replace(/\s+/g,' ')
 }))
}
const rootMenu=()=>page.getByRole('menu').first()

test('SIM-1h celda conserva título, grupos, altura y teclado comunes',async()=>{
 const cell=page.getByRole('gridcell',{name:'Fila 1, Importe',exact:true})
 await cell.click({button:'right'});const menu=rootMenu();await expect(menu).toBeVisible()
 expect(await structure(menu)).toEqual(['Importe · fila 1','Cortar…','Copiar','Pegar…','|','Rellenar…','Vaciar…','Limpiar','|','Estadísticas de la selección'])
 await page.keyboard.press('Escape');await expect(cell).toBeFocused()
 await cell.press('Shift+F10');expect(await structure(rootMenu())).toEqual(['Importe · fila 1','Cortar…','Copiar','Pegar…','|','Rellenar…','Vaciar…','Limpiar','|','Estadísticas de la selección'])
 await page.keyboard.press('Escape');await expect(cell).toBeFocused()
})

test('SIM-1h fila conserva estructura, peligro y submenú',async()=>{
 const row=page.getByRole('button',{name:'Seleccionar fila 1',exact:true});await row.click({button:'right'});const menu=rootMenu();await expect(menu).toBeVisible()
 expect(await structure(menu)).toEqual(['Fila 1','Insertar arriba','Insertar abajo','Duplicar fila','|','Limpiar','|','Eliminar fila'])
 await page.keyboard.press('Escape');await expect(row).toBeFocused()
})

test('SIM-1h texto Markdown tiene edición contextual y no usa el menú de cuadrícula',async()=>{
 await page.evaluate(path=>window.freya.openPaths([path]),markdown)
 const editor=page.locator('.cm-editor .cm-content');await expect(editor).toHaveText('Hola mundo');await editor.click({button:'right'})
 const menu=rootMenu();await expect(menu).toBeVisible()
 expect(await structure(menu)).toEqual(['Cortar','Copiar','Pegar','Pegar sin formato','|','Seleccionar todo'])
 await page.keyboard.press('Escape');await expect(editor).toBeFocused()
})

test('SIM-1h pestaña de documento muestra cerrar y revelar',async()=>{
 const tab=page.getByRole('tab',{name:'encuesta.csv',exact:true});await tab.click({button:'right'});const menu=rootMenu();await expect(menu).toBeVisible()
 expect(await structure(menu)).toEqual(['encuesta.csv','Cerrar','|','Mostrar en la carpeta'])
 await page.keyboard.press('Escape');await expect(tab).toBeFocused()
})

test('SIM-1h Archivos admite otros formatos y carpetas',async()=>{
 const file=page.locator('.tree-scroll').getByRole('button',{name:'apuntes.md',exact:true});await file.click({button:'right'});let menu=rootMenu();await expect(menu).toBeVisible()
 expect(await structure(menu)).toEqual(['apuntes.md','Abrir','|','Mostrar en la carpeta'])
 await page.keyboard.press('Escape');await expect(file).toBeFocused()
 const dir=page.locator('.tree-scroll').getByRole('button',{name:'Carpeta',exact:true});await dir.press('Shift+F10');menu=rootMenu();await expect(menu).toBeVisible()
 expect(await structure(menu)).toEqual(['Carpeta','Mostrar en la carpeta']);await page.keyboard.press('Escape');await expect(dir).toBeFocused()
})
