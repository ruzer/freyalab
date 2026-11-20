import {expect,it} from 'vitest'
import type {ProjectResult,ProjectRecipe} from '../src/shared/project'
import {resultCoverage,projectResultSummary,projectResultWarnings} from '../src/renderer/lib/project-result'
import {subsetCoverage} from '../src/renderer/lib/subset-coverage'

const date='2026-11-19T00:00:00.000Z',sha='a'.repeat(64)
const first:ProjectRecipe={id:'first',name:'Primeras cinco',sourceId:'source',sourceSha256:sha,semantics:1,createdAt:date,steps:[{op:'sample',method:'first',rows:5}]}
const second:ProjectRecipe={...first,id:'sample',name:'Dos al azar',sourceId:undefined,baseRecipeId:'first',steps:[{op:'sample',method:'random',rows:2,seed:7}]} as ProjectRecipe
const stages=[{step:0,method:'first' as const,requestedRows:5,eligible:5,selected:5},{step:1,method:'random' as const,requestedRows:2,seed:7,eligible:5,selected:2}]
const result:ProjectResult={id:'output',kind:'extract',recipeId:'sample',path:'02_datasets/dos.csv',bytes:100,sha256:sha,createdAt:date,provenance:{sourceSha256:sha,executedAt:date,engine:{app:'test',contract:'PRJ-03',semantics:1},coverage:{kind:'sample',matched:2,scanned:5,complete:false,samplingStages:stages},chain:['first','sample'],recipeSha256:{first:sha,sample:sha},fidelity:{level:'values',normalization:['Aviso'],irregularRows:0},warnings:['Aviso','Otro'],snapshot:{sourceName:'censo.csv',columns:['ID','Edad'],recipes:[first,second]}}}

it('reutiliza los contadores históricos exactos de Probar sin inventar un total por verificar los bytes',()=>{
 const input=JSON.stringify(result),steps=[...first.steps,...second.steps]
 const expected=subsetCoverage({scanned:5,resultCount:2,complete:false,cancelled:false,sha256:sha,sampling:stages},steps,'es',['Primeras cinco','Dos al azar'])
 expect(resultCoverage(result,'es')).toEqual(expected)
 expect(expected.lines[0]).toContain('total no determinado');expect(expected.identity).toBe('Fuente verificada por completo')
 expect(JSON.stringify(result)).toBe(input)
})
it('explica resultados antiguos sin reconstruir pasos ni contadores que no se guardaron',()=>{
 const old=structuredClone(result);delete old.provenance.snapshot;delete old.provenance.coverage.samplingStages
 const es=projectResultSummary(old,'es'),en=projectResultSummary(old,'en')
 expect(es).toContain('2');expect(es).toContain('total no determinado');expect(es).toContain('No se registraron las condiciones originales.')
 expect(es).not.toContain('Primeras cinco');expect(es).not.toContain('semilla 7');expect(en).toContain('original conditions')
})
it('una muestra histórica completa sin etapas solo muestra la cantidad que sí consta',()=>{
 const old=structuredClone(result);old.provenance.coverage.complete=true;delete old.provenance.coverage.samplingStages
 const coverage=resultCoverage(old,'es');expect(coverage.lines).toHaveLength(1);expect(coverage.lines[0]).toContain('2');expect(coverage.lines[0]).not.toContain('de las')
})
it('describe la instantánea independiente del nombre actual y conserva el idioma y las advertencias únicas',()=>{
 const before=JSON.stringify(result),es=projectResultSummary(result,'es'),en=projectResultSummary(result,'en'),pseudo=projectResultSummary(result,'en-XA')
 expect(es).toContain('Dos al azar');expect(es).toContain('2 columnas');expect(en).toContain('2 columns');expect(pseudo).toContain('Dos al azar');expect(pseudo).not.toMatch(/\{[^}]+\}/)
 expect(projectResultWarnings(result)).toEqual(['Aviso','Otro']);expect(JSON.stringify(result)).toBe(before)
})
