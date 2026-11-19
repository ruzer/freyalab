import {afterEach,beforeEach,describe,expect,it} from 'vitest'
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {runRecipe} from '../src/main/recipe-operation'
import type {ProjectRecipeStep} from '../src/shared/project'
import type {RecipeOperationSource,RecipeOperationHooks,RecipeOperationProgress} from '../src/shared/recipe-operation'

const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex')
let folder:string
beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-recipe-extract-'))})
afterEach(async()=>{await rm(folder,{recursive:true,force:true})})

describe('PRJ-03 · exportación duradera del conjunto',()=>{
 it('escribe Oaxaca adultos con sus bytes exactos, Nota ausente y fuente intacta',async()=>{
  const original=await readFile(new URL('./fixtures/prj02-censo.csv',import.meta.url))
  const path=join(folder,'censo.csv'),output=join(folder,'Oaxaca, adultos.csv')
  await writeFile(path,original)
  const columns=['ID','Entidad','Edad','Ingreso','Nota'].map((name,index)=>({position:index+1,name}))
  const input:RecipeOperationSource={path,bytes:original.length,sha256:sha(original),format:{encoding:'utf8',bom:false,delimiter:',',header:true,eol:'\n',finalEol:true},schema:{sha256:sha(Buffer.from(JSON.stringify(columns))),columns}}
  const steps:ProjectRecipeStep[]=[
   {op:'filter',mode:'all',conditions:[{column:{position:2,name:'Entidad'},op:'equals',value:'Oaxaca',caseSensitive:true},{column:{position:3,name:'Edad'},op:'greaterEqual',value:'18',caseSensitive:true}]},
   {op:'order',by:[{column:{position:3,name:'Edad'},descending:true,numeric:true}]},
   {op:'select',columns:[{position:1,name:'ID'},{position:3,name:'Edad'},{position:5,name:'Nota'}]}
  ]
  const expected=Buffer.from('ID,Edad,Nota\n00128,61\n00126,52,ok\n00123,34,"línea 1\nlínea 2"\n')
  const progress:RecipeOperationProgress[]=[]
  // Until the closed extract mode is typed, call the existing real engine rather than an absent export or a mock.
  const extract=runRecipe as unknown as (source:RecipeOperationSource,steps:ProjectRecipeStep[],hooks:RecipeOperationHooks,mode:{operation:'recipe_extract';output:string})=>Promise<unknown>
  const result=await extract(input,steps,{progress:update=>progress.push(update)},{operation:'recipe_extract',output})
  expect(progress.at(-1)).toMatchObject({scanned:7,totalBytes:original.length})
  expect(sha(await readFile(path))).toBe(sha(original))
  const written=await readFile(output).catch(error=>{if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error})
  expect(written,'el motor debe crear el archivo duradero, no devolver solo la vista previa').toEqual(expected)
  const info=await stat(output)
  expect(result).toMatchObject({operation:'recipe_extract',bytes:expected.length,sha256:sha(expected),mtimeMs:info.mtimeMs,sourceSha256:sha(original),coverage:{scanned:7,resultCount:3,complete:true,cancelled:false},fidelity:{level:'values'}})
  expect(sha(await readFile(path))).toBe(sha(original))
 })
})
