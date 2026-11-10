import {countColumn,type EditorState} from '@codemirror/state'

export function editorPosition(state:EditorState){
 const {doc,selection}=state,head=selection.main.head,line=doc.lineAt(head)
 let characters=0,lines=0,previousEnd=0
 for(const {from,to,empty} of selection.ranges){
  if(empty)continue
  const first=doc.lineAt(from).number,last=doc.lineAt(to-1).number
  lines+=last-Math.max(previousEnd+1,first)+1;previousEnd=last
  const cursor=doc.iterRange(from,to)
  while(!cursor.next().done)characters+=countColumn(cursor.value,1)
 }
 return{line:line.number,column:countColumn(line.text,state.tabSize,head-line.from)+1,selection:lines?{lines,characters}:null}
}
