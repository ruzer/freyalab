import {formatNumber,type Language} from './i18n'

export type AnalysisNumberMode='auto'|'all'
export type AnalysisNumberKind='number'|'count'|'coefficient'|'percent'
export type AnalysisCopyFragment=
 |{kind:'text';text:string}
 |{kind:'number';value:number|string;unit?:string}

export function formatAnalysisNumber(value:number,mode:AnalysisNumberMode='auto',language?:Language,kind:AnalysisNumberKind='number'):string{
 const number=Object.is(value,-0)?0:value
 if(mode==='all')return formatNumber(number,{maximumSignificantDigits:15},language)
 let digits=kind==='count'?0:kind==='coefficient'?3:2
 const options: Intl.NumberFormatOptions=number!==0&&Math.abs(number)<0.01?{maximumSignificantDigits:2}:{maximumFractionDigits:digits}
 let text=formatNumber(number,options,language)
 const falseBoundary=()=>number!==0&&(text==='0'||text==='-0')
  ||kind==='coefficient'&&Math.abs(number)!==1&&(text==='1'||text==='-1')
  ||kind==='percent'&&number!==100&&text==='100'
 // Only presentation changes. A finite double needs at most 17 significant digits.
 while(Number.isFinite(number)&&falseBoundary()&&digits<17){
  digits++;text=formatNumber(number,{maximumFractionDigits:digits},language)
 }
 return falseBoundary()?formatNumber(number,{maximumSignificantDigits:17},language):text
}

export function formatAnalysisFullNumber(value:number|string,unit=''):string{
 return String(value)+unit
}

export function copyAnalysisFragments(parts:readonly AnalysisCopyFragment[]):string{
 return parts.map(part=>part.kind==='number'?formatAnalysisFullNumber(part.value,part.unit):part.text).join('')
}
