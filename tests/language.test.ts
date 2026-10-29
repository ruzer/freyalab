import {afterEach,describe,it,expect} from 'vitest'
import {initializeLanguage,languageState,changeLanguage} from '../src/main/language'
afterEach(()=>initializeLanguage(['es-MX'],{}))
describe('I18N-01 · estado en memoria y entorno de pruebas',()=>{
 it.each(['es','en','en-XA'] as const)('permite forzar %s solo al iniciar una prueba',language=>{
  initializeLanguage(['pt-BR'],{FREYALAB_TEST:'1',FREYALAB_LANG:language})
  expect(languageState()).toEqual({preference:'sistema',language})
 })
 it.each(['es','en','en-XA','invalido'])('ignora FREYALAB_LANG=%s fuera de pruebas',language=>{
  initializeLanguage(['en-GB'],{FREYALAB_LANG:language});expect(languageState()).toEqual({preference:'sistema',language:'en'})
 })
 it('un valor de prueba no reconocido cae al idioma del sistema',()=>{
  initializeLanguage(['es-419'],{FREYALAB_TEST:'1',FREYALAB_LANG:'invalido'});expect(languageState().language).toBe('es')
 })
 it('el cambio explícito gana al idioma inicial forzado y Sistema vuelve a resolverlo',()=>{
  initializeLanguage(['pt-BR'],{FREYALAB_TEST:'1',FREYALAB_LANG:'es'})
  expect(changeLanguage('en')).toEqual({preference:'en',language:'en'})
  expect(changeLanguage('es')).toEqual({preference:'es',language:'es'})
  expect(changeLanguage('sistema')).toEqual({preference:'sistema',language:'en'})
 })
 it('APP-03 · restaura la preferencia persistida al iniciar sin perder la resolución Sistema',()=>{
  expect(initializeLanguage(['es-MX'],{},'en')).toEqual({preference:'en',language:'en'})
  expect(initializeLanguage(['en-US'],{},'es')).toEqual({preference:'es',language:'es'})
  expect(initializeLanguage(['es-MX'],{},'sistema')).toEqual({preference:'sistema',language:'es'})
 })
 it('APP-03 · la preferencia persistida conserva el entorno de pruebas sin convertirlo en ajuste',()=>{
  expect(initializeLanguage(['en-US'],{FREYALAB_TEST:'1',FREYALAB_LANG:'en-XA'},'es')).toEqual({preference:'es',language:'en-XA'})
 })

})
