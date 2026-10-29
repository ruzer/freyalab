import {ChangeSet,EditorSelection,EditorState,MapMode,StateEffect,StateField,type Extension,type Transaction,type TransactionSpec} from '@codemirror/state'
import {invertedEffects} from '@codemirror/commands'
import {t} from '../../shared/i18n'

type Endings={types:Uint8Array;preferred:number}
type Overrides={positions:Uint32Array;types:Uint8Array}
const separators=['\n','\r\n','\r']
const restore=StateEffect.define<Overrides>({map(value,mapping){
 const positions:number[]=[],types:number[]=[]
 for(let i=0;i<value.positions.length;i++){const next=mapping.mapPos(value.positions[i],1,MapMode.TrackAfter);if(next!==null){positions.push(next);types.push(value.types[i])}}
 return positions.length?{positions:Uint32Array.from(positions),types:Uint8Array.from(types)}:undefined
}})
function invalid(){throw new Error(t('csvText.model.invalidState'))}
function parse(raw:string){
 let count=0;for(const _ of raw.matchAll(/\r\n|\r|\n/g))count++
 const types=new Uint8Array(count);let at=0
 const doc=raw.replace(/\r\n|\r|\n/g,ending=>{types[at++]=ending==='\r\n'?1:ending==='\r'?2:0;return'\n'})
 return{doc,types}
}
function positions(doc:string,from=0){
 let count=0;for(let at=doc.indexOf('\n');at>=0;at=doc.indexOf('\n',at+1))count++
 const result=new Uint32Array(count);let i=0
 for(let at=doc.indexOf('\n');at>=0;at=doc.indexOf('\n',at+1))result[i++]=from+at
 return result
}
function inserted(raw:string,from:number){const value=parse(raw);return{doc:value.doc,effects:restore.of({positions:positions(value.doc,from),types:value.types})}}
function nextEndings(value:Endings,tr:Transaction):Endings{
 const edits:{start:number;remove:number;add:number}[]=[];let length=value.types.length
 tr.changes.iterChanges((from,to,_fromB,_toB,text)=>{const start=tr.startState.doc.lineAt(from).number-1,remove=tr.startState.doc.lineAt(to).number-1-start,add=text.lines-1;if(remove||add){edits.push({start,remove,add});length+=add-remove}})
 let types=value.types,copied=false
 if(edits.length){
  types=new Uint8Array(length);copied=true;let read=0,write=0
  for(const edit of edits){if(edit.start<read)invalid();types.set(value.types.subarray(read,edit.start),write);write+=edit.start-read;types.fill(value.preferred,write,write+edit.add);write+=edit.add;read=edit.start+edit.remove}
  types.set(value.types.subarray(read),write)
 }
 for(const effect of tr.effects)if(effect.is(restore))for(let i=0;i<effect.value.positions.length;i++){
  const position=effect.value.positions[i],type=effect.value.types[i]
  if(position>=tr.newDoc.length||tr.newDoc.sliceString(position,position+1)!=='\n'||type>2)invalid()
  const index=tr.newDoc.lineAt(position).number-1
  if(types[index]!==type){if(!copied){types=types.slice();copied=true}types[index]=type}
 }
 if(types.length!==tr.newDoc.lines-1)invalid()
 return copied?{types,preferred:value.preferred}:value
}
export const csvLineEndings=StateField.define<Endings>({create:state=>({types:new Uint8Array(state.doc.lines-1),preferred:0}),update:nextEndings})

function inverse(tr:Transaction){
 const before=tr.startState.field(csvLineEndings).types,found=new Map<number,number>()
 tr.changes.iterChanges((from,to)=>{const start=tr.startState.doc.lineAt(from).number,end=tr.startState.doc.lineAt(to).number;for(let line=start;line<end;line++)found.set(tr.startState.doc.line(line).to,before[line-1])})
 // A visual CR+LF coalescence can change the type of a retained LF as well.
 for(const effect of tr.effects)if(effect.is(restore))for(let i=0;i<effect.value.positions.length;i++){
  const old=tr.changes.invertedDesc.mapPos(effect.value.positions[i],1,MapMode.TrackAfter)
  if(old!==null&&old<tr.startState.doc.length&&tr.startState.doc.sliceString(old,old+1)==='\n'){
   const type=before[tr.startState.doc.lineAt(old).number-1];if(type!==effect.value.types[i])found.set(old,type)
  }
 }
 return found.size?[restore.of({positions:Uint32Array.from(found.keys()),types:Uint8Array.from(found.values())})]:[]
}
function canonical(tr:Transaction):Transaction|readonly TransactionSpec[]{
 if(!tr.docChanged&&!tr.effects.some(effect=>effect.is(restore)))return tr
 const {types}=nextEndings(tr.startState.field(csvLineEndings),tr),changes:{from:number;to:number}[]=[],anchors:number[]=[],candidates=new Set<number>(),inserted=new Set<number>()
 tr.changes.iterChanges((_from,_to,from,to,text)=>{
  for(let line=1;line<text.lines;line++)inserted.add(from+text.line(line).to)
  for(let line=Math.max(0,tr.newDoc.lineAt(from).number-2),end=Math.min(types.length-2,tr.newDoc.lineAt(to).number-1);line<=end;line++)candidates.add(line)
 })
 for(const effect of tr.effects)if(effect.is(restore))for(const position of effect.value.positions)inserted.delete(position)
 const merged=new Set<number>()
 for(const i of candidates)if(!merged.has(i)&&types[i]===2&&types[i+1]===0){
  const first=tr.newDoc.line(i+1).to,second=tr.newDoc.line(i+2).to
  if(second!==first+1)continue
  // Enter creates a physical line; only an explicitly pasted CR+LF may coalesce.
  if(inserted.has(first)||inserted.has(second))anchors.push(inserted.has(first)?first:second)
  else{changes.push({from:second,to:second+1});anchors.push(first);merged.add(i+1)}
 }
 if(!anchors.length)return tr
 const fix=ChangeSet.of(changes.sort((a,b)=>a.from-b.from),tr.newDoc.length),mapped=anchors.map(position=>fix.mapPos(position,1))
 return[tr,{changes:fix,effects:restore.of({positions:Uint32Array.from(mapped),types:new Uint8Array(mapped.length).fill(1)}),sequential:true}]
}
export function csvTextDocument(raw:string):{doc:string;extensions:Extension[]}{
 const value=parse(raw)
 return{doc:value.doc,extensions:[csvLineEndings.init(()=>({types:value.types,preferred:value.types[0]??0})),invertedEffects.of(inverse),EditorState.transactionFilter.of(canonical)]}
}
export function csvTextRange(state:EditorState,from:number,to:number):string{
 const {types}=state.field(csvLineEndings);let index=state.doc.lineAt(from).number-1
 return state.doc.sliceString(from,to).replace(/\n/g,()=>separators[types[index++]])
}
export function csvTextValue(state:EditorState):string{return csvTextRange(state,0,state.doc.length)}
export function replaceCsvText(_state:EditorState,from:number,to:number,raw:string):TransactionSpec{
 const value=inserted(raw,from);return{changes:{from,to,insert:value.doc},effects:value.effects}
}
export function insertCsvText(state:EditorState,raw:string):TransactionSpec{
 return{...state.changeByRange(range=>{const value=inserted(raw,range.from);return{changes:{from:range.from,to:range.to,insert:value.doc},range:EditorSelection.cursor(range.from+value.doc.length),effects:value.effects}}),userEvent:'input.paste'}
}
