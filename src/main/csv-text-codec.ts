import iconv from 'iconv-lite'
import type {Encoding,TextEncoding} from '../shared/types'
import {t} from '../shared/i18n'
import {csvTextStatistics,type CsvTextFormat,type TextFormat} from '../shared/csv-text'
export {csvTextStatistics,type CsvTextFormat} from '../shared/csv-text'

const signatures={utf8:Buffer.from([0xef,0xbb,0xbf]),utf16le:Buffer.from([0xff,0xfe]),utf16be:Buffer.from([0xfe,0xff])}
type BomEncoding=keyof typeof signatures
const loneSurrogate=/[\uD800-\uDFFF]/u
const signatureFor=(encoding:TextEncoding)=>encoding==='win1252'||encoding==='latin1'?undefined:signatures[encoding]
const startsWith=(bytes:Buffer,signature:Buffer)=>bytes.subarray(0,signature.length).equals(signature)

function withBom(body:Buffer,format:TextFormat){
 if(!format.bom)return body
 const signature=signatureFor(format.encoding)
 if(!signature)throw new Error(t('csvText.codec.invalidBom'))
 return Buffer.concat([signature,body])
}

function utf8OrWestern(bytes:Buffer,stream:boolean):'utf8'|'win1252'{
 try{new TextDecoder('utf-8',{fatal:true}).decode(bytes,{stream});return 'utf8'}catch{return 'win1252'}
}
function decode<T extends TextEncoding>(bytes:Buffer,encoding:T){
 const signature=signatureFor(encoding),bom=!!signature&&startsWith(bytes,signature),format={encoding,bom}
 const text=iconv.decode(bytes.subarray(bom?signature!.length:0),encoding,{stripBOM:false})
 // iconv codifica U+FFFD como 0x9D: ese roundtrip aparente también es una sustitución.
 const readonly=encoding==='win1252'&&text.includes('\uFFFD')||!withBom(iconv.encode(text,encoding,{addBOM:false}),format).equals(bytes)
 return{text,format,readonly}
}
export function decodeCsvText(bytes:Buffer):{text:string;format:CsvTextFormat;readonly:boolean;warning?:string}{
 // Igual que TableEngine: el prefijo termina con margen de cuatro bytes y se valida como flujo.
 const encoding:Encoding=startsWith(bytes,signatures.utf16le)?'utf16le':utf8OrWestern(bytes.subarray(0,1024*1024+4),true)
 const decoded=decode(bytes,encoding)
 return{...decoded,...(decoded.readonly?{warning:t('csvText.codec.lossyWarning')}:{})}
}

export function decodeTextDocument(bytes:Buffer,requested?:TextEncoding,sample=false){
 const bom=(Object.keys(signatures) as BomEncoding[]).find(encoding=>startsWith(bytes,signatures[encoding]))
 if(bom&&requested&&requested!==bom)throw new Error(t('textEncoding.error.bomMismatch'))
 const hasNul=!sample&&!requested&&!bom&&bytes.includes(0)
 // En texto UTF-16, el byte alto de los caracteres ASCII suele ser cero.
 let nulBalance=0
 if(hasNul&&bytes.length%2===0){
  for(let i=0;i<bytes.length;i++)if(bytes[i]===0)nulBalance+=i%2?1:-1
 }
 const suggestion=nulBalance>0?'utf16le':nulBalance<0?'utf16be':undefined
 const encoding=requested??bom??suggestion??utf8OrWestern(bytes,sample),decoded=decode(bytes,encoding)
 const pending=!sample&&!requested&&(hasNul||encoding==='win1252')
 const warning=hasNul
  ? suggestion?t('textEncoding.warning.nulSuggested',{encoding:suggestion==='utf16le'?'UTF-16 LE':'UTF-16 BE'}):t('textEncoding.warning.nulAmbiguous')
  : pending?t('textEncoding.warning.pending'):undefined
 // Un sustituto UTF-16 aislado puede reproducir los bytes sin representar texto válido.
 const lossy=decoded.readonly||loneSurrogate.test(decoded.text)
 if(requested&&lossy)throw new Error(t('textEncoding.error.decode'))
 return{...decoded,readonly:sample||pending||lossy,pending,warning}
}

export function encodedTextFormat(original:TextFormat,encoding:TextEncoding):TextFormat{
 if(original.bom&&!signatureFor(encoding))throw new Error(t('textEncoding.error.bomSave'))
 // La detección automática requiere BOM cuando se convierte a UTF-16.
 return{encoding,bom:original.bom||encoding!==original.encoding&&(encoding==='utf16le'||encoding==='utf16be')}
}

// Cuenta en el formato original; representar cada carácter se valida al guardar.
export function csvTextByteLength(text:string,format:TextFormat){return withBom(iconv.encode(text,format.encoding,{addBOM:false}),format).length}

export function encodeCsvText(text:string,format:TextFormat,strictUnicode=false):Buffer{
 const body=iconv.encode(text,format.encoding,{addBOM:false}),decoded=iconv.decode(body,format.encoding,{stripBOM:false})
 const substituted=format.encoding==='win1252'?text.indexOf('\uFFFD'):strictUnicode?text.search(loneSurrogate):-1
 if(decoded!==text||substituted>=0){
  let first=0;while(first<text.length&&text[first]===decoded[first])first++
  if(substituted>=0)first=Math.min(first,substituted)
  const line=csvTextStatistics(text.slice(0,first)).lines
  throw new Error(t('csvText.codec.unrepresentable',{encoding:format.encoding,line}))
 }
 return withBom(body,format)
}

