import {it,expect,afterEach,vi} from 'vitest'
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import * as files from '../src/main/files'
import {ChartPresets} from '../src/main/chart-presets'
import {chartView,matchingChartHeaders,ambiguousChartHeaders,type ChartConfiguration} from '../src/shared/chart-presets'
const folders:string[]=[]
afterEach(async()=>{for(const folder of folders.splice(0))await rm(folder,{recursive:true,force:true})})
async function fixture(){const folder=await mkdtemp(join(tmpdir(),'freya-presets-'));folders.push(folder);const path=join(folder,'profile','chart-presets.json');return{path,library:new ChartPresets(path)}}
const configuration:ChartConfiguration={headers:['Grupo','ID','Total','Fecha'],options:{kind:'bar',x:0,y:2,bins:10,aggregate:'sum',descending:true,measureType:'number',series:1,time:'none'},where:{conditions:[{column:1,op:'equals',value:'000123'}],filterMode:'any'},view:{search:'ñ',filters:{0:'A'},conditions:[{column:3,op:'dateOn',value:'2026-10-22'}],filterMode:'all'}}
it('persiste nombres, posiciones, texto exacto y filtros en una biblioteca separada, incluso entre instancias',async()=>{
 const {path,library}=await fixture();expect(await library.list()).toEqual([])
 const saved=await library.save({name:' Ventas por grupo ',configuration},configuration.headers);expect(saved.name).toBe('Ventas por grupo');expect(saved.configuration).toEqual(configuration)
 expect(await new ChartPresets(path).list()).toEqual([saved]);expect((await stat(path)).mode&0o777).toBe(process.platform==='win32'?0o666:0o600)
 await expect(library.save({name:saved.name,configuration},configuration.headers)).rejects.toThrow('nombre ya existe');expect(await library.list()).toEqual([saved])
 await library.delete(saved.id);expect(await new ChartPresets(path).list()).toEqual([]);await expect(library.delete(saved.id)).rejects.toThrow('ya no existe')
})
it('serializa cambios concurrentes y no pierde configuraciones ni deja la cola bloqueada tras errores',async()=>{
 const {library}=await fixture();const results=await Promise.all(Array.from({length:8},(_,i)=>library.save({name:String(i),configuration},configuration.headers)));expect(await library.list()).toEqual(results)
 await expect(library.save({name:'0',configuration},configuration.headers)).rejects.toThrow();const added=await library.save({name:'Otra',configuration},configuration.headers);expect((await library.list()).at(-1)).toEqual(added)
})
it('rechaza sintaxis inválida, referencias fuera de rango, operaciones incompatibles y claves no permitidas',async()=>{
 const {library}=await fixture()
 for(const change of [
  {...configuration,headers:['Renombrada',...configuration.headers.slice(1)]},
  {...configuration,options:{...configuration.options,measureType:'text'}},
  {...configuration,options:{...configuration.options,y:199}},
  {...configuration,options:{...configuration.options,sql:'SELECT 1'}},
  {...configuration,where:{conditions:[{column:20,op:'equals',value:'x'}],filterMode:'all'}},
  {...configuration,where:{conditions:[{column:0,op:'regex',value:'('}],filterMode:'all'}},
  {...configuration,view:{filters:{'01':'x'}}},
  {...configuration,view:{filters:{'4':'x'}}},
  {...configuration,view:{search:'x',offset:1}},
  {...configuration,view:{conditions:[{column:3,op:'dateOn',value:'2026-02-30'}]}},
 ])await expect(library.save({name:'No válida',configuration:change},configuration.headers)).rejects.toThrow()
 expect(await library.list()).toEqual([])
})
it('preserva bibliotecas dañadas, versiones futuras y tamaños excesivos sin sobrescribirlas',async()=>{
 const {path,library}=await fixture();await library.save({name:'Inicial',configuration},configuration.headers)
 for(const data of ['{broken',JSON.stringify({version:2,presets:[]}),JSON.stringify({version:1,presets:[{name:'Sin datos'}]}),' '.repeat(8*1024*1024+1)]){
  await writeFile(path,data);await expect(library.list()).rejects.toThrow();await expect(library.save({name:'No sobrescribir',configuration},configuration.headers)).rejects.toThrow();expect(await readFile(path,'utf8')).toBe(data)
 }
})
it('limita la biblioteca y preserva encabezados repetidos sin remapear columnas',async()=>{
 const {library}=await fixture();for(let i=0;i<50;i++)await library.save({name:String(i),configuration},configuration.headers)
 await expect(library.save({name:'51',configuration},configuration.headers)).rejects.toThrow('50 configuraciones');expect(await library.list()).toHaveLength(50)
 expect(matchingChartHeaders(['A','A'],['A','A'])).toBe(true);expect(ambiguousChartHeaders(['A','A'])).toBe(true);expect(ambiguousChartHeaders(['A',' '])).toBe(true);expect(ambiguousChartHeaders(['A','B'])).toBe(false)
 expect(matchingChartHeaders(['A','B'],['B','A'])).toBe(false);expect(matchingChartHeaders(['A','B'],['A'])).toBe(false)
})
it('captura solo filtros de tabla: ni página ni orden, y conserva una copia independiente',()=>{
 const query={offset:500,limit:100,requestId:5,order:[{column:0,numeric:false,descending:true}],...structuredClone(configuration.view!)}
 const view=chartView(query);query.filters![0]='Changed';expect(view).toEqual(configuration.view);expect(view).not.toHaveProperty('order');expect(view).not.toHaveProperty('offset')
})

it('un guardado fallido conserva las configuraciones previas y permite volver a intentar',async()=>{
 const {path,library}=await fixture();const saved=await library.save({name:'Original',configuration},configuration.headers),before=await readFile(path,'utf8')
 const write=vi.spyOn(files,'atomicWrite').mockRejectedValueOnce(new Error('Disco lleno'))
 try{await expect(library.save({name:'Fallida',configuration},configuration.headers)).rejects.toThrow('Disco lleno');expect(await readFile(path,'utf8')).toBe(before);expect(await library.list()).toEqual([saved])}finally{write.mockRestore()}
 await library.save({name:'Reintento',configuration},configuration.headers);expect(await library.list()).toHaveLength(2)
})
