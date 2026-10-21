import {createReadStream} from 'node:fs'
import {stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {Transform} from 'node:stream'
import {parse} from 'csv-parse'
import iconv from 'iconv-lite'
import {Table,vectorFromArray,Utf8,tableToIPC} from 'apache-arrow'
import {digest} from './files'
import type {Encoding} from '../shared/types'

export const ANALYSIS_LIMITS={bytes:256*1024*1024,rows:2_000_000,cells:8_000_000,columns:200,batchRows:1000,batchBytes:1024*1024}
export function validateUtf8(){const decoder=new TextDecoder('utf-8',{fatal:true});return new Transform({transform(chunk,_encoding,callback){try{decoder.decode(chunk,{stream:true});callback(null,chunk)}catch{callback(new Error('El archivo no es UTF-8 válido. Selecciona Windows-1252 para volver a abrirlo.'))}},flush(callback){try{decoder.decode();callback()}catch{callback(new Error('El archivo termina con una secuencia UTF-8 incompleta.'))}}})}

export async function* fileRecords(path:string,format:{encoding:Encoding;delimiter:string;header:boolean;headerWidth:number;headers:string[]},ensure:()=>void){
 const before=await stat(path);if(before.size>ANALYSIS_LIMITS.bytes)throw new Error('El análisis admite archivos de hasta 256 MiB por fuente.')
 const hash=createHash('sha256'),input=createReadStream(path,{highWaterMark:65536}),tap=new Transform({transform(chunk,_encoding,callback){hash.update(chunk);callback(null,chunk)}}),validator=format.encoding==='utf8'?validateUtf8():new Transform({transform(chunk,_encoding,callback){callback(null,chunk)}}),decoder=iconv.decodeStream(format.encoding),parser=parse({delimiter:format.delimiter,bom:true,relax_column_count:true,max_record_size:1024*1024})
 for(const stream of [input,tap,validator])stream.on('error',error=>parser.destroy(error))
 decoder.on('error',(error:Error)=>parser.destroy(error))
 input.pipe(tap).pipe(validator).pipe(decoder).pipe(parser)
 let first=true
 try{
  for await(const item of parser){ensure();const row=item as string[];if(first&&format.header){first=false;if(row.length!==format.headerWidth||row.some((v,i)=>v!==format.headers[i]))throw new Error('Los encabezados cambiaron en disco. Recarga el documento.');continue}first=false;yield row}
  ensure();const after=await stat(path);if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ino!==after.ino||hash.digest('hex')!==await digest(path))throw new Error('El archivo cambió durante el análisis. Vuelve a cargarlo.');ensure()
 }finally{input.unpipe(tap);tap.unpipe(validator);validator.unpipe(decoder);decoder.unpipe(parser);input.destroy();tap.destroy();validator.destroy();decoder.end();parser.destroy()}
}

export async function* arrowBatches(records:Iterable<string[]>|AsyncIterable<string[]>,width:number,ensure:()=>void){
 if(width<1||width>ANALYSIS_LIMITS.columns)throw new Error('El análisis admite entre 1 y 200 columnas por fuente.')
 let batch:string[][]=[],bytes=0,rows=0,totalBytes=0
 const encode=()=>Buffer.from(tableToIPC(new Table(Object.fromEntries(Array.from({length:width},(_,col)=>[`c${col+1}`,vectorFromArray(batch.map(row=>row[col]??null),new Utf8())]))),'stream'))
 for await(const row of records){
  ensure();rows++;if(row.length>width)throw new Error('Una fila tiene más columnas que la muestra. Recarga el archivo con una estructura consistente.')
  if(rows>ANALYSIS_LIMITS.rows||rows*width>ANALYSIS_LIMITS.cells)throw new Error('El análisis supera dos millones de filas u ocho millones de celdas por fuente.')
  const size=row.reduce((total,value)=>total+Buffer.byteLength(value,'utf8'),0);totalBytes+=size;if(totalBytes>ANALYSIS_LIMITS.bytes)throw new Error('La fuente supera 256 MiB de texto decodificado.');if(size>1024*1024)throw new Error('Un registro supera 1 MiB.')
  if(batch.length&&(batch.length>=ANALYSIS_LIMITS.batchRows||bytes+size>ANALYSIS_LIMITS.batchBytes)){ensure();yield {data:encode(),rows:batch.length};batch=[];bytes=0}
  batch.push(row);bytes+=size
 }
 ensure();if(batch.length)yield {data:encode(),rows:batch.length}
}
