import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {closeElectron} from './close-electron'
import {menuItem} from './panel'

let app:ElectronApplication,page:Page,folder:string
const fixture=resolve('tests/fixtures/sim-3-students.csv')
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-sim3a-'));const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_LANG:'es'}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  const state={profiles:[] as unknown[],pages:[] as unknown[]};Reflect.set(globalThis,'sim3SortRequests',state)
  handlers.set('freya',async(event,...args)=>{if(args[0]==='analyzeColumn')state.profiles.push(structuredClone(args.slice(1)));if(args[0]==='page')state.pages.push(structuredClone(args.slice(1)));return original(event,...args)})
 })
})
test.afterEach(async()=>{await closeElectron(app);await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function open(text?:string){const source=text??await readFile(fixture,'utf8'),path=join(folder,'estudiantes.csv');await writeFile(path,source);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);await expect(page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})).toBeVisible();return{doc,path,source}}
const values=(name:string)=>page.getByRole('gridcell',{name:new RegExp('^Fila \\d+, '+name+'$')}).allTextContents()
const profileCalls=()=>app.evaluate(()=>Reflect.get(globalThis,'sim3SortRequests').profiles as [string,{column:number;profileOnly?:boolean;query?:unknown;revision:number}][])
const asc=['9','18','18','20','25','35','40','55','70','100','100','']
const desc=['100','100','70','55','40','35','25','20','18','18','9','']

test('SIM-3a: encabezado ordena 9, 18 y 100 como números, con vacíos al final y sin modificar el CSV',async()=>{
 const {doc,path,source}=await open();await page.getByRole('button',{name:'Edad',exact:true}).click();await expect.poll(()=>values('Edad')).toEqual(asc)
 await page.getByRole('button',{name:'Edad',exact:true}).click();await expect.poll(()=>values('Edad')).toEqual(desc)
 expect((await page.evaluate(()=>window.freya.documents())).find(item=>item.id===doc.id)?.dirty).toBe(false);expect(await readFile(path,'utf8')).toBe(source)
})

test('SIM-3a: abrir no perfila y cada petición de orden solo consulta la columna elegida',async()=>{
 const {doc,path,source}=await open();expect(await profileCalls()).toEqual([])
 await page.getByRole('button',{name:'Edad',exact:true}).click();await expect.poll(profileCalls).toHaveLength(1)
 expect((await profileCalls())[0]).toEqual([doc.id,expect.objectContaining({column:2,revision:doc.revision,profileOnly:true})]);expect((await profileCalls())[0][1]).not.toHaveProperty('query')
 await expect.poll(()=>values('Edad')).toEqual(asc)
 await page.getByRole('button',{name:'Carrera',exact:true}).click();await expect.poll(profileCalls).toHaveLength(2);expect((await profileCalls())[1][1].column).toBe(1)
 expect(await readFile(path,'utf8')).toBe(source)
})

test('SIM-3a: códigos con ceros iniciales y anchos distintos mantienen el orden textual',async()=>{
 const {path,source}=await open('ID,Código\n001,010\n002,2\n003,001\n004,002\n');await page.getByRole('button',{name:'Código',exact:true}).click();await expect.poll(()=>values('Código')).toEqual(['001','002','010','2'])
 await expect.poll(()=>app.evaluate(()=>Reflect.get(globalThis,'sim3SortRequests').pages.filter((entry:unknown[])=>!!(entry[1] as {sort?:unknown}).sort).at(-1)?.[1]?.sort?.numeric)).toBe(false)
 expect(await readFile(path,'utf8')).toBe(source)
})

test('SIM-3a: el menú de columna y Filas y columnas usan el mismo orden automático',async()=>{
 const {path,source}=await open();await page.getByRole('button',{name:'Acciones de la columna Edad',exact:true}).click();const menu=page.getByRole('menu',{name:'Acciones de columnas',exact:true});await menu.getByRole('menuitem',{name:'Ordenar de menor a mayor',exact:true}).click();await expect.poll(()=>values('Edad')).toEqual(asc)
 await page.getByLabel('Seleccionar columna Edad',{exact:true}).check();await menuItem(page,'Filas y columnas','Ordenar columna descendente (vista)');await expect.poll(()=>values('Edad')).toEqual(desc)
 expect(await readFile(path,'utf8')).toBe(source)
})

test('SIM-3a: Filtrar no ofrece la casilla global y la consulta avanzada conserva el orden numérico explícito',async()=>{
 await open();await page.getByLabel('Filtrar',{exact:true}).click();await expect(page.getByRole('checkbox',{name:'Orden numérico',exact:true})).toHaveCount(0)
 await page.keyboard.press('Escape');await menuItem(page,'Filtrar','Consulta avanzada');const tools=page.getByRole('region',{name:'Consulta avanzada',exact:true});await tools.getByRole('button',{name:'Añadir orden',exact:true}).click();await expect(tools.getByLabel('Orden numérico 1',{exact:true})).toBeVisible()
})
