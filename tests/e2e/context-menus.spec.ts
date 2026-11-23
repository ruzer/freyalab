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
 try{await stopTrace?.();await app.evaluate(async({clipboard})=>{const saved=Reflect.get(globalThis,'contextClipboard') as import('electron').ClipboardItem[]|undefined;if(saved){if(saved.length)await clipboard.write(saved);else clipboard.clear();Reflect.deleteProperty(globalThis,'contextClipboard')}});expect(await readFile(csv,'utf8')).toBe(source)}
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


test('SIM-1h edición contextual conserva selección, historial y campos de diálogo',{tag:'@solo'},async()=>{
 // Los formatos originales permanecen solo en memoria de main, nunca en la traza.
 await app.evaluate(async({clipboard,ClipboardItem})=>{
  const items=(await clipboard.read()).filter(item=>item.types.length)
  const saved=await Promise.all(items.map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))))
  if(saved.length)await clipboard.write(saved)
  Reflect.set(globalThis,'contextClipboard',saved);clipboard.writeText('SIM1h sintético')
 })
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),markdown)
 const editor=page.locator('.cm-content');await editor.focus();await editor.press('ControlOrMeta+Home');for(let i=0;i<5;i++)await editor.press('ArrowRight');await editor.press('Shift+End');await editor.press('Shift+F10')
 await rootMenu().getByRole('menuitem',{name:'Copiar',exact:true}).click();await expect.poll(()=>app.evaluate(({clipboard})=>clipboard.readText())).toBe('mundo')
 await editor.press('ControlOrMeta+End');await editor.press('Shift+F10');await rootMenu().getByRole('menuitem',{name:'Pegar',exact:true}).click()
 await expect.poll(()=>page.evaluate(id=>window.freya.documents().then(docs=>docs.find(doc=>doc.id===id)?.text),doc.id)).toBe('Hola mundo\nmundo')
 await editor.press('ControlOrMeta+z');await expect.poll(()=>page.evaluate(id=>window.freya.documents().then(docs=>docs.find(doc=>doc.id===id)?.text),doc.id)).toBe('Hola mundo\n')
 await page.getByRole('tab',{name:'encuesta.csv',exact:true}).click();await page.getByRole('gridcell',{name:'Fila 1, Importe',exact:true}).click({button:'right'});await rootMenu().getByRole('menuitem',{name:'Rellenar…',exact:true}).click()
 const dialog=page.getByRole('dialog'),field=dialog.getByRole('textbox',{name:'Valor del rango',exact:true});await field.fill('Texto de diálogo');await field.press('ControlOrMeta+a');await field.press('Shift+F10')
 const menu=rootMenu();await expect(menu).toBeVisible();await menu.getByRole('menuitem',{name:'Copiar',exact:true}).click();await expect.poll(()=>app.evaluate(({clipboard})=>clipboard.readText())).toBe('Texto de diálogo')
 await expect(dialog).toBeVisible();expect(await readFile(markdown,'utf8')).toBe('Hola mundo\n')
})

test('SIM-1h solo el menú contextual bloquea copiar sin selección; lectura bloquea mutaciones',async()=>{
 await page.evaluate(path=>window.freya.openPaths([path]),markdown)
 let editor=page.locator('.cm-content');await editor.focus();await editor.press('ControlOrMeta+Home')
 await expect.poll(()=>app.evaluate(({Menu})=>Menu.getApplicationMenu()?.getMenuItemById('edit.copy')?.enabled)).toBe(true)
 await editor.press('Shift+F10');await expect(rootMenu().getByRole('menuitem',{name:'Copiar',exact:true})).toBeDisabled();await expect(rootMenu().getByRole('menuitem',{name:'Cortar',exact:true})).toBeDisabled();await page.keyboard.press('Escape')
 await expect.poll(()=>app.evaluate(({Menu})=>Menu.getApplicationMenu()?.getMenuItemById('edit.copy')?.enabled)).toBe(true)
 const path=join(files,'lectura.txt'),bytes=Buffer.from('Hola\n','utf16le');await writeFile(path,bytes);await page.evaluate(path=>window.freya.openPaths([path]),path)
 editor=page.locator('.cm-content');await expect(editor).toHaveAttribute('contenteditable','false');await editor.focus();await editor.press('Shift+F10')
 await expect(rootMenu().getByRole('menuitem',{name:'Cortar',exact:true})).toBeDisabled();await expect(rootMenu().getByRole('menuitem',{name:'Pegar',exact:true})).toBeDisabled();expect(await readFile(path)).toEqual(bytes)
})
