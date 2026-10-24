// Lectura de CSV/TSV grandes por posición (L2 del RFC `docs/design/LARGE-FILE-EDITOR-RFC.md`): el archivo no se carga entero,
// se recorre una vez en flujo para guardar la posición de cada 1024.º registro y las páginas se leen saltando a esa posición.
import {open} from 'node:fs/promises'
import iconv from 'iconv-lite'
import type {Encoding} from '../shared/types'

export const LARGE_CHUNK = 16 * 1024 * 1024
export class RecordTooLargeError extends Error {
 constructor(readonly ordinal: number, readonly byte: number, limit: number) {
  super(`El registro ${(ordinal + 1).toLocaleString('es')} (desde el byte ${byte.toLocaleString('es')}) supera ${limit / 1024 / 1024} MiB: ¿hay una comilla sin cerrar? Así no se puede indexar el archivo.`)
 }
}
export class OpenCancelled extends Error {}

export interface LargeIndex {
 path: string; size: number; encoding: Encoding
 unit: 1 | 2 // bytes por carácter de control: UTF-16 usa 2
 terminator: number // 0x0A, o 0x0D si el archivo no tiene ningún salto de línea LF en sus primeros 64 KiB
 bomLength: number; every: number; records: number
 offsets: Float64Array // posición del registro 0, `every`, 2·`every`…
}
interface ScanState { inQuotes: boolean }

// Recorre `buffer[0..length)` y llama a `onRecord(fin)` en cada fin de registro: un salto de línea fuera de comillas. Las comillas escapadas ("") se compensan solas.
function scan(buffer: Buffer, length: number, base: number, state: ScanState, unit: 1 | 2, terminator: number, onRecord: (end: number) => void) {
 let inQuotes = state.inQuotes
 if (unit === 2) {
  for (let i = 0; i + 1 < length; i += 2) {
   if (buffer[i + 1] !== 0) continue
   const code = buffer[i]
   if (code === 0x22) inQuotes = !inQuotes
   else if (!inQuotes && code === terminator) onRecord(base + i + 2)
  }
 } else {
  for (let i = 0; i < length; i++) {
   const code = buffer[i]
   if (code === 0x22) inQuotes = !inQuotes
   else if (code === terminator && !inQuotes) onRecord(base + i + 1)
  }
 }
 state.inQuotes = inQuotes
}

async function terminatorOf(handle: Awaited<ReturnType<typeof open>>, size: number, unit: 1 | 2, from: number) {
 const head = Buffer.alloc(Math.min(Math.max(size - from, 0), 65536)); await handle.read(head, 0, head.length, from)
 const hasLf = unit === 2 ? head.includes(Buffer.from([0x0a, 0x00])) : head.includes(0x0a)
 return hasLf ? 0x0a : 0x0d
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
  const size = (await handle.stat()).size, terminator = await terminatorOf(handle, size, unit, bomLength), buffer = Buffer.allocUnsafe(chunk), offsets: number[] = []
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
   scan(buffer, usable, position, state, unit, terminator, onRecord); position += usable
   if (position - start > maxRecord) throw new RecordTooLargeError(records, start, maxRecord) // un registro que aún no termina
   options.onProgress?.(position / size)
   if (usable < bytesRead) break
  }
  if (start < size) { if (records % every === 0) offsets.push(start); records++ } // último registro sin salto de línea
  return {path, size, encoding, unit, terminator, bomLength, every, records, offsets: Float64Array.from(offsets)}
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
  scan(buffer, usable, position, state, index.unit, index.terminator, onRecord); position += usable
 }
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
