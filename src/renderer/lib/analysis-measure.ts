export function analysisMeasure(phase:string,started:number,detail:Record<string,number|string>={}){
 if(Reflect.get(globalThis,'freyaAnalysisProfile')!==true)return
 const name='freya.analysis.'+phase
 performance.clearMeasures(name)
 performance.measure(name,{start:started,end:performance.now(),detail})
}
