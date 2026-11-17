import {describe,expect,it} from 'vitest'
import {tableFromIPC} from 'apache-arrow'
import {TableEngine} from '../src/main/table-engine'
import type {RecipeOperationResult} from '../src/shared/recipe-operation'

const result:RecipeOperationResult={headers:['Nota','ID','Final'],columns:[{position:5,name:'Nota'},{position:1,name:'ID'},{position:6,name:'Final'}],rows:[[null,'00128',null],['','00124',''],['línea 1\nlínea 2','9007199254740993',null]],scanned:7,eligible:3,resultCount:3,complete:true,cancelled:false,bytesRead:200,sha256:'a'.repeat(64),sampling:[]}
const install=async()=>{const engine=new TableEngine();await engine.installSubset('subset',structuredClone(result));return engine}
describe('PRJ-02b · snapshot del conjunto en el motor existente',()=>{
 it('instala todas las filas como solo lectura, sin convertirlo en muestra ni rellenar ausentes',async()=>{
  const engine=await install(),info=await engine.info('subset'),page=await engine.page('subset',{offset:0,limit:100,requestId:1})
  expect(info).toMatchObject({headers:result.headers,rowCount:3,readonly:true,dirty:false})
  expect(page.sample).toBe(false);expect(page.rows.map(row=>row.cells.length)).toEqual([2,3,2])
  expect(0 in page.rows[0].cells).toBe(false);expect(page.rows[0].cells[1]).toBe('00128');expect(page.rows[1].cells[0]).toBe('')
 })
 it('perfiles y estadísticas distinguen ausencia interior, ausencia final y vacío exacto',async()=>{
  const engine=await install()
  const profile=await engine.analyzeColumn('subset',{column:0,revision:0,requestId:'p',frequencyOffset:0,duplicatesOnly:false,bins:10})
  expect(profile).toMatchObject({sample:false,cells:3,empty:2,missing:1})
  expect(await engine.stats('subset',null,[0,2],{revision:0,requestId:'s'})).toMatchObject({sample:false,cells:6,empty:5,missing:3})
 })
 it('Arrow usa el snapshot sin ruta y conserva null frente a cadena vacía',async()=>{
  const engine=await install(),meta=await engine.analysisStart('subset','ticket',0,null)
  expect(meta).toMatchObject({readonly:false,headers:result.headers})
  const data:(string|null)[][]=[]
  while(true){const chunk=await engine.analysisNext('ticket');if(chunk.done)break;const table=tableFromIPC(chunk.data);for(let row=0;row<table.numRows;row++)data.push(Array.from({length:table.numCols},(_,column)=>table.getChildAt(column)!.get(row) as string|null))}
  expect(data).toEqual(result.rows)
 })
 it('una consulta adicional se aplica solo al snapshot, sin releer la raíz',async()=>{
  const engine=await install()
  await engine.analysisStart('subset','ticket',0,null,{offset:0,limit:1,requestId:1,conditions:[{column:1,op:'equals',value:'00128'}]})
  const chunk=await engine.analysisNext('ticket');expect(chunk.rows).toBe(1)
  if(!chunk.done){const table=tableFromIPC(chunk.data);expect(table.getChildAt(0)!.get(0)).toBeNull();expect(table.getChildAt(1)!.get(0)).toBe('00128')}
 })
 it('cerrar cancela streams y elimina el snapshot',async()=>{
  const engine=await install();await engine.analysisStart('subset','ticket',0,null);await engine.close('subset')
  await expect(engine.analysisNext('ticket')).rejects.toThrow();await expect(engine.info('subset')).rejects.toThrow()
 })
 it.each(['cell','insertRow','deleteRows','header','undo','serialize','markSaved'] as const)('no admite %s ni modifica su estado',async method=>{
  const engine=await install(),before=await engine.snapshot('subset')
  const action=method==='undo'?()=>engine.undo('subset'):method==='serialize'?()=>engine.serialize('subset'):method==='markSaved'?()=>engine.markSaved('subset'):()=>engine.edit('subset',method==='cell'?{type:'cell',rowId:'1',column:0,value:'cambio'}:method==='insertRow'?{type:'insertRow'}:method==='deleteRows'?{type:'deleteRows',ids:['1']}:{type:'header',index:0,name:'Cambio'})
  await expect(action()).rejects.toThrow();expect(await engine.snapshot('subset')).toEqual(before)
 })
 it('rechaza una entrada parcial o cancelada sin instalarla',async()=>{
  const engine=new TableEngine()
  for(const change of [{complete:false},{cancelled:true},{sha256:undefined}])await expect(engine.installSubset('subset',{...result,...change})).rejects.toThrow()
  await expect(engine.info('subset')).rejects.toThrow()
 })
})
