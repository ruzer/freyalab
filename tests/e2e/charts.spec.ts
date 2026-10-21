import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,mkdir,rm,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {chartSQL,chartData,type ChartOptions} from '../../src/shared/charts'
import type {DocumentInfo} from '../../src/shared/types'
let app:ElectronApplication,page:Page,folder:string
const original='Grupo,X,Y,Z\r\nA,1,1,U\r\nA,2,2,V\r\nA,3,3,U\r\nA,4,4,V\r\nA,5,100,U\r\nB,6,,V\r\nB,7,0005,U\r\nB,8,9007199254740993,U\r\nB,bad,7,V\r\nC,9,5,U\r\n'
const options:ChartOptions={kind:'histogram',x:0,y:2,bins:2,aggregate:'count',descending:false}
test.beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-charts-'));await mkdir(join(folder,'exports'));const {ELECTRON_RUN_AS_NODE:_,...env}=process.env;app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')},timeout:60000});page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true})})
async function open(text=original,name='plots.csv'){const path=join(folder,name);await writeFile(path,text);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);return{doc,path}}
async function query(doc:DocumentInfo,settings:ChartOptions){const sql=chartSQL(doc.headers??[],settings),result=await page.evaluate(({doc,sql})=>window.freya.sqlRun({requestId:crypto.randomUUID(),sources:[{id:doc.id,revision:doc.revision}],sql}),{doc,sql}),rows=[...result.rows];for(let offset=100;offset<result.returnedRows;offset+=100)rows.push(...(await page.evaluate(({id,offset})=>window.freya.sqlPage(id,offset),{id:result.requestId,offset})).rows);return chartData(settings.kind,result.columns.map(c=>c.name),rows)}

test('seis gráficos calculan sobre datos completos, con cuartiles, huecos y categorías exactas',async()=>{
 const {doc,path}=await open(),before=await page.evaluate(()=>window.freya.documents())
 const histogram=await query(doc,options);expect(histogram).toMatchObject({total:10,usable:8,limited:false,rows:[['1.0','7','50.5'],['50.5','1','100.0']]})
 const bars=await query(doc,{...options,kind:'bar',aggregate:'sum'});expect(bars.rows).toEqual([['C','5.0'],['B','12.0'],['A','110.0']])
 const line=await query(doc,{...options,kind:'line',x:1});expect(line.usable).toBe(7);expect(line.rows.filter(r=>r[1]===null)).toEqual([['6.0',null,'6'],['8.0',null,'8']])
 const scatter=await query(doc,{...options,kind:'scatter',x:1});expect(scatter.rows).toHaveLength(7);expect(scatter.rows.every(r=>r[1]!==null)).toBe(true)
 const heat=await query(doc,{...options,kind:'heatmap',y:3});expect(heat.rows).toEqual([['A','3','U'],['A','2','V'],['B','2','U'],['B','2','V'],['C','1','U']])
 const box=await query(doc,{...options,kind:'box'});expect(box.rows[0]).toEqual(['A','3.0','2.0','4.0','1.0','4.0','1','5','[100.0]']);expect(box.usable).toBe(8)
 expect(await page.evaluate(()=>window.freya.documents())).toEqual(before);expect(await readFile(path,'utf8')).toBe(original)
})

