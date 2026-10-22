import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
let app:ElectronApplication,page:Page,folder:string
const query={offset:0,limit:100,requestId:1}
test.beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-range-cancel-e2e-'));await mkdir(join(folder,'exports'));const {ELECTRON_RUN_AS_NODE:_,...env}=process.env;app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')},timeout:60000});page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true})})
async function open(source:string){const path=join(folder,'data.csv');await writeFile(path,source);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);await expect(page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})).toBeVisible();return{doc,path}}
async function fillDialog(){await page.getByRole('grid',{name:'Tabla de datos'}).evaluate(element=>element.scrollTop=0);await page.getByRole('gridcell',{name:'Fila 1, ID',exact:true}).click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.press('ControlOrMeta+Enter');const panel=page.getByRole('dialog',{name:'Rellenar rango',exact:true});await panel.getByLabel('Valor del rango',{exact:true}).fill('0007');return panel}
async function clickAndCancel(button:ReturnType<Page['getByRole']>){await button.evaluate(button=>{(button as HTMLButtonElement).click();queueMicrotask(()=>{const cancel=[...document.querySelectorAll<HTMLButtonElement>('dialog button')].find(button=>button.textContent==='Cancelar preparación');if(!cancel)throw new Error('Falta el control de cancelación');cancel.click()})})}

test('rangos: los controles cancelan vista previa y aplicación, permiten reintentar y conservan originales',async()=>{
 const source='ID,Nota\r\n'+'00123, a \r\n'.repeat(50000),{path}=await open(source),before=await page.evaluate(()=>window.freya.documents()),panel=await fillDialog()
 await clickAndCancel(panel.getByRole('button',{name:'Vista previa',exact:true}));await expect(panel.getByRole('status')).toContainText('Preparación cancelada');await expect(panel.getByRole('button',{name:'Aplicar cambio',exact:true})).toBeDisabled();expect(await page.evaluate(()=>window.freya.documents())).toEqual(before)
 await panel.getByRole('button',{name:'Vista previa',exact:true}).click();await expect(panel.getByRole('status')).toContainText(/100[,.]000 de 100[,.]000/)
 await clickAndCancel(panel.getByRole('button',{name:'Aplicar cambio',exact:true}));await expect(panel.getByRole('status')).toContainText('El cambio no se aplicó');await expect(panel.getByRole('status')).toContainText('cancelada');expect(await page.evaluate(()=>window.freya.documents())).toEqual(before);expect(await page.evaluate(()=>window.freya.recoveries())).toEqual([])
 await panel.getByRole('button',{name:'Cancelar',exact:true}).click()
 for(const theme of ['light','dark']){await page.getByLabel('Tema',{exact:true}).selectOption(theme);const next=await fillDialog();await next.getByRole('button',{name:'Vista previa',exact:true}).click();await expect(next.getByRole('status')).toContainText(/100[,.]000 de 100[,.]000/);for(const [width,height] of [[1440,900],[1280,800]]){await page.setViewportSize({width,height});await page.screenshot({path:test.info().outputPath(`csv-range-cancel-${theme}-${width}x${height}.png`)})}await page.keyboard.press('Escape');await expect(next).toHaveCount(0)}
 await page.getByRole('grid',{name:'Tabla de datos'}).evaluate(element=>element.scrollTop=0);await expect(page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})).toHaveText('00123');await expect(page.getByRole('gridcell',{name:'Fila 1, Nota',exact:true}).locator('span')).toHaveJSProperty('textContent',' a ');expect(await readFile(path,'utf8')).toBe(source)
})

test('rangos: cancelar trabajo iniciado, rechazar edición en cola y validar requestId no cambia datos ni recuperación',async()=>{
 const source='ID,Nota\n'+'00123, a \n'.repeat(50000),{doc,path}=await open(source),before=await page.evaluate(()=>window.freya.documents())
 const result=await page.evaluate(async doc=>{
  const change={type:'range' as const,requestId:crypto.randomUUID(),operation:'fill' as const,value:'0007',range:{top:0,bottom:49999,left:0,right:1,query:{offset:0,limit:100,requestId:1},revision:doc.revision}}
  let second:Promise<string>|undefined
  const off=window.freya.onEvent(event=>{if(event.type==='analysis'&&event.progress?.requestId===change.requestId&&event.progress.rows>=256&&!second){second=window.freya.tableEdit(doc.id,{...change,requestId:crypto.randomUUID(),value:'NO DEBE APLICARSE'}).then(()=>'aplicado',error=>String(error));void window.freya.cancelAnalysis(doc.id,change.requestId)}})
  let first='';try{await window.freya.tableEdit(doc.id,change);first='aplicado'}catch(error){first=String(error)}finally{off()}
  return{first,second:await second}
 },doc)
 expect(result.first).toContain('cancelada');expect(result.second).toContain('Espera a que termine');expect(await page.evaluate(()=>window.freya.documents())).toEqual(before);expect(await page.evaluate(()=>window.freya.recoveries())).toEqual([])
 const invalid=await page.evaluate(async doc=>{try{await window.freya.rangePreview(doc.id,{type:'range',requestId:'no-es-uuid',operation:'clear',range:{top:0,bottom:1,left:0,right:1,query:{offset:0,limit:100,requestId:1},revision:doc.revision}});return false}catch{return true}},doc);expect(invalid).toBe(true);expect(await readFile(path,'utf8')).toBe(source)
})

test('rangos: cancelar o cerrar durante copiar impide el borrado; espera la respuesta y conserva el portapapeles válido',async()=>{
 const source='ID,Nota\r\n00123,"á\r\nñ"\r\n9007199254740993,conservar\r\n',{doc,path}=await open(source)
 for(const close of [false,true]){
  await page.getByRole('gridcell',{name:'Fila 1, ID',exact:true}).click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.press('ControlOrMeta+X');const panel=page.getByRole('dialog',{name:'Cortar rango',exact:true});await expect(panel.getByRole('status')).toContainText('4 de 4')
  await app.evaluate(({clipboard})=>{const original=clipboard.writeText;clipboard.writeText=async text=>new Promise<void>(resolve=>{(globalThis as typeof globalThis&{releaseRangeClipboard?:()=>void}).releaseRangeClipboard=()=>{clipboard.writeText=original;original.call(clipboard,text);resolve()}})})
  await panel.getByRole('button',{name:'Aplicar cambio',exact:true}).click();await expect.poll(()=>app.evaluate(()=>typeof(globalThis as typeof globalThis&{releaseRangeClipboard?:()=>void}).releaseRangeClipboard)).toBe('function')
  await panel.getByRole('button',{name:close?'Cancelar':'Cancelar preparación',exact:true}).click();await expect(panel).toBeVisible();expect((await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(false)
  await app.evaluate(()=>{const state=globalThis as typeof globalThis&{releaseRangeClipboard?:()=>void};state.releaseRangeClipboard?.();delete state.releaseRangeClipboard})
  if(close)await expect(panel).toHaveCount(0);else{await expect(panel.getByRole('status')).toContainText('El cambio no se aplicó');await panel.getByRole('button',{name:'Cancelar',exact:true}).click()}
  expect((await page.evaluate(({id,query})=>window.freya.tablePage(id,query),{id:doc.id,query})).rows.map(row=>row.cells)).toEqual([['00123','á\r\nñ'],['9007199254740993','conservar']]);expect(await app.evaluate(({clipboard})=>clipboard.readText())).toContain('9007199254740993');expect(await readFile(path,'utf8')).toBe(source);expect(await page.evaluate(()=>window.freya.recoveries())).toEqual([])
 }
})
