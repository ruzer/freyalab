import './pandoc-assets'
import {beforeEach,expect,it,vi} from 'vitest'
import {readFile,access,readdir,mkdtemp,mkdir,copyFile,writeFile,rm} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {relative,isAbsolute,join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {zipFiles} from './docx'

const invoked=vi.hoisted(()=>({execFile:vi.fn(),input:vi.fn(),conversions:[] as {args:string[];cwd:string;files:Record<string,Buffer>;dataFiles:string[]}[]}))
vi.mock('node:child_process',()=>({execFile:invoked.execFile}))
import * as pandoc from '../src/main/pandoc'
const content=Buffer.from('[{"id":"approved","type":"book","title":"Fuente aprobada"}]')
const bibliography={format:'csl-json',content,sha256:createHash('sha256').update(content).digest('hex')}
const options={style:'apa',bibliography}
type Convert=(path:string,source:string,options?:unknown)=>Promise<Buffer|string>
async function convert(format:'docx'|'html',source:string,value:unknown=options){
 const fn=Reflect.get(pandoc,format==='docx'?'pandocToDocx':'pandocCitationsToHtml') as Convert
 return fn(process.execPath,source,value)
}
beforeEach(()=>{
 vi.clearAllMocks();invoked.conversions.splice(0)
 invoked.execFile.mockImplementation((_path:string,args:string[],settings:{cwd:string},done:(error:Error|null,stdout:Buffer,stderr:Buffer)=>void)=>{
  void(async()=>{
   if(args[0]==='--version'){done(null,Buffer.from('pandoc 3.10.2\n'),Buffer.alloc(0));return}
   const files:Record<string,Buffer>={}
   for(const flag of ['--bibliography','--csl','--reference-doc'])if(args.includes(flag))files[flag]=await readFile(resolve(settings.cwd,args[args.indexOf(flag)+1]))
   invoked.conversions.push({args,cwd:settings.cwd,files,dataFiles:await readdir(args[args.indexOf('--data-dir')+1])})
   const format=args[args.indexOf('-t')+1]
   done(null,Buffer.from(format==='html5'?'<p>Cita final</p>':format==='csljson'?'[]':'PK\x03\x04docx'),Buffer.alloc(0))
  })().catch(error=>done(error,Buffer.alloc(0),Buffer.alloc(0)))
  return{stdin:{on:vi.fn().mockReturnThis(),end:invoked.input}}
 })
})

it.each(['docx','html'] as const)('%s conserva sandbox/lector fijo y usa sólo las copias temporales de bibliografía y CSL',async format=>{
 const result=await convert(format,'---\nbibliography: /externa.bib\ncsl: https://example.invalid/hostil.csl\n---\nCita [@approved].')
 const call=invoked.conversions.at(-1)!
 expect(call.args).toEqual(expect.arrayContaining(['--sandbox','--citeproc','-f','markdown-raw_attribute-raw_html-raw_tex-yaml_metadata_block','-t',format==='docx'?'docx':'html5','-o','-']))
 expect(call.files['--bibliography']).toEqual(content)
 expect(call.args[call.args.indexOf('--csl')+1]).toBe('style.csl')
 expect(createHash('sha256').update(call.files['--csl']).digest('hex')).toBe('41b4f3c9c61b58b7428ab21d653891995db7b4648d2f0a906eabcb8b2742e7ae')
 for(const flag of ['--data-dir','--bibliography','--csl']){
  const path=call.args[call.args.indexOf(flag)+1],part=relative(call.cwd,resolve(call.cwd,path))
  expect(part==='..'||part.startsWith('..')||isAbsolute(part)).toBe(false)
 }
 expect(call.args).not.toContain('--lua-filter');expect(call.args).not.toContain('--metadata-file');expect(invoked.input).toHaveBeenLastCalledWith('Cita [@approved].')
 if(format==='html')expect(result).toBe('<p>Cita final</p>')
 else expect(Buffer.isBuffer(result)).toBe(true)
 await expect(access(call.cwd)).rejects.toThrow()
})
it.each(['docx','html'] as const)('%s conserva una segunda frontera Markdown después de apartar el YAML original',async format=>{
 const {prepareReportMarkdown,citationMarkdown}=await import('../src/main/report-markdown')
 const source='---\ntitle: Reporte\n---\n---\nclave: dato literal\n---\n\nCuerpo [@approved].'
 const prepared=format==='docx'?await prepareReportMarkdown(source,{diagrams:[],image:async()=>null}):citationMarkdown(source)
 await convert(format,prepared)
 expect(invoked.input).toHaveBeenLastCalledWith(expect.stringContaining('clave: dato literal'))
 expect(invoked.input).toHaveBeenLastCalledWith(expect.stringContaining('Cuerpo'))
})
it.each(['docx','html'] as const)('%s rechaza estilo/ruta libre, argumentos extra y metadatos que puedan leer recursos',async format=>{
 for(const value of [
  {...options,style:'../../externo.csl'}, {...options,style:'__proto__'},
  {...options,args:['--lua-filter','externo.lua']},
  {...options,referenceDoc:'/externo.docx'},
  {...options,metadata:{bibliography:'/externa.bib'}},{...options,metadata:{csl:'https://example.invalid/hostil.csl'}},
  {...options,metadata:{'include-in-header':'/externo'}},
 ])await expect(convert(format,'# Informe',value)).rejects.toThrow(/opci[oó]n|option|estilo|style|metadato|metadata/i)
 expect(invoked.execFile).not.toHaveBeenCalled()
})
it.each(['docx','html'] as const)('%s rechaza bytes de snapshot alterados después de validarse',async format=>{
 await expect(convert(format,'[@approved]',{...options,bibliography:{...bibliography,content:Buffer.from('otro contenido')}})).rejects.toThrow(/bibliograf|referenc|snapshot/i)
 expect(invoked.execFile).not.toHaveBeenCalled()
})
it.each([
 ['apa','41b4f3c9c61b58b7428ab21d653891995db7b4648d2f0a906eabcb8b2742e7ae'],
 ['ieee','6dee2b87ce90a7ab86f232d78a9216f47adc6193f13b6307b4a83c65594e721a'],
 ['vancouver','42759650b00306c02aa5786db843c8ed67128a86b2ec0a1825a1f4e6387d51cc'],
 ['chicago','635db8db1d0feca7fae37999470f0b56b51c208a71482e5ff4c45c30bdfb32bf'],
 ['mla','ad5398ee478760737ad04ec6f95ead6dfbea7d2ae5252fc21f337110dd564b58'],
])('el estilo fijo %s conserva los bytes oficiales y sus créditos',async(style,sha256)=>{
 await convert('docx','[@approved]',{...options,style})
 expect(createHash('sha256').update(invoked.conversions.at(-1)!.files['--csl']).digest('hex')).toBe(sha256)
})
it('DOCX admite únicamente el índice explícito y metadatos de la whitelist',async()=>{
 await convert('docx','# Informe',{toc:true,metadata:{title:'Informe & ñ',subtitle:'Subtítulo',author:['Elena García'],date:'2026-10-28',institution:'Universidad',abstract:'Resumen',lang:'es-MX'}})
 const call=invoked.conversions.at(-1)!
 expect(call.args).toContain('--toc')
 expect(call.args.filter(value=>value==='--metadata')).toHaveLength(7)
 expect(call.args).not.toContain('--citeproc')
})
it('cada autor se entrega como un valor escalar de metadata, sin una lista JSON visible',async()=>{
 await convert('docx','# Informe',{metadata:{author:['Elena García','José López']}})
 const args=invoked.conversions.at(-1)!.args
 expect(args.filter(value=>value.startsWith('author='))).toEqual(['author=Elena García','author=José López'])
})
it('ambas salidas conservan el idioma BCP 47 sin comillas ni escapes de Markdown',async()=>{
 for(const format of ['docx','html'] as const){
  await convert(format,'[@approved]',{...options,metadata:{lang:'es-MX'}})
  expect(invoked.conversions.at(-1)!.args).toContain('lang=es-MX')
 }
})
it.each(['docx','html'] as const)('%s rechaza un idioma inválido antes de ejecutar Pandoc',async format=>{
 await expect(convert(format,'[@approved]',{...options,metadata:{lang:'es MX'}})).rejects.toThrow(/opci[oó]n|option/i)
 expect(invoked.execFile).not.toHaveBeenCalled()
})
it('la portada DOCX usa únicamente la referencia propia y separa la copia del cuerpo sin YAML activo',async()=>{
 const source='---\nbibliography: /externa.bib\n---\n# Cuerpo\n\nTexto original.'
 await convert('docx',source,{cover:true,metadata:{title:'Informe',author:['Elena García']}})
 const call=invoked.conversions.at(-1)!
 expect(call.args).toContain('--reference-doc')
 expect(createHash('sha256').update(call.files['--reference-doc']).digest('hex')).toBe('8557dea1c67095d2df33743d4749a3a2d6783bcf33594acbb740a2054d90a8c4')
 expect(call.dataFiles).toEqual([])
 expect(relative(call.cwd,call.args[call.args.indexOf('--reference-doc')+1])).toBe('reference.docx')
 expect(invoked.input).toHaveBeenLastCalledWith('::: {custom-style="FreyaPageBreak"}\n\n\u200b\n\n:::\n\n# Cuerpo\n\nTexto original.')
})
it('sin portada no añade un salto ni una referencia, y HTML rechaza esta opción exclusiva de DOCX',async()=>{
 await convert('docx','# Cuerpo',{cover:false})
 expect(invoked.conversions.at(-1)!.args).not.toContain('--reference-doc')
 expect(invoked.input).toHaveBeenLastCalledWith('# Cuerpo')
 await expect(convert('html','# Cuerpo',{...options,cover:true})).rejects.toThrow(/opci[oó]n|option/i)
})
it('DOCX admite el título vetado del índice como toc-title y HTML lo rechaza',async()=>{
 await convert('docx','# Cuerpo',{toc:true,metadata:{tocTitle:'Contenido'}})
 const args=invoked.conversions.at(-1)!.args
 expect(args).toContain('--toc');expect(args).toContain('toc-title=Contenido')
 expect(args).not.toContain('tocTitle=Contenido')
 await expect(convert('html','# Cuerpo',{...options,metadata:{tocTitle:'Contenido'}})).rejects.toThrow(/opci[oó]n|option/i)
})

it('un checkout CRLF conserva los bytes oficiales de los cinco estilos CSL',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'freyalab-csl-checkout-'))
 const {execFileSync}=await vi.importActual<typeof import('node:child_process')>('node:child_process')
 const git=(...args:string[])=>execFileSync('git',['-C',directory,...args],{windowsHide:true,stdio:'pipe'})
 try{
  const files=JSON.parse(await readFile(new URL('../src/main/csl/manifest.json',import.meta.url),'utf8')).styles as {file:string;sha256:string}[]
  await mkdir(join(directory,'src/main/csl'),{recursive:true})
  for(const {file}of files)await copyFile(new URL('../src/main/csl/'+file,import.meta.url),join(directory,'src/main/csl',file))
  const attributes=await readFile(new URL('../.gitattributes',import.meta.url),'utf8').catch(error=>{if(error.code==='ENOENT')return'';throw error})
  if(attributes)await writeFile(join(directory,'.gitattributes'),attributes)
  git('init','--quiet');git('-c','core.autocrlf=false','add','--','.')
  for(const {file}of files)await rm(join(directory,'src/main/csl',file))
  git('-c','core.autocrlf=true','checkout-index','--all','--force')
  for(const {file,sha256}of files){
   const bytes=await readFile(join(directory,'src/main/csl',file))
   expect(createHash('sha256').update(bytes).digest('hex'),file).toBe(sha256)
  }
 }finally{await rm(directory,{recursive:true,force:true})}
})

