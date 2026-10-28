import {open,mkdir,mkdtemp,readFile,readdir,rm,unlink,rmdir,lstat,realpath} from 'node:fs/promises'
import {constants} from 'node:fs'
import {basename,dirname,extname,isAbsolute,join,relative,resolve,sep} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {unified} from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkDetails from '../renderer/lib/remark-details'
import {frontMatterOf} from '../shared/front-matter'
import {atomicWrite,contained,digest} from './files'

type Node={type:string;url?:string;title?:string|null;identifier?:string;children?:Node[];position?:{start:{offset?:number};end:{offset?:number}}}
export interface AssetChange {from:number;to:number;insert:string}
export interface DocumentAssets {copied:number;warnings:string[];changes:AssetChange[]}
const limit=8*1024*1024
const imageExtensions=new Set(['.png','.jpg','.jpeg','.gif','.webp','.svg'])
const assetDirectory=(document:string)=>join(dirname(document),`${basename(document,extname(document))}.assets`)
const folded=(name:string)=>name.normalize('NFC').toLowerCase()
const identifier=(value:string)=>value.replace(/[\t\r\n ]+/g,' ').trim().toLowerCase().toUpperCase()
function assetError(error:unknown):Error {
 const code=(error as NodeJS.ErrnoException)?.code
 const message=code==='ENOENT'?'No se encontró la imagen o su carpeta.':code==='ENOSPC'?'No queda espacio para copiar las imágenes o guardar el documento.':code==='EACCES'||code==='EPERM'?'No tienes permiso para copiar las imágenes o guardar el documento.':code==='EEXIST'?'Ya existe un activo con ese nombre. Guarda la copia con otro nombre.':undefined
 return message?new Error(message,{cause:error}):error instanceof Error?error:new Error('No se pudieron copiar las imágenes.',{cause:error})
}

// Las posiciones vienen del mismo parser y del plugin de details que usa la vista previa.
// Se localiza únicamente el destino dentro de un nodo de imagen/definición ya reconocido.
function destination(source:string,node:Node,offset:number):{from:number;to:number}|undefined {
 const start=node.position?.start.offset,end=node.position?.end.offset
 if(start===undefined||end===undefined)return
 const raw=source.slice(start+offset,end+offset),image=node.type==='image'
 if(image?!raw.startsWith('![')||!raw.endsWith(')'):!raw.startsWith('['))return
 const escapes=new Uint8Array(raw.length);let slashes=0
 for(let index=0;index<raw.length;index++){if(raw[index]==='\\')slashes++;else{escapes[index]=slashes%2;slashes=0}}
 const escaped=(index:number)=>escapes[index]===1
 let minimum=0,cursor=raw.length-(image?1:0)
 if(!image){
  let labelEnd=1;while(labelEnd<raw.length&&(raw[labelEnd]!==']'||escaped(labelEnd)))labelEnd++
  if(raw[labelEnd+1]!==':')return
  minimum=labelEnd+2
 }
 const spaces=()=>{while(cursor>minimum&&/[\t\r\n ]/.test(raw[cursor-1]))cursor--}
 spaces()
 if(node.title!==null&&node.title!==undefined){
  const close=raw[cursor-1],opening=close===')'?'(':close
  if(![')',"'",'"'].includes(close))return
  let index=cursor-2,depth=1
  for(;index>=minimum;index--){
   if(escaped(index))continue
   if(close===')'&&raw[index]===')')depth++
   if(raw[index]===opening&&--depth===0)break
   if(close!==')')depth=1
  }
  if(index<minimum)return
  cursor=index;spaces()
 }
 let from=cursor,to=cursor
 if(raw[cursor-1]==='>'&&!escaped(cursor-1)){
  to=--cursor
  while(cursor>minimum){cursor--;if(raw[cursor]==='<'&&!escaped(cursor)){from=cursor+1;break}}
 }else{
  let depth=0
  while(cursor>minimum){
   const index=cursor-1,character=raw[index]
   if(!escaped(index)){
    if(character===')')depth++
    else if(character==='('){if(!depth)break;depth--}
    else if(/[\t\r\n ]/.test(character)&&!depth)break
   }
   cursor--
  }
  from=cursor
 }
 if(to<=from)return
 return{from:start+offset+from,to:start+offset+to}
}

