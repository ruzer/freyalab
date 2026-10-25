import { createReadStream } from 'node:fs'
import {randomUUID} from 'node:crypto'
import { Transform } from 'node:stream'
import { open as openFile, stat, realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setImmediate as yieldTurn } from 'node:timers/promises'
import { parse } from 'csv-parse'
import { parse as parseSync } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import iconv from 'iconv-lite'
import {ANALYSIS_LIMITS,arrowBatches,fileRecords,validateUtf8} from './analysis-source'
import {compileTableQuery} from './table-query'
import {buildIndex,readRecords,splitFields,LargeFormatError,type LargeIndex} from './large-table'
import {runOperation,OperationCancelled} from './operations'
import type {EngineOperation,OperationResult} from '../shared/operations'
import {analyzeColumn,numeric,descriptive} from './table-analysis'
import type {ColumnAnalysisRequest,ColumnAnalysis,TableTransformEdit,TableTransformPreview,SqlProgress} from '../shared/types'
import type { Encoding, TableEdit, TableExport, TableOptions, TablePage, TableQuery, TableConditionGroup, TableRow, TableStats, TableRange, TableRangeEdit, TableRangePreview,TableStatsOptions } from '../shared/types'

export const TABLE_LIMITS = { bytes: 50 * 1024 * 1024, cells: 2_000_000, record: 1024 * 1024, sampleBytes: 8 * 1024 * 1024, sampleRows: 200 }
interface Metadata { encoding: Encoding; delimiter: string; eol: string; bom: boolean; header: boolean; finalEol: boolean; headerWidth: number }
interface State extends Metadata { rows: TableRow[]; headers: string[]; readonly: boolean; warning?: string; revision: number; nextId: number; token: number; savedToken: number; history: Change[]; future: Change[]; large?: {index:LargeIndex;rowCount:number} }
type Mutation = {type:'rowOrder'|'columnOrder';order:number[]} | { type: 'cell'; id: string; column: number; value: string; length?:number } | { type: 'header'; column: number; value: string; headerWidth?:number } | { type: 'rows'; index: number; remove: number; rows: TableRow[] } | { type: 'column'; index: number; remove: boolean; name: string; cells: string[]; headerWidth?:number; lengths?:number[] }
interface Change { forward: Mutation[]; backward: Mutation[]; before: number; after: number; bytes:number }
class LimitError extends Error {}
function validDelimiter(value: string) { if (![',', ';', '\t', '|'].includes(value)) throw new Error('Delimitador no válido.'); return value }
function detectEncoding(bytes: Buffer): Encoding {
 if(bytes[0]===0xff&&bytes[1]===0xfe)return 'utf16le'
 try { new TextDecoder('utf-8',{fatal:true}).decode(bytes,{stream:true}); return 'utf8' } catch { return 'win1252' }
}
function metadata(bytes: Buffer, options: TableOptions, path = ''): Metadata {
 const encoding = options.encoding ?? detectEncoding(bytes)
 const text = iconv.decode(bytes, encoding)
 const counts = [',', ';', '\t', '|'].map(delimiter => {
  try { const first = parseSync(text, {delimiter, bom:true, to:1, relax_column_count:true}) as string[][]; return {delimiter,count:(first[0]?.length??1)-1} }
  catch { return {delimiter,count:0} }
 })
 counts.sort((a,b) => b.count-a.count)
 const delimiter = validDelimiter(options.delimiter ?? (path.endsWith('.tsv') ? '\t' : (counts[0].count ? counts[0].delimiter : ',')))
 const eol = text.match(/\r\n|\n|\r/)?.[0] ?? '\n'
 const bom = encoding === 'utf8' ? bytes.subarray(0, 3).equals(Buffer.from([0xef,0xbb,0xbf])) : encoding === 'utf16le' && bytes[0] === 0xff && bytes[1] === 0xfe
 return { encoding, delimiter, eol, bom, header: options.header ?? true, finalEol:/[\r\n]$/.test(text), headerWidth:0 }
}
async function prefix(path: string, max: number): Promise<Buffer> {
 const handle = await openFile(path, 'r')
 try { const result = Buffer.alloc(Math.min((await handle.stat()).size, max)); let offset = 0; while (offset < result.length) { const read = await handle.read(result, offset, result.length-offset, offset); if (!read.bytesRead) break; offset += read.bytesRead } return result.subarray(0, offset) } finally { await handle.close() }
}
async function endsWithEol(path:string,bytes:number,encoding:Encoding){const handle=await openFile(path,'r');try{const tail=Buffer.alloc(Math.min(bytes,4));await handle.read(tail,0,tail.length,Math.max(0,bytes-tail.length));return /[\r\n]$/.test(iconv.decode(tail,encoding))}finally{await handle.close()}}
function copyRow(row: TableRow): TableRow { return { id: row.id, cells: [...row.cells] } }
function permutation(order:number[],size:number){if(!Array.isArray(order)||order.length!==size||new Set(order).size!==size||order.some(index=>!Number.isSafeInteger(index)||index<0||index>=size))throw new Error('La secuencia de posiciones no es válida.');return order}
function preservesMissing(order:number[],length:number){for(let i=0;i<length;i++)if(order[i]>=length)return false;return true}
function recordBytes(record:string[],encoding:Encoding,delimiter:string){return record.reduce((total,field)=>total+(encoding==='utf8'?Buffer.byteLength(field,'utf8'):field.length*(encoding==='utf16le'?2:1))+delimiter.length,0)}

