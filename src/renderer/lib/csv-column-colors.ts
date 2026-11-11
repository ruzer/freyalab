import {findColumn,StateEffect,StateField,type EditorState,type Text} from '@codemirror/state'
import {Decoration,EditorView,ViewPlugin,type DecorationSet,type ViewUpdate} from '@codemirror/view'
import {HighlightStyle,ParseContext,StreamLanguage,syntaxTree} from '@codemirror/language'
import {Tag,highlightTree} from '@lezer/highlight'

type CsvState={column:number;quoted:boolean}
type Part={to:number;column:number;kind:'field'|'escape'|'quote'|'separator'}
export type CsvColumnPosition={column:number;total:number;name?:string;extra:boolean}
const initial:CsvState={column:0,quoted:false}
const checkpointLines=128
// shortcut: CodeMirror detiene StreamLanguage después de 10 000 caracteres de línea; mantener el estado sin colorear esa línea.
const longLine=10_000

function part(text:string,from:number,delimiter:string,state:CsvState):Part{
 const column=state.column,char=text[from]
 if(state.quoted){
  if(char==='"'){
   if(text[from+1]==='"')return{to:from+2,column,kind:'escape'}
   state.quoted=false;return{to:from+1,column,kind:'quote'}
  }
  const quote=text.indexOf('"',from+1)
  return{to:quote<0?text.length:quote,column,kind:'field'}
 }
 if(char===delimiter){state.column++;return{to:from+1,column,kind:'separator'}}
 if(char==='"'&&(from===0||text[from-1]===delimiter)){
  state.quoted=true;return{to:from+1,column,kind:'quote'}
 }
 const end=text.indexOf(delimiter,from+1)
 return{to:end<0?text.length:end,column,kind:'field'}
}
function scan(text:string,delimiter:string,state:CsvState,visit?:(from:number,token:Part)=>void|false,end=text.length){
 for(let from=0;from<end;){
  const token=part(text,from,delimiter,state)
  if(visit?.(from,token)===false)break
  from=token.to
 }
}
function nextLine(state:CsvState){if(!state.quoted)state.column=0}

class CsvLines{
 private last={line:1,state:initial}
 private header?:{width:number;names:Map<number,string>}
 constructor(readonly doc:Text,readonly delimiter:string,private checkpoints:CsvState[]=[initial]){}
 changed(doc:Text,first:number){
  return new CsvLines(doc,this.delimiter,this.checkpoints.slice(0,Math.floor((first-1)/checkpointLines)+1))
 }
 before(line:number):CsvState{
  const slot=Math.min(Math.floor((line-1)/checkpointLines),this.checkpoints.length-1)
  let from=slot*checkpointLines+1
  let start=this.checkpoints[slot]
  if(this.last.line>=from&&this.last.line<=line){from=this.last.line;start=this.last.state}
  const state={...start}
  if(from<line){
   const cursor=this.doc.iterLines(from,line)
   while(!cursor.next().done){
    const text=cursor.value
    if(state.quoted||text.includes('"'))scan(text,this.delimiter,state)
    nextLine(state)
    if((++from-1)%checkpointLines===0)this.checkpoints[(from-1)/checkpointLines]={...state}
   }
  }
  this.last={line,state}
  return{...state}
 }
 columnAt(head:number){
  const line=this.doc.lineAt(head),state=this.before(line.number)
  scan(line.text,this.delimiter,state,undefined,head-line.from)
  return state.column
 }
 firstRecord(){
  if(this.header)return this.header
  const state={...initial},names=new Map<number,string>(),lines=this.doc.iterLines()
  do{
   if(lines.next().done)break
   const text=lines.value
   scan(text,this.delimiter,state,(from,token)=>{
    if(token.kind!=='field'&&token.kind!=='escape')return
    const name=names.get(token.column)??''
    // shortcut: la barra muestra un fragmento de nombres excepcionalmente largos, sin copiar el registro completo.
    if(name.length<160&&from<10000)names.set(token.column,name+(token.kind==='escape'?'"':text.slice(from,Math.min(token.to,from+160-name.length))))
   })
   if(state.quoted&&names.has(state.column)&&names.get(state.column)!.length<160)names.set(state.column,names.get(state.column)+'\n')
  }while(state.quoted)
  return this.header={width:state.column+1,names}
 }
 position(head:number,header:boolean):CsvColumnPosition{
  const column=this.columnAt(head)+1,first=this.firstRecord()
  if(header)return{column,total:first.width,name:first.names.get(column-1),extra:column>first.width}
  const line=this.doc.lineAt(head),state=this.before(line.number)
  scan(line.text,this.delimiter,state)
  return{column,total:Math.max(first.width,state.column+1),extra:false}
 }
}

const fields=Array.from({length:6},(_,i)=>'csvField'+(i+1))
const muted='csvMuted'
const tags=Object.fromEntries([...fields,muted].map(name=>[name,Tag.define()]))
const highlight=HighlightStyle.define([
 ...fields.map((name,i)=>({tag:tags[name],class:'csv-column-'+(i+1)})),
 {tag:tags[muted],class:'csv-column-muted'}
])
const marks=new Map([...fields.map((_,i)=>'csv-column-'+(i+1)),'csv-column-muted'].map(className=>[className,Decoration.mark({class:className})]))
const current=Decoration.mark({class:'csv-current-column'}),headerLine=Decoration.line({class:'csv-header-line'})
const redraw=StateEffect.define<null>()

