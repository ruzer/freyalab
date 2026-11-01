import {expect,it} from 'vitest'
import {suggest,type ChartColumn} from '../src/shared/chart-suggest'
import {analyzeColumn} from '../src/main/table-analysis'
import {chartSQL,type ChartOptions} from '../src/shared/charts'
import {t,getLanguage,setLanguage} from '../src/shared/i18n'

async function column(column:number,name:string,values:string[]):Promise<ChartColumn>{
 const result=await analyzeColumn(values.map((value,index)=>({id:String(index+1),cells:[value]})),undefined,{column:0,revision:0,requestId:'f1',frequencyOffset:0,duplicatesOnly:false,bins:10},()=>{},name)
 return{column,name,profile:result.profile}
}

it('propone sumar una medida numérica por una columna de texto usando las opciones del formulario actual',async()=>{
 const columns=await Promise.all([column(0,'Ciudad',['Oaxaca','Puebla','Oaxaca']),column(1,'Total MXN',['12.5','20','3'])])
 const result=suggest(columns,{x:0,y:1})
 const manual:ChartOptions={kind:'bar',x:0,y:1,bins:10,aggregate:'sum',descending:false,measureType:'number',series:-1,time:'none'}
 expect(result.options).toEqual(manual)
 expect(chartSQL(['Ciudad','Total MXN'],result.options!)).toBe(chartSQL(['Ciudad','Total MXN'],manual))
 expect(result.reason).toMatchObject({key:'charts.suggest.textNumber',parameters:{x:'Ciudad',y:'Total MXN'}})
})

it('propone líneas mensuales para una fecha ISO y una medida numérica',async()=>{
 const columns=await Promise.all([column(0,'Fecha',['2026-01-01','2026-02-01','2026-02-02']),column(1,'Ventas',['12.5','20','3'])])
 const result=suggest(columns,{x:0,y:1})
 const manual:ChartOptions={kind:'line',x:0,y:1,bins:10,aggregate:'sum',descending:false,measureType:'number',series:-1,time:'month'}
 expect(result.options).toEqual(manual)
 expect(chartSQL(['Fecha','Ventas'],result.options!)).toBe(chartSQL(['Fecha','Ventas'],manual))
 expect(result.reason.key).toBe('charts.suggest.dateNumber')
})

it('propone dispersión para dos columnas numéricas sin agregar las observaciones',async()=>{
 const columns=await Promise.all([column(0,'Altura',['1.6','1.7','1.8']),column(1,'Peso',['60','70','80'])])
 const result=suggest(columns,{x:0,y:1})
 const manual:ChartOptions={kind:'scatter',x:0,y:1,bins:10,aggregate:'count',descending:false,measureType:'number',series:-1,time:'none'}
 expect(result.options).toEqual(manual)
 expect(chartSQL(['Altura','Peso'],result.options!)).toBe(chartSQL(['Altura','Peso'],manual))
 expect(result.reason.key).toBe('charts.suggest.twoNumbers')
})

it('propone conteo de filas para una columna textual sin inventar una medida numérica',async()=>{
 const columns=[await column(0,'Ciudad',['Oaxaca','Puebla','Oaxaca'])],result=suggest(columns,{x:0})
 const manual:ChartOptions={kind:'bar',x:0,y:-1,bins:10,aggregate:'count',descending:false,measureType:'text',series:-1,time:'none'}
 expect(result.options).toEqual(manual)
 expect(chartSQL(['Ciudad'],result.options!)).toBe(chartSQL(['Ciudad'],manual))
 expect(result.reason.key).toBe('charts.suggest.textOnly')
})

it('propone histograma para una sola columna numérica',async()=>{
 const columns=[await column(0,'Altura',['1.6','1.7','1.8'])],result=suggest(columns,{x:0})
 const manual:ChartOptions={kind:'histogram',x:0,y:0,bins:10,aggregate:'count',descending:false,measureType:'number',series:-1,time:'none'}
 expect(result.options).toEqual(manual)
 expect(chartSQL(['Altura'],result.options!)).toBe(chartSQL(['Altura'],manual))
 expect(result.reason.key).toBe('charts.suggest.numberOnly')
})

