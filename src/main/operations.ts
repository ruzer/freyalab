import {lstat,open as openFile, realpath, rename, rm, statfs} from 'node:fs/promises'
import {dirname,join} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {setTimeout as sleep} from 'node:timers/promises'
import {parse as parseSync} from 'csv-parse/sync'
import {stringify} from 'csv-stringify/sync'
import iconv from 'iconv-lite'
import {recordBatches,indexUnchanged,LargeFormatError,RECORD_DELIMITERS,type LargeIndex} from './large-table'
import {compileTableQuery} from './table-query'
import type {Encoding} from '../shared/types'
import type {EngineOperation,OperationResult,Fidelity} from '../shared/operations'
import {t} from '../shared/i18n'

// E1 · Motor propio estricto para las operaciones sobre un archivo grande (src/shared/operations.ts).
// El archivo se recorre UNA vez en flujo con el escáner de L2 (que delimita los registros por posición) y cada lote se valida con csv-parse, que rechaza
// comillas mal formadas; el número de registros de csv-parse debe coincidir con el del escáner. Un registro nunca se rellena ni se repara en silencio.
export class OperationCancelled extends Error { constructor() { super('Operación cancelada.') } }
export class StrictRecordError extends Error {}
export interface OperationSourceState {index:LargeIndex;encoding:Encoding;delimiter:string;header:boolean;bom:boolean;eol:string;finalEol:boolean;headers:string[];headerWidth:number}
export interface OperationHooks {progress?:(percent:number)=>void;cancelled:()=>boolean;batchRecords?:number;delayMs?:number;freeBytes?:(dir:string)=>Promise<number>}
// El extracto nunca pasa del tamaño del original (se copian registros o se quitan columnas, con el mismo fin de línea y la misma codificación): ese es el peor caso que se comprueba antes de escribir.
const SPACE_MARGIN=64*1024*1024
const mib=(bytes:number)=>`${Math.ceil(bytes/1048576).toLocaleString('es')} MiB`
async function freeBytes(dir:string){try{const s=await statfs(dir);return Number(s.bavail)*Number(s.bsize)}catch{return Infinity}} // sistema de archivos sin statfs: no se bloquea

