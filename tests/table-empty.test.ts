import {beforeEach,afterEach,it,expect} from 'vitest'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {randomUUID,createHash} from 'node:crypto'
import iconv from 'iconv-lite'
import {setLanguage,type Language} from '../src/shared/i18n'
import {EmptyError,readEmptyError} from '../src/shared/empty-values'
import {TableEngine,TABLE_LIMITS} from '../src/main/table-engine'
import type {TableEmptyEdit} from '../src/shared/types'

let engine:TableEngine,folder:string
const query={offset:0,limit:1000,requestId:1}
beforeEach(async()=>{engine=new TableEngine();folder=await mkdtemp(join(tmpdir(),'freya-empty-'))})
afterEach(async()=>{setLanguage('es');await engine.close('a');await engine.close('b');await engine.close('reopened');await rm(folder,{recursive:true,force:true})})
async function open(source:string|Buffer){const path=join(folder,'datos.csv');await writeFile(path,source);await engine.open('a',path);return path}
async function edit(operation:TableEmptyEdit['operation'],columns=[2],extra:Record<string,unknown>={}):Promise<TableEmptyEdit>{return{type:'structure',operation,columns,includeSpaces:true,revision:(await engine.info('a')).revision,requestId:randomUUID(),...extra} as TableEmptyEdit}
async function cells(){return(await engine.page('a',query)).rows.map(row=>row.cells)}
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex')

it('rellena Mixta, avisa los campos intermedios y deshace a la longitud y bytes originales',async()=>{
 const source=await readFile('tests/fixtures/empty-values.csv'),path=await open(source),before=await engine.snapshot('a')
 const request=await edit('fillEmpty',[4],{value:'0'}),preview=await engine.transformPreview('a',request)
 expect(preview).toMatchObject({rows:7,affected:4,cells:4,empty:{missing:1,exact:3,spaces:0},withoutPrevious:0,extendedRows:1,intermediateColumns:[2,3]})
 expect(preview.samples).toHaveLength(4);expect(preview.samples.at(-1)).toMatchObject({row:6,column:4,missing:true,before:'',after:'0'})
 expect(await engine.snapshot('a')).toEqual(before)
 await engine.edit('a',request)
 expect((await cells()).at(-1)).toEqual(['d','60','','','0'])
 expect(await engine.stats('a',null,[2])).toMatchObject({empty:3,missing:0,whitespace:1})
 expect(await engine.stats('a',null,[3])).toMatchObject({empty:1,missing:0})
 const expected=source.toString().replace('c,40,4,2026-01-15,\n','c,40,4,2026-01-15,0\n').replace('a,,,2026-02-20,\n','a,,,2026-02-20,0\n').replace('a,50,"  ",2026-01-30,\n','a,50,"  ",2026-01-30,0\n').replace('d,60\n','d,60,,,0\n')
 expect((await engine.serialize('a')).toString()).toBe(expected)
 expect((await readFile(path)).equals(source)).toBe(true)
 await engine.undo('a');expect((await cells()).at(-1)).toEqual(['d','60']);expect(hash(await engine.serialize('a'))).toBe(hash(source))
})

it('usa el valor anterior del archivo completo y deja intacto el vacío que no tiene anterior',async()=>{
 const source='ID,Cantidad\nz,\ny,1\nx,2\nw,4\nv,\nu,"  "\nt\n';await open(source)
 const visible=await engine.page('a',{...query,sort:{column:0,numeric:false,descending:false},filters:{'0':'t'}})
 expect(visible.rows.map(row=>row.cells)).toEqual([['t']])
 const request=await edit('fillPrevious',[1]),preview=await engine.transformPreview('a',request)
 expect(preview).toMatchObject({rows:7,affected:3,cells:3,empty:{missing:1,exact:1,spaces:1},withoutPrevious:1,extendedRows:1,intermediateColumns:[]})
 expect(preview.samples.map(sample=>sample.row)).toEqual([4,5,6])
 await engine.edit('a',request)
 expect(await cells()).toEqual([['z',''],['y','1'],['x','2'],['w','4'],['v','4'],['u','4'],['t','4']])
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source)
})

