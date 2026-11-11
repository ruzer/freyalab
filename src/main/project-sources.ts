import {createHash} from 'node:crypto'
import {constants,type Stats} from 'node:fs'
import {lstat,open,opendir,realpath,type FileHandle} from 'node:fs/promises'
import {extname,isAbsolute,join,relative} from 'node:path'
import {parse} from 'csv-parse/sync'
import iconv from 'iconv-lite'
import {digest} from './files'
import {metadata} from './csv-file-format'
import {RECORD_DELIMITERS} from './large-table'
import {t} from '../shared/i18n'
import type {TableOptions} from '../shared/types'

const edge=64*1024,preview=1024*1024+4
const searchEntries=25_000,searchBytes=4*1024*1024*1024
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex')
const stamp=({size,mtimeMs,dev,ino}:Stats)=>({bytes:size,mtimeMs,dev,ino})
const unchanged=(before:Stats,after:Stats)=>after.isFile()&&before.size===after.size&&before.mtimeMs===after.mtimeMs&&before.dev===after.dev&&before.ino===after.ino
const outside=(root:string,path:string)=>{const part=relative(root,path);return part==='..'||part.startsWith('../')||part.startsWith('..\\')||isAbsolute(part)}
const isCsv=(path:string)=>['.csv','.tsv'].includes(extname(path).toLowerCase())
const nofollow=process.platform==='win32'?'r':constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK

async function withFile<T>(path:string,run:(file:FileHandle,stat:Stats)=>Promise<T>){
 const expected=await lstat(path)
 if(!expected.isFile())throw new Error(t('project.source.notFile'))
 const handle=await open(path,nofollow)
 try{
  const before=await handle.stat()
  if(!unchanged(expected,before))throw new Error(t('project.source.changed'))
  const result=await run(handle,before)
  const [after,current]=await Promise.all([handle.stat(),lstat(path)])
  if(!unchanged(before,after)||!unchanged(before,current))throw new Error(t('project.source.changed'))
  return result
 }finally{await handle.close()}
}

async function read(file:FileHandle,position:number,length:number){
 const buffer=Buffer.alloc(length)
 let offset=0
 while(offset<length){const {bytesRead}=await file.read(buffer,offset,length-offset,position+offset);if(!bytesRead)break;offset+=bytesRead}
 return buffer.subarray(0,offset)
}

export async function prepareCsvSource(path:string,options:TableOptions&{eol?:'\n'|'\r'|'\r\n'}={}){
 if(!isCsv(path))throw new Error(t('project.source.notCsv'))
 return withFile(path,async(file,info)=>{
  const bytes=await read(file,0,Math.min(info.size,preview))
  const {encoding,bom,delimiter,header,eol}=metadata(bytes,options,path.toLowerCase())
  const tail=await read(file,Math.max(0,info.size-4),Math.min(info.size,4))
  const finalEol=/[\r\n]$/.test(iconv.decode(tail,encoding))
  let names:string[]
  try{const [first]=parse(iconv.decode(bytes,encoding),{delimiter,bom:true,to:1,raw:true,relax_column_count:true,record_delimiter:RECORD_DELIMITERS}) as unknown as {record:string[];raw:string}[]
   if(bytes.length<info.size&&(!first||!/[\r\n]$/.test(first.raw)))throw new Error(t('project.source.header'))
   names=first?.record??[]
  }catch{throw new Error(t('project.source.header'))}
  const columns=names.map((name,index)=>({position:index+1,name:header?name:''}))
  return{...stamp(info),format:{encoding,bom,delimiter,header,eol:options.eol??eol,finalEol},columns}
 })
}

export async function fingerprintCsvSource(path:string,options:{signal?:AbortSignal;progress?:(done:number,total:number)=>void}={}){
 options.signal?.throwIfAborted()
 return withFile(path,async(file,info)=>{
  let head=Buffer.alloc(0),tail=Buffer.alloc(0),done=0,lastProgress=0
  const sha256=await digest(file,{signal:options.signal,observe(chunk){
   if(head.length<edge)head=Buffer.concat([head,chunk.subarray(0,edge-head.length)])
   tail=chunk.length>=edge?Buffer.from(chunk.subarray(chunk.length-edge)):Buffer.concat([tail.subarray(Math.max(0,tail.length+chunk.length-edge)),chunk])
   done+=chunk.length
   const now=performance.now()
   if(done===info.size||now-lastProgress>=50||!lastProgress){lastProgress=now;options.progress?.(done,info.size)}
  }})
  if(!info.size)options.progress?.(0,0)
  if(done!==info.size)throw new Error(t('project.source.changed'))
  options.signal?.throwIfAborted()
  return{...stamp(info),sha256,quick:{mtimeMs:info.mtimeMs,headSha256:sha(head),tailSha256:sha(tail)}}
 })
}

export async function quickCsvSource(path:string){
 return withFile(path,async(file,info)=>{
  const length=Math.min(info.size,edge),head=await read(file,0,length)
  const tail=info.size<=edge?head:await read(file,info.size-length,length)
  return{bytes:info.size,quick:{mtimeMs:info.mtimeMs,headSha256:sha(head),tailSha256:sha(tail)}}
 })
}

export async function findSourceByFingerprint(folder:string,bytes:number,sha256:string,signal?:AbortSignal){
 const root=await realpath(folder),queue=[root]
 let scanned=0,readBytes=0
 while(queue.length){
  signal?.throwIfAborted()
  const path=queue.pop()!,directoryPath=await realpath(path).catch(()=>null)
  if(!directoryPath||outside(root,directoryPath)||directoryPath!==path)continue
  const directory=await opendir(directoryPath).catch(()=>null)
  if(!directory)continue
  for await(const entry of directory){
   signal?.throwIfAborted()
   if(++scanned>searchEntries)throw new Error(t('project.source.searchLimit'))
   if(entry.isSymbolicLink())continue
   const file=join(directoryPath,entry.name)
   if(entry.isDirectory()){queue.push(file);continue}
   if(!entry.isFile()||!isCsv(file))continue
   const info=await lstat(file).catch(()=>null),canonical=await realpath(file).catch(()=>null)
   if(!info?.isFile()||info.size!==bytes||!canonical||canonical!==file||outside(root,canonical))continue
   if((readBytes+=bytes)>searchBytes)throw new Error(t('project.source.searchLimit'))
   const found=await fingerprintCsvSource(canonical,{signal})
   if(found.sha256===sha256)return canonical
  }
 }
 return null
}
