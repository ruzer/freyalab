import {it,expect} from 'vitest'
import es from '../src/shared/i18n/es.json'
import en from '../src/shared/i18n/en.json'
import {t} from '../src/shared/i18n'
it.each(['es','en','en-XA'] as const)('razones legibles y traducidas en %s',locale=>{
 for(const key of Object.keys(es).filter(key=>key.startsWith('charts.suggest.'))){
  const message=t(key,{x:'Región',y:'Ventas',field:'Descuento',measure:'la suma',period:'por mes'},locale)
  expect(message).not.toMatch(/perfil|profile|columna \d|Column \d|\{\w+\}/i)
  expect(message).not.toBe(key)
 }
})
it('el contrato en español usa palabras de persona',()=>{
 expect(es['charts.suggest.textNumber']).toBe('Sugerido: compara {measure} de «{y}» por «{x}».')
 expect(es['charts.suggest.textOnly']).toBe('Sugerido: cuenta cuántas filas hay por «{x}».')
 expect(es['charts.ui.info']).toBe('Detalles del cálculo')
 expect(es['charts.fields.added']).toBe('{field} añadido a {zone}')
 expect(es['charts.fields.replaced']).toBe('{field} reemplaza a {previous} en {zone}')
 expect(es['charts.fields.cleared']).toBe('Análisis limpiado')
 expect(es['charts.fields.ready']).toBe('Resultado actualizado: {n} grupos')
 expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
})