const eolName=(eol:string)=>eol==='\r\n'?'CRLF':eol==='\n'?'LF':eol==='\r'?'CR':JSON.stringify(eol)
export const extractBomBytes=(encoding:Encoding)=>encoding==='utf16le'?Buffer.from([0xff,0xfe]):Buffer.from([0xef,0xbb,0xbf])
export function extractValues(rows:string[][],format:{encoding:Encoding;delimiter:string;eol:string}){
 return iconv.encode(stringify(rows,{delimiter:format.delimiter,record_delimiter:format.eol,quoted_match:/[\r\n]/}),format.encoding)
}
export async function createExtractWriter(output:string,sourceBytes:number,options:{freeBytes?:(directory:string)=>Promise<number>;fingerprint?:boolean;temporaryDirectory?:string;beforeOpen?:()=>Promise<void>}={}){
 for(const directory of new Set([dirname(output),options.temporaryDirectory??dirname(output)])){
  const free=await(options.freeBytes??freeBytes)(directory)
  if(free<sourceBytes+SPACE_MARGIN)throw new Error(`No hay espacio suficiente en el destino: el extracto puede ocupar hasta ${mib(sourceBytes)} y quedan ${mib(free)} libres.`)
 }
 const temporaryStamp=options.temporaryDirectory?await lstat(options.temporaryDirectory):undefined
 await options.beforeOpen?.()
 let temp:string|undefined=options.temporaryDirectory?join(options.temporaryDirectory,`freya-export-${randomUUID()}.tmp`):`${output}.${randomUUID()}.tmp`,handle:Awaited<ReturnType<typeof openFile>>|undefined=await openFile(temp,'wx'),bytes=0
 const hash=options.fingerprint?createHash('sha256'):undefined
 return{
  get bytes(){return bytes},
  async write(data:Buffer){let offset=0;while(offset<data.length){const written=await handle!.write(data,offset,data.length-offset);if(!written.bytesWritten)throw new Error(t('project.export.writeFailed'));offset+=written.bytesWritten}bytes+=data.length;hash?.update(data)},
  async publish(beforeRename?:()=>void|Promise<void>){const stamp=options.fingerprint?await handle!.stat():undefined;await handle!.close();handle=undefined;await beforeRename?.();await rename(temp!,output);temp=undefined;return options.fingerprint?{bytes,sha256:hash!.digest('hex'),mtimeMs:stamp!.mtimeMs}:undefined},
  async close(){
   await handle?.close().catch(()=>{})
   if(temp){
    if(temporaryStamp){const path=options.temporaryDirectory!,current=await lstat(path);if(!current.isDirectory()||current.isSymbolicLink()||current.dev!==temporaryStamp.dev||current.ino!==temporaryStamp.ino||await realpath(path)!==path)throw new Error(t('project.export.destinationChanged'))}
    await rm(temp,{force:true}).catch(()=>{})
   }
  }
 }
}
// File signatures have already been skipped; preserve literal U+FEFF at batch boundaries.
const decoderUtf8=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true})
function decode(bytes:Buffer,encoding:Encoding){return encoding==='utf8'?decoderUtf8.decode(bytes):iconv.decode(bytes,encoding,{stripBOM:false})}
const recordNumber=(ordinal:number)=>(ordinal+1).toLocaleString('es')
function parseRecords(text:string,state:Pick<OperationSourceState,'delimiter'>){
 // Sin CR, solo LF puede delimitar registros; los finales mixtos conservan la ruta completa.
 return parseSync(text,{delimiter:state.delimiter,bom:false,relax_column_count:true,skip_empty_lines:false,record_delimiter:text.includes('\r')?RECORD_DELIMITERS:'\n'}) as string[][]
}
// Valida y separa en campos un lote de registros (bytes exactos). Si el lote falla, se localiza el primer registro culpable para dar su posición.
export function fieldsOf(raws:Buffer[],first:number,state:Pick<OperationSourceState,'encoding'|'delimiter'>):string[][]{
 try {
  const rows=parseRecords(decode(Buffer.concat(raws),state.encoding),state)
  if(rows.length!==raws.length)throw new StrictRecordError(`El registro ${recordNumber(first)} y los siguientes no se pueden delimitar igual con el escáner y con el analizador estricto (${raws.length} frente a ${rows.length}).`)
  return rows
 } catch(error) {
  for(let i=0;i<raws.length;i++){
   try { const rows=parseRecords(decode(raws[i],state.encoding),state); if(rows.length!==1)throw new Error(`${rows.length} registros`) }
   catch(inner) { throw new StrictRecordError(`El registro ${recordNumber(first+i)} no es un CSV válido: ${(inner as Error).message.replace(/^.*?: /,'')}`,{cause:inner}) }
  }
  throw error instanceof StrictRecordError?error:new StrictRecordError(`El registro ${recordNumber(first)} y los siguientes no son un CSV válido: ${(error as Error).message}`,{cause:error})
 }
}
export async function runOperation(state:OperationSourceState,request:EngineOperation,hooks:OperationHooks):Promise<OperationResult>{
 const started=performance.now(),width=state.headers.length,total=state.index.records-(state.header?1:0)
 const columns=request.operation==='count'?undefined:request.columns
 if(columns?.some(column=>column>=width))throw new Error('Una de las columnas elegidas no existe en este archivo.')
 const compiled=compileTableQuery({search:request.search,conditions:request.conditions?.conditions,filterMode:request.conditions?.filterMode,offset:0,limit:1,requestId:0},width)
 const project=(fields:string[],ordinal:number)=>{
  if(!columns)return fields
  return columns.map(column=>{ if(column>=fields.length)throw new StrictRecordError(`El registro ${recordNumber(ordinal)} solo tiene ${fields.length} campos y falta la columna ${column+1}: no se rellena en silencio.`); return fields[column] })
 }
 const wholeRecords=request.operation==='filter_extract'&&!columns
 let writer:Awaited<ReturnType<typeof createExtractWriter>>|undefined
 const write=async(data:Buffer)=>{if(data.length)await writer!.write(data)}
 const eol=state.eol
 let matched=0,scanned=0,irregular=0,headerFields:string[]|undefined,rows:string[][]=[]
 const limit=request.operation==='preview'?request.limit:Infinity
 let complete=true
 try {
  if(request.operation==='filter_extract'){
    writer=await createExtractWriter(request.output,state.index.size,{freeBytes:hooks.freeBytes})
    if(state.bom)await write(extractBomBytes(state.encoding))
  }
  scanning:
  for await(const batch of recordBatches(state.index,{batchRecords:hooks.batchRecords,cancelled:hooks.cancelled})){
   if(hooks.cancelled())throw new OperationCancelled()
   const parsed=fieldsOf(batch.records,batch.first,state),projected:string[][]=[],copied:Buffer[]=[] // un solo write por lote
   for(let i=0;i<parsed.length;i++){
    const ordinal=batch.first+i,fields=parsed[i]
    if(state.header&&ordinal===0){
     headerFields=fields
     if(request.operation==='filter_extract'){ if(wholeRecords)copied.push(batch.records[i]); else projected.push(project(fields,ordinal)) }
     continue
    }
    scanned++
    if(fields.length!==state.headerWidth&&state.header)irregular++
    if(!compiled.matches(fields))continue
    matched++
    if(request.operation==='preview'){ rows.push(project(fields,ordinal)); if(rows.length>=limit){ complete=false; break scanning } }
    else if(request.operation==='filter_extract'){ if(wholeRecords)copied.push(batch.records[i]); else projected.push(project(fields,ordinal)) }
   }
   if(copied.length)await write(Buffer.concat(copied))
   if(request.operation==='filter_extract'&&!wholeRecords&&projected.length)await write(extractValues(projected,state))
   hooks.progress?.(Math.min(99,Math.floor(batch.position/state.index.size*100)))
   if(hooks.delayMs)await sleep(hooks.delayMs)
  }
  if(!await indexUnchanged(state.index))throw new StrictRecordError('El archivo cambió durante la operación. Vuelve a abrirlo; no se completó el extracto.')
  hooks.progress?.(100)
  if(request.operation==='count')return {operation:'count',matched,scanned}
  if(request.operation==='preview'){
   const names=state.header?(headerFields??state.headers):state.headers
   return {operation:'preview',headers:columns?columns.map(column=>names[column]??''):names,rows,found:rows.length,scanned,complete}
  }
   await writer!.publish()
  const normalization=wholeRecords?[]:[
   'Solo las columnas elegidas, en el orden elegido.',
   'Comillado mínimo: solo se entrecomillan los campos que lo necesitan.',
   `Fin de línea ${eolName(eol)} en todos los registros${state.finalEol?'':', también tras el último'}.`,
   ...(state.bom?['Se conserva la marca de orden de bytes (BOM) y la codificación del original.']:['Se conserva la codificación del original.'])
  ]
  const fidelity:Fidelity=wholeRecords?'bytes':'values'
   return {operation:'filter_extract',output:request.output,matched,scanned,bytes:writer!.bytes,fidelity,normalization,irregularRows:irregular,elapsedMs:Math.round(performance.now()-started)}
 } catch(error) {
  if(error instanceof LargeFormatError)throw new StrictRecordError(error.message)
  throw error
 } finally {
   await writer?.close()
 }
}