it('propone frecuencias en un mapa de calor para dos columnas textuales',async()=>{
 const columns=await Promise.all([column(0,'Ciudad',['Oaxaca','Puebla','Oaxaca']),column(1,'Categoría',['A','A','B'])]),result=suggest(columns,{x:0,y:1})
 const manual:ChartOptions={kind:'heatmap',x:0,y:1,bins:10,aggregate:'count',descending:false,measureType:'text',series:-1,time:'none'}
 expect(result.options).toEqual(manual)
 expect(chartSQL(['Ciudad','Categoría'],result.options!)).toBe(chartSQL(['Ciudad','Categoría'],manual))
 expect(result.reason.key).toBe('charts.suggest.twoTexts')
})

const kinds=['number','date','text','category','identifier','mixed','empty'] as const
const values={number:['1.5','2','3'],date:['2026-01-01','2026-02-01','2026-02-02'],text:['Norte','Centro','Sur'],category:['Norte','Sur','Norte'],identifier:['001','002','003'],mixed:['1','Sur','2'],empty:['',' ','']} as const
// Filas X y columnas Y en el orden de kinds. Los casos sin medida compatible cuentan pares exactos.
const expectedKinds=[
 ['scatter','heatmap','heatmap','heatmap','heatmap','heatmap','heatmap'],
 ['line','heatmap','heatmap','heatmap','heatmap','heatmap','heatmap'],
 ['bar','heatmap','heatmap','heatmap','heatmap','heatmap','heatmap'],
 ['bar','heatmap','heatmap','heatmap','heatmap','heatmap','heatmap'],
 ['bar','heatmap','heatmap','heatmap','heatmap','heatmap','heatmap'],
 ['bar','heatmap','heatmap','heatmap','heatmap','heatmap','heatmap'],
 ['bar','heatmap','heatmap','heatmap','heatmap','heatmap','heatmap'],
] as const
const combinations=kinds.flatMap((x,row)=>kinds.map((y,col)=>({x,y,expected:expectedKinds[row][col]})))
it.each(combinations)('tabla: $x en X y $y en Y → $expected; opciones y alternativas válidas',async({x,y,expected})=>{
 const columns=await Promise.all([column(0,'Columna X',[...values[x]]),column(1,'Columna Y',[...values[y]])])
 const result=suggest(columns,{x:0,y:1})
 expect(result.options?.kind).toBe(expected)
 if([x,y].some(kind=>['identifier','mixed','empty'].includes(kind))){expect(result.reason.key).toBe('charts.suggest.conservative');expect(result.alternatives.length).toBeGreaterThan(0)}
 for(const options of[result.options!,...result.alternatives]){
  expect(()=>chartSQL(['Columna X','Columna Y'],options)).not.toThrow()
  if(options.measureType==='number')expect(columns[options.y]).toMatchObject({profile:{kind:'number'}})
  if(options.time==='month')expect(columns[options.x]).toMatchObject({profile:{kind:'date'}})
 }
})

it.each([-1,.5,NaN,Infinity,2000,'0' as never])('no ignora una selección Y inexistente o inválida: %s',async y=>{
 const columns=[await column(0,'Ciudad',['Oaxaca','Puebla','Oaxaca'])],result=suggest(columns,{x:0,y})
 expect(result).toMatchObject({options:null,reason:{key:'charts.suggest.unavailableColumn'},alternatives:[]})
})
it('rechaza índices de perfil duplicados en vez de usar el primero silenciosamente',async()=>{
 const first=await column(0,'Ciudad',['Oaxaca','Puebla','Oaxaca']),second=await column(0,'Ventas',['1','2','3'])
 expect(suggest([first,second],{x:0})).toMatchObject({options:null,reason:{key:'charts.suggest.unavailableColumn'}})
})
it('si sólo se elige Y o se repite el mismo campo propone una sola variable',async()=>{
 const columns=[await column(0,'Altura',['1.6','1.7','1.8'])]
 for(const shelves of[{y:0},{x:0,y:0}])expect(suggest(columns,shelves).options).toMatchObject({kind:'histogram',x:0,y:0})
})
it('sin columnas no inventa índices y sin selección no escoge la primera de oficio',async()=>{
 expect(suggest([],{x:0})).toMatchObject({options:null,reason:{key:'charts.suggest.noColumns'},alternatives:[]})
 expect(suggest([await column(0,'Ciudad',['Oaxaca','Puebla','Oaxaca'])],{})).toMatchObject({options:null,reason:{key:'charts.suggest.chooseColumn'},alternatives:[]})
})