export class TableEngine {
 // `largeBytes` e `indexChunk` solo los cambian las pruebas: fuerzan el modo grande con archivos pequeños.
 constructor(private progress:(event:SqlProgress)=>void=()=>{},private options:{largeBytes?:number;indexChunk?:number;extractBatch?:number;extractDelayMs?:number;freeBytes?:(dir:string)=>Promise<number>}={}){}
 private states = new Map<string, State>()
 private queries = new Map<string, number>()
 private openings = new Map<string, number>()
 private views = new Map<string,{key:string;indices:number[]}>()
 private analyses = new Map<string,string>()
 private streams=new Map<string,{id:string;iterator:AsyncGenerator<{data:Buffer;rows:number},void>}>()
 private serial = 0
 // Un archivo grande no tiene `rows` en memoria: todo lo que lea o cambie datos debe rechazarlo (solo `info` y `page` lo admiten).
 private get(id: string, allowLarge = false): State { const s = this.states.get(id); if (!s) throw new Error('La tabla ya no está abierta.'); if (s.large && !allowLarge) throw new Error('Esta función aún no está disponible en archivos grandes (solo lectura): la búsqueda, los filtros, las estadísticas y la edición llegan en fases posteriores.'); return s }
 private editable(id: string): State { const s = this.get(id); if (s.readonly) throw new Error('La muestra es de solo lectura.'); return s }
 async create(id: string) { this.openings.set(id,++this.serial);this.views.delete(id);this.queries.delete(id);const revision=(this.states.get(id)?.revision??-1)+1;this.states.set(id, { encoding:'utf8', delimiter:',',eol:'\n',bom:false,header:true,finalEol:true,headerWidth:1,rows:[],headers:['Columna 1'],readonly:false,revision,nextId:1,token:0,savedToken:-1,history:[],future:[] }); return this.info(id) }
 async open(id: string, path: string, options: TableOptions = {}) {
  const generation=++this.serial;this.openings.set(id,generation);this.views.delete(id);this.queries.delete(id)
  const bytes = (await stat(path)).size
  const meta = metadata(await prefix(path, Math.min(bytes,65536)), options, path)
  meta.finalEol=await endsWithEol(path,bytes,meta.encoding)
  // Por encima del umbral no se carga el archivo: se indexa por posición y se lee por páginas (modo grande, solo lectura).
  let records: string[][] = []; let toLarge = bytes > (this.options.largeBytes ?? TABLE_LIMITS.bytes); let readonly = false; let reason = bytes > TABLE_LIMITS.bytes ? 'El archivo supera 50 MiB.' : ''
  if (!toLarge) {
   const input = createReadStream(path, {highWaterMark:65536}); const validator=meta.encoding==='utf8'?validateUtf8():new Transform({transform(chunk,_encoding,callback){callback(null,chunk)}}); const decoder = iconv.decodeStream(meta.encoding)
   const parser = parse({delimiter:meta.delimiter,bom:true,relax_column_count:true,max_record_size:TABLE_LIMITS.record})
   input.on('error', error => parser.destroy(error)); validator.on('error',error=>parser.destroy(error)); decoder.on('error', error => parser.destroy(error)); input.pipe(validator).pipe(decoder).pipe(parser)
   try { let cells = 0; for await (const row of parser) { const record=row as string[];const bytesInRecord=recordBytes(record,meta.encoding,meta.delimiter);if(bytesInRecord>TABLE_LIMITS.record)throw new LimitError('Un registro supera 1 MiB.');records.push(record); cells += row.length; if (cells > TABLE_LIMITS.cells) throw new LimitError('El archivo supera dos millones de celdas.'); if (records.length % 2000 === 0) await yieldTurn() } }
   catch (error) { if (error instanceof LimitError) { toLarge = true; reason = error.message; records = [] } else if ((error as {code?:string}).code === 'CSV_MAX_RECORD_SIZE') { readonly = true; reason = 'Un registro supera 1 MiB.'; records = [] } else throw new Error(`CSV no válido: ${(error as Error).message}`) }
   finally { input.unpipe(validator); validator.unpipe(decoder); decoder.unpipe(parser); input.destroy(); validator.destroy(); decoder.end(); parser.destroy() }
  }
  if (toLarge) {
   try { return await this.openLarge(id, path, meta, generation, reason) }
   catch (error) { if (!(error instanceof LargeFormatError)) throw error; readonly = true; reason = `${reason ? reason + ' ' : ''}${error.message}`; records = [] } // sin índice posible: la muestra de siempre, con la posición del problema
  }
  if (readonly) {
   const sample = await prefix(path,TABLE_LIMITS.sampleBytes); const complete = sample.length === bytes
   const text = meta.encoding==='utf8'?new TextDecoder('utf-8',{fatal:true}).decode(sample,{stream:!complete}):iconv.decode(sample,meta.encoding)
   const parser = parse({delimiter:meta.delimiter,bom:true,relax_column_count:true,max_record_size:TABLE_LIMITS.record,raw:true,to:TABLE_LIMITS.sampleRows+(meta.header?1:0)})
   parser.end(text)
   try { for await (const item of parser) { if (complete || /[\r\n]$/.test(item.raw)) records.push(item.record as string[]); if (records.length >= TABLE_LIMITS.sampleRows+(meta.header ? 1:0)) break } }
   catch (error) { if (complete && (error as {code?:string}).code !== 'CSV_MAX_RECORD_SIZE') reason += ` El CSV contiene errores: ${(error as Error).message}` }
   finally { parser.destroy() }
  }
  const rawHeaders = meta.header ? records.shift() ?? [] : []
  meta.headerWidth=rawHeaders.length
  const width = Math.max(rawHeaders.length, ...records.slice(0,200).map(row=>row.length), 1)
  const headers = Array.from({length:width},(_,i)=>meta.header ? rawHeaders[i] ?? '' : `Columna ${i+1}`)
  const s: State = {...meta, rows:records.map((cells,i)=>({id:String(i+1),cells})),headers,readonly,warning:readonly ? `${reason} Muestra limitada: hasta 200 registros completos y 8 MiB leídos. Búsqueda, filtros y recuentos se refieren solo a la muestra.` : undefined,revision:0,nextId:records.length+1,token:0,savedToken:0,history:[],future:[]}
  // shortcut: irregular tables expose their widest row, large-file disk indexing is a later release.
  if (!readonly) { for (const row of s.rows) while(s.headers.length < row.cells.length) s.headers.push(meta.header ? '' : `Columna ${s.headers.length+1}`) }
  if(this.openings.get(id)!==generation)throw new Error('Apertura cancelada por una solicitud más reciente.')
  s.revision=(this.states.get(id)?.revision??-1)+1;this.views.delete(id);this.queries.delete(id);this.states.set(id,s); return this.info(id)
 }
  private async openLarge(id: string, path: string, meta: Metadata, generation: number, reason: string) {
  const index = await buildIndex(path, {encoding: meta.encoding, bomLength: meta.bom ? (meta.encoding === 'utf16le' ? 2 : 3) : 0, maxRecord: TABLE_LIMITS.record, chunk: this.options.indexChunk,
   onProgress: fraction => this.progress({requestId: 'open:' + id, phase: `Indexando archivo grande… ${Math.round(fraction * 100)} %`, rows: Math.round(fraction * 100)}), // `rows` lleva el porcentaje
   cancelled: () => this.openings.get(id) !== generation})
  const first = await readRecords(index, 0, Math.min(index.records, 201)), start = meta.header ? 1 : 0
  const rawHeaders = meta.header && first.length ? splitFields(first[0], meta.delimiter) : []; meta.headerWidth = rawHeaders.length
  const width = Math.max(rawHeaders.length, ...first.slice(start).map(text => splitFields(text, meta.delimiter).length), 1)
  const headers = Array.from({length: width}, (_, i) => meta.header ? rawHeaders[i] ?? '' : `Columna ${i + 1}`)
  const rowCount = Math.max(index.records - start, 0)
  const warning = `${reason ? reason + ' ' : ''}Archivo grande: ${rowCount.toLocaleString()} filas en solo lectura. Se lee por páginas directamente del archivo; la búsqueda, los filtros, las estadísticas y la edición llegan en fases posteriores.`
  if (this.openings.get(id) !== generation) throw new Error('Apertura cancelada por una solicitud más reciente.')
  const s: State = {...meta, rows: [], headers, readonly: true, warning, revision: (this.states.get(id)?.revision ?? -1) + 1, nextId: 1, token: 0, savedToken: 0, history: [], future: [], large: {index, rowCount}}
  this.views.delete(id); this.queries.delete(id); this.states.set(id, s); return this.info(id)
 }
 private running = new Map<string, {cancelled: boolean}>()
 // I0/E1: operaciones tipadas sobre un archivo grande. Solo lee el original; la extracción escribe un archivo NUEVO (a un temporal y lo renombra al terminar).
 async operation(id: string, request: EngineOperation): Promise<OperationResult> {
  const s = this.get(id, true)
  if (!s.large) throw new Error('Esta operación solo se ofrece para archivos grandes (solo lectura); en una tabla editable usa los filtros y la exportación.')
  if (request.source.revision !== s.revision) throw new Error('El documento cambió mientras tanto: vuelve a abrir el cuadro.')
  if (request.operation === 'filter_extract') { const [a, b] = await Promise.all([realpath(request.output).catch(() => resolve(request.output)), realpath(s.large.index.path).catch(() => resolve(s.large!.index.path))]); if (a === b) throw new Error('El destino no puede ser el archivo original: la extracción nunca lo modifica.') }
  const control = {cancelled: false}; this.running.set(request.requestId, control)
  const label = request.operation === 'count' ? 'Contando' : request.operation === 'preview' ? 'Buscando coincidencias' : 'Extrayendo'
  try {
   return await runOperation({index: s.large.index, encoding: s.encoding, delimiter: s.delimiter, header: s.header, bom: s.bom, eol: s.eol, finalEol: s.finalEol, headers: s.headers, headerWidth: s.headerWidth}, request,
    {progress: percent => this.progress({requestId: 'op:' + request.requestId, phase: `${label}… ${percent} %`, rows: percent}), cancelled: () => control.cancelled || this.states.get(id) !== s, batchRecords: this.options.extractBatch, delayMs: this.options.extractDelayMs, freeBytes: this.options.freeBytes})
  } catch (error) { if (this.states.get(id) !== s && !(error instanceof OperationCancelled)) throw new Error('Operación cancelada porque cambió la tabla.'); throw error }
  finally { this.running.delete(request.requestId) }
 }
 async cancelOperation(requestId: string) { const control = this.running.get(requestId); if (control) control.cancelled = true }
 async cancelOpen(id: string) { this.openings.set(id, ++this.serial) } // la apertura en curso lo nota en su siguiente bloque
 async info(id: string) { const s=this.get(id,true); return {headers:[...s.headers],rowCount:s.large?s.large.rowCount:s.rows.length,readonly:s.readonly,warning:s.warning,encoding:s.encoding,delimiter:s.delimiter,revision:s.revision,dirty:s.token!==s.savedToken,large:s.large?true:undefined} }
 private async largePage(id: string, s: State, query: TableQuery): Promise<TablePage> {
  if (query.search || Object.values(query.filters ?? {}).some(Boolean) || query.sort || query.order?.length || query.conditions?.length) throw new Error('En archivos grandes todavía no hay búsqueda, filtros ni orden.')
  const {index, rowCount} = s.large!, texts = await readRecords(index, query.offset + (s.header ? 1 : 0), query.limit)
  if (this.states.get(id) !== s) throw new Error('Consulta cancelada porque cambió la tabla.')
  return {rows: texts.map((text, i) => ({id: String(query.offset + i + 1), cells: splitFields(text, s.delimiter)})), total: rowCount, matched: rowCount, revision: s.revision, requestId: query.requestId, sample: false, large: true}
 }
 private async indices(id: string, query: TableQuery,guard?:()=>void): Promise<number[]> {
  const s=this.get(id); const revision=s.revision; const ticket=++this.serial; if(!guard)this.queries.set(id,ticket)
  const search=(query.search??'').toLocaleLowerCase(); const filters=Object.entries(query.filters??{}).filter(([,value])=>value).map(([column,value])=>[Number(column),value.toLocaleLowerCase()] as const)
  const compiled=compileTableQuery(query,s.headers.length)
  const key=JSON.stringify([revision,search,filters,query.sort,query.order,query.conditions,query.filterMode]); const cached=this.views.get(id);if(cached?.key===key){guard?.();return cached.indices}
  const indices:number[]=[]
  const ensure=()=>{guard?.();if((!guard&&this.queries.get(id)!==ticket) || this.states.get(id)!==s || s.revision!==revision) throw new Error('Consulta cancelada por una solicitud más reciente.')}
  for(let i=0;i<s.rows.length;i++){const row=s.rows[i]; if((!search||row.cells.some(value=>value.toLocaleLowerCase().includes(search)))&&filters.every(([column,value])=>(row.cells[column]??'').toLocaleLowerCase().includes(value))&&compiled.matches(row.cells))indices.push(i); if(i%2048===0){await yieldTurn();ensure()} }
  if(compiled.ordered){
   const compare=(a:number,b:number)=>compiled.compare(s.rows[a].cells,s.rows[b].cells)||a-b
   // Bottom-up merge sort yields between blocks so cancel messages remain actionable.
   let work=indices, scratch=new Array<number>(indices.length)
   for(let width=1;width<indices.length;width*=2){for(let left=0;left<indices.length;left+=2*width){let a=left,b=Math.min(left+width,indices.length),endA=b,endB=Math.min(left+2*width,indices.length),out=left; while(a<endA||b<endB){scratch[out++]=b>=endB||(a<endA&&compare(work[a],work[b])<=0)?work[a++]:work[b++]; if(out%8192===0){await yieldTurn();ensure()}}} [work,scratch]=[scratch,work];await yieldTurn();ensure()} this.views.set(id,{key,indices:work});return work
  }
  ensure();this.views.set(id,{key,indices});return indices
 }
 async page(id:string,query:TableQuery):Promise<TablePage>{if(!Number.isInteger(query.offset)||query.offset<0||!Number.isInteger(query.limit)||query.limit<1||query.limit>1000)throw new Error('Página no válida.');const s=this.get(id,true);if(s.large)return this.largePage(id,s,query);const revision=s.revision;const indices=await this.indices(id,query);if(this.states.get(id)!==s||s.revision!==revision)throw new Error('Consulta cancelada porque cambió la tabla.');return{rows:indices.slice(query.offset,query.offset+query.limit).map(i=>copyRow(s.rows[i])),total:s.rows.length,matched:indices.length,revision:s.revision,requestId:query.requestId,sample:s.readonly}}
 private async rangeRows(id:string,range:TableRange,guard?:()=>void){
  const s=this.get(id),revision=s.revision
  if(range.revision!==revision)throw new Error('La tabla cambió desde que se seleccionó el rango. Vuelve a seleccionarlo.')
  const {top,bottom,left,right}=range
  if(![top,bottom,left,right].every(Number.isSafeInteger)||top<0||bottom<top||left<0||right<left||right>=s.headers.length)throw new Error('Rango no válido.')
  const indices=await this.indices(id,range.query,guard)
  if(this.states.get(id)!==s||s.revision!==revision)throw new Error('La tabla cambió durante la consulta del rango.')
  if(bottom>=indices.length)throw new Error('El rango excede las filas de la vista.')
  return{state:s,indices:indices.slice(top,bottom+1),columns:Array.from({length:right-left+1},(_,i)=>i+left)}
 }
 private async rangeChanges(id:string,edit:TableRangeEdit,apply:(row:TableRow,column:number,value:string)=>void):Promise<TableRangePreview>{
  const s=this.editable(id),revision=s.revision,requestId=edit.requestId??randomUUID()
  let range=edit.range
  const values=edit.values
  if(edit.operation==='paste'){
   if(!values?.length||!values[0].length||values.some(row=>row.length!==values[0].length))throw new Error('El bloque para pegar debe ser rectangular y no estar vacío.')
   if(range.top===range.bottom&&range.left===range.right)range={...range,bottom:range.top+values.length-1,right:range.left+values[0].length-1}
   else if(values.length!==range.bottom-range.top+1||values[0].length!==range.right-range.left+1)throw new Error('El bloque no coincide con las dimensiones del rango seleccionado.')
  }
  if(edit.operation==='replace'&&!edit.find)throw new Error('Introduce el texto que quieres reemplazar.')
  if(['fill','replace'].includes(edit.operation)&&typeof edit.value!=='string')throw new Error('Introduce un valor de texto.')
  this.analyses.set(id,requestId)
  const ensure=()=>{if(this.analyses.get(id)!==requestId||this.states.get(id)!==s||s.revision!==revision)throw new Error('Preparación del rango cancelada: cambió la tabla o la solicitud.')}
  const progress=async(rows:number)=>{this.progress({requestId,phase:'Preparando rango',rows});await yieldTurn();ensure()}
  try{
   await progress(0)
   const {indices,columns}=await this.rangeRows(id,range,ensure)
   const result:TableRangePreview={cells:indices.length*columns.length,changed:0,revision,samples:[]}
   let processed=0
   for(let i=0;i<indices.length;i++){
    const row=s.rows[indices[i]]
    for(const column of columns){
     const before=row.cells[column]??'';let after:string
     switch(edit.operation){case'fill':after=edit.value!;break;case'clear':after='';break;case'trim':after=before.trim();break;case'upper':after=before.toUpperCase();break;case'lower':after=before.toLowerCase();break;case'replace':after=before.split(edit.find!).join(edit.value!);break;case'paste':after=values![i][column-range.left];break;default:throw new Error('Operación de rango no válida.')}
     if(typeof after!=='string'||Buffer.byteLength(after,'utf8')>TABLE_LIMITS.record)throw new Error('El valor supera el límite de 1 MiB.')
     if(after!==before){result.changed++;if(result.samples.length<8)result.samples.push({row:range.top+i,column,before:before.slice(0,256),after:after.slice(0,256)});apply(row,column,after)}
     if(++processed%512===0)await progress(i+1)
    }
   }
   ensure();return result
  }finally{if(this.analyses.get(id)===requestId)this.analyses.delete(id)}
 }

