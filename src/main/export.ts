import { BrowserWindow, dialog, app } from 'electron'
import { readFile, readdir, realpath, lstat, open, unlink } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sanitize from 'sanitize-html'
import {createHash} from 'node:crypto'
import {t} from '../shared/i18n'
import {svgTags,cleanExportMarkup} from './export-markup'
import {detectPandoc,pandocToDocx,pandocCitationsToHtml,type PandocReportOptions} from './pandoc'
import {loadBibliography} from './bibliography'
import {bibliographyPath} from '../shared/bibliography-source'
import {frontMatterOf} from '../shared/front-matter'
import {reportMetadataOf,reportTOCTitle} from '../renderer/lib/report-metadata'
import {prepareReportMarkdown,citationMarkdown,reportCitationGroups} from './report-markdown'
import {presentCitations} from '../renderer/lib/remark-citations'
import { atomicWrite,digest } from './files'
import type { Documents } from './documents'
import type { ExportRequest,GraphicExportRequest } from '../shared/types'
const CSP="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; object-src 'none'; base-uri 'none'"
export function cleanSVG(svg:string){return sanitize(svg,{allowedTags:svgTags,allowedAttributes:{'*':['id','class','style','transform','fill','fill-opacity','stroke','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','x','y','x1','x2','y1','y2','dx','dy','width','height','viewBox','xmlns','xmlns:xlink','d','points','r','rx','ry','cx','cy','text-anchor','dominant-baseline','font-size','font-family','font-weight','marker-start','marker-end','marker-mid','orient','refX','refY','markerWidth','markerHeight','markerUnits','clip-path','preserveAspectRatio','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','role','aria-labelledby','aria-roledescription','href','xlink:href']},parser:{lowerCaseTags:false,lowerCaseAttributeNames:false},allowedSchemes:['data'],allowProtocolRelative:false,allowVulnerableTags:true,transformTags:{use:(tag,attrs)=>({tagName:tag,attribs:Object.fromEntries(Object.entries(attrs).filter(([k,v])=>!['href','xlink:href'].includes(k)||v.startsWith('#')))}),image:(tag,attrs)=>({tagName:tag,attribs:Object.fromEntries(Object.entries(attrs).filter(([k,v])=>!['href','xlink:href'].includes(k)||v.startsWith('data:image/')))})}})}
const assets=join(fileURLToPath(new URL('.',import.meta.url)),'../renderer/assets')
async function embeddedFonts(files:string[]){
 let css=''
 for(const [prefix,family,weight] of [['inter-latin-400','Inter','400'],['inter-latin-600','Inter','600'],['jetbrains-mono-latin-400','JetBrains Mono','400']]){const file=files.find(f=>f.startsWith(prefix)&&f.endsWith('.woff2'));if(file)css+=`@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${(await readFile(join(assets,file))).toString('base64')}) format('woff2')}`}
 return css
}
export async function autonomousSVG(input:string){
 const svg=cleanSVG(input),end=svg.lastIndexOf('</svg>');if(end<0)throw new Error('No hay un SVG válido para exportar.')
 // Un SVG cargado como imagen no hereda las fuentes declaradas por el HTML que lo contiene.
 const fonts=await embeddedFonts(await readdir(assets).catch(()=>[]))
 return fonts?svg.slice(0,end)+`<style>${fonts}</style>`+svg.slice(end):svg
}
export async function autonomousHTML(html:string){
 const files=await readdir(assets).catch(()=>[])
 const urls=[...html.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)]
 for(const match of urls){const url=match[1];if(url.startsWith('data:')||url.startsWith('#'))continue;const base=basename(url.split(/[?#]/)[0]);const found=files.find(f=>f===base)||files.find(f=>f.startsWith(base.replace(/\.[^.]+$/,''))&&/\.(woff2?|ttf)$/.test(f));let replacement='';if(found){const mime=found.endsWith('.woff2')?'font/woff2':found.endsWith('.woff')?'font/woff':'font/ttf';replacement=`data:${mime};base64,${(await readFile(join(assets,found))).toString('base64')}`}html=html.split(match[0]).join(`url('${replacement}')`)}
 const bundledFonts=await embeddedFonts(files)
 const cleaned=cleanExportMarkup(html)
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><style>${bundledFonts}@page{size:A4;margin:18mm}body{font:14px Inter,system-ui;color:#171717;background:white;line-height:1.6}img,svg{max-width:100%}pre{white-space:pre-wrap}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:6px}tr,pre,blockquote,.mermaid{break-inside:avoid}thead{display:table-header-group}</style></head><body>${cleaned}</body></html>`
}
function exportWindow(){
 const window=new BrowserWindow({show:false,width:1200,height:900,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,javascript:true,partition:`export-${Date.now()}`}})
 window.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('data:')}))
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}))
 window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false))
 return window
}
async function loadExportPage(window:BrowserWindow,html:string){
 const document=await autonomousHTML(html)
 await window.loadURL('data:text/html,<!doctype html>')
 await window.webContents.executeJavaScript(`document.open();document.write(${JSON.stringify(document)});document.close();true`)
 await window.webContents.executeJavaScript(`Promise.all([document.fonts.ready,...Array.from(document.images,i=>i.complete?Promise.resolve():new Promise((resolve,reject)=>{i.onload=resolve;i.onerror=()=>reject(new Error('Una imagen no pudo cargarse'))}))]).then(()=>true)`)
}
async function wordImage(window:BrowserWindow,svg:string):Promise<string>{
 const safe=await autonomousSVG(svg)
 return window.webContents.executeJavaScript(`(async()=>{
  const svg=${JSON.stringify(safe)},source=new DOMParser().parseFromString(svg,'image/svg+xml').documentElement,box=(source.getAttribute('viewBox')||'').split(/[ ,]+/).map(Number),image=new Image();
  image.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject});
  const w=box.length===4?box[2]:image.naturalWidth,h=box.length===4?box[3]:image.naturalHeight,width=Math.ceil(w*2),height=Math.ceil(h*2);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width>8192||height>8192||width*height>32000000)throw new Error(${JSON.stringify(t('report.diagramTooLarge'))});
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(image,0,0,width,height);return canvas.toDataURL('image/png');
 })()`)
}
async function academicExport(docs:Documents,id:string,request:ExportRequest,destination:string,validate:()=>void):Promise<{html?:string;word?:Buffer}>{
 const record=docs.get(id),source=record.text,{frontMatter}=frontMatterOf(source),values=reportMetadataOf(frontMatter??''),reference=bibliographyPath(frontMatter)
 if(request.format!=='docx'&&!reference)return{html:request.html}
 const library=reference&&record.info.path?await loadBibliography({documentPath:record.info.path,documentRoot:record.root,bibliographyPath:reference,pandocPath:docs.pandocPath}):undefined
 validate()
 if(reference&&!record.info.path)throw new Error(t('bibliography.error.saveFirst'))
 if(library&&!library.ok)throw new Error(library.error.message)
 if(library?.ok&&(await realpath(destination).catch(()=>resolve(destination)))===library.path)throw new Error(t('report.overwriteLibrary'))
 const pandoc=await detectPandoc(docs.pandocPath);validate()
 if(request.format==='docx'&&!pandoc.available)throw new Error(pandoc.reason)
 const window=exportWindow()
 try{
  await loadExportPage(window,request.html??'<article></article>');validate()
  let word:Buffer|undefined
  const language=typeof values.get('lang')==='string'?values.get('lang') as string:'es',style=request.citationStyle??'apa'
  if(request.format==='docx'){
   const svgs:string[]=await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.mermaid-render svg'),svg=>svg.outerHTML)`),diagrams:string[]=[]
   for(const svg of svgs){diagrams.push(await wordImage(window,svg));validate()}
   const resolved=await prepareReportMarkdown(source,{diagrams,image:async url=>{
    const image=await docs.image(id,url);validate()
    if(!image?.startsWith('data:image/svg+xml'))return image
    const comma=image.indexOf(','),header=image.slice(0,comma),content=image.slice(comma+1)
    return wordImage(window,/;base64$/i.test(header)?Buffer.from(content,'base64').toString('utf8'):decodeURIComponent(content))
   }});validate()
   const metadata:NonNullable<PandocReportOptions['metadata']>={lang:language,tocTitle:reportTOCTitle(language)},cover=values.get('portada')==='true'
   if(cover){
    for(const key of ['title','subtitle','date','institution','abstract'] as const){const value=values.get(key);if(typeof value==='string')metadata[key]=value}
    const authors=values.get('author');if(authors)metadata.author=Array.isArray(authors)?authors:[authors]
   }
   word=await pandocToDocx(pandoc.available?pandoc.path:'',resolved,{cover,metadata,toc:values.get('toc')==='true',lof:values.get('lof')==='true',lot:values.get('lot')==='true',...(library?.ok?{style,bibliography:library.snapshot}:{})})
   if(!word.subarray(0,4).equals(Buffer.from('PK\x03\x04')))throw new Error(t('pandoc.invalidDocx'))
  }else if(pandoc.available&&library?.ok){
   const formatted=await pandocCitationsToHtml(pandoc.path,citationMarkdown(source),{style,bibliography:library.snapshot,metadata:{lang:language}});validate()
   await window.webContents.executeJavaScript(`(()=>{
    const parsed=new DOMParser().parseFromString(${JSON.stringify(formatted)},'text/html'),citations=Array.from(parsed.querySelectorAll('span.freya-export-citation[id^="freya-export-citation-"]')),targets=Array.from(document.querySelectorAll('[id^="citation-"]'));
    if(citations.length!==targets.length)throw new Error(${JSON.stringify(t('report.invalidPositions'))});
    for(const citation of citations){const id=citation.id.slice('freya-export-'.length),target=document.getElementById(id);if(!target)throw new Error(${JSON.stringify(t('report.invalidPositions'))});const copy=citation.cloneNode(true);copy.id=id;copy.classList.add('document-citation');target.replaceWith(copy)}
    const refs=parsed.getElementById('refs'),container=document.getElementById('document-bibliography');
    if(refs&&container){const heading=container.firstElementChild?.cloneNode(true);container.replaceChildren(...(heading?[heading]:[]),refs.cloneNode(true))}
    for(const link of document.querySelectorAll('.report-figures a,.report-tables a')){const target=document.getElementById(link.getAttribute('href').slice(1)),caption=target?.querySelector('figcaption');if(caption)link.textContent=caption.textContent}
    return true;
   })()`)
  }else if(library?.ok){
   const presentation=presentCitations(reportCitationGroups(source),library.entries)
   await window.webContents.executeJavaScript(`(()=>{
    const presentation=${JSON.stringify(presentation)};
    for(const group of presentation.groups){
     const previous=document.getElementById(group.id);if(!previous)throw new Error(${JSON.stringify(t('report.invalidPositions'))});
     const node=document.createElement(group.href?'a':'span');node.id=group.id;node.className=group.missing?'citation-missing':'document-citation';node.textContent=group.text;if(group.href)node.setAttribute('href',group.href);previous.replaceWith(node);
    }
    const container=document.getElementById('document-bibliography');
    if(container){
     container.replaceChildren();
     if(presentation.references.length){const title=document.createElement('p'),label=document.createElement('strong');label.textContent=${JSON.stringify(t('citations.references'))};title.append(label);container.append(title)}
     for(const reference of presentation.references){const paragraph=document.createElement('p');paragraph.id=reference.id;paragraph.textContent=reference.text;container.append(paragraph)}
    }
    for(const link of document.querySelectorAll('.report-figures a,.report-tables a')){const target=document.getElementById(link.getAttribute('href').slice(1)),caption=target?.querySelector('figcaption');if(caption)link.textContent=caption.textContent}
    const note=document.createElement('p');note.textContent=${JSON.stringify(t('citations.noFinalStyle'))};document.querySelector('article')?.prepend(note);return true;
   })()`)
  }
  validate()
  if(library?.ok&&reference&&record.info.path){const current=await loadBibliography({documentPath:record.info.path,documentRoot:record.root,bibliographyPath:reference,pandocPath:docs.pandocPath});validate();if(!current.ok||current.sha256!==library.sha256)throw new Error(t('bibliography.error.changed'))}
  return word?{word}:{html:await window.webContents.executeJavaScript('document.documentElement.outerHTML')}
 }finally{window.destroy()}
}
export async function exportDocument(docs:Documents,id:string,request:ExportRequest){
 const record=docs.get(id);if(record.info.readonly)throw new Error('No se exporta un archivo completo desde una muestra limitada.')
 if(request.format==='docx'&&record.info.kind!=='markdown')throw new Error(t('error.invalidOperation'))
 if(record.info.kind==='markdown'){
  const revision=request.revision??record.info.revision,source=record.text,path=record.info.path
  const validate=()=>{if(docs.records.get(id)!==record||record.info.revision!==revision||record.text!==source||record.info.path!==path)throw new Error(t('bibliography.error.changedDocument'))}
  validate();return writeExport(docs,id,request,validate)
 }
 return writeExport(docs,id,request)
}
export async function exportGraphic(docs:Documents,id:string,request:GraphicExportRequest){
 const validateGraphic=()=>{const record=docs.get(id);if(record.info.kind!=='csv')throw new Error('La exportación de gráficos requiere un CSV abierto.');if(record.info.revision!==request.revision)throw new Error('La fuente cambió. Genera de nuevo el gráfico antes de exportar.')}
 validateGraphic()
 return writeExport(docs,id,request,validateGraphic)
}
async function writeExport(docs:Documents,id:string,request:ExportRequest,validateSource?:()=>void){
 const record=docs.get(id),destination=await exportDestination(record.info.name,request.format)
 if(!destination)return null
 validateSource?.()
 await validateDestination(docs,destination,request.format)
 const academic=record.info.kind==='markdown'&&['docx','html','pdf'].includes(request.format)?await academicExport(docs,id,request,destination,()=>validateSource?.()):undefined
 if(academic?.html)request={...request,html:academic.html}
 const svg=request.svg&&['svg','png','pdf'].includes(request.format)?await autonomousSVG(request.svg):undefined
 let data:Buffer|string
 if(request.format==='docx'){if(!academic?.word)throw new Error(t('pandoc.invalidDocx'));data=academic.word}
 else if(request.format==='csv'||request.format==='tsv'){if(record.info.kind!=='csv')throw new Error('Exportación tabular requiere CSV/TSV.');data=Buffer.from(await docs.table.call('serialize',id,{...request.table,delimiter:request.format==='tsv'?'\t':','}))}
 else if(request.format==='svg'){if(!svg)throw new Error('No hay un diagrama renderizado.');data=svg}
 else if(request.format==='html'){if(!request.html)throw new Error('No hay contenido renderizado.');data=await autonomousHTML(request.html)}
 else{
  const window=exportWindow()
  try{
   const html=svg?`<style>body{margin:0}img{width:100%;height:100%;object-fit:contain}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`:request.html
   if(!html)throw new Error('No hay contenido para exportar.');await loadExportPage(window,html)
   if(request.format==='pdf')await window.webContents.executeJavaScript(`document.querySelectorAll('details').forEach(element=>element.open=true);true`)
   await window.webContents.executeJavaScript(`Promise.all([document.fonts.ready,...Array.from(document.images,i=>i.complete?Promise.resolve():new Promise((resolve,reject)=>{i.onload=resolve;i.onerror=()=>reject(new Error('Una imagen no pudo cargarse'))}))]).then(()=>true)`)
   if(request.format==='pdf'&&record.info.kind==='markdown'){
    const cover=reportMetadataOf(frontMatterOf(record.text).frontMatter??'').get('portada')==='true'
    // Los márgenes de Chromium permiten ocultar el pie sólo en la portada.
    const footer='@page{@bottom-center{content:counter(page) " / " counter(pages);font:9px Arial,sans-serif;color:#555}}'+(cover?'@page:first{@bottom-center{content:none}}':'')
    await window.webContents.executeJavaScript(`(()=>{const style=document.createElement('style');style.textContent=${JSON.stringify(footer)};document.head.append(style);return true})()`)
   }
   if(request.format==='pdf')data=await window.webContents.printToPDF({printBackground:true,preferCSSPageSize:!svg,pageSize:'A4',landscape:!!svg,...(record.info.kind==='markdown'?{displayHeaderFooter:false}:{})})
   else{if(!svg)throw new Error('PNG requiere un diagrama.');const png=await window.webContents.executeJavaScript(`(async()=>{const img=document.images[0];if(!img)throw new Error('Falta el diagrama');const source=new DOMParser().parseFromString(${JSON.stringify(svg)},'image/svg+xml').documentElement;const viewBox=(source.getAttribute('viewBox')||'').split(/[ ,]+/).map(Number);const w=viewBox.length===4?viewBox[2]:img.naturalWidth,h=viewBox.length===4?viewBox[3]:img.naturalHeight;const width=Math.ceil(w*2),height=Math.ceil(h*2);if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width>8192||height>8192||width*height>32000000)throw new Error('El PNG excede 8192 píxeles por lado o 32 megapíxeles. Exporta SVG.');const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');${record.info.kind==='mermaid'?"context.fillStyle='#fff';context.fillRect(0,0,width,height);":''}context.drawImage(img,0,0,width,height);return canvas.toDataURL('image/png')})()`);data=Buffer.from(png.split(',')[1],'base64')}

  }finally{window.destroy()}
 }
 validateSource?.()
 await atomicWrite(destination,data);return destination
}

