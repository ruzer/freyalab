import {SvelteMap} from 'svelte/reactivity'
import type {DocumentInfo,TableQuery,TableRange,TableViewMeta} from '../../shared/types'

export interface CsvAnalysisView {
 query:TableQuery
 queryValid:boolean
 columns:number[]
 range:TableRange|null
 viewMeta:TableViewMeta
}

export const csvAnalysisViews=new SvelteMap<string,CsvAnalysisView>()

export function emptyCsvAnalysisView(doc:DocumentInfo):CsvAnalysisView{
 const query={offset:0,limit:200,requestId:0}
 return{query,queryValid:false,columns:[],range:null,viewMeta:{matched:0,revision:doc.revision,requestId:0,sample:doc.readonly,query}}
}
