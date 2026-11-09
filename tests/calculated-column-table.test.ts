import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tableFromIPC } from 'apache-arrow'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TableEngine } from '../src/main/table-engine'
import type { CalculateColumnEdit, CalculatedValue } from '../src/shared/calculated-column'

let folder:string
let engine:TableEngine
const query={offset:0,limit:100,requestId:1}
async function fixture(csv:string,overrides:Partial<CalculateColumnEdit>={}){
 const path=join(folder,'data.csv')
 await writeFile(path,csv)
 const {revision}=await engine.open('csv',path)
 return {type:'structure',operation:'calculate',name:'Resultado',position:1,expression:'1',columns:[],onError:'empty',revision,requestId:'calculation',...overrides} satisfies CalculateColumnEdit
}
function result(rowId:string,value:string|null,invalid:number[]=[],failed=false):CalculatedValue{return{rowId,value,invalid,failed}}

beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-calculation-'));engine=new TableEngine()})
afterEach(async()=>{await engine.close('csv');await rm(folder,{recursive:true,force:true})})

describe('calculated column in the CSV engine',()=>{
 it('streams projected fields in canonical order with stable IDs, pending edits and missing fields',async()=>{
  const edit=await fixture('ID,Nota,Precio\r\n00001,,300\r\n00002\r\n',{columns:[{index:2,read:'number',scale:2},{index:1,read:'text'}]})
  const filtered=await engine.page('csv',{...query,search:'00001'})
  expect(filtered.rows).toHaveLength(1)
  const modified=await engine.edit('csv',{type:'cell',rowId:'1',column:2,value:'9007199254740993'})
  const source=await engine.calculationStart('csv','ticket',{...edit,revision:modified.revision})
  expect(source).toEqual({headers:['ID','Nota','Precio'],revision:modified.revision,rows:2})
  const first=await engine.analysisNext('ticket')
  if(first.done)throw new Error('Expected an Arrow batch')
  expect(tableFromIPC(first.data).toArray().map(row=>row.toJSON())).toEqual([
   {c1:'9007199254740993',c2:'',c3:'1'},
   {c1:null,c2:null,c3:'2'},
  ])
  expect(await engine.analysisNext('ticket')).toEqual({done:true,rows:0})
 })

 it('maps shuffled results, previews without mutation and adds one reversible column',async()=>{
  const source='ID,Precio\r\n00001,10.10\r\n00002\r\n00003,4\r\n'
  const edit=await fixture(source,{columns:[{index:1,read:'number',scale:2}]})
  const values=[result('3','0.30'),result('1','30.30'),result('2',null,[1])]
  const preview=await engine.calculationPreview('csv',edit,values)
  expect(preview).toMatchObject({rows:3,affected:3,emptyRows:1,invalidByColumn:{1:1},failures:1})
  expect(preview.samples.map(sample=>sample.after)).toEqual(['30.30','','0.30'])
  expect((await engine.info('csv')).dirty).toBe(false)
  await expect(engine.calculationApply('csv',{...edit,onError:'abort'},values)).rejects.toThrow('"code":"failedRows"')
  expect((await engine.info('csv')).dirty).toBe(false)
  await engine.calculationApply('csv',edit,values)
  const inserted=(await engine.page('csv',query)).rows
  expect(inserted).toEqual([
   {id:'1',cells:['00001','30.30','10.10']},
   {id:'2',cells:['00002','']},
   {id:'3',cells:['00003','0.30','4']},
  ])
  expect((await engine.info('csv')).dirty).toBe(true)
  await engine.undo('csv')
  expect((await engine.serialize('csv')).toString()).toBe(source)
  expect((await engine.info('csv')).dirty).toBe(false)
  await engine.undo('csv',true)
  expect((await engine.page('csv',query)).rows).toEqual(inserted)
 })

 it('rejects stale, missing, duplicated and ragged rows before changing anything',async()=>{
  const source='ID,Precio\n00001,10.10\n00002\n'
  const edit=await fixture(source)
  const values=[result('1','30.30'),result('2','2')]
  await expect(engine.calculationStart('csv','ticket',{...edit,position:2})).rejects.toThrow('"code":"rowTooShort","row":2')
  await expect(engine.calculationApply('csv',{...edit,revision:edit.revision-1},values)).rejects.toThrow('cambió')
  await expect(engine.calculationApply('csv',edit,[values[0]])).rejects.toThrow('todas las filas')
  await expect(engine.calculationApply('csv',edit,[values[0],values[0]])).rejects.toThrow('no válidos')
  await expect(engine.calculationApply('csv',edit,[values[0],result('otra','2')])).rejects.toThrow('todas las filas')
  const applying=engine.calculationApply('csv',edit,values)
  await engine.cancelAnalysis('csv',edit.requestId)
  await expect(applying).rejects.toThrow('cancelada')
  expect((await engine.serialize('csv')).toString()).toBe(source)
 })

 it('enforces record bytes after escaping and the undo budget before mutation',async()=>{
  const edit=await fixture('ID\n'+Array.from({length:24},(_,index)=>`${index+1}\n`).join(''))
  const oversized=result('1','"'.repeat(550_000))
  const values=Array.from({length:24},(_,index)=>result(String(index+1),''))
  await expect(engine.calculationApply('csv',edit,[oversized,...values.slice(1)])).rejects.toThrow('registro resultante supera 1 MiB')
  await expect(engine.calculationApply('csv',edit,values.map(row=>({...row,value:'x'.repeat(900_000)})))).rejects.toThrow('deshacer de 20 MiB')
  expect((await engine.info('csv')).dirty).toBe(false)
 })

 it('rejects a 201st column and an insertion beyond the physical header',async()=>{
  const full=Array.from({length:200},(_,index)=>`Col${index+1}`).join(',')
  const first=await fixture(`${full}\n${full}\n`)
  await expect(engine.calculationStart('csv','ticket',first)).rejects.toThrow('200 columnas')
  const second=await fixture('ID,Nombre\n001,A,Ausente en el encabezado\n',{position:3})
  await expect(engine.calculationStart('csv','ticket',second)).rejects.toThrow('"code":"headerTooShort"')
 })
})
