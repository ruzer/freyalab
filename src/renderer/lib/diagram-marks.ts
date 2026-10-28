import {StateEffect,StateField,RangeSet,type Extension} from '@codemirror/state'
import {Decoration,EditorView,GutterMarker,gutter,showTooltip} from '@codemirror/view'
import type {DiagramError} from './diagram-errors'
export type DiagramMark={line:number;error:DiagramError}
export type DiagramDiagnostics={source:string;generation:number;marks:DiagramMark[];errors?:DiagramError[]}
export const setDiagramMarks=StateEffect.define<DiagramDiagnostics>()
export const diagramMarks=StateField.define({
 create:()=>({generation:-1,marks:[] as DiagramMark[],decorations:Decoration.none}),
 update(value,transaction){
  if(transaction.docChanged)value={generation:value.generation,marks:[],decorations:Decoration.none}
  for(const effect of transaction.effects)if(effect.is(setDiagramMarks)&&effect.value.generation>=value.generation&&effect.value.source===transaction.state.sliceDoc()){
   const marks=effect.value.marks.filter(mark=>Number.isSafeInteger(mark.line)&&mark.line>0&&mark.line<=transaction.state.doc.lines)
   const decorations=Decoration.set(marks.map(mark=>Decoration.line({class:'cm-diagram-error',attributes:{'data-diagram-line':String(mark.line)}}).range(transaction.state.doc.line(mark.line).from)),true)
   value={generation:effect.value.generation,marks,decorations}
  }
  return value
 },
 provide:field=>EditorView.decorations.from(field,value=>value.decorations),
})
class ErrorMarker extends GutterMarker{
 constructor(readonly label:string){super()}
 eq(other:ErrorMarker){return this.label===other.label}
 toDOM(){const node=document.createElement('span');node.textContent='⚠';node.setAttribute('role','img');node.setAttribute('aria-label',this.label);node.title=this.label;return node}
}
export const diagramMarkExtensions:Extension=[diagramMarks,
 gutter({class:'cm-diagram-gutter',markers:view=>{
  const marks=view.state.field(diagramMarks).marks
  return RangeSet.of(marks.map(mark=>new ErrorMarker(`Error de diagrama. ${mark.error.title} ${mark.error.hint}`).range(view.state.doc.line(mark.line).from)),true)
 },lineMarkerChange:update=>update.startState.field(diagramMarks)!==update.state.field(diagramMarks)}),
 showTooltip.compute([diagramMarks,'selection'],state=>{
  const line=state.doc.lineAt(state.selection.main.head),mark=state.field(diagramMarks).marks.find(mark=>mark.line===line.number)
  return mark?{pos:line.from,above:false,strictSide:true,create:()=>{const dom=document.createElement('div');dom.className='cm-tooltip-diagram';dom.textContent=`${mark.error.title} ${mark.error.hint}`;return{dom}}}:null
 }),
 EditorView.theme({'.cm-diagram-error':{backgroundColor:'var(--diagram-error-bg)'},'.cm-diagram-gutter .cm-gutterElement':{padding:'0 3px'},'.cm-diagram-gutter span':{color:'var(--diagram-error-ink)',backgroundColor:'var(--diagram-error-bg)'},'.cm-tooltip-diagram':{padding:'6px 10px',maxWidth:'32em',whiteSpace:'normal',color:'var(--diagram-error-ink)',backgroundColor:'var(--diagram-error-bg)'}}),
]
