import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,readFile,writeFile,rm,stat} from 'node:fs/promises'
import {tmpdir,cpus,totalmem,release} from 'node:os'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {linearRegression,linearRegressionLine,rSquared} from 'simple-statistics'
import {chartSQL,chartData,type ChartOptions} from '../../src/shared/charts'
import {t} from '../../src/shared/i18n'
import type {DocumentInfo,SqlResult} from '../../src/shared/types'
import {closeElectron} from '../../tests/e2e/close-electron'
import {openAnalysis,chartPanel,chartSuggestion,chartGenerate,showTable,menuItem} from '../../tests/e2e/panel'

const operationMs=120_000,chartMs=2*operationMs
const sales='Región,Canal,Ventas,Fecha,Descuento\nNorte,Web,1200,2026-01-01,10%\nNorte,Tienda,800,2026-01-15,10%\nCentro,Web,1600,2026-02-01,10%\nCentro,Tienda,900,2026-02-15,10%\nSur,Web,900,2026-03-01,10%\nSur,Tienda,600,2026-03-15,10%\nOeste,Web,700,2026-04-01,10%\nOeste,Tienda,500,2026-04-15,10%\n'
const plots='Grupo,X,Y,Z\r\nA,1,1,U\r\nA,2,2,V\r\nA,3,3,U\r\nA,4,4,V\r\nA,5,100,U\r\nB,6,,V\r\nB,7,0005,U\r\nB,8,9007199254740993,U\r\nB,bad,7,V\r\nC,9,5,U\r\n'
const numeric:ChartOptions={kind:'histogram',x:0,y:2,bins:2,aggregate:'count',descending:false,measureType:'number'}
type Input={name:string;path:string;bytes:number;sha256:string;doc:DocumentInfo;mtimeMs:number}
type Step={name:string;durationMs:number;failed:boolean}
type SQLTiming={requestId:string;phases:Record<string,number>;rows:number;bytes:number;returnedRows:number;complete:boolean}
type IPCTiming={method:string;requestId?:string;durationMs:number;ok:boolean}
type UIEntry={name:string;startTime:number;duration:number;detail:Record<string,number>}
let app:ElectronApplication,page:Page,folder:string,inputs:Input[],steps:Step[]
const hash=(input:string|Uint8Array)=>createHash('sha256').update(input).digest('hex')

test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-analysis-phases-'));inputs=[];steps=[]
 await mkdir(join(folder,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,
  args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',
   FREYALAB_TEST_ANALYSIS_PROFILE:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')},timeout:60_000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1280,height:720})
 await page.emulateMedia({reducedMotion:'reduce'})
 await page.evaluate(()=>{
  Reflect.set(window,'freyaAnalysisProfile',true)
  const state={entries:[] as UIEntry[],dropped:0}
  const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())if(entry.name.startsWith('freya.analysis.')){
   const detail=Object.fromEntries(Object.entries((entry as PerformanceMeasure).detail??{}).filter(([,value])=>typeof value==='number'&&Number.isFinite(value))) as Record<string,number>
   if(state.entries.length<1000)state.entries.push({name:entry.name,startTime:entry.startTime,duration:entry.duration,detail});else state.dropped++
  }})
  observer.observe({entryTypes:['measure']});Reflect.set(window,'freyaPhaseHarnessUI',state)
 })
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  const calls:IPCTiming[]=[],trends:Record<string,number|null>[]=[]
  Reflect.set(globalThis,'freyaPhaseHarnessIPC',calls);Reflect.set(globalThis,'freyaPhaseHarnessTrends',trends)
  handlers.set('freya',async(event,...args)=>{
   const method=String(args[0]),observed=/^(sqlRun|sqlPage)$|profile|analyzeColumn/i.test(method),started=performance.now()
   let ok=false
   try{
    const output=await original(event,...args);ok=true
    if(method==='sqlRun'){
     const result=output as SqlResult,names=result.columns.map(column=>column.name)
     if(names.includes('trend_n')&&result.rows.length)trends.push(Object.fromEntries(names.flatMap((name,index)=>name.startsWith('trend_')?[[name,result.rows[0][index]===null?null:Number(result.rows[0][index])]]:[])))
    }
    return output
   }finally{if(observed&&calls.length<1000){const request=[args[1],args[2]].find(value=>!!value&&typeof value==='object'&&'requestId'in value) as {requestId?:string}|undefined;calls.push({method,...typeof request?.requestId==='string'?{requestId:request.requestId}:{},durationMs:performance.now()-started,ok})}}
  })
 })
})

