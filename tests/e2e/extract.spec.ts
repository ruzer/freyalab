import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

// E1 · Extracto no destructivo de un archivo grande. FREYALAB_LARGE_BYTES baja el umbral de 50 MiB a 1 KiB: un fichero de unos KB usa el mismo camino que uno de GiB.
// FREYALAB_EXTRACT_BATCH / FREYALAB_EXTRACT_DELAY_MS (solo en pruebas) hacen la extracción lo bastante lenta como para poder cancelarla.
let app:ElectronApplication,page:Page,folder:string,extracts:string
async function launch(extra:Record<string,string>={}){
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LARGE_BYTES:'1024',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXTRACT_DIR:extracts,...extra}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1600,height:900})
}
async function quit(){await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{})}
test.beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-extract-e2e-'));extracts=join(folder,'extractos');await mkdir(join(folder,'saved'));await mkdir(extracts);await launch()})
test.afterEach(async()=>{await quit();await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

const lines=(count:number)=>Array.from({length:count},(_,i)=>`${String(i+1).padStart(6,'0')},Cliente ${i+1},${i%2?'norte':'sur'}`)
const csv=(count:number)=>'id,nombre,zona\n'+lines(count).join('\n')+'\n'
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex')
async function open(text:string,name='ventas.csv'){const path=join(folder,name);await writeFile(path,text);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);await expect(page.getByRole('grid',{name:'Tabla de datos'})).toBeVisible();return{doc,path}}
async function openPanel(){await page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true}).getByRole('button',{name:'Extraer filas',exact:true}).click();await expect(page.locator('section.extract-tools')).toBeVisible()}
async function condition(index:number,column:string,operator:string,value?:string){
 await page.getByRole('button',{name:'Añadir condición',exact:true}).click()
 await page.getByLabel(`Columna de condición ${index}`,{exact:true}).selectOption({label:column})
 await page.getByLabel(`Operador de condición ${index}`,{exact:true}).selectOption({label:operator})
 if(value!==undefined)await page.getByLabel(`Valor de condición ${index}`,{exact:true}).fill(value)
}

test('el botón de extracción solo existe en archivos grandes',async()=>{
 await open('a,b\n1,2\n','pequeno.csv')
 await expect(page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true}).getByRole('button',{name:'Extraer filas',exact:true})).toHaveCount(0)
})

test('cuenta, previsualiza y extrae filas completas: bytes idénticos, original intacto y extracto editable',async()=>{
 const text=csv(3000),{path}=await open(text),expected=['id,nombre,zona',...lines(3000).filter((_,i)=>String(i+1).endsWith('77'))]
 const before=sha(await readFile(path))
 await openPanel()
 await condition(1,'1. id','Termina en','77')
 await page.getByRole('button',{name:'Contar coincidencias',exact:true}).click()
 await expect(page.locator('section.extract-tools [role=status]').filter({hasText:'cumplen las condiciones'})).toContainText(/30 de 3\.?000 filas/)
 await page.getByRole('button',{name:/^Vista previa/}).click()
 const preview=page.getByRole('region',{name:'Vista previa del extracto',exact:true})
 await expect(preview).toContainText('Se muestran las 30 filas que coinciden.');await expect(preview.locator('tbody tr')).toHaveCount(30);await expect(preview.locator('tbody tr').first()).toContainText('000077')
 await page.getByRole('button',{name:'Extraer a un archivo nuevo…',exact:true}).click()
 await expect(page.getByRole('tab',{name:/ventas\.extracto\.csv/})).toHaveAttribute('aria-selected','true') // la app salta al archivo nuevo
 const output=join(extracts,'ventas.extracto.csv')
 expect((await readFile(output,'utf8'))).toBe(expected.join('\n')+'\n')
 expect(sha(await readFile(path))).toBe(before) // el original no cambia ni un byte
 expect(await readdir(extracts)).toEqual(['ventas.extracto.csv']) // sin temporales
 const documents=await page.evaluate(()=>window.freya.documents()),made=documents.find(item=>item.path?.endsWith('ventas.extracto.csv'))
 expect(made).toMatchObject({readonly:false,rowCount:30,extract:{sourceName:'ventas.csv',matched:30,total:3000,fidelity:'bytes',columns:null}})
 expect(documents.find(item=>item.name==='ventas.csv')).toMatchObject({large:true,readonly:true,revision:0,dirty:false})
 const banner=page.locator('.extract-banner');await expect(banner).toContainText(/Extracto de «ventas.csv» · 30 de 3\.?000 filas/);await expect(banner).toContainText('bytes conservados');await expect(banner).toContainText('El original no se modificó')
 await expect(page.locator('.warning-banner').filter({hasText:'Archivo grande'})).toHaveCount(0) // cumple los límites: se edita como cualquier CSV
 await expect(page.getByLabel('Buscar en tabla',{exact:true})).toBeEnabled()
 await page.getByRole('tab',{name:/^ventas\.csv/}).click();await openPanel() // el borrador de condiciones se conserva
 await expect(page.getByLabel('Valor de condición 1',{exact:true})).toHaveValue('77')
})

