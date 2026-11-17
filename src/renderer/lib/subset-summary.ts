import {t,formatNumber,type Language} from '../../shared/i18n'
import type {ProjectRecipeStep,ProjectColumn} from '../../shared/project'

const comparisonSymbols=new Map([['equals','='],['notEquals','≠'],['greater','>'],['greaterEqual','≥'],['less','<'],['lessEqual','≤']])

export function subsetSummary(steps:ProjectRecipeStep[],language:Language){
 const name=(column:ProjectColumn)=>column.name||t('csvFields.column',{n:column.position},language)
 return steps.map(step=>{
  if(step.op==='filter')return step.conditions.map(rule=>`${name(rule.column)} ${comparisonSymbols.get(rule.op)??t('charts.filter.op.'+rule.op,{},language)}${['empty','notEmpty'].includes(rule.op)?'':' '+rule.value}`).join(step.mode==='all'?' ∧ ':' ∨ ')
  if(step.op==='order')return step.by.map(rule=>`${name(rule.column)} ${rule.descending?'↓':'↑'}`).join(', ')
  if(step.op==='select')return t('subset.summaryColumns',{n:formatNumber(step.columns.length,{},language)},language)
  return t(step.method==='first'?'subset.summaryFirst':'rows' in step?'subset.summaryRandomRows':'subset.summaryRandomPercent',{n:formatNumber('rows' in step?step.rows:step.percent,{},language),seed:'seed' in step?String(step.seed):''},language)
 }).join(' · ')
}
