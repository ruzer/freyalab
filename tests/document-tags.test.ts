import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {mkdtemp,realpath,rm,writeFile,mkdir,symlink,readFile} from 'node:fs/promises'
import {join,basename} from 'node:path'
import {tmpdir} from 'node:os'
const io=vi.hoisted(()=>({folder:'',opens:[] as string[],reads:[] as {path:string;length:number}[],closed:0,active:0,maxActive:0,chunk:0,fail:new Set<string>(),onRead:undefined as undefined|((path:string)=>Promise<void>)}))
vi.mock('electron',()=>({app:{getPath:()=>io.folder},dialog:{},BrowserWindow:{getFocusedWindow:()=>undefined,getAllWindows:()=>[]}}))
vi.mock('chokidar',()=>({watch:()=>{const watcher={on:()=>watcher,close:async()=>{}};return watcher}}))
vi.mock('../src/main/table-client',()=>({TableClient:class{stop(){};async call(){}}}))
vi.mock('node:fs/promises',async importOriginal=>{
 const actual=await importOriginal<typeof import('node:fs/promises')>()
 return{...actual,open:async(path:Parameters<typeof actual.open>[0],flags:Parameters<typeof actual.open>[1],mode?:Parameters<typeof actual.open>[2])=>{
  const name=String(path);io.opens.push(name)
  if(io.fail.has(name))throw Object.assign(new Error('Sin permiso'),{code:'EACCES'})
  const handle=await actual.open(path,flags,mode);let closed=false
  return new Proxy(handle,{get(target,key){
   if(key==='read')return async(buffer:Buffer,offset:number,length:number,position:number)=>{
    io.reads.push({path:name,length});io.maxActive=Math.max(io.maxActive,++io.active)
    try{await io.onRead?.(name);return await target.read(buffer,offset,io.chunk?Math.min(length,io.chunk):length,position)}finally{io.active--}
   }
   if(key==='close')return async()=>{if(!closed){closed=true;io.closed++};return target.close()}
   const member=Reflect.get(target,key,target);return typeof member==='function'?member.bind(target):member
  }})
 }}
})
import {Documents} from '../src/main/documents'
import {tokensFileQuery,tagQueryToken} from '../src/shared/tag-query'
let docs:Documents,root:string,outside:string
const releases:(()=>void)[]=[]
const header=(tags='[proyecto]')=>`---\ntags: ${tags}\n---\n# Contenido\n`
async function file(name:string,content:string|Buffer=header()){const path=join(root,name);await mkdir(join(path,'..'),{recursive:true});await writeFile(path,content);return path}
function gate(){let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve});releases.push(release);return{pending,release}}
beforeEach(async()=>{
 vi.stubEnv('FREYALAB_TEST','0');io.folder=await realpath(await mkdtemp(join(tmpdir(),'freya-tags-')));root=join(io.folder,'root');outside=join(io.folder,'outside');await mkdir(root);await mkdir(outside)
 Object.assign(io,{opens:[],reads:[],closed:0,active:0,maxActive:0,chunk:0,fail:new Set<string>(),onRead:undefined})
 docs=new Documents(()=>{});docs.roots.add(root)
})
afterEach(async()=>{for(const release of releases.splice(0))release();vi.restoreAllMocks();await docs.shutdown();await rm(io.folder,{recursive:true,force:true});vi.unstubAllEnvs()})
const names=(result:{entries:{name:string}[]})=>result.entries.map(entry=>entry.name)

