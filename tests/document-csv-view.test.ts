import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {mkdtemp,open,readFile,realpath,rm,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const state=vi.hoisted(()=>({folder:'',calls:[] as string[]}))
vi.mock('electron',()=>({app:{getPath:()=>state.folder},dialog:{},BrowserWindow:{getFocusedWindow:()=>undefined,getAllWindows:()=>[]}}))
vi.mock('chokidar',()=>({watch:()=>{const watcher={on:()=>watcher,close:async()=>{}};return watcher}}))
vi.mock('../src/main/table-client',async()=>{const {TableEngine}=await import('../src/main/table-engine');return{TableClient:class{engine=new TableEngine();async call(method:string,...args:unknown[]){state.calls.push(method);if(method==='checkpoint')return JSON.stringify({version:1,info:args[1],savedAt:new Date().toISOString(),snapshot:await this.engine.snapshot(String(args[0]))});return(this.engine as unknown as Record<string,(...values:unknown[])=>unknown>)[method](...args)}stop(){}}}})
import {Documents} from '../src/main/documents'
import {isTextEditLimitError,visibleEditError} from '../src/shared/text-edit-error'
let docs:Documents,path:string
const source='ID,Nombre\n"001","Ana"\n9007199254740993,"dos\nlíneas"\n'
beforeEach(async()=>{state.folder=await realpath(await mkdtemp(join(tmpdir(),'freya-csv-text-')));path=join(state.folder,'datos.csv');await writeFile(path,source);state.calls=[];docs=new Documents(()=>{})})
afterEach(async()=>{await docs.shutdown();await rm(state.folder,{recursive:true,force:true})})
it('abre CSV como Texto con el mismo contenido y sin crear el motor de tabla',async()=>{
 const doc=await docs.open(path,'text');expect(doc.kind).toBe('csv');expect(doc.csvView).toBe('text');expect(doc.text).toBe(source);expect(doc.byteLength).toBe(Buffer.byteLength(source));expect(state.calls).not.toContain('open');expect(docs.records.size).toBe(1);expect(await readFile(path,'utf8')).toBe(source)
})
it('una ruta abierta cambia de representación sin crear otro documento ni escribir el archivo',async()=>{
 const table=await docs.open(path);expect(table.csvView).toBe('table');const text=await docs.open(path,'text');expect(text.id).toBe(table.id);expect(text.csvView).toBe('text');expect(text.text).toBe(source);expect(text.headers).toBeUndefined();expect(state.calls).toContain('close')
 const back=await docs.setCsvView(table.id,'table');expect(back.id).toBe(table.id);expect(back.csvView).toBe('table');expect(back.rowCount).toBe(2);expect(back.text).toBeUndefined();const page=await docs.table.call('page',back.id,{offset:0,limit:10,requestId:1});expect(page.revision).toBe(back.revision);expect(docs.records.size).toBe(1);expect(await readFile(path,'utf8')).toBe(source)
})
it('la apertura normal usa el modo elegido después de reiniciar Documents',async()=>{
 await docs.open(path,'text');await docs.shutdown();docs=new Documents(()=>{});expect((await docs.open(path)).csvView).toBe('text');expect(docs.records.size).toBe(1)
})
it('una tabla con cambios nunca se descarta sin decisión explícita',async()=>{
 const table=await docs.open(path);await docs.tableEdit(table.id,{type:'cell',rowId:'1',column:1,value:'Pendiente'});await expect(docs.setCsvView(table.id,'text')).rejects.toThrow(/cambios pendientes/i);expect(docs.info(table.id).csvView).toBe('table');expect(docs.info(table.id).dirty).toBe(true);expect(await readFile(path,'utf8')).toBe(source)
})
it('un cambio a Tabla que no puede interpretar el CSV conserva el documento textual abierto',async()=>{
 const raw='ID,Nombre\n1,"sin cerrar\n';await writeFile(path,raw);const text=await docs.open(path,'text');await expect(docs.setCsvView(text.id,'table')).rejects.toThrow(/CSV no válido/i);expect(docs.info(text.id).csvView).toBe('text');expect(docs.info(text.id).text).toBe(raw);expect(docs.records.size).toBe(1);expect(await readFile(path,'utf8')).toBe(raw)
})
it('Texto rechaza más de 10 MiB antes de cargar contenido y el modo recordado vuelve a Tabla',async()=>{
 const doc=await docs.open(path,'text');await docs.close(doc.id);const handle=await open(path,'r+');try{await handle.truncate(10*1024*1024+1)}finally{await handle.close()}
 await expect(docs.open(path,'text')).rejects.toThrow('El modo Texto admite hasta 10 MiB');expect(docs.records.size).toBe(0);state.calls=[];const table=await docs.open(path);expect(table.csvView).toBe('table');expect(state.calls).toContain('open')
})

it('Texto rechaza operaciones e interpretación de tabla sin crear un segundo modelo',async()=>{
 const doc=await docs.open(path,'text');state.calls=[];await expect(docs.tableOptions(doc.id,{header:false})).rejects.toThrow('Disponible en modo Tabla');await expect(docs.tableEdit(doc.id,{type:'cell',rowId:'1',column:0,value:'otro'})).rejects.toThrow('Disponible en modo Tabla');expect(state.calls).not.toContain('open');expect(docs.info(doc.id).text).toBe(source)
})

it('aperturas concurrentes en modos distintos terminan en un único documento completo',async()=>{
 const [first,second]=await Promise.all([docs.open(path,'table'),docs.open(path,'text')]);expect(first.id).toBe(second.id);expect(docs.records.size).toBe(1);expect(docs.info(first.id)).toMatchObject({csvView:'text',text:source});expect(await readFile(path,'utf8')).toBe(source)
})
it('si falla recordar la nueva vista conserva la representación anterior utilizable',async()=>{
 const {CsvViewStore}=await import('../src/main/csv-view-store'),table=await docs.open(path),failure=vi.spyOn(CsvViewStore.prototype,'remember').mockRejectedValueOnce(new Error('Preferencia no disponible'))
 try{await expect(docs.setCsvView(table.id,'text')).rejects.toThrow('Preferencia no disponible');expect(docs.info(table.id).csvView).toBe('table');expect((await docs.table.call('page',table.id,{offset:0,limit:10,requestId:1})).rows).toHaveLength(2);expect(docs.records.size).toBe(1);expect(await readFile(path,'utf8')).toBe(source)}finally{failure.mockRestore()}
})

it.each(['utf8','utf16le','win1252'] as const)('Texto conserva codificación, BOM y terminadores al guardar (%s)',async encoding=>{
 const iconv=(await import('iconv-lite')).default,raw='ID,Nombre\r\n"001","á\nñ"\r9007199254740993,conservar\n',bom=encoding==='utf16le'?Buffer.from([0xff,0xfe]):encoding==='utf8'?Buffer.from([0xef,0xbb,0xbf]):Buffer.alloc(0),bytes=Buffer.concat([bom,iconv.encode(raw,encoding)])
 await writeFile(path,bytes);const doc=await docs.open(path,'text');expect(doc.text).toBe(raw);expect(doc.encoding).toBe(encoding);expect(doc.readonly).toBe(false)
 await docs.save(doc.id);expect(await readFile(path)).toEqual(bytes);await docs.update(doc.id,raw.replace('conservar','editado'));await docs.save(doc.id);expect(await readFile(path)).toEqual(Buffer.concat([bom,iconv.encode(raw.replace('conservar','editado'),encoding)]))
})
it('Texto abre una codificación con sustitución en solo lectura y no toca el original',async()=>{
 const bytes=Buffer.from([0x49,0x44,0x0a,0x81,0x0a]);await writeFile(path,bytes);const doc=await docs.open(path,'text');expect(doc.readonly).toBe(true);expect(doc.warning).toMatch(/solo lectura/i);await expect(docs.save(doc.id)).rejects.toThrow(/solo lectura/i);expect(await readFile(path)).toEqual(bytes)
})
it('Texto rechaza guardar un carácter fuera de Windows-1252 sin escribir',async()=>{
 const iconv=(await import('iconv-lite')).default,raw='ID,Nombre\r\n1,ñ\r\n',bytes=iconv.encode(raw,'win1252');await writeFile(path,bytes);const doc=await docs.open(path,'text');await docs.update(doc.id,raw+'2,😀\r\n');await expect(docs.save(doc.id)).rejects.toThrow(/línea 3/);expect(docs.info(doc.id).dirty).toBe(true);expect(await readFile(path)).toEqual(bytes)
})

it('C: Guardar y cambiar conserva los bytes de Texto antes de abrir Tabla',async()=>{
 const raw='ID,Nombre\r\n00123,Ana\r\n',bytes=Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(raw)]);await writeFile(path,bytes);const doc=await docs.open(path,'text');await docs.update(doc.id,raw.replace('Ana','Editada'));const switched=await docs.setCsvView(doc.id,'table','save');expect(switched).toMatchObject({id:doc.id,csvView:'table',dirty:false});expect(await readFile(path)).toEqual(Buffer.concat([bytes.subarray(0,3),Buffer.from(raw.replace('Ana','Editada'))]));expect((await docs.table.call('page',doc.id,{offset:0,limit:10,requestId:1})).rows[0].cells).toEqual(['00123','Editada'])
})
it('C: Descartar y cambiar relee el original sin guardar el texto pendiente',async()=>{
 const doc=await docs.open(path,'text');await docs.update(doc.id,source.replace('Ana','No guardar'));const switched=await docs.setCsvView(doc.id,'table','discard');expect(switched).toMatchObject({id:doc.id,csvView:'table',dirty:false});expect(await readFile(path,'utf8')).toBe(source);expect(docs.records.size).toBe(1)
})
it('C: un guardado fallido conserva el modo Texto y permite seguir editando',async()=>{
 const iconv=(await import('iconv-lite')).default,raw='ID,Nombre\n1,ñ\n',bytes=iconv.encode(raw,'win1252');await writeFile(path,bytes);const doc=await docs.open(path,'text');await docs.update(doc.id,raw+'2,😀\n');await expect(docs.setCsvView(doc.id,'table','save')).rejects.toThrow(/línea 3/);expect(docs.info(doc.id)).toMatchObject({csvView:'text',dirty:true,text:raw+'2,😀\n'});expect(await readFile(path)).toEqual(bytes);await expect(docs.update(doc.id,raw+'2,otra\n')).resolves.toMatchObject({csvView:'text',dirty:true})
})
it('C: un conflicto de guardado nunca cambia de modo ni sobrescribe la edición externa',async()=>{
 const doc=await docs.open(path,'text');await docs.update(doc.id,source.replace('Ana','Local'));await writeFile(path,source.replace('Ana','Externa'));await expect(docs.setCsvView(doc.id,'table','save')).rejects.toThrow(/cambió/i);expect(docs.info(doc.id)).toMatchObject({csvView:'text',dirty:true,text:source.replace('Ana','Local')});expect(await readFile(path,'utf8')).toBe(source.replace('Ana','Externa'))
})
it('C: si Tabla no puede abrir el disco, Descartar conserva el texto pendiente',async()=>{
 const bad='ID,Nombre\n1,"sin cerrar\n';await writeFile(path,bad);const doc=await docs.open(path,'text'),corrected=bad+'"\n';await docs.update(doc.id,corrected);await expect(docs.setCsvView(doc.id,'table','discard')).rejects.toThrow(/CSV no válido/i);expect(docs.info(doc.id)).toMatchObject({csvView:'text',dirty:true,text:corrected});expect(await readFile(path,'utf8')).toBe(bad)
})
it('C: cambiar se ejecuta después de la edición ya pendiente',async()=>{
 const doc=await docs.open(path,'text'),edited=source.replace('Ana','Última');const update=docs.update(doc.id,edited),change=docs.setCsvView(doc.id,'table','save');await update;await change;expect(await readFile(path,'utf8')).toBe(edited);expect(docs.info(doc.id)).toMatchObject({csvView:'table',dirty:false})
})
it('C: recuperación Texto conserva codificación y BOM y se guarda como copia',async()=>{
 const iconv=(await import('iconv-lite')).default,raw='ID,Nombre\r\n00123,"á\nñ"\r9007199254740993,conservar\n',bom=Buffer.from([0xff,0xfe]),bytes=Buffer.concat([bom,iconv.encode(raw,'utf16le')]);await writeFile(path,bytes);const doc=await docs.open(path,'text'),edited=raw.replace('conservar','recuperado');await docs.update(doc.id,edited);await docs.checkpoint(doc.id);await docs.shutdown();docs=new Documents(()=>{});const recovered=await docs.recover(doc.id);expect(recovered).toMatchObject({kind:'csv',csvView:'text',encoding:'utf16le',path:null,dirty:true,text:edited});expect(state.calls.filter(call=>call==='restore')).toHaveLength(0);const copy=join(state.folder,'recuperado.csv');vi.stubEnv('FREYALAB_TEST','1');vi.stubEnv('FREYALAB_TEST_SAVE_PATH',copy);try{await docs.save(recovered.id);expect(await readFile(copy)).toEqual(Buffer.concat([bom,iconv.encode(edited,'utf16le')]));expect(await readFile(path)).toEqual(bytes)}finally{vi.unstubAllEnvs()}
})
it('C: cambiar de modo reinicia el historial de la representación anterior',async()=>{
 const doc=await docs.open(path,'text');await docs.update(doc.id,source.replace('Ana','Editada'));await docs.setCsvView(doc.id,'table','save');await docs.setCsvView(doc.id,'text');expect((await docs.undo(doc.id)).text).toBe(source.replace('Ana','Editada'));expect(docs.info(doc.id).dirty).toBe(false)
})
it('C: Descartar y cambiar no deja recuperaciones obsoletas del mismo documento',async()=>{
 const doc=await docs.open(path,'text');await docs.update(doc.id,source.replace('Ana','Pendiente'));await docs.checkpoint(doc.id);expect(await docs.listRecoveries()).toHaveLength(1);await docs.setCsvView(doc.id,'table','discard');expect(await docs.listRecoveries()).toHaveLength(0)
})
it.each(['utf16le','win1252'] as const)('C: Recargar conserva la nueva codificación y los bytes externos (%s)',async encoding=>{
 const iconv=(await import('iconv-lite')).default,raw='ID,Nombre\r\n1,ñ\r\n',bom=encoding==='utf16le'?Buffer.from([0xff,0xfe]):Buffer.alloc(0);await writeFile(path,Buffer.concat([bom,iconv.encode(raw,encoding)]));const doc=await docs.open(path,'text'),external=raw.replace('ñ','á'),bytes=Buffer.concat([bom,iconv.encode(external,encoding)]);await writeFile(path,bytes);expect(await docs.reload(doc.id)).toMatchObject({csvView:'text',text:external,encoding,dirty:false});await docs.save(doc.id);expect(await readFile(path)).toEqual(bytes)
})
it('C: una recuperación con formato desconocido se conserva sin crear otro documento',async()=>{
 const doc=await docs.open(path,'text');await docs.update(doc.id,source+'3,otro\n');await docs.checkpoint(doc.id);const recovery=join(state.folder,'recovery',`${doc.id}.json`),data=JSON.parse(await readFile(recovery,'utf8'));data.snapshot.format={encoding:'desconocido',bom:true};await writeFile(recovery,JSON.stringify(data));await expect(docs.recover(doc.id)).rejects.toThrow(/no compatible/);expect(docs.records.size).toBe(1);expect(JSON.parse(await readFile(recovery,'utf8')).snapshot.format.encoding).toBe('desconocido')
})
it('C: cambiar de vista conserva una copia de recuperación de versión futura',async()=>{
 const doc=await docs.open(path,'text');await docs.update(doc.id,source.replace('Ana','Pendiente'));await docs.checkpoint(doc.id);const recovery=join(state.folder,'recovery',`${doc.id}.json`),data=JSON.parse(await readFile(recovery,'utf8'));data.version=99;await writeFile(recovery,JSON.stringify(data));await docs.setCsvView(doc.id,'table','discard');expect(JSON.parse(await readFile(recovery,'utf8')).version).toBe(99);expect(docs.info(doc.id).csvView).toBe('table')
})

