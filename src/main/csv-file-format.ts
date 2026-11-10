import {constants} from 'node:fs'
import {open as openFile} from 'node:fs/promises'
import {parse as parseSync} from 'csv-parse/sync'
import iconv from 'iconv-lite'
import type {Encoding,TableOptions} from '../shared/types'
import {t} from '../shared/i18n'
import {RECORD_DELIMITERS} from './large-table'

export interface Metadata { encoding: Encoding; delimiter: string; eol: string; bom: boolean; header: boolean; finalEol: boolean; headerWidth: number }
export function validDelimiter(value: string) { if (![',', ';', '\t', '|'].includes(value)) throw new Error(t('project.source.invalidDelimiter')); return value }
function detectEncoding(bytes: Buffer): Encoding {
 if(bytes[0]===0xff&&bytes[1]===0xfe)return 'utf16le'
 try { new TextDecoder('utf-8',{fatal:true}).decode(bytes,{stream:true}); return 'utf8' } catch { return 'win1252' }
}
export function metadata(bytes: Buffer, options: TableOptions, path = ''): Metadata {
 const encoding = options.encoding ?? detectEncoding(bytes)
 const text = iconv.decode(bytes, encoding)
 const counts = [',', ';', '\t', '|'].map(delimiter => {
  try { const first = parseSync(text, {delimiter, bom:true, to:1, relax_column_count:true,record_delimiter:RECORD_DELIMITERS}) as string[][]; return {delimiter,count:(first[0]?.length??1)-1} }
  catch { return {delimiter,count:0} }
 })
 counts.sort((a,b) => b.count-a.count)
 const delimiter = validDelimiter(options.delimiter ?? (path.endsWith('.tsv') ? '\t' : (counts[0].count ? counts[0].delimiter : ',')))
 let eol='\n',inQuotes=false
 for(let i=0;i<text.length;i++){if(text[i]==='"')inQuotes=!inQuotes;else if(!inQuotes&&(text[i]==='\r'||text[i]==='\n')){eol=text.startsWith('\r\n',i)?'\r\n':text[i];break}}
 const bom = encoding === 'utf8' ? bytes.subarray(0, 3).equals(Buffer.from([0xef,0xbb,0xbf])) : encoding === 'utf16le' && bytes[0] === 0xff && bytes[1] === 0xfe
 return { encoding, delimiter, eol, bom, header: options.header ?? true, finalEol:/[\r\n]$/.test(text), headerWidth:0 }
}
export async function prefix(path: string, max: number, lexical=false): Promise<Buffer> {
 const flags=lexical&&process.platform!=='win32'?constants.O_RDONLY|(constants.O_NONBLOCK??0)|(constants.O_NOFOLLOW??0):'r'
 const handle = await openFile(path,flags)
 try { const file=await handle.stat();if(lexical&&!file.isFile())throw new Error(t('project.source.notFile'));const result = Buffer.alloc(Math.min(file.size, max)); let offset = 0; while (offset < result.length) { const read = await handle.read(result, offset, result.length-offset, offset); if (!read.bytesRead) break; offset += read.bytesRead } return result.subarray(0, offset) } finally { await handle.close() }
}
export async function endsWithEol(path:string,bytes:number,encoding:Encoding){const handle=await openFile(path,'r');try{const tail=Buffer.alloc(Math.min(bytes,4));await handle.read(tail,0,tail.length,Math.max(0,bytes-tail.length));return /[\r\n]$/.test(iconv.decode(tail,encoding))}finally{await handle.close()}}
