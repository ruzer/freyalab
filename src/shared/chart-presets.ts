import type {ChartOptions} from './charts'
import type {TableQuery,TableConditionGroup} from './types'
export type ChartView=Pick<TableQuery,'search'|'filters'|'conditions'|'filterMode'>
export interface ChartConfiguration {headers:string[];options:ChartOptions;where:TableConditionGroup;view?:ChartView}
export interface ChartPreset {id:string;name:string;createdAt:string;configuration:ChartConfiguration}
export function chartView(query:TableQuery):ChartView {
 const {search,filters,conditions,filterMode}=query
 return structuredClone({search,filters,conditions,filterMode})
}
export function matchingChartHeaders(saved:string[],current:string[]){return saved.length===current.length&&saved.every((name,index)=>name===current[index])}
export function ambiguousChartHeaders(headers:string[]){return headers.some(name=>!name.trim())||new Set(headers).size!==headers.length}
