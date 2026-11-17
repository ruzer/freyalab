import {afterEach,beforeEach,describe,expect,it} from 'vitest'
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {runRecipe} from '../src/main/recipe-operation'
import type {RecipeOperationSource} from '../src/shared/recipe-operation'
import type {ProjectManifest} from '../src/shared/project'
import iconv from 'iconv-lite'

type Step=ProjectManifest['recipes'][number]['steps'][number]
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex')
const columns=['ID','Entidad','Edad','Ingreso','Nota'].map((name,index)=>({position:index+1,name}))
const col=(position:number)=>columns[position-1]
let folder:string
beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-recipe-'))})
afterEach(async()=>{await rm(folder,{recursive:true,force:true})})
async function source(data?:string):Promise<RecipeOperationSource>{
 const bytes=data===undefined?await readFile(new URL('./fixtures/prj02-censo.csv',import.meta.url)):Buffer.from(data)
 const path=join(folder,'censo.csv');await writeFile(path,bytes)
 return{path,bytes:bytes.length,sha256:sha(bytes),format:{encoding:'utf8',bom:false,delimiter:',',header:true,eol:'\n',finalEol:bytes.at(-1)===10},schema:{sha256:sha(JSON.stringify(columns)),columns}}
}

describe('PRJ-02a · ejecución de conjuntos',()=>{
 it('filtra, ordena y proyecta el fixture sin perder ausencia, Unicode ni campos multilínea',async()=>{
  const input=await source(),before=await readFile(input.path)
  const steps:Step[]=[
   {op:'filter',mode:'all',conditions:[{column:col(2),op:'equals',value:'Oaxaca',caseSensitive:true},{column:col(3),op:'greaterEqual',value:'18',caseSensitive:true}]},
   {op:'order',by:[{column:col(3),descending:true,numeric:true}]},
   {op:'select',columns:[col(1),col(3),col(5)]}
  ]
  const result=await runRecipe(input,steps)
  expect(result.rows).toEqual([['00128','61',null],['00126','52','ok'],['00123','34','línea 1\nlínea 2']])
  expect(result.columns).toEqual([col(1),col(3),col(5)])
  expect(result.headers).toEqual(['ID','Edad','Nota'])
  expect(result).toMatchObject({scanned:7,eligible:3,resultCount:3,complete:true,cancelled:false,sha256:input.sha256,bytesRead:input.bytes})
  expect(await readFile(input.path)).toEqual(before)
 })
 it('muestra de tres con semilla 7 coincide con el vector previo y conserva orden de llegada',async()=>{
  const input=await source(),steps:Step[]=[{op:'sample',method:'random',rows:3,seed:7}]
  const first=await runRecipe(input,steps)
  expect(first.rows.map(row=>row[0])).toEqual(['00124','9007199254740993','00128'])
  expect(first.rows[0][4]).toBe('');expect(first.rows[2][4]).toBeNull()
  expect(first).toMatchObject({scanned:7,eligible:7,resultCount:3,complete:true,sampling:[{step:0,method:'random',requestedRows:3,seed:7,eligible:7,selected:3}]})
  expect(await runRecipe(input,steps)).toEqual(first)
  expect(await runRecipe(input,steps)).toEqual(first)
 })
 it.each([
  [50,7,['00123','00124','00127','00128','00129']],
  [100,7,['00123','00124','9007199254740993','00126','00127','00128','00129']]
 ])('porcentaje %s y semilla %s usa el ordinal raíz, no una cantidad redondeada',async(percent,seed,ids)=>{
  const result=await runRecipe(await source(),[{op:'sample',method:'random',percent,seed}])
  expect(result.rows.map(row=>row[0])).toEqual(ids)
  expect(result.sampling).toEqual([{step:0,method:'random',percent,seed,eligible:7,selected:ids.length}])
  expect(result.complete).toBe(true)
 })
 it('filtrar antes del porcentaje mantiene el ordinal físico de la fuente',async()=>{
  const result=await runRecipe(await source(),[
   {op:'filter',mode:'all',conditions:[{column:col(2),op:'equals',value:'Oaxaca',caseSensitive:true}]},
   {op:'sample',method:'random',percent:50,seed:7}
  ])
  expect(result.rows.map(row=>row[0])).toEqual(['00123','00124','00128'])
  expect(result.sampling).toMatchObject([{step:1,eligible:4,selected:3}])
 })
 it('first corta antes de registros posteriores inválidos y no afirma SHA completo por una lectura adelantada',async()=>{
  const input=await source('ID,Entidad,Edad,Ingreso,Nota\n1,Oaxaca,1,0,ok\n2,Oaxaca,2,0,ok\n3,"sin cerrar\n')
  const result=await runRecipe(input,[{op:'sample',method:'first',rows:2}],{chunk:1024})
  expect(result.rows.map(row=>row[0])).toEqual(['1','2'])
  expect(result).toMatchObject({scanned:2,eligible:2,resultCount:2,complete:false,cancelled:false})
  expect(result.bytesRead).toBe(input.bytes)
  expect(result).not.toHaveProperty('sha256')
 })
 it('first de un prefijo solo lee el principio de un archivo mayor que el chunk',async()=>{
  const input=await source('ID,Entidad,Edad,Ingreso,Nota\n'+Array.from({length:3000},(_,index)=>`${index},Oaxaca,30,0,${'x'.repeat(80)}\n`).join(''))
  const result=await runRecipe(input,[{op:'sample',method:'first',rows:2}],{chunk:128})
  expect(result.rows.map(row=>row[0])).toEqual(['0','1'])
  expect(result.scanned).toBe(2);expect(result.complete).toBe(false);expect(result.bytesRead).toBeLessThan(512)
 })
 it('un encadenado aplanado conserva orden→select→first y la cobertura completa',async()=>{
  const input=await source(),steps:Step[]=[
   {op:'filter',mode:'all',conditions:[{column:col(2),op:'equals',value:'Oaxaca',caseSensitive:true},{column:col(3),op:'greaterEqual',value:'18',caseSensitive:true}]},
   {op:'order',by:[{column:col(3),descending:true,numeric:true}]},
   {op:'select',columns:[col(1),col(3),col(5)]},
   {op:'sample',method:'first',rows:2}
  ]
  const result=await runRecipe(input,steps)
  expect(result.rows).toEqual([['00128','61',null],['00126','52','ok']])
  expect(result).toMatchObject({scanned:7,eligible:3,resultCount:2,complete:true,sampling:[{step:3,method:'first',requestedRows:2,eligible:3,selected:2}]})
  expect(await runRecipe(input,[steps[0],steps[1],steps[3],steps[2]])).toMatchObject({rows:result.rows,resultCount:2,complete:true})
 })
 it('sin select conserva los campos extra de una fila irregular; seleccionar sí los excluye explícitamente',async()=>{
  const input=await source('ID,Entidad,Edad,Ingreso,Nota\n1,Oaxaca,30,0,ok,extra\n2,Oaxaca,20\n')
  const all=await runRecipe(input,[])
  expect(all.rows).toEqual([['1','Oaxaca','30','0','ok','extra'],['2','Oaxaca','20',null,null]])
  const selected=await runRecipe(input,[{op:'select',columns:[col(1),col(5)]}])
  expect(selected.rows).toEqual([['1','ok'],['2',null]])
 })
 it.each([
  ['utf8',true,'\r\n',8],['utf16le',true,'\r\n',8],['utf16le',false,'\n',8],['win1252',false,'\r',7]
 ] as const)('preserva %s, BOM %s, EOL y valores byte a byte sin escribir',async(encoding,bom,eol,chunk)=>{
  const input=await source(),text=['ID,Entidad,Edad,Ingreso,Nota','00123,México,30,100,"línea 1'+eol+'línea 2"','9007199254740993,Puebla,20,0,'].join(eol)+eol
  const bytes=iconv.encode(text,encoding,{addBOM:bom});await writeFile(input.path,bytes)
  input.bytes=bytes.length;input.sha256=sha(bytes);input.format={...input.format,encoding,bom,eol}
  const result=await runRecipe(input,[],{chunk})
  expect(result.rows).toEqual([['00123','México','30','100',`línea 1${eol}línea 2`],['9007199254740993','Puebla','20','0','']])
  expect(result).toMatchObject({complete:true,scanned:2,bytesRead:bytes.length,sha256:input.sha256})
  expect(await readFile(input.path)).toEqual(bytes)
 })
 it('cancelar devuelve cobertura parcial, sin total global ni huella y sin archivos nuevos',async()=>{
  const input=await source(),before=await readFile(input.path);let cancelled=false
  const result=await runRecipe(input,[{op:'sample',method:'random',rows:2,seed:7}],{batchRecords:2,cancelled:()=>cancelled,progress:progress=>{if(progress.scanned>=4)cancelled=true}})
  expect(result).toMatchObject({resultCount:2,complete:false,cancelled:true})
  expect(result.scanned).toBeGreaterThanOrEqual(4);expect(result.scanned).toBeLessThan(7);expect(result.eligible).toBe(result.scanned)
  expect(result).not.toHaveProperty('sha256');expect(result).not.toHaveProperty('total')
  expect(result.rows).toHaveLength(2);expect(await readdir(folder)).toEqual(['censo.csv']);expect(await readFile(input.path)).toEqual(before)
 })
 it('descarta el resultado si la huella completa no coincide con la registrada',async()=>{
  const input=await source();input.sha256='0'.repeat(64)
  await expect(runRecipe(input,[])).rejects.toMatchObject({code:'changed'})
 })
 it('valida todas las referencias y la materialización prohibida antes de abrir el archivo',async()=>{
  const input=await source();input.path=join(folder,'no-existe.csv')
  await expect(runRecipe(input,[{op:'select',columns:[{position:3,name:'Años'}]}])).rejects.toMatchObject({code:'schema',data:{position:3,name:'Años',actualName:'Edad'}})
  await expect(runRecipe(input,[{op:'select',columns:[col(1)]},{op:'filter',mode:'all',conditions:[{column:col(2),op:'equals',value:'Oaxaca',caseSensitive:true}]}])).rejects.toMatchObject({code:'columns',data:{position:2}})
  await expect(runRecipe(input,[{op:'order',by:[{column:col(3),descending:true,numeric:true}]},{op:'sample',method:'random',rows:2,seed:7}])).rejects.toMatchObject({code:'plan',data:{constraint:'unbounded-order'}})
 })
 it('la vista previa final tiene 100 filas y el recuento conserva todos los registros',async()=>{
  const input=await source('ID,Entidad,Edad,Ingreso,Nota\n'+Array.from({length:340},(_,index)=>`${index},Oaxaca,${index},0,ok\n`).join(''))
  const result=await runRecipe(input,[{op:'order',by:[{column:col(3),descending:true,numeric:true}]}])
  expect(result.rows).toHaveLength(100);expect(result.rows[0][0]).toBe('339');expect(result.rows[99][0]).toBe('240')
  expect(result).toMatchObject({scanned:340,eligible:340,resultCount:340,complete:true})
 })
 it('orden Unicode ordinal fijo, números exactos y empates estables independientes del idioma',async()=>{
  const input=await source('ID,Entidad,Edad,Ingreso,Nota\n1,á,9007199254740993,0,ok\n2,Z,9007199254740992,0,ok\n3,A,3,0,ok\n4,Á,3,0,ok\n5,a,no,0,ok\n')
  const text=await runRecipe(input,[{op:'order',by:[{column:col(2),descending:false,numeric:false}]}])
  expect(text.rows.map(row=>row[1])).toEqual(['A','Z','a','Á','á'])
  const numeric=await runRecipe(input,[{op:'order',by:[{column:col(3),descending:true,numeric:true}]}])
  expect(numeric.rows.map(row=>row[0])).toEqual(['1','2','3','4','5'])
 })
 it('un encabezado cambiado se detiene antes de analizar una fila de datos malformada',async()=>{
  const input=await source('ID,Entidad,Años,Ingreso,Nota\n1,"sin cerrar\n')
  await expect(runRecipe(input,[{op:'order',by:[{column:col(3),descending:false,numeric:true}]}])).rejects.toMatchObject({code:'schema',data:{position:3,name:'Edad',actualName:'Años'}})
 })
 it.each(['ID,Entidad,Edad,Ingreso,Nota,Extra\n1,Oaxaca,30,0,ok,x\n','ID,Entidad,Edad,Ingreso\n1,Oaxaca,30,0\n'])('first rechaza un ancho de encabezado distinto antes del resultado: %s',async text=>{
  const input=await source(text)
  await expect(runRecipe(input,[{op:'sample',method:'first',rows:1}])).rejects.toMatchObject({code:'schema'})
 })
 it('la cancelación llega también a los pasos sobre un depósito ya acotado',async()=>{
  const count=6000,input=await source('ID,Entidad,Edad,Ingreso,Nota\n'+Array.from({length:count},(_,index)=>`${index},Oaxaca,30,0,ok\n`).join(''))
  let completedUpdates=0,cancelled=false
  const result=await runRecipe(input,[{op:'sample',method:'random',rows:count,seed:7},{op:'filter',mode:'all',conditions:[{column:col(3),op:'greater',value:'10',caseSensitive:true}]}],{cancelled:()=>cancelled,progress:progress=>{if(progress.scanned===count&&++completedUpdates>=2)cancelled=true}})
  expect(completedUpdates).toBeGreaterThanOrEqual(2)
  expect(result).toMatchObject({scanned:count,cancelled:true,complete:false})
  expect(result).not.toHaveProperty('sha256')
 })
 it('UTF-16 con lecturas impares no duplica bytes en la huella y cuenta los bytes realmente leídos',async()=>{
  const input=await source(),bytes=iconv.encode('ID,Entidad,Edad,Ingreso,Nota\r\n1,México,30,0,ok\r\n','utf16le',{addBOM:true})
  await writeFile(input.path,bytes);input.bytes=bytes.length;input.sha256=sha(bytes);input.format={...input.format,encoding:'utf16le',bom:true,eol:'\r\n'}
  const result=await runRecipe(input,[],{chunk:3})
  expect(result.rows).toEqual([['1','México','30','0','ok']])
  expect(result.sha256).toBe(input.sha256);expect(result.complete).toBe(true);expect(result.bytesRead).toBeGreaterThanOrEqual(bytes.length)
 })
 it('UTF-8 inválido informa un error de codificación, sin sustituir bytes por caracteres',async()=>{
  const input=await source(),bytes=Buffer.concat([Buffer.from('ID,Entidad,Edad,Ingreso,Nota\n1,'),Buffer.from([0xc3,0x28]),Buffer.from(',30,0,ok\n')])
  await writeFile(input.path,bytes);input.bytes=bytes.length;input.sha256=sha(bytes)
  await expect(runRecipe(input,[])).rejects.toMatchObject({code:'encoding'})
 })
 it('pasos manuales order→filter→order→first conservan la segunda prioridad y los empates de la primera',async()=>{
  const input=await source('ID,Entidad,Edad,Ingreso,Nota\nA,B,1,0,ok\nB,A,3,0,ok\nC,A,2,0,ok\nD,B,3,0,ok\nE,A,1,0,ok\n')
  const result=await runRecipe(input,[
   {op:'order',by:[{column:col(3),numeric:true,descending:true}]},
   {op:'filter',mode:'all',conditions:[{column:col(3),op:'greaterEqual',value:'2',caseSensitive:true}]},
   {op:'order',by:[{column:col(2),numeric:false,descending:true}]},
   {op:'sample',method:'first',rows:2}
  ])
  // Primera ordenación: B,D,C,A,E; filtro: B,D,C; segunda: D,B,C; primeras dos: D,B.
  expect(result.rows.map(row=>row[0])).toEqual(['D','B'])
  expect(result).toMatchObject({scanned:5,eligible:3,resultCount:2,complete:true})
 })
 it('pasos manuales depósito→order→depósito reinician cada semilla y mantienen el orden de llegada',async()=>{
  const result=await runRecipe(await source(),[
   {op:'sample',method:'random',rows:3,seed:7},
   {op:'order',by:[{column:col(3),numeric:true,descending:true}]},
   {op:'sample',method:'random',rows:2,seed:0}
  ])
  // [2,3,6] → edades descendentes [6,3,2]; e220… mod 3=1 sustituye 3 por 2: [6,2].
  expect(result.rows.map(row=>row[0])).toEqual(['00128','00124'])
  expect(result.sampling).toMatchObject([{step:0,eligible:7,selected:3},{step:2,eligible:3,selected:2}])
 })
 it('porcentaje→first corta el recorrido y conserva los dos contadores sin inventar totales',async()=>{
  const result=await runRecipe(await source(),[{op:'sample',method:'random',percent:50,seed:7},{op:'sample',method:'first',rows:2}])
  expect(result.rows.map(row=>row[0])).toEqual(['00123','00124'])
  expect(result).toMatchObject({scanned:2,resultCount:2,complete:false,sampling:[{step:0,eligible:2,selected:2},{step:1,eligible:2,selected:2}]})
  expect(result).not.toHaveProperty('sha256')
 })
 it('semilla -1 se amplía a uint64, conforme al vector independiente anterior a esta prueba',async()=>{
  // Referencia sin importar el motor: experiments/prj02-reference/negative-reference.{py,txt}.
  // Palabras: e4d971771b652c20, e99ff867dbf682c9, 382ff84cb27281e9; restos para i=3,4,5: 2,1,1.
  const input=await source('ID,Entidad,Edad,Ingreso,Nota\nA,X,1,0,ok\nB,X,2,0,ok\nC,X,3,0,ok\nD,X,4,0,ok\nE,X,5,0,ok\n')
  const sample=await runRecipe(input,[{op:'sample',method:'random',rows:2,seed:-1}])
  expect(sample.rows.map(row=>row[0])).toEqual(['A','E'])
  const percent=await runRecipe(await source(),[{op:'sample',method:'random',percent:50,seed:-1}])
  expect(percent.rows.map(row=>row[0])).toEqual(['9007199254740993','00126'])
 })
 it.each(['first','random'] as const)('pedir más filas que las existentes con %s devuelve todas y el recuento conocido',async method=>{
  const step:Step=method==='first'?{op:'sample',method,rows:10}:{op:'sample',method,rows:10,seed:7}
  const result=await runRecipe(await source(),[step])
  expect(result.rows.map(row=>row[0])).toEqual(['00123','00124','9007199254740993','00126','00127','00128','00129'])
  expect(result).toMatchObject({scanned:7,resultCount:7,complete:true,sampling:[{eligible:7,selected:7,requestedRows:10}]})
 })
})
