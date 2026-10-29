// Lectura de CSV/TSV grandes por posición (L2 del RFC `docs/design/LARGE-FILE-EDITOR-RFC.md`): el archivo no se carga entero,
// se recorre una vez en flujo para guardar la posición de cada 1024.º registro y las páginas se leen saltando a esa posición.
import {open,stat} from 'node:fs/promises'
import iconv from 'iconv-lite'
import type {Encoding} from '../shared/types'

export const LARGE_CHUNK = 16 * 1024 * 1024
export const RECORD_DELIMITERS = ['\r\n','\n','\r']
// Un archivo que no se puede indexar de forma fiable: el motor vuelve a la muestra de siempre y dice dónde está el problema.
export class LargeFormatError extends Error {}
export class RecordTooLargeError extends LargeFormatError {
 constructor(readonly ordinal: number, readonly byte: number, limit: number) {
  super(`El registro ${(ordinal + 1).toLocaleString('es')} (desde el byte ${byte.toLocaleString('es')}) supera ${limit / 1024 / 1024} MiB: ¿hay una comilla sin cerrar? Así no se puede indexar el archivo.`)
 }
}
// Registro 1-based en el mensaje, como en RecordTooLargeError. Antes el índice daba por bueno un registro abierto hasta el final del archivo.
export class UnclosedQuoteError extends LargeFormatError {
 constructor(readonly ordinal: number, readonly byte: number) {
  super(`El registro ${(ordinal + 1).toLocaleString('es')} (desde el byte ${byte.toLocaleString('es')}) tiene una comilla sin cerrar hasta el final del archivo: no es un CSV válido y no se puede indexar.`)
 }
}
export class InvalidEncodingError extends LargeFormatError {}
export class OpenCancelled extends Error {}

export interface LargeIndex {
 path: string; size: number; encoding: Encoding;mtimeMs:number;ino:number;maxRecord:number
 unit: 1 | 2 // bytes por carácter de control: UTF-16 usa 2
 bomLength: number; every: number; records: number
 offsets: Float64Array // posición del registro 0, `every`, 2·`every`…
 width?:number
}
interface ScanState { inQuotes: boolean; cr?:number;delimiter?:number;columns?:number }
export async function indexUnchanged(index:LargeIndex){try{const current=await stat(index.path);return current.size===index.size&&current.mtimeMs===index.mtimeMs&&current.ino===index.ino}catch{return false}}

// Recorre `buffer[0..length)` y llama a `onRecord(fin)` en cada fin de registro: un salto de línea fuera de comillas. Las comillas escapadas ("") se compensan solas.
function scan(buffer: Buffer, length: number, base: number, state: ScanState, unit: 1 | 2, onRecord: (end: number) => void) {
 let inQuotes = state.inQuotes, cr = state.cr
 for(let i=0;i<length;i+=unit){
   const code=unit===2&&buffer[i+1]!==0?-1:buffer[i]
   if(cr!==undefined){const end=cr;cr=undefined;if(code===0x0a){onRecord(base+i+unit);continue}onRecord(end)}
   if (code === 0x22) inQuotes = !inQuotes
   else if(!inQuotes&&code===0x0d)cr=base+i+unit
   else if(!inQuotes&&code===0x0a)onRecord(base+i+unit)
   else if(!inQuotes&&code===state.delimiter)state.columns=(state.columns??1)+1
 }
 state.inQuotes = inQuotes
 state.cr = cr
}

