import {describe,it,expect} from 'vitest'
import {plural,t,type Language} from '../src/shared/i18n'

const messages=[
 ['subset.impact',
  ['Afecta a 1 conjunto: Dos mayores. Usará la nueva definición la próxima vez que se ejecute.','Afecta a 2 conjuntos: Dos mayores. Usarán la nueva definición la próxima vez que se ejecuten.'],
  ['Affects 1 subset: Dos mayores. It will use the new definition the next time it runs.','Affects 2 subsets: Dos mayores. They will use the new definition the next time they run.']],
 ['subset.sourceHasSubsets',
  ['No se puede quitar: 1 conjunto parte de esta fuente.','No se puede quitar: 2 conjuntos parten de esta fuente.'],
  ['Cannot remove: 1 subset starts from this source.','Cannot remove: 2 subsets start from this source.']],
 ['subset.ready',['Conjunto listo: 1 fila','Conjunto listo: 2 filas'],['Subset ready: 1 row','Subset ready: 2 rows']],
 ['subset.cancelledReady',['Conjunto parcial: 1 fila','Conjunto parcial: 2 filas'],['Partial subset: 1 row','Partial subset: 2 rows']]
] as const

describe('recuentos visibles de conjuntos',()=>{
 for(const [key,es,en] of messages)for(const locale of ['es','en'] as Language[])for(const count of [1,2]){
  it(`${key} ${locale} ${count}: interpola el recuento nativo sin marcadores literales`,()=>{
   const message=plural(key,count,{names:'Dos mayores'},locale)
   expect(message).toBe((locale==='es'?es:en)[count-1])
   expect(message).not.toMatch(/\{[^}]+\}/)
  })
 }
})


describe('ayuda para ordenar una muestra aleatoria',()=>{
 it('explica en español cómo guardar la muestra y ordenar otro conjunto',()=>{
  expect(t('subset.unboundedOrder',{},'es')).toBe('Esta muestra necesita ordenar todo el archivo sin un límite. Guarda primero la muestra como un conjunto, sin orden. Después crea otro conjunto que parta de esa muestra y ordénalo.')
 })
 it('ofrece los mismos dos pasos en inglés',()=>{
  expect(t('subset.unboundedOrder',{},'en')).toBe('This sample would require sorting the whole file without a limit. First save the sample as a subset without sorting. Then create another subset based on that sample and sort it.')
 })
})

describe('rótulos compartidos de análisis de conjuntos',()=>{
 it('nombra el conjunto y las filas con plural real, sin traducir el nombre',()=>{
  expect(plural('subset.analysis.source',1,{name:'Adultos «Ñ»'},'es')).toBe('Datos del conjunto Adultos «Ñ» · 1 fila · La fuente no se modifica')
  expect(plural('subset.analysis.source',3,{name:'Adultos «Ñ»'},'es')).toBe('Datos del conjunto Adultos «Ñ» · 3 filas · La fuente no se modifica')
  expect(plural('subset.analysis.source',1,{name:'Adultos «Ñ»'},'en')).toBe('Subset Adultos «Ñ» data · 1 row · The source is not modified')
  expect(plural('subset.analysis.source',3,{name:'Adultos «Ñ»'},'en')).toBe('Subset Adultos «Ñ» data · 3 rows · The source is not modified')
 })
 it('explica el límite sin dar a entender que una muestra agranda el alcance permitido',()=>{
  expect(t('subset.analysis.limit',{},'es')).toBe('La fuente supera el límite de análisis. Exporta el conjunto a un archivo y añádelo como fuente.')
  expect(t('subset.analysis.limit',{},'en')).toBe('The source exceeds the analysis limit. Export the subset to a file and add it as a source.')
 })
})
