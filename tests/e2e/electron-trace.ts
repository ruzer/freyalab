import type {BrowserContext,TestInfo} from '@playwright/test'

type TraceInfo=Pick<TestInfo,'status'|'annotations'|'outputPath'|'attach'>

// La traza automática no observa el contexto creado por Electron.
export async function traceElectronFailure(context:Pick<BrowserContext,'tracing'>,info:TraceInfo){
 const unavailable=(phase:string)=>{info.annotations.push({type:'electron-trace',description:`No se pudo ${phase} la traza del contexto de Electron.`})}
 try{await context.tracing.start({screenshots:true,snapshots:true,sources:true})}
 catch{unavailable('iniciar');return async()=>{}}
 return async()=>{
  let phase='terminar'
  try{
   if(info.status==='failed'||info.status==='timedOut'||info.status==='interrupted'){
    const path=info.outputPath('electron-context.zip')
    await context.tracing.stop({path})
    phase='adjuntar';await info.attach('electron-context',{path,contentType:'application/zip'})
   }else await context.tracing.stop()
  }catch{unavailable(phase)}
 }
}
