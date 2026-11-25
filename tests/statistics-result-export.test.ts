import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {mkdtemp,writeFile,readFile,rm,access,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {parse} from 'csv-parse/sync'
import {t,getLanguage,setLanguage} from '../src/shared/i18n'
import type {RecipeAnalysisContext} from '../src/shared/recipe-operation'
import * as files from '../src/main/files'
const state=vi.hoisted(()=>({folder:'',destination:'',cancelled:false,onDialog:()=>{},table:vi.fn(),saveDialog:vi.fn()}))
vi.mock('electron',()=>({app:{getPath:()=>state.folder},dialog:{showSaveDialog:async()=>{state.saveDialog();state.onDialog();return{canceled:state.cancelled,filePath:state.destination}}},BrowserWindow:class{static getFocusedWindow(){return undefined}static getAllWindows(){return[]}}}))
vi.mock('../src/main/table-client',()=>({TableClient:class{call=state.table;stop(){}}}))
import {Documents} from '../src/main/documents'
import {query} from '../src/main/query-schema'
import {exportStatisticsResult} from '../src/main/statistics-result-export'
import {statisticsResultSchema,statisticsResultWithinBudget,serializeStatisticsResult,type StatisticsResultRequest} from '../src/shared/statistics-result'

const sha=(value:string)=>createHash('sha256').update(value).digest('hex')
const sourceBytes='ID,N\r\n00123,0.1\r\n9007199254740993,0.2\r\n'
const request:StatisticsResultRequest={revision:3,format:'json',protectFormulas:true,table:{columns:['Métrica','00123','9007199254740993'],rows:[['Media',140/9,0.1+0.2],['Texto','=1+1','00123'],['Ausente',null,''],['Salto','línea\nsegunda','á']]},context:{kind:'describe',scope:'Documento completo',sample:false,analyzedAt:'2026-11-23T12:34:56.000Z'}}
const origin={name:'original.csv',revision:3,dirty:true,exportedAt:'2026-11-23T13:00:00.000Z'}
let docs:Documents,id:string,source:string
beforeEach(async()=>{
 vi.stubEnv('FREYALAB_TEST','0');state.folder=await mkdtemp(join(tmpdir(),'freya-statistics-result-'));source=join(state.folder,'original.csv');state.destination=join(state.folder,'result.json');state.cancelled=false;state.onDialog=()=>{};state.saveDialog.mockClear();state.table.mockReset();state.table.mockRejectedValue(new Error('La exportación no debe serializar ni recalcular la fuente.'));await writeFile(source,sourceBytes)
 docs=new Documents(()=>{});id=randomUUID();docs.records.set(id,{info:{id,name:'original.csv',path:source,kind:'csv',revision:3,readonly:false,dirty:true,encoding:'utf8',delimiter:',',rowCount:2,headers:['ID','N']},text:'',undo:[],redo:[],root:state.folder,saving:false})
})
afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllEnvs();await rm(state.folder,{recursive:true,force:true})})

it('JSON conserva números crudos, códigos, nulos, vacíos y metadatos de main sin formato visual',()=>{
 const output=serializeStatisticsResult(request,origin,sha),json=JSON.parse(output.content)
 expect(json).toMatchObject({version:1,kind:'freyalab-statistics-result',metadata:{source:'original.csv',revision:3,dirty:true,kind:'describe',scope:'Documento completo',sample:false,analyzedAt:request.context.analyzedAt,exportedAt:origin.exportedAt},columns:request.table.columns,rows:request.table.rows})
 expect(json.rows[0][1]).toBe(140/9);expect(json.rows[0][2]).toBe(0.30000000000000004);expect(output.context).toBeUndefined()
})

it('CSV usa String del número, protección explícita de fórmulas y contexto con valores originales y hash',()=>{
 for(const protectFormulas of [true,false]){
  const output=serializeStatisticsResult({...request,format:'csv',protectFormulas},origin,sha),rows=parse(output.content),context=JSON.parse(output.context!)
  expect(rows[0]).toEqual(request.table.columns);expect(rows[1]).toEqual(['Media',String(140/9),String(0.1+0.2)])
  expect(rows[2]).toEqual(['Texto',protectFormulas?"'=1+1":'=1+1','00123']);expect(rows[3]).toEqual(['Ausente','',''])
  expect(context.rows).toEqual(request.table.rows);expect(context.csv).toMatchObject({encoding:'utf8',delimiter:',',newline:'CRLF',protectFormulas,sha256:sha(output.content)})
  expect(output.content).toContain('\r\n');expect(context.rows[2]).toEqual(['Ausente',null,''])
 }
})

it('la protección CSV conserva un número negativo y protege solo el texto con el mismo contenido',()=>{
 const output=serializeStatisticsResult({...request,format:'csv',table:{columns:['Número','Texto'],rows:[[-0.4,'-0.4']]}},origin,sha)
 expect(parse(output.content)).toEqual([['Número','Texto'],['-0.4',"'-0.4"]])
 const context=JSON.parse(output.context!);expect(context.rows).toEqual([[-0.4,'-0.4']]);expect(context.csv.nulls).toBe(t('statistics.export.nulls'))
})

