// Lectura de CSV/TSV grandes por posición (L2 del RFC `docs/design/LARGE-FILE-EDITOR-RFC.md`): el archivo no se carga entero,
// se recorre una vez en flujo para guardar la posición de cada 1024.º registro y las páginas se leen saltando a esa posición.
import {open} from 'node:fs/promises'
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
 path: string; size: number; encoding: Encoding
 unit: 1 | 2 // bytes por carácter de control: UTF-16 usa 2
 bomLength: number; every: number; records: number
 offsets: Float64Array // posición del registro 0, `every`, 2·`every`…
}
interface ScanState { inQuotes: boolean; cr?:number }

// Recorre `buffer[0..length)` y llama a `onRecord(fin)` en cada fin de registro: un salto de línea fuera de comillas. Las comillas escapadas ("") se compensan solas.
function scan(buffer: Buffer, length: number, base: number, state: ScanState, unit: 1 | 2, onRecord: (end: number) => void) {
 let inQuotes = state.inQuotes, cr = state.cr
 for(let i=0;i<length;i+=unit){
   const code=unit===2&&buffer[i+1]!==0?-1:buffer[i]
   if(cr!==undefined){const end=cr;cr=undefined;if(code===0x0a){onRecord(base+i+unit);continue}onRecord(end)}
   if (code === 0x22) inQuotes = !inQuotes
   else if(!inQuotes&&code===0x0d)cr=base+i+unit
   else if(!inQuotes&&code===0x0a)onRecord(base+i+unit)
 }
 state.inQuotes = inQuotes
 state.cr = cr
}

export interface IndexOptions {
 encoding: Encoding; bomLength: number; maxRecord: number
 every?: number; chunk?: number
 onProgress?: (fraction: number) => void
 cancelled?: () => boolean
}
export async function buildIndex(path: string, options: IndexOptions): Promise<LargeIndex> {
 const {encoding, bomLength, maxRecord, every = 1024, chunk = LARGE_CHUNK} = options, unit: 1 | 2 = encoding === 'utf16le' ? 2 : 1
 const handle = await open(path, 'r')
 try {
  const size = (await handle.stat()).size, buffer = Buffer.allocUnsafe(chunk), offsets: number[] = []
  if (unit === 2 && (size - bomLength) % 2) throw new InvalidEncodingError(`El archivo UTF-16 tiene un número impar de bytes (${size.toLocaleString('es')}): la codificación está incompleta y no se puede indexar.`)
  const state: ScanState = {inQuotes: false}
  let position = bomLength, start = bomLength, records = 0
  const onRecord = (end: number) => {
   if (end - start > maxRecord) throw new RecordTooLargeError(records, start, maxRecord)
   if (records % every === 0) offsets.push(start)
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
  if (start < size) { if (records % every === 0) offsets.push(start); records++ } // último registro sin salto de línea
  return {path, size, encoding, unit, bomLength, every, records, offsets: Float64Array.from(offsets)}
 } finally { await handle.close() }
}

export interface RecordBatch { first: number; records: Buffer[]; position: number }
// Recorre el archivo entero en flujo y entrega los registros EXACTOS (bytes, con su fin de línea) en lotes. Es la base de la extracción:
// el mismo escáner que el índice, así que ambos delimitan igual los registros. Falla si el archivo termina con una comilla sin cerrar.
export async function* recordBatches(index: LargeIndex, options: {batchRecords?: number; chunk?: number; cancelled?: () => boolean} = {}): AsyncGenerator<RecordBatch> {
 const {batchRecords = 2000, chunk = 4 * 1024 * 1024} = options
 const handle = await open(index.path, 'r')
 try {
  const state: ScanState = {inQuotes: false}
  let position = index.bomLength, recordStart = position, ordinal = 0, first = 0, batch: Buffer[] = [], carry: Buffer[] = []
  while (position < index.size) {
   if (options.cancelled?.()) throw new OpenCancelled('Operación cancelada.')
   const buffer = Buffer.allocUnsafe(chunk), {bytesRead} = await handle.read(buffer, 0, chunk, position); if (!bytesRead) break
   const usable = index.unit === 2 ? bytesRead - (bytesRead % 2) : bytesRead, ends: number[] = []
   scan(buffer, usable, position, state, index.unit, end => ends.push(end))
   let cursor = position
   for (const end of ends) {
    const part = buffer.subarray(cursor - position, end - position)
    batch.push(carry.length ? Buffer.concat([...carry, part]) : part); carry = []; cursor = end; recordStart = end; ordinal++
    if (batch.length >= batchRecords) { yield {first, records: batch, position: end}; first = ordinal; batch = [] }
   }
   if (cursor < position + usable) carry.push(buffer.subarray(cursor - position, usable))
   position += usable
   if (!usable) break // UTF-16: un único byte suelto al final
  }
  if (state.inQuotes) throw new UnclosedQuoteError(ordinal, recordStart)
  if (carry.length) { batch.push(Buffer.concat(carry)); ordinal++ } // último registro sin salto de línea
  if (batch.length) yield {first, records: batch, position: index.size}
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

const decode = (bytes: Buffer, encoding: Encoding) => encoding === 'utf8' ? bytes.toString('utf8') : iconv.decode(bytes, encoding)

// Texto de `count` registros desde `from` (sin su salto de línea final). Lee solo los bytes necesarios.
export async function readRecords(index: LargeIndex, from: number, count: number): Promise<string[]> {
 if (from < 0 || count < 1 || from >= index.records) return []
 const handle = await open(index.path, 'r')
 try {
  const limits = await bounds(handle, index, from, Math.min(count, index.records - from)); if (!limits.length) return []
  const first = limits[0][0], last = limits[limits.length - 1][1], bytes = Buffer.alloc(last - first)
  let read = 0; while (read < bytes.length) { const {bytesRead} = await handle.read(bytes, read, bytes.length - read, first + read); if (!bytesRead) break; read += bytesRead }
  return limits.map(([start, end]) => decode(bytes.subarray(start - first, end - first), index.encoding).replace(/(\r\n|\n|\r)$/, ''))
 } finally { await handle.close() }
}

// Campos de un registro. Tolerante: una comilla solo abre un campo al principio de este y lo que siga a la comilla de cierre se conserva.
export function splitFields(record: string, delimiter: string): string[] {
 const fields: string[] = []; let i = 0
 while (true) {
  let value = ''
  if (record[i] === '"') {
   i++
   while (i < record.length) { if (record[i] === '"') { if (record[i + 1] === '"') { value += '"'; i += 2; continue } i++; break } value += record[i++] }
   while (i < record.length && record[i] !== delimiter) value += record[i++]
  } else { const from = i; while (i < record.length && record[i] !== delimiter) i++; value = record.slice(from, i) }
  fields.push(value)
  if (i >= record.length) break
  i++
  if (i === record.length) { fields.push(''); break } // delimitador final = campo vacío
 }
 return fields
}
