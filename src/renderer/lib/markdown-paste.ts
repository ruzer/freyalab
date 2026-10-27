import type {EditorState} from '@codemirror/state'
import {syntaxTree,syntaxTreeAvailable} from '@codemirror/language'
import type {MarkdownChange} from './markdown-commands'

const escape=(value:string)=>value.replace(/[\\[\]()]/g,'\\$&')
const referenceLabel=(value:string)=>value.trim().replace(/[ \t\r\n]+/g,' ').toLowerCase().toUpperCase()

export function markdownLinkOnPaste(state:EditorState,clipboard:string):MarkdownChange|undefined {
 const {main,ranges}=state.selection,{from,to}=main
 if(state.readOnly||ranges.length!==1||main.empty||state.doc.lineAt(from).number!==state.doc.lineAt(to).number)return
 if(!/^(?:https?:\/\/|mailto:)/i.test(clipboard)||/[\s\p{Cc}\p{Cf}]/u.test(clipboard))return
 try{const url=new URL(clipboard);if(!['http:','https:','mailto:'].includes(url.protocol)||url.protocol==='mailto:'&&!url.pathname)return}catch{return}
 if(!syntaxTreeAvailable(state,to))return
 const tree=syntaxTree(state),shortcuts=new Set<string>()
 let blocked=false
 tree.iterate({from,to,enter(node){
  if(node.from>=to||node.to<=from)return false
  if(/^(?:InlineCode|FencedCode|CodeBlock|Image|Autolink|URL|LinkReference|HTMLTag|HTMLBlock|CommentBlock|ProcessingInstructionBlock)$/.test(node.name)){blocked=true;return false}
  if(node.name==='Link'){
   if(node.node.getChild('URL')||node.node.getChild('LinkLabel'))blocked=true
   else shortcuts.add(referenceLabel(state.doc.sliceString(node.from+1,node.to-1)))
   return false
  }
 }})
 if(blocked)return
 if(shortcuts.size){
  // Lezer también llama Link a [texto] sin definición: solo se bloquea si existe su referencia.
  if(!syntaxTreeAvailable(state,state.doc.length))return
  tree.iterate({enter(node){
   if(node.name==='LinkReference'){
    const label=node.node.getChild('LinkLabel')
    if(label&&shortcuts.has(referenceLabel(state.doc.sliceString(label.from+1,label.to-1))))blocked=true
    return false
   }
  }})
  if(blocked)return
 }
 const line=state.doc.lineAt(from)
 for(const match of line.text.matchAll(/(?:https?:\/\/|mailto:|www\.)[^\s<>]+/gi))if(line.from+match.index<to&&line.from+match.index+match[0].length>from)return
 const insert=`[${escape(state.doc.sliceString(from,to))}](${escape(clipboard)})`,end=from+insert.length
 return{changes:[{from,to,insert}],selection:{anchor:end,head:end}}
}
