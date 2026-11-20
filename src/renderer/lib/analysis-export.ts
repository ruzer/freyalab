import type {ControlReason} from './control-hint'

export interface AnalysisExportAction {
 label:string
 disabledReason:ControlReason|null
 run:()=>void|Promise<void>
 title?:string
 separator?:boolean
}
