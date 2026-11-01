import './pandoc-assets'
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {zipFiles} from './docx'
import {createServer,type Server} from 'node:http'
import {detectPandoc,pandocToDocx,pandocCitationsToHtml,testPandoc,type PandocCitationOptions} from '../src/main/pandoc'
import {loadBibliography} from '../src/main/bibliography'
import {citationStyleIds} from '../src/shared/bibliography'

const pandoc=await detectPandoc(process.env.FREYALAB_PANDOC_TEST_PATH)
const run=promisify(execFile)
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfGQAAAAASUVORK5CYII=','base64')
describe.skipIf(!pandoc.available)('AC-00 · P4 con Pandoc real',()=>{
 let folder:string,server:Server,port:number,hits=0,approved:PandocCitationOptions[]
 const executable=pandoc.available?pandoc.path:''
 beforeAll(async()=>{
  folder=await mkdtemp(join(tmpdir(),'freyalab-ac00-'))
  for(const key of Object.keys(process.env))if(/^(?:https?|all)_proxy$/i.test(key))vi.stubEnv(key,'')
  server=createServer((_request,response)=>{hits++;response.writeHead(200,{'Content-Type':'image/png'});response.end(png)})
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
  const address=server.address();if(!address||typeof address==='string')throw new Error('No se creó el servidor de prueba')
  port=address.port
  const documentPath=join(folder,'informe.md');await writeFile(documentPath,'# Informe')
  await writeFile(join(folder,'approved.json'),JSON.stringify([{id:'approved',type:'book',title:'Fuente bibliográfica aprobada',author:[{family:'García',given:'Elena'}],issued:{'date-parts':[[2026]]}}]))
  await writeFile(join(folder,'approved.bib'),'@book{approved, author={García, Elena}, title={Fuente bibliográfica aprobada}, year={2026}}')
  approved=[]
  for(const file of ['approved.json','approved.bib']){
   const loaded=await loadBibliography({documentPath,bibliographyPath:file,pandocPath:executable})
   if(!loaded.ok)throw new Error(loaded.error.message)
   expect(loaded.entries).toMatchObject([{id:'approved',type:'book'}])
   approved.push({style:'apa',bibliography:loaded.snapshot})
  }
  process.stdout.write(`AC-00 P4 real: ${process.platform}, ${JSON.stringify(pandoc)}\n`)
 })
 afterAll(async()=>{
  if(server?.listening)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))
  if(folder)await rm(folder,{recursive:true,force:true})
  vi.unstubAllEnvs()
 })
 async function unsafe(source:string,args:string[]=[]):Promise<Buffer> {
  const child=execFile(executable,['-f','markdown','-t','docx','-o','-',...args],{encoding:'buffer',timeout:10_000,maxBuffer:64*1024*1024})
  let stderr=Buffer.alloc(0)
  child.stderr?.on('data',chunk=>{if(stderr.length<8192)stderr=Buffer.concat([stderr,chunk.subarray(0,8192-stderr.length)])})
  child.stdin?.end(source)
  return new Promise((resolve,reject)=>{const parts:Buffer[]=[];child.stdout?.on('data',chunk=>parts.push(chunk));child.on('error',reject);child.on('close',code=>code===0?resolve(Buffer.concat(parts)):reject(new Error(`Pandoc de control sintético terminó con ${code}: ${stderr.toString('utf8')}`)))})
 }
 async function finalOutputs(source:string){
  const results:{docx:Map<string,Buffer>;html:string}[]=[]
  for(const options of approved){
   const body=source+'\n\n[@approved]'
   const html=await pandocCitationsToHtml(executable,body,options)
   expect(html.replace(/<[^>]*>/g,'').toLocaleLowerCase()).toContain('fuente bibliográfica aprobada')
   for(const cover of [false,true]){
    const docx=zipFiles(await pandocToDocx(executable,body,{...options,cover,metadata:{title:'Informe de seguridad',author:['Autora Sintética'],lang:'es-MX'}}))
    expect(docx.get('word/document.xml')?.toString().replace(/<[^>]*>/g,'').toLocaleLowerCase()).toContain('fuente bibliográfica aprobada')
    results.push({docx,html})
   }
  }
  return results
 }
 async function finalCheck(label:string,check:()=>Promise<void>){try{await check()}catch(error){expect.soft(error,label).toBeUndefined()}}
 it('Probar Pandoc produce un DOCX y conserva el texto UTF-8',async()=>{
  expect(await testPandoc(executable)).toMatchObject({ok:true,bytes:expect.any(Number)})
  const files=zipFiles(await pandocToDocx(executable,'# Informe\n\nAcentos: áéíóú, ñ y 中文.'))
  expect(files.get('word/document.xml')?.toString('utf8').replace(/<[^>]*>/g,'')).toContain('áéíóú, ñ y 中文')
  await finalCheck('el cuerpo no se interpreta como una segunda cabecera YAML',async()=>{
   const {prepareReportMarkdown,citationMarkdown}=await import('../src/main/report-markdown')
   const source='---\ntitle: Reporte\n---\n---\nclave: dato literal\n---\n\nCuerpo [@approved].'
   const resolved=await prepareReportMarkdown(source,{diagrams:[],image:async()=>null})
   const files=zipFiles(await pandocToDocx(executable,resolved,approved[0]))
   expect(files.get('word/document.xml')?.toString().replace(/<[^>]*>/g,'')).toContain('clave: dato literal')
   const html=await pandocCitationsToHtml(executable,citationMarkdown(source),approved[0])
   expect(html.replace(/<[^>]*>/g,'')).toContain('clave: dato literal')
  })
  await finalCheck('metadatos literales y autores múltiples',async()=>{
   for(const cover of [false,true]){
   const metadata=zipFiles(await pandocToDocx(executable,'# Cuerpo',{cover,toc:true,metadata:{title:'Literal ![no](http://127.0.0.1:'+port+'/meta.png) <script>no</script>',subtitle:'Subtítulo canario',author:['Elena García','José López'],date:'2026-10-28',abstract:'Resumen canario',lang:'es-MX',tocTitle:'Contenido'}}))
   const document=metadata.get('word/document.xml')?.toString()??''
   expect(document).toContain('Elena');expect(document).toContain('García');expect(document).toContain('José');expect(document).toContain('López');expect(document).toContain('TOC')
   const authorParagraphs=[...document.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map(match=>match[0].replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim())
   expect(authorParagraphs).toContain('Elena García')
   expect(authorParagraphs).toContain('José López')
   expect(authorParagraphs).toContain('Subtítulo canario');expect(authorParagraphs).toContain('2026-10-28');expect(authorParagraphs).toContain('Resumen canario')
   expect(authorParagraphs).toContain('Contenido')
   expect(document).toMatch(/<w:instrText\b[^>]*>TOC\s/)
   expect(document).toMatch(/<w:fldChar\b[^>]*w:fldCharType="begin"/)
   if(cover){
    expect(document).toContain('<w:pStyle w:val="FreyaPageBreak"')
    expect(document.indexOf('<w:pStyle w:val="TOCHeading"')).toBeLessThan(document.indexOf('<w:pStyle w:val="FreyaPageBreak"'))
    expect(document.indexOf('<w:pStyle w:val="FreyaPageBreak"')).toBeLessThan(document.indexOf('<w:pStyle w:val="Heading1"'))
    const styles=metadata.get('word/styles.xml')?.toString()??''
    for(const id of ['FreyaPageBreak','TOCHeading']){
     const definition=[...styles.matchAll(/<w:style\b[^>]*>[\s\S]*?<\/w:style>/g)].map(match=>match[0]).find(style=>style.includes('w:styleId="'+id+'"'))
     expect(definition).toMatch(/<w:pageBreakBefore\b/)
    }
   }
   expect([...metadata.keys()].filter(path=>path.startsWith('word/media/'))).toHaveLength(0)
   expect(hits).toBe(0)
   }
  })
  await finalCheck('locale coherente entre DOCX y HTML',async()=>{
   await writeFile(join(folder,'locale.json'),JSON.stringify([{id:'locale',type:'book',title:'Libro comparativo',author:[{family:'García',given:'Elena'},{family:'López',given:'José'}],issued:{'date-parts':[[2026]]}}]))
   const loaded=await loadBibliography({documentPath:join(folder,'informe.md'),bibliographyPath:'locale.json'})
   if(!loaded.ok)throw new Error(loaded.error.message)
   const options={style:'chicago' as const,bibliography:loaded.snapshot,metadata:{lang:'es-MX'}}
   const docx=zipFiles(await pandocToDocx(executable,'[@locale]',options))
   const document=docx.get('word/document.xml')?.toString().replace(/<[^>]*>/g,'').replace(/\s+/g,' ')??''
   const html=await pandocCitationsToHtml(executable,'[@locale]',options)
   const citation=/\([^)]*García[^)]*López[^)]*2026\)/
   expect(document).toMatch(citation)
   expect(html.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').match(citation)?.[0]).toBe(document.match(citation)?.[0])
  })
  await finalCheck('índices nativos de figuras y tablas sin duplicar las citas del cuerpo',async()=>{
   const source='![Figura 1. Resultado **México** `[literal]*` 🐕 [@approved]](data:image/png;base64,'+png.toString('base64')+'){#figure-1}\n\n| A |\n| - |\n| B |\n\n: Tabla 1. Datos *México* y `<literal>` [@approved] {#table-1}\n\nVéase [Figura 1](#figure-1) y [Tabla 1](#table-1).'
   for(const cover of [false,true]){
    const representative=source+'\n\n> Cita de bloque.\n\n- Elemento.\n- Otro.\n\n```python\nprint("sintético")\n```\n\nUna nota[^n] y $x^2$.\n\n[^n]: Nota con `código`.\n'
    const files=zipFiles(await pandocToDocx(executable,representative,{...approved[0],cover,toc:true,lof:true,lot:true,metadata:{lang:'es-MX',tocTitle:'Contenido'}}))
    const document=files.get('word/document.xml')?.toString()??'',text=document.replace(/<[^>]*>/g,'')
    const fields=[...document.matchAll(/<w:instrText\b[^>]*>([\s\S]*?)<\/w:instrText>/g)].map(match=>match[1])
    expect(fields).toHaveLength(3)
    expect(fields.some(field=>field.includes('Image Caption'))).toBe(true)
    expect(fields.some(field=>field.includes('Table Caption'))).toBe(true)
    expect(fields.every(field=>field.startsWith('TOC '))).toBe(true)
    expect(text.toLocaleLowerCase('es')).toContain('índice de figuras');expect(text.toLocaleLowerCase('es')).toContain('índice de cuadros')
    expect(text).toContain('Figura 1. Resultado México [literal]* 🐕 (García, 2026)')
    expect(text).toContain('Tabla 1. Datos México y &lt;literal&gt; (García, 2026)')
    const names=[...document.matchAll(/<w:bookmarkStart\b[^>]*w:name="([^"]+)"/g)].map(match=>match[1])
    const anchors=[...document.matchAll(/<w:hyperlink\b[^>]*w:anchor="([^"]+)"/g)].map(match=>match[1])
    expect(anchors.length).toBeGreaterThanOrEqual(2)
    for(const anchor of anchors)expect(names).toContain(anchor)
    expect((text.match(/Figura 1\. Resultado/g)??[]).length).toBe(1)
    expect((text.match(/Tabla 1\. Datos/g)??[]).length).toBe(1)
    const styles=files.get('word/styles.xml')?.toString()??'',ids=new Set([...styles.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"/g)].map(match=>match[1]))
    for(const [part,bytes]of files)if(part.endsWith('.xml'))for(const match of bytes.toString().matchAll(/<w:(?:pStyle|rStyle|tblStyle)\b[^>]*w:val="([^"]+)"/g))expect.soft(ids.has(match[1]),part+':'+match[1]).toBe(true)
    expect(document).not.toContain('INCLUDETEXT')
   }
  })
  await finalCheck('CSL JSON rico no incorpora recursos activos',async()=>{
   const richPath=join(folder,'rich.json');await writeFile(richPath,JSON.stringify([{id:'rich',type:'book',title:`Fuente <img src="http://127.0.0.1:${port}/rich.png"> <script>texto</script>`,author:[{family:'García'}],issued:{'date-parts':[[2026]]}}]))
   const rich=await loadBibliography({documentPath:join(folder,'informe.md'),bibliographyPath:'rich.json'})
   if(!rich.ok)throw new Error(rich.error.message)
   const richOptions={style:'apa' as const,bibliography:rich.snapshot},richDocx=zipFiles(await pandocToDocx(executable,'[@rich]',richOptions)),richHtml=await pandocCitationsToHtml(executable,'[@rich]',richOptions)
   expect(richDocx.get('word/document.xml')?.toString()).not.toMatch(/<w:(?:fldChar|instrText)/)
   expect([...richDocx.keys()].filter(path=>path.startsWith('word/media/'))).toHaveLength(0)
   expect(richHtml).not.toMatch(/<(?:script|iframe)\b|<img\b[^>]*src=["'](?:https?:|file:|\/)/i)
   expect(hits).toBe(0)
  })
 })
 it('citeproc usa los cinco estilos aprobados con CSL JSON en DOCX y HTML',async()=>{
  for(const style of citationStyleIds){
   const options={...approved[0],style},docx=zipFiles(await pandocToDocx(executable,'[@approved]',options)),html=await pandocCitationsToHtml(executable,'[@approved]',options)
   expect(docx.get('word/document.xml')?.toString().replace(/<[^>]*>/g,'').toLocaleLowerCase()).toContain('fuente bibliográfica aprobada')
   expect(html.replace(/<[^>]*>/g,'').toLocaleLowerCase()).toContain('fuente bibliográfica aprobada')
  }
 })
 it('el estilo no filtra la ruta temporal del equipo en el DOCX',async()=>{
  const files=zipFiles(await pandocToDocx(executable,'[@approved]',approved[0]))
  const properties=files.get('docProps/custom.xml')?.toString()??''
  expect(properties).toContain('>style.csl<')
  expect(properties).not.toContain('freyalab-pandoc-')
 })
 it('institución literal visible en la cabecera de portada, sin campo pendiente',async()=>{
  const files=zipFiles(await pandocToDocx(executable,'# Cuerpo',{cover:true,metadata:{title:'Reporte',institution:'Universidad & <Instituto> Ñ',lang:'es-MX'}}))
  const headers=[...files].filter(([name])=>/^word\/header[^/]*\.xml$/.test(name))
  expect(headers).toHaveLength(1)
  expect(headers[0][1].toString()).toContain('Universidad &amp; &lt;Instituto&gt; Ñ')
  expect(headers[0][1].toString()).not.toMatch(/DOCPROPERTY|fldSimple|instrText/)
  expect(files.get('word/document.xml')?.toString()).toContain('w:type="first"')
  expect(files.get('word/_rels/document.xml.rels')?.toString()).toContain('/header')
 })
 it('hallazgo 1: el YAML no incorpora una bibliografía externa, ni con encabezados largos o YAML intermedio',async()=>{
  const secret=join(folder,'externa.bib')
  await writeFile(secret,'@book{canary, author={Autor Canario}, title={SECRETOBIBLIOGRAFICO}, year={2026}}')
  // Pandoc relee el metadato como Markdown: los separadores Windows se interpretarían como TeX.
  const yaml=`bibliography: ${JSON.stringify(secret.replaceAll('\\','/'))}\nnocite: '@*'`
  const control=zipFiles(await unsafe(`---\n${yaml}\n---\n# Informe`,['--sandbox','--citeproc']))
  expect(control.get('word/document.xml')?.toString()).toContain('SECRETOBIBLIOGRAFICO')
  for(const source of [`---\n${yaml}\n---\n# Informe`,`---\n${Array.from({length:110},(_,i)=>`key${i}: valor`).join('\n')}\n${yaml}\n---\n# Informe`,`# Informe\n\n---\n${yaml}\n---\n\nTexto`]){
   const files=zipFiles(await pandocToDocx(executable,source))
   expect(files.get('word/document.xml')?.toString()).not.toContain('SECRETOBIBLIOGRAFICO')
   for(const result of await finalOutputs(source)){
    expect(result.docx.get('word/document.xml')?.toString()).not.toContain('SECRETOBIBLIOGRAFICO')
    expect(result.html).not.toContain('SECRETOBIBLIOGRAFICO')
   }
  }
 })
 it('hallazgo 2: raw OpenXML produce campos en el control, pero ninguno en la conversión protegida',async()=>{
  const source='```{=openxml}\n<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>INCLUDETEXT "file:///secreto.txt"</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>\n```'
  expect(zipFiles(await unsafe(source,['--sandbox'])).get('word/document.xml')?.toString()).toMatch(/<w:(?:fldChar|instrText)/)
  expect(zipFiles(await pandocToDocx(executable,source)).get('word/document.xml')?.toString()).not.toMatch(/<w:(?:fldChar|instrText)/)
  for(const result of await finalOutputs(source)){
   expect(result.docx.get('word/document.xml')?.toString()).not.toMatch(/<w:(?:fldChar|instrText)/)
   expect(result.html).not.toMatch(/<w:(?:fldChar|instrText)/)
  }
 })
 it('hallazgos 3/4: no incrusta imágenes por ruta, pero admite la imagen data ya autorizada',async()=>{
  const image=join(folder,'fuera con espacios.png');await writeFile(image,png)
  const control=zipFiles(await unsafe(`![externa](${image.replaceAll('\\','/')})`,['-f','markdown-raw_attribute-raw_html-raw_tex-yaml_metadata_block']))
  expect([...control.keys()].filter(path=>path.startsWith('word/media/'))).toHaveLength(1)
  const files=zipFiles(await pandocToDocx(executable,`![externa](${image.replaceAll('\\','/')})\n\n![interna](fuera.png)\n\n![autorizada](data:image/png;base64,${png.toString('base64')})`))
  expect([...files.keys()].filter(path=>path.startsWith('word/media/'))).toHaveLength(1)
  expect(files.get('word/_rels/document.xml.rels')?.toString()).not.toContain('fuera con espacios.png')
  for(const result of await finalOutputs(`![externa](<${image.replaceAll('\\','/')}>)\n\n![autorizada](data:image/png;base64,${png.toString('base64')})`)){
   expect([...result.docx.keys()].filter(path=>path.startsWith('word/media/'))).toHaveLength(1)
   expect(result.docx.get('word/_rels/document.xml.rels')?.toString()).not.toContain('fuera con espacios.png')
   expect(result.html).not.toMatch(/<img\b[^>]*src=["'](?:file:|\/|[A-Za-z]:)/i)
   expect(result.html).toContain('data:image/png;base64,')
  }
 })
 it('un documento no carga filtros nombrados en el YAML',async()=>{
  const filter=join(folder,'filtro.lua'),marker=join(folder,'filtro-ejecutado')
  await writeFile(filter,`local f = io.open(${JSON.stringify(marker.replaceAll('\\','/'))}, 'w'); f:write('EJECUTADO'); f:close()\nreturn {}`)
  const control=run(executable,['--lua-filter',filter,'-f','markdown','-t','plain'],{encoding:'utf8',timeout:10_000})
  control.child.stdin?.end('# Prueba');await control
  expect(await readFile(marker,'utf8')).toBe('EJECUTADO');await rm(marker)
  await pandocToDocx(executable,`---\nfilters: [${JSON.stringify(filter)}]\nlua-filter: ${JSON.stringify(filter)}\n---\n# Informe`)
  await expect(readFile(marker,'utf8')).rejects.toThrow()
  await finalOutputs(`---\nfilters: [${JSON.stringify(filter)}]\nlua-filter: ${JSON.stringify(filter)}\n---\n# Informe`)
  await expect(readFile(marker,'utf8')).rejects.toThrow()
 })
 it('un servidor local verificado recibe cero peticiones de la conversión protegida',async()=>{
  const source=`![remota](http://127.0.0.1:${port}/canary.png)`
  hits=0;const response=await fetch(`http://127.0.0.1:${port}/control.png`);await response.arrayBuffer();expect(hits).toBe(1)
  hits=0;const control=run(executable,['-f','markdown','-t','docx','-o','-'],{encoding:'buffer',timeout:10_000})
  control.child.stdin?.end(source)
  const{stderr}=await control,hasHTTP=!stderr.toString().includes('compiled without HTTP support')
  expect(hits).toBe(hasHTTP?1:0)
  process.stdout.write(`AC-00 HTTP: ${hasHTTP?'control Pandoc con HTTP: 1 petición':'Pandoc sin soporte HTTP; eficacia del sandbox HTTP pendiente de otro binario'}\n`)
  hits=0;const files=zipFiles(await pandocToDocx(executable,source))
  expect(hits).toBe(0);expect([...files.keys()].filter(path=>path.startsWith('word/media/'))).toHaveLength(0)
  for(const result of await finalOutputs(source)){
   expect(hits).toBe(0);expect([...result.docx.keys()].filter(path=>path.startsWith('word/media/'))).toHaveLength(0)
   expect(result.html).not.toMatch(/<img\b[^>]*src=["']https?:/i)
  }
 })
})
if(!pandoc.available)process.stdout.write(`AC-00 P4 OMITIDO (${process.platform}): ${pandoc.reason}\n`)
