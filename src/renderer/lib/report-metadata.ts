import {yamlParts} from '../../shared/front-matter'
import type {Heading} from './render'
import type {Numbering,NumberedItem} from './remark-numbering'
export const escapeDocumentText=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))
const fields=new Set(['title','subtitle','author','date','institution','abstract','portada','toc','lof','lot'])
function scalar(value:string):string {
 value=(yamlParts(value,false)?.[0]??value).trim()
 if(value.startsWith('"')&&value.endsWith('"'))try{const parsed:unknown=JSON.parse(value);if(typeof parsed==='string')return parsed}catch{}
 if(value.startsWith("'")&&value.endsWith("'"))return value.slice(1,-1).replaceAll("''","'")
 return value
}
// shortcut: los escalares/listas de este reporte; YAML estructural requiere ampliar el contrato.
function metadataOf(frontMatter:string):Map<string,string|string[]> {
 const values=new Map<string,string|string[]>(),lines=frontMatter.split(/\r?\n/)
 for(let index=0;index<lines.length;index++){
  const match=/^([a-z]+)[ \t]*:[ \t]*(.*)$/.exec(lines[index]);if(!match||!fields.has(match[1]))continue
  const key=match[1],raw=match[2].trim()
  if(['portada','toc','lof','lot'].includes(key)){values.set(key,(yamlParts(raw,false)?.[0]??'').trim()==='true'?'true':'false');continue}
  if(/^[|>][-+]?$/.test(raw)){
   const collected:string[]=[]
   while(index+1<lines.length&&/^(?:[ \t]+|$)/.test(lines[index+1]))collected.push(lines[++index])
   const nonempty=collected.filter(line=>line.trim()),indent=nonempty.length?Math.min(...nonempty.map(line=>/^[ \t]*/.exec(line)![0].length)):0
   values.set(key,collected.map(line=>line.slice(indent)).join(raw.startsWith('>')?' ':'\n').trimEnd());continue
  }
  if(key==='author'){
   if(raw.startsWith('[')&&raw.endsWith(']')){values.set(key,(yamlParts(raw.slice(1,-1),true)??[]).map(scalar));continue}
   if(!raw){
    const authors:string[]=[]
    while(index+1<lines.length){const item=/^[ \t]*-[ \t]+(.*)$/.exec(lines[index+1]);if(!item)break;index++;authors.push(scalar(item[1]))}
    values.set(key,authors);continue
   }
  }
  values.set(key,scalar(raw))
 }
 return values
}
export function reportHeader(frontMatter:string|undefined,headings:Heading[],numbering:Numbering):string {
 if(frontMatter===undefined)return''
 const values=metadataOf(frontMatter),enabled=(key:string)=>values.get(key)==='true'
 const text=(key:string)=>{const value=values.get(key);return escapeDocumentText(Array.isArray(value)?value.join(', '):value??'')}
 const labels:Record<string,[string,string,string,string,string]>={es:['Documento','Contenido','Índice de figuras','Índice de tablas','Resumen'],en:['Document','Contents','List of figures','List of tables','Abstract'],fr:['Document','Sommaire','Liste des figures','Liste des tableaux','Résumé'],pt:['Documento','Sumário','Lista de figuras','Lista de tabelas','Resumo'],de:['Dokument','Inhalt','Abbildungsverzeichnis','Tabellenverzeichnis','Zusammenfassung'],it:['Documento','Indice','Elenco delle figure','Elenco delle tabelle','Sommario']}
 const[document,toc,figures,tables,abstract]=(labels[numbering.language]??labels.es).map(escapeDocumentText)
 let html=''
 if(enabled('portada')){
  html=`<section class="report-cover"><h1>${text('title')||document}</h1>`
  for(const key of ['subtitle','author','date','institution'])if(text(key))html+=`<p class="report-${key}">${text(key)}</p>`
  if(text('abstract'))html+=`<section class="report-abstract"><h2>${abstract}</h2><p>${text('abstract')}</p></section>`
  html+='</section>'
 }
 const index=(key:string,title:string,kind:string,items:{id:string;text:string;level?:number}[])=>{
  if(!enabled(key)||!items.length)return
  html+=`<nav class="report-index ${kind}" aria-label="${title}"><h2>${title}</h2><ol>${items.map(item=>`<li class="report-level-${item.level??1}"><a href="#${escapeDocumentText(item.id)}">${escapeDocumentText(item.text)}</a></li>`).join('')}</ol></nav>`
 }
 const captions=(items:NumberedItem[])=>items.map(item=>({id:item.id,text:`${item.label}. ${item.caption}`}))
 index('toc',toc,'report-toc',headings);index('lof',figures,'report-figures',captions(numbering.figures));index('lot',tables,'report-tables',captions(numbering.tables))
 return html
}
