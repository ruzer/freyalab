#!/usr/bin/env node
// PoC 1: superposición + guardado en flujo sobre un archivo grande (hasta 5 GiB).
//   node run-overlay-scale.mjs --file /ruta/fixture.csv --edits 1000 --results results/overlay-5GiB.json
// Copia el fixture con clonación si el sistema de archivos la admite (APFS, btrfs, XFS), indexa, lee páginas, edita, simula un cierre
// brusco y recupera, guarda, verifica por hash que NADA fuera de los registros editados cambió, y hace un cambio masivo en flujo.
import {copyFile,constants,statfs,rm,open,mkdir,writeFile,mkdtemp,stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {tmpdir} from 'node:os'
import {join,dirname,resolve} from 'node:path'
import {parse} from 'csv-parse/sync'
import {LargeDocument,bulkTransform} from './lib/document.mjs'
import {buildIndex,recordBounds} from './lib/record-index.mjs'
import {decode,splitEol} from './lib/fields.mjs'

const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,all)=>x.startsWith('--')?[...a,[x.slice(2),all[i+1]?.startsWith('--')||all[i+1]===undefined?true:all[i+1]]]:a,[]))
const file=resolve(args.file??(()=>{throw new Error('--file es obligatorio')})()),edits=Number(args.edits??1000),resultsPath=resolve(args.results??'results/overlay.json')
const work=`${file}.work`,v2=`${file}.v2`,journalDir=await mkdtemp(join(tmpdir(),'fl-journal-'))
const MiB=2**20,free=async()=>{const s=await statfs(dirname(file));return s.bavail*s.bsize}
const out={file,platform:`${process.platform}-${process.arch}`,node:process.version,edits,phases:{}}

async function phase(name,fn){
 let peak=0,heap=0;const t=setInterval(()=>{const m=process.memoryUsage();peak=Math.max(peak,m.rss);heap=Math.max(heap,m.heapUsed)},50)
 const free0=await free(),t0=performance.now(),value=await fn(),ms=performance.now()-t0;clearInterval(t)
 const m=process.memoryUsage();out.phases[name]={ms:Math.round(ms),peakRssMiB:Math.round(Math.max(peak,m.rss)/MiB),peakHeapMiB:Math.round(Math.max(heap,m.heapUsed)/MiB),diskDeltaMiB:Math.round((free0-await free())/MiB),...value}
 console.log(name,JSON.stringify(out.phases[name]));return value
}
const hashRange=async(handle,start,end)=>{const h=createHash('sha256'),buf=Buffer.allocUnsafe(8*MiB);for(let p=start;p<end;){const {bytesRead}=await handle.read(buf,0,Math.min(buf.length,end-p),p);if(!bytesRead)break;h.update(buf.subarray(0,bytesRead));p+=bytesRead}return h.digest('hex')}
const percentile=(list,q)=>[...list].sort((a,b)=>a-b)[Math.floor((list.length-1)*q)]
const rng=(()=>{let a=42;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}})()

const size=(await stat(file)).size;out.fileBytes=size
await phase('clone',async()=>{await rm(work,{force:true});await copyFile(file,work,constants.COPYFILE_FICLONE);return {}})
let doc
await phase('index',async()=>{doc=await LargeDocument.open(work,{journalDir});return {records:doc.index.records,indexKiB:Math.round(doc.index.offsets.byteLength/1024),mibPerS:Math.round(size/MiB/((performance.now()-0)/1000))}})
out.phases.index.mibPerS=Math.round(size/MiB/(out.phases.index.ms/1000))
const records=doc.index.records
await phase('pages',async()=>{const lat=[];for(let i=0;i<300;i++){const from=Math.floor(rng()*(records-60));const t=performance.now();const page=await doc.page(from,50);lat.push(performance.now()-t);if(page.length!==50)throw new Error('página corta')}
 const t=performance.now();await doc.page(records-10,50);return {pageRecords:50,p50ms:+percentile(lat,.5).toFixed(2),p95ms:+percentile(lat,.95).toFixed(2),maxMs:+Math.max(...lat).toFixed(2),lastPageMs:+(performance.now()-t).toFixed(2)}})
const chosen=new Map()
while(chosen.size<edits)chosen.set(1+Math.floor(rng()*(records-1)),null)
const header=(await doc.page(0,1))[0].values,expected=new Map()
await phase('edits',async()=>{let n=0;for(const ordinal of chosen.keys()){const col=Math.floor(rng()*header.length),value=n%3===0?`edit, "${n}"`:`EDIT-${n}`;n++
  expected.set(ordinal,{col,value});await doc.setCell(ordinal,col,value)}await doc.flush();return {perEditMs:+(out.phases.edits?.ms/edits||0)}})
