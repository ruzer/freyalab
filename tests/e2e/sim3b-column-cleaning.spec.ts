import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,copyFile,readFile,rm,mkdir,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {parse} from 'csv-parse/sync'
import {closeElectron} from './close-electron'
import {menuItem,openColumnExplorer,showTable} from './panel'
import {readTableRows} from './csv-rows'
import {t,plural,formatNumber} from '../../src/shared/i18n'

let app:ElectronApplication,page:Page,folder:string
const fixture=resolve('tests/fixtures/sim-3-students.csv')
test.beforeEach(async({},info)=>{
 folder=await mkdtemp(join(tmpdir(),'freya-sim3b-'))
 const locale=info.title.endsWith('[en-XA]')?'en-XA':'es'
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_LANG:locale}})
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
 const opened=await open();await filterCity()
 const age=page.getByRole('columnheader').filter({has:page.getByRole('button',{name:'Edad',exact:true})})
 await age.getByRole('button',{name:'Edad',exact:true}).click();await expect(age).toHaveAttribute('aria-sort','ascending')
 await expect(page.getByRole('gridcell',{name:/^Fila \d+, ID$/})).toHaveText(['002','008','004','001'])
 const dialog=await columnClean('trim','column')
 await dialog.getByRole('button',{name:'Aplicar cambio',exact:true}).click();await expect(dialog).toHaveCount(0)
 await expect.poll(()=>readTableRows(page,100)).toEqual(replaceCareers(opened.original,careers.trim))
 await expect(page.getByRole('textbox',{name:'Filtrar Ciudad',exact:true})).toHaveValue('Oaxaca')
 await expect(age).toHaveAttribute('aria-sort','ascending')
 await expect(page.getByRole('gridcell',{name:/^Fila \d+, ID$/})).toHaveText(['002','008','004','001'])
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

test('SIM-3b: con cero filas visibles la limpieza de columna sigue disponible para las doce y cancelar conserva la vista',async()=>{
 const opened=await open(),age=page.getByRole('columnheader').filter({has:page.getByRole('button',{name:'Edad',exact:true})})
 await age.getByRole('button',{name:'Edad',exact:true}).click();await expect(age).toHaveAttribute('aria-sort','ascending')
 await expect(cell(1,'ID')).toHaveText('002')
 await menuItem(page,'Filtrar','Filtros por columna')
 const filter=page.getByRole('textbox',{name:'Filtrar Ciudad',exact:true}),needle='sin coincidencias SIM-3b'
 await filter.fill(needle)
 await expect(page.locator('.table-empty')).toBeVisible()
 await expect(page.getByRole('gridcell',{name:/^Fila \d+, ID$/})).toHaveCount(0)
 await columnButton('Carrera').click();await columnMenu().getByRole('menuitem',{name:'Limpiar',exact:true}).click()
 const trim=page.getByRole('menu').last().getByRole('menuitem',{name:'Quitar espacios…',exact:true})
 await expect(trim).toHaveAttribute('aria-disabled','false');await trim.click()
 const dialog=page.getByRole('dialog',{name:'Quitar espacios en la columna «Carrera»',exact:true})
 await expect(dialog.getByRole('button',{name:'Aplicar cambio',exact:true})).toBeEnabled()
 expect(await dialog.innerText()).toContain('Alcance: toda la columna · 12 filas, también las 12 que oculta el filtro.')
 expect(await dialog.getByRole('status').innerText()).toContain('6 de 12 celdas cambiarán.')
 await unchanged(opened)
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(dialog).toHaveCount(0)
 await unchanged(opened)
 await expect(filter).toHaveValue(needle);await expect(age).toHaveAttribute('aria-sort','ascending')
 await expect(page.locator('.table-empty')).toBeVisible()
 await expect(page.getByRole('gridcell',{name:/^Fila \d+, ID$/})).toHaveCount(0)
})

