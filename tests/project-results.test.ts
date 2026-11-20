import {afterEach,beforeEach,describe,expect,it} from 'vitest'
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,readFile,rm,stat,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {ProjectStore} from '../src/main/projects'
import {projectFile,projectManifest,type ProjectResult,type ProjectRecipe} from '../src/shared/project'
import {t} from '../src/shared/i18n'

const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex')
const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)
const bytes=Buffer.from('ID,Edad,Nota\n00128,61\n00126,52,ok\n00123,34,"línea 1\nlínea 2"\n')
let root:string,folder:string,file:string,store:ProjectStore,id:string,recipe:ProjectRecipe,sourceSha:string
beforeEach(async()=>{
 root=await mkdtemp(join(tmpdir(),'freya-project-result-'));folder=join(root,'Censo');await mkdir(folder)
 const profile=join(root,'profile');await mkdir(profile);store=new ProjectStore(profile)
 id=(await store.create(folder,'Censo',true)).id;file=join(folder,projectFile)
 const original=await readFile(new URL('./fixtures/prj02-censo.csv',import.meta.url)),path=join(folder,'01_raw','censo.csv');await writeFile(path,original);sourceSha=sha(original)
 const mtimeMs=(await stat(path)).mtimeMs
 const columns=['ID','Entidad','Edad','Ingreso','Nota'].map((name,index)=>({position:index+1,name})),date=new Date().toISOString()
 await store.changeSources(store.active!,()=>[{id:'source',path:'01_raw/censo.csv',external:false,protection:'readonly',bytes:original.length,sha256:sourceSha,registeredAt:date,quick:{mtimeMs:mtimeMs,headSha256:sourceSha,tailSha256:sourceSha},format:{encoding:'utf8',bom:false,delimiter:',',header:true,eol:'\n',finalEol:true},schema:{sha256:sha(JSON.stringify(columns)),columns}}],async()=>true)
 await store.saveRecipe(id,{name:'Oaxaca, adultos',sourceId:'source',steps:[{op:'filter',mode:'all',conditions:[{column:columns[1],op:'equals',value:'Oaxaca',caseSensitive:true},{column:columns[2],op:'greaterEqual',value:'18',caseSensitive:true}]},{op:'order',by:[{column:columns[2],numeric:true,descending:true}]},{op:'select',columns:[columns[0],columns[2],columns[4]]}]},async()=>true)
 recipe=store.recipes[0]
})
afterEach(async()=>{await rm(root,{recursive:true,force:true})})
async function result(name='adultos.csv',resultId='result'):Promise<ProjectResult>{
 const path=join(folder,'02_datasets',name);await writeFile(path,bytes)
 const date=new Date().toISOString()
 return{id:resultId,kind:'extract',recipeId:recipe.id,path:'02_datasets/'+name,bytes:bytes.length,sha256:sha(bytes),mtimeMs:(await stat(path)).mtimeMs,createdAt:date,provenance:{sourceSha256:sourceSha,executedAt:date,engine:{app:'test',contract:'PRJ-03',semantics:1},coverage:{kind:'filtered',matched:3,scanned:7,total:7,complete:true},fidelity:{level:'values',normalization:[],irregularRows:1},warnings:[],chain:[recipe.id],recipeSha256:{[recipe.id]:sha(canonical(recipe))},snapshot:{sourceName:'censo.csv',columns:['ID','Edad','Nota'],recipes:[structuredClone(recipe)]}}}
}
async function manifest(){return JSON.parse(await readFile(file,'utf8'))}

