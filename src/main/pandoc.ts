import {execFile} from 'node:child_process'
import {constants} from 'node:fs'
import {access,mkdtemp,realpath,rm,stat,mkdir,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {isAbsolute,join,posix,win32} from 'node:path'
import {createHash} from 'node:crypto'
import {z} from 'zod'
import {citationStyleIds,type CitationStyleId} from '../shared/bibliography'
import type {AuthorizedBibliographySnapshot} from './bibliography'
import type {PandocStatus} from '../shared/pandoc'
export type {PandocStatus} from '../shared/pandoc'
import {t} from '../shared/i18n'
import {cleanExportMarkup} from './export-markup'

// shortcut: 3.10.2 es la menor versión probada; ampliar compatibilidad exige repetir P4.
export const minimumPandocVersion='3.10.2'
export interface PandocCitationOptions {style:CitationStyleId;bibliography:AuthorizedBibliographySnapshot;metadata?:Pick<PandocReportMetadata,'lang'>}
export interface PandocReportMetadata {title?:string;subtitle?:string;author?:readonly string[];date?:string;lang?:string;institution?:string;abstract?:string;tocTitle?:string}
export interface PandocReportOptions {style?:CitationStyleId;bibliography?:AuthorizedBibliographySnapshot;metadata?:PandocReportMetadata;toc?:boolean;lof?:boolean;lot?:boolean;cover?:boolean}
const snapshot=z.strictObject({format:z.enum(['csl-json','bibtex']),content:z.instanceof(Buffer),sha256:z.string().regex(/^[a-f0-9]{64}$/)})
const language=z.string().refine(value=>{try{return Intl.getCanonicalLocales(value).length===1}catch{return false}})
const metadata=z.strictObject({title:z.string().optional(),subtitle:z.string().optional(),author:z.array(z.string()).optional(),date:z.string().optional(),lang:language.optional(),institution:z.string().optional(),abstract:z.string().optional(),tocTitle:z.string().optional()})
const reportOptions=z.strictObject({style:z.enum(citationStyleIds).optional(),bibliography:snapshot.optional(),metadata:metadata.optional(),toc:z.boolean().optional(),lof:z.boolean().optional(),lot:z.boolean().optional(),cover:z.boolean().optional()})
const citationOptions=z.strictObject({style:z.enum(citationStyleIds),bibliography:snapshot,metadata:metadata.pick({lang:true}).optional()})
const reader='markdown-raw_attribute-raw_html-raw_tex-yaml_metadata_block'
function exceedsCharacters(value:string,limit:number){let count=0;for(const character of value){if(++count>limit)return true}return false}
export function validateReportMetadata(fields:PandocReportMetadata){
  const combinedMessages=[
   ['title','report.metadataLimit.title'],['subtitle','report.metadataLimit.subtitle'],['author','report.metadataLimit.author'],
   ['date','report.metadataLimit.date'],['lang','report.metadataLimit.lang'],['institution','report.metadataLimit.institution'],
   ['abstract','report.metadataLimit.abstract'],['tocTitle','report.metadataLimit.tocTitle'],
  ] as const
  let total=0,crossing:(typeof combinedMessages)[number][1]|undefined
  for(const [field,key]of combinedMessages){
   const value=fields[field];if(value===undefined)continue
   for(const scalar of Array.isArray(value)?value:[value])total+=scalar.length
   if(total>8000&&crossing===undefined)crossing=key
  }
  for(const [field,key] of [['title','report.titleLimit'],['subtitle','report.subtitleLimit'],['institution','report.institutionLimit']] as const)if(fields[field]!==undefined&&exceedsCharacters(fields[field],1000))throw new Error(t(key,{limit:1000}))
  if(fields.author&&fields.author.length>100)throw new Error(t('report.authorsLimit',{limit:100}))
  if(fields.author?.some(author=>exceedsCharacters(author,200)))throw new Error(t('report.authorLimit',{limit:200}))
  if(crossing!==undefined)throw new Error(t(crossing,{limit:8000,excess:total-8000}))
}

export function pandocPaths(platform:NodeJS.Platform,environment:NodeJS.ProcessEnv):string[] {
 const windows=platform==='win32',path=windows?win32:posix,executable=windows?'pandoc.exe':'pandoc'
 const pathValue=Object.entries(environment).find(([key])=>windows?key.toLowerCase()==='path':key==='PATH')?.[1]??''
 const folders=pathValue.split(windows?';':':').map(folder=>windows?folder.replace(/^"(.*)"$/,'$1'):folder).filter(folder=>folder&&path.isAbsolute(folder))
 if(windows){
  for(const folder of [environment.LOCALAPPDATA,environment.ProgramFiles,environment['ProgramFiles(x86)']])if(folder)folders.push(path.join(folder,'Pandoc'))
  if(environment.ProgramData)folders.push(path.join(environment.ProgramData,'chocolatey','bin'))
  if(environment.USERPROFILE)folders.push(path.join(environment.USERPROFILE,'scoop','apps','pandoc','current'))
 }else{
  folders.push(...(platform==='darwin'?['/opt/homebrew/bin','/usr/local/bin','/opt/local/bin','/usr/bin']:['/usr/local/bin','/usr/bin']))
  if(environment.HOME)folders.push(path.join(environment.HOME,'.local','bin'))
 }
 return[...new Set(folders.filter(folder=>path.isAbsolute(folder)).map(folder=>path.join(folder,executable)))]
}

function runPandoc(path:string,args:string[],source?:string,cwd?:string,onMathWarnings?:(count:number)=>void):Promise<Buffer> {
 return new Promise((resolve,reject)=>{
  const child=execFile(path,args,{shell:false,timeout:10_000,maxBuffer:64*1024*1024,windowsHide:true,encoding:'buffer',cwd},(error,stdout,stderr)=>{
   if(error)reject(new Error(t('pandoc.conversionFailed')))
   else{onMathWarnings?.((stderr?.toString('utf8').match(/^\[WARNING\] Could not convert TeX math\b/gm)??[]).length);resolve(stdout)}
  })
  child.stdin?.on('error',()=>{}) // EPIPE también llega al callback cuando falla el proceso.
  child.stdin?.end(source)
 })
}

function unavailable(reason:string):PandocStatus {
 const system=process.platform==='win32'?'Windows':process.platform==='darwin'?'macOS':'Linux'
 return{available:false,reason,installation:t('pandoc.installation',{system,url:'https://pandoc.org/installing.html'})}
}

export async function detectPandoc(chosenPath?:string):Promise<PandocStatus> {
 let reason=t('pandoc.missing')
 for(const candidate of chosenPath===undefined?pandocPaths(process.platform,process.env):[chosenPath]){
  if(!isAbsolute(candidate)||candidate.includes('\0')||(process.platform==='win32'&&!/\.exe$/i.test(candidate)))continue
  try{
   const path=await realpath(candidate)
   if(!(await stat(path)).isFile())continue
   await access(path,process.platform==='win32'?constants.F_OK:constants.X_OK)
   const output=(await runPandoc(path,['--version'])).toString('utf8')
   const version=/^pandoc (\d+(?:\.\d+){1,3})\r?\n/.exec(output)?.[1]
   if(!version){reason=t('pandoc.versionUnknown');continue}
   const actual=version.split('.').map(Number),minimum=minimumPandocVersion.split('.').map(Number)
   let comparison=0
   for(let index=0;index<Math.max(actual.length,minimum.length);index++)if((actual[index]??0)!==(minimum[index]??0)){comparison=(actual[index]??0)-(minimum[index]??0);break}
   if(comparison<0){reason=t('pandoc.minimum',{minimum:minimumPandocVersion,version});continue}
   return{available:true,path,version,license:'GPL-2.0-or-later'}
  }catch{ /* Un candidato ausente o no ejecutable no impide probar los demás. */ }
 }
 return unavailable(reason)
}

export function stripPandocMetadata(source:string):string {
 const opening=/^\ufeff?---[ \t]*\r?\n/.exec(source)
 if(!opening)return source
 const end=/^(?:---|\.\.\.)[ \t]*\r?$(?:\n|$)/m.exec(source.slice(opening[0].length))
 const lines=source.slice(opening[0].length,end?opening[0].length+end.index:source.length).split(/\r?\n/)
 if(!lines.some(line=>/^(?:[\p{L}\p{N}_-]+|"[^"\r\n]+"|'[^'\r\n]+')[ \t]*:/u.test(line)))return source
 if(lines.some(line=>!/^(?:\s*$|\s*#|[ \t]+|-[ \t]|(?:[\p{L}\p{N}_-]+|"[^"\r\n]+"|'[^'\r\n]+')[ \t]*:)/u.test(line)))return source
 if(!end)throw new Error(t('pandoc.metadataUnclosed'))
 return source.slice(opening[0].length+end.index+end[0].length)
}

async function convertReport(executablePath:string,source:string,format:'docx'|'html5',options:unknown,onMathWarnings?:(count:number)=>void):Promise<Buffer>{
 const checked=(format==='docx'?reportOptions:citationOptions).safeParse(options??{})
 if(!checked.success)throw new Error(t('pandoc.invalidOptions'))
 const selected=checked.data as PandocReportOptions,bibliography=selected.bibliography
 if(format==='docx'&&selected.metadata)validateReportMetadata(selected.metadata)
 if(bibliography&&createHash('sha256').update(bibliography.content).digest('hex')!==bibliography.sha256)throw new Error(t('pandoc.invalidBibliography'))
 const body=(selected.cover?'::: {custom-style="FreyaPageBreak"}\n\n\u200b\n\n:::\n\n':'')+stripPandocMetadata(source),pandoc=await detectPandoc(executablePath)
 if(!pandoc.available)throw new Error(pandoc.reason)
 const directory=await mkdtemp(join(tmpdir(),'freyalab-pandoc-'))
 try{
  let data=directory
  if(bibliography||selected.cover){data=join(directory,'data');await mkdir(data)}
  const args=['--sandbox','--data-dir',data,'-f',reader,'-t',format,'-o','-']
  if(selected.cover){
   const {reportReferenceBytes}=await import('./report-reference'),referencePath=join(directory,'reference.docx')
   await writeFile(referencePath,await reportReferenceBytes(selected.metadata?.institution))
   args.push('--reference-doc',referencePath)
  }
  if(bibliography){
   const bibliographyPath=join(directory,bibliography.format==='bibtex'?'bibliography.bib':'bibliography.json'),stylePath=join(directory,'style.csl')
   const {citationStyleBytes}=await import('./citation-styles')
   await writeFile(bibliographyPath,bibliography.content);await writeFile(stylePath,await citationStyleBytes(selected.style??'apa'))
   // Pandoc conserva csl en las propiedades DOCX; el nombre local evita filtrar el directorio temporal.
   args.push('--citeproc','--bibliography',bibliographyPath,'--csl','style.csl')
  }
  for(const flag of ['toc','lof','lot'] as const)if(selected[flag])args.push('--'+flag)
  for(const [key,value] of Object.entries(selected.metadata??{}))if(value!==undefined){
   // --metadata recibe MetaString literal; repetir author crea la lista de autores.
   for(const scalar of Array.isArray(value)?value:[value]){
    const literal=format==='docx'&&key!=='abstract'&&key!=='institution'?scalar.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff\ud800-\udfff]/gu,' '):scalar
    args.push('--metadata',(key==='tocTitle'?'toc-title':key)+'='+literal)
   }
  }
  return await runPandoc(pandoc.path,args,body,directory,format==='docx'?onMathWarnings:undefined)
 }finally{await rm(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100})}
}
export function pandocToDocx(executablePath:string,source:string,options?:PandocReportOptions,onMathWarnings?:(count:number)=>void):Promise<Buffer>{return convertReport(executablePath,source,'docx',options,onMathWarnings)}
export async function pandocCitationsToHtml(executablePath:string,source:string,options:PandocCitationOptions):Promise<string>{return cleanExportMarkup((await convertReport(executablePath,source,'html5',options)).toString('utf8'))}
export async function bibtexToCslJson(chosenPath:string|undefined,source:string):Promise<{available:false}|{available:true;json:string}>{
 const pandoc=await detectPandoc(chosenPath)
 if(!pandoc.available)return{available:false}
 const directory=await mkdtemp(join(tmpdir(),'freyalab-pandoc-bib-'))
 try{
  const result=await runPandoc(pandoc.path,['--sandbox','--data-dir',directory,'-f','bibtex','-t','csljson','-o','-'],source,directory)
  return{available:true,json:new TextDecoder('utf-8',{fatal:true}).decode(result)}
 }finally{await rm(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100})}
}

export async function testPandoc(executablePath:string):Promise<{ok:true;bytes:number}> {
 const output=await pandocToDocx(executablePath,'# FreyaLab\n\nPrueba de Pandoc: **documento local** con acentos y ñ.')
 if(!output.subarray(0,4).equals(Buffer.from('PK\x03\x04')))throw new Error(t('pandoc.invalidDocx'))
 return{ok:true,bytes:output.length}
}