it.each([
 {raw:'ID,Nombre\n1,"abc\n2,fin\n',line:3},
 {raw:'ID,Nombre\n1,5" de largo\n',line:2},
 {raw:'ID,Nombre\n1,"abc"def\n',line:2}
])('D: un CSV mal formado conserva el error real y permite la salida a Texto ($line)',async({raw,line})=>{
 await docs.shutdown();const events:import('../src/shared/types').AppEvent[]=[];docs=new Documents(event=>events.push(event));const previous=join(state.folder,'previo.txt');await writeFile(previous,'Documento previo intacto');const before=await docs.open(previous);await writeFile(path,raw);const failure=await docs.open(path).then(()=>null,error=>error as Error);expect(failure?.message).toMatch(/CSV no válido/);expect(events).toHaveLength(1);expect(events[0]).toMatchObject({type:'csv-open-error',csvOpenError:{path,name:'datos.csv',message:failure!.message,reportedLine:line,byteLength:Buffer.byteLength(raw),textAllowed:true}});expect(docs.records.size).toBe(1);expect(docs.info(before.id).text).toBe('Documento previo intacto');expect(await readFile(path,'utf8')).toBe(raw)
})
it('C: Guardar una Tabla y cambiar a Texto usa su serializador real',async()=>{
 const doc=await docs.open(path,'table');await docs.tableEdit(doc.id,{type:'cell',rowId:'1',column:1,value:'Desde tabla'});const expected=await docs.table.call<Buffer>('serialize',doc.id);const changed=await docs.setCsvView(doc.id,'text','save');expect(changed).toMatchObject({id:doc.id,csvView:'text',dirty:false,text:expected.toString('utf8')});expect(await readFile(path)).toEqual(expected);expect(changed.text).toContain('001,Desde tabla');expect(changed.text).toContain('9007199254740993');expect(docs.records.size).toBe(1)
})

