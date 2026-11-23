import {formatNumber,type Language} from './i18n'

export type AnalysisNumberMode=2|'all'
export type AnalysisCopyFragment=
 |{kind:'text';text:string}
 |{kind:'number';value:number;unit?:string}

export function formatAnalysisNumber(value:number,mode:AnalysisNumberMode=2,language?:Language):string{
 const number=Object.is(value,-0)?0:value
 const options: Intl.NumberFormatOptions=mode==='all'
  ?{maximumSignificantDigits:15}
  :number!==0&&Math.abs(number)<0.01?{maximumSignificantDigits:2}:{maximumFractionDigits:2}
 return formatNumber(number,options,language)
}

export function formatAnalysisFullNumber(value:number,unit=''):string{
 const precision=value.toPrecision(15),number=Number(precision)
 // Rounding a finite boundary to 15 figures can exceed Number.MAX_VALUE.
 if(Number.isFinite(value)&&!Number.isFinite(number))return precision+unit
 return String(Object.is(number,-0)?0:number)+unit
}

export function copyAnalysisFragments(parts:readonly AnalysisCopyFragment[]):string{
 return parts.map(part=>part.kind==='number'?formatAnalysisFullNumber(part.value,part.unit):part.text).join('')
}