 async rangePreview(id:string,edit:TableRangeEdit){return this.rangeChanges(id,edit,()=>{})}
 async rangeClipboard(id:string,range:TableRange){return this.clipboard(id,{scope:'selection',range})}
 async clipboard(id:string,options:TableExport){
  const {rows}=await this.selected(id,options),parts:string[]=[];let bytes=0
  for(const row of rows){const part=stringify([row],{delimiter:'\t',record_delimiter:'\n'});bytes+=Buffer.byteLength(part,'utf8');if(bytes>8*1024*1024)throw new Error('La copia supera 8 MiB. Reduce el rango o exporta la selección.');parts.push(part)}
  return parts.join('')
 }
 private async structurePlan(id:string,edit:TableTransformEdit){
  const s=this.editable(id),revision=s.revision
  if(edit.revision!==revision)throw new Error('La tabla cambió desde la vista previa. Vuelve a prepararla.')
  if(s.headers.length>200)throw new Error('Estas transformaciones admiten hasta 200 columnas por documento.')
  if(!['split','combine','deduplicate','normalize','headers','moveRows','moveColumns','commitOrder'].includes(edit.operation))throw new Error('Transformación no válida.')
  const columns=[...new Set(edit.columns)].sort((a,b)=>a-b)
  if(!columns.length&&!['moveRows','commitOrder'].includes(edit.operation)||columns.some(index=>!Number.isInteger(index)||index<0||index>=s.headers.length))throw new Error('Selecciona columnas válidas.')
  if(edit.operation==='split'&&columns.length!==1)throw new Error('Selecciona una sola columna para dividir.')
  if(['split','combine'].includes(edit.operation)&&(typeof edit.separator!=='string'||edit.separator.length>64||edit.operation==='split'&&!edit.separator))throw new Error('El separador literal debe tener entre 1 y 64 caracteres para dividir; puede estar vacío al combinar.')
  if(edit.name!==undefined&&(typeof edit.name!=='string'||edit.name.length>10000))throw new Error('El nombre de columna supera el límite.')
  if(edit.operation==='headers'&&!s.header)throw new Error('Activa la primera fila como encabezados para normalizarlos.')
  this.analyses.set(id,edit.requestId)
  const ensure=()=>{if(this.analyses.get(id)!==edit.requestId||this.states.get(id)!==s||s.revision!==revision)throw new Error('Transformación cancelada: cambió la tabla o la solicitud.')}
  const progress=async(rows:number)=>{this.progress({requestId:edit.requestId,phase:'Preparando transformación',rows});await yieldTurn();ensure()}
  const forward:Mutation[]=[],backward:Mutation[]=[],preview:TableTransformPreview={revision,rows:s.rows.length,affected:0,cells:0,addedColumns:0,deletedRows:0,changedHeaders:0,movedRows:0,movedColumns:0,samples:[]}
  let bytes=0
  const add=(a:Mutation,b:Mutation)=>{bytes+=Buffer.byteLength(JSON.stringify(a),'utf8')+Buffer.byteLength(JSON.stringify(b),'utf8')+2;if(bytes>20*1024*1024-1024)throw new Error('El cambio supera el presupuesto de deshacer de 20 MiB. Reduce la transformación.');forward.push(a);backward.push(b)}
  const sample=(row:number|null,column:number|null,before:string,after:string)=>{if(preview.samples.length<8)preview.samples.push({row,column,before:before.slice(0,256),after:after.slice(0,256)})}
  const field=(value:string)=>{if(Buffer.byteLength(value,'utf8')>TABLE_LIMITS.record)throw new Error('Una celda resultante supera 1 MiB.');return value}
  const record=(cells:string[])=>{if(recordBytes(cells,s.encoding,s.delimiter)>TABLE_LIMITS.record)throw new Error('Un registro resultante supera 1 MiB. No se ha modificado el documento.')}
  try{
   await progress(0)
   if(['moveRows','moveColumns','commitOrder'].includes(edit.operation)){
    const rowOrder=edit.operation!=='moveColumns',size=rowOrder?s.rows.length:s.headers.length
    let order:number[]
    if(edit.operation==='commitOrder'){
     const q=edit.query
     if(!q||!compileTableQuery(q,s.headers.length).ordered)throw new Error('Ordena primero la vista para fijar su orden.')
     if(q.search||q.conditions?.length||Object.values(q.filters??{}).some(Boolean))throw new Error('Quita la búsqueda y todos los filtros antes de fijar el orden del documento.')
     order=await this.indices(id,q,ensure);ensure()
    }else{
     let positions:number[]=[];const ids=new Set(edit.rowIds??[])
     if(rowOrder&&edit.range)positions=(await this.rangeRows(id,edit.range,ensure)).indices
     else if(rowOrder){for(let i=0;i<s.rows.length;i++){if(ids.has(s.rows[i].id))positions.push(i);if(i%512===0)await progress(i+1)}if(positions.length!==ids.size)throw new Error('Una fila seleccionada ya no existe.')}
     else positions.push(...columns)
     if(!positions.length)throw new Error('Selecciona filas o columnas para mover.')
     if(rowOrder&&edit.range&&edit.rowIds?.length)throw new Error('Elige un rango o filas marcadas, sin combinar ambos modos.')
     const destination=edit.destination??-1,selected=new Set(positions)
     if(!Number.isSafeInteger(destination)||destination<0||destination>size)throw new Error('Elige una posición de destino válida.')
     if(selected.has(destination))throw new Error('El destino pertenece a la selección. Elige otra posición o el final.')
     const before:number[]=[],moved:number[]=[],after:number[]=[]
     for(let i=0;i<size;i++){(selected.has(i)?moved:i<destination?before:after).push(i);if(i%512===0)await progress(i+1)}
     order=before.concat(moved,after)
    }
    permutation(order,size)
    const inverse=new Array<number>(size);let moved=0
    for(let i=0;i<size;i++){inverse[order[i]]=i;if(order[i]!==i){moved++;sample(rowOrder?order[i]:null,rowOrder?null:order[i],`Posición ${order[i]+1}`,`Posición ${i+1}`)}if(i%512===0)await progress(i+1)}
    if(!rowOrder){
     if(!preservesMissing(order,s.headerWidth))throw new Error('Este movimiento convertiría encabezados ausentes en vacíos. Elige otro destino.')
     for(let i=0;i<s.rows.length;i++){if(!preservesMissing(order,s.rows[i].cells.length))throw new Error(`Este movimiento convertiría campos ausentes en vacíos en la fila original ${i+1}. Elige otro destino.`);if(i%512===0)await progress(i+1)}
    }
    if(moved)add({type:rowOrder?'rowOrder':'columnOrder',order},{type:rowOrder?'rowOrder':'columnOrder',order:inverse})
    if(rowOrder){preview.movedRows=moved;preview.affected=moved}else{preview.movedColumns=moved;preview.affected=moved?s.rows.length:0}
   }else if(edit.operation==='normalize'){
    for(let i=0;i<s.rows.length;i++){let changed=false;const row=s.rows[i],next=[...row.cells];for(const col of columns){if(col>=row.cells.length)continue;const before=row.cells[col],after=field(before.normalize('NFC'));if(after!==before){add({type:'cell',id:row.id,column:col,value:after},{type:'cell',id:row.id,column:col,value:before});sample(i,col,before,after);next[col]=after;preview.cells++;changed=true}}if(changed){record(next);preview.affected++}if(i%512===0)await progress(i+1)}
   }else if(edit.operation==='headers'){
    const used=new Set<string>()
    for(let i=0;i<s.headers.length;i++){const before=s.headers[i],base=before.normalize('NFC').trim().replace(/\s+/gu,'_').toLowerCase()||`columna_${i+1}`;let after=base,suffix=2;while(used.has(after))after=`${base}_${suffix++}`;used.add(after);if(before!==after){add({type:'header',column:i,value:after},{type:'header',column:i,value:before,headerWidth:s.headerWidth});sample(null,i,before,after);preview.changedHeaders++}if(i%512===0)await progress(i+1)}
   }else if(edit.operation==='deduplicate'){
    const seen=new Map<string,number>(),remove:number[]=[]
    for(let i=0;i<s.rows.length;i++){const row=s.rows[i],key=JSON.stringify(columns.map(col=>col<row.cells.length?[row.cells[col]]:[])),first=seen.get(key);if(first===undefined)seen.set(key,i);else{remove.push(i);sample(i,columns[0],JSON.stringify(row.cells),`Eliminar fila; coincide con la fila original ${first+1}`)}if(i%512===0)await progress(i+1)}
    let groups=0;for(let end=remove.length-1;end>=0;){let start=end;while(start>0&&remove[start-1]===remove[start]-1)start--;const index=remove[start],rows=s.rows.slice(index,remove[end]+1).map(copyRow);add({type:'rows',index,remove:rows.length,rows:[]},{type:'rows',index,remove:0,rows});end=start-1;if(++groups%512===0)await progress(s.rows.length)}
    preview.deletedRows=preview.affected=remove.length
   }else{
    const insertAt=0,result:string[][]=[[]]
    const capacity=(width:number)=>{if(s.headers.length+width>200)throw new Error('El resultado supera 200 columnas.');if(s.rows.length*(s.headers.length+width)>TABLE_LIMITS.cells)throw new Error('Las columnas resultantes superan dos millones de celdas.')}
    capacity(1)
    for(let i=0;i<s.rows.length;i++){
     const row=s.rows[i],values=columns.map(col=>row.cells[col]??''),parts=edit.operation==='split'?values[0].split(edit.separator!,33):[field(values.join(edit.separator!))]
     if(parts.length>32)throw new Error('La división produce más de 32 columnas. No se ha modificado el documento.')
     const projected=[...row.cells];while(projected.length<insertAt)projected.push('');projected.splice(insertAt,0,...parts);record(projected)
     capacity(Math.max(result.length,parts.length))
     while(result.length<parts.length)result.push(Array(i).fill(''))
     for(let c=0;c<result.length;c++)result[c].push(parts[c]??'')
     sample(i,columns[0],JSON.stringify(values),edit.operation==='split'?JSON.stringify(parts):parts[0]);if(i%512===0)await progress(i+1)
    }
    const lengths=s.rows.map(row=>row.cells.length),prefix=[...(s.headers[columns[0]]||'Columna')].slice(0,128).join('')
    for(let c=0;c<result.length;c++){const index=insertAt+c,name=edit.operation==='split'?`${prefix}_${c+1}`:edit.name||'Combinada';add({type:'column',index,remove:false,name,cells:result[c],headerWidth:s.header?s.headerWidth+c+1:0},{type:'column',index,remove:true,name:'',cells:[],headerWidth:s.headerWidth,lengths:[...lengths]});for(let i=0;i<lengths.length;i++)lengths[i]=Math.max(lengths[i],index)+1;await progress(s.rows.length)}
    preview.addedColumns=result.length;preview.affected=s.rows.length;preview.cells=result.length*s.rows.length
   }
   const headers=[...s.headers];for(const m of forward){if(m.type==='header')headers[m.column]=m.value;else if(m.type==='column'&&!m.remove)headers.splice(m.index,0,m.name)}record(headers)
   await progress(edit.operation==='headers'?s.headers.length:s.rows.length)
   return{forward,backward,preview}
  }finally{if(this.analyses.get(id)===edit.requestId)this.analyses.delete(id)}
 }
 async transformPreview(id:string,edit:TableTransformEdit){return(await this.structurePlan(id,edit)).preview}

