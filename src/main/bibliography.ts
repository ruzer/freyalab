import {constants,type BigIntStats} from 'node:fs'
import {open,realpath,stat,type FileHandle} from 'node:fs/promises'
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path'
import {createHash} from 'node:crypto'
import {z} from 'zod'
import {bibliographyTypes,type BibliographyEntry,type BibliographyError,type BibliographyErrorCode,type BibliographyDate} from '../shared/bibliography'
import {t,formatNumber} from '../shared/i18n'

// Bibliotecas profesionales: lectura acotada a 10 MiB, incluida una posible BOM.
export const MAX_BIBLIOGRAPHY_BYTES=10*1024*1024
export interface BibliographyRequest {documentPath:string;bibliographyPath:string;pandocPath?:string;documentRoot?:string}
// Sólo main: Documents publica entradas/bytes/sha256, nunca este contenido o ruta.
export interface AuthorizedBibliographySnapshot {readonly format:'csl-json'|'bibtex';readonly content:Buffer;readonly sha256:string}
export type BibliographyResult={ok:true;path:string;bytes:number;sha256:string;entries:BibliographyEntry[];snapshot:AuthorizedBibliographySnapshot}|{ok:false;error:BibliographyError}

const number=z.number().finite(),flag=z.union([z.string(),number,z.boolean()])
const name=z.strictObject({family:z.string().optional(),given:z.string().optional(),literal:z.string().optional(),suffix:z.string().optional(),'dropping-particle':z.string().optional(),'non-dropping-particle':z.string().optional(),'comma-suffix':flag.optional(),'static-ordering':flag.optional(),'parse-names':flag.optional()}).refine(value=>!!(value.literal?.trim()||value.family?.trim()||value.given?.trim()))
function dateNumber(value:string|number){return typeof value==='number'?value:/^[+-]?\d+$/.test(value)?Number(value):NaN}
function validDate(value:BibliographyDate){
 const dates=value['date-parts']
 if(!dates)return !!(value.literal?.trim()||value.raw?.trim())
 const numbers=dates.map(date=>date.map(dateNumber))
 for(const [year,month,day] of numbers){
  if(!Number.isSafeInteger(year)||month!==undefined&&(!Number.isInteger(month)||month<1||month>12))return false
  const days=[31,year%400===0||year%4===0&&year%100!==0?29:28,31,30,31,30,31,31,30,31,30,31]
  if(day!==undefined&&(!Number.isInteger(day)||day<1||day>days[month-1]))return false
 }
 if(numbers.length===2)for(let i=0;i<Math.min(numbers[0].length,numbers[1].length);i++){
  if(numbers[0][i]<numbers[1][i])break
  if(numbers[0][i]>numbers[1][i])return false
 }
 return true
}
const date=z.strictObject({'date-parts':z.array(z.array(z.union([z.string(),number])).min(1).max(3)).min(1).max(2).optional(),literal:z.string().optional(),raw:z.string().optional(),season:z.union([z.string(),number]).optional(),circa:flag.optional()}).refine(validDate)
const custom=z.record(z.string(),z.unknown()).refine(value=>{
 const pending:unknown[]=[value]
 while(pending.length){const item=pending.pop();if(typeof item==='number'&&!Number.isFinite(item))return false;if(item&&typeof item==='object')for(const child of Object.values(item))pending.push(child)}
 return true
})
const fields:Record<string,z.ZodType>={}
// Campos del modelo de entrada CSL JSON, incluidos los nombres heredados de Zotero.
for(const field of 'citation-key language journalAbbreviation shortTitle abstract annote archive archive_collection archive_location archive-place authority call-number citation-label collection-title container-title container-title-short dimensions division DOI event event-title event-place genre ISBN ISSN jurisdiction keyword medium note original-publisher original-publisher-place original-title part-title PMCID PMID publisher publisher-place references reviewed-genre reviewed-title scale section source status title title-short URL version volume-title volume-title-short year-suffix'.split(' '))fields[field]=z.string().optional()
for(const field of 'chapter-number citation-number collection-number edition first-reference-note-number issue locator number number-of-pages number-of-volumes page page-first part printing supplement volume'.split(' '))fields[field]=z.union([z.string(),number]).optional()
for(const field of 'author chair collection-editor compiler composer container-author contributor curator director editor editorial-director executive-producer guest host interviewer illustrator narrator organizer original-author performer producer recipient reviewed-author script-writer series-creator translator'.split(' '))fields[field]=z.array(name).optional()
for(const field of 'accessed available-date event-date issued original-date submitted'.split(' '))fields[field]=date.optional()
const entry=z.strictObject({...fields,id:z.union([z.string().refine(value=>!!value.trim()&&!/[\u0000-\u001f\u007f]/.test(value)),number.refine(Number.isSafeInteger)]),type:z.enum(bibliographyTypes),categories:z.array(z.string()).optional(),custom:custom.optional()})

