import {it,expect} from 'vitest'
import {createHash} from 'node:crypto'
import baseline from './fixtures/chart-sql-f2a-baseline.json' with {type:'json'}
import {chartSQL,type ChartOptions} from '../src/shared/charts'
// Baseline capturada del generador de main 05212fd, no de la implementación bajo prueba.
it.each(baseline.cases)('conserva literalmente el SQL del formulario: $name',({options,sha256})=>{
 expect(createHash('sha256').update(chartSQL(baseline.headers,options as ChartOptions)).digest('hex')).toBe(sha256)
})