 private apply(s:State,mutations:Mutation[]){
  // Coalesce row-only changes to avoid quadratic splices and argument limits on undo.
  const rowChanges=mutations.filter((m):m is Extract<Mutation,{type:'rows'}>=>m.type==='rows')
  if(rowChanges.length===mutations.length&&mutations.length>1&&rowChanges.every((m,i)=>m.remove>0&&!m.rows.length&&(i===0||m.index<rowChanges[i-1].index))){const ranges=[...rowChanges].reverse(),rows:TableRow[]=[];let cursor=0;for(const m of ranges){while(cursor<m.index)rows.push(s.rows[cursor++]);cursor+=m.remove}while(cursor<s.rows.length)rows.push(s.rows[cursor++]);s.rows=rows;return}
  if(rowChanges.length===mutations.length&&(mutations.length>1||rowChanges[0]?.rows.length>1024)&&rowChanges.every((m,i)=>m.remove===0&&(i===0||m.index>=rowChanges[i-1].index))){const rows:TableRow[]=[];let cursor=0,inserted=0;for(const m of rowChanges){const at=m.index-inserted;while(cursor<at)rows.push(s.rows[cursor++]);for(const row of m.rows)rows.push(copyRow(row));inserted+=m.rows.length}while(cursor<s.rows.length)rows.push(s.rows[cursor++]);s.rows=rows;return}
  const indexed=mutations.length>16?new Map(s.rows.map(row=>[row.id,row])):undefined;for(const mutation of mutations){switch(mutation.type){case'rowOrder':{const order=permutation(mutation.order,s.rows.length);s.rows=order.map(index=>s.rows[index]);break}case'columnOrder':{const order=permutation(mutation.order,s.headers.length);if(!preservesMissing(order,s.headerWidth)||s.rows.some(row=>!preservesMissing(order,row.cells.length)))throw new Error('El orden no conserva los campos o encabezados ausentes.');const headers=order.map(index=>s.headers[index]),rows=s.rows.map(row=>({id:row.id,cells:order.slice(0,row.cells.length).map(index=>row.cells[index])}));s.headers=headers;s.rows=rows;break}case'cell':{const row=indexed?.get(mutation.id)??s.rows.find(row=>row.id===mutation.id);if(!row)throw new Error('Fila no encontrada.');while(row.cells.length<mutation.column)row.cells.push('');row.cells[mutation.column]=mutation.value;if(mutation.length!==undefined)row.cells.length=mutation.length;break}case'header':s.headers[mutation.column]=mutation.value;s.headerWidth=mutation.headerWidth??Math.max(s.headerWidth,mutation.column+1);break;case'rows':s.rows.splice(mutation.index,mutation.remove,...mutation.rows.map(copyRow));break;case'column':if(mutation.remove){s.headers.splice(mutation.index,1);s.rows.forEach((row,i)=>{row.cells.splice(mutation.index,1);if(mutation.lengths)row.cells.length=mutation.lengths[i]})}else{s.headers.splice(mutation.index,0,mutation.name);s.rows.forEach((row,i)=>{while(row.cells.length<mutation.index)row.cells.push('');row.cells.splice(mutation.index,0,mutation.cells[i]??'');if(mutation.lengths)row.cells.length=mutation.lengths[i]})}s.headerWidth=mutation.headerWidth??s.headers.length;break}}}
 async edit(id:string,edit:TableEdit){const s=this.editable(id);const revision=s.revision;let forward:Mutation[]=[],backward:Mutation[]=[]
  const add=(a:Mutation,b:Mutation)=>{forward.push(a);backward.push(b)}
  const rowIndex=(rowId:string)=>{const i=s.rows.findIndex(row=>row.id===rowId);if(i<0)throw new Error('Fila no encontrada.');return i}
  const column=(index:number,insert=false)=>{if(!Number.isInteger(index)||index<0||index>s.headers.length-(insert?0:1))throw new Error('Columna no válida.')}
  const value=(text:string)=>{if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>TABLE_LIMITS.record)throw new Error('El valor supera el límite de 1 MiB.');return text}
  switch(edit.type){
   case'structure':({forward,backward}=await this.structurePlan(id,edit));break
   case'range':{await this.rangeChanges(id,edit,(row,column,value)=>add({type:'cell',id:row.id,column,value},{type:'cell',id:row.id,column,value:row.cells[column]??'',length:row.cells.length}));break}
   case'cell':{column(edit.column);const row=s.rows[rowIndex(edit.rowId)];value(edit.value);if((row.cells[edit.column]??'')===edit.value)return this.info(id);add({type:'cell',id:row.id,column:edit.column,value:edit.value},{type:'cell',id:row.id,column:edit.column,value:row.cells[edit.column]??'',length:row.cells.length});break}
   case'paste':{
    column(edit.column)
    if(edit.view&&edit.view.revision!==revision)throw new Error('La tabla cambió desde que se mostró esta vista. Espera a que se actualice y vuelve a pegar.')
    const original=rowIndex(edit.rowId),indices=edit.view?await this.indices(id,edit.view.query):undefined
    const start=indices?indices.indexOf(original):original
    if(start<0)throw new Error('La fila ya no pertenece a la vista. Actualiza la tabla antes de pegar.')
    if(start+edit.values.length>(indices?.length??s.rows.length))throw new Error('El pegado excede las filas de esta vista. Reduce el bloque o añade filas antes de pegar.')
    for(const [offset,cells] of edit.values.entries()){
     if(edit.column+cells.length>s.headers.length)throw new Error('El pegado excede las columnas de la tabla. Añade antes las columnas necesarias.')
     const row=s.rows[indices?indices[start+offset]:start+offset]
     cells.forEach((text,col)=>{value(text);add({type:'cell',id:row.id,column:edit.column+col,value:text},{type:'cell',id:row.id,column:edit.column+col,value:row.cells[edit.column+col]??'',length:row.cells.length})})
     if(offset%2048===0)await yieldTurn()
    }
    break
   }
   case'insertRow':{if(edit.beforeId!==undefined&&edit.afterId!==undefined)throw new Error('Elige antes o después de una fila, no ambos.');if((s.rows.length+1)*s.headers.length>TABLE_LIMITS.cells)throw new Error('La edición supera dos millones de celdas.');const index=edit.beforeId!==undefined?rowIndex(edit.beforeId):edit.afterId?rowIndex(edit.afterId)+1:s.rows.length;const row={id:String(s.nextId++),cells:s.headers.map(()=>'')};add({type:'rows',index,remove:0,rows:[row]},{type:'rows',index,remove:1,rows:[]});break}
   case'duplicateRows':{
    const ids=new Set(edit.ids),indexes=s.rows.flatMap((row,index)=>ids.has(row.id)?[index]:[]).reverse()
    if(indexes.length!==ids.size)throw new Error('Fila no encontrada.')
    if((s.rows.length+indexes.length)*s.headers.length>TABLE_LIMITS.cells)throw new Error('La edición supera dos millones de celdas.')
    for(const [offset,index] of indexes.entries()){const row={...copyRow(s.rows[index]),id:String(s.nextId++)};add({type:'rows',index:index+1,remove:0,rows:[row]},{type:'rows',index:index+1,remove:1,rows:[]});if(offset%2048===0)await yieldTurn()}
    break
   }
   case'duplicateColumn':{
    column(edit.index)
    if(s.rows.length*(s.headers.length+1)>TABLE_LIMITS.cells)throw new Error('La edición supera dos millones de celdas.')
    add({type:'column',index:edit.index+1,remove:false,name:s.headers[edit.index]+' (copia)',cells:s.rows.map(row=>row.cells[edit.index]??'')},{type:'column',index:edit.index+1,remove:true,name:'',cells:[],headerWidth:s.headerWidth,lengths:s.rows.map(row=>row.cells.length)})
    break
   }
   case'deleteRows':{const indexes=[...new Set(edit.ids)].map(rowIndex).sort((a,b)=>b-a);for(const index of indexes)add({type:'rows',index,remove:1,rows:[]},{type:'rows',index,remove:0,rows:[copyRow(s.rows[index])]});break}
   case'insertColumn':{column(edit.index,true);value(edit.name);if(s.rows.length*(s.headers.length+1)>TABLE_LIMITS.cells)throw new Error('La edición supera dos millones de celdas.');add({type:'column',index:edit.index,remove:false,name:edit.name,cells:[]},{type:'column',index:edit.index,remove:true,name:'',cells:[],headerWidth:s.headerWidth,lengths:s.rows.map(row=>row.cells.length)});break}
   case'deleteColumn':{column(edit.index);if(s.headers.length===1)throw new Error('La tabla necesita al menos una columna.');add({type:'column',index:edit.index,remove:true,name:'',cells:[]},{type:'column',index:edit.index,remove:false,name:s.headers[edit.index],cells:s.rows.map(row=>row.cells[edit.index]??''),headerWidth:s.headerWidth,lengths:s.rows.map(row=>row.cells.length)});break}
   case'header':{column(edit.index);if(!s.header)throw new Error('Activa la primera fila como encabezados antes de editarlos.');value(edit.name);add({type:'header',column:edit.index,value:edit.name},{type:'header',column:edit.index,value:s.headers[edit.index],headerWidth:s.headerWidth});break}
   case'transform':{
    if(!['trim','upper','lower'].includes(edit.operation)||!edit.rowIds.length||!edit.columns.length)throw new Error('Selecciona filas y columnas para transformar.')
    const ids=new Set(edit.rowIds),columns=[...new Set(edit.columns)];columns.forEach(index=>column(index))
    const found=new Set(s.rows.filter(row=>ids.has(row.id)).map(row=>row.id));if(found.size!==ids.size)throw new Error('Fila no encontrada.')
    for(let i=0;i<s.rows.length;i++){
     const row=s.rows[i]
     if(ids.has(row.id))for(const col of columns){
      if(col>=row.cells.length)continue
      const text=row.cells[col],result=edit.operation==='trim'?text.trim():edit.operation==='upper'?text.toUpperCase():text.toLowerCase()
      if(result!==text){value(result);add({type:'cell',id:row.id,column:col,value:result},{type:'cell',id:row.id,column:col,value:text})}
     }
     if(i%2048===0)await yieldTurn()
    }
    break
   }
   case'replace':{if(!edit.find)throw new Error('Introduce el texto que quieres reemplazar.');if(edit.column!==undefined)column(edit.column);for(let i=0;i<s.rows.length;i++){const row=s.rows[i];row.cells.forEach((text,col)=>{if(edit.column!==undefined&&col!==edit.column)return;const result=text.split(edit.find).join(edit.replacement);if(result!==text){value(result);add({type:'cell',id:row.id,column:col,value:result},{type:'cell',id:row.id,column:col,value:text})}});if(i%2048===0)await yieldTurn()}break}
  }
  if(!forward.length)return this.info(id)
  if(this.states.get(id)!==s||s.revision!==revision)throw new Error('La tabla cambió durante la operación. Vuelve a intentarlo.')
  const before=s.token,after=++this.serial;const change={forward,backward:backward.reverse(),before,after,bytes:0};change.bytes=Buffer.byteLength(JSON.stringify(change),'utf8');if(change.bytes>20*1024*1024)throw new Error('El cambio supera el presupuesto de deshacer de 20 MiB. Reduce el número de celdas modificadas.');this.apply(s,forward);s.token=after;s.revision++;s.history.push(change);let budget=s.history.reduce((sum,item)=>sum+item.bytes,0);while(budget>20*1024*1024&&s.history.length>1)budget-=s.history.shift()!.bytes;s.future=[];return this.info(id)
 }
 async undo(id:string,redo=false){const s=this.editable(id);const source=redo?s.future:s.history,target=redo?s.history:s.future;const change=source.at(-1);if(change){this.apply(s,redo?change.forward:change.backward);source.pop();s.token=redo?change.after:change.before;s.revision++;target.push(change)}return this.info(id)}
 private async selected(id:string,options:TableExport){const s=this.get(id),revision=s.revision;if(s.readonly)throw new Error('La muestra no permite exportar el archivo ni selecciones.');let indices:number[];if(options.scope==='selection'&&options.range){const selected=await this.rangeRows(id,options.range);return{rows:selected.indices.map(i=>selected.columns.map(col=>s.rows[i].cells[col]??'')),headers:selected.columns.map(col=>s.headers[col])}}if(options.scope==='filtered')indices=await this.indices(id,options.query??{offset:0,limit:500,requestId:0});else if(options.scope==='selection'){const ids=new Set(options.rowIds??[]);indices=s.rows.flatMap((row,i)=>ids.has(row.id)?[i]:[])}else indices=s.rows.map((_,i)=>i);if(this.states.get(id)!==s||s.revision!==revision)throw new Error('La tabla cambió durante la exportación.');const columns=options.columns??s.headers.map((_,i)=>i);if(columns.some(i=>!Number.isInteger(i)||i<0||i>=s.headers.length))throw new Error('Selección de columnas no válida.');return{rows:indices.map(i=>columns.map(col=>s.rows[i].cells[col]??'')),headers:columns.map(col=>s.headers[col])}}
 async analysisStart(id:string,ticket:string,revision:number,path:string|null,query?:TableQuery,where?:TableConditionGroup){
  const s=this.get(id,true);if(s.revision!==revision)throw new Error('La tabla cambió. Vuelve a analizar.');if(s.headers.length>ANALYSIS_LIMITS.columns)throw new Error('El análisis admite hasta 200 columnas por fuente.')
  if(s.readonly&&!path)throw new Error('La muestra necesita su archivo original para el análisis completo.')
  if(s.readonly&&query)throw new Error(s.large?'La vista filtrada no está disponible en archivos grandes. Elige documento completo.':'La vista filtrada de una muestra no representa el archivo completo. Elige documento completo.')
  const ensure=()=>{const active=this.streams.get(ticket);if(!active||this.states.get(id)!==s||s.revision!==revision)throw new Error('Transferencia cancelada: cambió la fuente o la solicitud.')}
  const filter=where?.conditions.length?compileTableQuery({...where,offset:0,limit:1,requestId:0},s.headers.length).matches:undefined
  const indices=()=>this.indices(id,{...query!,order:[],sort:undefined},ensure)
  const records=s.readonly?fileRecords(path!,s,ensure):(async function*(){for(const index of query?await indices():s.rows.keys()){ensure();yield s.rows[index].cells}})()
  this.streams.set(ticket,{id,iterator:arrowBatches(records,s.headers.length,ensure,filter)})
  return{headers:[...s.headers],revision:s.revision,readonly:s.readonly,large:s.large?true:undefined}
 }
 async analysisNext(ticket:string){const active=this.streams.get(ticket);if(!active)throw new Error('La transferencia ya no está disponible.');try{const chunk=await active.iterator.next();if(chunk.done){this.streams.delete(ticket);return{done:true as const,rows:0}}return{done:false as const,...chunk.value}}catch(error){this.streams.delete(ticket);throw error}}
 async analysisClose(ticket:string){const active=this.streams.get(ticket);this.streams.delete(ticket);await active?.iterator.return().catch(()=>{})}
 async analyzeColumn(id:string,request:ColumnAnalysisRequest):Promise<ColumnAnalysis>{
  const s=this.get(id);if(request.revision!==s.revision)throw new Error('La tabla cambió. Vuelve a analizar.')
  for(const column of [request.column,...request.otherColumn===undefined?[]:[request.otherColumn]])if(!Number.isInteger(column)||column<0||column>=s.headers.length)throw new Error('Columna no válida.')
  if(!Number.isInteger(request.frequencyOffset)||request.frequencyOffset<0||!Number.isInteger(request.bins)||request.bins<1||request.bins>30)throw new Error('Opciones de análisis no válidas.')
  this.analyses.set(id,request.requestId)
  const ensure=()=>{if(this.analyses.get(id)!==request.requestId||this.states.get(id)!==s||request.revision!==s.revision)throw new Error('Análisis cancelado: la tabla cambió o se recibió otra solicitud.')}
  try{const indices=request.query?await this.indices(id,request.query,ensure):undefined;ensure();const result=await analyzeColumn(s.rows,indices,request,ensure,s.headers[request.column]);ensure();return{...result,revision:s.revision,sample:s.readonly,filtered:!!request.query,column:request.column}}
  finally{if(this.analyses.get(id)===request.requestId)this.analyses.delete(id)}
 }
 async cancelAnalysis(id:string,requestId:string){if(this.analyses.get(id)===requestId)this.analyses.delete(id)}
 async stats(id:string,rowIds:string[]|null,columns:number[],options?:TableStatsOptions):Promise<TableStats>{
  const s=this.get(id),revision=s.revision,requestId=options?.requestId
  if(options&&options.revision!==revision)throw new Error('La tabla cambió. Vuelve a analizar.')
  if(columns.some(col=>!Number.isInteger(col)||col<0||col>=s.headers.length))throw new Error('Columna no válida.')
  if(options?.range&&rowIds!==null)throw new Error('Elige filas marcadas o un rango, sin combinar ambos alcances.')
  // Footer queries keep working without replacing the panel's cancelable request.
  if(requestId)this.analyses.set(id,requestId)
  const ensure=()=>{if(this.states.get(id)!==s||s.revision!==revision||requestId&&this.analyses.get(id)!==requestId)throw new Error('Las estadísticas se cancelaron porque cambió la tabla o la solicitud.')}
  const progress=async(rows:number)=>{if(requestId)this.progress({requestId,phase:'Calculando estadísticas',rows});await yieldTurn();ensure()}
  try{
   await progress(0)
   const bounds=options?.range,range=bounds?await this.rangeRows(id,bounds,ensure):undefined
   const selected=[...new Set(range&&!columns.length?range.columns:columns)]
   if(bounds&&selected.some(col=>col<bounds.left||col>bounds.right))throw new Error('La columna no pertenece al rango seleccionado.')
   const ids=rowIds===null?null:new Set(rowIds),unique=new Set<string>(),nums:number[]=[]
   const limitMessage='El resumen supera dos millones de celdas. Reduce el rango, las filas o las columnas.'
   if((range?.indices.length??(ids===null?s.rows.length:0))*selected.length>TABLE_LIMITS.cells)throw new Error(limitMessage)
   let cells=0,empty=0,missing=0,whitespace=0
   for(let i=0;i<(range?.indices.length??s.rows.length);i++){
    const row=s.rows[range?range.indices[i]:i]
    if(ids===null||ids.has(row.id))for(const col of selected){
     if(++cells>TABLE_LIMITS.cells)throw new Error(limitMessage)
     const value=row.cells[col]??'',number=numeric(value);unique.add(value)
     if(!value.trim()){empty++;if(value.length)whitespace++}if(col>=row.cells.length)missing++
     if(number!==null&&(!Number.isInteger(number)||Number.isSafeInteger(number)))nums.push(number)
     if(cells%512===0)await progress(i+1)
    }
    if(i%2048===0){await yieldTurn();ensure()}
   }
   await progress(range?.indices.length??s.rows.length)
   const result={...descriptive(nums),cells,empty,missing,whitespace,unique:unique.size,numeric:nums.length,excluded:cells-empty-nums.length,revision,sample:s.readonly}
   await yieldTurn();ensure();return result
  }finally{if(requestId&&this.analyses.get(id)===requestId)this.analyses.delete(id)}
 }

 async markdown(id:string,options:TableExport){const {rows,headers}=await this.selected(id,options);const escape=(v:string)=>v.replace(/\\/g,'\\\\').replace(/\|/g,'\\|').replace(/\r\n|\r|\n/g,'<br>');return[headers,headers.map(()=>'---'),...rows].map(row=>'| '+row.map(escape).join(' | ')+' |').join('\n')}
 async serialize(id:string,options?:TableExport):Promise<Buffer>{const s=this.editable(id),revision=s.revision;let records:string[][];if(options){const selection=await this.selected(id,options);records=s.header?[selection.headers,...selection.rows]:selection.rows}else records=s.header?[s.headers.slice(0,s.headerWidth),...s.rows.map(row=>row.cells)]:s.rows.map(row=>row.cells)
  if(this.states.get(id)!==s||s.revision!==revision)throw new Error('La tabla cambió durante la exportación.');
  const text=stringify(records,{delimiter:validDelimiter(options?.delimiter??s.delimiter),record_delimiter:s.eol,eof:options?true:s.finalEol})
  if(!options&&Buffer.byteLength(text,s.encoding==='utf16le'?'utf16le':'utf8')>TABLE_LIMITS.bytes)throw new Error('El resultado supera 50 MiB; reduce la tabla antes de guardarla.')
  const result=iconv.encode(text,s.encoding,{addBOM:s.bom});if(iconv.decode(result,s.encoding)!==text)throw new Error('La codificación seleccionada no representa todos los caracteres. Guarda una copia en UTF-8.');return result
 }
 async markSaved(id:string,expectedRevision?:number){const s=this.get(id);if(expectedRevision===undefined||s.revision===expectedRevision)s.savedToken=s.token;return this.info(id)}
 async snapshot(id:string){const s=this.get(id);return structuredClone({version:2,state:s})}
 async restore(id:string,snapshot:unknown){
  const data=snapshot as {version?:number;state?:State}
  if(![1,2].includes(data?.version??0)||!data.state||!Array.isArray(data.state.rows)||!Array.isArray(data.state.headers))throw new Error('Formato de recuperación no compatible. El archivo se conserva.')
  const s=structuredClone(data.state),allowed=new Set(['cell','header','rows','column',...data.version===2?['rowOrder','columnOrder']:[]])
  if(s.readonly||!s.headers.length||s.headers.some(header=>typeof header!=='string')||s.rows.some(row=>!row||typeof row.id!=='string'||!Array.isArray(row.cells)||row.cells.length>s.headers.length||row.cells.some(v=>typeof v!=='string'))||(s.header?s.headerWidth:0)+s.rows.reduce((n,row)=>n+row.cells.length,0)>TABLE_LIMITS.cells||s.rows.length>TABLE_LIMITS.cells||new Set(s.rows.map(row=>row.id)).size!==s.rows.length)throw new Error('Recuperación CSV no válida. El archivo se conserva.')
  if(!Number.isSafeInteger(s.headerWidth)||s.headerWidth<0||s.headerWidth>s.headers.length||![s.nextId,s.token,s.revision].every(Number.isSafeInteger)||s.nextId<1||s.token<0||s.revision<0||!['utf8','utf16le','win1252'].includes(s.encoding)||!['\n','\r\n','\r'].includes(s.eol)||![s.bom,s.header,s.finalEol].every(value=>typeof value==='boolean'))throw new Error('Metadatos de recuperación no válidos. El archivo se conserva.')
  validDelimiter(s.delimiter)
  if(!Array.isArray(s.history)||!Array.isArray(s.future)||[...s.history,...s.future].some(change=>!change||!Array.isArray(change.forward)||!Array.isArray(change.backward)||[...change.forward,...change.backward].some(mutation=>!mutation||!allowed.has(mutation.type))))throw new Error('Historial de recuperación no compatible. El archivo se conserva.')
  s.savedToken=-1;s.readonly=false;s.warning=undefined;this.serial=Math.max(this.serial,s.token,s.nextId);this.openings.set(id,++this.serial);this.queries.delete(id);this.views.delete(id);s.revision=Math.max(s.revision,this.states.get(id)?.revision??-1)+1;this.states.set(id,s);return this.info(id)
 }
 async close(id:string){for(const [ticket,source] of this.streams)if(source.id===id)await this.analysisClose(ticket);this.analyses.delete(id);this.states.delete(id);this.queries.delete(id);this.views.delete(id);this.openings.delete(id)}
}