it('el conjunto conserva origen y cobertura prefijo de main, y el cliente no puede inyectarlos',async()=>{
 const analysisSubset:RecipeAnalysisContext={projectId:'project',recipeId:'recipe',sourceId:'source',name:'Primeras dos filas',sourceName:'datos-ñ.csv',steps:[{op:'sample',method:'first',rows:2}],stepOwners:['Primeras dos filas'],coverage:{headers:['ID','N'],columns:[{position:1,name:'ID'},{position:2,name:'N'}],scanned:2,eligible:2,resultCount:2,complete:false,cancelled:false,bytesRead:64,sampling:[]}}
 docs.get(id).info.analysisSubset=analysisSubset
 expect(statisticsResultSchema(query).safeParse({...request,context:{...request.context,analysisSubset}}).success).toBe(false)
 for(const format of ['json','csv'] as const){
  state.destination=join(state.folder,'subset.'+format);await exportStatisticsResult(docs,id,{...request,format})
  const output=JSON.parse(await readFile(state.destination+(format==='csv'?'.contexto.json':''),'utf8'))
  expect(output.metadata.analysisSubset).toEqual(analysisSubset);expect(output.metadata.analysisSubset.coverage.complete).toBe(false)
  expect(output.metadata).toMatchObject({source:'original.csv',revision:3,dirty:true});expect(output.rows).toEqual(request.table.rows)
  expect(JSON.stringify(output.metadata.analysisSubset)).not.toContain(source);expect(output.metadata.analysisSubset.coverage).not.toHaveProperty('sha256')
 }
 expect(await readFile(source,'utf8')).toBe(sourceBytes)
})

it('valida el contrato limitado: estructura rectangular, finitos, tamaños y ausencia de rutas/contenido arbitrario',()=>{
 const schema=statisticsResultSchema(query)
 expect(schema.parse(request)).toEqual(request)
 for(const value of [{...request,path:source},{...request,content:'arbitrario'},{...request,protectFormulas:undefined},{...request,format:'html'},{...request,context:{...request.context,kind:'sql'}},{...request,table:{columns:['N'],rows:[[NaN]]}},{...request,table:{columns:['N'],rows:[[Infinity]]}},{...request,table:{columns:['N'],rows:[[1,2]]}},{...request,table:{columns:['N'],rows:Array.from({length:1001},()=>[1])}},{...request,table:{columns:Array(202).fill('N'),rows:[]}},{...request,table:{columns:['N'],rows:[['x'.repeat(1024*1024+1)]]}},{...request,table:{columns:['N'],rows:[['á'.repeat(600000)]]}},{...request,context:{...request.context,query:{offset:0,limit:1001,requestId:0}}}])expect(schema.safeParse(value).success).toBe(false)
})

it('rechaza el tamaño agregado y el resultado final mayor de 20 MiB antes de abrir el selector',async()=>{
 const oversized={...request,table:{columns:['N'],rows:Array.from({length:21},()=>['x'.repeat(1024*1024)])}}
 await expect(exportStatisticsResult(docs,id,oversized)).rejects.toThrow('Reduce las columnas o las filas')
 expect(state.saveDialog).not.toHaveBeenCalled();expect(await readFile(source,'utf8')).toBe(sourceBytes)
 const escaped={...request,table:{columns:['N'],rows:Array.from({length:12},()=>['"'.repeat(1024*1024-1)])}}
 await expect(exportStatisticsResult(docs,id,escaped)).rejects.toThrow('Reduce las columnas o las filas');expect(state.saveDialog).not.toHaveBeenCalled()
})

it('corta una cadena mayor que el presupuesto antes de asignar su copia UTF-8 y rechaza ciclos',()=>{
 const encode=vi.spyOn(TextEncoder.prototype,'encode')
 expect(statisticsResultWithinBudget('x'.repeat(20*1024*1024+1))).toBe(false);expect(encode).not.toHaveBeenCalled()
 const cyclic:unknown[]=[];cyclic.push(cyclic);expect(statisticsResultWithinBudget(cyclic)).toBe(false)
})

it('guarda JSON o CSV con su contexto sin consultar el motor ni modificar el CSV original',async()=>{
 const before=docs.info(id)
 expect(await exportStatisticsResult(docs,id,request)).toBe(state.destination)
 expect(JSON.parse(await readFile(state.destination,'utf8')).rows).toEqual(request.table.rows)
 state.destination=join(state.folder,'result.csv');expect(await exportStatisticsResult(docs,id,{...request,format:'csv'})).toBe(state.destination)
 const context=JSON.parse(await readFile(state.destination+'.contexto.json','utf8'))
 expect(context.csv.sha256).toBe(sha(await readFile(state.destination,'utf8')));expect(context.rows).toEqual(request.table.rows)
 expect(state.table).not.toHaveBeenCalled();expect(docs.info(id)).toEqual(before);expect(await readFile(source,'utf8')).toBe(sourceBytes)
})

