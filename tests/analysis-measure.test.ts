import {afterEach,expect,it} from 'vitest'
import {analysisMeasure} from '../src/renderer/lib/analysis-measure'

afterEach(()=>{Reflect.deleteProperty(globalThis,'freyaAnalysisProfile');performance.clearMeasures('freya.analysis.profiles');performance.clearMeasures('freya.analysis.chartRows')})
it('no publica medidas del navegador sin activar el perfil de prueba',()=>{
 analysisMeasure('profiles',performance.now(),{columns:200})
 expect(performance.getEntriesByName('freya.analysis.profiles')).toEqual([])
})
it('conserva solo la última medida de cada fase y sus contadores',()=>{
 Reflect.set(globalThis,'freyaAnalysisProfile',true)
 analysisMeasure('profiles',performance.now(),{columns:1})
 analysisMeasure('profiles',performance.now(),{columns:200})
 analysisMeasure('chartRows',performance.now(),{rows:2000})
 const entries=performance.getEntriesByName('freya.analysis.profiles') as PerformanceMeasure[]
 expect(entries).toHaveLength(1);expect(entries[0].detail).toEqual({columns:200});expect(entries[0].duration).toBeGreaterThanOrEqual(0)
 expect(performance.getEntriesByName('freya.analysis.chartRows')).toHaveLength(1)
})
