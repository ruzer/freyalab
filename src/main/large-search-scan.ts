import {isUtf8} from 'node:buffer'
import iconv from 'iconv-lite'
import {recordBatches,splitFields,validateRecordQuotes,type LargeIndex} from './large-table'
import {compileTableQuery} from './table-query'
import type {LargeViewQuery} from '../shared/types'

export interface SearchRange {from:number;to:number;first:number}
export interface SearchChunk {rows:Float64Array<ArrayBuffer>;positions:Float64Array<ArrayBuffer>;lengths:Uint32Array<ArrayBuffer>;scanned:number;position:number}
export interface SearchTask {taskId:number;index:LargeIndex;range:SearchRange;query:LargeViewQuery;delimiter:string;header:boolean;width:number;cancel:SharedArrayBuffer;stop:SharedArrayBuffer;batchRecords?:number;chunk?:number;delayMs?:number;prefilter?:boolean;partial?:boolean}
export async function scanSearch(task:SearchTask,send:(chunk:SearchChunk)=>void|Promise<void>){
 const {index,range,query,delimiter,header,width}=task,flag=new Int32Array(task.cancel),stop=new Int32Array(task.stop),cancelled=()=>Atomics.load(flag,0)!==0||Atomics.load(stop,0)!==0,compiled=compileTableQuery({...query,offset:0,limit:1,requestId:0},width)
 const necessary=query.search??(query.conditions?.length&&((query.filterMode??'all')==='all'||query.conditions.length===1)?query.conditions.find(rule=>rule.op==='contains'&&rule.value)?.value:undefined)
 const lower=necessary?.toLocaleLowerCase(),prefilter=task.prefilter!==false&&!!lower&&index.unit===1&&/^[\x00-\x7f]+$/.test(necessary!)&&/^[\x00-\x7f]+$/.test(lower)&&![delimiter,'"','\r','\n'].some(value=>necessary!.includes(value)),needle=lower?Buffer.from(lower):undefined
 const through=task.partial!==false&&!query.search&&query.conditions?.length?Math.max(...query.conditions.map(rule=>rule.column)):undefined
 let scanned=0,position=range.from,lastProgress=0
 try{for await(const batch of recordBatches(index,{...range,batchRecords:task.batchRecords??512,batchBytes:1024*1024,chunk:task.chunk??1024*1024,cancelled})){
  if(cancelled())break
  const bytes=Buffer.concat(batch.records),utf8=index.encoding==='utf8'
  if(utf8&&!isUtf8(bytes)){
   const bad=batch.records.findIndex(raw=>!isUtf8(raw));throw new Error(`El registro ${batch.first+bad+1} no es UTF-8 válido.`)
  }
  let folded:Buffer|undefined
  if(prefilter&&!(utf8&&(bytes.includes(Buffer.from('K'))||bytes.includes(Buffer.from('İ'))))){folded=bytes;for(let i=0;i<folded.length;i++)if(folded[i]>=65&&folded[i]<=90)folded[i]+=32}
  const candidate=!folded||folded.includes(needle!),rows:number[]=[],positions:number[]=[],lengths:number[]=[];let cursor=0
  for(let i=0;i<batch.records.length;i++){
   if(cancelled())break
   const raw=batch.records[i],ordinal=batch.first+i,start=position,from=cursor;position+=raw.length;cursor+=raw.length
   try{validateRecordQuotes(raw,index,delimiter)}catch(error){throw new Error(`El registro ${ordinal+1} (byte ${start}) no es un CSV válido: ${(error as Error).message}`)}
   if(header&&ordinal===0)continue
   scanned++
   if(!candidate||(folded&&!folded.subarray(from,cursor).includes(needle!)))continue
   const text=(utf8?raw.toString('utf8'):iconv.decode(raw,index.encoding)).replace(/(\r\n|\n|\r)$/,'')
   if(compiled.matches(splitFields(text,delimiter,through))){rows.push(ordinal+(header?0:1));positions.push(start);lengths.push(raw.length)}
  }
  if(rows.length||performance.now()-lastProgress>=250){await send({rows:Float64Array.from(rows),positions:Float64Array.from(positions),lengths:Uint32Array.from(lengths),scanned,position});lastProgress=performance.now()}
  if(task.delayMs)await new Promise(resolve=>setTimeout(resolve,task.delayMs))
 }}catch(error){if(!cancelled())throw error}
 return {scanned,position,cancelled:cancelled()}
}
