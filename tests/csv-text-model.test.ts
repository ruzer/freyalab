import {expect,it} from 'vitest'
import {EditorState,EditorSelection,Transaction} from '@codemirror/state'
import {history,undo,redo,isolateHistory} from '@codemirror/commands'
import {csvTextDocument,csvTextValue,csvTextRange,csvLineEndings,replaceCsvText,insertCsvText} from '../src/renderer/lib/csv-text-model'
const create=(text:string)=>{const source=csvTextDocument(text);return EditorState.create({doc:source.doc,extensions:[history(),...source.extensions]})}
function command(state:EditorState,run:typeof undo){let next=state;const done=run({state,dispatch:transaction=>{next=transaction.state}});return{done,state:next}}
const mixed='ID,Nombre\r\n001,"á\nñ"\r9007199254740993,conservar\n'
it('muestra líneas físicas LF/CRLF/CR y serializa exactamente sin inventar normalización',()=>{
 for(const source of ['',mixed,'a\r\nb\r\n','a\rb\r','a\nb','\uFEFFa\r\n\uFEFFb\r']){const state=create(source);expect(csvTextValue(state)).toBe(source);expect(state.doc.lines).toBe(source.split(/\r\n|\r|\n/).length);expect(state.doc.toString()).toBe(source.replace(/\r\n|\r/g,'\n'))}
})
it('editar una letra conserva el mismo ledger y todos los terminadores, con undo/redo nativos',()=>{
 const initial=create(mixed),from=initial.doc.toString().indexOf('conservar'),changed=initial.update({changes:{from,to:from+9,insert:'editado'},userEvent:'input.type'}).state;expect(changed.field(csvLineEndings)).toBe(initial.field(csvLineEndings));expect(csvTextValue(changed)).toBe(mixed.replace('conservar','editado'))
 const back=command(changed,undo);expect(back.done).toBe(true);expect(csvTextValue(back.state)).toBe(mixed);expect(csvTextValue(command(back.state,redo).state)).toBe(mixed.replace('conservar','editado'))
})
it('borrar y reponer saltos mixtos recupera su tipo exacto al deshacer y rehacer',()=>{
 let state=create(mixed);const from=state.doc.line(2).from-1,to=state.doc.line(4).from;state=state.update({...replaceCsvText(state,from,to,'X\r\nY\rZ\n'),annotations:isolateHistory.of('full')}).state
 const edited=csvTextValue(state);expect(edited).toContain('X\r\nY\rZ\n');const back=command(state,undo);expect(csvTextValue(back.state)).toBe(mixed);expect(csvTextValue(command(back.state,redo).state)).toBe(edited)
})
it('el historial agrupado mapea terminadores reemplazados justo en sus bordes',()=>{
 let state=create('a\r\nb\rc\n');state=state.update({...replaceCsvText(state,1,1,'x\r'),userEvent:'input.type',annotations:Transaction.time.of(1000)}).state;state=state.update({...replaceCsvText(state,2,4,'\n'),userEvent:'input.type',annotations:Transaction.time.of(1010)}).state;const edited=csvTextValue(state),back=command(state,undo);expect(csvTextValue(back.state)).toBe('a\r\nb\rc\n');expect(csvTextValue(command(back.state,redo).state)).toBe(edited)
})
it('pegado mixto y copia de varias selecciones conservan sus secuencias físicas',()=>{
 let state=create('A\r\nB\rC\nD');state=state.update({selection:EditorSelection.create([EditorSelection.cursor(0),EditorSelection.cursor(state.doc.length)])}).state;state=state.update(insertCsvText(state,'x\ry\r\nz\n')).state;expect(csvTextValue(state)).toBe('x\ry\r\nz\nA\r\nB\rC\nDx\ry\r\nz\n');expect(csvTextRange(state,0,6)).toBe('x\ry\r\nz\n');expect(csvTextValue(command(state,undo).state)).toBe('A\r\nB\rC\nD')
})
it('diferencial de rangos y veinte niveles de undo/redo frente a un oráculo de texto crudo',()=>{
 let state=create(mixed),raw=mixed,seed=27;const versions=[raw],random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed}
 function rawPositions(source:string){const positions=[0];for(let offset=0;offset<source.length;){if(source[offset]==='\r'&&source[offset+1]==='\n')offset+=2;else offset++;positions.push(offset)}return positions}
 for(let i=0;i<20;i++){const positions=rawPositions(raw),a=random()%positions.length,b=random()%positions.length,from=Math.min(a,b),to=Math.max(a,b),insert=['q','\r','\r\n','\n','x\r\ny\rz\n'][random()%5];raw=raw.slice(0,positions[from])+insert+raw.slice(positions[to]);state=state.update({...replaceCsvText(state,from,to,insert),annotations:isolateHistory.of('full')}).state;expect(csvTextValue(state)).toBe(raw);expect(state.doc.lines).toBe(raw.split(/\r\n|\r|\n/).length);versions.push(raw)}
 for(let i=19;i>=0;i--){const back=command(state,undo);expect(back.done).toBe(true);state=back.state;expect(csvTextValue(state)).toBe(versions[i])}
 for(let i=1;i<versions.length;i++){const next=command(state,redo);expect(next.done).toBe(true);state=next.state;expect(csvTextValue(state)).toBe(versions[i])}
})
it('Enter sigue añadiendo una línea junto a terminadores mixtos antiguos',()=>{
 for(const [raw,where,expected] of [['first\nA\rB\n','from','first\nA\r\r\nB\n'],['a\rB\nC','to','a\rB\r\n\nC']] as const){const initial=create(raw),line=initial.doc.line(where==='from'?3:2),at=where==='from'?line.from:line.to,changed=initial.update({changes:{from:at,insert:'\n'},userEvent:'input.type'}).state;expect(csvTextValue(changed)).toBe(expected);expect(changed.doc.lines).toBe(initial.doc.lines+1);expect(csvTextValue(command(changed,undo).state)).toBe(raw);expect(csvTextValue(command(command(changed,undo).state,redo).state)).toBe(expected)}
})
it('borrar contenido entre CR y LF los une visualmente sin cambiar los bytes de fuera',()=>{
 const initial=create('A\rx\nB'),changed=initial.update({changes:{from:2,to:3},userEvent:'delete.forward'}).state;expect(csvTextValue(changed)).toBe('A\r\nB');expect(changed.doc.toString()).toBe('A\nB');expect(changed.doc.lines).toBe(2);const back=command(changed,undo);expect(csvTextValue(back.state)).toBe('A\rx\nB');expect(csvTextValue(command(back.state,redo).state)).toBe('A\r\nB')
})
it('varios cursores conservan pegados crudos que coalescen en una frontera',()=>{
 let state=create('A\rB\nC');state=state.update({selection:EditorSelection.create([EditorSelection.cursor(2),EditorSelection.cursor(3)])}).state;state=state.update(insertCsvText(state,'\n')).state;expect(csvTextValue(state)).toBe('A\r\nB\n\nC');expect(state.doc.lines).toBe(4);expect(state.selection.ranges).toHaveLength(2);expect(csvTextValue(command(state,undo).state)).toBe('A\rB\nC')
})
it('preserva bytes y líneas en 600 ediciones y sus historiales frente al texto crudo',()=>{
 for(let trial=1;trial<=40;trial++){
  let raw='á😀\r\n"001",ñ\rA\nB\rC\n',state=create(raw),seed=trial;const versions=[raw],random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed}
  for(let step=0;step<15;step++){
   const positions=[0];for(let at=0;at<raw.length;){at+=raw[at]==='\r'&&raw[at+1]==='\n'?2:1;positions.push(at)}
   const a=random()%positions.length,b=random()%positions.length,from=Math.min(a,b),to=Math.max(a,b);let insert=['😀','\r','\n','\r\n','á\rñ\n',''][random()%6];if(from===to&&!insert)insert='X';raw=raw.slice(0,positions[from])+insert+raw.slice(positions[to]);state=state.update({...replaceCsvText(state,from,to,insert),annotations:isolateHistory.of('full')}).state;expect(csvTextValue(state)).toBe(raw);expect(state.doc.lines).toBe(raw.split(/\r\n|\r|\n/).length);versions.push(raw)
  }
  for(let step=14;step>=0;step--){state=command(state,undo).state;expect(csvTextValue(state)).toBe(versions[step])}
  for(let step=1;step<versions.length;step++){state=command(state,redo).state;expect(csvTextValue(state)).toBe(versions[step])}
 }
})

it('la configuración de producción de CSV permite varios rangos sin ayuda del fixture',()=>{const initial=create('uno\r\ndos\rfin');const state=initial.update({selection:EditorSelection.create([EditorSelection.range(0,3),EditorSelection.range(4,7)])}).state;expect(state.selection.ranges).toHaveLength(2)})
