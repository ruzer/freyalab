import {describe,it,expect} from 'vitest'
import {currentHeading,type HeadingMetric} from '../src/renderer/lib/outline'

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