for(const [action,title,close] of [
 ['Rellenar vacíos…','Rellenar vacíos de Ciudad','Cancelar'],
 ['Eliminar filas con vacío…','Eliminar filas con vacío','Cancelar'],
 ['Quitar filas duplicadas…','Transformar documento CSV','Cerrar']
] as const)test(`SIM-3b: ${action} de una columna explica doce filas y ocho ocultas sin editar al cancelar`,async()=>{
 const opened=await open();await filterCity()
 await columnButton('Ciudad').click();await columnMenu().getByRole('menuitem',{name:'Limpiar',exact:true}).click()
 await page.getByRole('menu').last().getByRole('menuitem',{name:action,exact:true}).click()
 const dialog=page.getByRole('dialog',{name:title,exact:true});await expect(dialog).toBeVisible()
 if(action==='Quitar filas duplicadas…'){
  await expect(dialog.getByLabel('Transformación CSV',{exact:true})).toHaveValue('deduplicate')
  await expect(dialog.getByLabel('Columnas para transformar',{exact:true})).toHaveValues(['3'])
 }
 expect.soft(await dialog.innerText()).toContain('Alcance: toda la columna · 12 filas, también las 8 que oculta el filtro.')
 await unchanged(opened)
 await dialog.getByRole('button',{name:close,exact:true}).click();await expect(dialog).toHaveCount(0)
 await unchanged(opened)
 await expect(page.getByRole('textbox',{name:'Filtrar Ciudad',exact:true})).toHaveValue('Oaxaca')
 await expect(page.getByRole('gridcell',{name:/^Fila \d+, ID$/})).toHaveText(['001','002','004','008'])
})

test('SIM-3b: una consulta pendiente no publica ocultas antiguas y el alcance se actualiza con su respuesta real',async()=>{
 const opened=await open();await menuItem(page,'Filtrar','Filtros por columna')
 const filter=page.getByRole('textbox',{name:'Filtrar Ciudad',exact:true})
 await filter.fill('Puebla')
 await expect(page.getByRole('gridcell',{name:/^Fila \d+, ID$/})).toHaveText(['010','007','011'])
 // Mantiene abierta la espera real de 150 ms, sin sustituir respuestas ni añadir pausas al producto.
 // Es el mismo control del reloj que usan los consumidores existentes de column-menu.
 await page.clock.setFixedTime(0);await page.clock.pauseAt(0);await page.clock.setSystemTime(0)
 try{
  await filter.fill('Oaxaca')
  await expect(page.locator('.csv-cell[data-column="0"]')).toHaveText(['010','007','011'])
  await columnButton('Carrera').press('Enter')
  await columnMenu().getByRole('menuitem',{name:'Limpiar',exact:true}).press('Enter')
  const trim=page.getByRole('menu').last().getByRole('menuitem',{name:'Quitar espacios…',exact:true})
  await expect(trim).toHaveAttribute('aria-disabled','false');await trim.press('Enter')
  const dialog=page.getByRole('dialog',{name:'Quitar espacios en la columna «Carrera»',exact:true})
  await expect(dialog.getByRole('button',{name:'Aplicar cambio',exact:true})).toBeEnabled()
  const scope=dialog.locator(':scope > p').first()
  expect.soft(await scope.innerText()).toContain('Alcance: toda la columna · 12 filas.')
  expect.soft(await scope.innerText()).not.toContain('también las 9')
  // Entrega la consulta real: ahora son cuatro visibles y ocho ocultas, no las nueve anteriores.
  await page.clock.runFor(150)
  await expect(page.locator('.csv-cell[data-column="0"]')).toHaveText(['001','002','004','008'])
  await expect.soft(scope).toContainText('Alcance: toda la columna · 12 filas, también las 8 que oculta el filtro.')
  await unchanged(opened)
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).press('Enter');await expect(dialog).toHaveCount(0)
  await unchanged(opened)
  await expect(filter).toHaveValue('Oaxaca')
  await expect(page.getByRole('gridcell',{name:/^Fila \d+, ID$/})).toHaveText(['001','002','004','008'])
 }finally{await page.clock.resume()}
})