it.each([
 {columns:[2],match:'any',includeSpaces:true,removed:[4,5,6]},
 {columns:[1,2],match:'any',includeSpaces:true,removed:[4,5,6]},
 {columns:[1,2],match:'all',includeSpaces:true,removed:[4]},
 {columns:[2],match:'any',includeSpaces:false,removed:[4,6]}
] as const)('elimina por consulta de vacíos $columns / $match / espacios=$includeSpaces, conserva y deshace',async({columns,match,includeSpaces,removed})=>{
 const source=await readFile('tests/fixtures/empty-values.csv'),path=await open(source),before=await engine.snapshot('a')
 const request=await edit('deleteRowsWhere',[...columns],{match,includeSpaces}),preview=await engine.transformPreview('a',request)
 expect(preview).toMatchObject({rows:7,affected:removed.length,deletedRows:removed.length})
 expect(preview.samples.map(sample=>sample.row)).toEqual(removed)
 expect(await engine.snapshot('a')).toEqual(before)
 await engine.edit('a',request)
 expect((await engine.info('a')).rowCount).toBe(7-removed.length)
 const rows=source.toString().trimEnd().split('\n'),expected=rows.filter((_,i)=>i===0||!removed.includes(i-1 as never)).join('\n')+'\n'
 expect((await engine.serialize('a')).toString()).toBe(expected)
 expect((await readFile(path)).equals(source)).toBe(true)
 await engine.undo('a');expect(hash(await engine.serialize('a'))).toBe(hash(source))
})

it.each([
 {encoding:'utf8',bom:true,delimiter:','},
 {encoding:'win1252',bom:false,delimiter:';'},
 {encoding:'utf16le',bom:true,delimiter:'\t'}
] as const)('conserva bytes léxicos, BOM y finales mixtos en $encoding al guardar, reabrir, recuperar y deshacer',async({encoding,bom,delimiter})=>{
 const row=(...fields:string[])=>fields.join(delimiter)
 const text=row('"ID"','"Valor"','Nota')+'\r\n'+row('"000124"','""','"a""b\nc"')+'\n'+row('900719925474099312345','""','"café"')+'\r'+row('"d"')
 const source=iconv.encode(text,encoding,{addBOM:bom}),path=join(folder,'datos.csv');await writeFile(path,source);await engine.open('a',path,{encoding,delimiter})
 const request=await edit('fillEmpty',[1],{value:'00123'})
 await engine.edit('a',request)
 const expected=iconv.encode(row('"ID"','"Valor"','Nota')+'\r\n'+row('"000124"','00123','"a""b\nc"')+'\n'+row('900719925474099312345','00123','"café"')+'\r'+row('"d"','00123'),encoding,{addBOM:bom})
 const saved=await engine.serialize('a');expect(saved.equals(expected)).toBe(true)
 await writeFile(path,saved);await engine.markSaved('a',(await engine.info('a')).revision,{path,hash:hash(saved)})
 await engine.open('reopened',path,{encoding,delimiter})
 expect((await engine.page('reopened',query)).rows.map(row=>row.cells)).toEqual([['000124','00123','a"b\nc'],['900719925474099312345','00123','café'],['d','00123']])
 const recovery=JSON.parse(JSON.stringify(await engine.snapshot('a')))
 await engine.close('a');await engine.restore('a',recovery)
 expect((await engine.serialize('a')).equals(expected)).toBe(true)
 await engine.undo('a');expect(hash(await engine.serialize('a'))).toBe(hash(source));expect((await cells()).at(-1)).toEqual(['d'])
 await engine.undo('a',true);expect((await engine.serialize('a')).equals(expected)).toBe(true)
})

it('materializa el campo ausente incluso al rellenar con texto vacío, pero no cambia otros campos',async()=>{
 const source='"ID",A,B,C\r\n"001"\r\n"002",v\r\n';await open(source)
 const request=await edit('fillEmpty',[3],{value:''}),preview=await engine.transformPreview('a',request)
 expect(preview).toMatchObject({affected:2,cells:2,empty:{missing:2,exact:0,spaces:0},extendedRows:2,intermediateColumns:[1,2]})
 await engine.edit('a',request)
 expect(await cells()).toEqual([['001','','',''],['002','v','','']])
 expect((await engine.serialize('a')).toString()).toBe('"ID",A,B,C\r\n"001",,,\r\n"002",v,,\r\n')
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source)
})

