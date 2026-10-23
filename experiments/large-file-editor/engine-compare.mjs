#!/usr/bin/env node
// Comparación de motores para operar sobre un CSV grande sin cargarlo entero. Un proceso por (motor, tarea): memoria máxima limpia.
//   node engine-compare.mjs --engine csv-parse|own|duckdb-native|duckdb-wasm --task count|filter|groupby|analyze|sort-full --file X.csv [--install DIR] [--memory 2GB] [--temp DIR]
// Perfil «wide»: columna 3 = NOM_MUN (texto), columnas 8..37 = enteros. Escribe una línea JSON al final.
import {createRequire} from 'node:module'
import {createReadStream} from 'node:fs'
import {readdir,stat,mkdir,rm} from 'node:fs/promises'
import {join,resolve,dirname} from 'node:path'
import {createHash} from 'node:crypto'
import {eachRecord} from './lib/record-index.mjs'

const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,all)=>x.startsWith('--')?[...a,[x.slice(2),all[i+1]]]:a,[]))
const {engine,task}=args,file=resolve(args.file),NUM=Array.from({length:30},(_,i)=>8+i),MiB=2**20
const here=createRequire(import.meta.url)
const digest=value=>createHash('sha1').update(JSON.stringify(value,(k,v)=>typeof v==='bigint'?Number(v):v)).digest('hex').slice(0,12)
const fmt=n=>Number.isFinite(n)?n:null

// Estado compartido de las tareas para los motores que recorren registros (csv-parse y own).
function accumulator(){
 const state={rows:0,hits:0,groups:new Map(),cols:NUM.map(()=>({nonEmpty:0,numeric:0,min:Infinity,max:-Infinity,sum:0}))}
 const visit=(get,ordinal)=>{ // get(i) devuelve el texto del campo i
  if(ordinal===0)return;state.rows++
  const mun=get(3)
  if(task==='filter'&&mun==='Mérida')state.hits++
  if(task==='groupby')state.groups.set(mun,(state.groups.get(mun)??0)+1)
  if(task==='analyze')NUM.forEach((c,k)=>{const v=get(c),s=state.cols[k];if(v===''||v===undefined)return;s.nonEmpty++;const n=Number(v);if(Number.isFinite(n)){s.numeric++;if(n<s.min)s.min=n;if(n>s.max)s.max=n;s.sum+=n}})
 }
 const result=()=>task==='count'?{rows:state.rows}:task==='filter'?{rows:state.rows,hits:state.hits}:task==='groupby'?[...state.groups].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1)).slice(0,5):state.cols.map(s=>({...s,min:fmt(s.min),max:fmt(s.max)}))
 return {visit,result}
}
// Extractor perezoso: recorre el registro y solo materializa los campos pedidos (no divide las 230 columnas).
function picker(wanted,delimiter=','){
 const max=Math.max(...wanted)
 return text=>{
  const out=new Map();let i=0,field=0,n=text.length
  while(field<=max&&i<=n){
   const quoted=text[i]==='"';let value=''
   if(quoted){i++;let from=i;for(;i<n;i++){if(text[i]==='"'){if(text[i+1]==='"'){value+=text.slice(from,i+1);i++;from=i+1;continue}break}}value+=text.slice(from,i);i++}
   else{const from=i;while(i<n&&text[i]!==delimiter&&text[i]!=='\n'&&text[i]!=='\r')i++;value=text.slice(from,i)}
   while(i<n&&text[i]!==delimiter&&text[i]!=='\n'&&text[i]!=='\r')i++
   if(wanted.has(field))out.set(field,value)
   if(text[i]===delimiter){i++;field++}else break
  }
  return out
 }
}

