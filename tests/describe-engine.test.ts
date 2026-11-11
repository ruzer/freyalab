import {expect,it} from 'vitest'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {randomUUID} from 'node:crypto'
import {TableEngine} from '../src/main/table-engine'
import type {ColumnAnalysisRequest} from '../src/shared/types'

it('describe desempata por el orden canónico después de mover filas, no por sus identificadores estables',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-describe-order-')),path=join(folder,'datos.csv'),engine=new TableEngine(),source='Valor\na\nb\nb\na\n'
 const request:ColumnAnalysisRequest={column:0,revision:0,requestId:randomUUID(),frequencyOffset:0,duplicatesOnly:false,bins:4}
 try{
  await writeFile(path,source);await engine.open('a',path)
  expect((await engine.analyzeColumn('a',request)).describe).toMatchObject({top:'a',freq:2})
  await engine.edit('a',{type:'structure',operation:'moveRows',columns:[],rowIds:['2','3'],destination:0,requestId:randomUUID(),revision:0})
  expect((await engine.page('a',{offset:0,limit:4,requestId:1})).rows.map(row=>row.id)).toEqual(['2','3','1','4'])
  const before=await engine.snapshot('a'),result=await engine.analyzeColumn('a',{...request,revision:1,requestId:randomUUID()})
  expect(result.describe).toMatchObject({count:4,unique:2,top:'b',freq:2})
  expect(await engine.snapshot('a')).toEqual(before)
  expect(await readFile(path,'utf8')).toBe(source)
 }finally{await engine.close('a');await rm(folder,{recursive:true,force:true})}
})

it('dos operaciones por columna conservan las descriptivas numéricas y el rechazo exacto de frecuencias de alta cardinalidad',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-describe-')),path=join(folder,'datos.csv'),engine=new TableEngine()
 const source='Precio,Texto\n'+Array.from({length:100001},(_,index)=>`${index},valor-${index}\n`).join('')
 const request:ColumnAnalysisRequest={column:0,revision:0,requestId:randomUUID(),frequencyOffset:0,duplicatesOnly:false,bins:4}
 try{
  await writeFile(path,source);await engine.open('a',path)
  expect(await engine.analyzeColumn('a',{...request,profileOnly:true})).toEqual({profile:{kind:'number',decimalPlaces:0}})
  const numeric=await engine.stats('a',null,[0],{revision:0,requestId:randomUUID()})
  expect(numeric).toMatchObject({cells:100001,numeric:100001,unique:100001,sum:5000050000,average:50000,min:0,median:50000,max:100000,percentile25:25000,percentile75:75000,sample:false})
  expect(await engine.analyzeColumn('a',{...request,column:1,requestId:randomUUID(),profileOnly:true})).toEqual({profile:{kind:'text'}})
  await expect(engine.analyzeColumn('a',{...request,column:1,requestId:randomUUID()})).rejects.toThrow('100 000 valores distintos')
  expect(await engine.info('a')).toMatchObject({dirty:false,revision:0,readonly:false,rowCount:100001})
  expect(await readFile(path,'utf8')).toBe(source)
 }finally{await engine.close('a');await rm(folder,{recursive:true,force:true})}
})