function images(source:string):{url:string;from:number;to:number}[]{
 const {body}=frontMatterOf(source),parsedBody=body.charCodeAt(0)===0xfeff?body.slice(1):body,offset=source.length-parsedBody.length
 const parser=unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkDetails)
 const root=parser.runSync(parser.parse(parsedBody),{value:parsedBody}) as Node,definitions=new Map<string,Node>(),references=new Set<string>(),nodes:Node[]=[]
 function visit(node:Node){
  if(node.type==='image')nodes.push(node)
  else if(node.type==='imageReference'&&node.identifier)references.add(identifier(node.identifier))
  else if(node.type==='definition'&&node.identifier&&!definitions.has(identifier(node.identifier)))definitions.set(identifier(node.identifier),node)
  for(const child of node.children??[])visit(child)
 }
 visit(root);for(const reference of references){const node=definitions.get(reference);if(node)nodes.push(node)}
 const seen=new Set<number>(),result:{url:string;from:number;to:number}[]=[]
 for(const node of nodes){
  const span=destination(source,node,offset)
  if(!node.url)continue
  if(!span)throw new Error('No pude localizar con seguridad una ruta de imagen. El documento original se conserva.')
  if(seen.has(span.from))continue
  seen.add(span.from);result.push({url:node.url,...span})
 }
 return result.sort((a,b)=>a.from-b.from)
}
async function noSymlinks(root:string,path:string){
 const parts=relative(root,path).split(sep).filter(Boolean);let current=root
 for(const part of ['',...parts]){
  if(part)current=join(current,part)
  const info=await lstat(current)
  if(info.isSymbolicLink())throw new Error('No se copian enlaces simbólicos de imágenes.')
 }
}
async function imageBytes(root:string,path:string):Promise<Buffer>{
 await noSymlinks(root,path)
 if(!await contained(root,path))throw new Error('La imagen está fuera de la carpeta de activos.')
 const before=await lstat(path)
 if(!before.isFile())throw new Error('La referencia no corresponde a un archivo de imagen.')
 if(before.size>limit)throw new Error('La imagen supera el límite de 8 MiB.')
 const canonical=await realpath(path),handle=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0))
 try{
  const info=await handle.stat()
  if(!info.isFile()||info.dev!==before.dev||info.ino!==before.ino||info.size>limit)throw new Error('La imagen cambió antes de copiarse.')
  const bytes=Buffer.alloc(info.size+1);let length=0
  while(length<bytes.length){const result=await handle.read(bytes,length,bytes.length-length,length);if(!result.bytesRead)break;length+=result.bytesRead}
  const after=await handle.stat(),current=await lstat(path)
  if(length!==info.size||after.size!==info.size||after.mtimeMs!==info.mtimeMs||current.isSymbolicLink()||current.dev!==info.dev||current.ino!==info.ino||await realpath(path)!==canonical)throw new Error('La imagen cambió durante la copia. Vuelve a intentarlo.')
  return bytes.subarray(0,length)
 }finally{await handle.close()}
}
async function collision(parent:string,name:string){
 const existing=(await readdir(parent)).find(entry=>folded(entry)===folded(name))
 if(existing!==undefined)throw new Error(`Ya existe un activo con ese nombre: ${name}. Guarda la copia con otro nombre.`)
}
async function directory(path:string,created:string[]){
 const info=await lstat(path).catch(error=>{if(error.code!=='ENOENT')throw error;return undefined})
 if(info){if(info.isSymbolicLink())throw new Error('La carpeta de activos es un enlace simbólico.');if(!info.isDirectory())throw new Error('Ya existe un archivo donde debería estar la carpeta de activos.');return}
 await collision(dirname(path),basename(path));await mkdir(path);created.push(path)
}
const encoded=(path:string)=>path.split(sep).map(part=>encodeURIComponent(part).replace(/[!'()*]/g,character=>`%${character.charCodeAt(0).toString(16).toUpperCase()}`)).join('/')
function patchedText(source:string,changes:AssetChange[]):string {
 let text=source
 for(const change of [...changes].reverse())text=text.slice(0,change.from)+change.insert+text.slice(change.to)
 if(Buffer.byteLength(text)>10*1024*1024)throw new Error('Las rutas nuevas harían que el documento supere el límite de edición de 10 MiB.')
 return text
}

// Solo publica recursos nuevos; una copia fallida revierte sus archivos y carpetas, nunca activos previos.
export async function saveMarkdownCopy(source:string,previousPath:string|null,destinationPath:string):Promise<{text:string;assets:DocumentAssets}>{
 const assets:DocumentAssets={copied:0,warnings:[],changes:[]},references=images(source)
 const parent=await realpath(dirname(destinationPath)),targetRoot=assetDirectory(join(parent,basename(destinationPath)))
 if(previousPath&&resolve(assetDirectory(previousPath))===resolve(targetRoot)){await atomicWrite(destinationPath,source);return{text:source,assets}}
 if(!previousPath){
  if(references.some(reference=>!reference.url.startsWith('data:')))assets.warnings.push('No se copiaron imágenes porque el documento no tenía una ubicación propia; sus referencias se conservaron.')
  await atomicWrite(destinationPath,source);return{text:source,assets}
 }
 const previousRoot=assetDirectory(previousPath),documentRoot=dirname(previousPath)
 const files=new Map<string,{stage:string;relative:string;hash:string}>(),names=new Set<string>(),createdFiles:string[]=[],createdDirectories:string[]=[]
 let staging:string|undefined
 try{
  for(const reference of references){
   const url=reference.url;if(url.startsWith('data:'))continue
   let path:string,tail:string
   try{
    if(/^[a-z]+:/i.test(url)||url.startsWith('//'))throw new Error('La referencia usa un recurso remoto o bloqueado; no se copió.')
    const separator=url.search(/[?#]/),plain=separator<0?url:url.slice(0,separator),decoded=decodeURIComponent(plain)
    tail=separator<0?'':url.slice(separator)
    if(isAbsolute(decoded)||decoded.split(/[\\/]/).includes('..'))throw new Error('La referencia está fuera de la carpeta de activos.')
    path=resolve(documentRoot,decoded)
    const local=relative(previousRoot,path)
    if(!local||local.startsWith('..')||isAbsolute(local)||!imageExtensions.has(extname(path).toLowerCase()))throw new Error('La referencia está fuera de la carpeta de activos o su formato no es compatible.')
   }catch(error){assets.warnings.push(`${url}: ${error instanceof Error?error.message:'No se pudo interpretar la referencia.'}`);continue}
   let file=files.get(path)
   if(!file){
    const bytes=await imageBytes(previousRoot,path)
    const local=relative(previousRoot,path),key=folded(local)
    if(names.has(key))throw new Error('Hay una colisión entre nombres de activos que solo cambian en mayúsculas o acentos Unicode.')
    names.add(key)
    staging??=await mkdtemp(join(parent,'.freya-assets-'))
    const stage=join(staging,randomUUID()),handle=await open(stage,'wx',0o600)
    try{await handle.writeFile(bytes);await handle.sync()}finally{await handle.close()}
    file={stage,relative:local,hash:createHash('sha256').update(bytes).digest('hex')};files.set(path,file)
   }
   const insert=`${encoded(basename(targetRoot))}/${encoded(file.relative)}${tail}`
   if(source.slice(reference.from,reference.to)!==insert)assets.changes.push({from:reference.from,to:reference.to,insert})
  }
  const text=patchedText(source,assets.changes)
  if(files.size){
   const alias=(await readdir(parent)).find(name=>folded(name)===folded(basename(targetRoot))&&name!==basename(targetRoot))
   if(alias)throw new Error('Ya existe una carpeta de activos con otra combinación de mayúsculas.')
   await directory(targetRoot,createdDirectories)
   for(const file of files.values()){
    const parts=file.relative.split(sep),name=parts.pop()!;let parentDirectory=targetRoot
    for(const part of parts){parentDirectory=join(parentDirectory,part);await directory(parentDirectory,createdDirectories)}
    await noSymlinks(targetRoot,parentDirectory)
    if(!await contained(parent,parentDirectory))throw new Error('La carpeta de destino está fuera del documento.')
    await collision(parentDirectory,name)
    const target=join(parentDirectory,name)
    const bytes=await readFile(file.stage),handle=await open(target,'wx',0o600);createdFiles.push(target)
    try{await handle.writeFile(bytes);await handle.sync()}finally{await handle.close()}
    if(await digest(target)!==file.hash)throw new Error('La copia de una imagen no conserva sus bytes. Vuelve a intentarlo.')
   }
  }
  await atomicWrite(destinationPath,text)
  assets.copied=files.size;return{text,assets}
 }catch(error){
  for(const file of createdFiles.reverse())await unlink(file).catch(()=>{})
  for(const path of createdDirectories.reverse())await rmdir(path).catch(()=>{})
  throw assetError(error)
 }finally{if(staging)await rm(staging,{recursive:true,force:true}).catch(()=>{})}
}

function sameImageURL(value:string,missing:string){
 if(value===missing)return true
 try{return decodeURIComponent(value)===decodeURIComponent(missing)}catch{return false}
}
export function hasImageReference(source:string,url:string):boolean {
 return!(/^[a-z][a-z0-9+.-]*:/i.test(url)||url.startsWith('//'))&&images(source).some(reference=>sameImageURL(reference.url,url))
}

export async function locateMarkdownImage(source:string,documentPath:string,url:string,selected:string,assertCurrent:()=>void):Promise<{text:string;assets:DocumentAssets}>{
 const references=images(source).filter(reference=>sameImageURL(reference.url,url))
 if(!references.length||/^[a-z][a-z0-9+.-]*:/i.test(url)||url.startsWith('//'))throw new Error('La referencia de imagen ya no está en el documento. Vuelve a intentarlo.')
 if(!isAbsolute(selected)||!imageExtensions.has(extname(selected).toLowerCase()))throw new Error('Selecciona un archivo de imagen PNG, JPEG, GIF, WebP o SVG.')
 const createdDirectories:string[]=[];let owned:string|undefined
 try{
  const bytes=await imageBytes(dirname(selected),selected);assertCurrent()
  const parent=await realpath(dirname(documentPath)),root=assetDirectory(join(parent,basename(documentPath)))
  await directory(root,createdDirectories);await noSymlinks(parent,root)
  if(!await contained(parent,root))throw new Error('La carpeta de activos está fuera del documento.')
  const name=`${randomUUID()}${extname(selected).toLowerCase()}`,path=join(root,name),insert=`${encoded(basename(root))}/${name}`
  const changes=references.map(reference=>({from:reference.from,to:reference.to,insert})),text=patchedText(source,changes)
  const handle=await open(path,'wx',0o600);owned=path
  try{await handle.writeFile(bytes);await handle.sync()}finally{await handle.close()}
  if(await digest(path)!==createHash('sha256').update(bytes).digest('hex'))throw new Error('La copia de la imagen no conserva sus bytes.')
  assertCurrent()
  return{text,assets:{copied:1,warnings:[],changes}}
 }catch(error){
  if(owned)await unlink(owned).catch(()=>{})
  for(const path of createdDirectories.reverse())await rmdir(path).catch(()=>{})
  throw assetError(error)
 }
}
