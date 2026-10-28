import {describe,it,expect} from 'vitest'
import {EditorState} from '@codemirror/state'
import {history,isolateHistory,undo,redo,undoDepth} from '@codemirror/commands'
import {assetTransaction} from '../src/renderer/lib/asset-changes'
const of=(source:string)=>EditorState.create({doc:source,extensions:[history(),...(source.includes('\r\n')?[EditorState.lineSeparator.of('\r\n')]:[])]})
describe('FL-DRW-001 · parches de activos en la sesión canónica',()=>{
 it.each(['\n','\r\n'])('rutas Unicode y varias imágenes preservan fuente e historial (%j)',newline=>{
  const source=['# 🐕 Freya','![árbol](a.assets/uno.png)','![ñ](a.assets/dos.png)','Final'].join(newline),state=of(source)
  const changes=[...source.matchAll(/a\.assets/g)].map(match=>({from:match.index!,to:match.index!+8,insert:'copia%20nueva.assets'}))
  const expected=source.replaceAll('a.assets','copia%20nueva.assets'),transaction=assetTransaction(state,source,changes,expected,false)!
  expect(transaction.state.sliceDoc()).toBe(expected);expect(undoDepth(transaction.state)).toBe(0)
 })
 it('Guardar como no añade un paso de deshacer ni borra la edición anterior',()=>{
  const initial='![x](a.assets/x.png)\n',base=of(initial),edited=base.update({changes:{from:base.doc.length,insert:'Nota'},annotations:isolateHistory.of('full')}).state
  const source=edited.sliceDoc(),from=source.indexOf('a.assets'),saved=assetTransaction(edited,source,[{from,to:from+8,insert:'b.assets'}],source.replace('a.assets','b.assets'),false)!.state
  let state=saved
  expect(undoDepth(state)).toBe(1);expect(undo({state,dispatch:transaction=>state=transaction.state})).toBe(true)
  expect(state.sliceDoc()).toBe(initial.replace('a.assets','b.assets'))
  redo({state,dispatch:transaction=>state=transaction.state});expect(state.sliceDoc()).toBe(source.replace('a.assets','b.assets'))
 })
 it('Buscar es una sola acción deshacible aunque repare varias referencias',()=>{
  const source='![x](old.png)\n![y](old.png)',state=of(source),changes=[...source.matchAll(/old\.png/g)].map(match=>({from:match.index!,to:match.index!+7,insert:'a.assets/imagen.png'}))
  let current=assetTransaction(state,source,changes,source.replaceAll('old.png','a.assets/imagen.png'),true)!.state
  expect(undoDepth(current)).toBe(1);undo({state:current,dispatch:transaction=>current=transaction.state});expect(current.sliceDoc()).toBe(source)
 })
 it.each([
  ['fuente obsoleta','otra',[{from:0,to:1,insert:'x'}],'x'],
  ['rango negativo','abc',[{from:-1,to:1,insert:'x'}],'xbc'],
  ['rango fuera','abc',[{from:1,to:99,insert:'x'}],'ax'],
  ['rango invertido','abc',[{from:2,to:1,insert:'x'}],'abc'],
  ['rango fraccionario','abc',[{from:.5,to:1,insert:'x'}],'xbc'],
  ['solapados','abc',[{from:0,to:2,insert:'x'},{from:1,to:3,insert:'y'}],'xy'],
  ['resultado no comprobado','abc',[{from:0,to:1,insert:'x'}],'otro'],
  ['par sustituto partido','🐕abc',[{from:1,to:2,insert:'x'}],'\ud83dxabc'],
 ] as const)('rechaza %s sin aplicar cambios',(_,snapshot,changes,expected)=>{
  const original=snapshot==='otra'?'abc':snapshot,state=of(original);expect(assetTransaction(state,snapshot,changes,expected,false)).toBeUndefined();expect(state.sliceDoc()).toBe(original)
 })
})
