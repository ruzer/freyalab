import {afterEach,beforeEach,describe,expect,it} from 'vitest'
import {mkdtemp,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import iconv from 'iconv-lite'
import {runRecipe} from '../src/main/recipe-operation'
import type {ProjectRecipeStep} from '../src/shared/project'
import type {RecipeOperationSource,RecipeOperationProgress} from '../src/shared/recipe-operation'

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
  const result=await runRecipe(input,steps,{progress:update=>progress.push(update)},{operation:'recipe_extract',output})
  expect(progress.at(-1)).toMatchObject({scanned:7,totalBytes:original.length})
  expect(sha(await readFile(path))).toBe(sha(original))
  const written=await readFile(output).catch(error=>{if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error})
  expect(written,'el motor debe crear el archivo duradero, no devolver solo la vista previa').toEqual(expected)
  const info=await stat(output)
  expect(result).toMatchObject({operation:'recipe_extract',bytes:expected.length,sha256:sha(expected),mtimeMs:info.mtimeMs,sourceSha256:sha(original),coverage:{scanned:7,resultCount:3,complete:true,cancelled:false},fidelity:{level:'values'}})
  expect(sha(await readFile(path))).toBe(sha(original))
 })
 async function input(text?:string,format:Partial<RecipeOperationSource['format']>={}){
  const base=text??await readFile(new URL('./fixtures/prj02-censo.csv',import.meta.url),'utf8')
  const options={encoding:'utf8' as const,bom:false,delimiter:',' as const,header:true,eol:'\n' as const,finalEol:base.endsWith('\n'),...format}
  const bytes=iconv.encode(base,options.encoding,{addBOM:options.bom}),path=join(folder,'censo.csv')
  await writeFile(path,bytes)
  const columns=['ID','Entidad','Edad','Ingreso','Nota'].map((name,index)=>({position:index+1,name}))
  return{path,bytes:bytes.length,sha256:sha(bytes),format:options,schema:{sha256:sha(Buffer.from(JSON.stringify(columns))),columns}}
 }
 const oaxaca:ProjectRecipeStep={op:'filter',mode:'all',conditions:[{column:{position:2,name:'Entidad'},op:'equals',value:'Oaxaca',caseSensitive:true}]}
 it.each([['utf8',true],['win1252',false],['utf16le',true]] as const)('copia registros exactos %s BOM %s con CRLF, multilínea, vacío y campo ausente',async(encoding,bom)=>{
  const sourceText=(await readFile(new URL('./fixtures/prj02-censo.csv',import.meta.url),'utf8')).replaceAll('\n','\r\n')
  const source=await input(sourceText,{encoding,bom,eol:'\r\n'}),output=join(folder,'oaxaca.csv')
  const expected=iconv.encode('ID,Entidad,Edad,Ingreso,Nota\r\n00123,Oaxaca,34,1200,"línea 1\r\nlínea 2"\r\n00124,Oaxaca,17,0,\r\n00126,Oaxaca,52,,ok\r\n00128,Oaxaca,61,5000\r\n',encoding,{addBOM:bom})
  const result=await runRecipe(source,[oaxaca],{},{operation:'recipe_extract',output})
  expect(await readFile(output)).toEqual(expected)
  expect(result.fidelity).toMatchObject({level:'bytes',normalization:[]})
  expect(result.sha256).toBe(sha(expected));expect(sha(await readFile(source.path))).toBe(source.sha256)
 })
 it('proyecta Nota antes de ID: conserva ausencias finales y cuenta solo el ausente intermedio escrito vacío',async()=>{
  const source=await input(),output=join(folder,'nota.csv')
  const result=await runRecipe(source,[oaxaca,{op:'select',columns:[{position:5,name:'Nota'},{position:1,name:'ID'}]}],{},{operation:'recipe_extract',output})
  expect(await readFile(output,'utf8')).toBe('Nota,ID\n"línea 1\nlínea 2",00123\n,00124\nok,00126\n,00128\n')
  expect(result.warnings).toEqual(['1 campo ausente se escribió vacío porque va antes de otro campo'])
  expect(result.fidelity.normalization).toContain(result.warnings[0])
 })
 it('la semilla 7 exporta el vector independiente en el orden del archivo',async()=>{
  const source=await input(),output=join(folder,'muestra.csv')
  const result=await runRecipe(source,[{op:'sample',method:'random',rows:3,seed:7}],{},{operation:'recipe_extract',output})
  expect(await readFile(output,'utf8')).toBe('ID,Entidad,Edad,Ingreso,Nota\n00124,Oaxaca,17,0,\n9007199254740993,Puebla,45,3400,ok\n00128,Oaxaca,61,5000\n')
  expect(result.coverage.sampling).toEqual([{step:0,method:'random',requestedRows:3,seed:7,eligible:7,selected:3}])
 })
 it('Primeras N verifica todo el SHA sin interpretar una cola CSV inválida ni inventar un total',async()=>{
  const text='ID,Entidad,Edad,Ingreso,Nota\n1,Oaxaca,1,0,ok\n2,Oaxaca,2,0,ok\n3,"sin cerrar\n',source=await input(text),output=join(folder,'primeras.csv')
  const result=await runRecipe(source,[{op:'sample',method:'first',rows:2}],{chunk:7},{operation:'recipe_extract',output})
  expect(await readFile(output,'utf8')).toBe('ID,Entidad,Edad,Ingreso,Nota\n1,Oaxaca,1,0,ok\n2,Oaxaca,2,0,ok\n')
  expect(result.sourceSha256).toBe(source.sha256)
  expect(result.coverage).toMatchObject({scanned:2,resultCount:2,complete:false,bytesRead:source.bytes,sha256:source.sha256})
  expect(result.coverage).not.toHaveProperty('total')
 })
 it.each([false,true])('escribe todas las filas y no solo las cien del preview (orden=%s)',async ordered=>{
  const source=await input('ID,Entidad,Edad,Ingreso,Nota\n'+Array.from({length:140},(_,n)=>`${n},Oaxaca,${n},0,ok\n`).join('')),output=join(folder,'todas.csv')
  const steps:ProjectRecipeStep[]=ordered?[{op:'order',by:[{column:{position:3,name:'Edad'},descending:true,numeric:true}]}]:[]
  const result=await runRecipe(source,steps,{},{operation:'recipe_extract',output})
  const ids=Array.from({length:140},(_,n)=>ordered?139-n:n)
  expect(await readFile(output,'utf8')).toBe('ID,Entidad,Edad,Ingreso,Nota\n'+ids.map(n=>`${n},Oaxaca,${n},0,ok\n`).join(''))
  expect(result.coverage.resultCount).toBe(140)
 })
 it('normaliza solo el fin de línea de un registro sin salto que deja de ser el último',async()=>{
  const source=await input('ID,Entidad,Edad,Ingreso,Nota\n1,Oaxaca,1,0,ok\n2,Oaxaca,2,0,ok'),output=join(folder,'orden.csv')
  const result=await runRecipe(source,[{op:'order',by:[{column:{position:3,name:'Edad'},descending:true,numeric:true}]}],{},{operation:'recipe_extract',output})
  expect(await readFile(output,'utf8')).toBe('ID,Entidad,Edad,Ingreso,Nota\n2,Oaxaca,2,0,ok\n1,Oaxaca,1,0,ok\n')
  expect(result.fidelity).toMatchObject({level:'bytes',normalization:['Se añadió el fin de línea de la fuente al registro sin salto final que dejó de ser el último.']})
 })
 it('rechaza orden sin límite antes de publicar y respeta la excepción de primeras N',async()=>{
  const source=await input(),output=join(folder,'limite.csv'),order:ProjectRecipeStep={op:'order',by:[{column:{position:3,name:'Edad'},descending:true,numeric:true}]}
  await expect(runRecipe(source,[order],{exportLimits:{bytes:1,cells:1}},{operation:'recipe_extract',output})).rejects.toMatchObject({code:'export-limit'})
  expect(await readdir(folder)).toEqual(['censo.csv'])
  const bounded=await runRecipe(source,[order,{op:'sample',method:'first',rows:2}],{exportLimits:{bytes:1,cells:1}},{operation:'recipe_extract',output})
  expect(bounded.coverage.resultCount).toBe(2)
 })
 it('si no coincide el SHA completo tras Primeras N elimina el temporal y conserva la fuente',async()=>{
  const source=await input(),before=await readFile(source.path),output=join(folder,'cambio.csv')
  await expect(runRecipe({...source,sha256:'0'.repeat(64)},[{op:'sample',method:'first',rows:2}],{chunk:7},{operation:'recipe_extract',output})).rejects.toMatchObject({code:'changed'})
  expect(await readdir(folder)).toEqual(['censo.csv']);expect(await readFile(source.path)).toEqual(before)
 })
 it('cancelar limpia el temporal sin reemplazar el destino anterior ni modificar la fuente',async()=>{
  const source=await input(),before=await readFile(source.path),output=join(folder,'cancelado.csv');await writeFile(output,'anterior')
  let cancelled=false
  await expect(runRecipe(source,[oaxaca],{batchRecords:2,cancelled:()=>cancelled,progress:p=>{if(p.scanned>=4)cancelled=true}},{operation:'recipe_extract',output})).rejects.toMatchObject({code:'cancelled'})
  expect(await readFile(output,'utf8')).toBe('anterior');expect(await readFile(source.path)).toEqual(before)
  expect((await readdir(folder)).sort()).toEqual(['cancelado.csv','censo.csv'])
 })
 it('sin espacio no deja archivo ni temporal',async()=>{
  const source=await input(),output=join(folder,'sin-espacio.csv')
  await expect(runRecipe(source,[],{freeBytes:async()=>0},{operation:'recipe_extract',output})).rejects.toThrow('No hay espacio suficiente')
  expect(await readdir(folder)).toEqual(['censo.csv'])
 })

 it('ordena dentro del límite antes de la muestra exacta y conserva las primeras posteriores',async()=>{
  const source=await input(),output=join(folder,'orden-muestra.csv')
  const result=await runRecipe(source,[{op:'order',by:[{column:{position:3,name:'Edad'},descending:true,numeric:true}]},{op:'sample',method:'random',rows:3,seed:7},{op:'sample',method:'first',rows:2}],{},{operation:'recipe_extract',output})
  // En el orden por edad, el vector independiente de posiciones [2,3,6] elige 00126, 9007199254740993, 00124.
  expect(await readFile(output,'utf8')).toBe('ID,Entidad,Edad,Ingreso,Nota\n00126,Oaxaca,52,,ok\n9007199254740993,Puebla,45,3400,ok\n')
  expect(result.coverage.sampling).toMatchObject([{step:1,eligible:7,selected:3},{step:2,eligible:3,selected:2}])
 })

})