out.phases.edits.perEditMs=+(out.phases.edits.ms/edits).toFixed(3)
await phase('recover',async()=>{await doc.close();doc=await LargeDocument.open(work,{journalDir});return {recoveredOps:doc.recovered,matches:doc.recovered===edits}})
const before=await buildIndex(file,{every:1024}).then(i=>i) // índice del original para verificar
await phase('save',async()=>{await doc.save();return {finalBytes:(await stat(work)).size,deltaBytes:(await stat(work)).size-size}})
await phase('verify',async()=>{
 const after=await buildIndex(work,{every:1024});if(after.records!==before.records)throw new Error('cambió el número de registros')
 const incremental=Buffer.compare(Buffer.from(doc.index.offsets.buffer),Buffer.from(after.offsets.buffer))===0&&doc.index.size===after.size
 const oh=await open(file,'r'),nh=await open(work,'r');let oc=0,nc=0,gaps=0
 try{for(const ordinal of [...chosen.keys()].sort((a,b)=>a-b)){
   const [[os,oe]]=await recordBounds(oh,before,ordinal,1),[[ns,ne]]=await recordBounds(nh,after,ordinal,1)
   const [a,b]=await Promise.all([hashRange(oh,oc,os),hashRange(nh,nc,ns)]);if(a!==b)throw new Error(`bytes distintos antes del registro ${ordinal}`);gaps++
   const raw=Buffer.alloc(oe-os),neu=Buffer.alloc(ne-ns);await oh.read(raw,0,raw.length,os);await nh.read(neu,0,neu.length,ns)
   const want=parse(splitEol(decode(raw,'utf8')).body,{relax_column_count:true})[0],got=parse(splitEol(decode(neu,'utf8')).body,{relax_column_count:true})[0],{col,value}=expected.get(ordinal)
   while(want.length<=col)want.push('');want[col]=value;if(JSON.stringify(want)!==JSON.stringify(got))throw new Error(`registro ${ordinal} distinto del esperado`)
   oc=oe;nc=ne}
  const [a,b]=await Promise.all([hashRange(oh,oc,size),hashRange(nh,nc,(await nh.stat()).size)]);if(a!==b)throw new Error('bytes distintos tras el último registro editado');gaps++
 }finally{await oh.close();await nh.close()}
 return {editedRecordsChecked:chosen.size,untouchedSegmentsHashEqual:gaps,incrementalIndexMatchesRebuilt:incremental}})
let beforeBulk=(await stat(work)).size
if(!args['skip-bulk']){
await phase('bulk',async()=>{beforeBulk=(await stat(work)).size;await rm(v2,{force:true})
 const column=3,r=await bulkTransform(work,v2,(v,i)=>i===0||v.length<=column?undefined:Object.assign([...v],{[column]:v[column].toUpperCase()}),{delimiter:','})
 return {records:r.records,changed:r.changed,outputBytes:(await stat(v2)).size,mibPerS:0}})
out.phases.bulk.mibPerS=Math.round(beforeBulk/MiB/(out.phases.bulk.ms/1000))
await phase('bulk-verify',async()=>{ // 300 registros al azar de la versión nueva frente a la anterior: solo cambia la columna 3, en mayúsculas
 const doc2=await LargeDocument.open(v2,{journalDir,recover:false});if(doc2.index.records!==doc.index.records)throw new Error('distinto número de registros')
 let checked=0;for(let k=0;k<300;k++){const ordinal=1+Math.floor(rng()*(records-1)),[a]=await doc.page(ordinal,1),[b]=await doc2.page(ordinal,1)
  const want=a.values.map((v,i)=>i===3?v.toUpperCase():v);if(JSON.stringify(want)!==JSON.stringify(b.values))throw new Error(`registro ${ordinal} distinto`);checked++}
 await doc2.close();return {sampledRecordsEqual:checked}})
await phase('versions',async()=>{ // «volver a la versión anterior» = el archivo anterior sigue ahí, intacto; cambiar de versión no carga nada en RAM
 const same=(await stat(work)).size===beforeBulk;return {previousVersionIntact:same,extraDiskMiB:Math.round((await stat(v2)).size/MiB)}})
}
await mkdir(dirname(resultsPath),{recursive:true});await writeFile(resultsPath,JSON.stringify(out,null,1)+'\n')
await doc.close();await rm(journalDir,{recursive:true,force:true});if(!args.keep){await rm(work,{force:true});await rm(v2,{force:true})}
console.log('listo',resultsPath)
