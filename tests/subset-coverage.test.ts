import {describe,it,expect} from 'vitest'
import type {ProjectRecipe,ProjectRecipeDraft,ProjectRecipeStep} from '../src/shared/project'
import {subsetCoverage,subsetStepOwners,type SubsetCoverageResult} from '../src/renderer/lib/subset-coverage'

const full:SubsetCoverageResult={scanned:7,resultCount:3,complete:true,cancelled:false,bytesRead:211,sampling:[{step:1,method:'random',requestedRows:3,seed:7,eligible:5,selected:3}]}
const sampled:ProjectRecipeStep[]=[{op:'filter',mode:'all',conditions:[{column:{position:3,name:'Edad'},op:'greaterEqual',value:'18',caseSensitive:false}]},{op:'sample',method:'random',rows:3,seed:7}]

describe('cobertura compartida del conjunto y su análisis',()=>{
 it('explica una sola muestra sin números de paso ni prefijo y omite bytes en la verificación completa',()=>{
  const before=JSON.stringify({full,sampled})
  expect(subsetCoverage(full,sampled,'es',['Adultos','Muestra de tres'])).toEqual({lines:['Muestra aleatoria de 3 de las 5 filas que cumplen · semilla 7','7 registros examinados'],identity:'Fuente verificada por completo'})
  expect(subsetCoverage(full,sampled,'en',['Adultos','Muestra de tres'])).toEqual({lines:['Random sample of 3 of 5 matching rows · seed 7','7 records examined'],identity:'Source fully verified'})
  expect(JSON.stringify({full,sampled})).toBe(before)
 })
})


describe('lectura parcial y cancelación sin total inventado',()=>{
 it('separa el límite de un prefijo de las filas finales y muestra bytes solo con identidad parcial',()=>{
  const steps:ProjectRecipeStep[]=[{op:'sample',method:'first',rows:3},{op:'filter',mode:'all',conditions:[{column:{position:3,name:'Edad'},op:'greaterEqual',value:'18',caseSensitive:false}]}]
  const result:SubsetCoverageResult={scanned:3,resultCount:2,complete:false,cancelled:false,bytesRead:128,sampling:[{step:0,method:'first',requestedRows:3,eligible:3,selected:3}]}
  expect(subsetCoverage(result,steps,'es')).toEqual({lines:['Parcial: 2 filas · 3 registros examinados · total no determinado','Límite de 3 primeras filas; 3 filas obtenidas'],identity:'128 bytes leídos · Solo comprobación rápida; la fuente completa no está verificada'})
  expect(subsetCoverage(result,steps,'en')).toEqual({lines:['Partial: 2 rows · 3 records examined · total not determined','First 3 rows limit; 3 rows obtained'],identity:'128 bytes read · Quick check only; the complete source has not been verified'})
 })
 it('una cancelación no convierte los candidatos intermedios en un total conocido',()=>{
  const result:SubsetCoverageResult={scanned:5,resultCount:2,complete:false,cancelled:true,bytesRead:175,sampling:[{step:1,method:'random',requestedRows:3,seed:7,eligible:5,selected:2}]}
  const coverage=subsetCoverage(result,sampled,'es')
  expect(coverage).toEqual({lines:['Parcial: 2 filas · se canceló tras examinar 5 registros','Muestra parcial de 2 filas · semilla 7'],identity:'175 bytes leídos · Solo comprobación rápida; la fuente completa no está verificada'})
  expect(coverage.lines.join(' · ')).not.toMatch(/\d+ de (las )?\d+/)
 })
})


describe('varias muestras en una cadena',()=>{
 it('ubica cada muestra en su conjunto y nunca expone los índices del motor',()=>{
  const common={sourceSha256:'0'.repeat(64),semantics:1,createdAt:'2026-11-17T00:00:00.000Z'}
  const recipes:ProjectRecipe[]=[{...common,id:'adults',name:'Adultos',sourceId:'source',steps:sampled.slice(0,1)},{...common,id:'sample',name:'Muestra Ñ',baseRecipeId:'adults',steps:[{op:'sample',method:'random',rows:3,seed:7}]}]
  const draft:ProjectRecipeDraft={name:'Dos mayores',baseRecipeId:'sample',steps:[{op:'sample',method:'first',rows:2}]}
  const before=JSON.stringify({recipes,draft})
  const context=subsetStepOwners(draft,recipes)
  expect(context.stepOwners).toEqual(['Adultos','Muestra Ñ','Dos mayores'])
  expect(context.steps.map(step=>step.op)).toEqual(['filter','sample','sample'])
  const result:SubsetCoverageResult={...full,resultCount:2,sampling:[full.sampling[0],{step:2,method:'first',requestedRows:2,eligible:3,selected:2}]}
  const es=subsetCoverage(result,context.steps,'es',context.stepOwners)
  expect(es.lines).toEqual(['En «Muestra Ñ»: Muestra aleatoria de 3 de las 5 filas que cumplen · semilla 7','En «Dos mayores»: Las 2 primeras de las 3 filas que cumplen','7 registros examinados'])
  expect(subsetCoverage(result,context.steps,'en',context.stepOwners).lines).toEqual(['In «Muestra Ñ»: Random sample of 3 of 5 matching rows · seed 7','In «Dos mayores»: First 2 of 3 matching rows','7 records examined'])
  expect(es.lines.join(' · ')).not.toMatch(/Paso|Step|\{step\}/)
  expect(JSON.stringify({recipes,draft})).toBe(before)
 })
 it('nombra también muestras parciales sin un denominador desconocido',()=>{
  const steps:ProjectRecipeStep[]=[{op:'sample',method:'first',rows:5},{op:'sample',method:'random',rows:2,seed:7}]
  const result:SubsetCoverageResult={scanned:5,resultCount:2,complete:false,cancelled:false,bytesRead:200,sampling:[{step:0,method:'first',requestedRows:5,eligible:5,selected:5},{step:1,method:'random',requestedRows:2,seed:7,eligible:5,selected:2}]}
  expect(subsetCoverage(result,steps,'es',['Primeras cinco','Dos al azar']).lines).toEqual(['Parcial: 2 filas · 5 registros examinados · total no determinado','En «Primeras cinco»: Límite de 5 primeras filas; 5 filas obtenidas','En «Dos al azar»: Muestra parcial de 2 filas · semilla 7'])
 })
})

