import {z} from 'zod'
import {filterOperators} from './table-conditions'

export const projectFile='proyecto.freyalab'
export const projectFolders=['01_raw','02_datasets','03_charts','04_reports'] as const
const format='freyalab-project'
const id=z.string().min(1).max(100)
const hash=z.string().regex(/^[a-f\d]{64}$/i)
const count=z.number().int().nonnegative()
const time=z.iso.datetime()
const path=z.string().min(1).max(32768).regex(/^[^\0]+$/)
const storedName=z.string().min(1).max(200).regex(/\S/)
export const projectName=z.string().trim().pipe(storedName)
const column=z.strictObject({position:count.min(1),name:z.string()})
const seed=z.int32()
const rows=count.min(1).max(1_000_000)
const percent=z.number().min(0.01).max(100)
const sampling=z.union([
 z.strictObject({method:z.literal('first'),rows}),
 z.strictObject({method:z.literal('random'),rows,seed}),
 z.strictObject({method:z.literal('random'),percent,seed})
])
const step=z.union([
 z.strictObject({op:z.literal('filter'),mode:z.enum(['all','any']),conditions:z.array(z.strictObject({column,op:z.enum(filterOperators.map(([value])=>value)),value:z.string(),caseSensitive:z.boolean()}))}),
 z.strictObject({op:z.literal('select'),columns:z.array(column)}),
 z.strictObject({op:z.literal('order'),by:z.array(z.strictObject({column,descending:z.boolean(),numeric:z.boolean()}))}),
 ...sampling.options.map(sample=>sample.extend({op:z.literal('sample')}))
])
const source=z.strictObject({
 id,path,external:z.boolean(),protection:z.literal('readonly'),bytes:count,sha256:hash,registeredAt:time,
 quick:z.strictObject({mtimeMs:z.number(),headSha256:hash,tailSha256:hash}),
 format:z.strictObject({encoding:z.enum(['utf8','utf16le','win1252']),bom:z.boolean(),delimiter:z.enum([',',';','\t','|']),header:z.boolean(),eol:z.enum(['\n','\r\n','\r']),finalEol:z.boolean()}),
 schema:z.strictObject({sha256:hash,columns:z.array(column)}),
 history:z.array(hash).optional()
})
const recipeFields={id,name:storedName,sourceSha256:hash,semantics:count.min(1),steps:z.array(step),createdAt:time}
const recipe=z.union([z.strictObject({...recipeFields,sourceId:id}),z.strictObject({...recipeFields,baseRecipeId:id})])
const coverageFields={matched:count,scanned:count}
const coverage=z.union([
 z.strictObject({...coverageFields,kind:z.enum(['full','filtered']),total:count,complete:z.literal(true)}),
 z.strictObject({...coverageFields,kind:z.literal('sample'),total:count,complete:z.literal(true),sampling}),
 z.strictObject({...coverageFields,kind:z.literal('sample'),complete:z.literal(false)})
])
const result=z.strictObject({
 id,kind:z.enum(['extract','chart','report']),recipeId:id,path,bytes:count,sha256:hash,createdAt:time,
 provenance:z.strictObject({
  sourceSha256:hash,executedAt:time,engine:z.strictObject({app:z.string(),contract:z.string(),semantics:count.min(1)}),
  coverage,fidelity:z.strictObject({level:z.enum(['bytes','values']),normalization:z.array(z.string()),irregularRows:count}),
  warnings:z.array(z.string()),chain:z.array(id).min(1).max(8).optional(),recipeSha256:z.record(id,hash).optional()
 })
})
export const projectManifest=z.strictObject({format:z.literal(format),version:z.literal(1),id,name:storedName,createdAt:time,
 sources:z.array(source),recipes:z.array(recipe),results:z.array(result)}).superRefine((value,context)=>{
 const issue=(key:string,index:number)=>context.addIssue({code:'custom',path:[key,index],message:'Referencia de proyecto inválida'})
 const sources=new Map(value.sources.map(source=>[source.id,source]))
 const recipes=new Map(value.recipes.map(recipe=>[recipe.id,recipe]))
 for(const [index,source] of value.sources.entries()){
  const absolute=/^(?:\/|[a-z]:[\\/]|\\\\)/i.test(source.path)
  const escapes=/^[a-z]:/i.test(source.path)||source.path.split(/[\\/]/).includes('..')||source.path.startsWith('\\')
  if(source.external!==absolute||!absolute&&escapes||sources.get(source.id)!==source)issue('sources',index)
 }
 for(const [index,recipe] of value.recipes.entries()){
  const visited=new Set<string>()
  let current:typeof recipe|undefined=recipe
  while(current&&'baseRecipeId' in current&&!visited.has(current.id)&&visited.size<8){
   visited.add(current.id);current=recipes.get(current.baseRecipeId)
  }
  if(!current||!('sourceId' in current)||!sources.has(current.sourceId)||visited.size>=8||recipes.get(recipe.id)!==recipe)issue('recipes',index)
 }
 for(const [index,result] of value.results.entries())if(!recipes.has(result.recipeId))issue('results',index)
})
export const projectManifestJSONSchema={...z.toJSONSchema(projectManifest,{reused:'ref'}),
 $comment:'El validador de FreyaLab también verifica rutas, referencias entre registros y profundidad de recetas.'}
export const projectEnvelope=z.looseObject({format:z.literal(format),version:count.min(1),id:z.unknown().optional(),name:z.unknown().optional()})
export type ProjectManifest=z.infer<typeof projectManifest>
export type ProjectInfo={id:string;name:string;path:string;version:number;readonly:boolean;sourceCount:number}
export type ProjectRecent={path:string;name:string;missing:boolean}
