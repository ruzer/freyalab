import type {ProjectResult} from '../../shared/project'
import type {ProjectExportOutcome} from '../../shared/project-exports'
import type {RecipeOperationProgress} from '../../shared/recipe-operation'
import {t,plural,formatNumber,type Language} from '../../shared/i18n'
import {subsetCoverage} from './subset-coverage'
import {subsetSummary} from './subset-summary'

export interface ProjectExportJob {
 requestId:string;projectId:string;recipeId:string;name:string;running:boolean
 progress:RecipeOperationProgress;outcome?:ProjectExportOutcome;error?:string
}

export function resultCoverage(result:ProjectResult,language:Language){
 const coverage=result.provenance.coverage,snapshot=result.provenance.snapshot,steps=snapshot?.recipes.flatMap(recipe=>recipe.steps)??[]
 if(snapshot&&(!steps.some(step=>step.op==='sample')||coverage.samplingStages))return subsetCoverage({scanned:coverage.scanned,resultCount:coverage.matched,complete:coverage.complete,cancelled:false,sha256:result.provenance.sourceSha256,sampling:coverage.samplingStages??[]},steps,language,snapshot.recipes.flatMap(recipe=>recipe.steps.map(()=>recipe.name)))
 const key=coverage.kind==='full'?'subset.coverageAll':coverage.kind==='filtered'?'subset.coverageFiltered':coverage.complete?'project.result.oldSample':'subset.coveragePartial'
 return{lines:[t(key,{n:formatNumber(coverage.matched,undefined,language),total:formatNumber(coverage.scanned,undefined,language),scanned:formatNumber(coverage.scanned,undefined,language)},language)],identity:t('subset.verifiedIdentity',{},language)}
}

export function projectResultSummary(result:ProjectResult,language:Language){
 const snapshot=result.provenance.snapshot,coverage=resultCoverage(result,language),steps=snapshot?.recipes.flatMap(recipe=>recipe.steps)
 return [...coverage.lines,steps?subsetSummary(steps,language):t('project.result.noHistory',{},language),snapshot?plural('project.result.columns',snapshot.columns.length,{},language):'',t('project.result.fidelity.'+result.provenance.fidelity.level,{},language)].filter(Boolean).join(' · ')
}

export const projectResultWarnings=(result:ProjectResult)=>[...new Set([...result.provenance.fidelity.normalization,...result.provenance.warnings])]
