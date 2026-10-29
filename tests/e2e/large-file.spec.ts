import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

// L2 · archivos grandes: el CSV se indexa por posición y se lee por páginas. FREYALAB_LARGE_BYTES (solo en pruebas) baja el umbral de 50 MiB
// a 1 KiB para que un fichero de unos KB use exactamente el mismo camino que uno de varios GiB.
let app:ElectronApplication,page:Page,folder:string
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-large-e2e-'));await mkdir(join(folder,'saved'));await mkdir(join(folder,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LARGE_BYTES:'1024',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1600,height:900})
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

const csv=(count:number)=>'id,nombre\n'+Array.from({length:count},(_,i)=>`${String(i+1).padStart(6,'0')},Cliente ${i+1}`).join('\n')+'\n'
async function open(text:string,name='ventas.csv'){const path=join(folder,name);await writeFile(path,text);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);await expect(page.getByRole('grid',{name:'Tabla de datos'})).toBeVisible();return{doc,path}}
const cell=(row:number,column='id')=>page.getByRole('gridcell',{name:`Fila ${row}, ${column}`,exact:true})

test('un CSV por encima del umbral se abre como archivo grande: aviso, recuento exacto y sin el límite de 200 filas',async()=>{
 const {doc}=await open(csv(3000))
 expect(doc).toMatchObject({readonly:true,large:true,rowCount:3000})
 await expect(page.locator('.warning-banner').first()).toContainText('Archivo grande')
 await expect(page.locator('footer')).toContainText('3,000 de 3,000 filas · archivo grande')
 await expect(page.getByRole('grid',{name:'Tabla de datos'})).toHaveAttribute('aria-rowcount','3001')
 await expect(cell(1)).toHaveText('000001')
})

test('«Ir a la fila»: botón y Ctrl/⌘ + G, validación, foco y Escape',async()=>{
 await open(csv(3000))
 const button=page.getByRole('button',{name:'Ir a la fila',exact:true}),input=page.getByRole('spinbutton',{name:'Número de fila',exact:true})
 await button.click();await expect(input).toBeFocused()
 await input.fill('2500');await input.press('Enter')
 await expect(cell(2500)).toHaveText('002500');await expect(cell(2500)).toBeFocused();await expect(page.locator('#dock-announcement')).toHaveText('Fila 2,500 de 3,000') // lo anuncia el lector de pantalla
 await page.keyboard.press('ControlOrMeta+G');await expect(input).toBeFocused()
 await input.fill('9999');await input.press('Enter');await expect(page.getByRole('alert')).toContainText('Escribe un número entre 1 y 3,000.');await expect(input).toBeFocused()
 await input.fill('0');await input.press('Enter');await expect(page.getByRole('alert')).toContainText('entre 1 y 3,000')
 await input.press('Escape');await expect(input).toHaveCount(0);await expect(button).toBeFocused()
 await button.click();await input.fill('1');await input.press('Enter');await expect(cell(1)).toBeFocused()
})

test('lo que aún no existe en archivos grandes está deshabilitado y el documento no cambia',async()=>{
 const {doc,path}=await open(csv(3000)),before=await readFile(path,'utf8'),bar=page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true})
 await expect(page.getByLabel('Buscar en tabla',{exact:true})).toBeEnabled()
 await expect(page.getByLabel('Buscar en tabla',{exact:true})).toHaveAttribute('placeholder','Buscar en el archivo completo (Enter)')
 await expect(bar.getByRole('button',{name:'Reemplazar',exact:true})).toBeDisabled()
 await expect(bar.getByLabel('Filtrar',{exact:true})).toHaveAttribute('aria-disabled','false')
 await bar.getByLabel('Filtrar',{exact:true}).click();await expect(page.getByRole('heading',{name:'Filtrar archivo completo',exact:true})).toBeVisible();await page.getByLabel('Cerrar filtros',{exact:true}).click()
 await expect(page.locator('.sort-button').first()).toBeDisabled() // la cabecera ya no ordena
 await page.getByRole('button',{name:'Acciones de la columna id',exact:true}).click()
 const menu=page.getByRole('menu',{name:'Acciones de columnas',exact:true});await expect(menu).toBeVisible()
 for(const item of await menu.getByRole('menuitem').all())if(await item.textContent()==='Filtrar esta columna')await expect(item).toBeEnabled();else await expect(item).toBeDisabled()
 await page.keyboard.press('Escape');await expect(menu).toHaveCount(0)
 await cell(2).dblclick();await expect(page.getByLabel('Editar celda',{exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:'Seleccionar fila 1',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0) // sin error por pedir estadísticas
 await bar.getByLabel('Analizar',{exact:true}).click();await expect(page.getByRole('tabpanel',{name:'Resumen'})).toContainText('aún no están disponibles en archivos grandes')
 expect(await readFile(path,'utf8')).toBe(before);expect((await page.evaluate(()=>window.freya.documents())).find(item=>item.id===doc.id)).toMatchObject({dirty:false,revision:0})
})

test('llega a cualquier fila de un archivo de 700 000 filas, más allá del techo de altura de Chromium',async()=>{
 await open('n\n'+Array.from({length:700000},(_,i)=>i+1).join('\n')+'\n','muchas.csv')
 await expect(page.locator('footer')).toContainText('700,000 de 700,000 filas · archivo grande')
 const input=page.getByRole('spinbutton',{name:'Número de fila',exact:true})
 for(const row of [650000,524287,700000,350000]){
  await page.getByRole('button',{name:'Ir a la fila',exact:true}).click();await input.fill(String(row));await input.press('Enter')
  await expect(cell(row,'n')).toHaveText(String(row));await expect(cell(row,'n')).toBeFocused()
 }
})
