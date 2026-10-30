import {test,expect,_electron as electron} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {zipFiles} from '../docx'
import {xmlControlBatches} from '../xml-controls'
const pandoc=process.env.FREYALAB_PANDOC_TEST_PATH
const source=`---
portada: true
title: Reporte académico exportable
subtitle: Evidencia sintética
author: ["Ana García", "Luis Chen"]
date: 2026-10-28
institution: Instituto FreyaLab Sintético
abstract: Un reporte con datos, fuentes y referencias.
toc: true
lof: true
lot: true
lang: es
bibliography: referencias.json
---

# Resultados

Véase [@fig:ventas] y [@tbl:ventas]. Fuente: [@garcia2020, p. 10].

![Ventas locales](grafico.svg){#fig:ventas}

| Ciudad | Ventas |
| --- | --- |
| Oaxaca | 12 |

: Ventas verificadas {#tbl:ventas}

## Método

Una nota[^nota] y una ecuación $x^2$.

\`\`\`mermaid
flowchart LR
 A[Datos] --> B[Reporte]
\`\`\`

[^nota]: La misma fuente [@garcia2020].
`
test('AC-04 D1/D2 · reporte real en DOCX, HTML y PDF con fuentes, índices, figuras y páginas',async()=>{
 test.skip(!pandoc,'Requiere Pandoc externo elegido para esta comprobación; no se instala ni se empaqueta.')
 const directory=await mkdtemp(join(tmpdir(),'freya-ac04-')),path=join(directory,'informe.md'),library=join(directory,'referencias.json')
 await writeFile(path,source);await writeFile(library,JSON.stringify([{id:'garcia2020',type:'book',title:'Fuente local verificable',author:[{family:'García',given:'Ana'}],issued:{'date-parts':[[2020]]}}]))
 await writeFile(join(directory,'grafico.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="white"/><rect x="50" y="30" width="70" height="120" fill="#1670be"/><text x="150" y="95" fill="black" font-size="20">Ventas: 12</text></svg>')
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 const app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[process.env.FREYALAB_AC_TEST_ENTRY??resolve('out/main/index.js')],env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_TEST_PANDOC_PATH:pandoc!,FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_EXPORT_DIR:directory}})
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
  const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
  await expect(page.locator('.preview .mermaid-render svg')).toBeVisible();await expect(page.locator('.preview #citation-1')).toHaveText('(García, 2020, p. 10)');await expect(page.locator('.render-progress')).toHaveCount(0)
  async function exportFile(format:'docx'|'html'|'pdf'){
   await page.getByRole('button',{name:'Exportar',exact:true}).click()
   const button=page.getByRole('button',{name:format==='docx'?'Documento Word (DOCX)':format==='html'?'HTML autónomo':'Documento PDF',exact:true})
   await expect(button).toBeEnabled();await button.click()
   const output=join(directory,`informe.${format}`),messages=new Set<string>()
   try{await expect.poll(async()=>{for(const message of await page.locator('.toast').allTextContents())messages.add(message);return readdir(directory)}).toContain(`informe.${format}`)}catch(error){await test.info().attach(`export-${format}-messages`,{body:Buffer.from(JSON.stringify([...messages])),contentType:'application/json'});throw error}
   return readFile(output)
  }
  const docx=await exportFile('docx'),files=zipFiles(docx),xml=files.get('word/document.xml')!.toString(),styles=files.get('word/styles.xml')!.toString(),text=xml.replace(/<[^>]*>/g,'')
  await test.info().attach('reporte-docx',{body:docx,contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
  for(const value of ['Reporte académico exportable','Ana García','Luis Chen','Figura 1. Ventas locales','Tabla 1. Ventas verificadas','Fuente local verificable'])expect(text).toContain(value)
  // Pandoc 3.10 y 3.12 difieren en las mayúsculas de sus rótulos españoles.
  for(const value of ['índice de figuras','índice de cuadros'])expect(text.toLocaleLowerCase('es')).toContain(value)
  expect(xml).toContain('TOC');expect(xml).not.toMatch(/INCLUDETEXT|INCLUDEPICTURE/)
  const headers=[...files].filter(([name])=>/^word\/header[^/]*\.xml$/.test(name));expect(headers).toHaveLength(1);expect(headers[0][1].toString()).toContain('Instituto FreyaLab Sintético');expect(headers[0][1].toString()).not.toMatch(/DOCPROPERTY|fldSimple|instrText/);expect(xml).toContain('w:type="first"')
  expect(xml).toContain('w:pStyle w:val="Heading1"');expect(styles).toContain('w:styleId="Bibliography"')
  expect([...files.keys()].filter(name=>name.startsWith('word/media/')).length).toBeGreaterThanOrEqual(2)
  const html=(await exportFile('html')).toString();expect(html).toContain('Fuente local verificable');expect(html).not.toContain('sin estilo final');expect(html).not.toContain('[@garcia2020')
  const anchors=await page.evaluate(html=>{const document=new DOMParser().parseFromString(html,'text/html'),ids=Array.from(document.querySelectorAll('[id]'),node=>node.id),known=new Set(ids),links=Array.from(document.querySelectorAll('a[href^="#"]'),node=>node.getAttribute('href')!).filter(href=>href!=='#');return{ids:ids.length,links:links.length,missing:links.filter(href=>!known.has(decodeURIComponent(href.slice(1)))),duplicates:ids.filter((id,index)=>ids.indexOf(id)!==index)}},html)
  expect(anchors.missing).toEqual([]);expect(anchors.duplicates).toEqual([]);await test.info().attach('anclas-exportadas',{body:Buffer.from(JSON.stringify(anchors)),contentType:'application/json'})
  const markers=await page.evaluate(html=>{const document=new DOMParser().parseFromString(html,'text/html');return Array.from(document.querySelectorAll('[marker-end]'),node=>{const value=node.getAttribute('marker-end')!,id=/^url\(['"]?#([^'")]+)['"]?\)$/.exec(value)?.[1];return{value,exists:!!id&&!!document.getElementById(id)}})},html)
  expect(markers.length).toBeGreaterThan(0);expect(markers.every(marker=>marker.exists)).toBe(true)
  const pdfBytes=await exportFile('pdf');await test.info().attach('reporte-pdf',{body:pdfBytes,contentType:'application/pdf'})
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),loading=getDocument({data:new Uint8Array(pdfBytes),useSystemFonts:true})
  try{
   const pdf=await loading.promise;expect(pdf.numPages).toBeGreaterThan(1)
   const pages:string[]=[]
   for(let i=1;i<=pdf.numPages;i++){const content=await(await pdf.getPage(i)).getTextContent();pages.push(content.items.map(item=>'str'in item?item.str:'').join(' ').replace(/\s+/g,' '))}
   expect(pages[0]).toContain('Instituto FreyaLab Sintético');expect(pages.join(' ')).toContain('Fuente local verificable');expect(pages.join(' ')).toContain('Figura 1. Ventas locales');expect(pages.join(' ')).toContain('Tabla 1. Ventas verificadas')
   pages.forEach((text,index)=>{if(index===0)expect(text).not.toContain(`1 / ${pdf.numPages}`);else expect(text).toContain(`${index+1} / ${pdf.numPages}`)})
   await test.info().attach('páginas-reales',{body:Buffer.from(JSON.stringify({pages:pdf.numPages,text:pages})),contentType:'application/json'})
   if(process.env.FREYALAB_AC_EVIDENCE==='1')await writeFile('docs/evidence/ac-04-invariantes.json',JSON.stringify({anchors,markers,pages:pdf.numPages,text:pages},null,2)+'\n')
  }finally{await loading.destroy()}
  expect(await readFile(path,'utf8')).toBe(source);expect((await page.evaluate(()=>window.freya.documents())).find(current=>current.id===doc.id)).toMatchObject({text:source,dirty:false})
  await test.info().attach('reporte-html',{body:Buffer.from(html),contentType:'text/html'})
  if(process.env.FREYALAB_AC_EVIDENCE==='1'){await writeFile('docs/evidence/ac-04-informe.docx',docx);await writeFile('docs/evidence/ac-04-informe.html',html);await writeFile('docs/evidence/ac-04-informe.pdf',pdfBytes);for(const theme of ['light','dark']){await page.getByLabel('Tema',{exact:true}).selectOption(theme);await expect(page.locator('.render-progress')).toHaveCount(0);await page.screenshot({path:`docs/evidence/ac-04-${theme}-1440x900.png`,animations:'disabled'})}}
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
})

