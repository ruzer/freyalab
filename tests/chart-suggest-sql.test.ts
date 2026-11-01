import {afterAll,beforeAll,expect,it} from 'vitest'
import {createRequire} from 'node:module'
import {createDuckDB,NODE_RUNTIME,VoidLogger,type DuckDBConnection} from '@duckdb/duckdb-wasm/blocking'
import {suggest,type ChartColumn} from '../src/shared/chart-suggest'
import {chartSQL,type ChartOptions} from '../src/shared/charts'
import {quoteIdentifier,sqlColumns} from '../src/shared/sql-helpers'
import {analyzeColumn} from '../src/main/table-analysis'

const headers=['Medida "Á🐶"; DROP TABLE datos; --','Fecha ISO','Etiqueta','Etiqueta','Código','Mixto','','Otra medida']
const cells=[['1.5','2026-01-01','Norte','Norte','001','1','','10'],['2','2026-02-01','Centro','Sur','002','Sur','','20'],['3','2026-02-02','Sur','Norte','003','2','','30']]
let connection:DuckDBConnection,close:()=>void,columns:ChartColumn[]
beforeAll(async()=>{
 const require=createRequire(import.meta.url)
 const db=await createDuckDB({mvp:{mainModule:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm'),mainWorker:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-mvp.worker.cjs')},eh:{mainModule:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm'),mainWorker:require.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-eh.worker.cjs')}},new VoidLogger(),NODE_RUNTIME)
 await db.instantiate();db.open({});connection=db.connect();close=()=>{connection.close();db.reset()}
 connection.query('CREATE TABLE datos ('+sqlColumns(headers).map(column=>quoteIdentifier(column.name)+' VARCHAR').join(',')+')')
 const insert=connection.prepare('INSERT INTO datos VALUES ('+headers.map(()=>'?').join(',')+')')
 try{for(const row of cells)insert.query(...row)}finally{insert.close()}
 const rows=cells.map((cells,index)=>({id:String(index+1),cells}))
 columns=await Promise.all(headers.map(async(name,column)=>({column,name,profile:(await analyzeColumn(rows,undefined,{column,revision:0,requestId:'f1-sql',frequencyOffset:0,duplicatesOnly:false,bins:10},()=>{},name)).profile})))
})
afterAll(()=>close?.())

it.each(headers.flatMap((_,x)=>headers.map((_,y)=>({x,y}))))('DuckDB real acepta X=$x, Y=$y y todas las alternativas sin modificar datos',({x,y})=>{
 const result=suggest(columns,{x,y});expect(result.options).not.toBeNull()
 for(const options of[result.options!,...result.alternatives]){
  const table=connection.query(chartSQL(headers,options))
  expect(table.schema.fields.slice(0,6).map(field=>field.name)).toEqual(['total','usable','points','present','x','value'])
  expect(String(table.get(0)?.total)).toBe('3')
 }
 expect(connection.query('SELECT * FROM datos ORDER BY rowid').toArray().map(row=>Object.values(row.toJSON()))).toEqual(cells)
})

const manual:ChartOptions={kind:'bar',x:3,y:0,bins:10,aggregate:'sum',descending:false,measureType:'number',series:-1,time:'none'}
it.each([
 {name:'suma por categoría',shelves:{x:3,y:0},options:manual,expected:[['Sur',2],['Norte',4.5]]},
 {name:'suma mensual',shelves:{x:1,y:0},options:{...manual,kind:'line' as const,x:1,time:'month' as const},expected:[['2026-01',1.5],['2026-02',5]]},
 {name:'conteo textual',shelves:{x:3},options:{...manual,y:-1,aggregate:'count' as const,measureType:'text' as const},expected:[['Sur',1],['Norte',2]]},
 {name:'pares numéricos',shelves:{x:0,y:7},options:{...manual,kind:'scatter' as const,x:0,y:7,aggregate:'count' as const},expected:[[1.5,10],[2,20],[3,30]]},
])('equivalencia numérica con configuración manual: $name',({shelves,options,expected})=>{
 const result=suggest(columns,shelves),manualSQL=chartSQL(headers,options)
 expect(chartSQL(headers,result.options!)).toBe(manualSQL)
 const rows=connection.query(manualSQL).toArray().map(row=>[row.x,Number(row.value)])
 expect(rows).toEqual(expected)
})

