import {describe,it,expect,vi} from 'vitest'
import {EditorState} from '@codemirror/state'
import {markdown} from '@codemirror/lang-markdown'
import {ensureSyntaxTree,syntaxTreeAvailable} from '@codemirror/language'
import {currentHeading,outlineTree,visibleHeading,editorHeadings,matchHeadings,type HeadingMetric} from '../src/renderer/lib/outline'
import type {Heading} from '../src/renderer/lib/render'

const metrics:readonly HeadingMetric[]=Object.freeze([
 Object.freeze({id:'primero',top:100}),
 Object.freeze({id:'segundo',top:300}),
 Object.freeze({id:'ultimo',top:1150}),
])
describe('FL-MD-007 A · sección actual desde métricas visibles y ordenadas',()=>{
 it.each([
  ['sin títulos',[],900,300,1200,undefined],
  ['antes del primer umbral',metrics,0,300,1200,undefined],
  ['primer título justo al 30 %',metrics,10,300,1200,'primero'],
  ['segundo título justo al 30 %',metrics,210,300,1200,'segundo'],
  ['tops repetidos eligen el último', [{id:'uno',top:100},{id:'dos',top:300},{id:'tres',top:300}],210,300,1200,'tres'],
  ['el último todavía no cruza el umbral',metrics,650,300,1200,'segundo'],
  ['final con overflow elige el último aunque no cruce',metrics,900,300,1200,'ultimo'],
  ['tolerancia de un píxel al final',metrics,899,300,1200,'ultimo'],
  ['dos píxeles antes del final aún aplica el umbral',metrics,898,300,1200,'segundo'],
  ['sin overflow no fuerza el último',metrics,0,300,300,undefined],
  ['viewport de alto cero no adelanta el umbral',metrics,0,0,1200,undefined],
 ] as const)('%s',(_,headings,scrollTop,viewportHeight,scrollHeight,expected)=>{
  expect(currentHeading(headings,scrollTop,viewportHeight,scrollHeight)).toBe(expected)
 })
 it('consulta 1.000 métricas con como máximo 11 lecturas de top, sin recorrerlas',()=>{
  let reads=0
  const headings:HeadingMetric[]=Array.from({length:1000},(_,index)=>({id:`titulo-${index}`,get top(){reads++;return index*100}}))
  expect(currentHeading(headings,49950,100,1000000)).toBe('titulo-499')
  expect(reads).toBeGreaterThan(0)
  expect(reads).toBeLessThanOrEqual(11)
 })
})