for(const locale of ['es','en-XA'] as const)test(`SIM-3b idioma y teclado: alcance completo, puntos en Antes y cancelar [${locale}]`,async({},info)=>{
 const opened=await open(),label=(key:string,parameters:Record<string,string|number>={})=>t(key,parameters,locale)
 expect((await page.evaluate(()=>window.freya.language())).language).toBe(locale)
 await expect(page.locator('html')).toHaveAttribute('lang',locale)
 await page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true}).getByLabel(label('charts.toolbar.filter'),{exact:true}).press('Enter')
 await page.getByRole('button',{name:'Filtros por columna',exact:true}).press('Enter')
 await page.getByRole('textbox',{name:'Filtrar Ciudad',exact:true}).fill('Oaxaca')
 await expect(page.getByRole('gridcell',{name:/^Fila \d+, ID$/})).toHaveText(['001','002','004','008'])
 const trigger=page.getByRole('button',{name:label('csv.columnMenu.open',{column:'Carrera'}),exact:true})
 await trigger.press('Enter')
 await page.getByRole('menu',{name:label('csv.columnMenu.label'),exact:true}).getByRole('menuitem',{name:label('csv.columnMenu.clean'),exact:true}).press('Enter')
 const submenu=page.getByRole('menu',{name:label('csv.columnMenu.cleanLabel',{column:'Carrera'}),exact:true})
 await submenu.getByRole('menuitem',{name:label('csv.columnMenu.column-trim'),exact:true}).press('Enter')
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Aplicar cambio',exact:true})).toBeEnabled()
 const scope=dialog.locator(':scope > p').first(),expectedScope=plural('csv.columnClean.scopeHiddenOther',12,{hidden:formatNumber(8,undefined,locale)},locale)
 const observedScope=await scope.innerText();expect.soft(observedScope).toContain(expectedScope)
 const samples=await dialog.locator('.preview-scroll tbody tr').evaluateAll(rows=>rows.map(row=>Array.from(row.querySelectorAll('th,td'),cell=>cell.textContent)))
 expect.soft(samples).toContainEqual(['3 / 2','·INGENIERÍA','INGENIERÍA'])
 expect.soft(samples).toContainEqual(['4 / 2','psicologia·','psicologia'])
 await unchanged(opened)
 const requestedEvidence=process.env.FREYALAB_SIM3B_EVIDENCE??process.env.EVIDENCE
 const evidence=requestedEvidence==='1'?info.outputPath('evidence'):requestedEvidence
 const phase=process.env.FREYALAB_SIM3B_CAPTURE_PHASE==='before'?'before':process.env.FREYALAB_SIM3B_CAPTURE_PHASE==='after'?'after':'candidate'
 const captures:{file:string;sha256:string;bytes:number;locale:string;theme:string;width:number;height:number}[]=[]
 if(evidence)await mkdir(evidence,{recursive:true})
 for(const theme of ['light','dark'] as const)for(const size of [{width:1440,height:900},{width:1280,height:720}]){
  await page.evaluate(theme=>window.freya.setSettings({tema:theme}),theme)
  await expect.poll(()=>page.locator('html').evaluate(node=>node.classList.contains('dark'))).toBe(theme==='dark')
  await page.setViewportSize(size);await expect.poll(()=>page.evaluate(()=>({width:innerWidth,height:innerHeight}))).toEqual(size)
  await page.evaluate(()=>document.fonts.ready)
  await expect.soft(scope).toBeInViewport()
  await expect.soft(dialog.locator('.preview-scroll tbody td pre').first()).toBeInViewport()
  if(evidence){
   const file=`sim3b-${phase}-column-preview-${locale}-${theme}-${size.width}x${size.height}.png`
   const png=await page.screenshot({path:join(evidence,file),animations:'disabled',scale:'css'})
   expect(png.readUInt32BE(16)).toBe(size.width);expect(png.readUInt32BE(20)).toBe(size.height)
   captures.push({file,sha256:createHash('sha256').update(png).digest('hex'),bytes:png.length,locale,theme,...size})
  }
 }
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused()
 await unchanged(opened)
 await expect(page.getByRole('textbox',{name:'Filtrar Ciudad',exact:true})).toHaveValue('Oaxaca')
 await expect(page.getByRole('gridcell',{name:/^Fila \d+, ID$/})).toHaveText(['001','002','004','008'])
 if(evidence){
  const manifest={phase,locale,fixture:'tests/fixtures/sim-3-students.csv',fixtureSha256:createHash('sha256').update(opened.source).digest('hex'),rows:12,visible:4,hidden:8,scope:observedScope,samples,cancelledBy:'Escape',sourceUnchanged:true,revisionUnchanged:true,captures}
  const body=JSON.stringify(manifest,null,2)+'\n';await writeFile(join(evidence,`sim3b-${phase}-${locale}-captures.json`),body)
  await info.attach('sim3b-preview-captures',{body:Buffer.from(body),contentType:'application/json'})
 }
})