describe('PRJ-03 · resultados duraderos y registro atómico',()=>{
 it('registra fecha e instantánea completa sin inventarlas al leer un resultado v1 antiguo',async()=>{
  const exported=await result(),current=await manifest()
  expect(projectManifest.safeParse({...current,results:[exported]}).success).toBe(true)
  const {mtimeMs:_,...legacy}=exported;delete legacy.provenance.snapshot
  const saved=JSON.stringify({...current,results:[legacy]});await writeFile(file,saved);await store.open(folder)
  expect(store.results[0]).not.toHaveProperty('mtimeMs');expect(store.results[0].provenance).not.toHaveProperty('snapshot')
  expect(await readFile(file,'utf8')).toBe(saved)
 })
 it('valida etapas de muestra, contadores seguros e instantáneas estrictas',async()=>{
  const exported=await result(),current=await manifest()
  const sample={...exported,provenance:{...exported.provenance,coverage:{kind:'sample',matched:2,scanned:7,total:7,complete:true,sampling:{method:'first',rows:2},samplingStages:[{step:3,method:'first',requestedRows:2,eligible:3,selected:2}]}}}
  expect(projectManifest.safeParse({...current,results:[sample]}).success).toBe(true)
  for(const stage of [{step:0,method:'random',requestedRows:3,seed:7,eligible:7,selected:3},{step:0,method:'random',percent:50,seed:-1,eligible:7,selected:2}])expect(projectManifest.safeParse({...current,results:[{...sample,provenance:{...sample.provenance,coverage:{...sample.provenance.coverage,samplingStages:[stage]}}}]}).success).toBe(true)
  for(const change of [{step:-1},{selected:4},{eligible:1},{requestedRows:0},{method:'random'},{seed:7},{percent:50},{selected:0.5},{eligible:Number.MAX_SAFE_INTEGER+1}]){
   const invalid={...sample,provenance:{...sample.provenance,coverage:{...sample.provenance.coverage,samplingStages:[{...sample.provenance.coverage.samplingStages[0],...change}]}}}
   expect(projectManifest.safeParse({...current,results:[invalid]}).success,JSON.stringify(change)).toBe(false)
  }
  for(const snapshot of [{sourceName:'censo.csv',columns:[]},{sourceName:'censo.csv',columns:[],recipes:[]},{...exported.provenance.snapshot,unknown:true}])expect(projectManifest.safeParse({...current,results:[{...exported,provenance:{...exported.provenance,snapshot}}]}).success).toBe(false)
  for(const recipes of [[{...recipe,id:'wrong'}],[recipe,recipe],[{...recipe,sourceId:undefined,baseRecipeId:'missing'}]])expect(projectManifest.safeParse({...current,results:[{...exported,provenance:{...exported.provenance,snapshot:{sourceName:'censo.csv',columns:[],recipes}}}]}).success).toBe(false)
  expect(projectManifest.safeParse({...current,results:[{...exported,mtimeMs:Infinity}]}).success).toBe(false)
 })
 it('agrega y quita procedencia, conserva el archivo y bloquea eliminar su conjunto',async()=>{
  const exported=await result();expect(await store.registerResult(id,exported,async()=>true)).toBe(true)
  expect(store.results).toEqual([exported]);expect((await manifest()).results).toEqual([exported])
  const before=await readFile(file)
  await expect(store.removeRecipe(id,recipe.id,async()=>true)).rejects.toThrow(t('project.recipe.error.results',{n:1}))
  expect(await readFile(file)).toEqual(before)
  expect(await store.forgetResult(id,exported.id,async()=>true)).toBe(true)
  expect(store.results).toEqual([]);expect(await readFile(join(folder,exported.path))).toEqual(bytes)
  expect(await store.removeRecipe(id,recipe.id,async()=>true)).toBe(true)
 })
 it('serializa dos registros concurrentes sin perder ninguno',async()=>{
  const a=await result('uno.csv','one'),b=await result('dos.csv','two')
  expect(await Promise.all([store.registerResult(id,a,async()=>true),store.registerResult(id,b,async()=>true)])).toEqual([true,true])
  expect(store.results).toEqual([a,b]);expect((await manifest()).results).toEqual([a,b])
 })
 it('rechaza id, ruta duplicados o receta inexistente sin cambiar datos',async()=>{
  const exported=await result();await store.registerResult(id,exported,async()=>true);const before=await readFile(file)
  for(const invalid of [{...exported,path:'02_datasets/otro.csv'},{...exported,id:'otra'},{...exported,id:'otra',path:'02_datasets/otro.csv',recipeId:'missing'},{...exported,id:'otra',path:'../fuera.csv'}])await expect(store.registerResult(id,invalid,async()=>true)).rejects.toThrow()
  expect(await readFile(file)).toEqual(before);expect(await readFile(join(folder,exported.path))).toEqual(bytes)
 })
 it('conserva archivo y manifiesto ante conflicto cancelado y cambio durante confirmación',async()=>{
  const exported=await result(),external={...await manifest(),name:'Externo'},before=JSON.stringify(external);await writeFile(file,before)
  expect(await store.registerResult(id,exported,async()=>false)).toBe(false);expect(await readFile(file,'utf8')).toBe(before)
  const second={...external,name:'Segundo'};await writeFile(file,JSON.stringify(second));const during=JSON.stringify({...second,name:'Durante'})
  await expect(store.registerResult(id,exported,async()=>{await writeFile(file,during);return true})).rejects.toThrow()
  expect(await readFile(file,'utf8')).toBe(during);expect(await readFile(join(folder,exported.path))).toEqual(bytes)
 })
 it('mantiene los nombres y pasos históricos tras editar la receta con el mismo id',async()=>{
  const exported=await result();await store.registerResult(id,exported,async()=>true)
  await store.saveRecipe(id,{id:recipe.id,name:'Otro nombre',sourceId:'source',steps:[]},async()=>true)
  expect(store.recipes[0].steps).toEqual([]);expect(store.results[0].provenance.snapshot).toEqual(exported.provenance.snapshot)
 })
 it('rechaza ids de resultado duplicados importados aunque sus rutas sean distintas',async()=>{
  const a=await result('uno.csv','duplicated'),b=await result('dos.csv','duplicated')
  const imported=JSON.stringify({...await manifest(),results:[a,b]});await writeFile(file,imported)
  await expect(store.open(folder)).rejects.toThrow()
  expect(projectManifest.safeParse(JSON.parse(imported)).success).toBe(false)
  expect(await readFile(file,'utf8')).toBe(imported)
 })
 it('rechaza registrar o quitar en proyecto futuro antes de confirmar o escribir',async()=>{
  const exported=await result(),future=JSON.stringify({...await manifest(),version:2,unknown:'conservar'});await writeFile(file,future);await store.open(folder)
  let asked=false
  for(const action of [()=>store.registerResult(id,exported,async()=>{asked=true;return true}),()=>store.forgetResult(id,'result',async()=>{asked=true;return true})])await expect(action()).rejects.toThrow()
  expect(asked).toBe(false);expect(await readFile(file,'utf8')).toBe(future);expect(await readFile(join(folder,exported.path))).toEqual(bytes)
 })
})
