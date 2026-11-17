import {describe,it,expect} from 'vitest'
import {plural,type Language} from '../src/shared/i18n'

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
