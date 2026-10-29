import {it,expect,beforeAll,afterAll} from 'vitest'
import {mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises'
import {join,resolve,isAbsolute} from 'node:path'
import {tmpdir} from 'node:os'
import {build} from 'rolldown'
import {parse} from 'csv-parse/sync'
import iconv from 'iconv-lite'
import {TableEngine} from '../src/main/table-engine'
let workerFolder:string,workerPath:string
beforeAll(async()=>{workerFolder=await mkdtemp(join(tmpdir(),'freya-bom-worker-'));workerPath=join(workerFolder,'worker.mjs');await symlink(resolve('node_modules'),join(workerFolder,'node_modules'),'junction');await build({input:'src/main/large-search-worker.ts',platform:'node',external:id=>!id.startsWith('.')&&!isAbsolute(id),output:{file:workerPath,format:'esm'}})})
afterAll(async()=>{await rm(workerFolder,{recursive:true,force:true})})
for(const encoding of ['utf8','utf16le'] as const)for(const batch of [1,3,2000])it(`${encoding}/lote${batch}: U+FEFF dentro de los datos no se confunde con el BOM del archivo al buscar, paginar y extraer`,async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-bom-data-')),path=join(folder,'data.csv'),rows=[['\uFEFF0001','alpha'],['0002','\uFEFFbeta'],['\uFEFF0003','gamma']],text='id,text\r\n'+rows.map(row=>row.join(',')).join('\r\n')+'\r\n',data=iconv.encode(text,encoding,{addBOM:true}),small=new TableEngine(),large=new TableEngine(()=>{},{largeBytes:1,viewWorkerPath:workerPath,viewWorkers:1,viewBatch:batch,extractBatch:batch})
 try{
  await writeFile(path,data);await small.open('a',path,{encoding});await large.open('a',path,{encoding});expect((await large.page('a',{offset:0,limit:200,requestId:0})).rows.map(row=>row.cells)).toEqual(rows);expect((await small.page('a',{search:'\uFEFF',offset:0,limit:200,requestId:1})).rows.map(row=>row.cells)).toEqual(rows)
  const requestId=crypto.randomUUID();await large.viewStart('a',{requestId,revision:0,search:'\uFEFF'});let state;for(let i=0;i<300;i++){state=await large.viewState('a');if(state?.status!=='running')break;await new Promise(resolve=>setTimeout(resolve,2))}expect(state).toMatchObject({status:'complete',matched:3});expect((await large.page('a',{viewId:requestId,offset:0,limit:200,requestId:2})).rows.map(row=>row.cells)).toEqual(rows)
  const source={revision:0},search='\uFEFF';expect(await large.operation('a',{operation:'count',source,requestId:crypto.randomUUID(),search})).toMatchObject({matched:3});expect(await large.operation('a',{operation:'preview',source,requestId:crypto.randomUUID(),search,limit:100})).toMatchObject({rows})
  const output=join(folder,'out.csv');await large.operation('a',{operation:'filter_extract',source,requestId:crypto.randomUUID(),search,output});expect(await readFile(output)).toEqual(data);const projected=join(folder,'columns.csv');await large.operation('a',{operation:'filter_extract',source,requestId:crypto.randomUUID(),search,columns:[0],output:projected});expect(parse(iconv.decode(await readFile(projected),encoding),{record_delimiter:['\r\n','\n','\r']})).toEqual([['id'],...rows.map(row=>[row[0]])]);expect(await readFile(path)).toEqual(data)
 }finally{await small.close('a');await large.close('a');await rm(folder,{recursive:true,force:true})}
})
