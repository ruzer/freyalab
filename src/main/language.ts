import {getLanguage,setLanguage,resolveLanguage,type Language,type LanguagePreference,type LanguageState} from '../shared/i18n'
let preference:LanguagePreference='sistema',systemLanguages:readonly string[]=[]
export function initializeLanguage(languages:readonly string[],environment:Readonly<Record<string,string|undefined>>):LanguageState {
 systemLanguages=languages;preference='sistema'
 const forced=environment.FREYALAB_LANG
 const language:Language=environment.FREYALAB_TEST==='1'&&(forced==='es'||forced==='en'||forced==='en-XA')?forced:resolveLanguage(preference,systemLanguages)
 setLanguage(language);return languageState()
}
export function languageState():LanguageState {return{preference,language:getLanguage()}}
export function changeLanguage(value:LanguagePreference):LanguageState {preference=value;setLanguage(resolveLanguage(preference,systemLanguages));return languageState()}
