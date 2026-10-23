import {it,expect} from 'vitest'
import {createHash} from 'node:crypto'
import {parse} from 'csv-parse/sync'
import {chartResult} from '../src/main/chart-result'
import {chartSQL,chartData,type ChartData} from '../src/shared/charts'
import type {ChartResultRequest,SqlResult} from '../src/shared/types'
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