test('elegir columnas reescribe el CSV y lo avisa: valores iguales, formato normalizado',async()=>{
 const text='id,nombre,zona\r\n'+lines(3000).map(l=>l.replace('000002,Cliente 2,norte','000002,Cliente 2,"norte"')).join('\r\n')+'\r\n',{path}=await open(text)
 await openPanel()
 await condition(1,'3. zona','Es igual a','norte')
 await page.getByLabel('Todas las columnas',{exact:true}).uncheck()
 await expect(page.getByText('Elige al menos una columna.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Extraer a un archivo nuevo…',exact:true})).toBeDisabled()
 await page.getByLabel('Incluir columna 3',{exact:true}).check();await page.getByLabel('Incluir columna 1',{exact:true}).check()
 await page.getByRole('button',{name:'Extraer a un archivo nuevo…',exact:true}).click()
 const banner=page.locator('.extract-banner');await expect(banner).toContainText(/1\.?500 de 3\.?000 filas/);await expect(banner).toContainText('valores conservados; formato normalizado');await expect(banner).toContainText('Solo las columnas elegidas, en el orden elegido.');await expect(banner).toContainText('Fin de línea CRLF')
 const written=await readFile(join(extracts,'ventas.extracto.csv'),'utf8')
 expect(written.startsWith('id,zona\r\n000002,norte\r\n000004,norte\r\n')).toBe(true);expect(written.split('\r\n')).toHaveLength(1501+1)
 expect(sha(await readFile(path))).toBe(sha(text))
 await expect(banner).toContainText('columnas: id, zona')
})

test('un extracto grande se abre en modo grande y lo dice',async()=>{
 await open(csv(3000))
 await openPanel()
 await page.getByRole('button',{name:'Extraer a un archivo nuevo…',exact:true}).click() // sin condiciones: todo el archivo
 await expect(page.locator('.extract-banner')).toContainText(/3\.?000 de 3\.?000 filas/);await expect(page.locator('.warning-banner').filter({hasText:'Archivo grande'})).toBeVisible() // supera los límites de edición: se abre en modo grande
 await expect(page.getByLabel('Buscar en tabla',{exact:true})).toBeDisabled()
 expect(await readFile(join(extracts,'ventas.extracto.csv'),'utf8')).toBe(csv(3000))
})

test('cancelar a mitad no deja archivo ni temporal y el original sigue igual',async()=>{
 await quit();await launch({FREYALAB_EXTRACT_BATCH:'100',FREYALAB_EXTRACT_DELAY_MS:'150'})
 const {path}=await open(csv(3000)),before=sha(await readFile(path))
 await openPanel()
 await page.getByRole('button',{name:'Extraer a un archivo nuevo…',exact:true}).click()
 const bar=page.getByRole('progressbar',{name:'Avance de la operación',exact:true})
 await expect(bar).toBeVisible();await expect.poll(async()=>Number(await bar.getAttribute('value'))).toBeGreaterThan(0)
 await page.getByRole('button',{name:'Cancelar',exact:true}).click()
 await expect(page.locator('section.extract-tools')).toContainText('Operación cancelada. No se creó ningún archivo.')
 expect(await readdir(extracts)).toEqual([]);expect(sha(await readFile(path))).toBe(before)
 expect((await page.evaluate(()=>window.freya.documents())).map(item=>item.name)).toEqual(['ventas.csv'])
 await expect(page.getByRole('button',{name:'Extraer a un archivo nuevo…',exact:true})).toBeEnabled() // se puede volver a intentar
})

test('no se extrae sobre el propio original ni sobre un archivo abierto',async()=>{
 await quit();await launch({FREYALAB_TEST_EXTRACT_PATH:join(folder,'ventas.csv')})
 const {path}=await open(csv(3000)),before=sha(await readFile(path))
 await openPanel()
 await page.getByRole('button',{name:'Extraer a un archivo nuevo…',exact:true}).click()
 await expect(page.getByRole('alert').filter({hasText:'distinto'})).toContainText('la extracción nunca modifica el original')
 expect(sha(await readFile(path))).toBe(before);expect(await readdir(folder)).not.toContain('ventas.csv.tmp')
})

test('una condición mal formada se explica y no crea nada',async()=>{
 await open(csv(3000))
 await openPanel()
 await condition(1,'2. nombre','Expresión regular (RE2)','(sin cerrar')
 await page.getByRole('button',{name:'Extraer a un archivo nuevo…',exact:true}).click()
 await expect(page.getByRole('alert')).not.toHaveText('')
 expect(await readdir(extracts)).toEqual([])
})

test('un CSV con una comilla sin cerrar no se indexa como grande: muestra con la posición del problema',async()=>{
 const {doc}=await open('id,nombre\n'+Array.from({length:200},(_,i)=>`${i},fila ${i}`).join('\n')+'\n201,"sin cerrar\n202,otra\n','roto.csv')
 expect(doc.large).toBeFalsy();expect(doc.readonly).toBe(true);expect(doc.warning).toContain('comilla sin cerrar')
 await expect(page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true}).getByRole('button',{name:'Extraer filas',exact:true})).toHaveCount(0)
})
