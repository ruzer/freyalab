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

it('el fixture aprobado conserva los perfiles, recuentos y descriptivas numéricas conocidos',async()=>{
 const source=rows([
  ['a','10','1','2026-01-02','1'],['b','20','2','2026-03-04','x'],
  ['a','30','3','2026-02-01','1'],['c','40','4','2026-01-15',''],
  ['a','','','2026-02-20',''],['a','50','','2026-01-30','']
 ]),before=structuredClone(source)
 const headers=['Producto','Precio','Cantidad','Alta','Mixta'],results=[]
 for(const [column,header] of headers.entries())results.push(await analyzeColumn(source,undefined,{...request,column},()=>{},header))
 expect(results.map(result=>result.profile.kind)).toEqual(['category','number','number','date','mixed'])
 expect(results.map(result=>result.describe.count)).toEqual([6,5,4,6,3])
 expect(results[0].describe).toMatchObject({unique:3,top:'a',freq:4})
 expect(results[3].describe).toEqual({count:6,unique:6,top:null,freq:null,dateMin:'2026-01-02',dateMax:'2026-03-04'})
 expect(results[4].describe).toMatchObject({unique:2,top:'1',freq:2})
 expect(results[1]).toMatchObject({numeric:5,average:30,min:10,percentile25:20,median:30,percentile75:40,max:50})
 expect(results[1].sampleDeviation).toBeCloseTo(15.811388300841896,12)
 expect(results[2]).toMatchObject({numeric:4,average:2.5,min:1,percentile25:1.75,median:2.5,percentile75:3.25,max:4})
 expect(results[2].sampleDeviation).toBeCloseTo(1.2909944487358056,12)
 expect(source).toEqual(before)
})