it.each(['es','en','en-XA'] as const)('las explicaciones se pueden mostrar en %s sin claves crudas ni parámetros pendientes',async locale=>{
 const sources=await Promise.all(kinds.map(async(kind,index)=>column(index,'Valor '+index,[...values[kind]])))
 const results=[suggest([],{}),suggest(sources,{}),suggest(sources,{x:999}),...sources.flatMap(x=>sources.map(y=>suggest(sources,{x:x.column,y:y.column}))),...sources.map(x=>suggest(sources,{x:x.column}))]
 for(const {reason} of results){
  const text=t(reason.key,reason.parameters,locale)
  expect(text).not.toContain('charts.suggest.');expect(text).not.toMatch(/\{(?:x|y|field)(?:Position)?\}/);expect(text.length).toBeGreaterThan(20)
 }
})
it('la sugerencia no depende del idioma global',async()=>{
 const columns=await Promise.all([column(0,'Ciudad',['A','B','A']),column(1,'Total',['1','2','3'])]),before=getLanguage(),expected=suggest(columns,{x:0,y:1})
 try{for(const locale of['es','en','en-XA'] as const){setLanguage(locale);expect(suggest(columns,{x:0,y:1})).toEqual(expected)}}finally{setLanguage(before)}
})

function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.freeze(value);for(const item of Object.values(value))freeze(item)}return value}
it('200 columnas conservan posiciones y nombres y no se mutan ni se recorren celdas',async()=>{
 const text=await column(0,'Campo',['Norte','Sur','Norte'])
 const columns=Array.from({length:200},(_,column)=>({...text,column,name:`Campo ${column}`}));columns[198]=await column(198,'Medida Ω',['1','2','3'])
 const shelves={x:199,y:198},before=structuredClone({columns,shelves});freeze(columns);freeze(shelves)
 const result=suggest(columns,shelves)
 expect(result.options).toMatchObject({kind:'bar',x:199,y:198,aggregate:'sum',measureType:'number'})
 expect(()=>chartSQL(columns.map(column=>column.name),result.options!)).not.toThrow()
 expect({columns,shelves}).toEqual(before)
 result.options!.x=0;result.alternatives[0].x=0
 expect(suggest(columns,shelves).options?.x).toBe(199)
})
it('encabezados duplicados, vacíos, comillas y Unicode se conservan por posición',async()=>{
 const names=['Grupo "Ñ🐶"; SELECT 1 --','Medida "Ω"','Grupo "Ñ🐶"; SELECT 1 --','']
 const columns=await Promise.all(names.map((name,index)=>column(index,name,index===1?['1','2','3']:['Norte','Sur','Norte'])))
 const result=suggest(columns,{x:2,y:1})
 expect(result.options).toMatchObject({kind:'bar',x:2,y:1,aggregate:'sum'})
 expect(result.reason.parameters).toMatchObject({x:names[2],y:names[1]})
 for(const options of[result.options!,...result.alternatives])expect(()=>chartSQL(names,options)).not.toThrow()
 expect(suggest(columns,{x:3}).options).toMatchObject({kind:'bar',x:3,y:-1,aggregate:'count'})
})
it.each([['000123','000124'],['9007199254740993','9007199254740994']])('reutiliza las señales reales de identificador: %j, %j',async(a,b)=>{
 const columns=[await column(0,'Valor',[a,b])],result=suggest(columns,{x:0})
 expect(columns[0]).toMatchObject({profile:{kind:'identifier'}})
 expect(result.options).toMatchObject({kind:'bar',aggregate:'count',measureType:'text'})
 expect(result.reason.key).toBe('charts.suggest.conservative')
 expect(result.alternatives.every(options=>options.measureType==='text')).toBe(true)
})
it('un perfil no disponible explica la precaución sin filtrar su error técnico',()=>{
 const column={column:0,name:'Datos',error:'No abrir /ruta/privada.csv'}
 const result=suggest([column],{x:0})
 expect(result.options).toMatchObject({kind:'bar',aggregate:'count',measureType:'text'})
 expect(result.reason).toMatchObject({key:'charts.suggest.conservative',parameters:{field:'Datos'}})
 expect(JSON.stringify(result)).not.toContain('/ruta/privada.csv')
})
it('una fecha ambigua o inválida no activa agrupación temporal',async()=>{
 for(const data of[['01/02/2026','02/03/2026'],['2026-02-30','2026-03-01'],['0000-01-01','2026-03-01']]){
  const columns=await Promise.all([column(0,'Fecha',data),column(1,'Medida',['1','2'])]),result=suggest(columns,{x:0,y:1})
  expect(result.options).toMatchObject({kind:'bar',time:'none'});expect(result.alternatives.every(options=>options.time==='none')).toBe(true)
 }
})