test.afterEach(async()=>{
 try{
  if(app&&page){
   await paint().catch(()=>{})
   const sql=await app.evaluate(()=>Reflect.get(globalThis,'freyaSQLTimings') as SQLTiming[]|undefined).catch(()=>undefined)
   const ipc=await app.evaluate(()=>Reflect.get(globalThis,'freyaPhaseHarnessIPC') as IPCTiming[]).catch(()=>[])
   const ui=await page.evaluate(()=>Reflect.get(window,'freyaPhaseHarnessUI') as {entries:UIEntry[];dropped:number}).catch(()=>({entries:[],dropped:0}))
   const fixtures=await Promise.all(inputs.map(async input=>{const bytes=await readFile(input.path),current=await stat(input.path);return{name:input.name,bytes:input.bytes,sha256:input.sha256,sha256After:hash(bytes),sameMtime:current.mtimeMs===input.mtimeMs,document:{rows:input.doc.rowCount,readonly:input.doc.readonly,large:input.doc.large??false,encoding:input.doc.encoding}}}))
   const record={recordedAt:new Date().toISOString(),label:process.env.FREYALAB_PHASE_LABEL??'unspecified',sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    title:test.info().title,observation:test.info().repeatEachIndex+1,status:test.info().status,execution:process.env.FREYALAB_EXECUTABLE?'packaged':'development',freshProcess:true,viewport:{width:1280,height:720},
    machine:{platform:process.platform,arch:process.arch,os:release(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,totalMemoryBytes:totalmem(),node:process.versions.node,electron:await app.evaluate(()=>process.versions.electron)},
    fixtures,steps,sql:sql??[],ipc,ui,notes:[
     'Duraciones de cada reloj local; no se restan timestamps entre procesos.',
     'sourceLoad engloba sourceStart/sourceRead/sourceEncode/sourceAppend: no sumar esos campos entre sí.',
     'resultTransfer es aproximación de despacho/serialización: roundtrip executeJavaScript menos query/materialize del worker.',
     'Los IPC incluyen el trabajo del servidor y pueden solaparse con SQL y perfiles; no sumar todas las series.',
     'chartPainted observa presentación tras render y dos rAF; no equivale a coste CPU exclusivo.',
     'El presupuesto de observación deriva de operaciones de120s; no modifica SLA, esperas ni aserciones de los E2E originales.'
    ]}
   await writeFile(test.info().outputPath('analysis-phases.json'),JSON.stringify(record,null,2)+'\n')
  }
 }finally{await closeElectron(app);if(folder)await rm(folder,{recursive:true,force:true})}
})

async function paint(){await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))))}
async function step<T>(name:string,run:()=>Promise<T>):Promise<T>{const started=performance.now();let failed=true;try{const result=await run();await paint();failed=false;return result}finally{steps.push({name,durationMs:performance.now()-started,failed})}}
async function open(name:string,content:string|Uint8Array){
 return step('open:'+name,async()=>{const path=join(folder,name);await writeFile(path,content);const initial=await stat(path),[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);inputs.push({name,path,bytes:initial.size,sha256:hash(content),doc,mtimeMs:initial.mtimeMs});await expect(page.getByRole('tab',{name:doc.name,exact:true})).toHaveAttribute('aria-selected','true');return doc})
}
async function intact(){for(const input of inputs){expect(hash(await readFile(input.path))).toBe(input.sha256);expect((await stat(input.path)).mtimeMs).toBe(input.mtimeMs);const current=(await page.evaluate(()=>window.freya.documents())).find(doc=>doc.id===input.doc.id);expect(current?.dirty).toBe(input.doc.dirty);expect(current?.revision).toBe(input.doc.revision)}}
async function more(){const details=chartPanel(page).locator('.more-options');if(await details.getAttribute('open')===null)await details.locator(':scope>summary').click()}
async function suggestedCharts(){await openAnalysis(page,'Gráficos');if(await chartPanel(page).getByLabel('Configuración del gráfico',{exact:true}).innerText()===t('charts.fields.emptyTitle',{},'es'))await create();await more()}
async function create(){const suggestion=chartSuggestion(page);await expect(suggestion).toBeEnabled({timeout:operationMs});await suggestion.click({timeout:operationMs});await ready()}
async function ready(){await expect(chartPanel(page).locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado',{timeout:chartMs});await expect(chartPanel(page).locator('.plot svg')).toBeVisible({timeout:operationMs});await paint()}
async function measured(chart:boolean){
 const sql=await app.evaluate(()=>Reflect.get(globalThis,'freyaSQLTimings') as SQLTiming[]|undefined)
 expect(sql?.some(value=>value.complete)).toBe(true)
 for(const value of sql??[])for(const duration of Object.values(value.phases)){expect(Number.isFinite(duration)).toBe(true);expect(duration).toBeGreaterThanOrEqual(0)}
 if(chart)await expect.poll(()=>page.evaluate(()=>(Reflect.get(window,'freyaPhaseHarnessUI') as {entries:UIEntry[]}).entries.filter(entry=>entry.name==='freya.analysis.chartPainted').length),{timeout:operationMs}).toBeGreaterThan(0)
}
async function generate(){await chartGenerate(page).click({timeout:chartMs});await ready()}
async function query(doc:DocumentInfo,settings:ChartOptions){
 const sql=chartSQL(doc.headers??[],settings),result=await page.evaluate(({doc,sql})=>window.freya.sqlRun({requestId:crypto.randomUUID(),sources:[{id:doc.id,revision:doc.revision}],sql}),{doc,sql}),rows=[...result.rows]
 for(let offset=100;offset<result.returnedRows;offset+=100)rows.push(...(await page.evaluate(({id,offset})=>window.freya.sqlPage(id,offset),{id:result.requestId,offset})).rows)
 return chartData(settings.kind,result.columns.map(column=>column.name),rows)
}

test('F2b: perfiles y dibujo con 200 campos',async()=>{
 // Conserva el calentamiento de ventas.csv del beforeEach original, separado en los pasos registrados.
 await open('ventas.csv',sales);await step('warmup:chart',async()=>{await openAnalysis(page,'Gráficos');await create()})
 const headers=Array.from({length:200},(_,i)=>i===198?'Crédito «México» "ñ"':'Campo '+i)
 const content=headers.join(',').replace('Crédito «México» "ñ"','"Crédito «México» ""ñ"""')+'\n'+Array.from({length:3},()=>Array(200).fill('x').join(',')).join('\n')+'\n'
 await open('campos.csv',content)
 await step('200-fields:profiles-to-visible',async()=>{await openAnalysis(page,'Gráficos');await create()})
 const panel=chartPanel(page);await expect(panel.locator('.pivot-result tfoot td').first()).toHaveText('3')
 const search=panel.getByRole('searchbox');await search.fill('credito');await expect(panel.getByRole('listitem')).toHaveCount(1);await expect(panel.getByRole('listitem')).toContainText('Crédito «México» "ñ"')
 const profiles=await page.evaluate(()=>(Reflect.get(window,'freyaPhaseHarnessUI') as {entries:UIEntry[]}).entries.filter(entry=>entry.name==='freya.analysis.profiles'))
 expect(profiles.some(entry=>entry.detail.columns===200)).toBe(true)
 await measured(true)
 await intact()
})

test('TEN-1: consulta y dibujo con 300000 filas reales',async()=>{
 const pairs=Array.from({length:300000},(_,i)=>[i%1000-500,3*(i%1000-500)+1+((i*17)%23-11)/100])
 const content='X,Y,A,B,C,D,E\r\n'+pairs.map((pair,index)=>pair.join(',')+','+(index===pairs.length-1?'a'.repeat(600000):'a')+',b,c,d,e\r\n').join('')
 const bytes=Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(content,'utf16le')]),doc=await open('many.csv',bytes)
 expect(doc.readonly).toBe(true);expect(doc.large).not.toBe(true);expect(doc.rowCount).toBe(200)
 await step('300000:configure',async()=>{await openAnalysis(page,'Gráficos');await more();const panel=chartPanel(page);await panel.getByLabel('Tipo de gráfico',{exact:true}).selectOption('scatter');await panel.getByLabel('Columna X del gráfico',{exact:true}).selectOption('0');await panel.getByLabel('Columna Y del gráfico',{exact:true}).selectOption('1');await panel.getByRole('checkbox',{name:'Línea de tendencia',exact:true}).check()})
 await step('300000:query-to-visible',generate)
 await expect(chartPanel(page).locator('.trend-result')).toContainText('Dibujados 2,000 de 300,000 puntos; la tendencia usa todos')
 const trends=await app.evaluate(()=>Reflect.get(globalThis,'freyaPhaseHarnessTrends') as Record<string,number|null>[]),last=trends.at(-1)!
 const regression=linearRegression(pairs);expect(last.trend_n).toBe(300000);expect(last.trend_slope).toBeCloseTo(regression.m,12);expect(last.trend_r2).toBeCloseTo(rSquared(pairs,linearRegressionLine(regression)),12)
 await measured(true)
 await intact()
})

