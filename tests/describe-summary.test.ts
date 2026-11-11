import {expect,it} from 'vitest'
import {analyzeColumn} from '../src/main/table-analysis'
import type {ColumnAnalysisRequest,TableRow} from '../src/shared/types'

const request:ColumnAnalysisRequest={column:0,revision:0,requestId:'describe-test',frequencyOffset:0,duplicatesOnly:false,bins:4}
const rows=(cells:string[][]):TableRow[]=>cells.map((cells,index)=>({id:String(index+1),cells}))

it('describe excluye vacíos y ausentes sin cambiar los distintos ni las frecuencias anteriores',async()=>{
 const source=rows([['1'],['x'],['1'],[''],['  '],[]]),before=structuredClone(source)
 const result=await analyzeColumn(source,undefined,request,()=>{},'Mixta')
 expect(result.describe).toEqual({count:3,unique:2,top:'1',freq:2,dateMin:null,dateMax:null})
 expect(result).toMatchObject({cells:6,empty:3,missing:1,whitespace:1,unique:4,profile:{kind:'mixed'}})
 expect(result.frequencies.find(entry=>entry.value==='')).toMatchObject({count:2,firstRow:4})
 expect(source).toEqual(before)
})

it('describe conserva el texto completo y distingue espacios, Unicode y marcadores sin interpretarlos',async()=>{
 const top='á😺<img src=x> | '+ 'x'.repeat(300)
 const result=await analyzeColumn(rows([[top],[' a'],['a'],[top],['a ']]),undefined,request,()=>{},'Texto')
 expect(result.describe).toEqual({count:5,unique:4,top,freq:2,dateMin:null,dateMax:null})
 expect(result.frequencies[0]).toMatchObject({value:top.slice(0,256),truncated:true,count:2})
})

it('describe resuelve empates por la primera fila original aunque el alcance esté ordenado al revés',async()=>{
 const source=rows([['a'],['b'],['b'],['a']])
 const result=await analyzeColumn(source,[3,2,1,0],request,()=>{},'Texto')
 expect(result.describe).toMatchObject({count:4,unique:2,top:'a',freq:2})
})

it('describe encuentra el top con contenido aunque la primera página de frecuencias solo tenga espacios',async()=>{
 const cells=Array.from({length:51},(_,index)=>Array.from({length:3},()=>[' '.repeat(index+1)])).flat()
 const result=await analyzeColumn(rows([...cells,['dato'],['dato']]),undefined,request,()=>{},'Texto')
 expect(result.describe).toEqual({count:2,unique:1,top:'dato',freq:2,dateMin:null,dateMax:null})
 expect(result.frequencies).toHaveLength(50)
 expect(result.frequencies.every(entry=>!entry.value.trim())).toBe(true)
})

it.each([{cells:[]},{cells:[[''],['  '],[]]}])('describe de una columna vacía no inventa top ni frecuencias: $cells',async({cells})=>{
 const result=await analyzeColumn(rows(cells),undefined,request,()=>{},'Vacía')
 expect(result.describe).toEqual({count:0,unique:0,top:null,freq:null,dateMin:null,dateMax:null})
})

it('describe compara fechas ISO con espacios exteriores y omite siempre su top y frecuencia',async()=>{
 const source=rows([[' 2026-01-30 '],['2026-03-04'],['2026-01-02'],['2026-03-04'],['  ']]),before=structuredClone(source)
 const result=await analyzeColumn(source,undefined,request,()=>{},'Alta')
 expect(result.describe).toEqual({count:4,unique:3,top:null,freq:null,dateMin:'2026-01-02',dateMax:'2026-03-04'})
 expect(result.profile).toMatchObject({kind:'date',dates:4,invalidDates:0})
 expect(result.frequencies.find(entry=>entry.value==='2026-03-04')?.count).toBe(2)
 expect(source).toEqual(before)
})

it('describe no convierte una columna mixta con fechas imposibles en una fecha uniforme',async()=>{
 const result=await analyzeColumn(rows([['0000-01-01'],['2026-02-30'],['2024-02-29']]),undefined,request,()=>{},'Alta')
 expect(result.profile).toMatchObject({kind:'mixed',dates:1,invalidDates:2})
 expect(result.describe).toEqual({count:3,unique:3,top:'0000-01-01',freq:1,dateMin:null,dateMax:null})
})

it('describe conserva como distintos los textos de fecha con espacios aunque compare los mismos extremos',async()=>{
 const result=await analyzeColumn(rows([['0001-01-01'],[' 0001-01-01 '],['9999-12-31']]),undefined,request,()=>{},'Alta')
 expect(result.describe).toEqual({count:3,unique:3,top:null,freq:null,dateMin:'0001-01-01',dateMax:'9999-12-31'})
})
