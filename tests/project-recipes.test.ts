import {describe,expect,it} from 'vitest'
import * as projectSchema from '../src/shared/project'
import type {ProjectManifest,ProjectRecipe} from '../src/shared/project'
import * as recipes from '../src/shared/project-recipes'
const {resolveProjectRecipe}=recipes
const sha='a'.repeat(64),createdAt='2026-11-16T00:00:00.000Z'
const columns=[{position:1,name:'ID'},{position:2,name:'Entidad'},{position:3,name:'Edad'},{position:4,name:'Ingreso'},{position:5,name:'Nota'}]
const source={id:'source',path:'censo.csv',external:false,protection:'readonly' as const,bytes:211,sha256:sha,registeredAt:createdAt,quick:{mtimeMs:0,headSha256:sha,tailSha256:sha},format:{encoding:'utf8' as const,bom:false,delimiter:',' as const,header:true,eol:'\n' as const,finalEol:true},schema:{sha256:sha,columns}}
const base:ProjectRecipe={id:'base',name:'Oaxaca, adultos',sourceId:'source',sourceSha256:sha,semantics:1,createdAt,steps:[{op:'filter',mode:'all',conditions:[{column:columns[1],op:'equals',value:'Oaxaca',caseSensitive:false}]},{op:'order',by:[{column:columns[2],descending:true,numeric:true}]},{op:'select',columns:[columns[0],columns[2],columns[4]]}]}
function manifest(recipes:ProjectRecipe[]):ProjectManifest{return{format:'freyalab-project',version:1,id:'project',name:'Proyecto',createdAt,sources:[source],recipes,results:[]}}
describe('PRJ-02a · dominio de conjuntos',()=>{
 it.each([{positions:[1_000_000_000]},{positions:[1,3]},{positions:[2,1]}])('el esquema físico rechaza posiciones no consecutivas sin asignar arrays por su valor: $positions',({positions})=>{
  const unsafe={...source,schema:{...source.schema,columns:positions.map(position=>({position,name:'Columna'}))}}
  expect(projectSchema.projectSource.safeParse(unsafe).success).toBe(false)
 })
 it('resuelve la raíz y aplana la cadena sin renumerar las columnas conservadas',()=>{
  const child:ProjectRecipe={id:'child',name:'Dos mayores',baseRecipeId:'base',sourceSha256:sha,semantics:1,createdAt,steps:[{op:'sample',method:'first',rows:2}]}
  const project=manifest([base,child]),before=JSON.stringify(project)
  const result=resolveProjectRecipe(project,'child')
  expect(result.source).toEqual(source)
  expect(result.chain.map(recipe=>recipe.id)).toEqual(['base','child'])
  expect(result.steps).toEqual([...base.steps,...child.steps])
  expect(result.columns).toEqual([columns[0],columns[2],columns[4]])
  expect(JSON.stringify(project)).toBe(before)
 })
 it('enumera todos los dependientes transitivos y no incluye la propia base',()=>{
  const child:ProjectRecipe={...base,id:'child',name:'Hija',baseRecipeId:'base'};delete (child as Partial<typeof base>).sourceId
  const grand:ProjectRecipe={...child,id:'grand',name:'Nieta',baseRecipeId:'child'}
  const other={...base,id:'other',name:'Otra'}
  expect(recipes.projectRecipeDependents(manifest([base,child,grand,other]),'base').map(item=>item.id)).toEqual(['child','grand'])
  expect(recipes.projectRecipeDependents(manifest([base,child,grand,other]),'grand')).toEqual([])
 })
 it('solo permite editar en el panel una secuencia canónica no destructiva',()=>{
  expect(recipes.projectRecipeEditorCompatible([])).toBe(true)
  expect(recipes.projectRecipeEditorCompatible(base.steps)).toBe(true)
  expect(recipes.projectRecipeEditorCompatible([{op:'sample',method:'random',rows:3,seed:7}])).toBe(true)
  for(const steps of [
   [base.steps[2],base.steps[0]],
   [base.steps[0],base.steps[0]],
   [{op:'select',columns:[]}],
   [{op:'select',columns:[columns[4],columns[0]]}],
   [{op:'filter',mode:'all',conditions:[]}],
   [{op:'order',by:[]}]
  ])expect(recipes.projectRecipeEditorCompatible(steps as ProjectRecipe['steps'])).toBe(false)
 })
 it('rechaza ciclos, referencias ausentes, semánticas futuras y un noveno nivel',()=>{
  const from=(id:string,parent:string):ProjectRecipe=>({id,name:id,baseRecipeId:parent,sourceSha256:sha,semantics:1,steps:[],createdAt})
  const eight=[base,...Array.from({length:7},(_,i)=>from('n'+i,i?'n'+(i-1):'base'))]
  expect(resolveProjectRecipe(manifest(eight),'n6').chain).toHaveLength(8)
  for(const [project,id] of [
   [manifest([from('a','b'),from('b','a')]),'a'],
   [manifest([from('a','missing')]),'a'],
   [manifest([{...base,semantics:2}]),'base'],
   [manifest([...eight,from('n7','n6')]),'n7']
  ] as const)expect(()=>resolveProjectRecipe(project,id)).toThrow()
 })
 it('detiene columnas cambiadas o eliminadas de la base, incluso con encabezados duplicados',()=>{
  const projected=manifest([base]);projected.sources[0]={...source,schema:{...source.schema,columns:columns.map(item=>item.position===3?{...item,name:'Años'}:item)}}
  expect(()=>resolveProjectRecipe(projected,'base')).toThrow()
  const child:ProjectRecipe={id:'child',name:'Ingreso',baseRecipeId:'base',sourceSha256:sha,semantics:1,createdAt,steps:[{op:'order',by:[{column:columns[3],descending:false,numeric:true}]}]}
  expect(()=>resolveProjectRecipe(manifest([base,child]),'child')).toThrow()
  const duplicate={...source,schema:{...source.schema,columns:[{position:1,name:'ID'},{position:2,name:'ID'},{position:3,name:''}]}}
  const project=manifest([{...base,steps:[{op:'select',columns:[duplicate.schema.columns[1],duplicate.schema.columns[2]]}]}]);project.sources=[duplicate]
  expect(resolveProjectRecipe(project,'base').columns).toEqual([{position:2,name:'ID'},{position:3,name:''}])
 })

 it('valida el borrador cerrado y no acepta identidad ni metadatos de la interfaz',()=>{
  const draft={name:' Adultos ',sourceId:'source',steps:[]}
  expect(projectSchema.projectRecipeDraft.parse(draft)).toEqual({...draft,name:'Adultos'})
  for(const changed of [{sourceSha256:sha},{semantics:1},{createdAt},{unknown:true},{baseRecipeId:'base'},{id:''},{name:'x'.repeat(201)},{steps:[{op:'sql',sql:'SELECT 1'}]}])expect(projectSchema.projectRecipeDraft.safeParse({...draft,...changed}).success).toBe(false)
 })
 it('solo un número de filas fijo acota la entrada de una cadena',()=>{
  expect(recipes.projectRecipeBounded([])).toBe(false)
  expect(recipes.projectRecipeBounded([{op:'sample',method:'random',percent:50,seed:7}])).toBe(false)
  expect(recipes.projectRecipeBounded([{op:'sample',method:'first',rows:2}])).toBe(true)
  expect(recipes.projectRecipeBounded([{op:'sample',method:'random',rows:3,seed:7}])).toBe(true)
 })

})
