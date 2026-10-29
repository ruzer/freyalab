import {app,clipboard} from 'electron'
import {readFile} from 'node:fs/promises'
import {dirname,join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {formatApplicationInfo,releaseChannel,type ApplicationInfo} from '../shared/app-info'
import {getLanguage,t} from '../shared/i18n'
declare const __FREYALAB_BUILD__:string|undefined

export function applicationInfo():ApplicationInfo {
 const version=app.getVersion(),build=typeof __FREYALAB_BUILD__==='string'&&/^[a-f0-9]{7,40}$/i.test(__FREYALAB_BUILD__)?__FREYALAB_BUILD__:null
 return{version,build,channel:releaseChannel(version),electron:process.versions.electron??'',chromium:process.versions.chrome??'',node:process.versions.node,platform:process.platform,arch:process.arch,language:getLanguage()}
}
export async function copyApplicationInfo():Promise<void> {
 try{await clipboard.writeText(formatApplicationInfo(applicationInfo()))}
 catch{throw new Error(t('about.copyFailed'))}
}
export async function thirdPartyNotices():Promise<string> {
 const path=app.isPackaged?join(app.getAppPath(),'THIRD_PARTY_NOTICES.txt'):resolve(dirname(fileURLToPath(import.meta.url)),'../../THIRD_PARTY_NOTICES.txt')
 try{return await readFile(path,'utf8')}
 catch{throw new Error(t('about.licensesFailed'))}
}
