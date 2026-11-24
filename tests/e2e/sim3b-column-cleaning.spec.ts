import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,copyFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {parse} from 'csv-parse/sync'
import {closeElectron} from './close-electron'
import {menuItem,openColumnExplorer,showTable} from './panel'
import {readTableRows} from './csv-rows'

let app:ElectronApplication,page:Page,folder:string
const fixture=resolve('tests/fixtures/sim-3-students.csv')
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-sim3b-'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_LANG:'es'}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
 await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await closeElectron(app);await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

const cell=(row:number,column:string)=>page.getByRole('gridcell',{name:`Fila ${row}, ${column}`,exact:true})
const columnButton=(column:string)=>page.getByRole('button',{name:`Acciones de la columna ${column}`,exact:true})
const columnMenu=()=>page.getByRole('menu',{name:'Acciones de columnas',exact:true})
const state=(id:string)=>page.evaluate(id=>window.freya.documents().then(list=>list.find(doc=>doc.id===id)),id)
const careers={
 trim:['Ingeniería','ingeniería','INGENIERÍA','psicologia','Ingeniería','ingeniería','INGENIERÍA','psicologia','Ingeniería','ingeniería','INGENIERÍA','psicologia'],
 upper:['INGENIERÍA','INGENIERÍA',' INGENIERÍA','PSICOLOGIA ','INGENIERÍA','INGENIERÍA',' INGENIERÍA','PSICOLOGIA ','INGENIERÍA','INGENIERÍA',' INGENIERÍA','PSICOLOGIA '],
 lower:['ingeniería','ingeniería',' ingeniería','psicologia ','ingeniería','ingeniería',' ingeniería','psicologia ','ingeniería','ingeniería',' ingeniería','psicologia ']
} as const
const labels={trim:'Quitar espacios',upper:'Mayúsculas',lower:'Minúsculas'} as const

async function open(){
 const path=join(folder,'estudiantes.csv');await copyFile(fixture,path)
 const source=await readFile(path,'utf8'),original=(parse(source,{skip_empty_lines:true}) as string[][]).slice(1)
 expect(original).toHaveLength(12)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(cell(1,'ID')).toHaveText('001')
 return{id:doc.id,path,source,original,before:await state(doc.id)}
}
async function filterCity(){
 await menuItem(page,'Filtrar','Filtros por columna')
 await page.getByRole('textbox',{name:'Filtrar Ciudad',exact:true}).fill('Oaxaca')
 await expect(page.getByRole('gridcell',{name:/^Fila \d+, ID$/})).toHaveText(['001','002','004','008'])
}
async function searchCity(){
 await page.getByRole('textbox',{name:'Buscar en tabla',exact:true}).fill('Oaxaca')
 await expect(page.getByRole('gridcell',{name:/^Fila \d+, ID$/})).toHaveText(['001','002','004','008'])
}
async function columnClean(operation:keyof typeof labels,entry:'toolbar'|'column'){
 if(entry==='toolbar'){
  await cell(1,'Carrera').click()
  await menuItem(page,'Limpiar',`${operation==='trim'?'Quitar espacios de':labels[operation]+' en'} Carrera…`)
 }else{
  await columnButton('Carrera').click();await columnMenu().getByRole('menuitem',{name:'Limpiar',exact:true}).click()
  await page.getByRole('menu').last().getByRole('menuitem',{name:labels[operation]+'…',exact:true}).click()
 }
 const dialog=page.getByRole('dialog',{name:`${labels[operation]} en la columna «Carrera»`,exact:true})
 await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Aplicar cambio',exact:true})).toBeEnabled()
 return dialog
}
async function unchanged(opened:Awaited<ReturnType<typeof open>>){
 expect(await readTableRows(page,100)).toEqual(opened.original)
 expect(await state(opened.id)).toEqual(opened.before)
 expect(await readFile(opened.path,'utf8')).toBe(opened.source)
}
async function undo(opened:Awaited<ReturnType<typeof open>>){
 await page.getByRole('button',{name:'Deshacer',exact:true}).click()
 await expect.poll(()=>readTableRows(page,100)).toEqual(opened.original)
 expect((await state(opened.id))?.dirty).toBe(false)
 expect(await readFile(opened.path,'utf8')).toBe(opened.source)
}
const replaceCareers=(original:string[][],values:readonly string[])=>original.map((row,index)=>row.map((value,column)=>column===1?values[index]:value))

test('SIM-3b: la previa de columna incluye las ocultas, marca espacios marginales y cancelar no edita',async()=>{
 const opened=await open();await filterCity();const dialog=await columnClean('trim','toolbar')
 expect.soft(await dialog.innerText()).toContain('Alcance: toda la columna · 12 filas, también las 8 que oculta el filtro.')
 expect.soft(await dialog.getByRole('status').innerText()).toContain('6 de 12 celdas cambiarán.')
 const samples=await dialog.locator('.preview-scroll tbody tr').evaluateAll(rows=>rows.map(row=>Array.from(row.querySelectorAll('th,td'),cell=>cell.textContent)))
 expect.soft(samples).toContainEqual(['3 / 2','·INGENIERÍA','INGENIERÍA'])
 expect.soft(samples).toContainEqual(['4 / 2','psicologia·','psicologia'])
 await unchanged(opened)
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(dialog).toHaveCount(0)
 await unchanged(opened)
})

