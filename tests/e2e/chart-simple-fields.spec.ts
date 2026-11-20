import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {parse} from 'csv-parse/sync'
import type {DocumentInfo,SqlRequest} from '../../src/shared/types'
import {t} from '../../src/shared/i18n'
import {closeElectron} from './close-electron'
import {openAnalysis,chartPanel,exportAnalysis,analysisResultExport} from './panel'

let app:ElectronApplication,page:Page,folder:string,path:string,doc:DocumentInfo,errors:string[]
// Fixture literal de analysis-sections, sin cambiar valores ni convertir el ID grande a Number.
const headers=['ID','Ciudad','Ingreso','Edad','Grupo','Fecha','Respuesta']
const records=Array.from({length:240},(_,index)=>[
 index===1?'9007199254740993':String(index+1).padStart(5,'0'),
 ['  OaXaCa  ','  Mérida  ','  Puebla  '][index%3],
 index===1?'':String(100+index),String(18+index%35),index%2?'B':'A','2026-01-05',index%2?'sí':'no'
])
const source=[headers.join(','),...records.map(row=>row.join(','))].join('\n')+'\n'
type Call={operation:string;sql?:string;id?:string}
const panel=()=>chartPanel(page)
const fields=()=>panel().getByRole('complementary',{name:t('charts.fields.panel'),exact:true})
const entries=()=>fields().locator('.field-entry')
const field=(name:string)=>entries().filter({has:page.locator('.field-name').filter({hasText:new RegExp('^\\s*(?:✓\\s*)?'+name+'\\s*$')})})
const zone=(name:'Filas'|'Columnas'|'Valores'|'Filtros')=>fields().getByRole('region',{name,exact:true})
const menu=()=>panel().getByRole('menu')
const calls=()=>app.evaluate(()=>Reflect.get(globalThis,'simpleFieldsCalls') as Call[])
const title=()=>panel().getByLabel('Configuración del gráfico',{exact:true})

test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-sim2c-'));path=join(folder,'encuesta.csv');errors=[]
 await mkdir(join(folder,'exports'));await writeFile(path,source)
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,
  args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],
  env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')}})
 page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.freya)
 await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'reduce'})
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  const observed:Call[]=[];Reflect.set(globalThis,'simpleFieldsCalls',observed)
  handlers.set('freya',async(event,...args)=>{
   const operation=String(args[0]),request=operation==='sqlRun'?args[1] as SqlRequest:undefined
   if(['analyzeColumn','stats','sqlRun','sqlPage','sqlCancel','cancelAnalysis','exportChartResult','exportGraphic'].includes(operation))observed.push({operation,...request?{sql:request.sql,id:request.sources[0].id}:{}})
   return original(event,...args)
  })
 })
 ;[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 expect(doc.headers).toEqual(headers);expect(doc.rowCount).toBe(240)
 await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
 await openAnalysis(page,'Gráficos');await expect(entries()).toHaveCount(7)
 await expect(fields().getByText(t('charts.fields.loading'),{exact:true})).toHaveCount(0)
})
test.afterEach(async()=>{
 try{
  expect(errors).toEqual([]);expect(await readFile(path,'utf8')).toBe(source)
  expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)).toMatchObject({dirty:false,revision:doc.revision,rowCount:240,headers})
 }finally{try{if(app)await closeElectron(app)}finally{await rm(folder,{recursive:true,force:true})}}
})

