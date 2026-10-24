// Documento grande: el archivo original es canónico; los cambios puntuales viven en una capa (overlay) con diario;
// guardar copia en flujo los bytes que no cambian y reescribe solo los registros tocados. Experimento, no producto.
import {open,rename,rm,statfs,readFile,realpath,truncate} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {dirname,basename,join,resolve} from 'node:path'
import {buildIndex,recordBounds,scan,detect} from './record-index.mjs'
import {decode,encode,splitFields,serializeField,splitEol} from './fields.mjs'

export class ExternalChangeError extends Error{}
export class InsufficientSpaceError extends Error{}
export class UnrepresentableError extends Error{}
const COPY=8*1024*1024
const sha=b=>createHash('sha1').update(b).digest('hex')

// Huella barata para detectar cambios externos: tamaño, mtime y hash de los primeros y últimos 64 KiB.
export async function fingerprint(path){
 const h=await open(path,'r');try{
  const s=await h.stat(),n=Math.min(65536,s.size),head=Buffer.alloc(n),tail=Buffer.alloc(n)
  await h.read(head,0,n,0);await h.read(tail,0,n,s.size-n)
  return {size:s.size,mtimeMs:s.mtimeMs,head:sha(head),tail:sha(tail)}
 }finally{await h.close()}
}
const same=(a,b)=>a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.head===b.head&&a.tail===b.tail

async function copyRange(src,dst,start,end,signal,buffer){
 for(let position=start;position<end;){
  if(signal?.aborted)throw new Error('Guardado cancelado.')
  const {bytesRead}=await src.read(buffer,0,Math.min(buffer.length,end-position),position)
  if(!bytesRead)throw new Error('El archivo terminó antes de lo esperado.')
  await dst.write(buffer,0,bytesRead);position+=bytesRead
 }
}

// Reescribe solo los campos cambiados; el resto conserva su texto exacto (comillas, espacios, ceros a la izquierda).
function rewrite(body,changes,delimiter){
 const fields=splitFields(body,delimiter)
 for(const [column,value] of changes){
  while(fields.length<=column)fields.push({text:'',value:'',quoted:false})
  fields[column]={text:serializeField(value,delimiter,fields[column].quoted),value,quoted:fields[column].quoted}
 }
 return fields.map(f=>f.text).join(delimiter)
}

export class LargeDocument{
 // edits: ordinal -> {cells:Map(col -> valor)} | {deleted:true}; inserts: ordinal -> [[valores]] (filas nuevas tras ese registro)
 edits=new Map();inserts=new Map();journal=null;opsLogged=0

 static async open(path,{journalDir,delimiter,every,encoding,freeBytes,recover=true,onProgress,signal}={}){
  const doc=new LargeDocument();doc.path=await realpath(resolve(path)) // rename sobre un enlace simbólico lo reemplazaría: se guarda sobre el destino real
  doc.freeBytes=freeBytes
  doc.delimiter=delimiter??(/\.tsv$/i.test(path)?'\t':',')
  const before=await fingerprint(doc.path);doc.index=await buildIndex(doc.path,{every,encoding,onProgress,signal});doc.base=await fingerprint(doc.path)
  if(!same(before,doc.base))throw new ExternalChangeError('El archivo cambió mientras se indexaba.')
  doc.journalPath=join(journalDir??dirname(doc.path),`${sha(doc.path)}.freyalab-journal`)
  doc.nl=await doc.#firstEol()
  if(recover)await doc.#replay()
  return doc
 }
 async #firstEol(){const [[s,e]]=await this.#bounds(0,1).then(b=>b.length?b:[[0,0]]);return e>s?splitEol(await this.#text(s,e)).eol||'\n':'\n'}
 async #bounds(from,count){const h=await open(this.path,'r');try{return await recordBounds(h,this.index,from,count)}finally{await h.close()}}
 async #text(start,end){const h=await open(this.path,'r');try{const b=Buffer.alloc(end-start);await h.read(b,0,b.length,start);return decode(b,this.index.encoding)}finally{await h.close()}}

 // Página de registros: lee solo los bytes necesarios y aplica la capa encima.
 async page(from,count){
  const bounds=await this.#bounds(from,count);if(!bounds.length)return []
  const out=[]
  const h=await open(this.path,'r');try{
   for(const [i,[s,e]] of bounds.entries()){
    const b=Buffer.alloc(e-s);await h.read(b,0,b.length,s)
    const {body,eol}=splitEol(decode(b,this.index.encoding)),ordinal=from+i,edit=this.edits.get(ordinal)
    if(edit?.deleted){out.push({ordinal,deleted:true});continue}
    const values=splitFields(body,this.delimiter).map(f=>f.value)
    for(const [c,v] of edit?.cells??[]){while(values.length<=c)values.push('');values[c]=v}
    out.push({ordinal,values,eol,edited:Boolean(edit)})
   }
  }finally{await h.close()}
  return out
 }