export interface IndexOptions {
 encoding: Encoding; bomLength: number; maxRecord: number
 every?: number; chunk?: number
 delimiter?:string
 onProgress?: (fraction: number) => void
 cancelled?: () => boolean
}
export async function buildIndex(path: string, options: IndexOptions): Promise<LargeIndex> {
 const {encoding, bomLength, maxRecord, every = 1024, chunk = LARGE_CHUNK} = options, unit: 1 | 2 = encoding === 'utf16le' ? 2 : 1
 const handle = await open(path, 'r')
 try {
  const before=await handle.stat(),size=before.size,buffer=Buffer.allocUnsafe(chunk), offsets: number[] = []
  if (unit === 2 && (size - bomLength) % 2) throw new InvalidEncodingError(`El archivo UTF-16 tiene un número impar de bytes (${size.toLocaleString('es')}): la codificación está incompleta y no se puede indexar.`)
  const state: ScanState = {inQuotes: false,...(options.delimiter?{delimiter:options.delimiter.charCodeAt(0),columns:1}:{})}
  let position = bomLength, start = bomLength, records = 0,width=0
  const onRecord = (end: number) => {
   if (end - start > maxRecord) throw new RecordTooLargeError(records, start, maxRecord)
   if (records % every === 0) offsets.push(start)
   if(state.columns!==undefined){width=Math.max(width,state.columns);state.columns=1}
   records++; start = end
  }
  while (position < size) {
   if (options.cancelled?.()) throw new OpenCancelled('Apertura cancelada.')
   const {bytesRead} = await handle.read(buffer, 0, chunk, position); if (!bytesRead) break
   const usable = unit === 2 ? bytesRead - (bytesRead % 2) : bytesRead
   scan(buffer, usable, position, state, unit, onRecord); position += usable
   if (position - start > maxRecord) throw new RecordTooLargeError(records, start, maxRecord) // un registro que aún no termina
   options.onProgress?.(position / size)
   if (usable < bytesRead) break
  }
  if(state.cr!==undefined)onRecord(state.cr)
  if (state.inQuotes) throw new UnclosedQuoteError(records, start) // el último registro quedó abierto: antes se daba por bueno
  if (start < size) { if (records % every === 0) offsets.push(start); records++;if(state.columns!==undefined)width=Math.max(width,state.columns) } // último registro sin salto de línea
  const after=await handle.stat();if(after.size!==size||after.mtimeMs!==before.mtimeMs||after.ino!==before.ino)throw new LargeFormatError('El archivo cambió durante la indexación. Vuelve a abrirlo.')
  return {path, size, encoding, unit, bomLength, every, records, offsets: Float64Array.from(offsets),mtimeMs:before.mtimeMs,ino:before.ino,maxRecord,...(options.delimiter?{width}:{})}
 } finally { await handle.close() }
}

export interface RecordBatch { first: number; records: Buffer[]; position: number }
// Recorre el archivo entero en flujo y entrega los registros EXACTOS (bytes, con su fin de línea) en lotes. Es la base de la extracción:
// el mismo escáner que el índice, así que ambos delimitan igual los registros. Falla si el archivo termina con una comilla sin cerrar.
export async function* recordBatches(index: LargeIndex, options: {batchRecords?: number;batchBytes?:number; chunk?: number; cancelled?: () => boolean;from?:number;to?:number;first?:number} = {}): AsyncGenerator<RecordBatch> {
 const {batchRecords = 2000,batchBytes=Infinity,chunk = 4 * 1024 * 1024,from=index.bomLength,to=index.size,first:initial=0} = options
 const handle = await open(index.path, 'r')
 try {
  const state: ScanState = {inQuotes: false}
  let position = from, recordStart = position, ordinal = initial, first = initial, batch: Buffer[] = [], carry: Buffer[] = [],batchSize=0
  while (position < to) {
   if (options.cancelled?.()) throw new OpenCancelled('Operación cancelada.')
   const buffer = Buffer.allocUnsafe(Math.min(chunk,to-position)), {bytesRead} = await handle.read(buffer, 0, buffer.length, position); if (!bytesRead) break
   const usable = index.unit === 2 ? bytesRead - (bytesRead % 2) : bytesRead, ends: number[] = []
   scan(buffer, usable, position, state, index.unit, end => ends.push(end))
   let cursor = position
   for (const end of ends) {
    if(end-recordStart>index.maxRecord)throw new RecordTooLargeError(ordinal,recordStart,index.maxRecord)
    const part = buffer.subarray(cursor - position, end - position)
    const raw=carry.length?Buffer.concat([...carry,part]):part;batch.push(raw);batchSize+=raw.length;carry = []; cursor = end; recordStart = end; ordinal++
    if (batch.length >= batchRecords||batchSize>=batchBytes) { yield {first, records: batch, position: end}; first = ordinal; batch = [];batchSize=0 }
   }
   if (cursor < position + usable) carry.push(buffer.subarray(cursor - position, usable))
   position += usable
   if(position-recordStart>index.maxRecord)throw new RecordTooLargeError(ordinal,recordStart,index.maxRecord)
   if (!usable) break // UTF-16: un único byte suelto al final
  }
  if (state.inQuotes) throw new UnclosedQuoteError(ordinal, recordStart)
  if (carry.length) { batch.push(Buffer.concat(carry)); ordinal++ } // último registro sin salto de línea
  if (batch.length) yield {first, records: batch, position: to}
 } finally { await handle.close() }
}

