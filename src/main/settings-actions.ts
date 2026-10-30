import {app,dialog,shell,type BrowserWindow,type MessageBoxOptions} from 'electron'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {atomicWrite} from './files'
import type {SettingsStore} from './settings'
import {defaultSettings,type SettingsState} from '../shared/settings'
import {t} from '../shared/i18n'

async function confirmed(parent:BrowserWindow|undefined,message:'settings.confirmReset'|'settings.confirmClearRecents',button:string):Promise<boolean>{
 const options:MessageBoxOptions={type:'question',title:t('settings.title'),message:t(message),detail:t(`${message}.detail`),buttons:[t(button),t('dialog.cancel')],defaultId:1,cancelId:1,noLink:true}
 const result=parent?await dialog.showMessageBox(parent,options):await dialog.showMessageBox(options)
 return result.response===0
}
export async function resetSettings(store:SettingsStore,parent?:BrowserWindow):Promise<SettingsState|null>{
 if(!await confirmed(parent,'settings.confirmReset','settings.confirmReset.button'))return null
 const{version:_,...values}=defaultSettings()
 return store.set(values)
}
export async function clearRecents(parent?:BrowserWindow):Promise<boolean>{
 if(!await confirmed(parent,'settings.confirmClearRecents','settings.clearRecents'))return false
 try{await mkdir(app.getPath('userData'),{recursive:true});await atomicWrite(join(app.getPath('userData'),'recents.json'),'[]\n');return true}
 catch{throw new Error(t('settings.recentsFailed'))}
}
export async function showDataFolder():Promise<void>{
 try{if(await shell.openPath(app.getPath('userData')))throw new Error()}
 catch{throw new Error(t('settings.folderFailed'))}
}