test('SIM-3b: quitar espacios desde la cabecera limpia toda la columna, Frecuencias lo confirma y un deshacer restaura',async()=>{
 const opened=await open();await filterCity();const dialog=await columnClean('trim','column')
 await dialog.getByRole('button',{name:'Aplicar cambio',exact:true}).click();await expect(dialog).toHaveCount(0)
 await expect.poll(()=>readTableRows(page,100)).toEqual(replaceCareers(opened.original,careers.trim))
 expect((await state(opened.id))?.dirty).toBe(true);expect(await readFile(opened.path,'utf8')).toBe(opened.source)
 const explorer=await openColumnExplorer(page)
 await explorer.getByLabel('Columna para explorar',{exact:true}).selectOption('1')
 await explorer.getByLabel('Filas para explorar',{exact:true}).selectOption('all')
 await explorer.getByRole('button',{name:'Frecuencias',exact:true}).click()
 await explorer.getByRole('button',{name:'Explorar columna',exact:true}).click()
 await expect(explorer.getByRole('status')).toHaveText('Exploración completa.')
 const frequencies=explorer.getByRole('region',{name:'Frecuencias de columna',exact:true})
 expect((await frequencies.locator('tbody tr td:first-child pre').allTextContents()).sort()).toEqual(['"INGENIERÍA"','"Ingeniería"','"ingeniería"','"psicologia"'].sort())
 await expect(frequencies.locator('tbody tr td:nth-child(2)')).toHaveText(['3','3','3','3'])
 await expect(frequencies.locator('pre').filter({hasText:/^"INGENIERÍA"$/})).toHaveCount(1)
 await showTable(page);await undo(opened)
})

test('SIM-3b: Mayúsculas desde Limpiar incluye las filas ocultas por búsqueda y conserva espacios, ID y otras columnas',async()=>{
 const opened=await open();await searchCity();const dialog=await columnClean('upper','toolbar')
 expect.soft(await dialog.getByRole('status').innerText()).toContain('9 de 12 celdas cambiarán.')
 await dialog.getByRole('button',{name:'Aplicar cambio',exact:true}).click();await expect(dialog).toHaveCount(0)
 await expect.poll(()=>readTableRows(page,100)).toEqual(replaceCareers(opened.original,careers.upper))
 expect(await readFile(opened.path,'utf8')).toBe(opened.source)
 await undo(opened)
})

test('SIM-3b: Minúsculas desde la cabecera incluye las filas ocultas por filtro y conserva espacios, ID y otras columnas',async()=>{
 const opened=await open();await filterCity();const dialog=await columnClean('lower','column')
 expect.soft(await dialog.getByRole('status').innerText()).toContain('6 de 12 celdas cambiarán.')
 await dialog.getByRole('button',{name:'Aplicar cambio',exact:true}).click();await expect(dialog).toHaveCount(0)
 await expect.poll(()=>readTableRows(page,100)).toEqual(replaceCareers(opened.original,careers.lower))
 expect(await readFile(opened.path,'utf8')).toBe(opened.source)
 await undo(opened)
})

test('SIM-3b: sin filtro el alcance omite las filas ocultas y cancelar conserva filas, revisión y archivo',async()=>{
 const opened=await open(),dialog=await columnClean('trim','toolbar'),text=await dialog.innerText()
 expect.soft(text).toContain('Alcance: toda la columna · 12 filas.')
 expect.soft(text).not.toContain('que oculta el filtro')
 expect.soft(await dialog.getByRole('status').innerText()).toContain('6 de 12 celdas cambiarán.')
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(dialog).toHaveCount(0)
 await unchanged(opened)
})

test('SIM-3b: las limpiezas de filas marcadas y de rango mantienen su selección sin alcanzar filas ocultas',async()=>{
 const opened=await open();await filterCity()
 await page.getByRole('checkbox',{name:'Seleccionar columna Carrera',exact:true}).check()
 await page.getByRole('button',{name:'Seleccionar fila 1',exact:true}).click()
 await page.getByRole('button',{name:'Seleccionar fila 3',exact:true}).click({modifiers:[process.platform==='darwin'?'Meta':'Control']})
 await menuItem(page,'Limpiar','Convertir a mayúsculas')
 const marked=opened.original.map((row,index)=>row.map((value,column)=>column===1&&(index===0||index===4)?'INGENIERÍA':value))
 await expect.poll(()=>readTableRows(page,100)).toEqual(marked)
 await undo(opened)
 // La misma selección nativa por teclado que usan las pruebas existentes de rango.
 await cell(1,'Carrera').click();await page.keyboard.press('Shift+ArrowDown')
 await expect(page.locator('.csv-cell[aria-selected="true"]')).toHaveCount(2)
 await page.keyboard.press('Shift+F10')
 const menu=page.getByRole('menu',{name:'Acciones del rango',exact:true});await expect(menu).toBeVisible()
 await menu.getByRole('menuitem',{name:'Limpiar',exact:true}).click()
 await page.getByRole('menu').last().getByRole('menuitem',{name:'Quitar espacios…',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Quitar espacios del rango',exact:true})
 await expect(dialog.getByRole('status')).toContainText('1 de 2 celdas cambiarán.')
 await dialog.getByRole('button',{name:'Aplicar cambio',exact:true}).click();await expect(dialog).toHaveCount(0)
 const range=opened.original.map((row,index)=>row.map((value,column)=>column===1&&index===2?'INGENIERÍA':value))
 await expect.poll(()=>readTableRows(page,100)).toEqual(range)
 await undo(opened)
})