describe('FL-MD-007 C · correspondencia comprobada con el AST de CodeMirror',()=>{
 const stateOf=(source:string)=>{
  const state=EditorState.create({doc:source,extensions:[markdown(),...(source.includes('\r\n')?[EditorState.lineSeparator.of('\r\n')]:[])]})
  // Fixtures pequeñas: el AST completo no debe depender del presupuesto inicial de CodeMirror.
  expect(ensureSyntaxTree(state,state.doc.length,Infinity)).not.toBeNull()
  const ready=state.update({}).state
  expect(syntaxTreeAvailable(ready,ready.doc.length)).toBe(true)
  return ready
 }
 it('prepara el título con el presupuesto inicial agotado',()=>{
  let now=0
  const clock=vi.spyOn(Date,'now').mockImplementation(()=>now+=1000)
  try{
   const state=stateOf('# Uno')
   expect(syntaxTreeAvailable(state,state.doc.length)).toBe(true)
   expect(editorHeadings(state)).toEqual({complete:true,headings:[{text:'Uno',level:1,from:0}]})
  }finally{clock.mockRestore()}
 })
 it.each([
  ['ATX','# Uno', 'Uno',1],
  ['ATX con cierre','## Dos ##','Dos',2],
  ['Setext nivel uno','Tres\n====','Tres',1],
  ['Setext nivel dos','Cuatro\n----','Cuatro',2],
  ['negrita/cursiva/código','# Texto **fuerte** y *énfasis* con `código`','Texto fuerte y énfasis con código',1],
  ['escapes','# A \\*literal\\*','A *literal*',1],
  ['espacios en código en línea','# ` código ` y ``a ` b``','código y a ` b',1],
  ['enlace explícito','# [**Guía**](./guia.md "Título")','Guía',1],
  ['autolink','# <https://example.com>','https://example.com',1],
  ['imagen sin sumar alt','# Logo ![Alternativo](./imagen.png)','Logo',1],
  ['HTML inline descartado por el render','# Texto <em>Hola</em>','Texto Hola',1],
  ['Unicode','# 🐕 café e\u0301','🐕 café e\u0301',1],
 ] as const)('%s extrae el texto y nivel sin modificar el estado',(_,source,text,level)=>{
  const state=stateOf(source),result=editorHeadings(state)
  expect(result.complete).toBe(true)
  expect(result.headings).toEqual([{text,level,from:0}])
  expect(state.sliceDoc()).toBe(source)
 })
 it.each([
  ['referencia sin destino','# [Guía]'],
  ['referencia resuelta no normalizada aquí','# [Guía][ref]\n\n[ref]: ./guia.md'],
  ['entidad desconocida','# &desconocida;'],
  ['entidad sin normalización demostrada','# Uno &amp; Dos'],
 ])('%s queda sin candidato antes que adivinar su texto',(_,source)=>{
  expect(editorHeadings(stateOf(source))).toEqual({complete:true,headings:[]})
 })
 it.each([
  ['---\ntitle: Uno\n---\n\n# title: Uno'],
  ['\uFEFF---\r\ntitle: Uno\r\n---\r\n\r\n# title: Uno\r\n'],
 ])('excluye el falso Setext YAML usando el front matter existente: %j',source=>{
  const state=stateOf(source),result=editorHeadings(state)
  expect(result).toEqual({complete:true,headings:[{text:'title: Uno',level:1,from:state.doc.toString().lastIndexOf('# title: Uno')}]})
  expect(state.sliceDoc()).toBe(source)
 })
 it('no excluye un Setext real que solo parece un encabezado YAML',()=>{
  expect(editorHeadings(stateOf('---\nTexto\n---'))).toEqual({complete:true,headings:[{text:'Texto',level:2,from:4}]})
 })
 it('código no genera candidatos; títulos en cita y lista conservan su posición real',()=>{
  const source='    # No título\n\n```md\n# Literal\n```\n\n> ## Cita\n\n- ### Lista',state=stateOf(source)
  expect(editorHeadings(state)).toEqual({complete:true,headings:[{text:'Cita',level:2,from:source.indexOf('## Cita')},{text:'Lista',level:3,from:source.indexOf('### Lista')}]})
 })
 it('el AST de details compacto no inventa un candidato por cada título renderizado',()=>{
  const source='<details><summary>Más</summary>\n# Uno\n</details>\n\n# Uno',result=editorHeadings(stateOf(source))
  expect(result.headings).toEqual([{text:'Uno',level:1,from:source.lastIndexOf('# Uno')}])
  const rendered=[{id:'html',text:'Uno',level:1},{id:'normal',text:'Uno',level:1}]
  expect([...matchHeadings(rendered,result.headings)]).toEqual([])
 })
 it('un árbol parcial no habilita emparejamiento greedy de su prefijo',()=>{
  const source=Array.from({length:1000},(_,index)=>`# Título ${index}\n\n`).join(''),state=EditorState.create({doc:source,extensions:[markdown()]}),result=editorHeadings(state)
  expect(result).toEqual({complete:false,headings:[]})
  expect([...matchHeadings([{id:'ultimo',text:'Título 999',level:1}],result.headings)]).toEqual([])
 })
 it.each([
  ['orden completo',[{id:'a',text:'Uno',level:1},{id:'b',text:'Dos',level:2}],[{text:'Uno',level:1,from:0},{text:'Dos',level:2,from:20}],[['a',0],['b',20]]],
  ['repetidos equilibrados',[{id:'a',text:'Uno',level:1},{id:'b',text:'Uno',level:1}],[{text:'Uno',level:1,from:0},{text:'Uno',level:1,from:20}],[['a',0],['b',20]]],
  ['render con un duplicado adicional',[{id:'a',text:'Uno',level:1},{id:'b',text:'Uno',level:1}],[{text:'Uno',level:1,from:20}],[]],
  ['AST con un duplicado adicional',[{id:'a',text:'Uno',level:1}],[{text:'Uno',level:1,from:0},{text:'Uno',level:1,from:20}],[]],
  ['otro grupo comprobable sigue disponible',[{id:'a',text:'Uno',level:1},{id:'b',text:'Uno',level:1},{id:'c',text:'Fin',level:2}],[{text:'Uno',level:1,from:0},{text:'Fin',level:2,from:30}],[['c',30]]],
  ['niveles incompatibles',[{id:'a',text:'Uno',level:1},{id:'b',text:'Uno',level:2}],[{text:'Uno',level:1,from:0},{text:'Uno',level:1,from:20}],[]],
  ['orden incompatible',[{id:'a',text:'Uno',level:1},{id:'b',text:'Dos',level:1}],[{text:'Dos',level:1,from:0},{text:'Uno',level:1,from:20}],[]],
  ['espacios equivalentes',[{id:'a',text:'Uno\n Dos',level:1}],[{text:'Uno Dos',level:1,from:10}],[['a',10]]],
  ['no confunde acentos ni mayúsculas',[{id:'a',text:'Café',level:1}],[{text:'cafe',level:1,from:0}],[]],
 ] as const)('%s',(_,rendered,candidates,expected)=>{
  expect([...matchHeadings(rendered,candidates)]).toEqual(expected)
 })
})

