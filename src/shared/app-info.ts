import {t,type Language} from './i18n'

export type ReleaseChannel='alpha'|'beta'|'stable'|'development'
export interface ApplicationInfo {version:string;build:string|null;channel:ReleaseChannel;electron:string;chromium:string;node:string;platform:string;arch:string;language:Language}
export function releaseChannel(version:string):ReleaseChannel {
 if(/-alpha(?:[.-]|$)/i.test(version))return'alpha'
 if(/-beta(?:[.-]|$)/i.test(version))return'beta'
 return/^\d+\.\d+\.\d+(?:\+[\w.-]+)?$/.test(version)?'stable':'development'
}
export function platformName(platform:string):string {return({darwin:'macOS',win32:'Windows',linux:'Linux'} as Record<string,string>)[platform]??platform}
export function formatApplicationInfo(info:ApplicationInfo):string {
 const label=(key:string)=>t(key,{},info.language)
 return[
  `FreyaLab ${info.version}`,
  `${label('about.build')}: ${info.build??label('about.development')}`,
  `${label('about.channel')}: ${label(`about.channel.${info.channel}`)}`,
  `${label('about.electron')}: ${info.electron}`,
  `${label('about.chromium')}: ${info.chromium}`,
  `${label('about.node')}: ${info.node}`,
  `${label('about.system')}: ${platformName(info.platform)}`,
  `${label('about.architecture')}: ${info.arch}`,
  `${label('about.language')}: ${info.language}`,
 ].join('\n')
}
