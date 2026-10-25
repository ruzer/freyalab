import {describe,it,expect,beforeEach,afterEach} from 'vitest'
import {mkdtemp,writeFile,readFile,readdir,rm,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {parse} from 'csv-parse/sync'
import iconv from 'iconv-lite'
import {TableEngine} from '../src/main/table-engine'
import {operationRequest} from '../src/main/operation-schema'
import type {SqlProgress,TableConditionGroup} from '../src/shared/types'

// I0 · contrato tipado de operaciones y E1 · extracción no destructiva con el motor propio estricto.
// Los formatos hostiles se comparan con bytes que la propia prueba construye (oráculo independiente) y con csv-parse.
let folder:string
beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-ops-'))})
afterEach(async()=>{await rm(folder,{recursive:true,force:true})})

const uuid=()=>crypto.randomUUID()
const sha=(data:Buffer)=>createHash('sha256').update(data).digest('hex')
const quote=(value:string)=>/[",\r\n]/.test(value)?`"${value.replaceAll('"','""')}"`:value
const CITIES=['Oaxaca','Puebla','Mérida'],STATES=['entregado','pendiente'],NOTES=['','Primera línea\nSegunda línea','dice "hola"','a,b','  espacios  ']
interface Source {data:Buffer;records:{fields:string[];raw:Buffer}[];path:string}
// Registros con ceros a la izquierda, comillas, saltos de línea dentro de comillas y fin de línea mixto (CRLF y LF); el último puede ir sin salto final.
async function source(count:number,options:{encoding?:'utf8'|'utf16le'|'win1252';bom?:boolean;mixed?:boolean;finalEol?:boolean;name?:string}={}):Promise<Source>{
 const {encoding='utf8',bom=false,mixed=true,finalEol=true,name='ventas.csv'}=options
 const header=['id','ciudad','estado','nota','total']
 const lines=[header,...Array.from({length:count},(_,i)=>[String(i+1).padStart(6,'0'),CITIES[i%3],STATES[i%2],NOTES[i%5],`${i+1}.${String((i*7)%100).padStart(2,'0')}`])]
 const prefix=bom?(encoding==='utf16le'?Buffer.from([0xff,0xfe]):Buffer.from([0xef,0xbb,0xbf])):Buffer.alloc(0)
 const records=lines.map((fields,i)=>{
  const eol=i===lines.length-1&&!finalEol?'':(mixed&&i%3===1?'\n':'\r\n')
  return {fields,raw:iconv.encode(fields.map(quote).join(',')+eol,encoding)}
 })
 const data=Buffer.concat([prefix,...records.map(r=>r.raw)]),path=join(folder,name)
 await writeFile(path,data)
 return {data,records,path}
}
const where:TableConditionGroup={conditions:[{column:1,op:'equals',value:'Oaxaca'},{column:2,op:'equals',value:'entregado'}],filterMode:'all'}
const expectedMatches=(s:Source)=>s.records.slice(1).filter(r=>r.fields[1]==='Oaxaca'&&r.fields[2]==='entregado')
const engineFor=(events:SqlProgress[]=[],options:{extractBatch?:number;extractDelayMs?:number}={})=>new TableEngine(event=>events.push(event),{largeBytes:1,...options})

describe('contrato tipado de operaciones (I0)',()=>{
 const source={revision:0}
 it('acepta las tres operaciones de la lista cerrada',()=>{
  expect(operationRequest.safeParse({operation:'count',requestId:uuid(),source,conditions:where}).success).toBe(true)
  expect(operationRequest.safeParse({operation:'preview',requestId:uuid(),source,limit:20,columns:[0,2]}).success).toBe(true)
  expect(operationRequest.safeParse({operation:'filter_extract',requestId:uuid(),source,conditions:where,columns:[0,1,2]}).success).toBe(true)
 })
 it('rechaza lo que no está en la lista, los campos de más y los datos fuera de rango',()=>{
  const bad=(value:unknown)=>operationRequest.safeParse(value).success
  expect(bad({operation:'drop_table',requestId:uuid(),source})).toBe(false)               // operación fuera de la lista
  expect(bad({operation:'count',requestId:uuid(),source,sql:'select 1'})).toBe(false)       // nadie envía SQL ni campos desconocidos
  expect(bad({operation:'filter_extract',requestId:uuid(),source,output:'/tmp/x.csv'})).toBe(false) // la ruta de salida no la elige quien llama
  expect(bad({operation:'preview',requestId:uuid(),source,limit:0})).toBe(false)
  expect(bad({operation:'preview',requestId:uuid(),source,limit:101})).toBe(false)
  expect(bad({operation:'filter_extract',requestId:uuid(),source,columns:[]})).toBe(false)   // al menos una columna
  expect(bad({operation:'filter_extract',requestId:uuid(),source,columns:[1,1]})).toBe(false) // sin repetidas
  expect(bad({operation:'filter_extract',requestId:uuid(),source,columns:[-1]})).toBe(false)
  expect(bad({operation:'count',requestId:'no-es-uuid',source})).toBe(false)
  expect(bad({operation:'count',requestId:uuid(),source,conditions:{conditions:Array.from({length:21},()=>where.conditions[0]),filterMode:'all'}})).toBe(false)
 })
})

describe('vista previa y recuento sobre un archivo grande',()=>{
 it('la vista previa devuelve las primeras coincidencias, se detiene al encontrarlas y no escribe nada',async()=>{
  const s=await source(600),e=engineFor();await e.open('a',s.path)
  const before=(await readdir(folder)).sort()
  const result=await e.operation('a',{operation:'preview',requestId:uuid(),source:{revision:0},conditions:where,limit:5}) as {operation:'preview';rows:string[][];found:number;scanned:number;complete:boolean;headers:string[]}
  expect(result.headers).toEqual(['id','ciudad','estado','nota','total'])
  expect(result.rows).toEqual(expectedMatches(s).slice(0,5).map(r=>r.fields));expect(result.found).toBe(5);expect(result.complete).toBe(false)
  expect(result.scanned).toBeLessThan(600) // se detuvo
  expect((await readdir(folder)).sort()).toEqual(before)
 })
 it('el recuento coincide con csv-parse y con las filas del archivo',async()=>{
  const s=await source(600),e=engineFor();await e.open('a',s.path)
  const result=await e.operation('a',{operation:'count',requestId:uuid(),source:{revision:0},conditions:where})
  expect(result).toMatchObject({operation:'count',matched:expectedMatches(s).length,scanned:600})
 })
 it('proyecta columnas en la vista previa sin tocar el archivo',async()=>{
  const s=await source(50),e=engineFor();await e.open('a',s.path)
  const result=await e.operation('a',{operation:'preview',requestId:uuid(),source:{revision:0},columns:[2,0],limit:3}) as {headers:string[];rows:string[][]}
  expect(result.headers).toEqual(['estado','id']);expect(result.rows[0]).toEqual([s.records[1].fields[2],s.records[1].fields[0]])
 })
})

describe('extracción no destructiva (E1)',()=>{
 for(const [encoding,bom] of [['utf8',false],['utf8',true],['utf16le',true],['win1252',false]] as const){
  it(`${encoding}${bom?' con BOM':''}: fila completa conserva los bytes de cada registro, también con fin de línea mixto`,async()=>{
   const s=await source(400,{encoding,bom}),e=engineFor();await e.open('a',s.path);const original=sha(s.data)
   const output=join(folder,'extracto.csv')
   const result=await e.operation('a',{operation:'filter_extract',requestId:uuid(),source:{revision:0},conditions:where,output}) as {fidelity:string;matched:number;scanned:number;bytes:number;normalization:string[]}
   const prefix=bom?(encoding==='utf16le'?Buffer.from([0xff,0xfe]):Buffer.from([0xef,0xbb,0xbf])):Buffer.alloc(0)
   const expected=Buffer.concat([prefix,s.records[0].raw,...expectedMatches(s).map(r=>r.raw)])
   expect((await readFile(output)).equals(expected)).toBe(true) // bytes idénticos, registro a registro
   expect(result).toMatchObject({fidelity:'bytes',matched:expectedMatches(s).length,scanned:400,bytes:expected.length});expect(result.normalization).toEqual([])
   expect(sha(await readFile(s.path))).toBe(original) // el original no cambia
  })
 }
 it('si el último registro no termina en salto de línea y se extrae, queda igual que en el original',async()=>{
  const s=await source(5,{finalEol:false}),e=engineFor();await e.open('a',s.path)
  const output=join(folder,'ultimo.csv')
  const last=s.records.at(-1)!.fields
  await e.operation('a',{operation:'filter_extract',requestId:uuid(),source:{revision:0},conditions:{conditions:[{column:0,op:'equals',value:last[0]}],filterMode:'all'},output})
  expect((await readFile(output)).equals(Buffer.concat([s.records[0].raw,s.records.at(-1)!.raw]))).toBe(true)
 })
 it('con columnas elegidas conserva los valores exactos, normaliza el formato y lo dice',async()=>{
  const s=await source(400),e=engineFor();await e.open('a',s.path)
  const output=join(folder,'proyeccion.csv')
  const result=await e.operation('a',{operation:'filter_extract',requestId:uuid(),source:{revision:0},conditions:where,columns:[0,3,4],output}) as {fidelity:string;normalization:string[];matched:number}
  const rows=parse(await readFile(output,'utf8'),{relax_column_count:true,skip_empty_lines:false}) as string[][]
  expect(rows[0]).toEqual(['id','nota','total'])
  expect(rows.slice(1)).toEqual(expectedMatches(s).map(r=>[r.fields[0],r.fields[3],r.fields[4]])) // ceros a la izquierda, comillas y saltos de línea intactos
  expect(result.fidelity).toBe('values');expect(result.normalization.join(' ')).toMatch(/comillado/i);expect(result.normalization.join(' ')).toMatch(/fin de línea/i)
 })
 it('conserva la codificación de la fuente y el BOM también al proyectar columnas',async()=>{
  const s=await source(60,{encoding:'utf16le',bom:true}),e=engineFor();await e.open('a',s.path)
  const output=join(folder,'proyeccion16.csv')
  await e.operation('a',{operation:'filter_extract',requestId:uuid(),source:{revision:0},columns:[0,1],output})
  const data=await readFile(output);expect([...data.subarray(0,2)]).toEqual([0xff,0xfe])
  expect(iconv.decode(data,'utf16le').replace(/^﻿/,'').split(/\r?\n/)[1]).toBe('000001,Oaxaca')
 })
 it('el extracto cabe en los límites del editor: se abre como un documento normal y editable',async()=>{
  // El editor en memoria exige un fin de línea uniforme (comportamiento de siempre del analizador): por eso este fixture no lo mezcla.
  const s=await source(400,{mixed:false}),e=engineFor();await e.open('a',s.path)
  const output=join(folder,'editable.csv')
  await e.operation('a',{operation:'filter_extract',requestId:uuid(),source:{revision:0},conditions:where,output})
  const normal=new TableEngine(()=>{}) // sin forzar el modo grande: los límites reales (50 MiB y dos millones de celdas)
  const info=await normal.open('b',output)
  expect(info.readonly).toBe(false);expect(info.large).toBeFalsy();expect(info.rowCount).toBe(expectedMatches(s).length)
 })
 it('rechaza un destino igual al original y una revisión que ya no es la actual',async()=>{
  const s=await source(20),e=engineFor();await e.open('a',s.path)
  await expect(e.operation('a',{operation:'filter_extract',requestId:uuid(),source:{revision:0},output:s.path})).rejects.toThrow(/original/)
  await expect(e.operation('a',{operation:'count',requestId:uuid(),source:{revision:7}})).rejects.toThrow(/cambió/)
 })
 it('solo se ofrece para archivos grandes; una tabla en memoria sigue usando sus filtros',async()=>{
  const s=await source(20),e=new TableEngine(()=>{});await e.open('a',s.path)
  await expect(e.operation('a',{operation:'count',requestId:uuid(),source:{revision:0}})).rejects.toThrow(/archivos grandes/)
 })
})

describe('validación estricta',()=>{
 it('una comilla sin cerrar no se indexa como archivo grande ni se extrae: error con la posición y sin archivo de salida',async()=>{
  const path=join(folder,'rota.csv');await writeFile(path,'id,nota\r\n1,ok\r\n2,"sin cerrar\r\n3,fin\r\n')
  const e=engineFor()
  const info=await e.open('a',path)
  expect(info.large).toBeFalsy();expect(info.warning).toMatch(/comilla/i) // el índice ya no la acepta: vuelve a la muestra con el motivo
  await expect(e.operation('a',{operation:'count',requestId:uuid(),source:{revision:info.revision}})).rejects.toThrow()
  expect((await readdir(folder)).sort()).toEqual(['rota.csv'])
 })
 it('una fila corta se copia tal cual al extraer registros completos, y se informa',async()=>{
  const path=join(folder,'corta.csv');await writeFile(path,'id,a,b\r\n1,x,y\r\n2,x\r\n3,x,y\r\n')
  const e=engineFor();await e.open('a',path);const output=join(folder,'sal.csv')
  const result=await e.operation('a',{operation:'filter_extract',requestId:uuid(),source:{revision:0},output}) as {irregularRows:number}
  expect((await readFile(output,'utf8'))).toBe('id,a,b\r\n1,x,y\r\n2,x\r\n3,x,y\r\n');expect(result.irregularRows).toBe(1)
 })
 it('una fila corta sin la columna pedida detiene la proyección con la posición, sin rellenar',async()=>{
  const path=join(folder,'corta2.csv');await writeFile(path,'id,a,b\r\n1,x,y\r\n2,x\r\n')
  const e=engineFor();await e.open('a',path);const output=join(folder,'sal.csv')
  await expect(e.operation('a',{operation:'filter_extract',requestId:uuid(),source:{revision:0},columns:[0,2],output})).rejects.toThrow(/registro 3/i)
  await expect(stat(output)).rejects.toThrow()
 })
})

describe('progreso y cancelación',()=>{
 it('informa un progreso que solo crece y termina en 100 %',async()=>{
  const s=await source(900),events:SqlProgress[]=[],e=engineFor(events,{extractBatch:50});await e.open('a',s.path)
  const requestId=uuid();await e.operation('a',{operation:'filter_extract',requestId,source:{revision:0},conditions:where,output:join(folder,'p.csv')})
  const percent=events.filter(event=>event.requestId==='op:'+requestId).map(event=>event.rows)
  expect(percent.length).toBeGreaterThan(2);expect(percent).toEqual([...percent].sort((a,b)=>a-b));expect(percent.at(-1)).toBe(100)
 })
 it('cancelar a mitad no deja el archivo de salida ni temporales y el original sigue igual',async()=>{
  const s=await source(900),events:SqlProgress[]=[],requestId=uuid()
  const e=new TableEngine(event=>{events.push(event);if(event.requestId==='op:'+requestId&&event.rows>0&&event.rows<100)void e.cancelOperation(requestId)},{largeBytes:1,extractBatch:20,extractDelayMs:5})
  await e.open('a',s.path);const original=sha(s.data),output=join(folder,'cancelada.csv')
  await expect(e.operation('a',{operation:'filter_extract',requestId,source:{revision:0},conditions:where,output})).rejects.toThrow(/cancelad/i)
  expect((await readdir(folder)).sort()).toEqual(['ventas.csv']);expect(sha(await readFile(s.path))).toBe(original)
 })
 it('avisa antes de escribir si el destino no tiene espacio para el peor caso (el tamaño del original) y no deja nada',async()=>{
  const s=await source(900),free=new Map<string,number>([['poco',1024],['mucho',1e12]])
  const e=new TableEngine(()=>{},{largeBytes:1,freeBytes:async()=>free.get('poco')!});await e.open('a',s.path)
  await expect(e.operation('a',{operation:'filter_extract',requestId:uuid(),source:{revision:0},conditions:where,output:join(folder,'sin-espacio.csv')})).rejects.toThrow(/espacio/i)
  expect((await readdir(folder)).sort()).toEqual(['ventas.csv'])
  const ok=new TableEngine(()=>{},{largeBytes:1,freeBytes:async()=>free.get('mucho')!});await ok.open('b',s.path)
  expect((await ok.operation('b',{operation:'filter_extract',requestId:uuid(),source:{revision:0},conditions:where,output:join(folder,'con-espacio.csv')}) as {matched:number}).matched).toBe(expectedMatches(s).length)
 })
 it('reemplaza de forma atómica un destino que ya existía (el usuario lo confirmó en el cuadro de guardar)',async()=>{
  const s=await source(30),e=engineFor();await e.open('a',s.path);const output=join(folder,'previo.csv');await writeFile(output,'viejo')
  await e.operation('a',{operation:'filter_extract',requestId:uuid(),source:{revision:0},output})
  expect((await readFile(output)).equals(Buffer.concat(s.records.map(r=>r.raw)))).toBe(true);expect((await readdir(folder)).sort()).toEqual(['previo.csv','ventas.csv'])
 })
})