 #check(value){ // el destino debe poder representar el texto: nada de «?» silenciosos al guardar
  const enc=this.index.encoding;if(enc==='utf8'||enc==='utf16le')return
  if(decode(encode(value,enc),enc)!==value)throw new UnrepresentableError(`El texto no cabe en la codificación ${enc}.`)
 }
 async setCell(ordinal,column,value){
  if(ordinal<0||ordinal>=this.index.records)throw new RangeError('Registro fuera de rango.')
  this.#check(value);await this.#log({op:'set',r:ordinal,c:column,v:value});this.#applySet(ordinal,column,value)
 }
 async deleteRow(ordinal){await this.#log({op:'del',r:ordinal});this.edits.set(ordinal,{deleted:true})}
 async insertAfter(ordinal,values){values.forEach(v=>this.#check(v));await this.#log({op:'ins',r:ordinal,v:values});this.#applyIns(ordinal,values)}
 #applySet(r,c,v){const e=this.edits.get(r)??{cells:new Map()};if(e.deleted)return;e.cells.set(c,v);this.edits.set(r,e)}
 #applyIns(r,values){this.inserts.set(r,[...(this.inserts.get(r)??[]),values])}
 get dirty(){return this.edits.size+this.inserts.size}

 // Diario: una línea JSON por operación. Una línea final truncada por un cierre brusco se ignora al recuperar.
 async #log(op){
  if(!this.journal){
   this.journal=await open(this.journalPath,'a')
   if((await this.journal.stat()).size===0)await this.journal.appendFile(JSON.stringify({v:1,path:this.path,base:this.base,delimiter:this.delimiter,encoding:this.index.encoding})+'\n')
  }
  await this.journal.appendFile(JSON.stringify(op)+'\n');this.opsLogged++
 }
 async flush(){await this.journal?.datasync()}
 async close(){await this.journal?.close();this.journal=null} // cierra el diario sin borrarlo: los cambios siguen recuperables
 async #replay(){
  let text;try{text=await readFile(this.journalPath,'utf8')}catch{return}
  const lines=text.split('\n'),tail=lines.pop() // lo que sigue al último salto de línea es una línea sin terminar
  let head;try{head=JSON.parse(lines.shift())}catch{await rm(this.journalPath,{force:true});return} // cabecera ilegible: el diario no sirve
  if(!same(head.base,this.base))throw new ExternalChangeError('El archivo cambió desde que se escribió el diario de recuperación; no se aplica.')
  let ok=0,good=Buffer.byteLength(JSON.stringify(head))+1,damaged=tail!==''
  for(const line of lines){let op;try{op=JSON.parse(line)}catch{damaged=true;break}
   if(op.op==='set')this.#applySet(op.r,op.c,op.v);else if(op.op==='del')this.edits.set(op.r,{deleted:true});else if(op.op==='ins')this.#applyIns(op.r,op.v);ok++;good+=Buffer.byteLength(line)+1}
  // se recorta hasta el último byte bueno: si no, lo que se añada después quedaría pegado a la línea rota y se perdería en la siguiente recuperación
  if(damaged)await truncate(this.journalPath,good)
  this.recovered=ok;this.opsLogged=ok
 }
 async discard(){await this.journal?.close();this.journal=null;await rm(this.journalPath,{force:true});this.edits.clear();this.inserts.clear();this.opsLogged=0}

 // shortcut: guardar sin cambios también copia el archivo entero (lo usa la prueba de idempotencia byte a byte); el producto debe omitirlo.
 // Guarda: copia en flujo los bytes sin cambios, reescribe los registros tocados y reemplaza el original con rename.
 async save({signal,onProgress}={}){
  if(!same(await fingerprint(this.path),this.base))throw new ExternalChangeError('El archivo cambió fuera de FreyaLab; no se sobrescribe.')
  const touched=[...new Set([...this.edits.keys(),...this.inserts.keys()])].sort((a,b)=>a-b)
  const added=[...this.inserts.values()].flat().reduce((n,v)=>n+v.join(this.delimiter).length*(this.index.unit)+8,0)
  const stats=await statfs(dirname(this.path)),free=this.freeBytes?this.freeBytes():stats.bavail*stats.bsize
  const need=this.index.size+added+64*1024*1024 // copia completa + margen; el original sigue intacto hasta el rename
  if(free<need)throw new InsufficientSpaceError(`Espacio libre insuficiente para guardar con seguridad: hacen falta ${need} bytes y hay ${free}.`)
  const temp=join(dirname(this.path),`.${basename(this.path)}.freyalab-${process.pid}.tmp`)
  const src=await open(this.path,'r'),dst=await open(temp,'w'),buffer=Buffer.allocUnsafe(COPY),{encoding}=this.index
  try{
   await dst.chmod((await src.stat()).mode&0o7777) // conserva los permisos del original (el propietario y las ACL no se conservan: ver RFC)
   let cursor=0;const deltas=[];let structural=this.inserts.size>0||[...this.edits.values()].some(e=>e.deleted)
   for(const [n,ordinal] of touched.entries()){
    if(signal?.aborted)throw new Error('Guardado cancelado.')
    const [[s,e]]=await recordBounds(src,this.index,ordinal,1)
    await copyRange(src,dst,cursor,s,signal,buffer)
    const raw=Buffer.alloc(e-s);await src.read(raw,0,raw.length,s)
    const edit=this.edits.get(ordinal),{body,eol}=splitEol(decode(raw,encoding)),extra=this.inserts.get(ordinal)??[]
    const isLast=e>=this.index.size&&eol==='',needNl=extra.length>0&&isLast,pieces=[]
    if(!edit?.deleted){
     if(edit?.cells)pieces.push(encode(rewrite(body,edit.cells,this.delimiter)+(eol||(needNl?this.nl:'')),encoding))
     else{pieces.push(raw);if(needNl)pieces.push(encode(this.nl,encoding))}
    }
    for(const [k,values] of extra.entries())pieces.push(encode(values.map(v=>serializeField(v,this.delimiter,false)).join(this.delimiter)+(isLast&&k===extra.length-1?'':this.nl),encoding))
    const out=Buffer.concat(pieces);await dst.write(out);deltas.push([ordinal,out.length-raw.length])
    cursor=e;onProgress?.(n/touched.length)
   }
   await copyRange(src,dst,cursor,this.index.size,signal,buffer)
   await dst.sync();await dst.close();await src.close()
   if(!same(await fingerprint(this.path),this.base))throw new ExternalChangeError('El archivo cambió mientras se guardaba; no se sobrescribe.')
   await rename(temp,this.path)
   this.#reindex(deltas,structural)
  }catch(error){await dst.close().catch(()=>{});await src.close().catch(()=>{});await rm(temp,{force:true});throw error}
  await this.discard() // el diario ya no hace falta
  this.base=await fingerprint(this.path)
  if(this.pendingRebuild){this.pendingRebuild=false;this.index=await buildIndex(this.path,{every:this.index.every,encoding})}
 }
 // Sin altas ni bajas de registros basta con desplazar los puntos de control por la suma de diferencias de longitud: no se vuelve a leer el archivo.
 #reindex(deltas,structural){
  if(structural){this.pendingRebuild=true;return}
  const {offsets,every}=this.index,next=new Float64Array(offsets.length);let j=0,cumulative=0
  for(let k=0;k<offsets.length;k++){while(j<deltas.length&&deltas[j][0]<k*every)cumulative+=deltas[j++][1];next[k]=offsets[k]+cumulative}
  for(;j<deltas.length;j++)cumulative+=deltas[j][1]
  this.index={...this.index,offsets:next,size:this.index.size+cumulative}
 }
}