test('gráficos visuales: seis SVG, temas, teclado, exportación e invalidación',async()=>{
 const {doc,path}=await open();await page.getByRole('button',{name:'Gráficos',exact:true}).click();const panel=page.getByRole('region',{name:'Gráficos del CSV',exact:true})
 await panel.getByLabel('Columna Y del gráfico',{exact:true}).selectOption('2')
 for(const kind of ['histogram','bar','line','scatter','heatmap','box']){
  await panel.getByLabel('Tipo de gráfico',{exact:true}).selectOption(kind)
  if(kind!=='histogram')await panel.getByLabel('Columna X del gráfico',{exact:true}).selectOption(kind==='line'||kind==='scatter'?'1':'0')
  if(kind!=='bar')await panel.getByLabel('Columna Y del gráfico',{exact:true}).selectOption(kind==='heatmap'?'3':'2')
  await panel.getByRole('button',{name:'Generar gráfico',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Gráfico listo',{timeout:30000});await expect(panel.locator('.plot svg')).toBeVisible();expect(await panel.locator('.plot svg path').count()).toBeGreaterThan(0)
 }
 for(const theme of ['dark','light']){await page.getByLabel('Tema',{exact:true}).selectOption(theme);await panel.locator('.plot').scrollIntoViewIfNeeded();await page.screenshot({path:test.info().outputPath(`charts-${theme}-1440x900.png`)});await expect(panel.locator('.plot')).toHaveAttribute('aria-label',/Diagrama de caja/)}
 await page.setViewportSize({width:1280,height:800});await page.screenshot({path:test.info().outputPath('charts-light-1280x800.png')})
 await panel.getByText('Datos del gráfico: tabla accesible',{exact:true}).click();await expect(panel.locator('tbody tr')).toHaveCount(3);await expect(panel.locator('tbody tr').first()).toContainText('100.0')
 for(const format of ['SVG','PNG','PDF']){await panel.getByRole('button',{name:`Exportar gráfico ${format}`,exact:true}).click();await expect(panel.getByRole('status')).toContainText(`plots.${format.toLowerCase()}`,{timeout:15000});expect((await stat(join(folder,'exports',`plots.${format.toLowerCase()}`))).size).toBeGreaterThan(1000)}
 const pixels=await app.evaluate(({nativeImage},path)=>{const image=nativeImage.createFromPath(path),buffer=image.toBitmap(),colors=new Set<string>();for(let i=0;i<buffer.length;i+=4)colors.add(buffer.subarray(i,i+4).toString('hex'));return{size:image.getSize(),colors:colors.size}},join(folder,'exports','plots.png'));expect(pixels.size.width).toBeGreaterThan(500);expect(pixels.colors).toBeGreaterThan(20)
 expect((await readFile(join(folder,'exports','plots.pdf'))).subarray(0,5).toString()).toBe('%PDF-')
 const svg=await readFile(join(folder,'exports','plots.svg'),'utf8');expect(svg).toContain('<svg');expect(svg).not.toContain('<script')
 await page.getByRole('button',{name:'+ Fila',exact:true}).click();await expect(panel.getByRole('status')).toContainText('datos actualizados');await expect(panel.locator('.plot svg path')).toHaveCount(0)
 await panel.getByRole('button',{name:'Generar gráfico',exact:true}).focus();await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);await expect(page.getByRole('button',{name:'Gráficos',exact:true})).toBeFocused();expect(await readFile(path,'utf8')).toBe(original)
})

test('gráficos distinguen vacío, constante, límite de puntos y etiquetas no ejecutables',async()=>{
 const constant=await open('Grupo,N\n<img src=x onerror=alert(1)>,5\n<img src=x onerror=alert(1)>,5\n');expect((await query(constant.doc,{...options,y:1})).rows).toEqual([['5.0','2','5.0']])
 await page.getByRole('button',{name:'Gráficos',exact:true}).click();const hostile=page.getByRole('region',{name:'Gráficos del CSV',exact:true});await hostile.getByLabel('Tipo de gráfico',{exact:true}).selectOption('bar');await hostile.getByRole('button',{name:'Generar gráfico',exact:true}).click();await expect(hostile.getByRole('status')).toContainText('Gráfico listo',{timeout:30000});expect(await hostile.locator('.plot img, .plot foreignObject, .plot script').count()).toBe(0);await hostile.getByText('Datos del gráfico: tabla accesible',{exact:true}).click();await expect(hostile.locator('tbody')).toContainText('<img src=x onerror=alert(1)>');await hostile.getByRole('button',{name:'Cerrar gráficos',exact:true}).click()
 const empty=await open('Grupo,N\nA,\nB,no\n','empty.csv');expect((await query(empty.doc,{...options,y:1})).rows).toEqual([])
 const many=await open('Grupo,N\n'+Array.from({length:2100},(_,i)=>`${i},${i}`).join('\n'),'many.csv');const data=await query(many.doc,{...options,kind:'scatter',x:0,y:1});expect(data).toMatchObject({points:2100,limited:true});expect(data.rows).toHaveLength(2000);expect(data.rows.at(-1)).toEqual(['1999.0','1999.0','2000'])
 await page.getByRole('button',{name:'Gráficos',exact:true}).click();const panel=page.getByRole('region',{name:'Gráficos del CSV',exact:true});await panel.getByRole('button',{name:'Generar gráfico',exact:true}).click();await panel.getByRole('button',{name:'Cancelar gráfico',exact:true}).click();await expect(panel.getByRole('status')).toContainText('cancelado');await expect(panel.locator('.plot svg path')).toHaveCount(0)
})

test('histograma agrega un millón de filas completo aunque la tabla sea muestra',async()=>{
 test.setTimeout(120000)
 const block=Array.from({length:1000},(_,i)=>`${String(i).padStart(5,'0')},Grupo ${i%10},${i%100},nota`).join('\n')+'\n'
 const {doc,path}=await open('Código,Grupo,N,Nota\n'+block.repeat(1000),'million.csv');expect(doc.readonly).toBe(true);expect(doc.rowCount).toBe(200)
 await page.evaluate(()=>{let previous=performance.now();const state={maxGapMs:0,timer:0};state.timer=window.setInterval(()=>{const now=performance.now();state.maxGapMs=Math.max(state.maxGapMs,now-previous);previous=now},20);Reflect.set(window,'chartTiming',state)})
 const start=performance.now(),result=await query(doc,{...options,bins:10}),durationMs=performance.now()-start
 const maxRendererGapMs=await page.evaluate(()=>{const state=Reflect.get(window,'chartTiming');clearInterval(state.timer);return state.maxGapMs})
 expect(result).toMatchObject({total:1000000,usable:1000000,limited:false});expect(result.rows.map(r=>Number(r[1]))).toEqual(Array(10).fill(100000));expect((await stat(path)).size).toBeGreaterThan(10000000)
 expect((await page.evaluate(()=>window.freya.documents()))[0]).toMatchObject({readonly:true,rowCount:200,dirty:false})
 const machine=await app.evaluate(()=>({platform:process.platform,arch:process.arch,electron:process.versions.electron}))
 await writeFile(test.info().outputPath('chart-million-profile.json'),JSON.stringify({recordedAt:new Date().toISOString(),...machine,cpu:(await import('node:os')).cpus()[0]?.model,rows:result.total,bins:10,durationMs,maxRendererGapMs,sourceBytes:(await stat(path)).size},null,2)+'\n')
})