describe('FL-MD-007 B · rutas de títulos y ramas',()=>{
 const headings:readonly Heading[]=Object.freeze([
  Object.freeze({id:'a',text:'Manual',level:1}),
  Object.freeze({id:'b',text:'Inicio',level:3}),
  Object.freeze({id:'c',text:'Instalar',level:2}),
  Object.freeze({id:'d',text:'Linux',level:4}),
  Object.freeze({id:'e',text:'Final',level:1}),
 ])
 it('un documento sin títulos produce un árbol plano vacío',()=>expect(outlineTree([])).toEqual([]))
 it('saltos 1/3/2 usan el último nivel menor sin inventar nodos',()=>{
  const nodes=outlineTree(headings)
  expect(nodes).toHaveLength(headings.length)
  expect(nodes.map(node=>node.depth)).toEqual([0,1,1,2,0])
  expect(nodes.map(node=>node.hasChildren)).toEqual([true,false,true,false,false])
  expect(nodes.map(node=>node.ancestors)).toEqual([[],[nodes[0].key],[nodes[0].key],[nodes[0].key,nodes[2].key],[]])
  expect(nodes.map(({id,text,level})=>({id,text,level}))).toEqual(headings)
 })
 it('empezar en H2 crea raíces, no un H1 vacío',()=>{
  const nodes=outlineTree([{id:'a',text:'Uno',level:2},{id:'b',text:'Dos',level:2}])
  expect(nodes.map(node=>node.depth)).toEqual([0,0])
  expect(nodes.map(node=>node.ancestors)).toEqual([[],[]])
  expect(nodes.every(node=>!node.hasChildren)).toBe(true)
 })
 it('títulos repetidos tienen ocurrencias de hermanos independientes por padre',()=>{
  const nodes=outlineTree([
   {id:'a',text:'Uno',level:1},{id:'b',text:'Hijo',level:2},{id:'c',text:'Hijo',level:2},
   {id:'d',text:'Uno',level:1},{id:'e',text:'Hijo',level:2},
  ])
  expect(nodes.map(node=>JSON.parse(node.key))).toEqual([
   [['Uno',1]],[['Uno',1],['Hijo',1]],[['Uno',1],['Hijo',2]],
   [['Uno',2]],[['Uno',2],['Hijo',1]],
  ])
  expect(new Set(nodes.map(node=>node.key)).size).toBe(nodes.length)
 })
 it('cambiar ids conserva las rutas y añadir un hermano distinto no las desplaza',()=>{
  const before=outlineTree(headings)
  const after=outlineTree([{id:'nuevo',text:'Introducción',level:1},...headings.map(heading=>({...heading,id:`nuevo-${heading.id}`}))])
  expect(after.slice(1).map(node=>node.key)).toEqual(before.map(node=>node.key))
 })
 it('renombrar o eliminar una rama deja sus rutas antiguas fuera del árbol',()=>{
  const before=outlineTree(headings),renamed=outlineTree(headings.map(heading=>heading.id==='a'?{...heading,text:'Manual nuevo'}:heading))
  const keys=new Set(renamed.map(node=>node.key))
  for(const node of before.slice(0,4))expect(keys.has(node.key)).toBe(false)
  expect(keys.has(before[4].key)).toBe(true)
  expect(outlineTree(headings.slice(4)).map(node=>node.key)).toEqual([before[4].key])
 })
 it('JSON conserva texto Unicode, comillas y separadores sin mutar la entrada',()=>{
  const source=Object.freeze([Object.freeze({id:'uno',text:'🐕 "Manual" / [1], café',level:2})])
  const nodes=outlineTree(source)
  expect(JSON.parse(nodes[0].key)).toEqual([['🐕 "Manual" / [1], café',1]])
  expect(nodes[0]).not.toBe(source[0])
  expect(nodes[0].ancestors).toEqual([])
 })
 it.each([
  ['sin sección actual',undefined,[],undefined],
  ['sección que no existe','ausente',[] ,undefined],
  ['sección visible','d',[],'d'],
  ['un ancestro cerrado','d',['c'],'c'],
  ['dos ancestros cerrados eligen el visible desde la raíz','d',['a','c'],'a'],
  ['otra rama cerrada no cambia el actual','d',['e'],'d'],
  ['la sección actual está contraída y sigue visible','c',['c'],'c'],
  ['la raíz actual no necesita ancestro','a',['c'],'a'],
 ] as const)('%s',(_,id,closedIds,expected)=>{
  const nodes=outlineTree(headings),collapsed=new Set(closedIds.map(closed=>nodes.find(node=>node.id===closed)!.key)),before=[...collapsed]
  expect(visibleHeading(nodes,id,collapsed)).toBe(expected)
  expect([...collapsed]).toEqual(before)
 })
})
