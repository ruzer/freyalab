import type {CompletionContext,CompletionResult} from '@codemirror/autocomplete'
import {syntaxTree,syntaxTreeAvailable} from '@codemirror/language'
import type {BibliographyEntry} from '../../shared/bibliography'

export async function completeCitations(context:CompletionContext,load:()=>Promise<readonly BibliographyEntry[]>):Promise<CompletionResult|null>{
 if(context.state.readOnly||context.aborted)return null
 const match=context.matchBefore(/\[@[\p{L}\p{N}_.:/-]*$/u)
 if(!match||!syntaxTreeAvailable(context.state,context.pos))return null
 const line=context.state.doc.lineAt(match.from),relative=match.from-line.from
 let previous=relative-1;while(line.text[previous]==='\\')previous--
 if((relative-previous-1)%2)return null
 for(let node=syntaxTree(context.state).resolveInner(match.from,1);node;node=node.parent!)if(/Code|Link|URL/.test(node.name))return null
 let entries:readonly BibliographyEntry[]
 try{entries=await load()}catch{return null}
 if(context.aborted)return null
 const suffix=context.state.sliceDoc(context.pos,context.pos+1)===']'?'':']'
 const options=entries.filter(entry=>/^[\p{L}\p{N}_][\p{L}\p{N}_.:/-]*$/u.test(String(entry.id))&&!/^(?:fig|tbl):/.test(String(entry.id))).map(entry=>({label:String(entry.id),detail:entry.title,apply:String(entry.id)+suffix}))
 return options.length?{from:match.from+2,options,validFor:/^[\p{L}\p{N}_.:/-]*$/u}:null
}
