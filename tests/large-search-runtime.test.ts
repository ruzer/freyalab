import {beforeAll,afterAll,it,expect} from 'vitest'
import {mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises'
import {join,resolve,isAbsolute} from 'node:path'
import {tmpdir} from 'node:os'
import {build} from 'rolldown'
import {parse} from 'csv-parse/sync'
import {LargeViews} from '../src/main/large-view'
import {waitForView} from './helpers/view-state'
import {blockingTimeout} from './helpers/blocking-timeout'
import {buildIndex} from '../src/main/large-table'
import {compileTableQuery} from '../src/main/table-query'
let folder:string,workerPath:string,standard:Awaited<ReturnType<typeof fixture>>,singleRecordBatch:Awaited<ReturnType<typeof fixture>>
async function fixture(name:string,count:number){
 const path=join(folder,name)
 const examples=['0001,Kelvin,İSTANBUL,"a\r\nb"','0002,ASCII K,ASCII I,','0003,ñ,"dice ""hola""",fin','0004,,,','0005,corto','0006,extra,k,a,b']
 const data=Array.from({length:count},(_,i)=>examples[i%examples.length]+['\r\n','\n','\r'][i%3])
 const source='id,name,text,extra\r\n'+data.join('')
 await writeFile(path,source)
 const index=await buildIndex(path,{encoding:'utf8',bomLength:0,maxRecord:1048576,delimiter:','}),rows=parse(source,{record_delimiter:['\r\n','\n','\r'],relax_column_count:true}).slice(1) as string[][]
 return {path,source,index,rows}
}
beforeAll(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-search-runtime-'));workerPath=join(folder,'worker.mjs');await symlink(resolve('node_modules'),join(folder,'node_modules'),'junction')
 await build({input:'src/main/large-search-worker.ts',platform:'node',external:id=>!id.startsWith('.')&&!isAbsolute(id),output:{file:workerPath,format:'esm'}})
 standard=await fixture('hostile.csv',13_500);expect(standard.index.offsets.length).toBeGreaterThanOrEqual(8)
 // El caso de un rango y lote de una fila conserva dos páginas incluso para la consulta menos densa.
 singleRecordBatch=await fixture('hostile-single.csv',6_006)
})
afterAll(async()=>{await rm(folder,{recursive:true,force:true})})
for(const workers of [1,2,4,8])for(const batchRecords of [1,3,2000]){
 it(`${workers} rangos reales, lote ${batchRecords}: Unicode y separación parcial conservan todas las filas en orden`,async()=>{
 const deadline=performance.now()+blockingTimeout-1_000 // Se conserva 1 s del presupuesto para cerrar los hilos.
 const {path,source,index,rows}=workers===1&&batchRecords===1?singleRecordBatch:standard
 const views=new LargeViews({workers,workerPath,batchRecords,chunk:30,prefilter:batchRecords!==3,partial:batchRecords!==2000}),queries=[{search:'k'},{search:'i'},{conditions:[{column:2,op:'contains' as const,value:'k'}],filterMode:'all' as const},{conditions:[{column:4,op:'empty' as const}],filterMode:'any' as const}]
 try{
  for(const query of queries){
   const requestId=crypto.randomUUID(),compiled=compileTableQuery({...query,offset:0,limit:1,requestId:0},5)
   const expected=rows.flatMap((cells,i)=>compiled.matches(cells)?[{id:String(i+1),cells}]:[])
   expect(expected.length).toBeGreaterThan(1000)
   await views.start('a',{index,delimiter:',',header:true,width:5,revision:0,alive:()=>true},{...query,requestId,revision:0})
   expect(await waitForView(()=>views.state('a'),deadline)).toMatchObject({status:'complete',matched:expected.length,scanned:rows.length})
   const actual=[]
   for(let offset=0;offset<expected.length;offset+=1000)actual.push(...(await views.page('a',requestId,offset,1000)).rows)
   expect(actual).toEqual(expected)
  }
  expect(await readFile(path,'utf8')).toBe(source)
 }finally{await views.stop()}
 })
}
