#!/usr/bin/env node
// Generador de fixtures CSV/TSV reproducibles para los experimentos de archivos grandes. No forma parte del producto.
//   node gen-fixture.mjs --size 1GiB --profile hostile --eol mixed --encoding utf8 --bom --seed 7 --out /ruta/fuera/del/repo
// Perfiles: wide (230 columnas, ceros iniciales), narrow (4 columnas, identificadores largos), hostile (multilínea, comillas,
// Unicode, filas irregulares, vacío frente a ausente, espacios, ceros iniciales, identificadores de 17+ dígitos).
// Escribe en streaming (memoria constante), comprueba antes el espacio libre y se niega a escribir dentro del repositorio.
import {createWriteStream} from 'node:fs'
import {mkdir,statfs,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {tmpdir} from 'node:os'
import {join,resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import {once} from 'node:events'
import iconv from 'iconv-lite'

const args=Object.fromEntries(process.argv.slice(2).reduce((acc,item,i,all)=>item.startsWith('--')?[...acc,[item.slice(2),all[i+1]?.startsWith('--')||all[i+1]===undefined?true:all[i+1]]]:acc,[]))
const units={KiB:1024,MiB:1024**2,GiB:1024**3}
const parseSize=text=>{const m=/^(\d+(?:\.\d+)?)\s*(KiB|MiB|GiB)$/.exec(String(text));if(!m)throw new Error('--size debe ser como 50MiB, 1GiB o 5GiB');return Math.round(Number(m[1])*units[m[2]])}
const target=args.rows?undefined:parseSize(args.size??'50MiB'),rowsTarget=args.rows?Number(args.rows):undefined
const profile=args.profile??'wide',eolMode=args.eol??'lf',encoding=args.encoding??'utf8',seed=Number(args.seed??1),delimiter=args.tsv?'\t':(args.delimiter??','),bom=!!args.bom
if(!['wide','narrow','hostile'].includes(profile))throw new Error('perfil desconocido')
if(!['lf','crlf','mixed'].includes(eolMode))throw new Error('--eol: lf, crlf o mixed')
if(!['utf8','utf16le','win1252'].includes(encoding))throw new Error('--encoding: utf8, utf16le o win1252')
const root=resolve(fileURLToPath(new URL('../..',import.meta.url))),outDir=resolve(args.out??join(tmpdir(),'freya-fixtures'))
if(outDir===root||outDir.startsWith(root+sep))throw new Error('Los fixtures grandes no se escriben dentro del repositorio: usa --out fuera de él')
await mkdir(outDir,{recursive:true})
const estimate=target??rowsTarget*(profile==='wide'?600:120)
const free=(()=>statfs(outDir).then(s=>s.bavail*s.bsize))()
if(await free<estimate*1.25+512*1024**2)throw new Error(`Espacio insuficiente en ${outDir}: se necesitan ~${Math.round((estimate*1.25+512*1024**2)/1024**2)} MiB y hay ${Math.round(await free/1024**2)} MiB`)

function rng(seedValue){let a=seedValue>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const random=rng(seed),pick=list=>list[Math.floor(random()*list.length)],int=(n)=>Math.floor(random()*n)
const names=['Abejones','Mérida','Oaxaca','Ñuñoa','São Paulo','Zürich','Coyoacán','Tlalpan','Cuauhtémoc','Güémez'],words=['alfa','beta','gamma','delta','ñandú','pingüino','café','canción']
const quote=value=>/[",\r\n]|^\s|\s$/.test(value)||value.includes(delimiter)?`"${value.replaceAll('"','""')}"`:value
const emoji=encoding==='utf8'||encoding==='utf16le'?['😀','✓','→','日本語']:['é','ñ','ü','€']
const columns=profile==='wide'?230:profile==='narrow'?4:7
const header=profile==='wide'?['ENTIDAD','NOM_ENT','MUN','NOM_MUN','LOC','NOM_LOC','AGEB','MZA',...Array.from({length:columns-8},(_,i)=>`VIV_${i+1}`)]:profile==='narrow'?['id','nombre','monto','nota']:['codigo','nombre','texto','cita','vacio','numero','extra']
function row(i){
 if(profile==='wide')return [String(20),'Oaxaca',String(1+i%570).padStart(3,'0'),pick(names),String(i%9999).padStart(4,'0'),pick(names),String(i%9999).padStart(4,'0'),'000',...Array.from({length:columns-8},()=>String(int(100000)))].map(quote)
 if(profile==='narrow')return [String(9007199254740993n+BigInt(i)),pick(names),(random()*10000).toFixed(2),pick(words)].map(quote)
 const kind=int(40);const code=String(i).padStart(9,'0')
 const base=[code,pick(names),`${pick(words)} ${pick(words)}`,'',(random()<0.5?'':'x'),String(9007199254740993n+BigInt(i)),pick(emoji)]
 if(kind===0)base[2]=`línea uno\nlínea dos ${pick(emoji)}`            // multilínea con LF
 else if(kind===1)base[2]=`primera\r\nsegunda`                      // multilínea con CRLF
 else if(kind===2)base[3]=`dijo "hola" y ${pick(emoji)}`            // comillas escapadas
 else if(kind===3)base[2]='  espacios al borde  '                  // espacios que obligan a entrecomillar
 let record=base.map(quote)
 if(kind===4)record=record.slice(0,3)                               // fila corta: campos AUSENTES
 else if(kind===5)record=[...record,'sobra','y más']                // fila larga
 else if(kind===6)record=[code,'','','','','','']                   // campos presentes pero VACÍOS
 return record
}
const eolOf=()=>eolMode==='lf'?'\n':eolMode==='crlf'?'\r\n':(random()<0.5?'\n':'\r\n')
const name=args.name??`fixture-${profile}-${eolMode}-${encoding}${bom?'-bom':''}-${args.size??args.rows+'rows'}.${delimiter==='\t'?'tsv':'csv'}`
const path=join(outDir,name),stream=createWriteStream(path),hash=createHash('sha256')
let bytes=0,rows=0,first=true
const write=async(text)=>{let buffer=encoding==='utf8'?Buffer.from(text,'utf8'):iconv.encode(text,encoding);if(first){first=false;if(bom)buffer=Buffer.concat([encoding==='utf8'?Buffer.from([0xEF,0xBB,0xBF]):encoding==='utf16le'?Buffer.from([0xFF,0xFE]):Buffer.alloc(0),buffer])};bytes+=buffer.length;hash.update(buffer);if(!stream.write(buffer))await once(stream,'drain')}
await write(header.map(quote).join(delimiter)+eolOf())
let chunk=''
const oracle=args.oracle?[]:undefined
while(target!==undefined?bytes<target:rows<rowsTarget){
 const record=row(rows);chunk+=record.join(delimiter)+eolOf();rows++
 if(oracle)oracle.push(record)
 if(chunk.length>1<<20){await write(chunk);chunk=''}
}
if(chunk)await write(chunk)
stream.end();await once(stream,'finish')
const meta={path,profile,eol:eolMode,encoding,bom,delimiter,seed,rows,bytes,columns:profile==='wide'?230:profile==='narrow'?4:7,sha256:hash.digest('hex')}
await writeFile(path+'.meta.json',JSON.stringify(meta,null,1))
console.log(JSON.stringify(meta))
