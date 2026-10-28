import {it,expect} from 'vitest'
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises'
import {writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {parse} from 'csv-parse/sync'
import iconv from 'iconv-lite'
import {TableEngine} from '../src/main/table-engine'
import {operationRequest} from '../src/main/operation-schema'

it('search amplía sólo el flujo cerrado count/preview/filter_extract y conserva sus límites',()=>{
 for(const operation of ['count','preview','filter_extract']){
  const request={operation,requestId:crypto.randomUUID(),source:{revision:0},search:'target',...(operation==='preview'?{limit:100}:{})}
  expect(operationRequest.safeParse(request).success).toBe(true)
  expect(operationRequest.safeParse({...request,search:''}).success).toBe(false);expect(operationRequest.safeParse({...request,search:'x'.repeat(1001)}).success).toBe(false)
  expect(operationRequest.safeParse({...request,sql:'select 1'}).success).toBe(false)
 }
 expect(operationRequest.safeParse({operation:'search',requestId:crypto.randomUUID(),source:{revision:0},search:'x'}).success).toBe(false)
})
for(const operation of ['count','preview','filter_extract'] as const)it(`${operation}: si la fuente cambia durante el recorrido no entrega un resultado completo ni deja un extracto`,async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-extract-change-')),path=join(folder,'source.csv'),output=join(folder,'output.csv'),requestId=crypto.randomUUID(),text='id,text\n1,TARGET\n2,TARGET\n';let changed=false
 const engine=new TableEngine(event=>{if(event.requestId==='op:'+requestId&&event.rows>0&&event.rows<100&&!changed){changed=true;writeFileSync(path,text.replaceAll('TARGET','CHANGE'))}},{largeBytes:1,extractBatch:1})
 try{
  await writeFile(path,text);await engine.open('a',path)
  const base={requestId,source:{revision:0},search:'target'},request=operation==='preview'?{...base,operation,limit:100}:operation==='filter_extract'?{...base,operation,output}:{...base,operation}
  await expect(engine.operation('a',request)).rejects.toThrow('cambió');expect(changed).toBe(true);expect(await readdir(folder)).toEqual(['source.csv']);expect(await readFile(path,'utf8')).toBe(text.replaceAll('TARGET','CHANGE'))
 }finally{await engine.close('a');await rm(folder,{recursive:true,force:true})}
})
for(const encoding of ['utf8','utf16le'] as const)it(`${encoding}: contar, previsualizar y extraer combinan la misma búsqueda con condiciones, sin cambiar bytes originales`,async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-extract-search-')),path=join(folder,'source.csv'),engine=new TableEngine(()=>{},{largeBytes:1,extractBatch:1})
 try{
  const rows=[['id','ciudad','texto','estado'],['0001','Mérida','TARGET "sí"\r\nx','entregado'],['02','Oaxaca','target','pendiente'],['03','Mérida','otro','entregado'],['04','Oaxaca']],quote=(value:string)=>/[",\r\n]/.test(value)?`"${value.replaceAll('"','""')}"`:value,eols=['\r\n','\n','\r','\r\n',''],records=rows.map((row,i)=>iconv.encode(row.map(quote).join(',')+eols[i],encoding)),bom=encoding==='utf16le'?Buffer.from([255,254]):Buffer.from([239,187,191]),data=Buffer.concat([bom,...records]),sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex')
  await writeFile(path,data);await engine.open('a',path,{encoding});const original=sha(data),source={revision:0},conditions={conditions:[{column:3,op:'equals' as const,value:'entregado'}],filterMode:'all' as const}
  expect(await engine.operation('a',{operation:'count',requestId:crypto.randomUUID(),source,conditions})).toMatchObject({matched:2,scanned:4})
  expect(await engine.operation('a',{operation:'count',requestId:crypto.randomUUID(),source,conditions,search:'target'})).toMatchObject({matched:1,scanned:4})
  expect(await engine.operation('a',{operation:'preview',requestId:crypto.randomUUID(),source,conditions,search:'target',limit:100})).toMatchObject({rows:[rows[1]],found:1,scanned:4,complete:true})
  const output=join(folder,'matches.csv');expect(await engine.operation('a',{operation:'filter_extract',requestId:crypto.randomUUID(),source,conditions,search:'target',output})).toMatchObject({matched:1,scanned:4,fidelity:'bytes'});expect(await readFile(output)).toEqual(Buffer.concat([bom,records[0],records[1]]))
  const projected=join(folder,'columns.csv');await engine.operation('a',{operation:'filter_extract',requestId:crypto.randomUUID(),source,conditions,search:'target',columns:[0,2],output:projected})
  expect(parse(iconv.decode(await readFile(projected),encoding),{record_delimiter:['\r\n','\n','\r']})).toEqual([[rows[0][0],rows[0][2]],[rows[1][0],rows[1][2]]]);expect(sha(await readFile(path))).toBe(original)
 }finally{await engine.close('a');await rm(folder,{recursive:true,force:true})}
})
