import {describe,it,expect} from 'vitest'
import {descriptive} from '../src/main/table-analysis'

describe('descriptivas compartidas: varianzas y percentiles',()=>{
 it('interpola percentiles tipo 7 conocidos y no cambia el orden de entrada',()=>{
  const values=[30,0,20,10],before=[...values];Object.freeze(values)
  const result=descriptive(values)
  expect(result).toMatchObject({sum:60,average:15,min:0,max:30,median:15,variance:125,percentile25:7.5,percentile75:22.5,percentile90:27})
  expect(result.percentile10).toBeCloseTo(3,12);expect(result.sampleVariance).toBeCloseTo(500/3,12)
  expect(result.deviation).toBeCloseTo(Math.sqrt(125),12);expect(result.sampleDeviation).toBeCloseTo(Math.sqrt(500/3),12)
  expect(values).toEqual(before)
 })
 it('incluye ceros, negativos y decimales en los mismos cálculos aproximados',()=>{
  const result=descriptive([-.5,-2.5,.5,-1.5])
  expect(result).toMatchObject({sum:-4,average:-1,median:-1,variance:1.25,percentile25:-1.75,percentile75:-.25})
  expect(result.sampleVariance).toBeCloseTo(5/3,12);expect(result.percentile10).toBeCloseTo(-2.2,12);expect(result.percentile90).toBeCloseTo(.2,12)
  expect(descriptive([-2,0,2])).toMatchObject({variance:8/3,sampleVariance:4,percentile10:-1.6,percentile25:-1,median:0,percentile75:1,percentile90:1.6})
 })
 it.each([{name:'una cifra',values:[7]},{name:'una constante',values:[7,7,7]}])('$name conserva varianzas y percentiles definidos',({values})=>{
  const result=descriptive(values)
  expect(result).toMatchObject({variance:0,sampleVariance:values.length>1?0:null,deviation:0,sampleDeviation:values.length>1?0:null,percentile10:7,percentile25:7,median:7,percentile75:7,percentile90:7})
 })
 it('sin datos no inventa ceros ni ejecuta estadísticos que requieren observaciones',()=>{
  expect(descriptive([])).toEqual({sum:null,average:null,min:null,max:null,median:null,deviation:null,sampleDeviation:null,variance:null,sampleVariance:null,percentile10:null,percentile25:null,percentile75:null,percentile90:null})
 })
 it('conserva no disponible cuando los cálculos exceden la representación numérica',()=>{
  const result=descriptive([-1e308,1e308])
  expect(result).toMatchObject({variance:null,sampleVariance:null,deviation:null,sampleDeviation:null,percentile10:null,percentile25:null,median:null,percentile75:null,percentile90:null})
  expect(Object.values(result).every(value=>value===null||Number.isFinite(value))).toBe(true)
 })
})