it('respeta la casilla de espacios y no inventa un valor anterior en una columna totalmente vacía',async()=>{
 const source='ID,A\n001,\n002,"  "\n003\n';await open(source)
 const request=await edit('fillEmpty',[1],{value:'00',includeSpaces:false}),preview=await engine.transformPreview('a',request)
 expect(preview).toMatchObject({affected:2,empty:{missing:1,exact:1,spaces:0}})
 await engine.edit('a',request);expect((await cells())[1]).toEqual(['002','  ']);await engine.undo('a')
 const before=await engine.snapshot('a'),previous=await edit('fillPrevious',[1]),empty=await engine.transformPreview('a',previous)
 expect(empty).toMatchObject({affected:0,withoutPrevious:3,extendedRows:0})
 await engine.edit('a',previous);expect(await engine.snapshot('a')).toEqual(before)
})

it.each(['es','en','en-XA'] as const)('devuelve un código estable con interfaz $0, sin texto traducido en el worker',async(language:Language)=>{
 await open('ID,A\n001,\n');setLanguage(language)
 await expect(engine.transformPreview('a',await edit('fillEmpty',[1],{value:'0',revision:99}))).rejects.toThrow('[freya:EMPTY] {"code":"changed"}')
})

it('valida la selección y los valores antes de preparar una mutación',async()=>{
 await open('ID,A\n001,\n');const before=Buffer.from(JSON.stringify(await engine.snapshot('a')))
 const invalid=[await edit('fillEmpty',[],{value:'0'}),await edit('fillEmpty',[0,1],{value:'0'}),await edit('fillEmpty',[2],{value:'0'}),await edit('fillEmpty',[0.5],{value:'0'}),await edit('deleteRowsWhere',[],{match:'all'}),await edit('deleteRowsWhere',[1],{match:'neither'}),await edit('fillEmpty',[1],{value:undefined}),await edit('fillEmpty',[1],{value:'0',includeSpaces:undefined})]
 for(const request of invalid){await expect(engine.transformPreview('a',request)).rejects.toThrow('[freya:EMPTY]');await expect(engine.edit('a',request)).rejects.toThrow('[freya:EMPTY]')}
 expect(Buffer.from(JSON.stringify(await engine.snapshot('a'))).equals(before)).toBe(true)
 expect(readEmptyError(new Error('Error invoking remote method: '+new EmptyError('changed').message))).toEqual({code:'changed'})
 for(const value of ['[freya:EMPTY] {"code":"exec"}','[freya:EMPTY] null','[freya:EMPTY] <script>','otro error'])expect(readEmptyError(value)).toBeUndefined()
})

it('rechaza revisiones antiguas y cambios externos incluso con una base léxica ya guardada',async()=>{
 const source='"ID",A\r\n"001",\r\n';const path=await open(source)
 const stale=await edit('fillEmpty',[1],{value:'0'});await engine.edit('a',{type:'cell',rowId:'1',column:0,value:'002'})
 const before=Buffer.from(JSON.stringify(await engine.snapshot('a')))
 await expect(engine.transformPreview('a',stale)).rejects.toThrow(new EmptyError('changed').message)
 expect(Buffer.from(JSON.stringify(await engine.snapshot('a'))).equals(before)).toBe(true)
 await engine.edit('a',await edit('fillEmpty',[1],{value:'0'}))
 const saved=await engine.serialize('a');await writeFile(path,saved);await engine.markSaved('a',(await engine.info('a')).revision,{path,hash:hash(saved)})
 await engine.edit('a',{type:'cell',rowId:'1',column:1,value:''})
 const request=await edit('fillEmpty',[1],{value:'1'}),current=Buffer.from(JSON.stringify(await engine.snapshot('a')))
 const external=Buffer.from('ID,A\r\nfuera,otro\r\n');await writeFile(path,external)
 await expect(engine.transformPreview('a',request)).rejects.toThrow(new EmptyError('disk').message)
 await expect(engine.edit('a',request)).rejects.toThrow(new EmptyError('disk').message)
 expect(Buffer.from(JSON.stringify(await engine.snapshot('a'))).equals(current)).toBe(true);expect((await readFile(path)).equals(external)).toBe(true)
})