async function exportDestination(source:string,format:string,analysis=false){
 const name=`${basename(source,extname(source))}${analysis?'.analisis':''}.${format}`
 let destination:string|undefined
 if(process.env.FREYALAB_TEST==='1'&&(process.env.FREYALAB_TEST_EXPORT_PATH||process.env.FREYALAB_TEST_EXPORT_DIR))destination=process.env.FREYALAB_TEST_EXPORT_PATH??join(process.env.FREYALAB_TEST_EXPORT_DIR!,name)
 else{const owner=BrowserWindow.getFocusedWindow()??BrowserWindow.getAllWindows()[0];const result=await dialog.showSaveDialog(owner,{title:t('dialog.export.title'),buttonLabel:t('dialog.save'),defaultPath:name,filters:[{name:format.toUpperCase(),extensions:[format]}]});if(result.canceled)return null;destination=result.filePath}
 if(!destination)return null
 return destination
}
async function validateDestination(docs:Documents,destination:string,format:string){
 if((await lstat(destination).catch(()=>null))?.isSymbolicLink())throw new Error('No se exporta sobre enlaces simbólicos.')
 const target=await realpath(destination).catch(()=>resolve(destination))
 for(const r of docs.records.values()){if(r.info.path&&target===(await realpath(r.info.path).catch(()=>resolve(r.info.path!))))throw new Error('Exporta a una ruta distinta de los archivos abiertos. Usa Guardar para modificar el original.')}
 if(extname(destination).toLowerCase()!==`.${format}`)throw new Error(`El destino debe terminar en .${format}.`)
}
export async function exportResult(docs:Documents,id:string,request:{format:'csv'|'json'|'md';content:string;context?:string},validate:()=>Promise<void>){
 if(Buffer.byteLength(request.content)>20*1024*1024||Buffer.byteLength(request.context??'')>20*1024*1024)throw new Error('El informe supera 20 MiB por archivo. Reduce el análisis.')
 const destination=await exportDestination(docs.get(id).info.name,request.format,true)
 if(!destination)return null
 await validate();await validateDestination(docs,destination,request.format)
 if(request.format!=='csv'){await validate();await atomicWrite(destination,request.content);return destination}
 if(!request.context)throw new Error('Falta el contexto JSON del CSV.')
 const companion=destination+'.contexto.json';await validateDestination(docs,companion,'json')
 const reserved=new Map<string,string>(),empty=createHash('sha256').update('').digest('hex')
 try{
  // Two files cannot be committed atomically together; reserve new names and roll back only our own bytes.
  for(const path of [destination,companion]){const handle=await open(path,'wx',0o600);reserved.set(path,empty);await handle.close()}
  for(const [path,content] of [[companion,request.context],[destination,request.content]]){await validate();await atomicWrite(path,content,empty);reserved.set(path,createHash('sha256').update(content).digest('hex'))}
  await validate();return destination
 }catch(error){
  const remaining:string[]=[]
  for(const [path,hash] of reserved)try{if(await digest(path)===hash)await unlink(path);else remaining.push(path)}catch(cleanup){if((cleanup as NodeJS.ErrnoException).code!=='ENOENT')remaining.push(path)}
  const message=(error as NodeJS.ErrnoException).code==='EEXIST'?'CSV y contexto requieren nombres nuevos. Elige otro nombre para conservar los archivos existentes.':(error as Error).message
  throw new Error(message+(remaining.length?' No se completó la pareja; revisa estos archivos que se conservaron: '+remaining.join(', '):''))
 }
}
