// Índice disperso de registros de un CSV/TSV por posición en bytes. Experimento, no producto.
// Un registro termina en un salto de línea (LF; el CR de un CRLF queda dentro del registro, o CR solo si el archivo no tiene LF)
// fuera de comillas. Las comillas dobles escapadas ("") se compensan solas al alternar el estado. UTF-16LE usa unidades de 2 bytes.
import {open} from 'node:fs/promises'
export const BOMS={utf8:Buffer.from([0xEF,0xBB,0xBF]),utf16le:Buffer.from([0xFF,0xFE]),win1252:Buffer.alloc(0)}
const CHUNK=16*1024*1024

// Recorre `buffer` y llama a `onRecord(endOffsetExclusive)` en cada fin de registro. Devuelve el estado para continuar con el siguiente trozo.
export function scan(buffer,length,base,state,{unit,eol},onRecord){
 let {inQuotes}=state
 if(unit===2){
  for(let i=0;i+1<length;i+=2){const lo=buffer[i],hi=buffer[i+1];if(hi!==0)continue
   if(lo===0x22)inQuotes=!inQuotes;else if(!inQuotes&&lo===(eol==='cr'?0x0D:0x0A))onRecord(base+i+2)}
 }else{
  const terminator=eol==='cr'?0x0D:0x0A
  for(let i=0;i<length;i++){const byte=buffer[i];if(byte===0x22)inQuotes=!inQuotes;else if(byte===terminator&&!inQuotes)onRecord(base+i+1)}
 }
 return {inQuotes}
}

export async function detect(handle,size,encodingHint){
 const head=Buffer.alloc(Math.min(size,65536));await handle.read(head,0,head.length,0)
 let encoding=encodingHint,bomLength=0
 if(head.subarray(0,3).equals(BOMS.utf8)){encoding='utf8';bomLength=3}else if(head.subarray(0,2).equals(BOMS.utf16le)){encoding='utf16le';bomLength=2}
 encoding??='utf8'
 const unit=encoding==='utf16le'?2:1
 const hasLF=unit===2?head.includes(Buffer.from([0x0A,0x00])):head.includes(0x0A)
 return {encoding,bomLength,unit,eol:hasLF?'lf':'cr'}
}

// Construye el índice: guarda el desplazamiento del registro 0, `every`, 2·`every`… (el registro 0 es la cabecera si la hay).
export async function buildIndex(path,{encoding:hint,every=1024,onProgress,signal,chunk=CHUNK}={}){
 const handle=await open(path,'r');try{
  const size=(await handle.stat()).size,meta=await detect(handle,size,hint),offsets=[],buffer=Buffer.allocUnsafe(chunk)
  let position=meta.bomLength,records=0,start=meta.bomLength,state={inQuotes:false},carry=0
  const onRecord=end=>{if(records%every===0)offsets.push(start);records++;start=end}
  while(position<size){
   if(signal?.aborted)throw new Error('Indexado cancelado.')
   const {bytesRead}=await handle.read(buffer,0,chunk,position);if(!bytesRead)break
   const usable=meta.unit===2?bytesRead-(bytesRead%2):bytesRead
   state=scan(buffer,usable,position,state,meta,onRecord);position+=usable;if(usable<bytesRead)break
   onProgress?.(position/size)
  }
  if(start<size){if(records%every===0)offsets.push(start);records++} // último registro sin salto de línea
  return {path,size,...meta,every,records,offsets:Float64Array.from(offsets),finalEol:start>=size}
 }finally{await handle.close()}
}

// Devuelve los límites [inicio, fin) de `count` registros desde el ordinal `from`, leyendo solo lo necesario.
export async function recordBounds(handle,index,from,count,bufferSize=256*1024){
 if(from>=index.records)return []
 const k=Math.floor(from/index.every),skip=from-k*index.every,out=[],buffer=Buffer.allocUnsafe(bufferSize)
 let position=index.offsets[k],start=position,seen=0,state={inQuotes:false}
 const need=skip+count
 const onRecord=end=>{if(seen>=skip&&out.length<count)out.push([start,end]);seen++;start=end}
 while(seen<need&&position<index.size){
  const {bytesRead}=await handle.read(buffer,0,buffer.length,position);if(!bytesRead)break
  const usable=index.unit===2?bytesRead-(bytesRead%2):bytesRead
  state=scan(buffer,usable,position,state,index,onRecord);position+=usable
 }
 if(seen<need&&start<index.size&&out.length<count)out.push([start,index.size])
 return out.slice(0,count)
}

// Recorre el archivo entero en flujo y llama a `onRecord(buffer, ordinal)` por registro (memoria acotada).
export async function eachRecord(path,onRecord,{encoding:hint,chunk=CHUNK,signal}={}){
 const handle=await open(path,'r');try{
  const size=(await handle.stat()).size,meta=await detect(handle,size,hint),buffer=Buffer.allocUnsafe(chunk)
  let position=meta.bomLength,carry=Buffer.alloc(0),state={inQuotes:false},ordinal=0
  while(position<size){
   if(signal?.aborted)throw new Error('Recorrido cancelado.')
   const {bytesRead}=await handle.read(buffer,0,chunk,position);if(!bytesRead)break
   const usable=meta.unit===2?bytesRead-(bytesRead%2):bytesRead,buf=carry.length?Buffer.concat([carry,buffer.subarray(0,usable)]):buffer.subarray(0,usable),ends=[]
   state=scan(buf.subarray(carry.length),usable,carry.length,state,meta,end=>ends.push(end))
   let start=0;for(const end of ends){onRecord(buf.subarray(start,end),ordinal++);start=end}
   carry=Buffer.from(buf.subarray(start));position+=usable
  }
  if(carry.length)onRecord(carry,ordinal++)
  return ordinal
 }finally{await handle.close()}
}
