import * as shared from '../../shared/i18n'
export type {Language,LanguagePreference,LanguageState,TranslationParameters} from '../../shared/i18n'
let language=$state<shared.Language>('es')
export function setUILanguage(value:shared.Language):void {language=value;shared.setLanguage(value)}
export function getUILanguage():shared.Language {return language}
export function t(key:string,parameters:shared.TranslationParameters={}):string {return shared.t(key,parameters,language)}
export function plural(key:string,count:number,parameters:shared.TranslationParameters={}):string {return shared.plural(key,count,parameters,language)}
export function formatNumber(value:number,options?:Intl.NumberFormatOptions):string {return shared.formatNumber(value,options,language)}
export function formatDate(value:Date|number,options?:Intl.DateTimeFormatOptions):string {return shared.formatDate(value,options,language)}
export function formatList(values:readonly string[],options?:Intl.ListFormatOptions):string {return shared.formatList(values,options,language)}
