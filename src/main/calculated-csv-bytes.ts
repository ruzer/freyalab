import {stringify} from 'csv-stringify/sync'
import iconv from 'iconv-lite'
import type {Encoding} from '../shared/types'
import {CalculationError} from '../shared/calculated-column'
import {decodeRecord,splitFields} from './large-table'

const recordLimit=1024*1024
const tooLarge=()=>new CalculationError('recordLimit','Un registro resultante supera 1 MiB. No se ha modificado el documento.')

export function calculatedRecordBytes(
 original:Buffer|undefined,
 {encoding,delimiter,eol}:{encoding:Encoding;delimiter:string;eol:string},
 cells:readonly string[],
 origins:readonly (number|null)[],
 endOfRecord:boolean,
 previousCR=false
):Buffer {
 const unit=encoding==='utf16le'?2:1
 const bytes=(value:string)=>encoding==='utf8'?Buffer.byteLength(value,'utf8'):value.length*unit
 const encode=(value:string)=>iconv.encode(value,encoding)
 const fields:Buffer[]=[]
 let values:string[]=[],terminator:Buffer|undefined
 if(original){
  if(original.length>recordLimit)throw tooLarge()
  const text=decodeRecord(original,encoding)
  const ending=text.match(/(?:\r\n|\n|\r)$/)?.[0]??''
  const content=text.slice(0,text.length-ending.length),end=original.length-ending.length*unit
  let offset=0
  values=splitFields(content,delimiter,undefined,(start,stop)=>{
   const next=offset+bytes(content.slice(start,stop))
   fields.push(original.subarray(offset,next))
   offset=next+unit
  })
  if(offset-unit!==end)throw new CalculationError('encoding','El registro original no coincide con su codificación.')
  if(ending)terminator=original.subarray(end)
 }
 const ending=endOfRecord?(terminator??encode(eol)):undefined
 // An empty final record needs quotes to survive EOF. A blank LF after a CR would become a CRLF separator.
 const quoteEmpty=cells.length===1&&cells[0]===''&&(!ending||previousCR&&ending[0]===10)
 const separator=encode(delimiter),parts:Buffer[]=[]
 let length=0
 const append=(part:Buffer)=>{
  length+=part.length
  if(length>recordLimit)throw tooLarge()
  parts.push(part)
 }
 for(const [index,cell] of cells.entries()){
  if(index)append(separator)
  const origin=origins[index]
  if(!quoteEmpty&&origin!==null&&fields[origin]&&values[origin]===cell){
   append(fields[origin])
   continue
  }
  if(bytes(cell)>recordLimit-length)throw tooLarge()
  // Una U+FEFF inicial es un valor, aunque ocupe el primer campo de un archivo sin BOM.
  const text=quoteEmpty?'""':stringify([[cell]],{delimiter,eof:false,quoted_match:/[\r\n\uFEFF]/})
  const encoded=encode(text)
  if(decodeRecord(encoded,encoding)!==text)throw new CalculationError('encoding','La codificación seleccionada no representa todos los caracteres. Guarda una copia en UTF-8.')
  append(encoded)
 }
 if(ending)append(ending)
 return Buffer.concat(parts,length)
}
