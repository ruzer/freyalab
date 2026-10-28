import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {mkdtemp,open,readFile,realpath,rm,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const state=vi.hoisted(()=>({folder:'',calls:[] as string[]}))
vi.mock('electron',()=>({app:{getPath:()=>state.folder},dialog:{},BrowserWindow:{getFocusedWindow:()=>undefined,getAllWindows:()=>[]}}))
vi.mock('chokidar',()=>({watch:()=>{const watcher={on:()=>watcher,close:async()=>{}};return watcher}}))
vi.mock('../src/main/table-client',async()=>{const {TableEngine}=await import('../src/main/table-engine');return{TableClient:class{engine=new TableEngine();async call(method:string,...args:unknown[]){state.calls.push(method);if(method==='checkpoint')return JSON.stringify({version:1,info:args[1],savedAt:new Date().toISOString(),snapshot:await this.engine.snapshot(String(args[0]))});return(this.engine as unknown as Record<string,(...values:unknown[])=>unknown>)[method](...args)}stop(){}}}})
import {Documents} from '../src/main/documents'
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