it('equivalencia numérica de histograma y mapa de calor, incluidos encabezados duplicados',()=>{
 const histogram:ChartOptions={...manual,kind:'histogram',x:0,y:0,aggregate:'count'}
 expect(chartSQL(headers,suggest(columns,{x:0}).options!)).toBe(chartSQL(headers,histogram))
 expect(connection.query(chartSQL(headers,histogram)).toArray().map(row=>Number(row.value))).toEqual([1,0,0,1,0,0,0,0,0,1])
 const heatmap:ChartOptions={...manual,kind:'heatmap',x:2,y:3,aggregate:'count',measureType:'text'}
 expect(chartSQL(headers,suggest(columns,{x:2,y:3}).options!)).toBe(chartSQL(headers,heatmap))
 expect(connection.query(chartSQL(headers,heatmap)).toArray().map(row=>[row.x,row.y,Number(row.value)])).toEqual([['Centro','Sur',1],['Norte','Norte',1],['Sur','Norte',1]])
})
it('caja verificada produce cuartiles independientes y el mismo SQL manual sin alterar su fuente',async()=>{
 const fixture=[['A','1'],['A','3'],['B','2'],['B','6']],rows=fixture.map((cells,index)=>({id:String(index+1),cells})),names=['Grupo','Medida']
 const profiled=await Promise.all(names.map(async(name,column)=>({column,name,profile:(await analyzeColumn(rows,undefined,{column,revision:0,requestId:'f1-box',frequencyOffset:0,duplicatesOnly:false,bins:10},()=>{},name)).profile})))
 connection.query('BEGIN')
 try{
  connection.query('DROP TABLE datos');connection.query('CREATE TABLE datos ("Grupo" VARCHAR,"Medida" VARCHAR)')
  const insert=connection.prepare('INSERT INTO datos VALUES (?,?)');try{for(const row of fixture)insert.query(...row)}finally{insert.close()}
  const result=suggest(profiled,{x:0,y:1,distribution:true,multipleValuesPerGroup:true})
  const manualBox:ChartOptions={...manual,kind:'box',x:0,y:1,aggregate:'count'}
  expect(chartSQL(names,result.options!)).toBe(chartSQL(names,manualBox))
  expect(connection.query(chartSQL(names,result.options!)).toArray().map(row=>[row.x,Number(row.value),Number(row.count),Number(row.q1),Number(row.q3)])).toEqual([['A',2,2,1.5,2.5],['B',4,2,3,5]])
  for(const options of result.alternatives)expect(()=>connection.query(chartSQL(names,options))).not.toThrow()
  expect(connection.query('SELECT * FROM datos ORDER BY rowid').toArray().map(row=>Object.values(row.toJSON()))).toEqual(fixture)
 }finally{connection.query('ROLLBACK')}
 expect(connection.query('SELECT * FROM datos ORDER BY rowid').toArray().map(row=>Object.values(row.toJSON()))).toEqual(cells)
})

it('una tabla sin registros tiene sugerencias compatibles y resultados vacíos, sin totales inventados',async()=>{
 const empty=await Promise.all(headers.map(async(name,column)=>({column,name,profile:(await analyzeColumn([],undefined,{column,revision:0,requestId:'f1-empty',frequencyOffset:0,duplicatesOnly:false,bins:10},()=>{},name)).profile})))
 connection.query('BEGIN')
 try{
  connection.query('DELETE FROM datos')
  for(const shelves of[{x:0},{x:0,y:1}]){
   const result=suggest(empty,shelves)
   for(const options of[result.options!,...result.alternatives]){
    const row=connection.query(chartSQL(headers,options)).get(0)
    expect(String(row?.total)).toBe('0');expect(String(row?.usable)).toBe('0');expect(row?.present).toBeNull()
   }
  }
 }finally{connection.query('ROLLBACK')}
 expect(connection.query('SELECT * FROM datos ORDER BY rowid').toArray().map(row=>Object.values(row.toJSON()))).toEqual(cells)
})
