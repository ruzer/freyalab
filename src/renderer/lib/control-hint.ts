import {t} from './i18n.svelte'
export const controlReasons=["noDocument","readonly","busy","saved","textExport","markdownOnly","textLimit","pandoc","loading","selection","columns","oneColumn","name","configuration","headers","confirmHeaders","sampleView","result","refresh","firstPage","lastPage","zoomMin","zoomMax","parameters","largeUnsupported","columnLimit","noRows","findText","external","preview","noChanges","fileReady","filterLimit","sortLimit","invalidDiagram","folder","noSkipped","scope","correlation","query","cancelPending","heatCount","context"] as const
export type ControlReason=typeof controlReasons[number]
// Una descripción compartida por motivo; no crear ni observar nodos por botón.
export function controlHint(reason:ControlReason|null|false|undefined,title?:string){
 return{title:reason?`${title?title+' · ':''}${t('ui.reason.'+reason)}`:title,'aria-describedby':reason?'control-reason-'+reason:undefined}
}
