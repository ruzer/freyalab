import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
let app:ElectronApplication,page:Page,folder:string
const original='ID,Partes,Nota\r\n001,a;0007,Café\r\n002,b;;,é\r\n001,a;0007,Otra\r\n'
test.beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-transform-e2e-'));await mkdir(join(folder,'exports'));const {ELECTRON_RUN_AS_NODE:_,...env}=process.env;app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')},timeout:60000});page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true})})
async function open(source=original){const path=join(folder,'data.csv');await writeFile(path,source);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);return{doc,path}}
async function dialog(operation:string,columns=['0']){await page.getByLabel('Operaciones CSV',{exact:true}).click();await page.getByRole('button',{name:'Transformar documento…',exact:true}).click();const panel=page.getByRole('dialog',{name:'Transformar documento CSV',exact:true});await panel.getByLabel('Transformación CSV',{exact:true}).selectOption(operation);if(operation!=='headers')await panel.getByLabel('Columnas para transformar',{exact:true}).selectOption(columns);return panel}
async function preview(panel:ReturnType<Page['getByRole']>){await panel.getByRole('button',{name:'Vista previa',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Vista previa lista',{timeout:30000})}
async function apply(panel:ReturnType<Page['getByRole']>){await panel.getByRole('button',{name:'Aplicar transformación',exact:true}).click();await expect(panel).toHaveCount(0)}

test('transformaciones visuales: documento completo, originales, Unicode, encabezados, duplicados y deshacer',async()=>{
 const {path}=await open();await page.getByLabel('Buscar en tabla',{exact:true}).fill('001');await expect(page.locator('.csv-toolbar')).toContainText('2 de 3 filas')
 let panel=await dialog('split',['1']);await expect(panel).toContainText('incluye filas ocultas');await preview(panel);await expect(panel.locator('dl')).toContainText('Columnas añadidas3');await apply(panel)
 await page.getByLabel('Buscar en tabla',{exact:true}).fill('');await expect(page.getByRole('gridcell',{name:'Fila 2, Partes',exact:true})).toHaveText('b;;');await expect(page.getByRole('gridcell',{name:'Fila 1, Partes_2',exact:true})).toHaveText('0007');expect((await page.evaluate(()=>window.freya.documents()))[0].rowCount).toBe(3)
 await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(page.getByRole('columnheader')).toHaveCount(3)
 panel=await dialog('combine',['1','0']);await panel.getByLabel('Separador de transformación',{exact:true}).selectOption('|');await panel.getByLabel('Nombre de columna combinada',{exact:true}).fill('Clave completa');await preview(panel);await apply(panel);await expect(page.getByRole('gridcell',{name:'Fila 1, Clave completa',exact:true})).toHaveText('001|a;0007');await page.getByRole('button',{name:'Deshacer',exact:true}).click()
 panel=await dialog('normalize',['2']);await preview(panel);await apply(panel);await expect(page.getByRole('gridcell',{name:'Fila 1, Nota',exact:true})).toHaveText('Café');await page.getByRole('button',{name:'Deshacer',exact:true}).click()
 panel=await dialog('headers');await preview(panel);await apply(panel);await expect(page.getByRole('columnheader').first()).toContainText('id');await page.getByRole('button',{name:'Deshacer',exact:true}).click()
 panel=await dialog('deduplicate',['0','1']);await preview(panel);await expect(panel.locator('dl')).toContainText('Filas por eliminar1')
 for(const theme of ['light','dark']){await panel.getByRole('button',{name:'Cerrar',exact:true}).click();await page.getByLabel('Tema',{exact:true}).selectOption(theme);panel=await dialog('deduplicate',['0','1']);await preview(panel);await page.screenshot({path:test.info().outputPath(`csv-transform-${theme}-1440x900.png`)})}
 await page.setViewportSize({width:1280,height:800});await page.screenshot({path:test.info().outputPath('csv-transform-dark-1280x800.png')});await apply(panel);await expect(page.locator('.csv-toolbar')).toContainText('2 de 2 filas');await expect(page.getByRole('gridcell',{name:'Fila 1, Nota',exact:true})).toHaveText('Café');await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(page.locator('.csv-toolbar')).toContainText('3 de 3 filas');expect(await readFile(path,'utf8')).toBe(original)
 const cell=page.getByRole('gridcell',{name:'Fila 1, ID',exact:true});await cell.click();await page.keyboard.press(process.platform==='darwin'?'Meta+Shift+t':'Control+Shift+t');await expect(page.getByRole('dialog',{name:'Transformar documento CSV',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(cell).toBeFocused()
 await cell.click({button:'right'});await page.getByRole('menuitem',{name:'Transformar documento…',exact:true}).click();await expect(page.getByRole('dialog',{name:'Transformar documento CSV',exact:true})).toBeVisible();await page.keyboard.press('Escape')
})

test('transformaciones: cancela trabajo real, invalida revisión obsoleta y rechaza mensajes inválidos',async()=>{
 const {doc,path}=await open('A,N\n'+'é,00123\n'.repeat(50000)),before=await page.evaluate(()=>window.freya.documents())
 for(const apply of [false,true]){
  const error=await page.evaluate(async({doc,apply})=>{const request={type:'structure' as const,operation:'normalize' as const,columns:[0],revision:doc.revision,requestId:crypto.randomUUID()};const unsubscribe=window.freya.onEvent(event=>{if(event.type==='analysis'&&event.progress?.requestId===request.requestId&&event.progress.rows>=513)void window.freya.cancelAnalysis(doc.id,request.requestId)});try{await(apply?window.freya.tableEdit(doc.id,request):window.freya.transformPreview(doc.id,request));return ''}catch(error){return String(error)}finally{unsubscribe()}},{doc,apply});expect(error).toContain('cancelada');expect(await page.evaluate(()=>window.freya.documents())).toEqual(before)
 }
 const panel=await dialog('combine',['0','1']);await preview(panel);await page.evaluate(id=>window.freya.tableEdit(id,{type:'cell',rowId:'1',column:1,value:'9007199254740993'}),doc.id);await panel.getByRole('button',{name:'Aplicar transformación',exact:true}).click();await expect(panel.getByRole('status')).toContainText('tabla cambió');expect((await page.evaluate(()=>window.freya.documents()))[0].headers).toEqual(['A','N']);await panel.getByRole('button',{name:'Cerrar',exact:true}).click()
 const invalid=await page.evaluate(async id=>{try{await window.freya.transformPreview(id,{type:'structure',operation:'execute',columns:[0],revision:0,requestId:crypto.randomUUID()} as never);return false}catch{return true}},doc.id);expect(invalid).toBe(true);expect(await readFile(path,'utf8')).toBe('A,N\n'+'é,00123\n'.repeat(50000))
})

test('transformación conserva recuperación, un paso de deshacer y guardado en disco',async()=>{
 const {doc,path}=await open();const updated=await page.evaluate(async doc=>window.freya.tableEdit(doc.id,{type:'structure',operation:'combine',columns:[0,1],separator:' | ',name:'Combinada',revision:doc.revision,requestId:crypto.randomUUID()}),doc)
 await expect.poll(async()=>await page.evaluate(()=>window.freya.recoveries()),{timeout:10000}).not.toEqual([])
 const recovered=await page.evaluate(async()=>{const [entry]=await window.freya.recoveries();return window.freya.recover(entry.id)})
 expect(recovered.headers).toEqual(['ID','Partes','Combinada','Nota']);await page.evaluate(id=>window.freya.undo(id),recovered.id)
 const copy=await page.evaluate(id=>window.freya.export(id,{format:'csv',table:{scope:'all'}}),recovered.id);expect(await readFile(copy!,'utf8')).toBe(original);expect(await readFile(path,'utf8')).toBe(original)
 await page.evaluate(id=>window.freya.save(id),updated.id);expect(await readFile(path,'utf8')).toContain('001 | a;0007');expect(await readFile(path,'utf8')).toContain('\r\n')
})