it('las razones distinguen columnas de nombre vacío o duplicado por su posición original',async()=>{
 const columns=await Promise.all([column(0,'',['1','2','3']),column(1,'Etiqueta',['A','B','A']),column(2,'Etiqueta',['A','B','A'])])
 const pair=suggest(columns,{x:2,y:0}),single=suggest(columns,{x:0})
 expect(pair.reason.parameters).toMatchObject({x:'Etiqueta',xPosition:3,y:'',yPosition:1})
 expect(single.reason.parameters).toMatchObject({x:'',xPosition:1})
 expect(t(single.reason.key,single.reason.parameters,'es')).toContain('columna 1')
 expect(t(single.reason.key,single.reason.parameters,'en')).toContain('Column 1')
})

it('sólo propone caja si se pide distribución y se confirma más de un valor numérico por grupo',async()=>{
 const columns=await Promise.all([column(0,'Grupo',['Norte','Norte','Sur','Sur']),column(1,'Medida',['1','3','2','6'])])
 const result=suggest(columns,{x:0,y:1,distribution:true,multipleValuesPerGroup:true})
 const manual:ChartOptions={kind:'box',x:0,y:1,bins:10,aggregate:'count',descending:false,measureType:'number',series:-1,time:'none'}
 expect(result.options).toEqual(manual);expect(chartSQL(['Grupo','Medida'],result.options!)).toBe(chartSQL(['Grupo','Medida'],manual))
 expect(result.reason.key).toBe('charts.suggest.distribution')
 expect(suggest(columns,{x:0,y:1,multipleValuesPerGroup:true}).options?.kind).toBe('bar')
})
it.each([undefined,false])('distribución sin confirmación positiva (%s) mantiene barras y ofrece histograma',async multipleValuesPerGroup=>{
 const columns=await Promise.all([column(0,'Grupo',['Norte','Sur','Oeste']),column(1,'Medida',['1','3','2'])])
 const result=suggest(columns,{x:0,y:1,distribution:true,multipleValuesPerGroup})
 expect(result.options?.kind).toBe('bar')
 expect(result.reason.key).toBe(multipleValuesPerGroup===false?'charts.suggest.distributionTooFew':'charts.suggest.distributionNeedsEvidence')
 expect(result.alternatives.some(options=>options.kind==='histogram'&&options.y===1)).toBe(true)
 for(const options of[result.options!,...result.alternatives])expect(()=>chartSQL(['Grupo','Medida'],options)).not.toThrow()
})
it('la evidencia de grupos nunca convierte un identificador en medida ni sustituye los tipos de perfil',async()=>{
 const columns=await Promise.all([column(0,'Grupo',['Norte','Norte','Sur','Sur']),column(1,'Código',['001','002','003','004'])])
 const result=suggest(columns,{x:0,y:1,distribution:true,multipleValuesPerGroup:true})
 expect(result.options).toMatchObject({kind:'heatmap',aggregate:'count',measureType:'text'})
 expect(result.reason.key).toBe('charts.suggest.distributionIncompatible')
 expect(result.alternatives.every(options=>options.measureType==='text')).toBe(true)
})

it.each(['es','en','en-XA'] as const)('las razones de distribución también están traducidas en %s',async locale=>{
 const columns=await Promise.all([column(0,'Grupo',['Norte','Norte','Sur','Sur']),column(1,'Medida',['1','3','2','6'])])
 for(const multipleValuesPerGroup of[undefined,false,true]){
  const result=suggest(columns,{x:0,y:1,distribution:true,multipleValuesPerGroup})
  expect(t(result.reason.key,result.reason.parameters,locale)).not.toContain('charts.suggest.')
 }
 const result=suggest(columns,{x:1,y:0,distribution:true,multipleValuesPerGroup:true})
 expect(t(result.reason.key,result.reason.parameters,locale)).not.toContain('charts.suggest.')
})
