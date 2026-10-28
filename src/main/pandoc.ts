import {execFile} from 'node:child_process'
import {constants} from 'node:fs'
import {access,mkdtemp,realpath,rm,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {isAbsolute,join,posix,win32} from 'node:path'

// shortcut: 3.10.2 es la menor versión probada; ampliar compatibilidad exige repetir P4.
export const minimumPandocVersion='3.10.2'
export type PandocStatus={available:true;path:string;version:string;license:'GPL-2.0-or-later'}|{available:false;reason:string;installation:string}

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

function runPandoc(path:string,args:string[],source?:string,cwd?:string):Promise<Buffer> {
 return new Promise((resolve,reject)=>{
  const child=execFile(path,args,{shell:false,timeout:10_000,maxBuffer:64*1024*1024,windowsHide:true,encoding:'buffer',cwd},(error,stdout)=>{
   if(error)reject(new Error('Pandoc no pudo convertir el documento. Comprueba la instalación o prueba con un documento más pequeño.'))
   else resolve(stdout)
  })
  child.stdin?.on('error',()=>{}) // EPIPE también llega al callback cuando falla el proceso.
  child.stdin?.end(source)
 })
}

function unavailable(reason:string):PandocStatus {
 const system=process.platform==='win32'?'Windows':process.platform==='darwin'?'macOS':'Linux'
 return{available:false,reason,installation:`Instala Pandoc para ${system} y vuelve a probar: https://pandoc.org/installing.html`}
}

export async function detectPandoc(chosenPath?:string):Promise<PandocStatus> {
 let reason='No se encontró Pandoc. DOCX y el formateo final de citas requieren una instalación externa.'
 for(const candidate of chosenPath===undefined?pandocPaths(process.platform,process.env):[chosenPath]){
  if(!isAbsolute(candidate)||candidate.includes('\0')||(process.platform==='win32'&&!/\.exe$/i.test(candidate)))continue
  try{
   const path=await realpath(candidate)
   if(!(await stat(path)).isFile())continue
   await access(path,process.platform==='win32'?constants.F_OK:constants.X_OK)
   const output=(await runPandoc(path,['--version'])).toString('utf8')
   const version=/^pandoc (\d+(?:\.\d+){1,3})\r?\n/.exec(output)?.[1]
   if(!version){reason='No se pudo verificar la versión de Pandoc.';continue}
   const actual=version.split('.').map(Number),minimum=minimumPandocVersion.split('.').map(Number)
   let comparison=0
   for(let index=0;index<Math.max(actual.length,minimum.length);index++)if((actual[index]??0)!==(minimum[index]??0)){comparison=(actual[index]??0)-(minimum[index]??0);break}
   if(comparison<0){reason=`Pandoc requiere la versión mínima ${minimumPandocVersion}; se encontró ${version}.`;continue}
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
 if(!end)throw new Error('Los metadatos del documento no tienen cierre. Añade --- antes de exportar.')
 return source.slice(opening[0].length+end.index+end[0].length)
}

export async function pandocToDocx(executablePath:string,source:string):Promise<Buffer> {
 const body=stripPandocMetadata(source),pandoc=await detectPandoc(executablePath)
 if(!pandoc.available)throw new Error(pandoc.reason)
 const directory=await mkdtemp(join(tmpdir(),'freyalab-pandoc-'))
 try{
  // El lector también veta YAML intermedio: Pandoc lo reconoce fuera del encabezado.
  return await runPandoc(pandoc.path,['--sandbox','--data-dir',directory,'-f','markdown-raw_attribute-raw_html-raw_tex-yaml_metadata_block','-t','docx'],body,directory)
 }finally{await rm(directory,{recursive:true,force:true})}
}

export async function testPandoc(executablePath:string):Promise<{ok:true;bytes:number}> {
 const output=await pandocToDocx(executablePath,'# FreyaLab\n\nPrueba de Pandoc: **documento local** con acentos y ñ.')
 if(!output.subarray(0,4).equals(Buffer.from('PK\x03\x04')))throw new Error('Pandoc no produjo un archivo DOCX válido.')
 return{ok:true,bytes:output.length}
}
