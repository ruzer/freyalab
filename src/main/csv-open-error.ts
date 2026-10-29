import {basename} from 'node:path'
import {CSV_TEXT_LIMIT,type CsvOpenError} from '../shared/types'
export function csvOpenError(path:string,byteLength:number,error:unknown):CsvOpenError|undefined{
 const message=error instanceof Error?error.message:String(error)
 // shortcut: prefijo del motor anterior; sustituir por un código estable al migrar I18N-03.
 if(!message.startsWith('CSV no válido:'))return
 const structure=message.replace(/"(?:[^"\\]|\\.)*"/g,'""'),locations=[...structure.matchAll(/\b(?:at|on)\s+line\s+(\d+)\b/gi)],line=locations.length===1?Number(locations[0][1]):undefined
 return{path,name:basename(path),message,byteLength,textAllowed:byteLength<=CSV_TEXT_LIMIT,...(line&&Number.isSafeInteger(line)?{reportedLine:line}:{})}
}
