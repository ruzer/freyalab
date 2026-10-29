import type {Encoding} from './types'
export interface CsvTextFormat {encoding:Encoding;bom:boolean}
export function csvTextStatistics(text:string):{eol:'LF'|'CRLF'|'CR'|'mixed'|'none';lines:number}{
 const endings=new Set<'LF'|'CRLF'|'CR'>();let lines=1
 for(const match of text.matchAll(/\r\n|\r|\n/g)){endings.add(match[0]==='\n'?'LF':match[0]==='\r\n'?'CRLF':'CR');lines++}
 return{eol:endings.size===0?'none':endings.size===1?[...endings][0]:'mixed',lines}
}
