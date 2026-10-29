import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {mkdtemp,readFile,readdir,realpath,rm,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
const fault=vi.hoisted(()=>({path:'',fail:false}))
vi.mock('../src/main/files',async original=>{const actual=await original<typeof import('../src/main/files')>();return{...actual,atomicWrite:async(path:string,data:Uint8Array|string,expected?:string)=>{if(fault.fail&&path===fault.path)throw new Error('Disco de preferencias no disponible');return actual.atomicWrite(path,data,expected)}}})
import {CsvViewStore} from '../src/main/csv-view-store'
let folder:string,file:string,settings:string
beforeEach(async()=>{folder=await realpath(await mkdtemp(join(tmpdir(),'freya-csv-view-')));file=join(folder,'datos.csv');settings=join(folder,'csv-views.json');await writeFile(file,'ID,Nombre\n001,Ana\n');fault.path=settings;fault.fail=false})
afterEach(async()=>{fault.fail=false;await rm(folder,{recursive:true,force:true})})
it('ausente o ruta que ya no existe usa Tabla sin crear preferencias',async()=>{
 const store=new CsvViewStore(settings);expect(await store.get(file)).toBe('table');expect(await store.get(join(folder,'ya-no-existe.csv'))).toBe('table');expect(await readdir(folder)).toEqual(['datos.csv'])
})
it('recuerda la ruta canónica y sólo ruta/modo, nunca el contenido',async()=>{
 const store=new CsvViewStore(settings);await store.remember(file,'text');const saved=JSON.parse(await readFile(settings,'utf8'))
 expect(saved).toEqual({version:1,entries:[{path:await realpath(file),view:'text'}]});expect(JSON.stringify(saved)).not.toContain('Ana');expect(await new CsvViewStore(settings).get(file)).toBe('text');expect(await readFile(file,'utf8')).toBe('ID,Nombre\n001,Ana\n')
})
it('JSON o esquema dañado equivale a Tabla',async()=>{
 for(const bytes of ['{roto',JSON.stringify({version:9,entries:[]}),JSON.stringify({version:1,entries:[{path:file,view:'otro'}]})]){await writeFile(settings,bytes);expect(await new CsvViewStore(settings).get(file)).toBe('table')}
})
it('descarta la entrada más antigua al superar 500 y actualiza la antigüedad al elegir',async()=>{
 const entries=Array.from({length:500},(_,i)=>({path:i===0?file:join(folder,`dato-${i}.csv`),view:'text'}));await writeFile(settings,JSON.stringify({version:1,entries}));const added=join(folder,'nuevo.tsv');await writeFile(added,'ID\n1\n');const store=new CsvViewStore(settings)
 await store.remember(file,'table');await store.remember(added,'text');const saved=JSON.parse(await readFile(settings,'utf8'));expect(saved.entries).toHaveLength(500);expect(saved.entries.some((entry:{path:string})=>entry.path===entries[1].path)).toBe(false);expect(saved.entries.slice(-2)).toEqual([{path:file,view:'table'},{path:added,view:'text'}])
})
it('la preferencia Texto de más de 10 MiB vuelve a Tabla y exactamente 10 MiB sigue permitida',async()=>{
 const {open}=await import('node:fs/promises'),handle=await open(file,'r+');try{await handle.truncate(10*1024*1024);await new CsvViewStore(settings).remember(file,'text');expect(await new CsvViewStore(settings).get(file)).toBe('text');await handle.truncate(10*1024*1024+1);expect(await new CsvViewStore(settings).get(file)).toBe('table')}finally{await handle.close()}
})
it('dos elecciones concurrentes no pierden entradas y una escritura fallida conserva la anterior',async()=>{
 const second=join(folder,'otro.tsv');await writeFile(second,'ID\n2\n');const store=new CsvViewStore(settings);await Promise.all([store.remember(file,'text'),store.remember(second,'text')]);const before=await readFile(settings,'utf8');expect(JSON.parse(before).entries).toHaveLength(2)
 fault.fail=true;await expect(store.remember(file,'table')).rejects.toThrow('Disco de preferencias');expect(await readFile(settings,'utf8')).toBe(before);expect(await store.get(file)).toBe('text');expect((await readdir(folder)).filter(name=>name.endsWith('.tmp'))).toEqual([])
 fault.fail=false;await store.remember(file,'table');expect(await new CsvViewStore(settings).get(file)).toBe('table')
})
