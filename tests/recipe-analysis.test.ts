import {afterEach,beforeEach,describe,expect,it} from 'vitest'
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import iconv from 'iconv-lite'
import {runRecipe,runRecipeAnalysis} from '../src/main/recipe-operation'
import {ANALYSIS_LIMITS} from '../src/main/analysis-source'
import type {RecipeOperationSource,RecipeStep} from '../src/shared/recipe-operation'

const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex')
const columns=['ID','Entidad','Edad','Ingreso','Nota'].map((name,index)=>({position:index+1,name}))
const col=(position:number)=>columns[position-1]
let folder:string
beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-recipe-analysis-'))})
afterEach(async()=>{await rm(folder,{recursive:true,force:true})})
async function source(text?:string):Promise<RecipeOperationSource>{
 const bytes=text===undefined?await readFile(new URL('./fixtures/prj02-censo.csv',import.meta.url)):Buffer.from(text),path=join(folder,'censo.csv')
 await writeFile(path,bytes)
 return{path,bytes:bytes.length,sha256:sha(bytes),format:{encoding:'utf8',bom:false,delimiter:',',header:true,eol:'\n',finalEol:bytes.at(-1)===10},schema:{sha256:sha(JSON.stringify(columns)),columns}}
}
describe('PRJ-02b · entrada analítica íntegra del conjunto',()=>{
 it('entrega todas las filas, no las cien del preview, con el mismo orden del motor',async()=>{
  const input=await source('ID,Entidad,Edad,Ingreso,Nota\n'+Array.from({length:340},(_,n)=>`${n},Oaxaca,${n},0,ok\n`).join(''))
  const steps:RecipeStep[]=[{op:'order',by:[{column:col(3),descending:true,numeric:true}]}]
  const preview=await runRecipe(input,steps),result=await runRecipeAnalysis(input,steps)
  expect(preview.rows).toHaveLength(100);expect(result.rows).toHaveLength(340)
  expect(result.rows.slice(0,100)).toEqual(preview.rows);expect(result.rows.at(-1)?.[0]).toBe('0')
  expect(result).toMatchObject({resultCount:340,scanned:340,complete:true,sha256:input.sha256})
 })
 it('first conserva sus filas pero analiza la raíz entera y verifica su huella',async()=>{
  const input=await source(),result=await runRecipeAnalysis(input,[{op:'sample',method:'first',rows:2}])
  expect(result.rows.map(row=>row[0])).toEqual(['00123','00124'])
  expect(result).toMatchObject({scanned:7,resultCount:2,complete:true,bytesRead:input.bytes,sha256:input.sha256})
  expect((await runRecipe(input,[{op:'sample',method:'first',rows:2}])).complete).toBe(false)
 })
 it('al verificar toda la raíz, cuenta la entrada real de cada muestra anterior a first',async()=>{
  const result=await runRecipeAnalysis(await source(),[{op:'sample',method:'random',percent:50,seed:7},{op:'sample',method:'first',rows:2}])
  expect(result.rows.map(row=>row[0])).toEqual(['00123','00124'])
  expect(result.sampling).toMatchObject([{step:0,eligible:7,selected:5},{step:1,eligible:5,selected:2}])
 })
 it('first en análisis recorre en lotes, sin heredar progreso por cada registro del prefijo rápido',async()=>{
  const input=await source('ID,Entidad,Edad,Ingreso,Nota\n'+Array.from({length:5000},(_,n)=>`${n},O,1,0,ok\n`).join('')),progress:number[]=[]
  const result=await runRecipeAnalysis(input,[{op:'sample',method:'first',rows:1}],{batchRecords:500,progress:p=>{if(p.scanned)progress.push(p.scanned)}})
  expect(result).toMatchObject({scanned:5000,resultCount:1,complete:true});expect(progress[0]).toBe(500)
 })
 it('un error CSV después del prefijo impide publicar el análisis',async()=>{
  const input=await source('ID,Entidad,Edad,Ingreso,Nota\n1,Oaxaca,1,0,ok\n2,"sin cerrar\n')
  await expect(runRecipe(input,[{op:'sample',method:'first',rows:1}])).resolves.toMatchObject({resultCount:1})
  await expect(runRecipeAnalysis(input,[{op:'sample',method:'first',rows:1}])).rejects.toMatchObject({code:'csv'})
 })
 it.each(['rows','cells'] as const)('el límite raíz de %s se comprueba antes de first, select y filtros',async kind=>{
  const input=await source(),steps:RecipeStep[]=[{op:'filter',mode:'all',conditions:[{column:col(1),op:'equals',value:'00123',caseSensitive:true}]},{op:'sample',method:'first',rows:1},{op:'select',columns:[col(1)]}]
  await expect(runRecipeAnalysis(input,steps,{}, {...ANALYSIS_LIMITS,[kind]:kind==='rows'?3:10})).rejects.toMatchObject({code:'analysis-limit',data:{kind}})
 })
 it('rechaza el tamaño raíz antes de abrir incluso con una muestra de una fila',async()=>{
  const input=await source();input.path=join(folder,'no-existe.csv');input.bytes=ANALYSIS_LIMITS.bytes+1
  await expect(runRecipeAnalysis(input,[{op:'sample',method:'first',rows:1}])).rejects.toMatchObject({code:'analysis-limit',data:{kind:'bytes'}})
 })
 it('el límite de columnas se aplica al esquema raíz antes de la proyección',async()=>{
  const input=await source();input.path=join(folder,'no-existe.csv');input.schema.columns=Array.from({length:201},(_,i)=>({position:i+1,name:`C${i}`}))
  await expect(runRecipeAnalysis(input,[{op:'select',columns:[input.schema.columns[0]]}])).rejects.toMatchObject({code:'analysis-limit',data:{kind:'columns'}})
 })
 it('cuenta también los bytes de texto decodificado antes de filtrar',async()=>{
  const input=await source(),text='ID,Entidad,Edad,Ingreso,Nota\n'+Array.from({length:6},(_,n)=>`${n},O,1,0,${'é'.repeat(40)}\n`).join(''),bytes=iconv.encode(text,'win1252')
  await writeFile(input.path,bytes);input.bytes=bytes.length;input.sha256=sha(bytes);input.format.encoding='win1252'
  await expect(runRecipeAnalysis(input,[{op:'sample',method:'first',rows:1}],{}, {...ANALYSIS_LIMITS,bytes:bytes.length})).rejects.toMatchObject({code:'analysis-limit',data:{kind:'bytes'}})
 })
 it('no oculta campos extra de la raíz con una proyección posterior',async()=>{
  const input=await source('ID,Entidad,Edad,Ingreso,Nota\n1,O,1,0,ok,extra\n')
  await expect(runRecipeAnalysis(input,[{op:'select',columns:[col(1)]}])).rejects.toMatchObject({code:'analysis-structure'})
 })
 it('verifica el hash completo aunque first ya tenga sus filas',async()=>{
  const input=await source();input.sha256='0'.repeat(64)
  await expect(runRecipeAnalysis(input,[{op:'sample',method:'first',rows:1}])).rejects.toMatchObject({code:'changed'})
 })
 it('el fixture preserva ausencia, vacío, identificadores y salto multilínea sin escribir',async()=>{
  const input=await source(),before=await readFile(input.path),steps:RecipeStep[]=[{op:'select',columns:[col(5),col(1)]}]
  const result=await runRecipeAnalysis(input,steps)
  expect(result.rows[0]).toEqual(['línea 1\nlínea 2','00123']);expect(result.rows[1]).toEqual(['','00124'])
  expect(result.rows[2]).toEqual(['ok','9007199254740993']);expect(result.rows[5]).toEqual([null,'00128'])
  expect(await readFile(input.path)).toEqual(before);expect(await readdir(folder)).toEqual(['censo.csv'])
 })
 it('cancelar descarta la entrada analítica aunque ya tenga un prefijo válido',async()=>{
  const input=await source();let cancelled=false
  const result=await runRecipeAnalysis(input,[{op:'sample',method:'first',rows:1}],{batchRecords:2,cancelled:()=>cancelled,progress:p=>{if(p.scanned>=4)cancelled=true}})
  expect(result).toMatchObject({cancelled:true,complete:false,rows:[]});expect(result).not.toHaveProperty('sha256')
 })
 it('muestreos repetidos y orden manual usan los mismos vectores que Probar',async()=>{
  const input=await source(),steps:RecipeStep[]=[{op:'sample',method:'random',rows:5,seed:-7},{op:'order',by:[{column:col(3),descending:true,numeric:true}]},{op:'sample',method:'random',rows:3,seed:7}]
  const preview=await runRecipe(input,steps),result=await runRecipeAnalysis(input,steps)
  expect(result).toEqual(preview)
 })
})