export function csvColumnExtensions(delimiter:string,header:boolean,colors:boolean,publish:(position:CsvColumnPosition)=>void){
 const index=StateField.define<CsvLines>({
  create:state=>new CsvLines(state.doc,delimiter),
  update:(lines,tr)=>{
   if(!tr.docChanged)return lines
   let first=tr.startState.doc.lines
   tr.changes.iterChangedRanges(from=>{first=Math.min(first,tr.startState.doc.lineAt(from).number)})
   return lines.changed(tr.newDoc,first)
  }
 })
 const parser=StreamLanguage.define<CsvState>({
  tokenTable:tags,
  startState:()=>{
   const context=ParseContext.get()
   // shortcut: StreamLanguage reinicia el estado al saltar 100 kB al viewport, revisar al actualizar CodeMirror.
   return context&&context.viewport.from>100_000?context.state.field(index).before(context.state.doc.lineAt(context.viewport.from).number):{...initial}
  },
  blankLine:nextLine,
  token(stream,state){
   if(stream.sol()&&stream.string.length>longLine){
    if(state.quoted||stream.string.includes('"'))scan(stream.string,delimiter,state)
    stream.skipToEnd();nextLine(state);return null
   }
   const token=part(stream.string,stream.pos,delimiter,state)
   stream.pos=token.to
   if(stream.eol())nextLine(state)
   return token.kind==='quote'||token.kind==='separator'?muted:fields[token.column%fields.length]
  }
 })
 class CsvColumnView{
  decorations:DecorationSet
  private window={from:0,to:256}
  private destroyed=false
  constructor(view:EditorView){this.decorations=this.draw(view);this.position(view.state);this.measure(view)}
  private position(state:EditorState){publish(state.field(index).position(state.selection.main.head,header))}
  private measure(view:EditorView){
   if(!colors)return
   view.requestMeasure({
    key:this,
    read:()=>{
     const {scrollLeft,clientWidth}=view.scrollDOM,width=view.defaultCharacterWidth||8
     // shortcut: estimar el tramo horizontal con margen para el gutter y glifos anchos, medir posiciones si cambia la fuente.
     return{from:Math.max(0,Math.floor(scrollLeft/width/2)-24),to:Math.ceil((scrollLeft+clientWidth)/width)+24}
    },
    write:next=>{
     if(next.from===this.window.from&&next.to===this.window.to)return
     this.window=next
     queueMicrotask(()=>{if(!this.destroyed)view.dispatch({effects:redraw.of(null)})})
    }
   })
  }
  private draw(view:EditorView):DecorationSet{
   const ranges=[]
   if(header&&view.visibleRanges.some(range=>range.from===0))ranges.push(headerLine.range(0))
   if(!colors)return Decoration.set(ranges)
   const model=view.state.field(index),column=model.columnAt(view.state.selection.main.head),tree=syntaxTree(view.state)
   for(const range of view.visibleRanges){
    for(let pos=range.from;pos<range.to;){
     const line=view.state.doc.lineAt(pos)
     pos=line.to+1
     if(line.length>longLine)continue
     const from=Math.max(range.from,view.lineWrapping?line.from:line.from+findColumn(line.text,this.window.from,view.state.tabSize))
     const to=Math.min(range.to,view.lineWrapping?line.to:line.from+findColumn(line.text,this.window.to,view.state.tabSize))
     if(from>=to)continue
     highlightTree(tree,highlight,(a,b,style)=>{const mark=marks.get(style);if(mark)ranges.push(mark.range(a,b))},from,to)
     const state=model.before(line.number)
     let left=-1,right=-1
     scan(line.text,delimiter,state,(start,token)=>{
      if(token.column>column)return false
      if(token.column===column&&token.kind!=='separator'){if(left<0)left=start;right=token.to}
     })
     if(left>=0){const a=Math.max(from,line.from+left),b=Math.min(to,line.from+right);if(a<b)ranges.push(current.range(a,b))}
    }
   }
   return Decoration.set(ranges,true)
  }
  update(update:ViewUpdate){
   if(update.geometryChanged)this.measure(update.view)
   if(update.docChanged||update.selectionSet||update.viewportChanged||update.geometryChanged||
    syntaxTree(update.startState)!==syntaxTree(update.state)||update.transactions.some(tr=>tr.effects.some(effect=>effect.is(redraw))))
    this.decorations=this.draw(update.view)
   if(update.docChanged||update.selectionSet)this.position(update.state)
  }
  destroy(){this.destroyed=true}
  scroll(view:EditorView){this.measure(view)}
 }
 return [index,...colors?[parser]:[],ViewPlugin.fromClass(CsvColumnView,{
  decorations:plugin=>plugin.decorations,
  eventObservers:{scroll(_event,view){this.scroll(view)}}
 })]
}
