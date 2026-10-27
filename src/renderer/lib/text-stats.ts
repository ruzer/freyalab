import {markdownLanguage} from '@codemirror/lang-markdown'
import {frontMatterOf} from '../../shared/front-matter'

export type TextSelection={from:number;to:number}
export interface PreparedTextStats {words:number;reading:string;language:string;textLF:string;ranges:TextSelection[]}
const excludedTypes=new Set(['FencedCode','CodeBlock','ListMark','TaskMarker'])

function languageOf(frontMatter:string|undefined):string {
 const match=/^lang[ \t]*:[ \t]*(?:"([^"\n]*)"|'([^'\n]*)'|([^#\n]*))[ \t]*(?:#.*)?$/m.exec(frontMatter??'')
 const scalar=(match?.[1]??match?.[2]??match?.[3]??'').trim()
 if(!scalar)return'es'
 try{return Intl.Segmenter.supportedLocalesOf(Intl.getCanonicalLocales(scalar))[0]??'es'}catch{return'es'}
}

function* wordsInRanges(text:string,ranges:TextSelection[],language:string):Generator<void,number> {
 const segmenter=new Intl.Segmenter(language,{granularity:'word'})
 let words=0,work=0
 for(const range of ranges){
  let from=range.from
  while(from<range.to){
   const newline=text.indexOf('\n',from),to=newline<0?range.to:Math.min(newline,range.to)
   for(const segment of segmenter.segment(text.slice(from,to))){
    if(segment.isWordLike)words++
    if(++work%512===0)yield
   }
   if(++work%512===0)yield
   from=to+1
  }
 }
 return words
}

export function* prepareTextStats(source:string,markdown=true):Generator<void,PreparedTextStats> {
 const {body,frontMatter}=markdown?frontMatterOf(source):{body:source,frontMatter:undefined},rawFrom=source.length-body.length
 const textLF=source.replace(/\r\n?/g,'\n'),bodyFrom=rawFrom-(source.slice(0,rawFrom).match(/\r\n/g)?.length??0),language=languageOf(frontMatter)
 const ranges:TextSelection[]=[]
 let from=bodyFrom
 if(markdown){
  const parsing=markdownLanguage.parser.startParse(textLF.slice(bodyFrom))
  let tree=parsing.advance()
  while(!tree){yield;tree=parsing.advance()}
  const cursor=tree.cursor();let visits=0
  do{
   // Los números de lista y [x] son marcadores, no palabras de la prosa.
   const excluded=excludedTypes.has(cursor.name)
   if(excluded){const start=bodyFrom+cursor.from,end=bodyFrom+cursor.to;if(start>from)ranges.push({from,to:start});from=Math.max(from,end)}
   if(++visits%256===0)yield
   if(!cursor.next(!excluded))break
  }while(true)
 }
 if(from<textLF.length)ranges.push({from,to:textLF.length})
 const words=yield* wordsInRanges(textLF,ranges,language)
 return{words,reading:words<200?'< 1 min':`${Math.ceil(words/200)} min`,language,textLF,ranges}
}

export function* countSelectedWords(prepared:PreparedTextStats,selection:TextSelection):Generator<void,number> {
 const from=Math.max(0,Math.min(selection.from,selection.to)),to=Math.min(prepared.textLF.length,Math.max(selection.from,selection.to))
 const ranges=prepared.ranges.map(range=>({from:Math.max(from,range.from),to:Math.min(to,range.to)})).filter(range=>range.from<range.to)
 return yield* wordsInRanges(prepared.textLF,ranges,prepared.language)
}
