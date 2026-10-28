// S0 only: benchmarks the real L2 reader without changing the application.
import {open} from 'node:fs/promises'
import {isUtf8} from 'node:buffer'
import {performance} from 'node:perf_hooks'
import {parse} from 'csv-parse/sync'
import iconv from 'iconv-lite'
import {recordBatches,splitFields,type LargeIndex} from '../../src/main/large-table'
import {compileTableQuery} from '../../src/main/table-query'
import {runOperation} from '../../src/main/operations'
import {pickFields} from '../large-file-editor/lib/fields.mjs'

const decoder=new TextDecoder('utf-8',{fatal:true})
export const decode=(raw:Buffer,index:LargeIndex)=>index.encoding==='utf8'?decoder.decode(raw):iconv.decode(raw,index.encoding)
export const body=(text:string)=>text.replace(/(\r\n|\n|\r)$/,'')
export function strictRows(raws:Buffer[],index:LargeIndex,delimiter:string){
 const rows=parse(decode(Buffer.concat(raws),index),{delimiter,bom:false,relax_column_count:true,skip_empty_lines:false,record_delimiter:index.terminator===13?['\r']:['\r\n','\n']}) as string[][]
 if(rows.length!==raws.length)throw new Error('Scanner/strict record count differs')
 return rows
}
export function byteCandidate(raw:Buffer,needle:string,index:LargeIndex,delimiter:string){
 if(index.encoding==='utf16le'||!/^[\x00-\x7f]+$/.test(needle)||[delimiter,'"','\r','\n'].some(value=>needle.includes(value)))return true
 if(index.encoding==='utf8'&&(raw.includes(Buffer.from('K'))||raw.includes(Buffer.from('İ'))))return true
 const folded=Buffer.from(raw)
 for(let i=0;i<folded.length;i++)if(folded[i]>=65&&folded[i]<=90)folded[i]+=32
 return folded.includes(Buffer.from(needle.toLocaleLowerCase()))
}
// Validate quote boundaries before delegating values to the existing splitter; no repair or relaxed quoting.
export function validateQuotes(raw:Buffer,index:LargeIndex,delimiter:string){
 const bytes=index.unit===2?Buffer.from(body(decode(raw,index))):raw
 let end=bytes.length
 if(bytes[end-1]===10){end--;if(bytes[end-1]===13)end--}else if(bytes[end-1]===13)end--
 let next=0
 while(true){
  const quote=bytes.indexOf(34,next);if(quote<0||quote>=end)return
  if(quote!==0&&bytes[quote-1]!==delimiter.charCodeAt(0))throw new Error('Invalid unquoted CSV field')
  let closing=quote
  while(true){closing=bytes.indexOf(34,closing+1);if(closing<0||closing>=end)throw new Error('Unclosed quoted CSV field');if(bytes[closing+1]===34){closing++;continue}break}
  if(closing+1!==end&&bytes[closing+1]!==delimiter.charCodeAt(0))throw new Error('Invalid quoted CSV field')
  next=closing+1
 }
}
export type Strategy='strict'|'own'|'prefilter'|'partial'|'fullCondition'|'operation'
export async function scan(index:LargeIndex,strategy:Strategy,needle:string,options:{delimiter?:string;column?:number;batchRecords?:number;chunk?:number;ordinalBase?:number;cancelled?:()=>boolean;retain?:boolean}={}){
 const started=performance.now(),delimiter=options.delimiter??',',base=options.ordinalBase??0,lower=needle.toLocaleLowerCase(),needleBytes=Buffer.from(lower)
 // shortcut: S0 fixtures are below 4 GiB and 2^32 rows; production must choose its own bounded representation.
 if(index.size>=2**32||index.records>=2**32)throw new Error('S0 position representation exceeded')
 const list=options.retain?new Uint32Array(index.records*3):undefined
 const column=options.column??2,compiled=compileTableQuery({conditions:[{column,op:'contains',value:needle}],offset:0,limit:1,requestId:1},230)
 const pick=pickFields(new Set([column]),delimiter)
 let count=0,scanned=0,sum=0,xor=0,position=index.bomLength
 if(strategy==='operation'){
  const result=await runOperation({index,encoding:index.encoding,delimiter,header:base===0,bom:index.bomLength>0,eol:'\r\n',finalEol:true,headers:Array.from({length:230},(_,i)=>String(i)),headerWidth:230},{operation:'count',requestId:crypto.randomUUID(),source:{revision:0},conditions:{conditions:[{column,op:'contains',value:needle}],filterMode:'all'}},{cancelled:options.cancelled??(()=>false),batchRecords:options.batchRecords})
  return {strategy,count:'matched' in result?result.matched:0,scanned:'scanned' in result?result.scanned:0,ms:performance.now()-started,rss:process.memoryUsage().rss,maxRss:process.resourceUsage().maxRSS*1024}
 }
 for await(const batch of recordBatches(index,{batchRecords:options.batchRecords,chunk:options.chunk,cancelled:options.cancelled})){
  if(options.cancelled?.())throw new Error('Cancelled')
  const records=batch.records.slice(0,index.records-batch.first)
  const bytes=Buffer.concat(records)
  if(strategy!=='strict'){
   if(index.encoding==='utf8'&&!isUtf8(bytes))throw new Error('Invalid UTF-8')
   for(const raw of records)validateQuotes(raw,index,delimiter)
  }
  const strict=strategy==='strict'?strictRows(records,index,delimiter):undefined
  let folded:Buffer|undefined
  if(strategy==='prefilter'&&index.unit===1&&/^[\x00-\x7f]+$/.test(needle)&&![delimiter,'"','\r','\n'].some(value=>needle.includes(value))&&!(index.encoding==='utf8'&&(bytes.includes(Buffer.from('K'))||bytes.includes(Buffer.from('İ'))))){
   folded=bytes;for(let i=0;i<folded.length;i++)if(folded[i]>=65&&folded[i]<=90)folded[i]+=32
  }
  const candidate=!folded||folded.includes(needleBytes);let rawOffset=0
  for(let i=0;i<records.length;i++){
   const raw=records[i],ordinal=base+batch.first+i,start=position,from=rawOffset;position+=raw.length;rawOffset+=raw.length
   if(ordinal===0)continue
   scanned++
   if(!candidate)continue
   if(folded&&!folded.subarray(from,rawOffset).includes(needleBytes))continue
   const text=strict?undefined:body(decode(raw,index))
   const fields=strict?.[i]??(strategy==='partial'?Array.from({length:column+1},(_,i)=>i===column?(pick(text).get(column)??''):''):splitFields(text!,delimiter))
   const matches=strategy==='partial'||strategy==='fullCondition'?compiled.matches(fields):fields.some(value=>value.toLocaleLowerCase().includes(lower))
   if(matches){if(list)list.set([ordinal,start,raw.length],count*3);count++;sum=(sum+ordinal)>>>0;xor^=ordinal}
  }
  if(batch.first+records.length>=index.records)break
 }
 return {strategy,count,scanned,sum,xor,ms:performance.now()-started,rss:process.memoryUsage().rss,maxRss:process.resourceUsage().maxRSS*1024,...(list?{list:count*3===list.length?list:list.slice(0,count*3)}:{})}
}
export async function directPage(index:LargeIndex,triples:Uint32Array){
 const handle=await open(index.path,'r')
 try{
  const out:string[]=[],started=performance.now();let bytes=0
  for(let i=0;i<triples.length;i+=3){const raw=Buffer.alloc(triples[i+2]);const result=await handle.read(raw,0,raw.length,triples[i+1]);if(result.bytesRead!==raw.length)throw new Error('Short direct record read');out.push(body(decode(raw,index)));bytes+=raw.length}
  return {ms:performance.now()-started,bytes,rows:out}
 }finally{await handle.close()}
}
