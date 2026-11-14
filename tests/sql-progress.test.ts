import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {setLanguage} from '../src/shared/i18n'
import type {SqlProgress} from '../src/shared/types'
import type {Documents} from '../src/main/documents'

const native=vi.hoisted(()=>({
 progress:[] as SqlProgress[],stages:[] as {stage:string;phase:string|undefined}[],destroyed:0,
 append:async()=>{},queryError:'',closed:()=>{}
}))
vi.mock('electron',()=>({
 app:{commandLine:{hasSwitch:()=>false}},protocol:{registerSchemesAsPrivileged:()=>{}},net:{fetch:vi.fn()},
 session:{fromPartition:()=>({protocol:{handle:()=>{}},webRequest:{onBeforeRequest:()=>{}},setPermissionRequestHandler:()=>{},setPermissionCheckHandler:()=>{}})},
 BrowserWindow:class{
  webContents={setWindowOpenHandler:()=>{},on:()=>{},executeJavaScript:async(script:string)=>{
   const phase=native.progress.at(-1)?.phase
   if(script.startsWith('new Promise')){native.stages.push({stage:'engine-ready',phase});return true}
   const method=script.match(/globalThis\.freyaSQL\.(\w+)\(/)?.[1]
   if(method==='append'){native.stages.push({stage:'append',phase});await native.append()}
   if(method==='seal')return 'fixture-version'
   if(method==='query'){
    native.stages.push({stage:'query',phase})
    if(native.queryError)throw new Error(native.queryError)
    return{columns:[{name:'total',type:'BIGINT'}],rows:[['2400']],limited:false}
   }
  }}
  async loadURL(){}
  destroy(){native.destroyed++}
 }
}))
import {SqlService} from '../src/main/sql-service'

let service:SqlService
beforeEach(()=>{
 native.progress.length=0;native.stages.length=0;native.destroyed=0;native.queryError='';native.append=async()=>{};native.closed=()=>{}
 setLanguage('es')
 const record={info:{id:'csv',name:'ventas.csv',kind:'csv',revision:0,readonly:false,path:null}}
 let next=0
 const docs={get:()=>record,table:{call:async(method:string)=>{
  if(method==='analysisStart'){native.stages.push({stage:'source-start',phase:native.progress.at(-1)?.phase});return{headers:['ID'],revision:0,readonly:false}}
  if(method==='analysisNext'){const rows=[1000,1000,400][next++];return rows?{done:false,rows,data:new Uint8Array([1,2,3])}:{done:true,rows:0}}
  if(method==='analysisClose')native.closed()
 }}}
 service=new SqlService(docs as unknown as Documents,event=>native.progress.push(event))
})
afterEach(()=>{service.stop();setLanguage('es')})

const request={requestId:'progress',sources:[{id:'csv',revision:0}],sql:'SELECT count(*) AS total FROM datos'}
const expected:{[key in 'es'|'en']:string[]}={
 es:['Preparando motor local','Cargando los datos','Ejecutando la consulta','Preparando los resultados'],
 en:['Preparing local engine','Loading data','Running the query','Preparing results']
}

it.each(['es','en','en-XA'] as const)('%s: una fuente de 2400 filas anuncia su fase real antes de cargar, consultar y entregar',async language=>{
 setLanguage(language)
 const result=await service.run(request)
 native.stages.push({stage:'delivered',phase:native.progress.at(-1)?.phase})
 const phases=native.progress.map(event=>event.phase),unique=phases.filter((phase,index)=>index===0||phase!==phases[index-1])
 if(language==='en-XA'){
  expect(unique).toHaveLength(4)
  for(const phase of unique){expect(phase).toMatch(/^\[.+~+\]$/);expect(phase).not.toContain('analysis.progress.')}
 }else expect(unique).toEqual(expected[language])
 const [engine,loading,query,results]=language==='en-XA'?unique:expected[language]
 expect(native.stages).toEqual([
  {stage:'engine-ready',phase:engine},{stage:'source-start',phase:loading},
  {stage:'append',phase:loading},{stage:'append',phase:loading},{stage:'append',phase:loading},
  {stage:'query',phase:query},{stage:'delivered',phase:results}
 ])
 expect(native.progress.every(event=>event.requestId===request.requestId)).toBe(true)
 expect(native.progress.find(event=>event.phase===query)?.rows).toBe(2400)
 expect(native.progress.at(-1)?.rows).toBe(2400)
 expect(result).toMatchObject({rows:[['2400']],returnedRows:1,sources:[{rows:2400}],offset:0})
 expect(native.destroyed).toBe(1)
})

it('un error de consulta se conserva y no anuncia entrega de resultados',async()=>{
 native.queryError='Consulta rechazada'
 await expect(service.run(request)).rejects.toThrow('Consulta rechazada')
 expect(native.progress.map(event=>event.phase)).not.toContain(expected.es[3])
 expect(native.destroyed).toBe(1)
})

it('cancelar durante la carga conserva el rechazo y no anuncia consulta ni resultados tardíos',async()=>{
 let entered!:()=>void,release!:()=>void,closed!:()=>void
 let progressAtCancel=0
 const appending=new Promise<void>(resolve=>entered=resolve),hold=new Promise<void>(resolve=>release=resolve),finished=new Promise<void>(resolve=>closed=resolve)
 native.append=async()=>{entered();await hold};native.closed=closed
 const running=service.run(request),rejected=expect(running).rejects.toThrow('Análisis cancelado.')
 try{
  await appending;progressAtCancel=native.progress.length;service.cancel(request.requestId);await rejected
 }finally{release();await finished}
 expect(native.progress).toHaveLength(progressAtCancel)
 expect(native.progress.map(event=>event.phase)).not.toContain(expected.es[2])
 expect(native.progress.map(event=>event.phase)).not.toContain(expected.es[3])
 expect(native.destroyed).toBe(1)
})