// Windows: 5.387 ms × 2 = 10.774 ms; 12 s para recorrer 110.000 filas, no para responder a Cancelar.
const emptyFillCancellationBudget=12_000
for(const {mode,operation} of [
 {mode:'preview',operation:'fillEmpty'},
 {mode:'apply',operation:'fillEmpty'},
 {mode:'preview',operation:'fillPrevious'},
 {mode:'apply',operation:'fillPrevious'},
 {mode:'preview',operation:'deleteRowsWhere'},
 {mode:'apply',operation:'deleteRowsWhere'}
] as const)it(`cancela ${mode} de ${operation} después de cien mil filas, con progreso e historial intactos`,async()=>{
 const source='ID,A\n'+'001,\n'.repeat(110000);let events=0,visited=0,cancel=true
 engine=new TableEngine(event=>{expect(event.phase).toBe('empty.progress.preparing');events++;visited=Math.max(visited,event.rows);if(cancel&&event.rows>100000)void engine.cancelAnalysis('a',event.requestId)})
 const path=await open(source),before=Buffer.from(JSON.stringify(await engine.snapshot('a'))),request=await edit(operation,[1],operation==='fillEmpty'?{value:'00'}:operation==='deleteRowsWhere'?{match:'any'}:{})
 await expect(mode==='preview'?engine.transformPreview('a',request):engine.edit('a',request)).rejects.toThrow(new EmptyError('changed').message)
 expect(visited).toBeGreaterThan(100000);expect(events).toBeGreaterThan(190)
 expect(Buffer.from(JSON.stringify(await engine.snapshot('a'))).equals(before)).toBe(true)
 expect((await readFile(path)).toString()).toBe(source)
 cancel=false
},operation==='fillEmpty'?emptyFillCancellationBudget:undefined)

it('elimina más de cien mil filas en grupos y restaura con un solo deshacer, también desde recuperación',async()=>{
 const source='ID,A\n'+'001,\n'.repeat(55000)+'M,keep\n'+'002,\n'.repeat(55000),path=await open(source)
 const request=await edit('deleteRowsWhere',[1],{match:'any'}),preview=await engine.transformPreview('a',request)
 expect(preview).toMatchObject({rows:110001,deletedRows:110000,affected:110000});expect(preview.samples).toHaveLength(5)
 await engine.edit('a',request);expect(await cells()).toEqual([['M','keep']]);expect((await engine.serialize('a')).toString()).toBe('ID,A\nM,keep\n')
 const recovery=JSON.parse(JSON.stringify(await engine.snapshot('a')));expect(recovery.state.history).toHaveLength(1)
 await engine.restore('b',recovery);await engine.undo('b');expect((await engine.serialize('b')).equals(Buffer.from(source))).toBe(true)
 await engine.undo('a');expect((await engine.serialize('a')).equals(Buffer.from(source))).toBe(true)
 await engine.undo('a',true);expect(await cells()).toEqual([['M','keep']]);expect((await readFile(path)).toString()).toBe(source)
})

it('no aplica un plan si otra edición cambia la revisión mientras se prepara',async()=>{
 let concurrent=false
 engine=new TableEngine(event=>{if(!concurrent&&event.rows>512){concurrent=true;void engine.edit('a',{type:'cell',rowId:'1',column:0,value:'externo'})}})
 await open('ID,A\n'+'001,\n'.repeat(3000));const revision=(await engine.info('a')).revision
 await expect(engine.edit('a',await edit('fillEmpty',[1],{value:'0'}))).rejects.toThrow(new EmptyError('changed').message)
 const rows=await cells();expect(rows[0]).toEqual(['externo','']);expect(rows.slice(1).every(row=>row[1]==='')).toBe(true)
 expect((await engine.info('a')).revision).toBe(revision+1)
 await engine.undo('a');expect((await cells())[0]).toEqual(['001',''])
})

it('actúa por posición sobre columnas duplicadas, vacías y mayores de doscientas',async()=>{
 await open('ID,,A,A\n001,,,\n002,v,,\n')
 await engine.edit('a',await edit('fillEmpty',[3],{value:'00'}));expect((await cells())[0]).toEqual(['001','','','00'])
 await engine.undo('a');await engine.edit('a',await edit('deleteRowsWhere',[1,3],{match:'all'}));expect(await cells()).toEqual([['002','v','','']])
 const width=301;await open(Array.from({length:width},(_,i)=>'C'+i).join(',')+'\n001\n')
 await engine.edit('a',await edit('fillEmpty',[300],{value:'0'}));expect((await cells())[0]).toHaveLength(width);expect((await cells())[0][300]).toBe('0')
 await engine.undo('a');expect((await cells())[0]).toEqual(['001'])
})

