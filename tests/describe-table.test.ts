import {expect,it} from 'vitest'
import {describeTable,type DescribeEntry} from '../src/renderer/lib/describe-table'

const entries:DescribeEntry[]=[
 {index:0,name:'Producto',profile:{kind:'category'},description:{count:6,unique:3,top:'a',freq:4,dateMin:null,dateMax:null}},
 {index:1,name:'Precio',profile:{kind:'number'},stats:{numeric:5,average:30,sampleDeviation:15.811388300841896,min:10,percentile25:20,median:30,percentile75:40,max:50}},
 {index:2,name:'Cantidad',profile:{kind:'number'},stats:{numeric:4,average:2.5,sampleDeviation:1.2909944487358056,min:1,percentile25:1.75,median:2.5,percentile75:3.25,max:4}},
 {index:3,name:'Alta',profile:{kind:'date'},description:{count:6,unique:6,top:null,freq:null,dateMin:'2026-01-02',dateMax:'2026-03-04'}},
 {index:4,name:'Mixta',profile:{kind:'mixed'},description:{count:3,unique:2,top:'1',freq:2,dateMin:null,dateMax:null}}
]

it('describe numérico usa ocho filas, desviación muestral y los valores completos del fixture',()=>{
 const table=describeTable(entries,false)
 expect(table.columns.map(column=>column.name)).toEqual(['Precio','Cantidad'])
 expect(table.rows).toEqual([
  {metric:'count',values:[5,4]},{metric:'mean',values:[30,2.5]},
  {metric:'std',values:[15.811388300841896,1.2909944487358056]},
  {metric:'min',values:[10,1]},{metric:'25%',values:[20,1.75]},
  {metric:'50%',values:[30,2.5]},{metric:'75%',values:[40,3.25]},{metric:'max',values:[50,4]}
 ])
})

it('incluir texto añade las filas aplicables sin promediar identificadores ni columnas mixtas',()=>{
 const table=describeTable(entries,true)
 expect(table.columns.map(column=>column.name)).toEqual(['Producto','Precio','Cantidad','Alta','Mixta'])
 expect(table.rows.find(row=>row.metric==='count')?.values).toEqual([6,5,4,6,3])
 expect(table.rows.find(row=>row.metric==='unique')?.values).toEqual([3,null,null,6,2])
 expect(table.rows.find(row=>row.metric==='top')?.values).toEqual(['a',null,null,null,'1'])
 expect(table.rows.find(row=>row.metric==='freq')?.values).toEqual([4,null,null,null,2])
 expect(table.rows.find(row=>row.metric==='mean')?.values).toEqual([null,30,2.5,null,null])
 expect(table.rows.find(row=>row.metric==='min')?.values).toEqual([null,10,1,'2026-01-02',null])
 expect(table.rows.find(row=>row.metric==='max')?.values).toEqual([null,50,4,'2026-03-04',null])
})

it('una columna vacía solo tiene count cero; no disponible nunca se sustituye por cero',()=>{
 const result=describeTable([{index:0,name:'Vacía',profile:{kind:'empty'}},{index:1,name:'No disponible',profile:{kind:'text'},unavailable:true}],true)
 expect(result.rows[0].values).toEqual([0,null])
 expect(result.rows.slice(1).every(row=>row.values.every(value=>value===null))).toBe(true)
})

it('una cifra mantiene std vacío y no genera valores no finitos',()=>{
 const table=describeTable([{index:0,name:'N',profile:{kind:'number'},stats:{numeric:1,average:7,sampleDeviation:null,min:7,percentile25:7,median:7,percentile75:7,max:7}}],false)
 expect(table.rows.map(row=>row.values[0])).toEqual([1,7,null,7,7,7,7,7])
})

it('conserva top completo, nombres repetidos y el orden de cien columnas sin mutar entradas',()=>{
 const top='á😺'.repeat(150),columns:DescribeEntry[]=Array.from({length:100},(_,index)=>({index,name:index<2?'Duplicada':`C${index}`,profile:{kind:'identifier'},description:{count:2,unique:1,top,freq:2,dateMin:null,dateMax:null}})),before=structuredClone(columns)
 const table=describeTable(columns,true)
 expect(table.columns.map(column=>column.index)).toEqual(Array.from({length:100},(_,index)=>index))
 expect(table.rows.find(row=>row.metric==='top')?.values).toEqual(Array(100).fill(top))
 expect(table.rows.find(row=>row.metric==='mean')?.values).toEqual(Array(100).fill(null))
 expect(columns).toEqual(before)
 expect(describeTable([],false).columns).toEqual([])
})
