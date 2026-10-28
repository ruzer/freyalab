import {describe,it,expect} from 'vitest'
import {currentHeading,outlineTree,visibleHeading,type HeadingMetric} from '../src/renderer/lib/outline'
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