test('Constructor: operaciones y cambios de alcance completos',async()=>{
 const doc=await open('plots.csv',plots)
 for(const [aggregate,value] of [['count','5'],['distinct','5'],['sum','110.0'],['average','22.0'],['min','1.0'],['max','100.0'],['median','3.0']] as const){
  const data=await step('oracle:'+aggregate,()=>query(doc,{...numeric,kind:'bar',aggregate}));expect(data.rows.find(row=>row[0]==='A')).toEqual(['A',value])
 }
 const ids=await open('ids.csv','Ciudad,Código,Código\nOaxaca,001,extra\nOaxaca,1,extra\nOaxaca,9007199254740993,extra\nOaxaca,,extra\nOaxaca\n')
 const distinct=await step('ids:distinct',()=>query(ids,{...numeric,kind:'bar',aggregate:'distinct',y:1}));expect(distinct.rows).toEqual([['Oaxaca','4']]);expect(distinct.usable).toBe(4)
 await step('ids:chart',async()=>{await suggestedCharts();const panel=chartPanel(page);await panel.getByLabel('Tipo de gráfico',{exact:true}).selectOption('bar');await expect(panel.getByLabel('Resumen del gráfico').locator('option[value="sum"]')).toHaveJSProperty('disabled',true);await panel.getByLabel('Resumen del gráfico').selectOption('distinct');await panel.getByLabel('Columna Y del gráfico').selectOption('1');await generate();await panel.getByText('Datos del gráfico: tabla accesible',{exact:true}).click();await expect(panel.locator('.more-options .table-scroll tbody tr')).toHaveText('Oaxaca4')})
 await showTable(page,'plots.csv');await menuItem(page,'Filtrar','Filtros por columna');await page.getByLabel('Filtrar Grupo',{exact:true}).fill('A');await suggestedCharts()
 const panel=chartPanel(page)
 await step('filtered-A:chart',async()=>{await panel.getByLabel('Tipo de gráfico').selectOption('bar');await panel.getByLabel('Columna Y del gráfico').selectOption('2');await panel.getByLabel('Tipo de medida del gráfico').selectOption('number');await panel.getByLabel('Resumen del gráfico').selectOption('sum');await panel.getByLabel('Alcance del gráfico').selectOption('filtered');await generate();await panel.getByText('Datos del gráfico: tabla accesible',{exact:true}).click();await expect(panel.locator('.more-options .table-scroll tbody tr')).toHaveText('A110.0')})
 await showTable(page);await page.getByLabel('Filtrar Grupo',{exact:true}).fill('B');await openAnalysis(page,'Gráficos')
 await step('filtered-B:chart',async()=>{await generate();await expect(panel.locator('.more-options .table-scroll tbody tr')).toHaveText('B12.0')})
 await step('all:chart',async()=>{await panel.getByLabel('Alcance del gráfico').selectOption('all');await generate();await expect(panel.locator('.more-options .table-scroll tbody tr')).toHaveCount(3)})
 await panel.getByLabel('Tipo de medida del gráfico').selectOption('text');await expect(panel.getByLabel('Resumen del gráfico')).toHaveValue('count')
 await step('number-again:chart',async()=>{await panel.getByLabel('Tipo de medida del gráfico').selectOption('number');await panel.getByLabel('Resumen del gráfico').selectOption('sum');await generate()})
 await measured(true)
 await intact()
})

test('SQL: carga y resultados con más de 50 MiB',async()=>{
 const source='ID,N,Nota\n'+Array.from({length:2400},(_,i)=>`${String(i).padStart(5,'0')},${i},${'x'.repeat(23000)}`).join('\n')+'\n',doc=await open('fuente-completa.csv',source)
 expect(Buffer.byteLength(source)).toBeGreaterThan(50*1024*1024);expect(doc).toMatchObject({readonly:true,large:true,rowCount:2400})
 await step('50MiB:query-to-visible',async()=>{
  await openAnalysis(page,'Análisis');const panel=page.getByRole('region',{name:'Análisis SQL y asistentes',exact:true}),editor=panel.getByRole('textbox',{name:'Consulta SQL',exact:true})
  await editor.focus();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText('SELECT COUNT(*) AS Filas, SUM(CAST("N" AS BIGINT)) AS Total FROM datos')
  await panel.getByRole('button',{name:'Ejecutar consulta',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Consulta completa',{timeout:operationMs})
  await expect(panel.getByRole('region',{name:'Resultado SQL',exact:true}).locator('tbody tr')).toHaveText('24002878800')
 })
 await measured(false)
 await intact()
})