const messages={
 'invalid-path':'bibliography.error.invalidPath',outside:'bibliography.error.outside',unavailable:'bibliography.error.unavailable','not-file':'bibliography.error.notFile','too-large':'bibliography.error.tooLarge',changed:'bibliography.error.changed',encoding:'bibliography.error.encoding',syntax:'bibliography.error.syntax',schema:'bibliography.error.root','duplicate-id':'bibliography.error.duplicate','pandoc-required':'bibliography.error.pandocRequired'
} satisfies Record<BibliographyErrorCode,string>
function failure(code:BibliographyErrorCode,parameters:Record<string,string|number>={},details:Partial<Pick<BibliographyError,'location'|'entry'|'field'>>={}):BibliographyResult {
 return{ok:false,error:{code,message:t(messages[code],parameters),...details}}
}
function inside(root:string,path:string){const part=relative(root,path);return part!=='..'&&!part.startsWith('..'+sep)&&!isAbsolute(part)}
function sameFile(a:BigIntStats,b:BigIntStats){return a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs}
async function confirmFile(root:string,path:string,before:BigIntStats,handle:FileHandle):Promise<'outside'|'changed'|undefined>{
 const current=await realpath(path)
 if(!inside(root,current))return'outside'
 // O_NOFOLLOW sólo protege la hoja: volver a resolver también comprueba sus carpetas.
 if(!sameFile(before,await stat(current,{bigint:true}))||!sameFile(before,await handle.stat({bigint:true})))return'changed'
}
function parserPosition(message:string){const at=/ at position (\d+)(?: \(line \d+ column \d+\))?$/.exec(message);return at?Number(at[1]):undefined}
async function jsonLocation(text:string,error:unknown){
 const message=error instanceof Error?error.message:''
 const at=parserPosition(message),line=/\(line (\d+) column (\d+)\)$/.exec(message)
 if(at===undefined&&line)return{line:Number(line[1]),column:Number(line[2])}
 let position=at
 if(position===undefined){
  const token=/^Unexpected token '([\s\S]+?)',/.exec(message)?.[1]
  if(token){
   // V8 omite el offset en algunos errores. El propio JSON.parse distingue
   // prefijos incompletos de los que ya contienen ese primer token inválido.
   let from=text.indexOf(token),to=text.lastIndexOf(token)
   while(from>=0&&from<to){
    const middle=text.lastIndexOf(token,Math.floor((from+to)/2)),prefix=text.slice(0,middle+token.length)
    let invalid=false
    try{JSON.parse(prefix)}catch(error){const detail=error instanceof Error?error.message:'',offset=parserPosition(detail);invalid=offset!==undefined?offset<prefix.length:!/^Unexpected end of JSON input$|^Unterminated string in JSON/.test(detail)}
    if(invalid)to=middle;else from=text.indexOf(token,middle+token.length)
    await new Promise<void>(resolve=>setImmediate(resolve))
   }
   position=from>=0?from:0
  }else position=/^Unexpected end of JSON input$|^Unterminated string in JSON/.test(message)?text.length:Math.max(0,text.search(/\S/))
 }
 position=Math.min(text.length,position)
 const before=text.slice(0,position).split(/\r\n|\n|\r/)
 return{line:before.length,column:before.at(-1)!.length+1}
}

