import {describe,it,expect} from 'vitest'
import {formatAnalysisNumber,formatAnalysisFullNumber,copyAnalysisFragments} from '../src/shared/analysis-number-format'

// El contrato Auto/All y la copia del resultado sustituyen la política anterior.
// Los rojos y verdes de aquella fase se conservan como evidencia histórica.
describe('SIM-3d · precisión de presentación y copia',()=>{
 it.each([
  [5.52264150943,'5.52'],[12,'12'],[12.1,'12.1'],[0,'0'],
  [0.0004123,'0.00041'],[-0.0004123,'-0.00041'],[0.009876,'0.0099'],
 ] as const)('Automático general: %s se presenta como%s', (value,expected)=>{
  expect(formatAnalysisNumber(value,'auto','es')).toBe(expected)
 })
 it.each([
  [5.52264150943,'5.52264150943'],[140/9,'15.5555555555556'],
  [0.1+0.2,'0.3'],[-0,'0'],[12,'12'],
 ] as const)('Más precisión: %s usa hasta15 cifras significativas', (value,expected)=>{
  expect(formatAnalysisNumber(value,'all','es')).toBe(expected)
 })
 it('Automático es el valor por omisión y conserva conteos enteros sin relleno',()=>{
  expect(formatAnalysisNumber(5.52264150943)).toBe('5.52')
  expect(formatAnalysisNumber(12,'auto','es','count')).toBe('12')
  expect(formatAnalysisNumber(0,'auto','es','count')).toBe('0')
  expect(formatAnalysisNumber(1234567890123456,'auto','es','count')).toBe('1,234,567,890,123,456')
 })
 it.each([
  [0.123456,'0.123'],[-0.123456,'-0.123'],[1.23456,'1.235'],
  [0.9999,'0.9999'],[-0.9999,'-0.9999'],[1.0001,'1.0001'],[-1.0001,'-1.0001'],
  [0.9999999999999999,'0.9999999999999999'],[-0.9999999999999999,'-0.9999999999999999'],
  [1.0000000000000002,'1.0000000000000002'],[-1.0000000000000002,'-1.0000000000000002'],
  [1,'1'],[-1,'-1'],
 ] as const)('Automático coeficiente: %s evita un extremo falso y muestra%s', (value,expected)=>{
  expect(formatAnalysisNumber(value,'auto','es','coefficient')).toBe(expected)
 })
 it.each([
  [11.6666666667,'11.67'],[99.9999,'99.9999'],[100.0001,'100.0001'],
  [99.99999999999999,'99.99999999999999'],[100.00000000000001,'100.00000000000001'],
  [100,'100'],[0,'0'],
 ] as const)('Automático porcentaje: %s evita cien falso y muestra%s', (value,expected)=>{
  expect(formatAnalysisNumber(value,'auto','es','percent')).toBe(expected)
 })
 it('las guardas de extremos de Automático no cambian el contrato de Más precisión',()=>{
  expect(formatAnalysisNumber(0.9999999999999999,'all','es','coefficient')).toBe('1')
  expect(formatAnalysisNumber(99.99999999999999,'all','es','percent')).toBe('100')
 })
 it('no presenta números no nulos como0 ni pierde el signo de un número pequeño',()=>{
  expect(formatAnalysisNumber(-0,'auto','es')).toBe('0')
  for(const value of [Number.MIN_VALUE,-Number.MIN_VALUE,1e-30,-1e-30]){
   for(const kind of ['number','coefficient','percent'] as const){
    const text=formatAnalysisNumber(value,'auto','es',kind)
    expect(text).not.toBe('0');expect(text).not.toBe('-0')
    expect(Math.sign(Number(text.replaceAll(',','')))).toBe(Math.sign(value))
   }
  }
 })
 it('usa el formato compartido del idioma y conserva punto decimal',()=>{
  for(const language of ['es','en','en-XA'] as const){
   expect(formatAnalysisNumber(1234.567,'auto',language)).toBe('1,234.57')
   expect(formatAnalysisNumber(-0.9999,'auto',language,'coefficient')).toBe('-0.9999')
   expect(formatAnalysisNumber(99.9999,'auto',language,'percent')).toBe('99.9999')
   expect(formatAnalysisNumber(0.1+0.2,'all',language)).toBe('0.3')
  }
 })
 it('ayuda/copia conservan String del resultado sin redondear ni agrupar y con unidad',()=>{
  expect(formatAnalysisFullNumber(140/9)).toBe('15.555555555555555')
  expect(formatAnalysisFullNumber(0.1+0.2)).toBe('0.30000000000000004')
  expect(formatAnalysisFullNumber(-0)).toBe('0')
  expect(formatAnalysisFullNumber(1234.567)).toBe('1234.567')
  expect(formatAnalysisFullNumber(1234567890123456)).toBe('1234567890123456')
  expect(formatAnalysisFullNumber(5.52264150943)).toBe('5.52264150943')
  expect(formatAnalysisFullNumber(3/13*100,' %')).toBe('23.076923076923077 %')
  expect(formatAnalysisFullNumber(11.6666666667,' %')).toBe('11.6666666667 %')
 })
 it('copia los extremos finitos y subnormales tal como los representa el resultado',()=>{
  expect(formatAnalysisFullNumber(Number.MAX_VALUE)).toBe('1.7976931348623157e+308')
  expect(formatAnalysisFullNumber(-Number.MAX_VALUE,' %')).toBe('-1.7976931348623157e+308 %')
  expect(formatAnalysisFullNumber(Number.MIN_VALUE)).toBe('5e-324')
  expect(formatAnalysisFullNumber(-Number.MIN_VALUE)).toBe('-5e-324')
 })
 it('conserva literalmente la cadena numérica del motor en la salida completa',()=>{
  expect(formatAnalysisFullNumber('12345678901234567890.12')).toBe('12345678901234567890.12')
  expect(formatAnalysisFullNumber('5.0',' %')).toBe('5.0 %')
 })
 it('conserva cadenas numéricas del motor y separadores en fragmentos sin convertir sus datos',()=>{
  const parts=[{kind:'text' as const,text:'Resultado\t'},{kind:'number' as const,value:'12345678901234567890.12'},{kind:'text' as const,text:'\t'},{kind:'number' as const,value:'5.0',unit:' %'}]
  const before=structuredClone(parts)
  expect(copyAnalysisFragments(parts)).toBe('Resultado\t12345678901234567890.12\t5.0 %')
  expect(parts).toEqual(before)
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
  ])).toBe('"4"\t3\t23.076923076923077 %\t2\nID:00123\n')
 })
 it('un fragmento numérico identificado por DOM copia su dato completo, no el recorte visual',()=>{
  expect(copyAnalysisFragments([{kind:'text',text:'Media: '},{kind:'number',value:140/9},{kind:'text',text:';'}])).toBe('Media: 15.555555555555555;')
 })
 it('no convierte texto, identificadores, fechas ni cifras sin metadato numérico',()=>{
  const text='00123\t90071992547409931234\t0.30000000000000004\t2026-11-23\n'
  expect(copyAnalysisFragments([{kind:'text',text}])).toBe(text)
 })
 it('no modifica los fragmentos ni sus valores crudos',()=>{
  const parts=[{kind:'text' as const,text:'n='},{kind:'number' as const,value:0.1+0.2}]
  const before=structuredClone(parts)
  expect(copyAnalysisFragments(parts)).toBe('n=0.30000000000000004')
  expect(parts).toEqual(before)
 })
})