for(const customStyles of [false,true])test(`SEG-S2a · ${customStyles?'estilos y metadatos':'metadatos'} XML imposibles conservan el documento`,async()=>{
 test.skip(!pandoc,'Requiere Pandoc externo elegido; no se instala ni se empaqueta.')
 const directory=await mkdtemp(join(tmpdir(),'freya-word-xml-')),path=join(directory,'controles.md'),original='# Documento original sin guardar cambios\n'
 await writeFile(path,original)
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 const app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[process.env.FREYALAB_AC_TEST_ENTRY??resolve('out/main/index.js')],env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_TEST_PANDOC_PATH:pandoc!,FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_EXPORT_DIR:directory}})
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
  const[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path),summaries:{codes:number[];parts:number}[]=[]
  for(const[index,{codes,value,expected}]of xmlControlBatches.entries()){
   const text='---\nportada: true\ntitle: '+JSON.stringify('Título '+value)+'\nsubtitle: '+JSON.stringify('Subtítulo '+value)+'\nauthor: ['+JSON.stringify('Autor '+value)+', "Segunda autora ñ🐕"]\ndate: '+JSON.stringify('Fecha '+value)+'\ninstitution: Instituto válido\nabstract: Resumen válido sin transformar\nlang: es\n---\n\n'+(customStyles?'::: {custom-style="Estilo '+value+'"}\n\nPárrafo con estilo.\n\n:::\n\n[Texto con estilo]{custom-style="Carácter '+value+'"}\n\n':'Párrafo con estilo.\n\nTexto con estilo\n\n')+'```markdown\n::: {custom-style="Ejemplo literal"}\n```\n'
   // La actualización conserva incluso sustitutos sueltos en memoria; escribir el fixture como UTF-8 los convertiría antes de probar la frontera.
   const result=await page.evaluate(async({id,text})=>{const updated=await window.freya.update(id,text);return window.freya.export(id,{format:'docx',revision:updated.revision,html:'<article><p>Vista sintética del documento.</p></article>'})},{id:doc.id,text}),output=join(directory,'controles.docx')
   expect(result).toBe(output)
   const bytes=await readFile(output!),files=zipFiles(bytes),parts=[...files].filter(([name])=>/\.(?:xml|rels)$/.test(name)).map(([name,data])=>({name,xml:data.toString('utf8')}))
   const artifact=test.info().outputPath(`word-xml-batch-${index+1}.docx`);await writeFile(artifact,bytes)
   await test.info().attach(`word-xml-batch-${index+1}.docx`,{path:artifact,contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
   expect(parts.some(part=>part.name==='word/document.xml')).toBe(true);expect(parts.some(part=>part.name==='docProps/core.xml')).toBe(true)
   const checked=await page.evaluate(parts=>parts.map(({name,xml})=>{
    const parsed=new DOMParser().parseFromString(xml,'application/xml'),word='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    return{name,error:parsed.querySelector('parsererror')?.textContent??null,text:parsed.documentElement.textContent??'',styles:Array.from(parsed.getElementsByTagNameNS(word,'name'),node=>node.getAttributeNS(word,'val'))}
   }),parts)
   if(customStyles){
    expect(parts.filter(part=>/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(part.xml)).map(part=>part.name).sort()).toEqual(['word/document.xml','word/styles.xml'])
    expect(checked.filter(part=>part.error).map(part=>part.name).sort()).toEqual(['word/document.xml','word/styles.xml'])
    expect((await page.evaluate(()=>window.freya.documents())).find(current=>current.id===doc.id)).toMatchObject({text,dirty:true})
    expect(await readFile(path,'utf8')).toBe(original)
    // SEG-S2e: conservar y ejecutar el oráculo rojo; un verde inesperado obliga a revisar este límite.
    test.fail(true,'SEG-S2e diferido por el propietario: custom-style todavía produce XML inválido; no se omite la prueba.')
   }
   expect(checked.filter(part=>part.error),codes.map(code=>code.toString(16)).join(',')).toEqual([])
   const body=checked.find(part=>part.name==='word/document.xml')!.text
   for(const field of ['Título','Subtítulo','Autor','Fecha'])expect(body).toContain(field+' '+expected)
   expect(checked.find(part=>part.name==='docProps/core.xml')!.text).toContain('Título '+expected)
   const styles=checked.find(part=>part.name==='word/styles.xml')!.styles
   if(customStyles){expect(styles).toContain('Estilo '+expected);expect(styles).toContain('Carácter '+expected)}
   expect(styles).not.toContain('Ejemplo literal')
   expect(body).toContain('Resumen válido sin transformar');expect(body).toContain('Párrafo con estilo.');expect(body).toContain('Texto con estilo')
   expect((await page.evaluate(()=>window.freya.documents())).find(current=>current.id===doc.id)).toMatchObject({text,dirty:true})
   expect(await readFile(path,'utf8')).toBe(original)
   summaries.push({codes,parts:parts.length})
  }
  expect(summaries.flatMap(value=>value.codes)).toHaveLength(2079)
  await test.info().attach('word-xml-controles',{body:Buffer.from(JSON.stringify(summaries)),contentType:'application/json'})
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
})

