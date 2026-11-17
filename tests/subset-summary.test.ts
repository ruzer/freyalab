import {describe,it,expect} from 'vitest'
import {subsetSummary} from '../src/renderer/lib/subset-summary'
import type {ProjectRecipeStep} from '../src/shared/project'

describe('resumen visible de un conjunto',()=>{
 it('explica los pasos reales y las columnas raíz sin ejecutar ni cambiar su definición',()=>{
  const steps:ProjectRecipeStep[]=[{op:'filter',mode:'all',conditions:[{column:{position:2,name:'Entidad'},op:'equals',value:'Oaxaca',caseSensitive:false}]},{op:'order',by:[{column:{position:3,name:'Edad'},descending:true,numeric:true}]},{op:'select',columns:[{position:1,name:'ID'},{position:3,name:'Edad'},{position:5,name:'Nota'}]}]
  const before=JSON.stringify(steps)
  expect(subsetSummary(steps,'es')).toBe('Entidad = Oaxaca · Edad ↓ · 3 columnas')
  expect(JSON.stringify(steps)).toBe(before)
 })
 it('traduce una muestra con semilla y conserva nombres Unicode y comillas',()=>{
  expect(subsetSummary([{op:'order',by:[{column:{position:1,name:'Crédito «México» "ñ"'},descending:false,numeric:false}]},{op:'sample',method:'random',rows:3,seed:7}],'en')).toBe('Crédito «México» "ñ" ↑ · sample of 3 rows · seed 7')
 })
})


describe('operadores de comparación legibles en los conjuntos',()=>{
 for(const [op,symbol] of [['equals','='],['notEquals','≠'],['greater','>'],['greaterEqual','≥'],['less','<'],['lessEqual','≤']] as const){
  for(const language of ['es','en'] as const)it(`${op} usa ${symbol} en ${language} sin cambiar el valor`,()=>{
   const steps:ProjectRecipeStep[]=[{op:'filter',mode:'all',conditions:[{column:{position:2,name:'Código «México»'},op,value:'00123',caseSensitive:false}]}]
   const original=JSON.stringify(steps)
   expect(subsetSummary(steps,language)).toBe(`Código «México» ${symbol} 00123`)
   expect(JSON.stringify(steps)).toBe(original)
  })
 }
 it('conserva en texto los operadores restantes y omite valores para vacío',()=>{
  const steps:ProjectRecipeStep[]=[{op:'filter',mode:'any',conditions:[{column:{position:1,name:'Nota'},op:'contains',value:'línea 1',caseSensitive:false},{column:{position:5,name:'Nota'},op:'empty',value:'no mostrar',caseSensitive:false}]}]
  expect(subsetSummary(steps,'es')).toBe('Nota Contiene línea 1 ∨ Nota Está vacío')
  expect(subsetSummary(steps,'en')).toBe('Nota Contains línea 1 ∨ Nota Is empty')
 })
})