it('rechaza revisión antigua, CSV Texto y cierre antes del selector; cancelar no escribe',async()=>{
 await expect(exportStatisticsResult(docs,id,{...request,revision:2})).rejects.toThrow()
 docs.get(id).info.csvView='text';await expect(exportStatisticsResult(docs,id,request)).rejects.toThrow();docs.get(id).info.csvView='table'
 docs.records.delete(id);await expect(exportStatisticsResult(docs,id,request)).rejects.toThrow();expect(state.saveDialog).not.toHaveBeenCalled()
})

it('cancelar el selector conserva archivos y estado',async()=>{
 const before=docs.info(id);state.cancelled=true;expect(await exportStatisticsResult(docs,id,request)).toBeNull()
 await expect(access(state.destination)).rejects.toThrow();expect(docs.info(id)).toEqual(before);expect(await readFile(source,'utf8')).toBe(sourceBytes)
})

it('revalida identidad y revisión después del selector y rechaza fuente protegida cambiada',async()=>{
 state.onDialog=()=>{docs.get(id).info.revision++};await expect(exportStatisticsResult(docs,id,request)).rejects.toThrow();await expect(access(state.destination)).rejects.toThrow()
 docs.get(id).info.revision=3;state.onDialog=()=>{docs.records.delete(id)};await expect(exportStatisticsResult(docs,id,request)).rejects.toThrow();await expect(access(state.destination)).rejects.toThrow()
})

it('protege fuentes abiertas, enlaces, extensión y el compañero existente',async()=>{
 state.destination=source;await expect(exportStatisticsResult(docs,id,{...request,format:'csv'})).rejects.toThrow('ruta distinta')
 state.destination=join(state.folder,'link.json');await symlink(source,state.destination);await expect(exportStatisticsResult(docs,id,request)).rejects.toThrow('enlaces')
 state.destination=join(state.folder,'wrong.txt');await expect(exportStatisticsResult(docs,id,request)).rejects.toThrow('terminar en .json')
 state.destination=join(state.folder,'result.csv');await writeFile(state.destination+'.contexto.json','conservar');await expect(exportStatisticsResult(docs,id,{...request,format:'csv'})).rejects.toThrow('nombres nuevos')
 await expect(access(state.destination)).rejects.toThrow();expect(await readFile(state.destination+'.contexto.json','utf8')).toBe('conservar');expect(await readFile(source,'utf8')).toBe(sourceBytes)
})

it('revalida la fuente protegida y revierte solo la pareja propia ante error de disco',async()=>{
 const verify=vi.spyOn(docs,'verifyProjectSource').mockRejectedValueOnce(new Error('Fuente protegida cambió'))
 await expect(exportStatisticsResult(docs,id,request)).rejects.toThrow('Fuente protegida cambió');await expect(access(state.destination)).rejects.toThrow();verify.mockRestore()
 state.destination=join(state.folder,'result.csv');const originalWrite=files.atomicWrite
 vi.spyOn(files,'atomicWrite').mockImplementation(async(path,...args)=>{if(path===state.destination)throw new Error('Disco lleno');return originalWrite(path,...args)})
 await expect(exportStatisticsResult(docs,id,{...request,format:'csv'})).rejects.toThrow('Disco lleno')
 await expect(access(state.destination)).rejects.toThrow();await expect(access(state.destination+'.contexto.json')).rejects.toThrow();expect(await readFile(source,'utf8')).toBe(sourceBytes)
})

it('un cambio de revisión después de escribir el contexto revierte la pareja antes de entregar CSV',async()=>{
 state.destination=join(state.folder,'result.csv');const originalWrite=files.atomicWrite
 vi.spyOn(files,'atomicWrite').mockImplementation(async(path,...args)=>{await originalWrite(path,...args);if(path===state.destination+'.contexto.json')docs.get(id).info.revision++})
 await expect(exportStatisticsResult(docs,id,{...request,format:'csv'})).rejects.toThrow('Los datos cambiaron')
 await expect(access(state.destination)).rejects.toThrow();await expect(access(state.destination+'.contexto.json')).rejects.toThrow();expect(await readFile(source,'utf8')).toBe(sourceBytes)
})

it('los errores de validación son comprensibles en es/en/en-XA sin depender del idioma del detalle',async()=>{
 const previous=getLanguage()
 try{
  for(const language of ['es','en','en-XA'] as const){
   setLanguage(language)
   const malformed={...request,table:{columns:['N'],rows:[[1,2]]}}
   await expect(exportStatisticsResult(docs,id,malformed)).rejects.toThrow(t('statistics.export.error.invalid'))
   await expect(exportStatisticsResult(docs,id,{...request,table:{columns:['N'],rows:[['x'.repeat(21*1024*1024)]]}})).rejects.toThrow(t('statistics.export.error.tooLarge'))
  }
  expect(state.saveDialog).not.toHaveBeenCalled();expect(await readFile(source,'utf8')).toBe(sourceBytes)
 }finally{setLanguage(previous)}
})
