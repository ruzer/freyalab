import {it,expect,beforeEach,afterEach} from 'vitest'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {randomUUID} from 'node:crypto'
import {TableEngine} from '../src/main/table-engine'
import iconv from 'iconv-lite'
import type {TableTransformEdit,TableQuery} from '../src/shared/types'
let engine:TableEngine,folder:string
const query={offset:0,limit:100,requestId:1}
beforeEach(async()=>{engine=new TableEngine();folder=await mkdtemp(join(tmpdir(),'freya-order-'))})
afterEach(async()=>rm(folder,{recursive:true,force:true}))
async function open(source:string){const path=join(folder,'data.csv');await writeFile(path,source);await engine.open('a',path)}
async function request(operation:TableTransformEdit['operation'],extra:Partial<TableTransformEdit>={}):Promise<TableTransformEdit>{return{type:'structure',operation,columns:[],revision:(await engine.info('a')).revision,requestId:randomUUID(),...extra}}
async function ids(id='a'){return(await engine.page(id,query)).rows.map(row=>row.id)}

it('mueve filas discontinuas en orden original, mantiene IDs/texto y permite recuperación/deshacer/rehacer',async()=>{
 const source='ID,Nota\r\n00123,"á\r\nñ"\r\n9007199254740993,dos\r\n0007,tres\r\n004,cuatro\r\n';await open(source)
 const change=await request('moveRows',{rowIds:['3','1'],destination:4}),before=await engine.snapshot('a')
 expect(await engine.transformPreview('a',change)).toMatchObject({movedRows:4,affected:4,deletedRows:0});expect(await engine.snapshot('a')).toEqual(before)
 await engine.edit('a',change);expect(await ids()).toEqual(['2','4','1','3']);expect((await engine.page('a',query)).rows[2].cells).toEqual(['00123','á\r\nñ'])
 const snapshot=JSON.parse(JSON.stringify(await engine.snapshot('a')));expect(snapshot.version).toBe(2);expect(snapshot.state.history[0].forward).toEqual([{type:'rowOrder',order:[1,3,0,2]}]);await engine.restore('b',snapshot)
 await engine.undo('b');expect((await engine.serialize('b')).toString()).toBe(source)
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source);await engine.undo('a',true);expect(await ids()).toEqual(['2','4','1','3'])
})
it('resuelve rangos de una vista filtrada/ordenada sin mover filas ocultas ni cambiar el orden relativo original',async()=>{
 await open('ID,Grupo\n001,A\n002,B\n003,A\n004,A\n005,B\n')
 const view={...query,search:'A',order:[{column:0,descending:true,numeric:false}]},revision=(await engine.info('a')).revision
 await engine.edit('a',await request('moveRows',{range:{top:0,bottom:1,left:0,right:1,query:view,revision},destination:0}))
 expect(await ids()).toEqual(['3','4','1','2','5'])
 await engine.undo('a');expect(await ids()).toEqual(['1','2','3','4','5'])
})
it('no crea historial para movimientos vacíos y rechaza destinos, IDs o revisiones inválidos íntegramente',async()=>{
 await open('A\nx\ny\nz\n');const before=await engine.snapshot('a')
 await engine.edit('a',await request('moveRows',{rowIds:['1'],destination:1}));expect(await engine.snapshot('a')).toEqual(before)
 for(const extra of [{rowIds:[],destination:0},{rowIds:['1'],destination:0},{rowIds:['99'],destination:0},{rowIds:['1'],destination:4},{rowIds:['1'],destination:-1},{rowIds:['1'],destination:1.5},{rowIds:['1'],destination:3,revision:9}])await expect(engine.edit('a',await request('moveRows',extra))).rejects.toThrow()
 const range={top:0,bottom:1,left:0,right:0,revision:0,query};await expect(engine.edit('a',await request('moveRows',{range,rowIds:['1'],destination:3}))).rejects.toThrow('sin combinar')
 expect(await engine.snapshot('a')).toEqual(before)
})
it('mueve columnas y sus encabezados; conserva texto, filas, codificación y reversibilidad',async()=>{
 const source='ID,Nota,Fecha\r\n00123,"dice ""hola""",2026-10-21\r\n9007199254740993,,\r\n';await open(source)
 const change=await request('moveColumns',{columns:[2,0],destination:3});expect(await engine.transformPreview('a',change)).toMatchObject({movedColumns:2,affected:2})
 await engine.edit('a',change);expect((await engine.info('a')).headers).toEqual(['Nota','ID','Fecha']);expect(await ids()).toEqual(['1','2']);expect((await engine.page('a',query)).rows[1].cells).toEqual(['','9007199254740993',''])
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source);await engine.undo('a',true);expect((await engine.info('a')).headers).toEqual(['Nota','ID','Fecha'])
 await engine.restore('b',JSON.parse(JSON.stringify(await engine.snapshot('a'))));await engine.undo('b');expect((await engine.serialize('b')).toString()).toBe(source)
})
it('preserva campos y encabezados ausentes y rechaza destinos que los convertirían en vacíos',async()=>{
 const source='ID,Nombre,Nota\n001,A,x\n002,B\n';await open(source)
 const before=await engine.snapshot('a');await expect(engine.edit('a',await request('moveColumns',{columns:[2],destination:0}))).rejects.toThrow('ausentes');expect(await engine.snapshot('a')).toEqual(before)
 await engine.edit('a',await request('moveColumns',{columns:[1],destination:0}));expect((await engine.page('a',query)).rows[1].cells).toEqual(['B','002']);await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source)
 await open('ID\n001,A,x\n002,B,z\n');const raw=await engine.snapshot('a');await expect(engine.edit('a',await request('moveColumns',{columns:[0],destination:3}))).rejects.toThrow('encabezados ausentes');expect(await engine.snapshot('a')).toEqual(raw)
 await engine.edit('a',await request('moveColumns',{columns:[2],destination:1}));expect((await engine.serialize('a')).toString()).toBe('ID\n001,x,A\n002,z,B\n');await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe('ID\n001,A,x\n002,B,z\n')
})
it('fija todos los criterios estables de la vista con números exactos y sin aplicar filtros implícitos',async()=>{
 const source='Grupo,ID,Nota\nB,0007,uno\nA,9007199254740993,dos\nA,9007199254740992,tres\nA,9007199254740992,cuatro\n';await open(source)
 const view:TableQuery={...query,offset:2,limit:1,order:[{column:0,descending:false,numeric:false},{column:1,descending:false,numeric:true}]}
 expect((await engine.page('a',view)).rows[0].id).toBe('2');expect((await engine.serialize('a')).toString()).toBe(source)
 await engine.edit('a',await request('commitOrder',{query:view}));expect(await ids()).toEqual(['3','4','2','1']);expect((await engine.page('a',query)).rows[2].cells[1]).toBe('9007199254740993')
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source)
 const before=await engine.snapshot('a')
 for(const q of [{...query}, {...view,search:' '},{...view,filters:{0:'A'}},{...view,conditions:[{column:0,op:'equals' as const,value:'A'}]}])await expect(engine.edit('a',await request('commitOrder',{query:q}))).rejects.toThrow()
 expect(await engine.snapshot('a')).toEqual(before)
})
it('preparar un orden no se cancela al paginar; cancelar o cambiar revisión sí descarta todo',async()=>{
 await open('ID\n'+Array.from({length:5000},(_,i)=>String(i).padStart(5,'0')).join('\n')+'\n');const base=await engine.snapshot('a');let action='page',fired=false
 engine=new TableEngine(event=>{if(!fired&&event.rows>=513){fired=true;if(action==='cancel')void engine.cancelAnalysis('a',event.requestId);else if(action==='change')void engine.edit('a',{type:'cell',rowId:'1',column:0,value:'externo'});else void engine.page('a',{...query,offset:100}).catch(()=>{})}})
 await engine.restore('a',base);await engine.edit('a',await request('moveRows',{rowIds:['1'],destination:5000}));expect((await engine.page('a',{...query,offset:4999})).rows[0].id).toBe('1')
 for(action of ['cancel','change']){
  await engine.restore('a',base);const before=await engine.snapshot('a');fired=false
  await expect(engine.edit('a',await request('moveRows',{rowIds:['1'],destination:5000}))).rejects.toThrow('cancelada')
  const after=await engine.snapshot('a');if(action==='cancel')expect(after).toEqual(before);else{expect(after.state.history).toHaveLength(1);expect(after.state.rows[0]).toEqual({id:'1',cells:['externo']});expect(after.state.rows[1].id).toBe('2')}
 }
})
it('lee una recuperación v1 auténtica y deshace; rechaza versiones o mutaciones desconocidas sin reemplazar el estado',async()=>{
 const fixture=JSON.parse(await readFile(new URL('./fixtures/recovery-csv-v1.json',import.meta.url),'utf8'))
 expect(fixture.snapshot.version).toBe(1);await engine.restore('a',fixture.snapshot);await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe('ID,Nota\r\n00123,original\r\n0007,café\r\n')
 const before=await engine.snapshot('a');for(const version of [0,3,99])await expect(engine.restore('a',{...fixture.snapshot,version})).rejects.toThrow('no compatible')
 const unknown=structuredClone(fixture.snapshot);unknown.state.history[0].forward[0].type='unknown';await expect(engine.restore('a',unknown)).rejects.toThrow('no compatible')
 const legacyOrder=structuredClone(fixture.snapshot);legacyOrder.state.history[0].forward=[{type:'rowOrder',order:[1,0]}];await expect(engine.restore('a',legacyOrder)).rejects.toThrow('no compatible')
 expect(await engine.snapshot('a')).toEqual(before)
})
it('un orden corrupto falla al deshacer sin perder historial ni modificar datos',async()=>{
 await open('A\nx\ny\n');await engine.edit('a',await request('moveRows',{rowIds:['1'],destination:2}));const snapshot=await engine.snapshot('a')
 const backward=snapshot.state.history[0].backward[0];if(!('order' in backward))throw new Error('Falta orden');backward.order=[0,0];await engine.restore('a',snapshot);const before=await engine.snapshot('a')
 await expect(engine.undo('a')).rejects.toThrow('secuencia');expect(await engine.snapshot('a')).toEqual(before)
})
it('recupera tablas irregulares contando celdas reales, no una matriz densa inexistente',async()=>{
 const source=Array.from({length:200},(_,i)=>'C'+i).join(',')+'\n'+'00123\n'.repeat(11000);await open(source);const snapshot=await engine.snapshot('a');await engine.restore('b',snapshot);expect((await engine.serialize('b')).toString()).toBe(source)
 const before=await engine.snapshot('a');snapshot.state.readonly=true;await expect(engine.restore('a',snapshot)).rejects.toThrow('no válida');expect(await engine.snapshot('a')).toEqual(before)
})
it('reordena 40 MiB de valores sin duplicarlos en el historial; deshacer reproduce los bytes originales',async()=>{
 const source='ID,Texto\n'+Array.from({length:20000},(_,i)=>String(i).padStart(6,'0')+','+'á'.repeat(1100)).join('\n')+'\n';expect(Buffer.byteLength(source)).toBeGreaterThan(40*1024*1024);await open(source)
 await engine.edit('a',await request('moveRows',{rowIds:['1'],destination:20000}));const snapshot=await engine.snapshot('a');expect(Buffer.byteLength(JSON.stringify(snapshot.state.history))).toBeLessThan(300000);expect(snapshot.state.history).toHaveLength(1)
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source)
},30000)

