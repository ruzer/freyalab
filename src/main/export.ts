import { BrowserWindow, dialog, app } from 'electron'
import { readFile, readdir, realpath, lstat, open, unlink } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sanitize from 'sanitize-html'
import {createHash} from 'node:crypto'
import { atomicWrite,digest } from './files'
import type { Documents } from './documents'
import type { ExportRequest,GraphicExportRequest } from '../shared/types'
const CSP="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; object-src 'none'; base-uri 'none'"
const svgTags=['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','defs','marker','clipPath','mask','linearGradient','radialGradient','stop','title','desc','style','use','symbol','image','foreignObject','div','span','p','br']
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
 for(const match of urls){const url=match[1];if(url.startsWith('data:'))continue;const base=basename(url.split(/[?#]/)[0]);const found=files.find(f=>f===base)||files.find(f=>f.startsWith(base.replace(/\.[^.]+$/,''))&&/\.(woff2?|ttf)$/.test(f));let replacement='';if(found){const mime=found.endsWith('.woff2')?'font/woff2':found.endsWith('.woff')?'font/woff':'font/ttf';replacement=`data:${mime};base64,${(await readFile(join(assets,found))).toString('base64')}`}html=html.split(match[0]).join(`url('${replacement}')`)}
 const bundledFonts=await embeddedFonts(files)
 const cleaned=sanitize(html,{allowedTags:[...sanitize.defaults.allowedTags,...svgTags,'html','head','body','meta','style','img','input','details','summary'],allowedAttributes:{'*':['class','id','style','title','role','aria-label','aria-hidden','width','height','viewBox','xmlns','d','transform','fill','stroke','stroke-width','points','x','y','x1','x2','y1','y2','dx','dy','rx','ry','r','cx','cy','opacity','text-anchor','dominant-baseline','font-size','font-family','font-weight','marker-end','marker-start','orient','refX','refY','markerWidth','markerHeight','href','clip-path','preserveAspectRatio'],details:['open'],a:['data-footnote-ref','data-footnote-backref','aria-describedby'],section:['data-footnotes'],span:['data-seccion-faltante'],img:['src','alt','width','height'],input:['type','checked','disabled'],meta:['charset']},allowedSchemes:['data'],allowProtocolRelative:false,allowVulnerableTags:true,parser:{lowerCaseTags:false,lowerCaseAttributeNames:false}})
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><style>${bundledFonts}@page{size:A4;margin:18mm}body{font:14px Inter,system-ui;color:#171717;background:white;line-height:1.6}img,svg{max-width:100%}pre{white-space:pre-wrap}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:6px}tr,pre,blockquote,.mermaid{break-inside:avoid}thead{display:table-header-group}</style></head><body>${cleaned}</body></html>`
}
export async function exportDocument(docs:Documents,id:string,request:ExportRequest){
 const record=docs.get(id);if(record.info.readonly)throw new Error('No se exporta un archivo completo desde una muestra limitada.')
 return writeExport(docs,id,request)
}
export async function exportGraphic(docs:Documents,id:string,request:GraphicExportRequest){
 const validateGraphic=()=>{const record=docs.get(id);if(record.info.kind!=='csv')throw new Error('La exportación de gráficos requiere un CSV abierto.');if(record.info.revision!==request.revision)throw new Error('La fuente cambió. Genera de nuevo el gráfico antes de exportar.')}
 validateGraphic()
 return writeExport(docs,id,request,validateGraphic)
}
async function writeExport(docs:Documents,id:string,request:ExportRequest,validateGraphic?:()=>void){
 const record=docs.get(id),destination=await exportDestination(record.info.name,request.format)
 if(!destination)return null
 validateGraphic?.()
 await validateDestination(docs,destination,request.format)
 const svg=request.svg&&['svg','png','pdf'].includes(request.format)?await autonomousSVG(request.svg):undefined
 let data:Buffer|string
 if(request.format==='csv'||request.format==='tsv'){if(record.info.kind!=='csv')throw new Error('Exportación tabular requiere CSV/TSV.');data=Buffer.from(await docs.table.call('serialize',id,{...request.table,delimiter:request.format==='tsv'?'\t':','}))}
 else if(request.format==='svg'){if(!svg)throw new Error('No hay un diagrama renderizado.');data=svg}
 else if(request.format==='html'){if(!request.html)throw new Error('No hay contenido renderizado.');data=await autonomousHTML(request.html)}
 else{
  const window=new BrowserWindow({show:false,width:1200,height:900,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,javascript:true,partition:`export-${Date.now()}`}})
  window.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('data:')}))
  try{
   const html=svg?`<style>body{margin:0}img{width:100%;height:100%;object-fit:contain}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`:request.html
   if(!html)throw new Error('No hay contenido para exportar.');const document=await autonomousHTML(html)
   // Embedded images can exceed Chromium's navigation URL limit.
   await window.loadURL('data:text/html,<!doctype html>')
   await window.webContents.executeJavaScript(`document.open();document.write(${JSON.stringify(document)});document.close();true`)
   if(request.format==='pdf')await window.webContents.executeJavaScript(`document.querySelectorAll('details').forEach(element=>element.open=true);true`)
   await window.webContents.executeJavaScript(`Promise.all([document.fonts.ready,...Array.from(document.images,i=>i.complete?Promise.resolve():new Promise((resolve,reject)=>{i.onload=resolve;i.onerror=()=>reject(new Error('Una imagen no pudo cargarse'))}))]).then(()=>true)`)
   if(request.format==='pdf')data=await window.webContents.printToPDF({printBackground:true,preferCSSPageSize:!svg,pageSize:'A4',landscape:!!svg})
   else{if(!svg)throw new Error('PNG requiere un diagrama.');const png=await window.webContents.executeJavaScript(`(async()=>{const img=document.images[0];if(!img)throw new Error('Falta el diagrama');const source=new DOMParser().parseFromString(${JSON.stringify(svg)},'image/svg+xml').documentElement;const viewBox=(source.getAttribute('viewBox')||'').split(/[ ,]+/).map(Number);const w=viewBox.length===4?viewBox[2]:img.naturalWidth,h=viewBox.length===4?viewBox[3]:img.naturalHeight;const width=Math.ceil(w*2),height=Math.ceil(h*2);if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width>8192||height>8192||width*height>32000000)throw new Error('El PNG excede 8192 píxeles por lado o 32 megapíxeles. Exporta SVG.');const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');${record.info.kind==='mermaid'?"context.fillStyle='#fff';context.fillRect(0,0,width,height);":''}context.drawImage(img,0,0,width,height);return canvas.toDataURL('image/png')})()`);data=Buffer.from(png.split(',')[1],'base64')}

  }finally{window.destroy()}
 }
 validateGraphic?.()
 await atomicWrite(destination,data);return destination
}

async function exportDestination(source:string,format:string,analysis=false){
 const name=`${basename(source,extname(source))}${analysis?'.analisis':''}.${format}`
 let destination:string|undefined
 if(process.env.FREYALAB_TEST==='1'&&(process.env.FREYALAB_TEST_EXPORT_PATH||process.env.FREYALAB_TEST_EXPORT_DIR))destination=process.env.FREYALAB_TEST_EXPORT_PATH??join(process.env.FREYALAB_TEST_EXPORT_DIR!,name)
 else{const owner=BrowserWindow.getFocusedWindow()??BrowserWindow.getAllWindows()[0];const result=await dialog.showSaveDialog(owner,{defaultPath:name,filters:[{name:format.toUpperCase(),extensions:[format]}]});if(result.canceled)return null;destination=result.filePath}
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
