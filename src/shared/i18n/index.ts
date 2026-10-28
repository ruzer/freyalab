import es from './es.json'
import en from './en.json'
export type Language='es'|'en'|'en-XA'
export type LanguagePreference='sistema'|'es'|'en'
export type TranslationParameters=Readonly<Record<string,string|number>>
export interface LanguageState {preference:LanguagePreference;language:Language}
let language:Language='es'
export function getLanguage():Language {return language}
export function setLanguage(value:Language):void {language=value}
export function resolveLanguage(preference:unknown,systemLanguages:readonly string[]):'es'|'en' {
 return preference==='es'||preference==='en'?preference:/^es(?:-|$)/i.test(systemLanguages[0]??'')?'es':'en'
}
const locales={es:'es-MX',en:'en-US','en-XA':'en-US'}
function pseudo(value:string):string {
 const vowels:Record<string,string>={a:'á',e:'ë',i:'ï',o:'ö',u:'ü',A:'Á',E:'Ë',I:'Ï',O:'Ö',U:'Ü'}
 return '['+value.replace(/\{[^}]+\}|[aeiou]/gi,token=>vowels[token]??token)+'~'.repeat(Math.ceil(value.length*.3))+']'
}
export function t(key:string,parameters:TranslationParameters={},locale:Language=language):string {
 const catalog:Record<string,string>=locale==='es'?es:en
 let message=Object.hasOwn(catalog,key)?catalog[key]:undefined
 if(message===undefined){
  if(import.meta.env.DEV){console.warn(`Missing translation: ${key}`);return key}
  message=Object.hasOwn(es,key)?(es as Record<string,string>)[key]:key
 }
 if(locale==='en-XA')message=pseudo(message)
 return message.replace(/\{([^}]+)\}/g,(marker,name)=>Object.hasOwn(parameters,name)?String(parameters[name]):marker)
}
export function plural(key:string,count:number,parameters:TranslationParameters={},locale:Language=language):string {
 return t(`${key}.${new Intl.PluralRules(locales[locale]).select(count)}`,{...parameters,count},locale)
}
export function formatNumber(value:number,options?:Intl.NumberFormatOptions,locale:Language=language):string {return new Intl.NumberFormat(locales[locale],options).format(value)}
export function formatDate(value:Date|number,options?:Intl.DateTimeFormatOptions,locale:Language=language):string {return new Intl.DateTimeFormat(locales[locale],options).format(value)}
export function formatList(values:readonly string[],options?:Intl.ListFormatOptions,locale:Language=language):string {return new Intl.ListFormat(locales[locale],options).format(values)}
