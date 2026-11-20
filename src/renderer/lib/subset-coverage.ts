import {t,formatNumber,type Language} from '../../shared/i18n'
import type {ProjectRecipe,ProjectRecipeDraft,ProjectRecipeStep} from '../../shared/project'
import type {RecipeOperationResult} from '../../shared/recipe-operation'

export type SubsetCoverageResult=Pick<RecipeOperationResult,'scanned'|'resultCount'|'complete'|'cancelled'|'sampling'>&Partial<Pick<RecipeOperationResult,'bytesRead'|'sha256'>>

export function subsetCoverage(result:SubsetCoverageResult,steps:readonly ProjectRecipeStep[],language:Language,stepOwners:readonly string[]=[]):{lines:string[];identity:string}{
 const number=(value:number)=>formatNumber(value,undefined,language)
 const complete=result.complete&&!result.cancelled
 const lines:string[]=[]
 const sample=result.sampling.length===1?result.sampling[0]:undefined
 const prefix=sample?.method==='first'&&!steps.slice(sample.step+1).some(step=>step.op==='filter'||step.op==='sample')
 if(!complete)lines.push(t(result.cancelled?'subset.coverageCancelled':prefix?'subset.coverageFirst':'subset.coveragePartial',{n:number(result.resultCount),scanned:number(result.scanned)},language))
 else if(!result.sampling.length)lines.push(t(result.resultCount===result.scanned&&!steps.some(step=>step.op==='filter')?'subset.coverageAll':'subset.coverageFiltered',{n:number(result.resultCount),total:number(result.scanned)},language))
 for(const sample of result.sampling){
  const key=complete?sample.method==='first'?'subset.coverageOrderedFirst':sample.percent===undefined?'subset.coverageRandomRows':'subset.coverageRandomPercent':sample.method==='first'?'subset.coveragePartialFirst':sample.percent===undefined?'subset.coveragePartialRandomRows':'subset.coveragePartialRandomPercent'
  let coverage=t(key,{n:number(sample.selected),eligible:number(sample.eligible),percent:number(sample.percent??0),seed:String(sample.seed??0),requested:number(sample.requestedRows??sample.selected)},language)
  if(complete&&sample.requestedRows!==undefined&&sample.requestedRows>sample.eligible)coverage+=' '+t('subset.tooFewRows',{requested:number(sample.requestedRows),available:number(sample.eligible)},language)
  const owner=stepOwners[sample.step]
  lines.push(result.sampling.length>1&&owner!==undefined?t('subset.coverageInSubset',{name:owner,coverage},language):coverage)
 }
 if(complete&&result.sampling.length)lines.push(t('subset.examined',{n:number(result.scanned)},language))
 const identity=complete||result.sha256?t('subset.verifiedIdentity',{},language):[result.bytesRead===undefined?'':t('subset.bytesRead',{n:number(result.bytesRead)},language),t('subset.partialIdentity',{},language)].filter(Boolean).join(' · ')
 return{lines,identity}
}

export function subsetStepOwners(recipe:ProjectRecipeDraft,recipes:readonly ProjectRecipe[]):{steps:ProjectRecipeStep[];stepOwners:string[]}{
 const chain:(ProjectRecipeDraft|ProjectRecipe)[]=[recipe],seen=new Set(recipe.id?[recipe.id]:[])
 let current:ProjectRecipeDraft|ProjectRecipe=recipe
 // La ejecución valida la cadena; aquí se etiqueta con el mismo tope para evitar bucles al editar.
 while('baseRecipeId' in current&&chain.length<8){
  const id:string=current.baseRecipeId,parent:ProjectRecipe|undefined=recipes.find(value=>value.id===id)
  if(!parent||seen.has(parent.id))break
  seen.add(parent.id);chain.unshift(parent);current=parent
 }
 return{steps:chain.flatMap(value=>value.steps),stepOwners:chain.flatMap(value=>value.steps.map(()=>value.name))}
}
