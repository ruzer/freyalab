import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm,truncate,stat} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {showPanel} from './panel'
let app:ElectronApplication,page:Page,folder:string
const fields=['Varianza poblacional (n)','Varianza muestral (n−1)','P10 (percentil 10)','P25 (percentil 25)','P75 (percentil 75)','P90 (percentil 90)']
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-percentiles-'));await mkdir(join(folder,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function open(source:string,name='datos.csv') {const path=join(folder,name);await writeFile(path,source);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible();return{path,doc}}
async function statistics(){await showPanel(page,'Estadísticas');return page.getByRole('region',{name:'Estadísticas por columna',exact:true})}
async function explorer(){await statistics();await page.getByText('Explorar una columna: frecuencias, calidad y distribución',{exact:true}).click();return page.getByRole('region',{name:'Exploración de columna',exact:true})}
async function analyze(panel:Locator){await panel.getByRole('button',{name:'Analizar',exact:true}).click();await expect(panel.getByRole('status')).toHaveText('Análisis completo.')}
async function explore(panel:Locator){await panel.getByRole('button',{name:'Explorar columna',exact:true}).click();await expect(panel.getByRole('status')).toHaveText('Exploración completa.')}
async function formatted(value:number|null){return value===null?'—':page.evaluate(value=>value.toLocaleString(undefined,{maximumSignificantDigits:12}),value)}
async function profileValues(panel:Locator,values:(number|null)[]){const details=panel.locator('dl[aria-label="Varianza y percentiles"]');for(let i=0;i<fields.length;i++)await expect(details.getByText(fields[i],{exact:true}).locator('..').locator('dd')).toHaveText(await formatted(values[i]))}
async function tableValues(panel:Locator,values:number[]){const headings=await panel.getByRole('columnheader').allTextContents();for(let i=0;i<fields.length;i++){const column=headings.indexOf(fields[i]);expect(column).toBeGreaterThan(0);await expect(panel.locator('tbody tr').first().locator('th,td').nth(column)).toHaveText(await formatted(values[i]))}}
async function report(panel:Locator,title:string){await panel.getByRole('button',{name:'Abrir informe Markdown',exact:true}).click();await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).find(doc=>doc.kind==='markdown')?.text).toContain(title);return(await page.evaluate(()=>window.freya.documents())).find(doc=>doc.kind==='markdown')!}

test('percentiles: perfil filtrado, ayuda por teclado e informe preservan valores y procedencia',async()=>{
 const source='\uFEFFID,Grupo,Valor\r\n'+[2,4,4,4,5,5,7,9].map((value,i)=>`${String(i).padStart(5,'0')},visible,${value}`).join('\r\n')+'\r\n00008,oculto,100\r\n9007199254740993,oculto,9007199254740993\r\n00010,oculto,\r\n00011,oculto,"  "\r\n00012,oculto\r\n'
 const {doc,path}=await open(source),before=(await page.evaluate(()=>window.freya.documents()))[0]
 await page.getByLabel('Buscar en tabla',{exact:true}).fill('visible');await expect(page.locator('.csv-toolbar')).toContainText('8 de 13 filas')
 const panel=await explorer();await panel.getByLabel('Columna para explorar',{exact:true}).selectOption('2');await panel.getByLabel('Filas para explorar',{exact:true}).selectOption('view');await explore(panel)
 const summary=panel.locator('summary').filter({hasText:/^Varianza y percentiles$/});await expect(panel.locator('dl[aria-label="Varianza y percentiles"]')).toBeHidden();await summary.focus();await summary.press('Enter');await profileValues(panel,[4,32/7,3.4,4,5.5,7.6]);await expect(panel).toContainText('P50 coincide con la mediana')
 const raw=await page.evaluate(doc=>window.freya.analyzeColumn(doc.id,{column:2,revision:doc.revision,requestId:crypto.randomUUID(),frequencyOffset:0,duplicatesOnly:false,bins:10,query:{offset:0,limit:1,requestId:1,search:'visible'}}),doc)
 expect(raw.numeric).toBe(8);expect(raw.variance).toBeCloseTo(4);expect(raw.sampleVariance).toBeCloseTo(32/7);expect(raw.percentile10).toBeCloseTo(3.4);expect(raw.percentile25).toBeCloseTo(4);expect(raw.median).toBeCloseTo(4.5);expect(raw.percentile75).toBeCloseTo(5.5);expect(raw.percentile90).toBeCloseTo(7.6)
 for(const [theme,width,height] of [['light',1440,900],['dark',1280,800]] as const){await page.getByLabel('Tema',{exact:true}).selectOption(theme);await page.setViewportSize({width,height});await panel.locator('dl[aria-label="Varianza y percentiles"]').scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:test.info().outputPath(`dw04c-percentiles-${theme}-${width}x${height}.png`)})}
 const output=await report(panel,'# Perfil de columna');expect(output.text).toContain('| Varianza poblacional (n) | 4 |');expect(output.text).toContain(`| Varianza muestral (n−1) | ${32/7} |`);expect(output.text).toContain('| P25 (percentil 25) | 4 |');expect(output.text).toContain('tipo 7');expect(output.text).toContain('Vista filtrada');expect(output.text).toContain('"search": "visible"');expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)).toEqual(before);expect(await readFile(path,'utf8')).toBe(source)
})

