import type {TableConditionGroup} from './types'
export const filterOperators=[['contains','Contiene'],['equals','Es igual a'],['notEquals','No es igual a'],['starts','Empieza por'],['ends','Termina en'],['empty','Está vacío'],['notEmpty','No está vacío'],['greater','Mayor que'],['greaterEqual','Mayor o igual'],['less','Menor que'],['lessEqual','Menor o igual'],['dateBefore','Fecha anterior a'],['dateOn','Fecha igual a'],['dateAfter','Fecha posterior a'],['regex','Expresión regular (RE2)']] as const
export function describeConditions(headers:string[],group:TableConditionGroup){
 const labels=Object.fromEntries(filterOperators)
 return(group.filterMode==='all'?'Todas las condiciones (Y): ':'Cualquier condición (O): ')+group.conditions.map(rule=>`${rule.column+1}. ${headers[rule.column]||'Sin encabezado'} ${labels[rule.op]}${['empty','notEmpty'].includes(rule.op)?'':` ${JSON.stringify(rule.value??'')}`}${rule.caseSensitive&&['contains','equals','notEquals','starts','ends','regex'].includes(rule.op)?' (distingue mayúsculas)':''}`).join('; ')
}
