import {copyAnalysisFragments,type AnalysisCopyFragment} from '../../shared/analysis-number-format'

// One listener per workspace. Hidden workspaces remain mounted, so the selection
// and visibility checks below must pass before any clipboard data is replaced.
export function copyAnalysisNumbers(root:HTMLElement){
 const document=root.ownerDocument
 const listener=(event:ClipboardEvent)=>copyAnalysisSelection(event,root)
 document.addEventListener('copy',listener)
 return{destroy:()=>document.removeEventListener('copy',listener)}
}

export function copyAnalysisSelection(event:ClipboardEvent,root:HTMLElement):void{
 if(event.defaultPrevented||!event.isTrusted||!event.clipboardData||!root.isConnected||!root.getClientRects().length||root.closest('[hidden]'))return
 const document=root.ownerDocument,window=document.defaultView
 if(!window||window.getComputedStyle(root).visibility!=='visible')return
 const target=event.target instanceof Element?event.target:null
 const controls='input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"]'
 if(target?.closest(controls)||document.activeElement?.closest(controls))return
 const selection=window.getSelection()
 if(!selection||selection.rangeCount!==1||selection.isCollapsed)return
 const original=selection.getRangeAt(0).cloneRange()
 if(!root.contains(original.startContainer)||!root.contains(original.endContainer))return
 const numbers=Array.from(root.querySelectorAll<HTMLElement>('[data-analysis-value]')).flatMap(node=>{
  if(!node.getClientRects().length||node.closest('[hidden]')||window.getComputedStyle(node).visibility!=='visible'||!original.intersectsNode(node))return[]
  if(!node.dataset.analysisValue)return[]
  const value=node.dataset.analysisValue
  if(!Number.isFinite(Number(value)))return[]
  const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT),text:Node[]=[]
  while(walker.nextNode())if(walker.currentNode.textContent?.length)text.push(walker.currentNode)
  if(!text.length)return[]
  const bounds=document.createRange();bounds.setStart(text[0],0);bounds.setEnd(text.at(-1)!,text.at(-1)!.textContent!.length)
  const overlap=original.cloneRange()
  if(overlap.compareBoundaryPoints(Range.START_TO_START,bounds)<0)overlap.setStart(bounds.startContainer,bounds.startOffset)
  if(overlap.compareBoundaryPoints(Range.END_TO_END,bounds)>0)overlap.setEnd(bounds.endContainer,bounds.endOffset)
  return overlap.collapsed||!overlap.toString()?[]:[{overlap,value,unit:node.dataset.analysisUnit??''}]
 })
 if(!numbers.length)return
 const anchor=selection.anchorNode,anchorOffset=selection.anchorOffset,focus=selection.focusNode,focusOffset=selection.focusOffset
 const parts:AnalysisCopyFragment[]=[]
 let cursor:Node=original.startContainer,offset=original.startOffset
 const visible=(range:Range)=>{
  if(range.collapsed)return''
  // Selection preserves the rendered tabs/newlines of tables; Range.toString()
  // only concatenates text nodes. Restore the original selection synchronously.
  selection.removeAllRanges();selection.addRange(range)
  return selection.toString()
 }
 try{
  for(const number of numbers){
   const gap=document.createRange();gap.setStart(cursor,offset);gap.setEnd(number.overlap.startContainer,number.overlap.startOffset)
   parts.push({kind:'text',text:visible(gap)},{kind:'number',value:number.value,unit:number.unit})
   cursor=number.overlap.endContainer;offset=number.overlap.endOffset
  }
  const tail=document.createRange();tail.setStart(cursor,offset);tail.setEnd(original.endContainer,original.endOffset)
  parts.push({kind:'text',text:visible(tail)})
 }finally{
  selection.removeAllRanges()
  if(anchor?.isConnected&&focus?.isConnected)selection.setBaseAndExtent(anchor,anchorOffset,focus,focusOffset)
  else selection.addRange(original)
 }
 event.clipboardData.setData('text/plain',copyAnalysisFragments(parts))
 event.preventDefault()
}
