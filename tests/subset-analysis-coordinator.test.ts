import {describe,expect,it,vi} from 'vitest'
import {ProjectSubsets} from '../src/main/project-subsets'
import {ANALYSIS_LIMITS} from '../src/main/analysis-source'
import type {ProjectStore} from '../src/main/projects'
import type {ProjectSourceRegistry} from '../src/main/project-source-registry'
import type {Documents} from '../src/main/documents'
import type {ProjectRecipe} from '../src/shared/project'

const coverage={headers:['ID'],columns:[{position:1,name:'ID'}],scanned:7,eligible:3,resultCount:3,complete:true,cancelled:false,bytesRead:200,sha256:'a'.repeat(64),sampling:[]}
function setup(){
 const source={id:'source',path:'censo.csv',bytes:200,schema:{columns:coverage.columns},sha256:'a'.repeat(64)}
 const recipe:ProjectRecipe={id:'recipe',name:'Adultos',sourceId:'source',sourceSha256:source.sha256,semantics:1,createdAt:'2026-11-16T00:00:00Z',steps:[]}
 const project={id:'project',path:'/approved',readonly:false}
 const store={active:project,recipes:[recipe],resolveRecipe:vi.fn(()=>({source,chain:structuredClone([recipe]),steps:structuredClone(recipe.steps),columns:coverage.columns}))} as unknown as ProjectStore
 const descriptor={path:'/approved/censo.csv',bytes:200,schema:{columns:coverage.columns},sha256:source.sha256}
 const registry={recipeSource:vi.fn(async()=>descriptor),markRecipeChanged:vi.fn()} as unknown as ProjectSourceRegistry
 const call=vi.fn(async(method:string,..._args:unknown[])=>method==='recipeAnalysis'?{coverage,previewRows:[['00123']]}:undefined)
 const docs={installSubset:vi.fn(async(id:string,context:unknown)=>({id,name:'Adultos',path:null,kind:'csv',readonly:true,dirty:false,analysisSubset:context})),close:vi.fn(async()=>true)} as unknown as Pick<Documents,'installSubset'|'close'>
 return{service:new ProjectSubsets(store,registry,{call},docs),store,source,recipe,registry,descriptor,call,docs}
}
describe('PRJ-02b · prepara solo conjuntos guardados y publica de forma atómica',()=>{
 it.each([true,false])('acepta SHA hexadecimal en mayúsculas sin avisar de versión distinta (conjunto uppercase=%s)',async upperRecipe=>{
  const{service,source,descriptor,recipe,docs}=setup()
  source.sha256=descriptor.sha256='A'.repeat(64);recipe.sourceSha256=(upperRecipe?'A':'a').repeat(64)
  const before=JSON.stringify({source,recipe}),info=await service.analyze('project','recipe','request')
  expect(info).toMatchObject({readonly:true,path:null})
  expect(vi.mocked(docs.installSubset).mock.calls[0][1].coverage.sourceVersionDifferent).not.toBe(true)
  expect(JSON.stringify({source,recipe})).toBe(before)
 })
 it('un hash lógicamente distinto mantiene el aviso de versión distinta',async()=>{
  const{service,recipe,docs}=setup();recipe.sourceSha256='B'.repeat(64)
  await service.analyze('project','recipe','request')
  expect(vi.mocked(docs.installSubset).mock.calls[0][1].coverage.sourceVersionDifferent).toBe(true)
 })
 it('Probar tampoco llama distinta a la misma huella con otro uso de mayúsculas',async()=>{
  const{service,source,descriptor,call}=setup();source.sha256=descriptor.sha256='A'.repeat(64)
  call.mockResolvedValueOnce({...coverage,rows:[['00123']]} as never)
  await expect(service.try('project',{id:'recipe',name:'Adultos',sourceId:'source',steps:[]},'request')).resolves.toMatchObject({sourceVersionDifferent:false})
 })
 it('analiza solo conjuntos v1 reconocidos de proyectos futuros sin escribir el proyecto',async()=>{
  const{service,store,registry,call}=setup()
  Object.defineProperty(store,'active',{value:{...store.active!,readonly:true}})
  const before=JSON.stringify(store.active)
  await expect(service.analyze('project','recipe','request')).resolves.toMatchObject({readonly:true,path:null})
  expect(registry.recipeSource).toHaveBeenCalled();expect(call).toHaveBeenCalled()
  expect(JSON.stringify(store.active)).toBe(before)
 })
 it('reutiliza autorización, manda ids internos al worker y solo publica metadata',async()=>{
  const{service,registry,call,docs}=setup(),info=await service.analyze('project','recipe','request')
  expect(registry.recipeSource).toHaveBeenCalledWith('project','source')
  expect(call).toHaveBeenCalledWith('recipeAnalysis','request',expect.any(String),expect.objectContaining({path:'/approved/censo.csv'}),[])
  expect(docs.installSubset).toHaveBeenCalledWith(info.id,expect.objectContaining({projectId:'project',recipeId:'recipe',sourceId:'source',name:'Adultos',sourceName:'censo.csv',coverage}))
  expect(info).not.toHaveProperty('rows');expect(call).not.toHaveBeenCalledWith('open',expect.anything(),expect.anything())
 })
 it('otro proyecto o conjunto inexistente no abre ninguna fuente',async()=>{
  const{service,registry,call}=setup()
  await expect(service.analyze('otro','recipe','request')).rejects.toThrow();await expect(service.analyze('project','otro','request')).rejects.toThrow()
  expect(registry.recipeSource).not.toHaveBeenCalled();expect(call).not.toHaveBeenCalled()
 })
 it('la semántica futura no se degrada; v1 en proyecto futuro sigue solo lectura',async()=>{
  const{service,store,recipe,call,docs}=setup();store.active!.readonly=true;recipe.semantics=2
  await expect(service.analyze('project','recipe','bad')).rejects.toThrow();expect(call).not.toHaveBeenCalled()
  recipe.semantics=1;await service.analyze('project','recipe','ok');expect(docs.installSubset).toHaveBeenCalledOnce()
 })
 it.each(['bytes','columns'] as const)('bloquea el límite raíz conocido de %s antes de ejecutar',async kind=>{
  const{service,descriptor,call}=setup()
  if(kind==='bytes')descriptor.bytes=ANALYSIS_LIMITS.bytes+1
  else descriptor.schema.columns=Array.from({length:ANALYSIS_LIMITS.columns+1},(_,n)=>({position:n+1,name:String(n)}))
  await expect(service.analyze('project','recipe','request')).rejects.toThrow();expect(call).not.toHaveBeenCalled()
 })
 it('una entrada parcial o cancelada no se publica y se libera su id worker',async()=>{
  for(const partial of [{complete:false},{cancelled:true}]){
   const{service,call,docs}=setup();call.mockResolvedValueOnce({coverage:{...coverage,...partial},previewRows:[]})
   await expect(service.analyze('project','recipe','request')).rejects.toThrow();expect(docs.installSubset).not.toHaveBeenCalled();expect(call).toHaveBeenLastCalledWith('close',expect.any(String))
  }
 })
 it('cambiar de sesión de proyecto mientras se prepara descarta y libera',async()=>{
  const{service,store,call,docs}=setup();call.mockImplementationOnce(async()=>{Object.defineProperty(store,'active',{value:{...store.active!}});return{coverage,previewRows:[]}})
  await expect(service.analyze('project','recipe','request')).rejects.toThrow();expect(docs.installSubset).not.toHaveBeenCalled();expect(call).toHaveBeenLastCalledWith('close',expect.any(String))
 })
 it('una definición cambiada durante el worker no se presenta con nombre o pasos antiguos',async()=>{
  const{service,recipe,call,docs}=setup();call.mockImplementationOnce(async()=>{recipe.steps=[{op:'sample',method:'first',rows:1}];return{coverage,previewRows:[]}})
  await expect(service.analyze('project','recipe','request')).rejects.toThrow();expect(docs.installSubset).not.toHaveBeenCalled()
 })
 it('revalida la comprobación rápida tras el resultado antes de publicar',async()=>{
  const{service,registry,docs,descriptor}=setup();vi.mocked(registry.recipeSource).mockResolvedValueOnce(descriptor as never).mockRejectedValueOnce(new Error('not authorized'))
  await expect(service.analyze('project','recipe','request')).rejects.toThrow();expect(docs.installSubset).not.toHaveBeenCalled()
 })
 it('una definición cambiada durante la comprobación rápida final tampoco se publica',async()=>{
  const{service,registry,docs,recipe,descriptor}=setup()
  vi.mocked(registry.recipeSource).mockResolvedValueOnce(descriptor as never).mockImplementationOnce(async()=>{recipe.steps=[{op:'sample',method:'first',rows:1}];return descriptor as never})
  await expect(service.analyze('project','recipe','request')).rejects.toThrow();expect(docs.installSubset).not.toHaveBeenCalled()
 })
 it('una definición cambiada durante la instalación cierra el registro analítico',async()=>{
  const{service,docs,recipe}=setup()
  vi.mocked(docs.installSubset).mockImplementationOnce(async id=>{recipe.steps=[{op:'sample',method:'first',rows:1}];return{id} as never})
  await expect(service.analyze('project','recipe','request')).rejects.toThrow();expect(docs.close).toHaveBeenCalledOnce()
 })
 it('cancelar una respuesta completa en tránsito no deja un documento analítico',async()=>{
  const{service,call,docs}=setup();let finish!:(value:{coverage:typeof coverage;previewRows:string[][]})=>void
  call.mockImplementationOnce(()=>new Promise<{coverage:typeof coverage;previewRows:string[][]}>(resolve=>{finish=resolve}))
  const pending=service.analyze('project','recipe','request');await vi.waitFor(()=>expect(call).toHaveBeenCalled())
  await service.cancel('request');finish({coverage,previewRows:[]});await expect(pending).rejects.toThrow()
  expect(docs.installSubset).not.toHaveBeenCalled();expect(call).toHaveBeenLastCalledWith('close',expect.any(String))
 })
 it('cancelar durante la publicación cierra el registro recién creado',async()=>{
  const{service,docs}=setup();let finish!:(value:unknown)=>void
  vi.mocked(docs.installSubset).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve as (value:unknown)=>void}))
  const pending=service.analyze('project','recipe','request');await vi.waitFor(()=>expect(docs.installSubset).toHaveBeenCalled())
  await service.cancel('request');finish({id:'published'});await expect(pending).rejects.toThrow();expect(docs.close).toHaveBeenCalledWith('published')
 })
 it('un error de identidad solo marca la fuente del proyecto que sigue activo',async()=>{
  const{service,registry,call}=setup();call.mockRejectedValueOnce(Object.assign(new Error('changed'),{code:'changed'}))
  await expect(service.analyze('project','recipe','request')).rejects.toThrow();expect(registry.markRecipeChanged).toHaveBeenCalledWith('source')
 })
})
