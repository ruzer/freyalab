import type {Encoding,TextEncoding} from './types'
export const textEncodings=['utf8','utf16le','utf16be','win1252','latin1'] as const satisfies readonly TextEncoding[]
export interface TextFormat {encoding:TextEncoding;bom:boolean}
export interface CsvTextFormat {encoding:Encoding;bom:boolean}
export function isTextFormat(value:unknown):value is TextFormat{
 if(!value||typeof value!=='object')return false
 const {encoding,bom}=value as Partial<TextFormat>
 return textEncodings.some(item=>item===encoding)&&typeof bom==='boolean'&&!(bom&&(encoding==='win1252'||encoding==='latin1'))
}
export function isCsvTextFormat(value:unknown):value is CsvTextFormat{
 return isTextFormat(value)&&value.encoding!=='utf16be'&&value.encoding!=='latin1'
}
export function csvTextStatistics(text:string):{eol:'LF'|'CRLF'|'CR'|'mixed'|'none';lines:number}{
 const endings=new Set<'LF'|'CRLF'|'CR'>();let lines=1
 for(const match of text.matchAll(/\r\n|\r|\n/g)){endings.add(match[0]==='\n'?'LF':match[0]==='\r\n'?'CRLF':'CR');lines++}
 return{eol:endings.size===0?'none':endings.size===1?[...endings][0]:'mixed',lines}
}
