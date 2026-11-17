import {describe,expect,it,vi} from 'vitest'
import {ProjectSubsets} from '../src/main/project-subsets'
import type {ProjectStore} from '../src/main/projects'
import type {ProjectSourceRegistry} from '../src/main/project-source-registry'
import type {RecipeOperationResult} from '../src/shared/recipe-operation'
import type {ProjectRecipe} from '../src/shared/project'

const result:RecipeOperationResult={headers:['ID'],columns:[{position:1,name:'ID'}],rows:[['00123']],scanned:1,eligible:1,resultCount:1,complete:true,cancelled:false,bytesRead:10,sampling:[],sha256:'a'.repeat(64)}
function setup(){
 const source={id:'source',sha256:'a'.repeat(64)}
 const project={id:'project',path:'/approved',readonly:false}
 const store={active:project,recipes:[],resolveRecipe:()=>({source,chain:[],steps:[],columns:result.columns})} as unknown as ProjectStore
 const registry={recipeSource:vi.fn(async()=>({path:'/approved/raw.csv',sha256:source.sha256})),markRecipeChanged:vi.fn()} as unknown as ProjectSourceRegistry
 const call=vi.fn(async()=>result)
 return{service:new ProjectSubsets(store,registry,{call}),store,registry,call}
}
const draft={name:'Adultos',sourceId:'source',steps:[]}
describe('PRJ-02a · coordinador de lectura sin permisos de escritura',()=>{
 it('autoriza por proyecto/fuente y envía al motor solo la ruta aprobada',async()=>{
  const {service,registry,call}=setup()
  await expect(service.try('project',draft,'request')).resolves.toMatchObject({rows:[['00123']],sourceVersionDifferent:false})
  expect(registry.recipeSource).toHaveBeenCalledWith('project','source')
  expect(call).toHaveBeenCalledWith('recipePreview','request',expect.objectContaining({path:'/approved/raw.csv'}),[])
 })
 it('rechaza otro proyecto antes de acceder al archivo',async()=>{
  const {service,registry}=setup()
  await expect(service.try('otro',draft,'request')).rejects.toThrow()
  expect(registry.recipeSource).not.toHaveBeenCalled()
 })
 it('descarta resultados si se cierra el proyecto durante la lectura',async()=>{
  const {service,store,call}=setup()
  call.mockImplementationOnce(async()=>{Object.defineProperty(store,'active',{value:null});return result})
  await expect(service.try('project',draft,'request')).rejects.toThrow()
 })
 it('propaga cancelación solo para la solicitud que sigue en curso',async()=>{
  const {service,call}=setup()
  let finish!:(r:RecipeOperationResult)=>void
  call.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  const pending=service.try('project',draft,'request')
  await vi.waitFor(()=>expect(call).toHaveBeenCalledOnce())
  await service.cancel('ajena');expect(call).toHaveBeenCalledOnce()
  await service.cancel('request');expect(call).toHaveBeenLastCalledWith('recipeCancel','request')
  finish({...result,cancelled:true,rows:[]});await pending
 })
 it('un fallo de identidad pasa la fuente a cambiado aunque coincida su comprobación rápida',async()=>{
  const {service,registry,call}=setup()
  call.mockRejectedValueOnce(Object.assign(new Error('changed'),{code:'changed'}))
  await expect(service.try('project',draft,'request')).rejects.toThrow()
  expect(registry.markRecipeChanged).toHaveBeenCalledWith('source')
 })
 it('no usa un id de edición inexistente como conjunto nuevo',async()=>{
  const {service,call}=setup()
  await expect(service.try('project',{...draft,id:'inexistente'},'request')).rejects.toThrow()
  expect(call).not.toHaveBeenCalled()
 })
 it('no degrada a v1 un conjunto guardado con semántica desconocida',async()=>{
  const {service,store,call}=setup()
  store.recipes.push({...draft,id:'futuro',semantics:2,createdAt:'2026-11-16T00:00:00Z',sourceSha256:'a'.repeat(64)} as ProjectRecipe)
  await expect(service.try('project',{...draft,id:'futuro'},'request')).rejects.toThrow()
  expect(call).not.toHaveBeenCalled()
 })
 it('la excepción futura solo prueba definiciones v1 guardadas sin cambiar sus pasos',async()=>{
  const {service,store,call}=setup()
  store.active!.readonly=true
  store.recipes.push({...draft,id:'conocido',semantics:1,createdAt:'2026-11-16T00:00:00Z',sourceSha256:'a'.repeat(64)} as ProjectRecipe)
  await expect(service.try('project',draft,'nuevo')).rejects.toThrow()
  await expect(service.try('project',{...draft,id:'conocido',steps:[{op:'sample',method:'first',rows:1}]},'modificado')).rejects.toThrow()
  expect(call).not.toHaveBeenCalled()
  await expect(service.try('project',{...draft,id:'conocido'},'igual')).resolves.toMatchObject({rows:[['00123']]})
 })
 it('descarta un resultado completo que estaba en tránsito cuando se canceló',async()=>{
  const {service,call}=setup()
  let finish!:(r:RecipeOperationResult)=>void
  call.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  const pending=service.try('project',draft,'request')
  await vi.waitFor(()=>expect(call).toHaveBeenCalledOnce())
  await service.cancel('request');finish(result)
  const cancelled=await pending
  expect(cancelled).toMatchObject({cancelled:true,complete:false,rows:[],resultCount:0})
  expect(cancelled).not.toHaveProperty('sha256')
 })
 it('no acepta un resultado tras reabrir el mismo id y ruta en otra sesión',async()=>{
  const {service,store,call}=setup()
  call.mockImplementationOnce(async()=>{Object.defineProperty(store,'active',{value:{...store.active!}});return result})
  await expect(service.try('project',draft,'request')).rejects.toThrow()
 })
 it('un fallo viejo no marca una fuente del proyecto que se abrió después',async()=>{
  const {service,store,registry,call}=setup()
  call.mockImplementationOnce(async()=>{Object.defineProperty(store,'active',{value:{...store.active!,path:'/otro'}});throw Object.assign(new Error('changed'),{code:'changed'})})
  await expect(service.try('project',draft,'request')).rejects.toThrow()
  expect(registry.markRecipeChanged).not.toHaveBeenCalled()
 })
})
