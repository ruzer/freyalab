import {it,expect} from 'vitest'
import {createHash} from 'node:crypto'
import {parse} from 'csv-parse/sync'
import {chartResult} from '../src/main/chart-result'
import {chartSQL,chartTotalSQL,chartData,type ChartData} from '../src/shared/charts'
import type {ChartResultRequest,SqlResult} from '../src/shared/types'
import type {RecipeAnalysisContext} from '../src/shared/recipe-operation'
import {getLanguage,setLanguage} from '../src/shared/i18n'
import {markdownHTML} from '../src/renderer/lib/render'
const request:ChartResultRequest={requestId:'request',revision:3,format:'json',protectFormulas:true,configuration:{headers:['Ciudad','Total'],options:{kind:'bar',x:0,y:1,bins:10,aggregate:'sum',descending:false,measureType:'number'},where:{conditions:[{column:0,op:'contains',value:'ñ'}],filterMode:'all'},view:{search:'texto',filters:{0:'ñ'}}}}
const data:ChartData={total:8,usable:7,points:6,limited:false,columns:['x','value'],rows:[['00123','3.0'],['90071992547409931234','4.0'],['=HYPERLINK("x")','5.0'],['"á\n💜|`<img src=x>','6.0'],['',null],[null,'-1.0']]}
const result:SqlResult={requestId:'request',sources:[{id:'csv',name:'datos.csv',revision:3,table:'datos',columns:[],rows:8,fromDisk:true,filtered:true}],version:'test',columns:[],rows:[],returnedRows:6,limited:false,offset:0,completedAt:'2026-10-22T00:00:00.000Z'}
it('JSON conserva cadenas numéricas, fórmulas, vacíos/nulos, Unicode, filtros y procedencia exactos',()=>{
 const document=JSON.parse(chartResult(request,result,data,true).content);expect(document.rows).toEqual(data.rows);expect(document.metadata).toMatchObject({source:'datos.csv',revision:3,dirty:true,partial:false,analyzedRows:8,exportedElements:6,configuration:request.configuration,scope:'Filtros de tabla guardados para esta exportación'});expect(document.metadata.origin).toContain('completo desde disco');expect(document.columns).toEqual([{index:0,key:'x',label:'Ciudad'},{index:1,key:'value',label:'Suma de Total'}])
})
it('CSV estándar cita campos con el serializador existente, protege fórmulas explícitamente y adjunta valores originales con hash',()=>{
 const output=chartResult({...request,format:'csv'},result,data,false),rows=parse(output.content),context=JSON.parse(output.context!)
 expect(rows[0]).toEqual(['1. Ciudad','2. Suma de Total']);expect(rows[1]).toEqual(['00123','3.0']);expect(rows[2][0]).toBe('90071992547409931234');expect(rows[3][0]).toBe(`'=HYPERLINK("x")`);expect(rows[4][0]).toBe(data.rows[3][0]);expect(context.rows).toEqual(data.rows);expect(context.csv).toMatchObject({protectFormulas:true,sha256:createHash('sha256').update(output.content).digest('hex')});expect(output.content).toContain('"",\r\n')
 const raw=chartResult({...request,format:'csv',protectFormulas:false},result,data,false);expect(parse(raw.content)[3][0]).toBe(data.rows[2][0]);expect(JSON.parse(raw.context!).csv.protectFormulas).toBe(false)
})
it('Markdown escapa contenido y distingue nulo, vacío y texto sin interpretar HTML o enlaces',()=>{
 const content=chartResult({...request,format:'md'},result,data,false).content
 expect(content).toContain('# Informe de datos del gráfico');expect(content).toContain('`NULL`');expect(content).toContain('` "" `');expect(content).toContain('\\|');expect(content).toContain('\\n');expect(content).toContain('Revisión');expect(content).toContain('Filtros');expect(content).toContain('completo desde disco');expect(content).not.toContain('# =HYPERLINK')
})
it('la exportación tiene límite propio de diez mil y marca el truncamiento con el total real',()=>{
 const options=request.configuration.options,sql=chartSQL(request.configuration.headers,options,10000);expect(sql).toContain('LIMIT 10001');expect(chartSQL(request.configuration.headers,options)).toContain('LIMIT 101')
 const rows=Array.from({length:10000},(_,i)=>['10002','10002','10002','1',String(i),'1']);const output=chartData('bar',['total','usable','points','present','x','value'],rows,10000);expect(output).toMatchObject({limited:true,points:10002});expect(output.rows).toHaveLength(10000)
 const document=JSON.parse(chartResult(request,{...result,limited:true},output,false).content);expect(document.metadata).toMatchObject({partial:true,totalElements:10002,exportedElements:10000})
 expect(()=>chartSQL(['a','b'],options,10001)).toThrow('límite');expect(()=>chartData('bar',[],[],0)).toThrow('Límite')
})
it('la expansión temporal usa el límite de exportación sin generar calendarios masivos',()=>{
 const sql=chartSQL(['Fecha','Total'],{...request.configuration.options,kind:'line',time:'day'},10000);expect(sql).toContain('range(LEAST(size,10001))');expect(sql).toContain('LIMIT 10001')
})
it('exporta vacíos con metadatos y rechaza filas incompletas o revisiones incorrectas',()=>{
 const empty={...data,points:0,total:0,usable:0,rows:[]};expect(JSON.parse(chartResult(request,result,empty,false).content).rows).toEqual([]);expect(parse(chartResult({...request,format:'csv'},result,empty,false).content)).toHaveLength(1)
 expect(()=>chartResult(request,result,{...data,rows:[]},false)).toThrow('incompleto');expect(()=>chartResult({...request,revision:2},result,data,false)).toThrow('incompleto')
})
it('exporta la tendencia completa en JSON y el contexto del CSV estándar, y la explica en Markdown',()=>{
 const config={...request.configuration,options:{...request.configuration.options,kind:'scatter' as const,trend:true}},trend={slope:.6,intercept:2.2,r2:.5999999999999999,r:Math.sqrt(.6),n:6,xMin:1,xMax:6,constantY:false},plotted={...data,trend},expected={slope:trend.slope,intercept:trend.intercept,r2:trend.r2,r:trend.r,n:6}
 const output=(format:ChartResultRequest['format'])=>chartResult({...request,configuration:config,format},result,plotted,false)
 expect(JSON.parse(output('json').content).trend).toEqual(expected)
 const csv=output('csv');expect(JSON.parse(csv.context!).trend).toEqual(expected);expect(parse(csv.content)).toHaveLength(7);expect(csv.content).not.toContain('trend')
 expect(output('md').content).toContain('y = 0.6·x + 2.2');expect(output('md').content).toContain(String(trend.r2));expect(output('md').content).toContain('Relación no es causa.')
})