const engines={
 async 'csv-parse'(){
  const {parse}=await import('csv-parse'),acc=accumulator();let ordinal=0
  const parser=createReadStream(file,{highWaterMark:8*MiB}).pipe(parse({relax_column_count:true,bom:true}))
  for await(const record of parser)acc.visit(i=>record[i],ordinal++)
  return acc.result()
 },
 async own(){
  const acc=accumulator(),wanted=new Set([3,...NUM]),pick=picker(wanted)
  if(task==='sort-full'){ // llaves en memoria: viable hasta decenas de millones de filas, no más
   const keys=[];await eachRecord(file,(buf,o)=>{if(o)keys.push(pick(buf.toString('utf8')).get(3))})
   const order=Uint32Array.from(keys.keys()).sort((a,b)=>keys[a]<keys[b]?-1:keys[a]>keys[b]?1:a-b)
   return {rows:keys.length,first:order[0],last:order.at(-1),keyHeapMiB:Math.round(process.memoryUsage().heapUsed/MiB)}
  }
  await eachRecord(file,(buf,o)=>{if(!o){acc.visit(()=>'',0);return}const f=pick(buf.toString('utf8'));acc.visit(i=>f.get(i),o)})
  return acc.result()
 },
 async 'duckdb-native'(){
  const duck=createRequire(join(resolve(args.install),'package.json'))('@duckdb/node-api'),instance=await duck.DuckDBInstance.create(':memory:'),conn=await instance.connect()
  if(args.temp){await mkdir(args.temp,{recursive:true});await conn.run(`SET temp_directory='${args.temp}'`)}
  await conn.run(`SET memory_limit='${args.memory??'2GB'}'`);await conn.run(`SET threads=${args.threads??4}`)
  const src=`read_csv('${file}',header=true,all_varchar=true)`
  const rows=async sql=>(await conn.runAndReadAll(sql)).getRowObjects()
  if(task==='count')return {rows:Number((await rows(`select count(*) n from ${src}`))[0].n)}
  if(task==='filter')return (r=>({rows:Number(r.rows),hits:Number(r.hits)}))((await rows(`select count(*) rows,count(*) filter (where NOM_MUN='Mérida') hits from ${src}`))[0])
  if(task==='groupby')return (await rows(`select NOM_MUN k,count(*) c from ${src} group by 1 order by c desc,k limit 5`)).map(r=>[r.k,Number(r.c)])
  if(task==='analyze'){
   const cols=(await rows(`select column_name from (describe select * from ${src})`)).map(r=>r.column_name)
   const parts=NUM.map(c=>`count(nullif("${cols[c]}",'')) a${c},count(try_cast(nullif("${cols[c]}",'') as double)) b${c},min(try_cast(nullif("${cols[c]}",'') as double)) mn${c},max(try_cast(nullif("${cols[c]}",'') as double)) mx${c},sum(try_cast(nullif("${cols[c]}",'') as double)) s${c}`)
   const r=(await rows(`select ${parts.join(',')} from ${src}`))[0]
   return NUM.map(c=>({nonEmpty:Number(r['a'+c]),numeric:Number(r['b'+c]),min:fmt(Number(r['mn'+c]??Infinity)),max:fmt(Number(r['mx'+c]??-Infinity)),sum:Number(r['s'+c]??0)}))
  }
  if(task==='sort-full'){ // permutación completa ordenada por NOM_MUN, escrita a disco (parquet); el derrame usa --temp
   const out=join(args.temp??dirname(file),'perm.parquet');await rm(out,{force:true})
   await conn.run(`copy (select ordinal from (select row_number() over () ordinal,NOM_MUN from ${src}) order by NOM_MUN,ordinal) to '${out}' (format parquet)`)
   const r=(await rows(`select count(*) n,min(ordinal) lo,max(ordinal) hi from read_parquet('${out}')`))[0];await rm(out,{force:true});return {rows:Number(r.n),first:Number(r.lo),last:Number(r.hi)}
  }
 },
 async 'duckdb-wasm'(){
  const wasm=here('@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs'),dist=dirname(here.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs'))
  const bundles={mvp:{mainModule:join(dist,'duckdb-mvp.wasm'),mainWorker:join(dist,'duckdb-node-mvp.worker.cjs')},eh:{mainModule:join(dist,'duckdb-eh.wasm'),mainWorker:join(dist,'duckdb-node-eh.worker.cjs')}}
  const db=await wasm.createDuckDB(bundles,new wasm.VoidLogger(),wasm.NODE_RUNTIME);await db.instantiate(()=>{})
  db.registerFileURL('data.csv',file,wasm.DuckDBDataProtocol.NODE_FS,false)
  const conn=db.connect(),src=`read_csv('data.csv',header=true,all_varchar=true)`
  const rows=sql=>conn.query(sql).toArray().map(r=>r.toJSON())
  if(task==='count')return {rows:Number(rows(`select count(*) n from ${src}`)[0].n)}
  if(task==='filter')return (r=>({rows:Number(r.rows),hits:Number(r.hits)}))(rows(`select count(*) rows,count(*) filter (where NOM_MUN='Mérida') hits from ${src}`)[0])
  if(task==='groupby')return rows(`select NOM_MUN k,count(*) c from ${src} group by 1 order by c desc,k limit 5`).map(r=>[r.k,Number(r.c)])
  throw new Error(`tarea ${task} no medida en DuckDB-Wasm`)
 },
}
if(!engines[engine])throw new Error('motor desconocido')
// Uso de disco temporal: se muestrea cada 250 ms.
let tempPeak=0;const sampler=args.temp?setInterval(async()=>{try{let n=0;for(const f of await readdir(args.temp))n+=(await stat(join(args.temp,f))).size;tempPeak=Math.max(tempPeak,n)}catch{}},250):null
const t0=performance.now();let result,error
try{result=await engines[engine]()}catch(e){error=String(e.message).slice(0,200)}
const ms=performance.now()-t0;if(sampler)clearInterval(sampler)
const size=(await stat(file)).size
console.log(JSON.stringify({engine,task,file,fileMiB:Math.round(size/MiB),ms:Math.round(ms),mibPerS:Math.round(size/MiB/(ms/1000)),maxRssMiB:Math.round(process.resourceUsage().maxRSS/1024),tempPeakMiB:Math.round(tempPeak/MiB),digest:error?null:digest(result),result:error?undefined:(JSON.stringify(result).length>240?JSON.stringify(result).slice(0,240)+'…':result),error}))
process.exit(0)