// Cambio masivo: pasada completa en flujo (memoria acotada) que escribe una versión nueva y deja la anterior intacta.
export async function bulkTransform(srcPath,dstPath,fn,{delimiter=',',encoding,signal,onProgress,chunkSize=COPY}={}){
 const src=await open(srcPath,'r'),dst=await open(dstPath,'w')
 try{
  const size=(await src.stat()).size,meta=await detect(src,size,encoding)
  const chunk=Buffer.allocUnsafe(chunkSize);let position=0,carry=Buffer.alloc(0),state={inQuotes:false},ordinal=0,changed=0
  const bom=Buffer.alloc(meta.bomLength);await src.read(bom,0,bom.length,0);await dst.write(bom);position=meta.bomLength
  const out=[]
  const emit=raw=>{ // síncrono: los trozos de salida se acumulan y se escriben una vez por bloque
   const {body,eol}=splitEol(decode(raw,meta.encoding)),fields=splitFields(body,delimiter),values=fields.map(f=>f.value)
   const next=fn(values,ordinal++)
   if(next===undefined||next.length===values.length&&next.every((v,i)=>v===values[i])){out.push(raw);return}
   changed++;if(next===null)return
   const text=next.map((v,i)=>fields[i]&&v===values[i]?fields[i].text:serializeField(v,delimiter,fields[i]?.quoted)).join(delimiter)
   out.push(encode(text+eol,meta.encoding))
  }
  while(position<size){
   if(signal?.aborted)throw new Error('Transformación cancelada.')
   const {bytesRead}=await src.read(chunk,0,chunkSize,position);if(!bytesRead)break
   const usable=meta.unit===2?bytesRead-(bytesRead%2):bytesRead,buf=Buffer.concat([carry,chunk.subarray(0,usable)]),ends=[]
   state=scan(buf.subarray(carry.length),usable,carry.length,state,meta,end=>ends.push(end))
   let start=0;for(const end of ends){emit(buf.subarray(start,end));start=end}
   await dst.write(Buffer.concat(out));out.length=0
   carry=Buffer.from(buf.subarray(start));position+=usable;onProgress?.(position/size)
  }
  if(carry.length){emit(carry);await dst.write(Buffer.concat(out))}
  await dst.sync()
  return {records:ordinal,changed}
 }finally{await src.close();await dst.close()}
}
