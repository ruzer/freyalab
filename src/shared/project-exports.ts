import type {ProjectResult} from './project'

export type ProjectResultView=ProjectResult&{
 name:string;status:'verified'|'changed'|'missing'|'unknown';isSource:boolean;documentId?:string;reason?:string
}
export type ProjectExportOutcome=
 |{status:'registered';result:ProjectResultView}
 |{status:'unregistered';result:ProjectResultView;error:string}
 |{status:'cancelled'}