export async function loadBibliography(request:BibliographyRequest):Promise<BibliographyResult>{
 let handle:FileHandle|undefined
 try{
  if(!request||typeof request.documentPath!=='string'||typeof request.bibliographyPath!=='string'||!isAbsolute(request.documentPath)||!request.bibliographyPath.trim()||request.documentPath.includes('\0')||request.bibliographyPath.includes('\0')||!isAbsolute(request.bibliographyPath)&&/^[a-z][a-z0-9+.-]*:/i.test(request.bibliographyPath))return failure('invalid-path')
  const document=await realpath(request.documentPath)
  if(!(await stat(document)).isFile())return failure('invalid-path')
  // La autoridad de un documento abierto no sigue enlaces añadidos después.
  const root=request.documentRoot??dirname(document),candidate=resolve(root,request.bibliographyPath)
  if(!inside(root,document))return failure('outside')
  if(!isAbsolute(request.bibliographyPath)&&!inside(root,candidate))return failure('outside')
  const path=await realpath(candidate)
  if(!inside(root,path))return failure('outside')
  const before=await stat(path,{bigint:true})
  if(!before.isFile())return failure('not-file')
  if(before.size>BigInt(MAX_BIBLIOGRAPHY_BYTES))return failure('too-large',{limit:formatNumber(10)})
  handle=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0))
  if(!sameFile(before,await handle.stat({bigint:true})))return failure('changed')
  const openedFailure=await confirmFile(root,path,before,handle)
  if(openedFailure)return failure(openedFailure)
  const parts:Buffer[]=[];let bytes=0
  while(bytes<=MAX_BIBLIOGRAPHY_BYTES){
   const buffer=Buffer.alloc(Math.min(64*1024,MAX_BIBLIOGRAPHY_BYTES+1-bytes)),read=await handle.read(buffer,0,buffer.length,null)
   if(!read.bytesRead)break
   parts.push(buffer.subarray(0,read.bytesRead));bytes+=read.bytesRead
  }
  if(bytes>MAX_BIBLIOGRAPHY_BYTES)return failure('too-large',{limit:formatNumber(10)})
  if(!sameFile(before,await handle.stat({bigint:true})))return failure('changed')
  const raw=Buffer.concat(parts,bytes);let text:string
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(raw)}catch{return failure('encoding')}
  const format=/\.bib$/i.test(request.bibliographyPath)?'bibtex':'csl-json'
  if(format==='bibtex'){
   try{
    const {bibtexToCslJson}=await import('./pandoc'),converted=await bibtexToCslJson(request.pandocPath,text)
    if(!converted.available)return failure('pandoc-required',{url:'https://pandoc.org/installing.html'})
    text=converted.json
   }catch{return{ok:false,error:{code:'syntax',message:t('pandoc.invalidBibtex')}}}
  }
  let parsed:unknown
  try{parsed=JSON.parse(text)}catch(error){const location=await jsonLocation(text,error);return failure('syntax',{line:formatNumber(location.line),column:formatNumber(location.column)},{location})}
  if(!Array.isArray(parsed))return failure('schema')
  const entries:BibliographyEntry[]=[],ids=new Set<string>()
  for(let index=0;index<parsed.length;index++){
   const checked=entry.safeParse(parsed[index])
   if(!checked.success){
    const issue=checked.error.issues[0],path=issue.code==='unrecognized_keys'?[...issue.path,issue.keys[0]]:issue.path,field=path.map(String).join('.')
    return{ok:false,error:{code:'schema',entry:index+1,...(field?{field}:{}),message:field?t('bibliography.error.entry',{entry:formatNumber(index+1),field}):t('bibliography.error.record',{entry:formatNumber(index+1)})}}
   }
   const value=parsed[index] as BibliographyEntry,key=String(value.id)
   if(ids.has(key))return failure('duplicate-id',{id:key,entry:formatNumber(index+1)},{entry:index+1,field:'id'})
   ids.add(key);entries.push(value)
   if(index%256===255)await new Promise<void>(resolve=>setImmediate(resolve))
  }
  const finalFailure=await confirmFile(root,path,before,handle)
  if(finalFailure)return failure(finalFailure)
  const sha256=createHash('sha256').update(raw).digest('hex')
  return{ok:true,path,bytes,sha256,entries,snapshot:{format,content:raw,sha256}}
 }catch{return failure('unavailable')}
 finally{await handle?.close().catch(()=>{})}
}
