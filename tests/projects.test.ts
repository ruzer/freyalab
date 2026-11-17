import {afterEach,beforeEach,describe,expect,it} from 'vitest'
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {ProjectStore} from '../src/main/projects'
import {projectFile,type ProjectSource} from '../src/shared/project'
import {t} from '../src/shared/i18n'
const sha='1'.repeat(64),date='2026-11-16T00:00:00.000Z'
const source:ProjectSource={id:'source',path:'censo.csv',external:false,protection:'readonly',bytes:211,sha256:sha,registeredAt:date,quick:{mtimeMs:0,headSha256:sha,tailSha256:sha},format:{encoding:'utf8',bom:false,delimiter:',',header:true,eol:'\n',finalEol:true},schema:{sha256:sha,columns:[{position:1,name:'ID'},{position:2,name:'Edad'}]}}
let root:string,folder:string,file:string,store:ProjectStore,id:string
beforeEach(async()=>{
 root=await mkdtemp(join(tmpdir(),'freya-subsets-'));folder=join(root,'Proyecto');const profile=join(root,'profile');await mkdir(profile)
 store=new ProjectStore(profile);id=(await store.create(folder,'Proyecto',false)).id;file=join(folder,projectFile)
 await store.changeSources(store.active!,()=>[source],async()=>true)
})
afterEach(async()=>{await rm(root,{recursive:true,force:true})})
describe('PRJ-02a · persistencia pública de conjuntos',()=>{
 it('no ejecuta un esquema físico inseguro ni cambia los bytes de un proyecto actual o futuro',async()=>{
  const current=JSON.parse(await readFile(file,'utf8'))
  current.sources[0].schema.columns=[{position:1_000_000_000,name:'ID'}]
  const invalid=JSON.stringify(current);await writeFile(file,invalid)
  await expect(store.open(folder)).rejects.toThrow()
  expect(await readFile(file,'utf8')).toBe(invalid)
  const future=JSON.stringify({...current,version:2,recipes:[{id:'known',name:'Reconocido',sourceId:'source',sourceSha256:sha,semantics:1,steps:[],createdAt:date}]})
  await writeFile(file,future);await store.open(folder)
  expect(store.active).toMatchObject({readonly:true,sourceCount:0})
  expect(store.recipeViews()).toMatchObject([{id:'known',rootSourceId:'',executable:false}])
  expect(await readFile(file,'utf8')).toBe(future)
 })
 it('crea y edita sin aceptar identidad del renderer ni cambiar id o fecha de creación',async()=>{
  expect(await store.saveRecipe(id,{name:'  Adultos  ',sourceId:'source',steps:[]},async()=>true)).toBe(true)
  const first=store.recipes[0]
  expect(first).toMatchObject({name:'Adultos',sourceId:'source',sourceSha256:sha,semantics:1,steps:[]})
  expect(first.id).not.toBe('source');expect(Number.isFinite(Date.parse(first.createdAt))).toBe(true)
  const old=JSON.parse(await readFile(file,'utf8'));old.recipes[0].createdAt='2020-01-01T00:00:00.000Z';await writeFile(file,JSON.stringify(old));await store.open(folder)
  expect(await store.saveRecipe(id,{id:first.id,name:'Mayores',sourceId:'source',steps:[{op:'sample',method:'first',rows:2}]},async()=>true)).toBe(true)
  expect(store.recipes).toEqual([{...first,name:'Mayores',steps:[{op:'sample',method:'first',rows:2}],createdAt:'2020-01-01T00:00:00.000Z'}])
  expect(JSON.parse(await readFile(file,'utf8')).recipes).toEqual(store.recipes)
  expect(store.sources).toEqual([source])
 })
 it('renombra con nombre único sin distinguir mayúsculas y elimina solo hojas',async()=>{
  await store.saveRecipe(id,{name:'Adultos',sourceId:'source',steps:[]},async()=>true);const base=store.recipes[0]
  await store.saveRecipe(id,{name:'Dos mayores',baseRecipeId:base.id,steps:[{op:'sample',method:'first',rows:2}]},async()=>true);const child=store.recipes[1]
  const before=await readFile(file)
  await expect(store.renameRecipe(id,child.id,'ADULTOS',async()=>true)).rejects.toThrow()
  await expect(store.removeRecipe(id,base.id,async()=>true)).rejects.toThrow()
  expect((await readFile(file)).equals(before)).toBe(true)
  expect(await store.renameRecipe(id,child.id,'Dos personas',async()=>true)).toBe(true)
  expect(store.recipes[1]).toEqual({...child,name:'Dos personas'})
  expect(await store.removeRecipe(id,child.id,async()=>true)).toBe(true)
  expect(store.recipes).toEqual([base]);expect(store.sources).toEqual([source])
 })
 it('rechaza quitar la fuente con un motivo de conjunto antes de cambiar el manifiesto',async()=>{
  await store.saveRecipe(id,{name:'Adultos',sourceId:'source',steps:[]},async()=>true)
  const before=await readFile(file)
  await expect(store.changeSources(store.active!,()=>[],async()=>true)).rejects.toThrow(t('project.recipe.error.sourceInUse',{names:'Adultos'}))
  expect((await readFile(file)).equals(before)).toBe(true)
 })

 it('publica contexto y vistas sin confundir edición manual, cobertura acotada y ejecución',async()=>{
  await store.saveRecipe(id,{name:'Adultos',sourceId:'source',steps:[{op:'sample',method:'first',rows:2}]},async()=>true);const base=store.recipes[0]
  await store.saveRecipe(id,{name:'Repetida',baseRecipeId:base.id,steps:[{op:'select',columns:source.schema.columns},{op:'select',columns:[source.schema.columns[0]]}]},async()=>true);const child=store.recipes[1]
  expect(store.resolveRecipe(child.id)).toMatchObject({source,columns:[source.schema.columns[0]]})
  expect(store.recipeViews()).toEqual([
   {...base,rootSourceId:'source',depth:1,editable:true,bounded:true,dependents:[child.id],executable:true,sourceVersionDifferent:false},
   {...child,rootSourceId:'source',depth:2,columns:[source.schema.columns[0]],editable:false,bounded:true,dependents:[],executable:true,sourceVersionDifferent:false}
  ])
  await store.changeSources(store.active!,()=>[{...source,sha256:'2'.repeat(64)}],async()=>true)
  expect(store.recipeViews().every(recipe=>recipe.sourceVersionDifferent)).toBe(true)
 })
 it('no multiplica por cada conjunto el esquema completo que ya publica la fuente',async()=>{
  const columns=Array.from({length:200},(_,index)=>({position:index+1,name:'Campo '+index}))
  await store.changeSources(store.active!,()=>[{...source,schema:{...source.schema,columns}}],async()=>true)
  for(let index=0;index<40;index++)await store.saveRecipe(id,{name:'Conjunto '+index,sourceId:'source',steps:[]},async()=>true)
  const views=store.recipeViews()
  expect(views).toHaveLength(40)
  expect(views.every(recipe=>recipe.columns===undefined)).toBe(true)
  expect(Buffer.byteLength(JSON.stringify(views))).toBeLessThan(30_000)
  expect(store.resolveRecipe(views[0].id).columns).toEqual(columns)
 })
 it('expone solo proyección reconocida de un futuro sin ejecutar desconocidos ni escribir sus bytes',async()=>{
  const current=JSON.parse(await readFile(file,'utf8'))
  const valid={id:'valid',name:'Conocido',sourceId:'source',sourceSha256:sha,semantics:1,createdAt:date,steps:[]}
  const future={...current,version:2,unknown:{preserve:'é\n'},recipes:[valid,{...valid,id:'later',name:'Otra semántica',semantics:2},{...valid,id:'unsafe',name:'Paso desconocido',steps:[{op:'future',value:7}]},{id:'dependent',name:'Depende de desconocido',baseRecipeId:'unsafe',sourceSha256:sha,semantics:1,createdAt:date,steps:[]}]}
  const bytes=JSON.stringify(future,null,3)+'\n';await writeFile(file,bytes);const active=await store.open(folder)
  expect(active).toMatchObject({readonly:true,version:2,sourceCount:1})
  expect(store.sources).toEqual([source]);expect(store.recipes.map(recipe=>recipe.id)).toEqual(['valid','later','dependent'])
  expect(store.resolveRecipe('valid')).toMatchObject({source,steps:[]})
  expect(()=>store.resolveRecipe('later')).toThrow();expect(()=>store.resolveRecipe('dependent')).toThrow()
  expect(store.recipeViews().map(recipe=>[recipe.id,recipe.executable])).toEqual([['valid',true],['later',false],['dependent',false]])
  let updated=false
  for(const change of [
   ()=>store.rename(active.id,'Nuevo',async()=>true),
   ()=>store.changeSources(active,()=>{updated=true;return[]},async()=>true),
   ()=>store.saveRecipe(active.id,{name:'Nuevo',sourceId:'source',steps:[]},async()=>true),
   ()=>store.renameRecipe(active.id,'valid','Nuevo',async()=>true),
   ()=>store.removeRecipe(active.id,'valid',async()=>true)
  ])await expect(change()).rejects.toThrow()
  expect(updated).toBe(false);expect(await readFile(file,'utf8')).toBe(bytes)
 })
 it('no sobrescribe conflictos cancelados ni cambios recibidos durante la confirmación',async()=>{
  await store.saveRecipe(id,{name:'Adultos',sourceId:'source',steps:[]},async()=>true);const recipe=store.recipes[0]
  const external=JSON.parse(await readFile(file,'utf8'));external.name='Externo';const before=JSON.stringify(external);await writeFile(file,before)
  expect(await store.renameRecipe(id,recipe.id,'Local',async()=>false)).toBe(false)
  expect(await readFile(file,'utf8')).toBe(before);expect(store.recipes[0]).toEqual(recipe)
  external.name='Segundo';await writeFile(file,JSON.stringify(external));const during=JSON.stringify({...external,name:'Tercero'})
  await expect(store.renameRecipe(id,recipe.id,'Local',async()=>{await writeFile(file,during);return true})).rejects.toThrow()
  expect(await readFile(file,'utf8')).toBe(during)
 })

 it('rechaza nombres repetidos, ciclos y el nivel nueve en el backend sin escribir',async()=>{
  await store.saveRecipe(id,{name:'ÁREA',sourceId:'source',steps:[]},async()=>true);const base=store.recipes[0]
  let before=await readFile(file)
  await expect(store.saveRecipe(id,{name:'área',sourceId:'source',steps:[]},async()=>true)).rejects.toThrow()
  expect((await readFile(file)).equals(before)).toBe(true)
  let parent=base.id
  for(let depth=2;depth<=8;depth++){await store.saveRecipe(id,{name:'Nivel '+depth,baseRecipeId:parent,steps:[]},async()=>true);parent=store.recipes.at(-1)!.id}
  before=await readFile(file)
  await expect(store.saveRecipe(id,{name:'Nivel 9',baseRecipeId:parent,steps:[]},async()=>true)).rejects.toThrow()
  await expect(store.saveRecipe(id,{id:base.id,name:base.name,baseRecipeId:parent,steps:[]},async()=>true)).rejects.toThrow()
  expect((await readFile(file)).equals(before)).toBe(true)
 })
 it('bloquea una actualización externa a versión futura antes de confirmar o escribir',async()=>{
  await store.saveRecipe(id,{name:'Adultos',sourceId:'source',steps:[]},async()=>true);const recipe=store.recipes[0]
  const future=JSON.stringify({...JSON.parse(await readFile(file,'utf8')),version:2,unknown:'conservar'})+'\n';await writeFile(file,future)
  let confirmed=false
  await expect(store.renameRecipe(id,recipe.id,'Local',async()=>{confirmed=true;return true})).rejects.toThrow()
  expect(confirmed).toBe(false);expect(store.active?.readonly).toBe(true)
  expect(await readFile(file,'utf8')).toBe(future)
 })

})
