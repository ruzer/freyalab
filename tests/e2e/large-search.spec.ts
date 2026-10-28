import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,folder:string
async function launch(extra:Record<string,string>={}){
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LARGE_BYTES:'1024',FREYALAB_USER_DATA:join(folder,'profile'),...extra}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
}
async function quit(){await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{})}
test.beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-large-search-'));await launch()})
test.afterEach(async()=>{await quit();await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
const csv=(count:number)=>'id,nombre\n'+Array.from({length:count},(_,i)=>`${String(i+1).padStart(6,'0')},Cliente ${i+1}`).join('\n')+'\n'
const grid=()=>page.getByRole('grid',{name:'Tabla de datos',exact:true})
const search=()=>page.getByLabel('Buscar en tabla',{exact:true})
const statePanel=()=>page.getByRole('region',{name:'Búsqueda en archivo grande',exact:true})
const cell=(row:number)=>page.getByRole('gridcell',{name:`Fila ${row}, id`,exact:true})
async function open(count=3000,name='ventas.csv'){
 const source=csv(count),path=join(folder,name);await writeFile(path,source)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(search()).toBeEnabled();await expect(grid()).toHaveAttribute('aria-rowcount',String(count+1))
 return{doc,path,source}
}
async function find(text:string){await search().fill(text);await search().press('Enter')}
async function capture(name:string){
 for(const theme of ['light','dark']){
  await page.getByLabel('Tema',{exact:true}).selectOption(theme)
  await expect.poll(()=>page.locator('html').evaluate(node=>node.classList.contains('dark'))).toBe(theme==='dark')
  await page.screenshot({animations:'disabled',path:test.info().outputPath(`large-search-${name}-${theme}-1440x900.png`)})
 }
}

test('buscar en archivo grande se aplica explícitamente con Enter',async()=>{
 const {doc,path,source}=await open()
 const input=page.getByLabel('Buscar en tabla',{exact:true})
 await expect(input).toBeVisible();await expect(input).toBeEnabled({timeout:1000})
 await input.fill('Cliente 2300');await expect(page.getByRole('grid',{name:'Tabla de datos'})).toHaveAttribute('aria-rowcount','3001')
 expect(await page.evaluate(id=>window.freya.tableViewState(id),doc.id)).toBeNull()
 await input.press('Enter');await expect(page.getByRole('gridcell',{name:'Fila 2300, id',exact:true})).toHaveText('002300')
 await expect(page.locator('footer')).toContainText('1 coincidencia')
 await expect(grid().locator('mark')).toHaveText('Cliente 2300')
 const applied=await page.evaluate(id=>window.freya.tableViewState(id),doc.id)
 await input.fill('sin aplicar');expect((await page.evaluate(id=>window.freya.tableViewState(id),doc.id))?.requestId).toBe(applied?.requestId)
 await expect(grid()).toHaveAttribute('aria-rowcount','2');await expect(grid().locator('mark')).toHaveText('Cliente 2300')
 await expect(statePanel()).toContainText('usan el documento completo, no esta vista')
 await capture('complete');expect(await readFile(path,'utf8')).toBe(source)
})

test('sin coincidencias permite ir a una fila original; vacío y Escape quitan la vista',async()=>{
 await open();await find('zzq99')
 await expect(statePanel()).toContainText('Sin coincidencias en 3,000 filas');await expect(grid()).toHaveAttribute('aria-rowcount','1')
 await capture('empty')
 await page.getByRole('button',{name:'Ir a la fila',exact:true}).click()
 const row=page.getByRole('spinbutton',{name:'Número de fila',exact:true});await expect(row).toHaveAttribute('max','3000');await row.fill('2300');await row.press('Enter')
 await expect(cell(2300)).toBeFocused();await expect(grid()).toHaveAttribute('aria-rowcount','3001');await expect(page.locator('#dock-announcement')).toContainText('Se quitó la búsqueda para ir a la fila 2,300')
 await find('Cliente 2300');await expect(grid()).toHaveAttribute('aria-rowcount','2');await search().fill('');await search().press('Enter')
 await expect(statePanel()).toHaveCount(0);await expect(grid()).toHaveAttribute('aria-rowcount','3001')
 await find('Cliente 2300');await expect(grid()).toHaveAttribute('aria-rowcount','2');await search().fill('');await search().press('Escape')
 await expect(statePanel()).toHaveCount(0);await expect(search()).toBeFocused();await expect(grid()).toHaveAttribute('aria-rowcount','3001')
})

test('ver en el documento completo desde la fila y el atajo conserva número y foco',async()=>{
 await open();await find('Cliente 2300');await expect(cell(2300)).toHaveText('002300')
 await page.getByRole('button',{name:'Seleccionar fila 2300',exact:true}).click({button:'right'})
 const menu=page.getByRole('menu',{name:'Acciones de filas',exact:true});await menu.getByRole('menuitem',{name:'Ver en el documento completo',exact:true}).click()
 await expect(statePanel()).toHaveCount(0);await expect(cell(2300)).toBeFocused();await expect(grid()).toHaveAttribute('aria-rowcount','3001')
 await find('Cliente 2300');await expect(grid()).toHaveAttribute('aria-rowcount','2');await cell(2300).focus();await page.keyboard.press('ControlOrMeta+Shift+G')
 await expect(statePanel()).toHaveCount(0);await expect(cell(2300)).toBeFocused();await expect(grid()).toHaveAttribute('aria-rowcount','3001')
})

test('una vista se recupera al volver a su pestaña sin iniciar otro recorrido',async()=>{
 const {doc}=await open();await find('Cliente 2300');await expect(grid()).toHaveAttribute('aria-rowcount','2')
 const applied=await page.evaluate(id=>window.freya.tableViewState(id),doc.id)
 await open(200,'otro.csv');await page.getByRole('tab',{name:/^ventas\.csv/}).click()
 await expect(search()).toHaveValue('Cliente 2300');await expect(grid()).toHaveAttribute('aria-rowcount','2');await expect(cell(2300)).toHaveText('002300')
 expect((await page.evaluate(id=>window.freya.tableViewState(id),doc.id))?.requestId).toBe(applied?.requestId)
})

test('cancelar conserva un parcial honesto y una búsqueda nueva no recibe resultados anteriores',async()=>{
 await quit();await launch({FREYALAB_VIEW_BATCH:'25',FREYALAB_VIEW_DELAY_MS:'50'})
 const {doc,path,source}=await open(10000);await find('Cliente')
 const progress=page.getByRole('progressbar',{name:'Avance de la búsqueda',exact:true});await expect(progress).toBeVisible()
 await expect.poll(async()=>Number(await progress.getAttribute('value'))).toBeGreaterThan(0)
 await expect(cell(1)).toHaveText('000001');await capture('running')
 await search().press('Escape');await expect(statePanel()).toContainText('Búsqueda cancelada:');await expect(statePanel()).toContainText('filas examinadas');await expect(statePanel()).toContainText('Resultado parcial');await expect(statePanel()).not.toContainText('primeras')
 await expect(search()).toBeFocused();expect((await page.evaluate(id=>window.freya.tableViewState(id),doc.id))?.status).toBe('cancelled');await capture('cancelled')
 await find('Cliente');await expect(progress).toBeVisible();await find('Cliente 9900')
 await expect(cell(9900)).toHaveText('009900');await expect(grid()).toHaveAttribute('aria-rowcount','2');await expect(statePanel()).toContainText('1 coincidencia de 10,000 filas')
 expect((await page.evaluate(id=>window.freya.tableViewState(id),doc.id))?.query.search).toBe('Cliente 9900');expect(await readFile(path,'utf8')).toBe(source)
})

test('el tope de coincidencias conserva una vista parcial y mantiene bloqueadas las mutaciones',async()=>{
 await quit();await launch({FREYALAB_VIEW_LIMIT:'7',FREYALAB_VIEW_BATCH:'25'})
 const {path,source}=await open();await find('Cliente')
 await expect(statePanel()).toContainText('Se detuvo al llegar a 7 coincidencias');await expect(statePanel()).toContainText('Resultado parcial');await expect(grid()).toHaveAttribute('aria-rowcount','8')
 const bar=page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true})
 await expect(bar.getByLabel('Filtrar',{exact:true})).toHaveAttribute('aria-disabled','false')
 for(const name of ['Limpiar datos','Filas y columnas']){const button=bar.getByLabel(name,{exact:true});await expect(button).toHaveAttribute('aria-disabled','true');await expect(button).toHaveCSS('opacity','0.45')}
 await expect(bar.getByRole('button',{name:'Reemplazar',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Guardar',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Exportar',exact:false}).first()).toBeDisabled()
 await capture('limit');expect(await readFile(path,'utf8')).toBe(source)
})

test('pedir otra página invalida la vista si el archivo cambió y no mezcla versiones',async()=>{
 const {path,source}=await open();await find('Cliente');await expect(statePanel()).toContainText('3,000 coincidencias de 3,000 filas')
 await writeFile(path,source+'003001,Cliente nuevo\n')
 await grid().evaluate(node=>node.scrollTo({top:node.scrollHeight}))
 await expect(statePanel()).toContainText('El archivo cambió desde la búsqueda');await expect(grid().getByRole('gridcell')).toHaveCount(0)
})

test('un registro inválido sin la aguja detiene la búsqueda sin presentarla como completa',async()=>{
 const path=join(folder,'roto.csv');await writeFile(path,csv(300)+'000301,"mal"cerrado\n')
 await page.evaluate(path=>window.freya.openPaths([path]),path);await expect(search()).toBeEnabled();await find('zzq99')
 await expect(statePanel()).toContainText('Búsqueda detenida:');await expect(statePanel()).toContainText(/registro/i);await expect(statePanel()).toContainText('Resultado parcial')
})