it.each([
 [{lof:true},['--lof']],
 [{lot:true},['--lot']],
 [{toc:true,lof:true,lot:true},['--toc','--lof','--lot']],
] as const)('DOCX delega los índices explícitos %j a las opciones nativas',async(flags,expected)=>{
 const source='# Cuerpo\n\nTexto original.'
 await convert('docx',source,{...flags,metadata:{lang:'es-MX'}})
 const args=invoked.conversions.at(-1)!.args
 for(const flag of expected)expect(args).toContain(flag)
 expect(invoked.input).toHaveBeenLastCalledWith(source)
 expect(args).not.toContain('--lua-filter')
})
it('los índices desactivados no generan flags ni cambian la copia de Markdown',async()=>{
 await convert('docx','# Cuerpo',{toc:false,lof:false,lot:false})
 const args=invoked.conversions.at(-1)!.args
 for(const flag of ['--toc','--lof','--lot'])expect(args).not.toContain(flag)
 expect(invoked.input).toHaveBeenLastCalledWith('# Cuerpo')
})
it('HTML rechaza las opciones exclusivas de índices DOCX y DOCX no convierte valores de texto a booleanos',async()=>{
 for(const value of [{...options,lof:true},{...options,lot:true}])await expect(convert('html','[@approved]',value)).rejects.toThrow(/opci[oó]n|option/i)
 for(const value of [{lof:'true'},{lot:1}])await expect(convert('docx','# Cuerpo',value)).rejects.toThrow(/opci[oó]n|option/i)
 expect(invoked.execFile).not.toHaveBeenCalled()
})

it('la referencia propia define los estilos de cuerpo, código, citas, notas y tablas que usa Pandoc',async()=>{
 await convert('docx','# Cuerpo',{cover:true})
 const styles=zipFiles(invoked.conversions.at(-1)!.files['--reference-doc']).get('word/styles.xml')!.toString()
 const definitions=[...styles.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g)]
 const ids=new Set(definitions.map(match=>match[1]))
 for(const id of ['BodyText','FirstParagraph','Compact','CaptionedFigure','FootnoteText','BlockText','FootnoteReference','Hyperlink','VerbatimChar','Table'])expect.soft(ids.has(id),id).toBe(true)
 for(const match of styles.matchAll(/<w:basedOn\b[^>]*w:val="([^"]+)"/g))expect(ids.has(match[1]),match[1]).toBe(true)
 expect(definitions.filter(match=>/<w:pageBreakBefore\b/.test(match[2])).map(match=>match[1])).toEqual(['TOCHeading','FreyaPageBreak'])
})