describe('compatibilidad de los recuentos de cobertura',()=>{
 it('mantiene todos los registros o el recuento filtrado cuando no hay muestra',()=>{
  const source:SubsetCoverageResult={...full,resultCount:7,sampling:[]}
  expect(subsetCoverage(source,[],'es')).toEqual({lines:['Todos los registros (7)'],identity:'Fuente verificada por completo'})
  expect(subsetCoverage({...source,resultCount:3},sampled.slice(0,1),'en').lines).toEqual(['3 of 7 records'])
  expect(subsetCoverage(source,sampled.slice(0,1),'es').lines).toEqual(['7 de 7 registros'])
 })
 it('identifica un prefijo sencillo sin llamarlo una lectura completa',()=>{
  const result:SubsetCoverageResult={scanned:2,resultCount:2,complete:false,cancelled:false,bytesRead:128,sampling:[{step:0,method:'first',requestedRows:2,eligible:2,selected:2}]}
  expect(subsetCoverage(result,[{op:'sample',method:'first',rows:2}],'es')).toEqual({lines:['Primeras 2 filas que cumplen · total no determinado','Límite de 2 primeras filas; 2 filas obtenidas'],identity:'128 bytes leídos · Solo comprobación rápida; la fuente completa no está verificada'})
 })
 it('solo explica que había menos filas al haber completado el recorrido',()=>{
  const result:SubsetCoverageResult={...full,resultCount:7,sampling:[{step:0,method:'random',requestedRows:10,seed:7,eligible:7,selected:7}]}
  expect(subsetCoverage(result,[{op:'sample',method:'random',rows:10,seed:7}],'es').lines).toEqual(['Muestra aleatoria de 7 de las 7 filas que cumplen · semilla 7 Se pidieron 10 filas y solo hay 7: se toman todas.','7 registros examinados'])
  const partial=subsetCoverage({...result,complete:false,cancelled:true,resultCount:2},[], 'es')
  expect(partial.lines.join(' · ')).not.toMatch(/solo hay|de las 7|Paso|Step/)
 })
 it('el porcentaje sigue siendo aproximado en lecturas completas y parciales',()=>{
  const steps:ProjectRecipeStep[]=[{op:'sample',method:'random',percent:50,seed:7}]
  const result:SubsetCoverageResult={...full,resultCount:5,sampling:[{step:0,method:'random',percent:50,seed:7,eligible:7,selected:5}]}
  expect(subsetCoverage(result,steps,'es').lines).toEqual(['Muestra aleatoria de aproximadamente 50 %: 5 de las 7 filas que cumplen · semilla 7','7 registros examinados'])
  expect(subsetCoverage({...result,complete:false},steps,'en').lines).toEqual(['Partial: 5 rows · 7 records examined · total not determined','Approximate 50% sample · 5 rows obtained · seed 7'])
 })
 it('en-XA deriva los textos ingleses y conserva los nombres de conjuntos',()=>{
  const result:SubsetCoverageResult={...full,sampling:[...full.sampling,{step:2,method:'first',requestedRows:2,eligible:3,selected:2}]}
  const coverage=subsetCoverage(result,[...sampled,{op:'sample',method:'first',rows:2}],'en-XA',['Adultos','Muestra Ñ','Dos «á»'])
  expect(coverage.lines[0]).toContain('Muestra Ñ')
  expect(coverage.lines[1]).toContain('Dos «á»')
  expect(coverage.lines[0]).toContain('[Ïn')
  expect(coverage.lines.join(' · ')).not.toMatch(/\{[^}]+\}|Paso|Step/)
 })
})
