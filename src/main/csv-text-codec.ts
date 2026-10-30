import iconv from 'iconv-lite'
import type {Encoding} from '../shared/types'
import {t} from '../shared/i18n'
import {csvTextStatistics,type CsvTextFormat} from '../shared/csv-text'
export {csvTextStatistics,type CsvTextFormat} from '../shared/csv-text'

const signatures={utf8:Buffer.from([0xef,0xbb,0xbf]),utf16le:Buffer.from([0xff,0xfe])}

function withBom(body:Buffer,format:CsvTextFormat){
 if(!format.bom)return body
 if(format.encoding==='win1252')throw new Error(t('csvText.codec.invalidBom'))
 return Buffer.concat([signatures[format.encoding],body])
}

export function decodeCsvText(bytes:Buffer):{text:string;format:CsvTextFormat;readonly:boolean;warning?:string}{
 // Igual que TableEngine: el prefijo termina con margen de cuatro bytes y se valida como flujo.
 let encoding:Encoding='utf16le'
 if(bytes[0]!==0xff||bytes[1]!==0xfe){
  try{new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,1024*1024+4),{stream:true});encoding='utf8'}catch{encoding='win1252'}
 }
 const signature=encoding==='win1252'?undefined:signatures[encoding],bom=!!signature&&bytes.subarray(0,signature.length).equals(signature),format={encoding,bom}
 const text=iconv.decode(bytes.subarray(bom?signature!.length:0),encoding,{stripBOM:false})
 // iconv codifica U+FFFD como 0x9D: ese roundtrip aparente también es una sustitución.
 const readonly=encoding==='win1252'&&text.includes('\uFFFD')||!withBom(iconv.encode(text,encoding,{addBOM:false}),format).equals(bytes)
 return{text,format,readonly,...(readonly?{warning:t('csvText.codec.lossyWarning')}:{})}
}

// Cuenta en el formato original; representar cada carácter se valida al guardar.
export function csvTextByteLength(text:string,format:CsvTextFormat){return withBom(iconv.encode(text,format.encoding,{addBOM:false}),format).length}

export function encodeCsvText(text:string,format:CsvTextFormat):Buffer{
 const body=iconv.encode(text,format.encoding,{addBOM:false}),decoded=iconv.decode(body,format.encoding,{stripBOM:false})
 const substituted=format.encoding==='win1252'?text.indexOf('\uFFFD'):-1
 if(decoded!==text||substituted>=0){
  let first=0;while(first<text.length&&text[first]===decoded[first])first++
  if(substituted>=0)first=Math.min(first,substituted)
  const line=csvTextStatistics(text.slice(0,first)).lines
  throw new Error(t('csvText.codec.unrepresentable',{encoding:format.encoding,line}))
 }
 return withBom(body,format)
}

