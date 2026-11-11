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
 // requestId 0 mantiene el alcance desconocido hasta recibir una página del motor.
 return{query,queryValid:false,columns:[],range:null,viewMeta:{matched:0,revision:doc.revision,requestId:0,sample:false,query}}
}

export function csvAnalysisSample(doc:Pick<DocumentInfo,'revision'>,viewMeta:TableViewMeta):boolean|undefined{
 if(viewMeta.requestId<=0||viewMeta.revision!==doc.revision)return undefined
 return viewMeta.sample
}
