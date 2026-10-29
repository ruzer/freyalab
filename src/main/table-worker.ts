import { TableEngine } from './table-engine'
const allowed = new Set(['analysisStart','analysisNext','analysisClose','open','cancelOpen','create','info','transformPreview','rangePreview','rangeClipboard','clipboard','page','viewStart','viewState','viewCancel','viewClear','edit','undo','stats','analyzeColumn','cancelAnalysis','operation','cancelOperation','markdown','serialize','snapshot','restore','markSaved','close','checkpoint'])
const port = process.parentPort
if (!port) throw new Error('El motor tabular necesita un proceso de datos Electron.')
// FREYALAB_LARGE_BYTES solo se atiende en las pruebas: fuerza el modo grande con archivos pequeños.
const forced = process.env.FREYALAB_TEST === '1' ? Number(process.env.FREYALAB_LARGE_BYTES) : 0
// Igual que FREYALAB_LARGE_BYTES: solo las pruebas fuerzan lotes pequeños y una pausa por lote para poder cancelar una extracción.
const testing = process.env.FREYALAB_TEST === '1'
const engine = new TableEngine(progress=>port.postMessage({progress}), {viewWorkerPath:new URL('./large-search-worker.js',import.meta.url),...(forced > 0 ? {largeBytes: forced} : {}), ...(testing ? {extractBatch: Number(process.env.FREYALAB_EXTRACT_BATCH) || undefined, extractDelayMs: Number(process.env.FREYALAB_EXTRACT_DELAY_MS) || undefined,viewWorkers:Number(process.env.FREYALAB_VIEW_WORKERS)||undefined,viewBatch:Number(process.env.FREYALAB_VIEW_BATCH)||undefined,viewChunk:Number(process.env.FREYALAB_VIEW_CHUNK)||undefined,viewDelayMs:Number(process.env.FREYALAB_VIEW_DELAY_MS)||undefined,viewLimit:Number(process.env.FREYALAB_VIEW_LIMIT)||undefined,viewBytes:Number(process.env.FREYALAB_VIEW_BYTES)||undefined} : {})})
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
