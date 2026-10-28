import { app, dialog, BrowserWindow } from 'electron'
import { readFile, open as openFile, mkdir, readdir, unlink, stat, lstat, realpath } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import {constants} from 'node:fs'
import {frontMatterOf,parseTags,normalizeTag} from '../shared/front-matter'
import {tokensFileQuery} from '../shared/tag-query'
import { watch, type FSWatcher } from 'chokidar'
import iconv from 'iconv-lite'
import { atomicWrite, contained, digest } from './files'
import { TableClient } from './table-client'
import type {AppEvent,DocumentInfo,Kind,RecoveryEntry,TableOptions,TableEdit,TableExport,TreeEntry} from '../shared/types'
interface RecordDoc { info:DocumentInfo; hash?:string; text:string; undo:string[]; redo:string[]; root:string; saving:boolean; timer?:ReturnType<typeof setTimeout>; watcher?:FSWatcher }
const extensions:Record<string,Kind>={'.md':'markdown','.markdown':'markdown','.txt':'text','.mmd':'mermaid','.mermaid':'mermaid','.csv':'csv','.tsv':'csv'}
export class Documents {
 records=new Map<string,RecordDoc>(); roots=new Set<string>(); grants=new Set<string>(); table=new TableClient(progress=>this.emit({type:'analysis',progress}))
 private fileSearch=0
 private tagList=0
 private tagReaders=0
 private tagReadQueue:{check:()=>void;resolve:()=>void;reject:(error:unknown)=>void}[]=[]
 private operations=new Map<string,Promise<unknown>>()
 private reloading=new Set<string>()
 private serial<T>(id:string,operation:()=>Promise<T>):Promise<T>{const task=(this.operations.get(id)??Promise.resolve()).catch(()=>{}).then(operation);this.operations.set(id,task);void task.finally(()=>{if(this.operations.get(id)===task)this.operations.delete(id)}).catch(()=>{});return task}
 private rejectDuringReload(id:string){if(this.reloading.has(id))throw new Error('Espera a que termine la recarga antes de editar.')}
 private reinterpret<T>(id:string,operation:()=>Promise<T>){this.rejectDuringReload(id);this.reloading.add(id);return this.serial(id,operation).finally(()=>this.reloading.delete(id))}
 private recoveryTasks=new Map<string,Promise<void>>()
 private recoveryDir=join(app.getPath('userData'),'recovery')
 constructor(private emit:(e:AppEvent)=>void){}
 private owner(){return BrowserWindow.getFocusedWindow()??BrowserWindow.getAllWindows()[0]}
 async authorize(path:string){const canonical=await realpath(path);if((await lstat(path)).isSymbolicLink())throw new Error('Los enlaces simbólicos no se abren para editar en esta alfa.');return canonical}
 private opening=new Map<string,Promise<DocumentInfo>>()
 async open(path:string):Promise<DocumentInfo>{
  const canonical=await this.authorize(path)
  const existing=[...this.records.values()].find(r=>r.info.path===canonical);if(existing)return this.info(existing.info.id)
  const running=this.opening.get(canonical);if(running)return running
  const task=this.openNew(canonical).finally(()=>this.opening.delete(canonical));this.opening.set(canonical,task);return task
 }
 // `records` es lo que ve la interfaz (`documents`, `existing`): un documento entra solo cuando su tabla o su texto ya están listos.
 private async openNew(canonical:string):Promise<DocumentInfo>{
  const kind=extensions[extname(canonical).toLowerCase()];if(!kind)throw new Error('Tipo de archivo no compatible. Usa Markdown, texto, Mermaid, CSV o TSV.')
  const size=(await stat(canonical)).size;if(!(await stat(canonical)).isFile())throw new Error('Selecciona un archivo.')
  const id=randomUUID();const record:RecordDoc={info:{id,name:basename(canonical),path:canonical,kind,dirty:false,readonly:false,revision:0,encoding:'utf8',delimiter:kind==='csv'&&extname(canonical)==='.tsv'?'\t':','},text:'',undo:[],redo:[],root:dirname(canonical),saving:false}
  try {
   if(kind==='csv'){const before=size<=50*1024*1024?await digest(canonical):undefined;await this.table.call('open',id,canonical,{delimiter:extname(canonical)==='.tsv'?'\t':undefined});Object.assign(record.info,await this.table.call('info',id));if(!record.info.readonly){const after=await digest(canonical);if(before!==after)throw new Error('El archivo cambió durante la apertura. Vuelve a abrirlo.');record.hash=after}}
   else if(size>10*1024*1024){const h=await import('node:fs/promises').then(m=>m.open(canonical,'r'));try{const b=Buffer.alloc(1024*1024);const {bytesRead}=await h.read(b,0,b.length,0);record.text=b.subarray(0,bytesRead).toString('utf8')}finally{await h.close()};record.info.readonly=true;record.info.warning='Muestra de solo lectura: primer MiB. El archivo supera 10 MiB.'}
   else{const bytes=await readFile(canonical);record.hash=createHash('sha256').update(bytes).digest('hex');const text=bytes.toString('utf8');if(!Buffer.from(text).equals(bytes))throw new Error('Este documento no es UTF-8 válido. Convierte su codificación antes de editarlo.');record.text=text}
   record.watcher=watch(canonical,{ignoreInitial:true,awaitWriteFinish:{stabilityThreshold:150,pollInterval:50}}).on('change',()=>{if(!record.saving)this.emit({type:'external',id})}).on('unlink',()=>this.emit({type:'external',id}))
   this.records.set(id,record);await this.addRecent(canonical);return this.info(id)
  }catch(e){this.records.delete(id);if(kind==='csv')await this.table.call('close',id).catch(()=>{});throw e}
 }
 async create(kind:Kind){const id=randomUUID();const extension=kind==='csv'?'csv':kind==='mermaid'?'mmd':kind==='text'?'txt':'md';const r:RecordDoc={info:{id,name:`Sin título.${extension}`,path:null,kind,dirty:false,readonly:false,revision:0,encoding:'utf8',delimiter:','},text:'',undo:[],redo:[],root:app.getPath('documents'),saving:false};if(kind==='csv'){await this.table.call('create',id);Object.assign(r.info,await this.table.call('info',id))}this.records.set(id,r);return this.info(id)}
 get(id:string){const r=this.records.get(id);if(!r)throw new Error('El documento ya no está abierto.');return r}
 info(id:string){const r=this.get(id);return {...r.info,...(r.info.kind!=='csv'?{text:r.text}:{})}}
 async syncTable(id:string){const r=this.get(id);Object.assign(r.info,await this.table.call('info',id));return this.info(id)}
 async update(id:string,text:string){this.rejectDuringReload(id);return this.serial(id,()=>this.updateNow(id,text))}
 private async updateNow(id:string,text:string){const r=this.get(id);if(r.info.readonly||r.info.kind==='csv')throw new Error('El documento no permite edición de texto.');if(Buffer.byteLength(text)>10*1024*1024)throw new Error('El documento supera el límite de edición de 10 MiB.');if(text!==r.text){r.undo.push(r.text);while(r.undo.length>1&&(r.undo.length>100||r.undo.reduce((n,t)=>n+Buffer.byteLength(t),0)>20*1024*1024))r.undo.shift();r.redo=[];r.text=text;r.info.dirty=true;r.info.revision++;this.schedule(id)}return this.info(id)}
 schedule(id:string){const r=this.get(id);clearTimeout(r.timer);r.timer=setTimeout(()=>{this.checkpoint(id).catch(e=>this.emit({type:'error',message:`No se pudo guardar recuperación: ${(e as Error).message}`}))},2000)}
 checkpoint(id:string):Promise<void>{const pending=this.recoveryTasks.get(id);if(pending)return pending;const task=this.checkpointNow(id).finally(()=>this.recoveryTasks.delete(id));this.recoveryTasks.set(id,task);return task}
 private async checkpointNow(id:string){const r=this.get(id);if(!r.info.dirty||r.info.readonly)return;await mkdir(this.recoveryDir,{recursive:true,mode:0o700});const revision=r.info.revision;const data=r.info.kind==='csv'?await this.table.call<string>('checkpoint',id,{...r.info}):JSON.stringify({version:1,info:r.info,savedAt:new Date().toISOString(),snapshot:{text:r.text}});await atomicWrite(join(this.recoveryDir,`${id}.json`),data);if(revision!==r.info.revision)this.schedule(id)}
 async tableEdit(id:string,edit:TableEdit){this.rejectDuringReload(id);if((edit.type==='structure'||edit.type==='range')&&this.operations.has(id))throw new Error('Espera a que termine el guardado o la edición anterior antes de preparar el cambio.');return this.serial(id,()=>this.tableEditNow(id,edit))}
 private async tableEditNow(id:string,edit:TableEdit){const r=this.get(id);await this.table.call('edit',id,edit);await this.syncTable(id);this.schedule(id);return this.info(id)}
 async tableOptions(id:string,options:TableOptions){return this.reinterpret(id,()=>this.tableOptionsNow(id,options))}
 private async tableOptionsNow(id:string,options:TableOptions){const r=this.get(id);if(r.info.dirty)throw new Error('Guarda los cambios antes de cambiar cómo se interpreta el archivo.');if(!r.info.path)throw new Error('Guarda el archivo antes de cambiar su interpretación.');const initial=await stat(r.info.path);const before=initial.size<=50*1024*1024?await digest(r.info.path):undefined;if(r.hash!==undefined&&r.hash!==before)throw new Error('El archivo cambió en disco. Recárgalo antes de cambiar su interpretación.');await this.table.call('open',id,r.info.path,options);await this.syncTable(id);const after=await stat(r.info.path);if(before!==undefined?before!==await digest(r.info.path):initial.size!==after.size||initial.mtimeMs!==after.mtimeMs)throw new Error('El archivo cambió durante la lectura. Recárgalo antes de guardar.');r.hash=before;return this.info(id)}
 async undo(id:string,redo=false){this.rejectDuringReload(id);return this.serial(id,()=>this.undoNow(id,redo))}
 private async undoNow(id:string,redo=false){const r=this.get(id);if(r.info.readonly)return this.info(id);if(r.info.kind==='csv'){await this.table.call('undo',id,redo);await this.syncTable(id)}else{const from=redo?r.redo:r.undo,to=redo?r.undo:r.redo;const text=from.pop();if(text===undefined)return this.info(id);to.push(r.text);r.text=text;r.info.dirty=true;r.info.revision++}this.schedule(id);return this.info(id)}
 private async saveDestination(r:RecordDoc){if(process.env.FREYALAB_TEST==='1'&&(process.env.FREYALAB_TEST_SAVE_PATH||process.env.FREYALAB_TEST_SAVE_DIR))return process.env.FREYALAB_TEST_SAVE_PATH??join(process.env.FREYALAB_TEST_SAVE_DIR!,r.info.name.replace('Sin título','documento'));const result=await dialog.showSaveDialog(this.owner(),{defaultPath:r.info.path??r.info.name});return result.canceled?null:result.filePath??null}
 async save(id:string,as=false){return this.serial(id,()=>this.saveNow(id,as))}
 private async saveNow(id:string,as=false){const r=this.get(id);if(r.info.readonly)throw new Error('La muestra es de solo lectura.');const dest=as||!r.info.path?await this.saveDestination(r):r.info.path;if(!dest)return null;const canonical=await realpath(dest).catch(()=>resolve(dest));if([...this.records.values()].some(other=>other!==r&&other.info.path===canonical))throw new Error('El destino corresponde a otro documento abierto. Guarda una copia con otro nombre.');if((await lstat(dest).catch(()=>null))?.isSymbolicLink())throw new Error('No se sobrescriben enlaces simbólicos.');const revision=r.info.revision;const data=r.info.kind==='csv'?Buffer.from(await this.table.call('serialize',id)):Buffer.from(r.text,'utf8');const same=r.info.path===dest;r.saving=true;try{await atomicWrite(dest,data,same?r.hash:undefined);r.hash=createHash('sha256').update(data).digest('hex');if(revision===r.info.revision){if(r.info.kind==='csv'){const marked=await this.table.call('markSaved',id,revision);if(marked.revision>=r.info.revision)Object.assign(r.info,marked)}else r.info.dirty=false;if(!r.info.dirty){clearTimeout(r.timer);await this.recoveryTasks.get(id);if(!r.info.dirty)await this.discardRecovery(id)}}r.info.path=dest;r.info.name=basename(dest);r.root=dirname(dest);await r.watcher?.close();r.watcher=watch(dest,{ignoreInitial:true}).on('change',()=>{if(!r.saving)this.emit({type:'external',id})});await this.addRecent(dest);return this.info(id)}finally{setTimeout(()=>{r.saving=false},300)}}
 async close(id:string){return this.serial(id,()=>this.closeNow(id))}
 private async closeNow(id:string){const r=this.get(id);if(r.info.dirty){const {response}=await dialog.showMessageBox(this.owner(),{type:'question',buttons:['Guardar','Cancelar','Descartar cambios'],defaultId:0,cancelId:1,message:`¿Guardar los cambios de ${r.info.name}?`});if(response===1)return false;if(response===0&&!(await this.saveNow(id)))return false}clearTimeout(r.timer);await r.watcher?.close();if(r.info.kind==='csv')await this.table.call('close',id);this.records.delete(id);await this.discardRecovery(id);return true}
 async reload(id:string){return this.reinterpret(id,()=>this.reloadNow(id))}
 private async reloadNow(id:string){
  const r=this.get(id);if(!r.info.path)throw new Error('El documento no tiene un archivo original.')
  if(r.info.dirty){const {response}=await dialog.showMessageBox(this.owner(),{type:'warning',buttons:['Conservar mis cambios','Recargar y descartar cambios'],defaultId:0,cancelId:0,message:'El archivo cambió fuera de FreyaLab. Recargar reemplazará tus cambios locales.'});if(response===0)return this.info(id)}
  if(r.info.kind==='csv'){const size=(await stat(r.info.path)).size;const before=size<=50*1024*1024?await digest(r.info.path):undefined;await this.table.call('open',id,r.info.path,{encoding:r.info.encoding,delimiter:r.info.delimiter});await this.syncTable(id);if(!r.info.readonly&&before!==await digest(r.info.path))throw new Error('El archivo cambió durante la recarga. Vuelve a intentarlo.')}
  else {r.info.readonly=(await stat(r.info.path)).size>10*1024*1024;let data:Buffer;if(r.info.readonly){const handle=await openFile(r.info.path,'r');try{data=Buffer.alloc(1024*1024);const result=await handle.read(data,0,data.length,0);data=data.subarray(0,result.bytesRead)}finally{await handle.close()}}else data=await readFile(r.info.path);const nextText=data.toString('utf8');if(!r.info.readonly&&!Buffer.from(nextText).equals(data))throw new Error('El archivo externo no es UTF-8 válido.');r.text=nextText;r.info.warning=r.info.readonly?'Muestra de solo lectura: primer MiB. El archivo supera 10 MiB.':undefined;r.info.revision++;r.info.dirty=false}
  r.hash=r.info.readonly?undefined:await digest(r.info.path);r.undo=[];r.redo=[];clearTimeout(r.timer);await this.discardRecovery(id);return this.info(id)
 }
 async tree(path:string):Promise<TreeEntry[]>{if(!await this.allowed(path))throw new Error('Carpeta no autorizada.');const entries=await readdir(path,{withFileTypes:true});return entries.filter(e=>!e.name.startsWith('.')&&e.name!=='node_modules'&&!e.isSymbolicLink()&&(e.isDirectory()||extensions[extname(e.name).toLowerCase()])).sort((a,b)=>Number(b.isDirectory())-Number(a.isDirectory())||a.name.localeCompare(b.name)).map(e=>({name:e.name,path:join(path,e.name),directory:e.isDirectory()}))}
 cancelFileSearch(){this.fileSearch++;this.cancelQueuedTagReads()}
 async findFiles(root:string,query:string){
  const token=++this.fileSearch,check=()=>{if(token!==this.fileSearch)throw new Error('Búsqueda cancelada.')}
  this.cancelQueuedTagReads()
  const tokens=tokensFileQuery(query),tags=tokens.filter(part=>part.tag).map(part=>normalizeTag(part.value)),entries:TreeEntry[]=[]
  let limited:boolean
  if(tags.length){
   const names=tokens.filter(part=>!part.tag).map(part=>part.value.toLocaleLowerCase())
   limited=await this.scanTaggedFiles(root,check,entry=>names.every(name=>entry.name.toLocaleLowerCase().includes(name)),batch=>{
    for(const {entry,tags:values} of batch){const keys=new Set(values.map(normalizeTag));if(tags.every(tag=>keys.has(tag))){entries.push(entry);if(entries.length===200)return true}}
    return false
   })
  }else{
   const needle=query.toLocaleLowerCase()
   limited=await this.scanFiles(root,check,async batch=>{for(const entry of batch)if(entry.name.toLocaleLowerCase().includes(needle)){entries.push(entry);if(entries.length===200)return true};return false})
  }
  check();return{entries,limited}
 }
 cancelTagList(){this.tagList++;this.cancelQueuedTagReads()}
 async listTags(root:string){
  const token=++this.tagList,check=()=>{if(token!==this.tagList)throw new Error('Lectura de etiquetas cancelada.')}
  this.cancelQueuedTagReads()
  const counts=new Map<string,{count:number;variants:Map<string,number>}>();let overflow=false
  const limited=await this.scanTaggedFiles(root,check,()=>true,batch=>{
   for(const {tags} of batch)for(const tag of tags){
    const key=normalizeTag(tag);let entry=counts.get(key)
    if(!entry){if(counts.size===500){overflow=true;continue};entry={count:0,variants:new Map()};counts.set(key,entry)}
    entry.count++;entry.variants.set(tag,(entry.variants.get(tag)??0)+1)
   }
   return false
  })
  check()
  const tags=Array.from(counts.values(),entry=>{
   let tag='',frequency=0
   for(const [variant,count] of entry.variants)if(count>frequency){tag=variant;frequency=count}
   return{tag,count:entry.count}
  }).sort((a,b)=>normalizeTag(a.tag).localeCompare(normalizeTag(b.tag),'es'))
  return{tags,limited:limited||overflow}
 }
 private async scanFiles(root:string,check:()=>void,visit:(batch:TreeEntry[])=>Promise<boolean>):Promise<boolean>{
  check();const authorized=await this.allowed(root);check();if(!authorized)throw new Error('Carpeta no autorizada.')
  const queue=[root],batch:TreeEntry[]=[];let cursor=0,pruned=false
  while(cursor<queue.length){
   check();const directory=queue[cursor++];let children:TreeEntry[]
   try{const info=await lstat(directory);check();if(info.isSymbolicLink()||!info.isDirectory())continue;children=await this.tree(directory)}catch{check();continue}
   check()
   for(const entry of children){
    check()
    if(entry.directory){if(queue.length<1000)queue.push(entry.path);else pruned=true}
    else{batch.push(entry);if(batch.length===8){if(await visit(batch.splice(0)))return true;check()}}
   }
  }
  if(batch.length&&await visit(batch))return true
  check();return pruned
 }
 private async scanTaggedFiles(root:string,check:()=>void,accept:(entry:TreeEntry)=>boolean,visit:(batch:{entry:TreeEntry;tags:string[]}[])=>boolean):Promise<boolean>{
  let read=0
  return this.scanFiles(root,check,async batch=>{
   const markdown=batch.filter(entry=>/\.(?:md|markdown)$/i.test(entry.name)&&accept(entry))
   for(let offset=0;offset<markdown.length;){
    check();const entries=markdown.slice(offset,offset+5000-read);offset+=entries.length
    const results=await Promise.allSettled(entries.map(entry=>this.fileTags(root,entry.path,check)));check()
    const values=results.map((result,index)=>{if(result.status==='rejected')throw result.reason;read+=Number(result.value.read);return{entry:entries[index],tags:result.value.tags}})
    if(visit(values)||read===5000)return true
   }
   return false
  })
 }
 private cancelQueuedTagReads(){
  this.tagReadQueue=this.tagReadQueue.filter(waiter=>{try{waiter.check();return true}catch(error){waiter.reject(error);return false}})
 }
 private async fileTags(root:string,path:string,check:()=>void):Promise<{tags:string[];read:boolean}>{
  check()
  if(this.tagReaders<8)this.tagReaders++
  else await new Promise<void>((resolve,reject)=>this.tagReadQueue.push({check,resolve,reject}))
  let handle:Awaited<ReturnType<typeof openFile>>|undefined,read=false
  try{
   check();const authorized=await this.allowed(path);check();if(!authorized)return{tags:[],read}
   const inside=await contained(root,path);check();if(!inside)return{tags:[],read}
   const before=await lstat(path);check();if(!before.isFile()||before.isSymbolicLink())return{tags:[],read}
   const canonical=await realpath(path);check()
   handle=await openFile(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));check()
   const info=await handle.stat();check()
   const current=await lstat(path);check()
   if(!info.isFile()||!current.isFile()||current.isSymbolicLink()||info.dev!==before.dev||info.ino!==before.ino||current.dev!==info.dev||current.ino!==info.ino)return{tags:[],read}
   const openedPath=await realpath(path);check();if(openedPath!==canonical)return{tags:[],read}
   const stillInside=await contained(root,openedPath);check();if(!stillInside)return{tags:[],read}
   const stillAuthorized=await this.allowed(openedPath);check();if(!stillAuthorized)return{tags:[],read}
   read=true;const bytes=Buffer.alloc(Math.min(16384,info.size));let offset=0
   while(offset<bytes.length){check();const result=await handle.read(bytes,offset,bytes.length-offset,offset);check();if(!result.bytesRead)break;offset+=result.bytesRead}
   const after=await handle.stat();check();if(after.size!==info.size||after.mtimeMs!==info.mtimeMs)return{tags:[],read}
   const decoder=new TextDecoder('utf-8',{fatal:true}),source=decoder.decode(bytes.subarray(0,offset),{stream:offset===16384&&info.size>offset})
   return{tags:parseTags(frontMatterOf(source).frontMatter),read}
  }catch{check();return{tags:[],read}}
  finally{
   try{await handle?.close()}catch{}
   const next=this.tagReadQueue.shift()
   if(next)next.resolve();else this.tagReaders--
  }
 }
 async allowed(path:string){for(const root of this.roots)if(await contained(root,path).catch(()=>false))return true;return this.grants.has(resolve(path))||process.env.FREYALAB_TEST==='1'}
 async recents():Promise<string[]>{try{return JSON.parse(await readFile(join(app.getPath('userData'),'recents.json'),'utf8'))}catch{return[]}}
 private async addRecent(path:string){const list=[path,...(await this.recents()).filter(p=>p!==path)].slice(0,15);await mkdir(app.getPath('userData'),{recursive:true});await atomicWrite(join(app.getPath('userData'),'recents.json'),JSON.stringify(list))}
 async listRecoveries():Promise<RecoveryEntry[]>{await mkdir(this.recoveryDir,{recursive:true,mode:0o700});const entries=await readdir(this.recoveryDir);const result:RecoveryEntry[]=[];for(const f of entries.filter(f=>/^[a-f0-9-]+\.json$/.test(f))){try{const d=JSON.parse(await readFile(join(this.recoveryDir,f),'utf8'));if(d.version===1)result.push({id:f.slice(0,-5),name:d.info.name,savedAt:d.savedAt})}catch{}}return result}
 async recover(id:string){const data=JSON.parse(await readFile(join(this.recoveryDir,`${id}.json`),'utf8'));if(data.version!==1)throw new Error('Versión de recuperación no compatible. El archivo se conserva.');const info=await this.create(data.info.kind);const r=this.get(info.id);if(info.kind==='csv'){try{await this.table.call('restore',info.id,data.snapshot);await this.syncTable(info.id)}catch(error){await this.table.call('close',info.id).catch(()=>{});this.records.delete(info.id);throw error}}else r.text=data.snapshot.text;r.info.name=`Recuperado-${data.info.name}`;r.info.path=null;r.info.dirty=true;r.root=app.getPath('documents');this.schedule(info.id);return this.info(info.id)}
 async discardRecovery(id:string){await this.recoveryTasks.get(id);await unlink(join(this.recoveryDir,`${id}.json`)).catch(e=>{if(e.code!=='ENOENT')throw e})}
 async image(id:string,source:string){if(source.startsWith('data:image/')&&source.length<16*1024*1024)return source;if(/^[a-z]+:/i.test(source)||source.startsWith('//'))return null;const r=this.get(id);try{const file=resolve(r.root,decodeURIComponent(source.split(/[?#]/)[0]));if(!await contained(r.root,file))return null;const mime:Record<string,string>={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml'};const type=mime[extname(file).toLowerCase()];if(!type||(await stat(file)).size>8*1024*1024)return null;return `data:${type};base64,${(await readFile(file)).toString('base64')}`}catch{return null}}
 async shutdown(){for(const [id,r] of this.records){clearTimeout(r.timer);await this.checkpoint(id);await r.watcher?.close()}this.table.stop()}
}