const analysisSubset:RecipeAnalysisContext={
 projectId:'project',recipeId:'recipe',sourceId:'source',name:'Clientes «Ñ» | 2026',sourceName:'datos-ñ.csv',
 steps:[{op:'filter',mode:'all',conditions:[{column:{position:1,name:'Ciudad'},op:'contains',value:'ñ',caseSensitive:false}]},
  {op:'order',by:[{column:{position:2,name:'Total'},descending:true,numeric:true}]},
  {op:'select',columns:[{position:1,name:'Ciudad'},{position:2,name:'Total'}]},
  {op:'sample',method:'random',rows:8,seed:7}],
 stepOwners:['Base','Base','Clientes «Ñ» | 2026','Clientes «Ñ» | 2026'],
 coverage:{headers:['Ciudad','Total'],columns:[{position:1,name:'Ciudad'},{position:2,name:'Total'}],scanned:842,eligible:125,resultCount:8,complete:true,cancelled:false,bytesRead:9412,sha256:'a'.repeat(64),sampling:[{step:3,method:'random',requestedRows:8,seed:7,eligible:125,selected:8}],sourceVersionDifferent:true},
}

it.each([
 ['es','Conjunto de solo lectura en memoria; la fuente no se modifica','Conjunto completo'],
 ['en','Read-only subset in memory; the source is not modified','Complete subset'],
] as const)('el conjunto de solo lectura conserva su contexto en JSON, CSV agregado y Markdown (%s)',(language,origin,scope)=>{
 const before=getLanguage();setLanguage(language)
 try{
  const source={...result.sources[0],name:analysisSubset.name,fromDisk:false,filtered:false,analysisSubset,path:'/private/no-exportar/datos-ñ.csv'}
  const sql={...result,sources:[source]}, {view:_,...configuration}=request.configuration
  for(const format of ['json','csv'] as const){
   const output=chartResult({...request,format,configuration},sql,data,false)
   const document=JSON.parse(format==='csv'?output.context!:output.content)
   expect(document.metadata).toMatchObject({dirty:false,origin,scope,analysisSubset})
   expect(document.metadata.analysisSubset).toEqual(analysisSubset)
   expect(document.metadata.analysisSubset.coverage).not.toHaveProperty('rows')
   expect(document.rows).toEqual(data.rows)
   expect(document.metadata.origin).not.toMatch(/cambios pendientes|pending|muestra|sample/i)
   expect(JSON.stringify(document)).not.toContain('/private/no-exportar')
   if(format==='csv')expect(parse(output.content)).toHaveLength(data.rows.length+1)
  }
  const md=chartResult({...request,format:'md',configuration},sql,data,false).content
  expect(md).toContain(origin);expect(md).toContain(scope)
  expect(md).not.toContain('Documento en memoria; cambios pendientes incluidos')
  expect(md).not.toContain('el editor solo muestra una muestra')
  expect(md).not.toContain('/private/no-exportar')
  const line=md.split('\n').find(line=>line.includes('analysisSubset'))
  expect(line).toBeDefined()
  const fence=line!.match(/^(`+) /)?.[1];expect(fence).toBeDefined()
  const encoded=line!.slice(fence!.length+1,-fence!.length-1).replaceAll('\\|','|')
  expect(JSON.parse(JSON.parse(encoded))).toEqual({analysisSubset})
 }finally{setLanguage(before)}
})

it('la procedencia del conjunto prevalece sobre metadatos de vista de tabla y no cambia las exportaciones de documentos normales',()=>{
 const sql={...result,sources:[{...result.sources[0],fromDisk:false,analysisSubset}]}
 const subset=JSON.parse(chartResult(request,sql,data,false).content)
 expect(subset.metadata.scope).toBe('Conjunto completo')
 const normal=JSON.parse(chartResult(request,result,data,false).content)
 expect(normal.metadata.scope).toBe('Filtros de tabla guardados para esta exportación')
 expect(normal.metadata).not.toHaveProperty('analysisSubset')
})

it.each(['bar','line','scatter','histogram','heatmap','box'] as const)('SIM-2b: un título no cambia SQL ni el total de %s',kind=>{
 const plain={...request.configuration.options,kind},titled={...plain,title:'Título propio ñ'}
 expect(chartSQL(request.configuration.headers,titled)).toBe(chartSQL(request.configuration.headers,plain))
 expect(chartSQL(request.configuration.headers,titled,10000)).toBe(chartSQL(request.configuration.headers,plain,10000))
 expect(chartTotalSQL(request.configuration.headers,titled)).toBe(chartTotalSQL(request.configuration.headers,plain))
})

it('SIM-2b: título literal en JSON, contexto CSV y Markdown conserva datos, hash y seguridad HTML',async()=>{
 const title='<img src="https://evil.test/x"> | `código` [clic](https://evil.test/) <script>alert(1)</script>'
 const titled={...request,configuration:{...request.configuration,options:{...request.configuration.options,title}}}
 const json=JSON.parse(chartResult(titled,result,data,true).content),csv=chartResult({...titled,format:'csv'},result,data,true),context=JSON.parse(csv.context!)
 expect(json.metadata.description).toBe(title);expect(context.metadata.description).toBe(title)
 expect(json.rows).toEqual(data.rows);expect(context.rows).toEqual(data.rows)
 expect(csv.content).toBe(chartResult({...request,format:'csv'},result,data,true).content)
 expect(parse(csv.content)).toHaveLength(data.rows.length+1);expect(context.csv.sha256).toBe(createHash('sha256').update(csv.content).digest('hex'))
 const markdown=chartResult({...titled,format:'md'},result,data,true).content
 expect(markdown).toContain('# Informe de datos del gráfico');expect(markdown).toContain('\\|');expect(markdown).toContain('código')
 const rendered=await markdownHTML(markdown)
 expect(rendered.html).toMatch(/(?:&lt;|&#x0*3c;|&#0*60;)img\b/i);expect(rendered.html).not.toMatch(/<(?:img|script|a)\b/i)
 expect(rendered.html).toContain('Descripción');expect(rendered.html).toContain('código')
})