it.each(['utf16le','win1252'] as const)('X9/X13: permite editar y guardar menos de 10 MiB reales en %s aunque UTF-8 sea mayor',async encoding=>{
 const iconv=(await import('iconv-lite')).default,raw='ID,Nombre\n00123,'+(encoding==='utf16le'?'中'.repeat(4*1024*1024):'é'.repeat(6*1024*1024))+'\n',prefix=encoding==='utf16le'?Buffer.from([0xff,0xfe]):Buffer.alloc(0),bytes=Buffer.concat([prefix,iconv.encode(raw,encoding)]);expect(bytes.length).toBeLessThan(10*1024*1024);expect(Buffer.byteLength(raw)).toBeGreaterThan(10*1024*1024);await writeFile(path,bytes);const doc=await docs.open(path,'text');expect(doc).toMatchObject({encoding,readonly:false,csvView:'text'});const edited=raw.replace('00123','00124');await docs.update(doc.id,edited);await docs.save(doc.id);expect((await readFile(path)).equals(Buffer.concat([prefix,iconv.encode(edited,encoding)]))).toBe(true)
})

it.each(['utf8','utf16le'] as const)('X13: cuenta el BOM en el límite exacto de 10 MiB de %s',async encoding=>{
 const prefix=encoding==='utf8'?Buffer.from([0xef,0xbb,0xbf]):Buffer.from([0xff,0xfe]),bytes=Buffer.concat([prefix,Buffer.from('ID,Nombre\n1,Ana\n',encoding)]);await writeFile(path,bytes);const doc=await docs.open(path,'text'),exact='x'.repeat((10*1024*1024-prefix.length)/(encoding==='utf16le'?2:1));await docs.update(doc.id,exact);const before=docs.info(doc.id),rejected=docs.update(doc.id,exact+'x');await expect(rejected).rejects.toThrow(/10 MiB/);const failure=await rejected.catch(error=>error);expect(isTextEditLimitError(failure)).toBe(true);expect(visibleEditError(failure.message)).toBe('El documento supera el límite de edición de 10 MiB.');expect(docs.info(doc.id)).toEqual(before);expect(docs.info(doc.id).text).toBe(exact);expect(await readFile(path)).toEqual(bytes)
})
