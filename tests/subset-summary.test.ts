import {describe,it,expect} from 'vitest'
import {subsetSummary} from '../src/renderer/lib/subset-summary'
import type {ProjectRecipeStep} from '../src/shared/project'

describe('resumen visible de un conjunto',()=>{
 it('explica los pasos reales y las columnas raíz sin ejecutar ni cambiar su definición',()=>{
  const steps:ProjectRecipeStep[]=[{op:'filter',mode:'all',conditions:[{column:{position:2,name:'Entidad'},op:'equals',value:'Oaxaca',caseSensitive:false}]},{op:'order',by:[{column:{position:3,name:'Edad'},descending:true,numeric:true}]},{op:'select',columns:[{position:1,name:'ID'},{position:3,name:'Edad'},{position:5,name:'Nota'}]}]
  const before=JSON.stringify(steps)
  expect(subsetSummary(steps,'es')).toBe('Entidad Es igual a Oaxaca · Edad ↓ · 3 columnas')
  expect(JSON.stringify(steps)).toBe(before)
 })
 it('traduce una muestra con semilla y conserva nombres Unicode y comillas',()=>{
  expect(subsetSummary([{op:'order',by:[{column:{position:1,name:'Crédito «México» "ñ"'},descending:false,numeric:false}]},{op:'sample',method:'random',rows:3,seed:7}],'en')).toBe('Crédito «México» "ñ" ↑ · sample of 3 rows · seed 7')
 })
})
