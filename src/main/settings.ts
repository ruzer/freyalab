import {constants} from 'node:fs'
import {createHash} from 'node:crypto'
import {copyFile,mkdir,readFile} from 'node:fs/promises'
import {dirname} from 'node:path'
import {atomicWrite,digest} from './files'
import {defaultSettings,legacySettings,settingsPatchSchema,settingsSchema,type Settings,type SettingsState} from '../shared/settings'
import {t} from '../shared/i18n'

export class SettingsStore {
 private pending:Promise<unknown>=Promise.resolve()
 private expected?:string
 constructor(private path:string){}
 flush():Promise<void>{return this.pending.then(()=>{})}
 private change<T>(operation:()=>Promise<T>):Promise<T>{const next=this.pending.then(operation);this.pending=next.catch(()=>{});return next}
 private async write(values:Settings){
  const data=JSON.stringify(values,null,1)+'\n'
  try{await mkdir(dirname(this.path),{recursive:true,mode:0o700});await atomicWrite(this.path,data,this.expected);this.expected=createHash('sha256').update(data).digest('hex')}
  catch{throw new Error(t('settings.writeFailed'))}
 }
 private async read():Promise<SettingsState>{
  this.expected=undefined
  let raw:Buffer
  try{raw=await readFile(this.path)}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return{values:defaultSettings(),readonly:false,migrationPending:true};return this.recover()}
  this.expected=createHash('sha256').update(raw).digest('hex')
  try{
   const value:unknown=JSON.parse(raw.toString('utf8'))
   if(value&&typeof value==='object'&&!Array.isArray(value)&&'version'in value&&typeof value.version==='number'&&value.version>1)return{values:defaultSettings(),readonly:true,migrationPending:false,notice:t('settings.futureVersion')}
   const parsed=settingsSchema.safeParse(value)
   if(parsed.success)return{values:parsed.data,readonly:false,migrationPending:false}
  }catch{}
  return this.recover()
 }
 private async recover():Promise<SettingsState>{
  const values=defaultSettings()
  try{
   // No sustituir una copia anterior ni un original que no pudimos respaldar.
   await copyFile(this.path,this.path+'.bak',constants.COPYFILE_EXCL)
   if(this.expected===undefined||await digest(this.path+'.bak')!==this.expected)throw new Error(t('settings.recoveryFailed'))
   await this.write(values)
   return{values,readonly:false,migrationPending:false,notice:t('settings.recovered')}
  }catch{return{values,readonly:true,migrationPending:false,notice:t('settings.recoveryFailed')}}
 }
 get():Promise<SettingsState>{return this.change(()=>this.read())}
 set(value:unknown):Promise<SettingsState>{return this.change(async()=>{
  const patch=settingsPatchSchema.safeParse(value)
  if(!patch.success)throw new Error(t('settings.invalid'))
  const current=await this.read()
  if(current.readonly)throw new Error(t('settings.readonly'))
  const previous=current.values,change=patch.data
  const values=settingsSchema.parse({...previous,...change,barraLateral:{...previous.barraLateral,...change.barraLateral},markdown:{...previous.markdown,...change.markdown},actualizaciones:{...previous.actualizaciones,...change.actualizaciones},avanzado:{...previous.avanzado,...change.avanzado}})
  await this.write(values)
  return{...current,values,readonly:false,migrationPending:false}
 })}
 migrate(value:unknown):Promise<SettingsState>{return this.change(async()=>{
  const current=await this.read()
  if(!current.migrationPending)return current
  const values=legacySettings(value);await this.write(values)
  return{values,readonly:false,migrationPending:false}
 })}
}