// Posición [inicio, fin) de `count` registros desde el ordinal `from`, leyendo desde el punto de control anterior.
async function bounds(handle: Awaited<ReturnType<typeof open>>, index: LargeIndex, from: number, count: number): Promise<[number, number][]> {
 const k = Math.floor(from / index.every), skip = from - k * index.every, out: [number, number][] = [], buffer = Buffer.allocUnsafe(256 * 1024), state: ScanState = {inQuotes: false}
 let position = index.offsets[k], start = position, seen = 0
 const need = skip + count
 const onRecord = (end: number) => { if (seen >= skip && out.length < count) out.push([start, end]); seen++; start = end }
 while (seen < need && position < index.size) {
  const {bytesRead} = await handle.read(buffer, 0, buffer.length, position); if (!bytesRead) break
  const usable = index.unit === 2 ? bytesRead - (bytesRead % 2) : bytesRead
  scan(buffer, usable, position, state, index.unit, onRecord); position += usable
 }
 if(position>=index.size&&state.cr!==undefined)onRecord(state.cr)
 if (seen < need && start < index.size && out.length < count) out.push([start, index.size])
 return out.slice(0, count)
}

// The index already skips the file signature. A leading U+FEFF in a record is data.
export const decodeRecord = (bytes: Buffer, encoding: Encoding) => encoding === 'utf8' ? bytes.toString('utf8') : iconv.decode(bytes, encoding,{stripBOM:false})

// Texto de `count` registros desde `from` (sin su salto de línea final). Lee solo los bytes necesarios.
export async function readRecords(index: LargeIndex, from: number, count: number): Promise<string[]> {
 if (from < 0 || count < 1 || from >= index.records) return []
 const handle = await open(index.path, 'r')
 try {
  const limits = await bounds(handle, index, from, Math.min(count, index.records - from)); if (!limits.length) return []
  const first = limits[0][0], last = limits[limits.length - 1][1], bytes = Buffer.alloc(last - first)
  let read = 0; while (read < bytes.length) { const {bytesRead} = await handle.read(bytes, read, bytes.length - read, first + read); if (!bytesRead) break; read += bytesRead }
  return limits.map(([start, end]) => decodeRecord(bytes.subarray(start - first, end - first), index.encoding).replace(/(\r\n|\n|\r)$/, ''))
 } finally { await handle.close() }
}

// Campos de un registro. Tolerante: una comilla solo abre un campo al principio de este y lo que siga a la comilla de cierre se conserva.
export function splitFields(record: string, delimiter: string, through?:number): string[] {
 const fields: string[] = []; let i = 0
 while (true) {
  let value = ''
  if (record[i] === '"') {
   i++
   while (i < record.length) {
    const quote=record.indexOf('"',i)
    if(quote<0){value+=record.slice(i);i=record.length;break}
    value+=record.slice(i,quote)
    if(record[quote+1]==='"'){value+='"';i=quote+2;continue}
    i=quote+1;break
   }
   const next=record.indexOf(delimiter,i),end=next<0?record.length:next
   value+=record.slice(i,end);i=end
  } else { const from = i, next = record.indexOf(delimiter,i); i=next<0?record.length:next; value = record.slice(from, i) }
  fields.push(value)
  if(through!==undefined&&fields.length>through)break
  if (i >= record.length) break
  i++
  if (i === record.length) { fields.push(''); break } // delimitador final = campo vacío
 }
 return fields
}

// Read-only searches still reject invalid quote boundaries, including records discarded by a byte prefilter.
export function validateRecordQuotes(raw:Buffer,index:Pick<LargeIndex,'encoding'|'unit'>,delimiter:string){
 const bytes=index.unit===2?Buffer.from(decodeRecord(raw,index.encoding).replace(/(\r\n|\n|\r)$/,'')):raw
 let end=bytes.length
 if(bytes[end-1]===10){end--;if(bytes[end-1]===13)end--}else if(bytes[end-1]===13)end--
 let next=0
 while(true){
  const quote=bytes.indexOf(34,next);if(quote<0||quote>=end)return
  if(quote!==0&&bytes[quote-1]!==delimiter.charCodeAt(0))throw new Error('Comilla dentro de un campo sin entrecomillar.')
  let closing=quote
  while(true){closing=bytes.indexOf(34,closing+1);if(closing<0||closing>=end)throw new Error('Campo entrecomillado sin cerrar.');if(bytes[closing+1]===34){closing++;continue}break}
  if(closing+1!==end&&bytes[closing+1]!==delimiter.charCodeAt(0))throw new Error('Contenido después de una comilla de cierre.')
  next=closing+1
 }
}
