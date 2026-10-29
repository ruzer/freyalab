import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,folder:string
async function launch(extra:Record<string,string>={}){
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LARGE_BYTES:'1024',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXTRACT_DIR:join(folder,'extracts'),...extra}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
}
async function quit(){await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{})}
test.beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-large-filter-'));await mkdir(join(folder,'extracts'));await launch()})
test.afterEach(async()=>{await quit();await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
const source=()=> 'id,text,amount,date\n'+Array.from({length:2000},(_,i)=>`${String(i+1).padStart(6,'0')},grupo ${i%2?'b':'a'},${i+1},2026-10-28`).join('\n')+'\n'
const grid=()=>page.getByRole('grid',{name:'Tabla de datos',exact:true})
const panel=()=>page.locator('section.query-tools')
const search=()=>page.getByLabel('Buscar en tabla',{exact:true})
async function open(){const path=join(folder,'data.csv'),text=source();await writeFile(path,text);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);await expect(search()).toBeEnabled();await expect(grid()).toHaveAttribute('aria-rowcount','2001');return {path,text,doc}}
async function filters(){await page.getByLabel('Filtrar',{exact:true}).click();await expect(panel().getByRole('button',{name:'Aplicar',exact:true})).toBeVisible()}
async function add(column:string,op:string,value:string){await panel().getByRole('button',{name:'Añadir condición',exact:true}).click();const n=await panel().locator('.rule').count();await panel().getByLabel(`Columna de condición ${n}`,{exact:true}).selectOption(column);await panel().getByLabel(`Operador de condición ${n}`,{exact:true}).selectOption(op);await panel().getByLabel(`Valor de condición ${n}`,{exact:true}).fill(value)}
async function apply(){await panel().getByRole('button',{name:'Aplicar',exact:true}).click();await expect(panel()).toHaveCount(0)}
async function capture(name:string){for(const theme of ['light','dark']){await page.getByLabel('Tema',{exact:true}).selectOption(theme);await page.screenshot({animations:'disabled',path:test.info().outputPath(`large-filter-${name}-${theme}-1440x900.png`)})}}

test('Filtrar en grande abre condiciones que se aplican explícitamente y se combinan con la búsqueda aplicada',async()=>{
 const {path,text,doc}=await open(),filter=page.getByLabel('Filtrar',{exact:true});await expect(filter).not.toHaveAttribute('aria-disabled','true',{timeout:1000});await filters()
 await add('1','equals','grupo b');await expect(grid()).toHaveAttribute('aria-rowcount','2001');expect(await page.evaluate(id=>window.freya.tableViewState(id),doc.id)).toBeNull();await capture('panel')
 await panel().getByRole('button',{name:'Aplicar',exact:true}).focus();await page.keyboard.press('Enter');await expect(grid()).toHaveAttribute('aria-rowcount','1001');await expect(filter).toBeFocused();await expect(page.getByText(/Vista filtrada: 1 condición/)).toContainText('todas');await capture('applied')
 await search().fill('sin aplicar');await filters();await panel().getByLabel('Valor de condición 1',{exact:true}).fill('grupo a');await apply();await expect(grid().getByRole('gridcell',{name:'Fila 1, id',exact:true})).toHaveText('000001');expect((await page.evaluate(id=>window.freya.tableViewState(id),doc.id))?.query.search).toBeUndefined()
 await search().fill('grupo a');await search().press('Enter');await expect(grid()).toHaveAttribute('aria-rowcount','1001');await filters();await panel().getByLabel('Valor de condición 1',{exact:true}).fill('grupo b');await apply();await expect(grid()).toHaveAttribute('aria-rowcount','1')
 await filters();await add('2','greater','1997');await panel().getByLabel('Combinar condiciones',{exact:true}).selectOption('any');await apply();await expect(grid()).toHaveAttribute('aria-rowcount','2');await expect(grid().getByRole('gridcell',{name:'Fila 1999, id',exact:true})).toHaveText('001999')
 await search().fill('');await search().press('Enter');await expect(grid()).toHaveAttribute('aria-rowcount','1002');await expect(page.getByText(/Vista filtrada:/)).toContainText('cualquiera')
 await page.getByRole('button',{name:'Quitar búsqueda',exact:true}).click();await expect(grid()).toHaveAttribute('aria-rowcount','2001');expect(await readFile(path,'utf8')).toBe(text)
})

test('el menú de columna precarga la columna y un error conserva la vista anterior sin iniciar un recorrido',async()=>{
 const {doc}=await open();await search().fill('grupo');await search().press('Enter');await expect(page.locator('.large-search-status')).toContainText('2,000 coincidencias');const previous=await page.evaluate(id=>window.freya.tableViewState(id),doc.id)
 await page.getByRole('button',{name:'Acciones de la columna amount',exact:true}).click();await page.getByRole('menuitem',{name:'Filtrar esta columna',exact:true}).click();await expect(panel().getByLabel('Columna de condición 1',{exact:true})).toHaveValue('2');await expect(panel().getByRole('button',{name:'Añadir orden',exact:true})).toHaveCount(0)
 await panel().getByLabel('Operador de condición 1',{exact:true}).selectOption('greater');await panel().getByLabel('Valor de condición 1',{exact:true}).fill('1,5');await panel().getByRole('button',{name:'Aplicar',exact:true}).click();await expect(panel().getByRole('alert')).toContainText('punto decimal');expect((await page.evaluate(id=>window.freya.tableViewState(id),doc.id))?.requestId).toBe(previous?.requestId);await expect(grid()).toHaveAttribute('aria-rowcount','2001');await capture('condition-error')
 await panel().getByLabel('Operador de condición 1',{exact:true}).selectOption('regex');await panel().getByLabel('Valor de condición 1',{exact:true}).fill('[');await panel().getByRole('button',{name:'Aplicar',exact:true}).click();await expect(panel().getByRole('alert')).toContainText('Expresión regular no válida');expect((await page.evaluate(id=>window.freya.tableViewState(id),doc.id))?.requestId).toBe(previous?.requestId)
 await panel().getByLabel('Operador de condición 1',{exact:true}).selectOption('greater');await panel().getByLabel('Valor de condición 1',{exact:true}).fill('1997');await apply();await expect(grid()).toHaveAttribute('aria-rowcount','4');await expect(page.getByLabel('Filtrar',{exact:true})).toBeFocused()
})

test('Extraer precarga la regla aplicada y recorre todo aunque la vista tenga tope',async()=>{
 await quit();await launch({FREYALAB_VIEW_LIMIT:'7',FREYALAB_VIEW_BATCH:'25'});const {path,text}=await open();await search().fill('grupo');await search().press('Enter');await expect(page.locator('.large-search-status')).toContainText('Se detuvo al llegar a 7 coincidencias');await filters();await add('1','equals','grupo b');await apply();await expect(grid()).toHaveAttribute('aria-rowcount','8');await expect(grid().getByRole('gridcell',{name:'Fila 2, id',exact:true})).toHaveText('000002');await capture('partial')
 await search().fill('borrador no aplicado');await page.getByRole('button',{name:'Extraer filas',exact:true}).click();const extract=page.locator('section.extract-tools');await expect(extract).toContainText('Búsqueda global aplicada: grupo.');await expect(extract.getByLabel('Valor de condición 1',{exact:true})).toHaveValue('grupo b');await expect(extract).toContainText('La vista es parcial');await expect(extract).not.toContainText('borrador no aplicado')
 await extract.getByRole('button',{name:'Contar coincidencias',exact:true}).click();await expect(extract).toContainText(/1\.?000 de 2\.?000 filas cumplen/);await extract.getByRole('button',{name:/^Vista previa/}).click();await expect(extract.getByRole('region',{name:'Vista previa del extracto',exact:true}).locator('tbody tr')).toHaveCount(100)
 await extract.getByRole('button',{name:'Extraer a un archivo nuevo…',exact:true}).click();await expect(page.getByRole('tab',{name:/data\.extracto\.csv/})).toHaveAttribute('aria-selected','true');expect(await readFile(join(folder,'extracts','data.extracto.csv'),'utf8')).toBe(text.split('\n').filter((line,i)=>i===0||line.includes('grupo b')).join('\n')+'\n');expect(await readFile(path,'utf8')).toBe(text)
})
