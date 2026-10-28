import {t} from '../shared/i18n'
import {mkdir,readFile,realpath,stat} from 'node:fs/promises'
import {dirname,isAbsolute} from 'node:path'
import {atomicWrite} from './files'
import {CSV_TEXT_LIMIT,type CsvView} from '../shared/types'
interface Entry {path:string;view:CsvView}
export class CsvViewStore {
 private loaded?:Promise<Entry[]>
 private pending:Promise<void>=Promise.resolve()
 constructor(private path:string){}
 private entries(){return this.loaded??=this.load()}
 private async load():Promise<Entry[]>{
  try{
   if((await stat(this.path)).size>4*1024*1024)return[]
   const data=JSON.parse(await readFile(this.path,'utf8'))
   if(data?.version!==1||!Array.isArray(data.entries)||!data.entries.every((entry:Entry)=>entry&&typeof entry.path==='string'&&isAbsolute(entry.path)&&(entry.view==='table'||entry.view==='text')))return[]
   const entries:Entry[]=[]
   for(const {path,view} of data.entries){const old=entries.findIndex(entry=>entry.path===path);if(old>=0)entries.splice(old,1);entries.push({path,view})}
   return entries.slice(-500)
  }catch{return[]}
 }
 async get(path:string):Promise<CsvView>{
  try{const canonical=await realpath(path),info=await stat(canonical);if(!info.isFile()||info.size>CSV_TEXT_LIMIT)return'table';return(await this.entries()).find(entry=>entry.path===canonical)?.view??'table'}catch{return'table'}
 }
 remember(path:string,view:CsvView):Promise<void>{
  const task=this.pending.then(async()=>{
   if(view!=='table'&&view!=='text')throw new Error(t('csvText.invalidView'))
   const canonical=await realpath(path),info=await stat(canonical)
   if(!info.isFile())throw new Error(t('csvText.selectFile'))
   if(view==='text'&&info.size>CSV_TEXT_LIMIT)throw new Error(t('csvText.limit'))
   const next=[...(await this.entries()).filter(entry=>entry.path!==canonical),{path:canonical,view}].slice(-500)
   await mkdir(dirname(this.path),{recursive:true});await atomicWrite(this.path,JSON.stringify({version:1,entries:next}))
   this.loaded=Promise.resolve(next)
  })
  this.pending=task.catch(()=>{});return task
 }
}
