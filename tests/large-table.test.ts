import {describe,it,expect,beforeEach,afterEach} from 'vitest'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {parse} from 'csv-parse/sync'
import iconv from 'iconv-lite'
import {TableEngine,TABLE_LIMITS} from '../src/main/table-engine'
import {buildIndex,readRecords,splitFields,recordBatches,RecordTooLargeError,UnclosedQuoteError,InvalidEncodingError} from '../src/main/large-table'
import type {TableQuery} from '../src/shared/types'

// L2: lectura de archivos grandes por índice. Los formatos hostiles se comparan con csv-parse como oráculo independiente.
let folder:string
beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-large-'))})
afterEach(async()=>{await rm(folder,{recursive:true,force:true})})

// Ceros a la izquierda, ID de 17 dígitos, comillas escapadas, saltos de línea dentro de comillas, filas irregulares, vacíos y último registro sin salto de línea.
const rows=[['id','nombre','texto','nota'],['000123','Ana','dice "hola"','x'],['9007199254740993','José, el "grande"','línea 1\r\nlínea 2',''],['4','corto'],['5','','',' espacios '],['6','Zoë','a;b','fin']]
const eols=['\r\n','\n','\r\n','\n','\r\n']
const quote=(value:string)=>/[",\r\n]/.test(value)?`"${value.replaceAll('"','""')}"`:value
const build=(encoding:'utf8'|'utf16le'|'win1252',bom:boolean)=>{
 const text=rows.map((row,i)=>row.map(quote).join(',')+(i<rows.length-1?eols[i]:'')).join('')
 const prefix=bom?(encoding==='utf16le'?Buffer.from([0xff,0xfe]):Buffer.from([0xef,0xbb,0xbf])):Buffer.alloc(0)
 return Buffer.concat([prefix,iconv.encode(text,encoding)])
}
const variants=[['utf8',false],['utf8',true],['utf16le',true],['win1252',false]] as const
const oracle=(data:Buffer,encoding:string)=>parse(iconv.decode(data,encoding).replace(/^﻿/,''),{relax_column_count:true,skip_empty_lines:false,record_delimiter:['\r\n','\n']}) as string[][]
const query:TableQuery={offset:0,limit:1000,requestId:1}
const csv=(count:number)=>'id,nombre,importe\n'+Array.from({length:count},(_,i)=>`${String(i+1).padStart(6,'0')},"Cliente ${i+1}, S.A.",${(i*1.5).toFixed(2)}`).join('\n')+'\n'

describe('índice por posición',()=>{
 for(const [encoding,bom] of variants){
  it(`${encoding}${bom?' con BOM':''}: cuenta los registros y lee cada uno igual que el analizador independiente`,async()=>{
   const data=build(encoding,bom),path=join(folder,'datos.csv');await writeFile(path,data)
   const expected=oracle(data,encoding)
   const index=await buildIndex(path,{encoding,bomLength:bom?(encoding==='utf16le'?2:3):0,maxRecord:TABLE_LIMITS.record,every:2,chunk:6})
   expect(index.records).toBe(expected.length)
   const texts=await readRecords(index,0,100)
   expect(texts.map(text=>splitFields(text,','))).toEqual(expected)
   expect(await readRecords(index,3,2)).toEqual(texts.slice(3,5)) // desde un punto de control y desde en medio
  })
 }
 it('un registro de más de 1 MiB (comilla sin cerrar) falla con su posición',async()=>{
  const path=join(folder,'comilla.csv');await writeFile(path,'a,b\n1,2\n3,"'+'x'.repeat(2*1024*1024))
  const error=await buildIndex(path,{encoding:'utf8',bomLength:0,maxRecord:TABLE_LIMITS.record}).catch(e=>e)
  expect(error).toBeInstanceOf(RecordTooLargeError);expect(error.ordinal).toBe(2);expect(error.message).toContain('El registro 3')
 })
 it('una comilla sin cerrar hasta el final del archivo falla con su posición en lugar de indexarse',async()=>{
  const path=join(folder,'abierta.csv');await writeFile(path,'a,b\r\n1,2\r\n3,"sin cerrar\r\n4,5\r\n')
  const error=await buildIndex(path,{encoding:'utf8',bomLength:0,maxRecord:TABLE_LIMITS.record}).catch(e=>e)
  expect(error).toBeInstanceOf(UnclosedQuoteError);expect(error.ordinal).toBe(2);expect(error.message).toContain('El registro 3');expect(error.message).toContain('comilla sin cerrar')
 })
 it('un archivo UTF-16 con un byte de más no se indexa',async()=>{
  const path=join(folder,'impar.csv');await writeFile(path,Buffer.concat([Buffer.from([0xff,0xfe]),iconv.encode('a,b\r\n1,2\r\n','utf16le'),Buffer.from([0])]))
  await expect(buildIndex(path,{encoding:'utf16le',bomLength:2,maxRecord:TABLE_LIMITS.record})).rejects.toBeInstanceOf(InvalidEncodingError)
 })
 for(const [encoding,bom] of variants){
  it(`${encoding}${bom?' con BOM':''}: los lotes entregan los bytes exactos de cada registro, con su fin de línea, y coinciden con el índice`,async()=>{
   const data=build(encoding,bom),path=join(folder,'lotes.csv');await writeFile(path,data)
   const index=await buildIndex(path,{encoding,bomLength:bom?(encoding==='utf16le'?2:3):0,maxRecord:TABLE_LIMITS.record,every:2,chunk:6})
   const records:Buffer[]=[];let expectedFirst=0
   for await(const batch of recordBatches(index,{batchRecords:2,chunk:5})){expect(batch.first).toBe(expectedFirst);expectedFirst+=batch.records.length;records.push(...batch.records)}
   expect(records.length).toBe(index.records)
   expect(Buffer.concat(records).equals(data.subarray(bom?(encoding==='utf16le'?2:3):0))).toBe(true) // ni un byte de más ni de menos
  })
 }
 it('la cancelación detiene el recorrido entre bloques',async()=>{
  const path=join(folder,'grande.csv');await writeFile(path,csv(2000));let calls=0
  await expect(buildIndex(path,{encoding:'utf8',bomLength:0,maxRecord:TABLE_LIMITS.record,chunk:1024,cancelled:()=>++calls>3})).rejects.toThrow('cancelada')
 })
})

describe('motor de tablas en modo grande',()=>{
 const engine=()=>new TableEngine(()=>{},{largeBytes:1024})
 it('un CSV por encima del umbral se abre en solo lectura con el recuento exacto y páginas por posición',async()=>{
  const path=join(folder,'ventas.csv');await writeFile(path,csv(5000));const e=engine()
  const info=await e.open('a',path)
  expect(info).toMatchObject({readonly:true,large:true,rowCount:5000,headers:['id','nombre','importe']});expect(info.warning).toContain('Archivo grande')
  const last=await e.page('a',{...query,offset:4990,limit:200})
  expect(last).toMatchObject({total:5000,matched:5000,sample:false,large:true});expect(last.rows).toHaveLength(10)
  expect(last.rows[0]).toEqual({id:'4991',cells:['004991','Cliente 4991, S.A.','7485.00']});expect(last.rows.at(-1)?.cells[0]).toBe('005000')
  expect((await e.page('a',{...query,offset:2500,limit:3})).rows.map(row=>row.cells[0])).toEqual(['002501','002502','002503'])
  expect((await e.page('a',{...query,offset:5000,limit:50})).rows).toEqual([])
 })
 for(const [encoding,bom] of variants){
  it(`${encoding}${bom?' con BOM':''}: las páginas coinciden con el analizador independiente`,async()=>{
   const data=build(encoding,bom),path=join(folder,'hostil.csv');await writeFile(path,data)
   const e=new TableEngine(()=>{},{largeBytes:1}),info=await e.open('a',path,{encoding,delimiter:','})
   const expected=oracle(data,encoding);expect(info.rowCount).toBe(expected.length-1);expect(info.headers).toEqual(expected[0])
   const page=await e.page('a',query);expect(page.rows.map(row=>row.cells)).toEqual(expected.slice(1))
   expect(page.rows[0].cells[0]).toBe('000123');expect(page.rows[1].cells[0]).toBe('9007199254740993') // nunca se interpretan como números
  })
 }
 it('la consulta vacía que envía la interfaz se acepta; búsqueda, filtros y orden se rechazan con un mensaje claro',async()=>{
  const path=join(folder,'ventas.csv');await writeFile(path,csv(300));const e=engine();await e.open('a',path)
  await expect(e.page('a',{...query,filters:{},conditions:[],order:undefined,sort:undefined,search:''})).resolves.toMatchObject({matched:300})
  for(const extra of [{search:'cliente'},{filters:{'1':'x'}},{sort:{column:0,descending:false,numeric:false}},{conditions:[{column:0,op:'contains' as const,value:'1'}]}])
   await expect(e.page('a',{...query,...extra})).rejects.toThrow('archivos grandes')
 })
 it('lo que necesita toda la tabla en memoria o cambiaría datos se rechaza sin tocar nada; el análisis SQL lee el archivo íntegro',async()=>{
  const path=join(folder,'ventas.csv');await writeFile(path,csv(300));const e=engine();await e.open('a',path)
  await expect(e.edit('a',{type:'cell',rowId:'1',column:0,value:'x'})).rejects.toThrow('archivos grandes')
  await expect(e.serialize('a')).rejects.toThrow('archivos grandes')
  await expect(e.stats('a',['1'],[0])).rejects.toThrow('archivos grandes')
  await expect(e.analyzeColumn('a',{column:0,revision:0,requestId:'r',frequencyOffset:0,duplicatesOnly:false,bins:10})).rejects.toThrow('archivos grandes')
  const started=await e.analysisStart('a','ticket',0,path);expect(started).toMatchObject({readonly:true,headers:['id','nombre','importe']});let count=0;while(true){const chunk=await e.analysisNext('ticket');if(chunk.done)break;count+=chunk.rows};expect(count).toBe(300)
  expect(await e.info('a')).toMatchObject({readonly:true,large:true,dirty:false})
 })
 it('un registro de más de 1 MiB deja la muestra de siempre y dice dónde está el problema',async()=>{
  const path=join(folder,'comilla.csv');await writeFile(path,'a,b\n1,2\n3,"'+'x'.repeat(2*1024*1024));const e=engine()
  const info=await e.open('a',path);expect(info.readonly).toBe(true);expect(info.large).toBeFalsy()
  expect(info.warning).toContain('El registro 3');expect(info.warning).toContain('Muestra limitada')
  expect((await e.page('a',query)).sample).toBe(true)
 })
 it('cambiar el separador vuelve a indexar el archivo',async()=>{
  const path=join(folder,'puntoycoma.csv');await writeFile(path,'a;b;c\n'+Array.from({length:200},(_,i)=>`${i};x;y`).join('\n')+'\n');const e=engine()
  expect((await e.open('a',path,{delimiter:','})).headers).toEqual(['a;b;c']);expect((await e.open('a',path,{delimiter:';'})).headers).toEqual(['a','b','c'])
  expect((await e.page('a',{...query,limit:2})).rows.map(row=>row.cells)).toEqual([['0','x','y'],['1','x','y']])
 })
 it('sin encabezado, la primera fila es un dato',async()=>{
  const path=join(folder,'sinencabezado.csv');await writeFile(path,'1,2\n3,4\n'+'5,6\n'.repeat(300));const e=engine()
  const info=await e.open('a',path,{header:false});expect(info).toMatchObject({rowCount:302,headers:['Columna 1','Columna 2']})
  expect((await e.page('a',{...query,limit:1})).rows[0].cells).toEqual(['1','2'])
 })
 it('informa del progreso y se puede cancelar a mitad de la apertura',async()=>{
  const path=join(folder,'grande.csv');await writeFile(path,csv(4000));const events:string[]=[]
  const e:TableEngine=new TableEngine(event=>{events.push(event.phase);if(event.requestId==='open:a')void e.cancelOpen('a')},{largeBytes:1024,indexChunk:2048})
  await expect(e.open('a',path)).rejects.toThrow('cancelada');expect(events.some(phase=>/Indexando archivo grande/.test(phase))).toBe(true)
  await expect(e.info('a')).rejects.toThrow('ya no está abierta')
 })
 it('sin la opción, un CSV pequeño sigue en memoria y se puede editar',async()=>{
  const path=join(folder,'pequeno.csv');await writeFile(path,csv(50));const e=new TableEngine(()=>{});const info=await e.open('a',path)
  expect(info.readonly).toBe(false);expect(info.large).toBeFalsy()
  await e.edit('a',{type:'cell',rowId:'1',column:1,value:'editado'});expect((await e.page('a',query)).rows[0].cells[1]).toBe('editado')
 })
})