async function assign(name:string,destination:'Filas'|'Columnas'|'Valores'){
 // Setup compatible con B y C: solo abre el menú real del campo sin usar.
 await field(name).getByRole('button',{name:new RegExp('^(?:(?:Añadir|Mover) a… '+name+'|Más acciones de '+name+')$')}).press('Enter')
 await menu().getByRole('menuitem',{name:new RegExp('^Añadir a '+destination+'(?: [(]recomendado[)])?$')}).press('Enter')
}
async function ready(){
 await expect(panel().locator('.pivot-result')).toBeVisible()
 await expect(panel().locator('.plot svg')).toBeVisible()
 await expect(panel().locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado')
}
async function meanCity(){await assign('Ciudad','Filas');await assign('Ingreso','Valores');await ready();await expect(title()).toHaveText('Promedio de Ingreso por Ciudad')}
async function barrier(){await page.evaluate(()=>window.freya.documents())}
async function drainPresentation(){await page.clock.runFor(301);await barrier()}
async function fieldTabStops(){return fields().locator('.field-list').evaluate(list=>[...list.querySelectorAll<HTMLElement>('[tabindex],button,input,select,a[href]')].filter(node=>node.tabIndex>=0&&!node.matches(':disabled')).length)}

test('SIM-2c: siete filas con iconos, una pista y un tabstop itinerante conservan el teclado de la lista',async()=>{
 expect(await fieldTabStops()).toBe(1)
 for(const badge of await fields().locator('.field-badge').all()){
  expect((await badge.textContent())?.trim()).toBe('')
  const name=await badge.getAttribute('title');expect(name).toBeTruthy()
  await expect(badge).toHaveAccessibleName(name!)
  await expect(badge.locator('svg')).toBeVisible()
 }
 await expect(fields().locator('.field-badge')).toHaveCount(7)
 const hint=fields().getByText('Haz clic en un campo para añadirlo',{exact:true})
 await expect(hint).toHaveCount(1);await expect(fields().getByText('Vacía',{exact:true})).toHaveCount(4)
 await expect(fields().getByText('Usa «Añadir a…»',{exact:true})).toHaveCount(0)
 expect(await hint.evaluate(node=>!!(node.compareDocumentPosition(node.closest('aside')!.querySelector('.zones')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
 await entries().first().focus();await entries().first().press('End');await expect(entries().last()).toBeFocused()
 await entries().last().press('Home');await expect(entries().first()).toBeFocused()
 await entries().first().press('ArrowDown');await expect(entries().nth(1)).toBeFocused()
 await entries().nth(1).press('ArrowUp');await expect(entries().first()).toBeFocused()
 expect(await fieldTabStops()).toBe(1)
 await page.keyboard.press('Tab');expect(await fields().locator('.field-list').evaluate(node=>node.contains(document.activeElement))).toBe(false)
 await page.keyboard.press('Shift+Tab');await expect(entries().first()).toBeFocused()
})

test('SIM-2c: clic Ingreso y Ciudad propone promedio y conserva datos exactos en tabla JSON y CSV',async()=>{
 await field('Ingreso').click();await expect(zone('Valores').locator('.chip-name')).toHaveText('Ingreso')
 await expect(menu()).toHaveCount(0)
 await field('Ciudad').click();await ready();await expect(title()).toHaveText('Promedio de Ingreso por Ciudad')
 await expect(zone('Filas').locator('.chip-name')).toHaveText('Ciudad');await expect(zone('Valores').getByRole('combobox')).toHaveValue('average')
 await expect(panel().locator('.pivot-result tbody tr')).toHaveCount(3)
 await exportAnalysis(page,'analysis.export.json');await expect(panel().locator('.chart-result>.result-announcement')).toContainText('encuesta.analisis.json')
 const result=JSON.parse(await readFile(join(folder,'exports','encuesta.analisis.json'),'utf8'))
 expect(result.metadata).toMatchObject({source:'encuesta.csv',revision:doc.revision,analyzedRows:240,exportedElements:3,totalElements:3,partial:false,dirty:false})
 const expected=[...new Set(records.map(row=>row[1]))].map(city=>{const values=records.filter(row=>row[1]===city&&row[2]!=='').map(row=>Number(row[2]));return[city,values.reduce((sum,value)=>sum+value,0)/values.length]as const}).sort((a,b)=>a[1]-b[1])
 expect(result.rows.map((row:string[])=>[row[0],Number(row[1])])).toEqual(expected)
 expect((await calls()).filter(call=>call.operation==='sqlRun').some(call=>call.sql?.includes('AVG(ny)'))).toBe(true)
 await exportAnalysis(page,'analysis.export.csv');await analysisResultExport(page).getByRole('button',{name:'Exportar resultados',exact:true}).press('Enter')
 await expect(panel().locator('.chart-result>.result-announcement')).toContainText('encuesta.analisis.csv')
 const csvBytes=await readFile(join(folder,'exports','encuesta.analisis.csv')),csv=parse(csvBytes,{bom:true}) as string[][]
 expect(csv[0]).toEqual(result.columns.map((column:{index:number;label:string})=>String(column.index+1)+'. '+column.label));expect(csv.slice(1)).toEqual(result.rows)
 const context=JSON.parse(await readFile(join(folder,'exports','encuesta.analisis.csv.contexto.json'),'utf8'))
 expect(context.rows).toEqual(result.rows);expect(context.csv.sha256).toBe(createHash('sha256').update(csvBytes).digest('hex'))
 expect(await readFile(path,'utf8')).toContain('9007199254740993,')
})

test('SIM-2c: Intro y Espacio añaden a la zona recomendada y anuncian sin abrir destinos',async()=>{
 await field('Ingreso').focus();await field('Ingreso').press('Enter')
 await expect(zone('Valores').locator('.chip-name')).toHaveText('Ingreso')
 await expect(panel().locator('.analysis-announcement')).toHaveText('Ingreso añadido a Valores');await expect(menu()).toHaveCount(0)
 await field('Ciudad').focus();await field('Ciudad').press('Space');await ready()
 await expect(zone('Filas').locator('.chip-name')).toHaveText('Ciudad')
 await expect(panel().locator('.analysis-announcement')).toHaveText('Ciudad añadido a Filas');await expect(menu()).toHaveCount(0)
 await expect(title()).toHaveText('Promedio de Ingreso por Ciudad');await expect(zone('Valores').getByRole('combobox')).toHaveValue('average')
})

test('SIM-2c: activar un campo usado abre Mover y Quitar sin eliminar ni recalcular',async()=>{
 await meanCity();await barrier();const before=await calls(),table=await panel().locator('.pivot-result').innerText()
 await page.clock.install()
 await field('Ingreso').click();await expect(menu()).toBeVisible()
 await expect(menu().getByRole('menuitem',{name:/^Mover a /}).first()).toBeVisible()
 await expect(menu().getByRole('menuitem',{name:/^Quitar(?: Ingreso(?: de Valores)?)?$/})).toBeVisible()
 await expect(zone('Valores').locator('.chip-name')).toHaveText('Ingreso')
 await drainPresentation();expect(await calls()).toEqual(before);expect(await panel().locator('.pivot-result').innerText()).toBe(table)
 await menu().press('Escape');await expect(field('Ingreso')).toBeFocused()
 await field('Ingreso').press('Space');await expect(menu()).toBeVisible();await drainPresentation();expect(await calls()).toEqual(before)
 await menu().getByRole('menuitem',{name:/^Quitar(?: Ingreso(?: de Valores)?)?$/}).press('Enter')
 await expect(zone('Valores').locator('.chip-name')).toHaveCount(0);await expect(zone('Filas').locator('.chip-name')).toHaveText('Ciudad')
})

test('SIM-2c: Más acciones sigue hover y foco y el menú de casa conserva destinos desactivados enfocables',async()=>{
 await meanCity();await panel().locator('.chart-types').getByRole('button',{name:'Mapa de calor',exact:true}).click()
 await expect.poll(async()=>(await calls()).filter(call=>call.operation==='sqlRun').some(call=>call.sql?.includes('GROUP BY x, y'))).toBe(true)
 await ready();await barrier()
 const entry=field('Edad'),more=entry.getByRole('button',{name:'Más acciones de Edad',exact:true})
 await page.mouse.move(0,0);await fields().getByRole('searchbox').focus()
 expect(await more.evaluate(node=>{const style=getComputedStyle(node);return style.visibility==='hidden'||style.opacity==='0'||style.display==='none'})).toBe(true)
 await entry.hover();await expect(more).toBeVisible();await more.press('Enter');await expect(menu()).toBeVisible()
 const unavailable=menu().getByRole('menuitem',{name:/^Añadir a Valores/}),reason=/^El mapa de calor solo cuenta filas[.]?$/
 await expect(unavailable).toHaveAttribute('aria-disabled','true');await expect(unavailable).not.toHaveAttribute('disabled')
 await expect(unavailable).toHaveAccessibleDescription(reason);await expect(unavailable).toHaveAttribute('title',reason);await expect(unavailable).toBeFocused()
 await menu().press('End');await expect(menu().getByRole('menuitem').last()).toBeFocused()
 await menu().press('Home');await expect(unavailable).toBeFocused()
 await menu().press('ArrowDown');await expect(menu().getByRole('menuitem').nth(1)).toBeFocused()
 await menu().press('ArrowUp');await expect(unavailable).toBeFocused()
 const before=await calls();await page.clock.install();await unavailable.press('Enter');await drainPresentation()
 expect(await calls()).toEqual(before);await expect(menu()).toBeVisible()
 await menu().press('Escape');await expect(more).toBeFocused()
 await entry.focus();await expect(more).toBeVisible();await entry.press('Shift+F10');await expect(menu()).toBeVisible()
 await menu().press('Escape');await expect(entry).toBeFocused()
 await entry.press('ContextMenu');await expect(menu()).toBeVisible();await menu().press('Escape');await expect(entry).toBeFocused()
 expect(await calls()).toEqual(before)
})
