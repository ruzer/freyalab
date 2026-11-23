import {describe,it,expect} from 'vitest'
import {formatAnalysisNumber,formatAnalysisFullNumber,copyAnalysisFragments} from '../src/shared/analysis-number-format'

// Conventional TDD: the new pure module does not exist yet. Its missing import
// is not presented as evidence of a UI bug; native E2E records that separately.
describe('SIM-3d · precisión de presentación y copia',()=>{
 it.each([
  [5.52264150943,'5.52'],[12,'12'],[12.1,'12.1'],[0,'0'],
  [0.0004123,'0.00041'],[-0.0004123,'-0.00041'],[0.009876,'0.0099'],
 ] as const)('modo2: %s se presenta como%s', (value,expected)=>{
  expect(formatAnalysisNumber(value,2,'es')).toBe(expected)
 })
 it.each([
  [5.52264150943,'5.52264150943'],[140/9,'15.5555555555556'],
  [0.1+0.2,'0.3'],[-0,'0'],[12,'12'],
 ] as const)('Todos: %s usa hasta15 cifras significativas', (value,expected)=>{
  expect(formatAnalysisNumber(value,'all','es')).toBe(expected)
 })
 it('no presenta números no nulos como0 ni pierde el signo de un número pequeño',()=>{
  expect(formatAnalysisNumber(-0,2,'es')).toBe('0')
  for(const value of [Number.MIN_VALUE,-Number.MIN_VALUE,1e-30,-1e-30]){
   const text=formatAnalysisNumber(value,2,'es')
   expect(text).not.toBe('0');expect(text).not.toBe('-0')
   expect(Math.sign(Number(text.replaceAll(',','')))).toBe(Math.sign(value))
  }
 })
 it('usa el formato compartido del idioma y conserva punto decimal',()=>{
  for(const language of ['es','en','en-XA'] as const){
   expect(formatAnalysisNumber(1234.567,2,language)).toBe('1,234.57')
   expect(formatAnalysisNumber(0.1+0.2,'all',language)).toBe('0.3')
  }
 })
 it('ayuda/copia usan15 cifras sin grupos de millares y conservan unidad',()=>{
  expect(formatAnalysisFullNumber(140/9)).toBe('15.5555555555556')
  expect(formatAnalysisFullNumber(0.1+0.2)).toBe('0.3')
  expect(formatAnalysisFullNumber(-0)).toBe('0')
  expect(formatAnalysisFullNumber(1234.567)).toBe('1234.567')
  expect(formatAnalysisFullNumber(3/13*100,' %')).toBe('23.0769230769231 %')
  expect(formatAnalysisFullNumber(11.6666666667,' %')).toBe('11.6666666667 %')
 })
 it('no convierte un resultado finito extremo en Infinity al redondear la copia',()=>{
  expect(formatAnalysisFullNumber(Number.MAX_VALUE)).toBe('1.79769313486232e+308')
  expect(formatAnalysisFullNumber(-Number.MAX_VALUE,' %')).toBe('-1.79769313486232e+308 %')
 })
 it('copia varios números completos y conserva literalmente los separadores nativos recibidos',()=>{
  expect(copyAnalysisFragments([
   {kind:'text',text:'"4"\t'},
   {kind:'number',value:3},
   {kind:'text',text:'\t'},
   {kind:'number',value:3/13*100,unit:' %'},
   {kind:'text',text:'\t'},
   {kind:'number',value:2},
   {kind:'text',text:'\nID:00123\n'},
  ])).toBe('"4"\t3\t23.0769230769231 %\t2\nID:00123\n')
 })
 it('un fragmento numérico identificado por DOM copia su dato completo, no el recorte visual',()=>{
  expect(copyAnalysisFragments([{kind:'text',text:'Media: '},{kind:'number',value:140/9},{kind:'text',text:';'}])).toBe('Media: 15.5555555555556;')
 })
 it('no convierte texto, identificadores, fechas ni cifras sin metadato numérico',()=>{
  const text='00123\t90071992547409931234\t0.30000000000000004\t2026-11-23\n'
  expect(copyAnalysisFragments([{kind:'text',text}])).toBe(text)
 })
 it('no modifica los fragmentos ni sus valores crudos',()=>{
  const parts=[{kind:'text' as const,text:'n='},{kind:'number' as const,value:0.1+0.2}]
  const before=structuredClone(parts)
  expect(copyAnalysisFragments(parts)).toBe('n=0.3')
  expect(parts).toEqual(before)
 })
})
