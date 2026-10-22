import {it,expect,beforeEach,afterEach} from 'vitest'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {randomUUID} from 'node:crypto'
import {TableEngine} from '../src/main/table-engine'
import type {TableRangeEdit,TableQuery} from '../src/shared/types'
let engine:TableEngine,folder:string
const query={offset:0,limit:100,requestId:1}
beforeEach(async()=>{engine=new TableEngine();folder=await mkdtemp(join(tmpdir(),'freya-range-cancel-'))})
afterEach(async()=>rm(folder,{recursive:true,force:true}))
async function open(source:string){const path=join(folder,'data.csv');await writeFile(path,source);await engine.open('a',path)}
async function request(operation:TableRangeEdit['operation'],rows:number,columns=2,view:TableQuery=query):Promise<TableRangeEdit>{return{type:'range',requestId:randomUUID(),operation,range:{top:0,bottom:rows-1,left:0,right:columns-1,query:view,revision:(await engine.info('a')).revision},value:'0007',find:'a'}}

it('cancela las siete operaciones de rango durante vista previa y aplicación sin cambiar datos, revisión o historial',async()=>{
 await open('ID,Nota\r\n'+' a ,A\r\n'.repeat(5000));await engine.edit('a',{type:'cell',rowId:'1',column:0,value:'pendiente'});await engine.undo('a');const original=await engine.snapshot('a')
 engine=new TableEngine(event=>{if(event.rows>=256)void engine.cancelAnalysis('a',event.requestId)});await engine.restore('a',original);const before=await engine.snapshot('a')
 for(const operation of ['fill','clear','trim','upper','lower','replace','paste'] as const){
  const change=await request(operation,5000);if(operation==='paste')change.values=Array.from({length:5000},()=>['00123','9007199254740993'])
  await expect(engine.rangePreview('a',change)).rejects.toThrow('rango cancelada');expect(await engine.snapshot('a')).toEqual(before)
  await expect(engine.edit('a',{...change,requestId:randomUUID()})).rejects.toThrow('rango cancelada');expect(await engine.snapshot('a')).toEqual(before)
 }
})
it('cede el control entre celdas incluso si todas pertenecen a una única fila muy ancha',async()=>{
 await open(Array.from({length:2000},(_,i)=>'C'+i).join(',')+'\n'+Array(2000).fill('x').join(',')+'\n');const snapshot=await engine.snapshot('a');let progressed=0
 engine=new TableEngine(event=>{progressed++;if(event.rows===1)void engine.cancelAnalysis('a',event.requestId)});await engine.restore('a',snapshot);const before=await engine.snapshot('a')
 await expect(engine.edit('a',await request('clear',1,2000))).rejects.toThrow('cancelada');expect(progressed).toBe(2);expect(await engine.snapshot('a')).toEqual(before)
})
it('cancelar al empezar interrumpe antes de resolver una consulta amplia y no deja trabajo registrado',async()=>{
 await open('ID\n'+'00123\n'.repeat(10000));const snapshot=await engine.snapshot('a');let cancel=true
 engine=new TableEngine(event=>{if(cancel)void engine.cancelAnalysis('a',event.requestId)});await engine.restore('a',snapshot);const before=await engine.snapshot('a')
 await expect(engine.rangePreview('a',await request('fill',10000,1,{...query,order:[{column:0,descending:true,numeric:false}]}))).rejects.toThrow('cancelada');expect(await engine.snapshot('a')).toEqual(before)
 cancel=false;expect((await engine.rangePreview('a',await request('clear',1,1))).changed).toBe(1)
})
it('una cancelación anterior no interrumpe una solicitud nueva; aplicar/deshacer conserva valores y campos ausentes',async()=>{
 const source='ID,Nota\r\n00123,"á\r\nñ"\r\n9007199254740993\r\n';await open(source);const old=await request('fill',2),snapshot=await engine.snapshot('a')
 engine=new TableEngine(()=>{void engine.cancelAnalysis('a',old.requestId!)});await engine.restore('a',snapshot)
 const change=await request('fill',2);expect((await engine.rangePreview('a',change)).changed).toBe(4);await engine.edit('a',{...change,requestId:randomUUID()});await engine.cancelAnalysis('a',change.requestId!)
 expect((await engine.page('a',query)).rows.map(row=>row.cells)).toEqual([['0007','0007'],['0007','0007']]);await engine.restore('b',JSON.parse(JSON.stringify(await engine.snapshot('a'))));await engine.undo('b');expect((await engine.serialize('b')).toString()).toBe(source)
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source);await engine.undo('a',true);expect((await engine.page('a',query)).rows[0].cells).toEqual(['0007','0007'])
})
it('descarta preparación obsoleta al cambiar la revisión y conserva únicamente la edición ajena',async()=>{
 await open('ID,Nota\n'+'00123, a \n'.repeat(5000));const snapshot=await engine.snapshot('a');let changed=false
 engine=new TableEngine(event=>{if(!changed&&event.rows>=256){changed=true;void engine.edit('a',{type:'cell',rowId:'1',column:0,value:'ajeno'})}});await engine.restore('a',snapshot)
 await expect(engine.edit('a',await request('trim',5000))).rejects.toThrow('cancelada');const after=await engine.snapshot('a');expect(after.state.history).toHaveLength(1);expect(after.state.rows[0].cells).toEqual(['ajeno',' a ']);expect(after.state.rows[1].cells).toEqual(['00123',' a '])
})
it('paginar no cancela la consulta capturada del rango ni aplica resultados a otra vista',async()=>{
 await open('ID\n'+Array.from({length:10000},(_,i)=>String(i).padStart(5,'0')).join('\n')+'\n');const change=await request('fill',2,1,{...query,order:[{column:0,descending:true,numeric:false}]}),pending:Promise<unknown>[]=[];let paging=true,visits=0
 function paginate(){if(!paging)return;visits++;pending.push(engine.page('a',{...query,search:'9',offset:visits}).catch(()=>{}));setImmediate(paginate)}paginate()
 try{await engine.edit('a',change)}finally{paging=false;await Promise.all(pending)}
 expect(visits).toBeGreaterThan(1);const rows=await engine.page('a',{...query,offset:9997});expect(rows.rows.map(row=>row.cells[0])).toEqual(['09997','0007','0007']);expect((await engine.page('a',query)).rows[0].cells[0]).toBe('00000')
})
it('mantiene el contrato anterior sin requestId y rechaza muestras y revisiones antiguas',async()=>{
 await open('ID\n00123\n');const change=await request('fill',1,1);delete change.requestId;await engine.edit('a',change);const before=await engine.snapshot('a');await expect(engine.edit('a',change)).rejects.toThrow('seleccionó el rango');expect(await engine.snapshot('a')).toEqual(before)
 const path=join(folder,'sample.csv');await writeFile(path,'A\nx\n');const {truncate}=await import('node:fs/promises');await truncate(path,50*1024*1024+1);await engine.open('a',path);await expect(engine.rangePreview('a',await request('clear',1,1))).rejects.toThrow('solo lectura')
})