it('rechaza valores, registros escapados, codificación e historial que no caben, antes de modificar',async()=>{
 await open('ID,A\n001,\n');let before=Buffer.from(JSON.stringify(await engine.snapshot('a')))
 for(const [value,code] of [['x'.repeat(TABLE_LIMITS.record+1),'value'],['"'.repeat(550000),'recordLimit']] as const){
  const request=await edit('fillEmpty',[1],{value});await expect(engine.transformPreview('a',request)).rejects.toThrow(new EmptyError(code).message);await expect(engine.edit('a',request)).rejects.toThrow(new EmptyError(code).message)
  expect(Buffer.from(JSON.stringify(await engine.snapshot('a'))).equals(before)).toBe(true)
 }
 await open('ID,A\n'+'001,\n'.repeat(24));before=Buffer.from(JSON.stringify(await engine.snapshot('a')))
 const large=await edit('fillEmpty',[1],{value:'x'.repeat(900000)});await expect(engine.transformPreview('a',large)).rejects.toThrow(new EmptyError('undoLimit').message)
 expect(Buffer.from(JSON.stringify(await engine.snapshot('a'))).equals(before)).toBe(true)
 const path=join(folder,'latin.csv');await writeFile(path,iconv.encode('ID,A\n001,\n','win1252'));await engine.open('a',path,{encoding:'win1252'})
 const request=await edit('fillEmpty',[1],{value:'漢'}),info=await engine.info('a')
 await expect(engine.edit('a',request)).rejects.toThrow(new EmptyError('encoding').message);expect(await engine.info('a')).toEqual(info)
})

it('no materializa campos si el resultado supera dos millones de celdas',async()=>{
 const width=4001,source=Array(width).fill('C').join(',')+'\n'+('001'+','.repeat(width-1)+'\n').repeat(498)+'last\n'
 const path=await open(source),info=await engine.info('a'),request=await edit('fillEmpty',[width-1],{value:'0'})
 expect(info.rowCount).toBe(499)
 await expect(engine.edit('a',request)).rejects.toThrow(new EmptyError('cellsLimit').message)
 expect(await engine.info('a')).toEqual(info);expect((await engine.page('a',{...query,offset:498,limit:1})).rows[0].cells).toEqual(['last'])
 expect((await readFile(path)).toString()).toBe(source)
})

it('rechaza el resultado mayor de 50 MiB aunque cada registro y el historial sí caben',async()=>{
 await open('ID,Nota,A\n001,x,\n')
 const recovery=await engine.snapshot('a'),note='x'.repeat(800000)
 recovery.state.rows=Array.from({length:64},(_,i)=>({id:String(i+1),cells:[String(i).padStart(5,'0'),note,'']}));recovery.state.nextId=65
 await engine.restore('a',recovery)
 const before=await engine.info('a'),request=await edit('fillEmpty',[2],{value:'y'.repeat(25000)})
 await expect(engine.transformPreview('a',request)).rejects.toThrow(new EmptyError('bytesLimit').message)
 const after=await engine.snapshot('a')
 expect(await engine.info('a')).toEqual(before);expect(after.state.history).toHaveLength(0)
 expect(after.state.rows).toHaveLength(64);expect(after.state.rows.every((row,i)=>row.id===String(i+1)&&row.cells.length===3&&row.cells[0]===String(i).padStart(5,'0')&&row.cells[1]===note&&row.cells[2]==='')).toBe(true)
})

it.each(['closed','large','sample'] as const)('mantiene código estable al rechazar el documento %s por ambas entradas',async(kind)=>{
 if(kind==='large')engine=new TableEngine(()=>{},{largeBytes:1})
 const source=kind==='sample'?'ID,A\n001,'+'x'.repeat(TABLE_LIMITS.record+1)+'\n':'ID,A\n001,\n',path=await open(source)
 const request=await edit('fillEmpty',[1],{value:'0'})
 if(kind==='closed')await engine.close('a');else expect((await engine.info('a')).readonly).toBe(true)
 const attempts=await Promise.allSettled([engine.transformPreview('a',request),engine.edit('a',request)])
 expect(attempts.map(result=>result.status==='rejected'?result.reason.message:null)).toEqual([new EmptyError('changed').message,new EmptyError('changed').message])
 expect((await readFile(path)).toString()).toBe(source)
})