test('percentiles: columnas marcadas, controles progresivos y rango comparten método sin recalcular al mostrar',async()=>{
 const source='Valor,Otro\r\n0,0\r\n10,20\r\n20,40\r\n30,60\r\n',{doc,path}=await open(source),before=(await page.evaluate(()=>window.freya.documents()))[0]
 await page.getByLabel('Seleccionar columna Valor',{exact:true}).check();const panel=await statistics();await panel.getByLabel('Columnas para estadísticas',{exact:true}).selectOption('selected');await analyze(panel);await expect(panel.getByRole('columnheader',{name:fields[0],exact:true})).toHaveCount(0)
 const advanced=panel.getByRole('checkbox',{name:'Varianza y percentiles',exact:true});await advanced.focus();await advanced.press('Space');await tableValues(panel,[125,500/3,3,7.5,22.5,27]);await expect(panel.getByRole('status')).toHaveText('Análisis completo.');await advanced.uncheck();await expect(panel.getByRole('columnheader',{name:fields[0],exact:true})).toHaveCount(0)
 await page.getByRole('gridcell',{name:'Fila 1, Valor',exact:true}).click();await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Shift+ArrowDown');await panel.getByLabel('Columnas para estadísticas',{exact:true}).selectOption('range');await analyze(panel);await advanced.check();await tableValues(panel,[68.75,275/3,0,0,12.5,17]);await expect(panel.locator('caption')).toContainText('filas 1–2, columnas 1–2')
 await advanced.uncheck();const output=await report(panel,'# Informe de estadísticas CSV');expect(output.text).toContain('Celdas del rango');expect(output.text).toContain('| Varianza poblacional (n) | 68.75 |');expect(output.text).toContain('| P25 (percentil 25) | 0 |');expect(output.text).toContain('| P75 (percentil 75) | 12.5 |');expect(output.text).toContain('tipo 7');expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)).toEqual(before);expect(await readFile(path,'utf8')).toBe(source)
})

test('percentiles: vacío, un solo número y muestra limitada no inventan población completa',async()=>{
 for(const [name,text,values] of [['vacio.csv','Valor\n',[null,null,null,null,null,null]],['unico.csv','Valor\n7\n',[0,null,7,7,7,7]]] as const){
  const {doc,path}=await open(text,name),panel=await explorer();await explore(panel);await panel.getByText('Varianza y percentiles',{exact:true}).click();await profileValues(panel,[...values]);expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)?.dirty).toBe(false);expect(await readFile(path,'utf8')).toBe(text)
 }
 const path=join(folder,'muestra.csv');await writeFile(path,'Valor\n'+'2\n'.repeat(250));await truncate(path,50*1024*1024+1);const before=await stat(path),[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);expect(doc.readonly).toBe(true);const panel=await explorer();await explore(panel);await panel.getByText('Varianza y percentiles',{exact:true}).click();await profileValues(panel,[0,0,2,2,2,2]);await expect(panel).toContainText('Solo muestra');await expect(panel.locator('.scope')).toContainText('200 filas');const output=await report(panel,'# Perfil de columna');expect(output.text).toContain('MUESTRA LIMITADA');expect(output.text).toContain('| P90 (percentil 90) | 2 |');expect((await stat(path)).size).toBe(before.size);expect((await stat(path)).mtimeMs).toBe(before.mtimeMs)
})
