import { createHash, randomUUID } from 'node:crypto'
import { open, rename, link, unlink, stat, chmod, realpath } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import type {FileHandle} from 'node:fs/promises'
import { dirname, basename, join, relative, isAbsolute } from 'node:path'
export async function digest(source:string|FileHandle,options?:{signal?:AbortSignal;observe?:(chunk:Buffer)=>void}):Promise<string> {
 const stream=typeof source==='string'?createReadStream(source,{signal:options?.signal}):source.createReadStream({signal:options?.signal,autoClose:false,start:0})
 const hash=createHash('sha256')
 for await(const chunk of stream){hash.update(chunk);options?.observe?.(chunk);options?.signal?.throwIfAborted()}
 return hash.digest('hex')
}
export async function contained(root:string,path:string):Promise<boolean> {
 const r=relative(await realpath(root),await realpath(path)); return r===''||(!r.startsWith('..')&&!isAbsolute(r))
}
export async function atomicWrite(path:string,data:Uint8Array|string|AsyncIterable<Uint8Array>,expected?:string|null):Promise<void> {
 const temp=join(dirname(path),`.${basename(path)}.${randomUUID()}.tmp`)
 let handle:Awaited<ReturnType<typeof open>>|undefined
 try {
  if(typeof expected==='string'&&await digest(path)!==expected) throw new Error('El archivo cambió en disco. Guarda una copia para conservar ambos cambios.')
  let mode:number|undefined
  try { mode=(await stat(path)).mode } catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT') throw e}
  handle=await open(temp,'wx',mode??0o600); await handle.writeFile(data); await handle.sync(); await handle.close(); handle=undefined
  if(mode!==undefined) await chmod(temp,mode)
  if(typeof expected==='string'&&await digest(path)!==expected) throw new Error('El archivo cambió durante el guardado. Guarda una copia.')
  // A new manifest must never replace a concurrent creation.
  if(expected===null){await link(temp,path);await unlink(temp).catch(()=>{})}
  else await rename(temp,path)
  // Persist directory metadata where the filesystem supports it; replacement is already complete.
  try { const dir=await open(dirname(path),'r');try {await dir.sync()}finally{await dir.close()} } catch {}
 } catch(e) {if(handle)await handle.close().catch(()=>{});await unlink(temp).catch(()=>{});throw e}
}
