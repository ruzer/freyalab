import './pandoc-assets'
import {beforeEach,expect,it,vi} from 'vitest'
import {readFile,access,readdir,mkdtemp,mkdir,copyFile,writeFile,rm} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {relative,isAbsolute,join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {zipFiles} from './docx'
import {xmlControlBatches} from './xml-controls'
import {getLanguage,setLanguage} from '../src/shared/i18n'

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

const metadataLimits=[
 {metadata:{title:'x'.repeat(1001)},es:'El título admite hasta 1000 caracteres.',en:'The title allows up to 1000 characters.'},
 {metadata:{subtitle:'x'.repeat(1001)},es:'El subtítulo admite hasta 1000 caracteres.',en:'The subtitle allows up to 1000 characters.'},
 {metadata:{institution:'x'.repeat(2*1024*1024)},es:'La institución admite hasta 1000 caracteres.',en:'The institution allows up to 1000 characters.'},
 {metadata:{author:['x'.repeat(201)]},es:'Cada autor admite hasta 200 caracteres.',en:'Each author allows up to 200 characters.'},
 {metadata:{author:Array.from({length:101},()=> 'Autor')},es:'Puedes incluir hasta 100 autores.',en:'You can include up to 100 authors.'},
]
for(const language of ['es','en'] as const)it.each(metadataLimits)(`S2b: rechaza el campo excesivo antes de invocar Pandoc (${language}): $es`,async example=>{
 const previous=getLanguage();setLanguage(language)
 try{await expect(convert('docx','# Cuerpo',{metadata:example.metadata})).rejects.toThrow(example[language]);expect(invoked.execFile).not.toHaveBeenCalled()}finally{setLanguage(previous)}
})
const combinedBoundary={title:'t'.repeat(1000),subtitle:'s'.repeat(1000),author:Array.from({length:20},()=> 'a'.repeat(200)),date:'d'.repeat(1000),lang:'es-MX',institution:'i'.repeat(500),abstract:'r'.repeat(490),tocTitle:'í'.repeat(5)}
const combinedLimits=[
 {name:'resumen ASCII',metadata:{abstract:'x'.repeat(8001)},es:'el resumen',en:'the abstract',excess:1},
 {name:'resumen no BMP',metadata:{abstract:'🐕'.repeat(4000)+'x'},es:'el resumen',en:'the abstract',excess:1},
 {name:'comillas y barras alternadas',metadata:{abstract:String.fromCharCode(92,34).repeat(4000)+'x'},es:'el resumen',en:'the abstract',excess:1},
 {name:'fecha tras autores',metadata:{author:Array.from({length:40},()=> 'a'.repeat(200)),date:'d'},es:'la fecha',en:'the date',excess:1},
 {name:'institución tras autores',metadata:{author:Array.from({length:40},()=> 'a'.repeat(200)),institution:'ñ'},es:'la institución',en:'the institution',excess:1},
 {name:'idioma con exceso total posterior',metadata:{author:Array.from({length:40},()=> 'a'.repeat(200)),lang:'es-MX',abstract:'r'.repeat(7)},es:'el idioma',en:'the language',excess:12},
 {name:'título del índice y los ocho campos',metadata:{...combinedBoundary,tocTitle:'í'.repeat(6)},es:'el título del índice',en:'the table of contents title',excess:1},
 {name:'autores con exceso total posterior',metadata:{title:'t'.repeat(1000),subtitle:'s'.repeat(1000),author:Array.from({length:31},()=> 'a'.repeat(200)),abstract:'r'.repeat(300)},es:'los autores',en:'the authors',excess:500},
]
for(const language of ['es','en'] as const)it.each(combinedLimits)(`S2b: rechaza más de 8000 unidades UTF-16 antes de iniciar Pandoc (${language}): $name`,async example=>{
 const previous=getLanguage(),original=structuredClone(example.metadata);setLanguage(language)
 const message=language==='es'?`Revisa ${example.es}: los metadatos superan el límite conjunto de 8000 unidades UTF-16. Exceso: ${example.excess}.`:`Review ${example.en}: metadata exceeds the combined limit of 8000 UTF-16 units. Excess: ${example.excess}.`
 try{await expect(convert('docx','# Cuerpo',{metadata:example.metadata})).rejects.toThrow(message);expect(invoked.execFile).not.toHaveBeenCalled();expect(example.metadata).toEqual(original)}finally{setLanguage(previous)}
})
it('S2b: el antiguo conjunto de máximos se rechaza por su total, sin truncarlo',async()=>{
 const metadata={title:'🐕'.repeat(1000),subtitle:'x'.repeat(1000),institution:'ñ'.repeat(1000),author:Array.from({length:100},()=> '🐕'.repeat(200)),abstract:'ñ'.repeat(32768)},original=structuredClone(metadata)
 await expect(convert('docx','# Cuerpo',{metadata})).rejects.toThrow('Revisa los autores: los metadatos superan el límite conjunto de 8000 unidades UTF-16. Exceso: 68768.')
 expect(invoked.execFile).not.toHaveBeenCalled();expect(metadata).toEqual(original)
})
it('S2b: acepta topes individuales exactos, contando codepoints sin partir pares',async()=>{
 const metadata={title:'🐕'.repeat(1000),subtitle:'x'.repeat(1000),institution:'ñ'.repeat(1000),author:['🐕'.repeat(200)]}
 await expect(convert('docx','# Cuerpo',{metadata})).resolves.toBeInstanceOf(Buffer)
 const args=invoked.conversions.at(-1)!.args
 expect(args).toContain('title='+metadata.title);expect(args).toContain('subtitle='+metadata.subtitle);expect(args).toContain('institution='+metadata.institution);expect(args).toContain('author='+metadata.author[0])
})
it.each([
 {name:'ASCII',metadata:{abstract:'x'.repeat(8000)}},
 {name:'no BMP',metadata:{abstract:'🐕'.repeat(4000)}},
 {name:'comillas y barras alternadas',metadata:{abstract:String.fromCharCode(92,34).repeat(4000)}},
 {name:'los ocho campos',metadata:combinedBoundary},
])('S2b: acepta exactamente 8000 unidades UTF-16 ($name), con valores y cuerpo intactos',async({metadata})=>{
 const original=structuredClone(metadata),source='# Fuente original\r\n\r\nTexto ñ🐕.'
 await expect(convert('docx',source,{metadata})).resolves.toBeInstanceOf(Buffer)
 const args=invoked.conversions.at(-1)!.args
 for(const [field,value]of Object.entries(metadata)){
  const key=field==='tocTitle'?'toc-title':field,values=Array.isArray(value)?value:[value]
  expect(args.filter(arg=>arg.startsWith(key+'='))).toEqual(values.map(value=>key+'='+value))
 }
 expect(args).not.toContain('--defaults');expect(args).not.toContain('--metadata-file');expect(metadata).toEqual(original);expect(invoked.input).toHaveBeenLastCalledWith(source)
})
it('S2b: calcula el presupuesto Windows con cien autores, comillas, barras y todas las opciones fijas',async()=>{
 const pair=String.fromCharCode(92,34),author=Array.from({length:100},(_,index)=>index===0?pair.repeat(37)+String.fromCharCode(92):pair.repeat(40)),metadata={title:'',subtitle:'',author,date:'',lang:'es-MX',institution:'',abstract:'',tocTitle:''}
 await convert('docx','# Cuerpo',{...options,cover:true,toc:true,lof:true,lot:true,metadata})
 const call=invoked.conversions.at(-1)!,values=Object.values(metadata).flat(),units=values.reduce((sum,value)=>sum+value.length,0)
 // Modelo conservador: entrecomilla cada argumento con las reglas de escape de Windows.
 const quotedUnits=(argument:string)=>{
  let units=2,slashes=0
  for(const character of argument){
   if(character===String.fromCharCode(92)){slashes++;continue}
   units+=slashes*(character==='"'?2:1)+character.length+(character==='"'?1:0);slashes=0
  }
  return units+slashes*2
 }
 expect(units).toBe(8000);expect(quotedUnits(pair.repeat(4000))).toBe(16002);expect(quotedUnits('🐕'.repeat(4000))).toBe(8002)
 const quotedCommand=quotedUnits(process.execPath)+call.args.reduce((sum,arg)=>sum+quotedUnits(arg)+1,0)+1,content=values.reduce((sum,value)=>sum+quotedUnits(value)-2,0),overhead=quotedCommand-content,bound=units*2+overhead
 expect(content).toBeLessThanOrEqual(16000);expect(units*2*2).toBe(32000) // bytes del contenido, no unidades UTF-16.
 expect(quotedCommand).toBeLessThanOrEqual(bound);expect(bound).toBeLessThan(32767)
 expect(call.args.filter(value=>value==='--metadata')).toHaveLength(107)
 for(const flag of ['--sandbox','--citeproc','--reference-doc','--toc','--lof','--lot'])expect(call.args).toContain(flag)
 expect(call.args).not.toContain('--defaults');expect(call.args).not.toContain('--metadata-file')
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
it('S2a: DOCX sustituye todo carácter XML imposible de metadatos por espacio, sin mutar las opciones',async()=>{
 for(const {value,expected,label}of xmlControlBatches){
  const metadata={title:value,subtitle:value,author:[value,'Autora ñ🐕'],date:value,tocTitle:value,abstract:'Resumen\u000b intacto',institution:'Institución intacta',lang:'es-MX'},original=structuredClone(metadata)
  await convert('docx','# Cuerpo',{metadata})
  const args=invoked.conversions.at(-1)!.args
  for(const key of ['title','subtitle','author','date','toc-title'])expect(args,`${key}: ${label}`).toContain(key+'='+expected)
  expect(args).toContain('author=Autora ñ🐕');expect(args).toContain('abstract=Resumen\u000b intacto');expect(args).toContain('institution=Institución intacta')
  expect(metadata).toEqual(original)
 }
})
it('S2a: conserva cuerpo, ejemplos custom-style, resumen y los caracteres XML legales',async()=>{
 const valid='Texto\tcon\nCR\r ñ🐕\ud7ff\ue000\ufffd\u{10000}\u{10ffff}',source='# Cuerpo\u0001 intacto\n\n```markdown\n::: {custom-style="ejemplo\u0001"}\n```\n\n`[literal]{custom-style="otro\u0001"}`'
 await convert('docx',source,{metadata:{title:valid,subtitle:valid,author:[valid],date:valid,tocTitle:valid,abstract:'Resumen\u000b intacto'}})
 const args=invoked.conversions.at(-1)!.args
 for(const key of ['title','subtitle','author','date','toc-title'])expect(args).toContain(key+'='+valid)
 expect(args).toContain('abstract=Resumen\u000b intacto');expect(invoked.input).toHaveBeenLastCalledWith(source)
})
it('S2a: mantiene el rechazo de la institución inválida de portada',async()=>{
 for(const institution of ['Nombre\0 imposible','Nombre\ud800 imposible','Nombre\uffff imposible'])await expect(convert('docx','# Cuerpo',{cover:true,metadata:{institution}})).rejects.toThrow(/instituci[oó]n|institution/i)
 expect(invoked.conversions).toHaveLength(0)
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