it('fijar orden conserva su consulta aunque lleguen peticiones de páginas durante el cálculo',async()=>{
 await open('ID\n'+Array.from({length:20000},(_,i)=>String(i).padStart(5,'0')).join('\n')+'\n')
 const change=await request('commitOrder',{query:{...query,order:[{column:0,descending:true,numeric:false}]}}),before=await engine.snapshot('a'),pending:Promise<unknown>[]=[]
 let paging=true,visits=0
 function paginate(){if(!paging)return;visits++;pending.push(engine.page('a',{...query,search:'9',offset:visits}).catch(()=>{}));setImmediate(paginate)}
 paginate()
 try{expect(await engine.transformPreview('a',change)).toMatchObject({movedRows:20000})}finally{paging=false;await Promise.all(pending)}
 expect(visits).toBeGreaterThan(1);expect(await engine.snapshot('a')).toEqual(before)
})
it('mover columnas respeta delimitador, BOM, codificación y documentos sin encabezado',async()=>{
 for(const encoding of ['utf16le','win1252'] as const){
  const path=join(folder,encoding+'.csv'),source='00123;Árbol\r\n9007199254740993;café\r\n';await writeFile(path,iconv.encode(source,encoding,{addBOM:encoding==='utf16le'}));await engine.open('a',path,{encoding,delimiter:';',header:false})
  await engine.edit('a',await request('moveColumns',{columns:[1],destination:0}));const result=await engine.serialize('a');expect(iconv.decode(result,encoding)).toBe('Árbol;00123\r\ncafé;9007199254740993\r\n');if(encoding==='utf16le')expect(result.subarray(0,2)).toEqual(Buffer.from([255,254]))
  await engine.undo('a');expect(await engine.serialize('a')).toEqual(await readFile(path))
 }
})
