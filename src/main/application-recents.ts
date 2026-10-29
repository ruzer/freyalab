import {app} from 'electron'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {z} from 'zod'
import {atomicWrite} from './files'

export async function removeMissingRecent(missingPath:string):Promise<void>{
 const path=join(app.getPath('userData'),'recents.json'),bytes=await readFile(path)
 const before=z.array(z.string()).parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)))
 const after=before.filter(value=>value!==missingPath)
 if(after.length!==before.length)await atomicWrite(path,JSON.stringify(after),createHash('sha256').update(bytes).digest('hex'))
}
