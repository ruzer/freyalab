import { TableEngine } from './table-engine'
const engine = new TableEngine()
const allowed = new Set(['open','create','info','rangePreview','rangeClipboard','clipboard','page','edit','undo','stats','markdown','serialize','snapshot','restore','markSaved','close','checkpoint'])
const port = process.parentPort
if (!port) throw new Error('El motor tabular necesita un proceso de datos Electron.')
port.on('message', async ({data}: {data:{requestId:number;method:string;args:unknown[]}}) => {
 const {requestId,method,args}=data
 try {
  if(!Number.isSafeInteger(requestId)||!allowed.has(method)||!Array.isArray(args))throw new Error('Solicitud de tabla no válida.')
  const result=method==='checkpoint'
   ? JSON.stringify({version:1,info:args[1],savedAt:new Date().toISOString(),snapshot:await engine.snapshot(String(args[0]))})
   : await (engine[method as keyof TableEngine] as (...values:unknown[])=>Promise<unknown>).apply(engine,args)
  port.postMessage({requestId,result})
 } catch(error){port.postMessage({requestId,error:error instanceof Error?error.message:String(error)})}
})