describe('FL-MD-009 C · búsqueda por etiquetas',()=>{
 it('mantiene la consulta completa por nombre, incluidos espacios y comillas, sin leer contenido',async()=>{
  await file('informe final.md');await file('final informe.md');await file('informe "final".txt','texto')
  expect(names(await docs.findFiles(root,'informe final'))).toEqual(['informe final.md'])
  expect(names(await docs.findFiles(root,'informe "final"'))).toEqual(['informe "final".txt'])
  expect(io.opens).toEqual([])
 })
 it('el # aislado sigue siendo búsqueda por nombre',async()=>{await file('#nota.md');expect(names(await docs.findFiles(root,'#'))).toEqual(['#nota.md']);expect(io.opens).toEqual([])})
 it('lee las tres formas de tags y solo documentos Markdown',async()=>{
  await file('a.md',header('[proyecto]'));await file('b.markdown',header('proyecto'));await file('c.MD',header('\n - proyecto'));await file('d.txt');await file('e.csv');await file('f.mmd')
  expect(names(await docs.findFiles(root,'#proyecto'))).toEqual(['a.md','b.markdown','c.MD']);expect(io.opens.every(path=>/\.(md|markdown)$/i.test(path))).toBe(true)
 })
 it('combina etiquetas exactas sin acentos ni mayúsculas y términos de nombre con Y',async()=>{
  await file('informe final.md',header('[Próyecto, 2026]'));await file('informe otra.md',header('[proyecto]'));await file('resumen.md',header('[proyecto, 2026]'))
  expect(names(await docs.findFiles(root,'informe #PROYECTO #2026'))).toEqual(['informe final.md'])
  expect(names(await docs.findFiles(root,'#proy'))).toEqual([])
 })
 it('acepta etiquetas con espacios, comas, comillas, barras y texto que parece una expresión regular',async()=>{
  await file('informe.md',header('["informe final", "a, b", \'a"b\\c\', ../dato, a.*]'))
  for(const query of ['#"informe final"','#"a, b"','#"a\\"b\\\\c"','#../dato','#a.*'])expect(names(await docs.findFiles(root,query)),query).toEqual(['informe.md'])
  expect(names(await docs.findFiles(root,'#aZZ'))).toEqual([])
 })
 it('omite etiquetas anidadas, encabezados sin cierre y sintaxis no entendida',async()=>{
  await file('valido.md',header('[a]'));await file('anidado.md','---\nmeta:\n  tags: [a]\n---');await file('abierto.md','---\ntags: [a]');await file('objeto.md',header('{a: b}'))
  expect(names(await docs.findFiles(root,'#a'))).toEqual(['valido.md'])
 })
 it('respeta BOM, CRLF y cierre ... sin alterar los bytes de disco',async()=>{
  const source='\ufeff---\r\ntags: [Árbol, 2026]\r\n...\r\n# Contenido\r\n',path=await file('original.md',source),before=await readFile(path)
  expect(names(await docs.findFiles(root,'#arbol #2026'))).toEqual(['original.md']);expect(await readFile(path)).toEqual(before);expect(docs.records.size).toBe(0)
 })
 it('no lee archivos ocultos ni node_modules',async()=>{
  await file('visible.md');await file('.oculto.md');await file('.privado/nota.md');await file('node_modules/nota.md')
  expect(names(await docs.findFiles(root,'#proyecto'))).toEqual(['visible.md']);expect(io.opens.map(path=>basename(path))).toEqual(['visible.md'])
 })
 it.skipIf(process.platform==='win32')('no sigue enlaces simbólicos de archivos o carpetas',async()=>{
  await writeFile(join(outside,'secreto.md'),header());await symlink(join(outside,'secreto.md'),join(root,'enlace.md'));await symlink(outside,join(root,'enlace-carpeta'),'dir');await file('visible.md')
  expect(names(await docs.findFiles(root,'#proyecto'))).toEqual(['visible.md']);expect(io.opens).not.toContain(join(outside,'secreto.md'))
 })
 it('rechaza una raíz no autorizada sin abrir archivos',async()=>{await expect(docs.findFiles(outside,'#proyecto')).rejects.toThrow('no autorizada');expect(io.opens).toEqual([])})
 it('revalida autorización y contención de cada archivo aunque el árbol entregue una ruta ajena',async()=>{
  const path=join(outside,'secreto.md');await writeFile(path,header());vi.spyOn(docs,'tree').mockResolvedValue([{name:'secreto.md',path,directory:false}])
  expect(names(await docs.findFiles(root,'#proyecto'))).toEqual([]);expect(io.opens).toEqual([])
 })
 it('lee como máximo 16 KiB y exige el cierre del encabezado dentro del prefijo',async()=>{
  await file('corto.md',header('[a]')+'x'.repeat(20000));await file('largo.md','---\ntags: [a]\ntitle: '+'x'.repeat(16384)+'\n---\n')
  expect(names(await docs.findFiles(root,'#a'))).toEqual(['corto.md']);expect(io.reads.every(read=>read.length<=16384)).toBe(true)
  for(const path of io.opens)expect(io.reads.filter(read=>read.path===path).reduce((sum,read)=>sum+read.length,0)).toBeLessThanOrEqual(16384)
 })
 it('no confunde un carácter UTF-8 cortado por el límite con un archivo corrupto',async()=>{
  const start=Buffer.from(header('[a]')),prefix=Buffer.concat([start,Buffer.alloc(16383-start.length,120),Buffer.from('🐶 más texto')]);await file('corte.md',prefix)
  expect(names(await docs.findFiles(root,'#a'))).toEqual(['corte.md'])
 })
 it.each([Buffer.from([0xc3]),Buffer.from([0xff]),Buffer.from([0xe2,0x28,0xa1])])('omite UTF-8 inválido o incompleto al EOF: %j',async bad=>{
  await file('corrupto.md',Buffer.concat([Buffer.from(header('[a]')),bad]));await file('valido.md',header('[a]'))
  expect(names(await docs.findFiles(root,'#a'))).toEqual(['valido.md']);expect(io.closed).toBe(io.opens.length)
 })
 it('completa lecturas cortas sin salir del prefijo ni corromper UTF-8',async()=>{
  io.chunk=3;await file('corto.md',header('[árbol]'));expect(names(await docs.findFiles(root,'#arbol'))).toEqual(['corto.md']);expect(io.closed).toBe(1)
 })
 it('omite archivos borrados o ilegibles y continúa el recorrido',async()=>{
  const failed=await file('ilegible.md'),valid=await file('valido.md');io.fail.add(failed)
  vi.spyOn(docs,'tree').mockResolvedValue([{name:'borrado.md',path:join(root,'borrado.md'),directory:false},{name:'ilegible.md',path:failed,directory:false},{name:'valido.md',path:valid,directory:false}])
  expect(names(await docs.findFiles(root,'#proyecto'))).toEqual(['valido.md'])
 })
 it('limita los resultados a 200 y marca la vista parcial',async()=>{
  const path=await file('modelo.md');vi.spyOn(docs,'tree').mockResolvedValue(Array.from({length:201},(_,index)=>({name:`nota${index}.md`,path,directory:false})))
  const result=await docs.findFiles(root,'#proyecto');expect(result.entries).toHaveLength(200);expect(result.limited).toBe(true)
 })
 it('no visita más de 1.000 directorios y conserva el aviso de límite',async()=>{
  const tree=vi.spyOn(docs,'tree').mockResolvedValue([{name:'siguiente',path:root,directory:true}])
  expect(await docs.findFiles(root,'#a')).toEqual({entries:[],limited:true});expect(tree).toHaveBeenCalledTimes(1000)
 })
 it('no lee más de 5.000 archivos Markdown',async()=>{
  const path=await file('modelo.md',header('[otra]'));vi.spyOn(docs,'tree').mockResolvedValue(Array.from({length:5001},(_,index)=>({name:`nota${index}.md`,path,directory:false})))
  expect(await docs.findFiles(root,'#ausente')).toEqual({entries:[],limited:true});expect(io.opens).toHaveLength(5000);expect(io.closed).toBe(5000)
 },20000)
 it('limita a ocho las lecturas simultáneas y cancelFileSearch cierra los handles sin iniciar el siguiente lote',async()=>{
  for(let index=0;index<20;index++)await file(`${index}.md`)
  const held=gate();io.onRead=()=>held.pending
  const task=docs.findFiles(root,'#proyecto'),rejected=task.then(()=>'',error=>(error as Error).message)
  await vi.waitFor(()=>expect(io.active).toBe(8));docs.cancelFileSearch();held.release();expect(await rejected).toContain('cancelada')
  expect(io.maxActive).toBe(8);expect(io.opens).toHaveLength(8);expect(io.closed).toBe(8)
 })
 it('una búsqueda nueva cancela una lectura anterior sin cancelarse a sí misma',async()=>{
  await file('a.md');await file('b.md');const held=gate();io.onRead=()=>held.pending
  const task=docs.findFiles(root,'#proyecto'),rejected=task.then(()=>'',error=>(error as Error).message);await vi.waitFor(()=>expect(io.active).toBe(2))
  const next=docs.findFiles(root,'a.md');held.release();expect(await rejected).toContain('cancelada');expect(names(await next)).toEqual(['a.md'])
 })
 it('cancelar mientras espera el árbol impide abrir los archivos que llegaron tarde',async()=>{
  const path=await file('nota.md'),held=gate();let reached=false
  vi.spyOn(docs,'tree').mockImplementation(async()=>{reached=true;await held.pending;return[{name:'nota.md',path,directory:false}]})
  const task=docs.findFiles(root,'#proyecto'),rejected=task.then(()=>'',error=>(error as Error).message);await vi.waitFor(()=>expect(reached).toBe(true));docs.cancelFileSearch();held.release();expect(await rejected).toContain('cancelada');expect(io.opens).toEqual([])
 })
})

 describe('FL-MD-009 C · consulta compartida',()=>{
 it.each(['proyecto','informe final','a"b\\c','🐶','proyecto/2026','#doble'])('hace ida y vuelta de %j sin tratarlo como ruta o expresión regular',tag=>{
  const token=tagQueryToken(tag);expect(tokensFileQuery(token)).toEqual([{value:tag,tag:true,from:0,to:token.length}])
 })
 it('conserva los rangos originales para añadir o quitar etiquetas sin reconstruir el texto de nombre',()=>{
  const source='informe  #"a b" #x # ultimo',tokens=tokensFileQuery(source)
  expect(tokens.map(token=>[source.slice(token.from,token.to),token.tag,token.value])).toEqual([['informe',false,'informe'],['#"a b"',true,'a b'],['#x',true,'x'],['#',false,'#'],['ultimo',false,'ultimo']])
 })
 it('no convierte una comilla abierta o una cadena vacía en etiqueta válida',()=>{
  expect(tokensFileQuery('#"sin cerrar #""').filter(token=>token.tag)).toEqual([])
 })
})