test('SEG-S2a · sustitutos sueltos de custom-style se exportan como U+FFFD sin alterar el original',async()=>{
 test.skip(!pandoc,'Requiere Pandoc externo elegido; no se instala ni se empaqueta.')
 const directory=await mkdtemp(join(tmpdir(),'freya-word-surrogates-')),path=join(directory,'sustitutos.md'),original='# Original conservado\n'
 await writeFile(path,original)
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 const app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[process.env.FREYALAB_AC_TEST_ENTRY??resolve('out/main/index.js')],env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_TEST_PANDOC_PATH:pandoc!,FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_EXPORT_DIR:directory}})
 try{
  const page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
  const[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
  const text='::: {custom-style="Estilo \ud800"}\n\nPárrafo con ñ🐕.\n\n:::\n\n[Texto con estilo]{custom-style="Carácter \udfff"}\n'
  const result=await page.evaluate(async({id,text})=>{const updated=await window.freya.update(id,text);return window.freya.export(id,{format:'docx',revision:updated.revision,html:'<article><p>Vista sintética.</p></article>'})},{id:doc.id,text}),output=join(directory,'sustitutos.docx')
  expect(result).toBe(output)
  const bytes=await readFile(output!),parts=[...zipFiles(bytes)].filter(([name])=>/\.(?:xml|rels)$/.test(name)).map(([name,data])=>({name,xml:data.toString('utf8')}))
  const checked=await page.evaluate(parts=>parts.map(({name,xml})=>{const parsed=new DOMParser().parseFromString(xml,'application/xml');return{name,error:parsed.querySelector('parsererror')?.textContent??null,text:parsed.documentElement.textContent??'',styles:Array.from(parsed.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','name'),node=>node.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','val'))}}),parts)
  expect(checked.filter(part=>part.error)).toEqual([])
  expect(checked.find(part=>part.name==='word/styles.xml')!.styles).toEqual(expect.arrayContaining(['Estilo �','Carácter �']))
  expect(checked.find(part=>part.name==='word/document.xml')!.text).toContain('Párrafo con ñ🐕.')
  expect((await page.evaluate(()=>window.freya.documents())).find(current=>current.id===doc.id)).toMatchObject({text,dirty:true})
  expect(await readFile(path,'utf8')).toBe(original)
  const artifact=test.info().outputPath('word-surrogates.docx');await writeFile(artifact,bytes)
  await test.info().attach('word-surrogates.docx',{path:artifact,contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
})
