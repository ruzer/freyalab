import {it,expect} from 'vitest'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {parse} from 'csv-parse/sync'
import {createHash} from 'node:crypto'
import {TableEngine} from '../src/main/table-engine'
import iconv from 'iconv-lite'
import {buildIndex,recordBatches,readRecords,splitFields} from '../src/main/large-table'
import {fileRecords} from '../src/main/analysis-source'

// Owner approved on 2026-10-28: LF/CRLF/CR delimit outside quotes; quoted control characters remain values.
for(const eol of ['\n','\r\n'])it(`editable y grande conservan los mismos valores con finales mixtos y encabezado ${JSON.stringify(eol)}`,async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-search-mixed-'))
 try{
  const path=join(folder,'mixed.csv'),text=`id,text${eol}1,x\r\n2,y\n3,z\r\n`
  await writeFile(path,text)
  const editable=new TableEngine(),large=new TableEngine(()=>{},{largeBytes:1})
  await editable.open('a',path);await large.open('a',path)
  const query={offset:0,limit:1000,requestId:1},expected=parse(text,{record_delimiter:['\r\n','\n']}).slice(1)
  expect((await editable.page('a',query)).rows.map(row=>row.cells)).toEqual(expected)
  expect((await large.page('a',query)).rows.map(row=>row.cells)).toEqual(expected)
 }finally{await rm(folder,{recursive:true,force:true})}
})
for(const encoding of ['utf8','utf16le'] as const)it(`${encoding}: al editar una celda conserva BOM y CR/LF entrecomillados y toma el fin externo de una cabecera larga`,async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-search-save-'))
 try{
  const path=join(folder,'metadata.csv'),header=['id','x'.repeat(70000)+'\ncabecera'],rows=[['000123','CR\rLF\nCRLF\r\nfin'],['02','viejo']],quote=(value:string)=>/[",\r\n]/.test(value)?`"${value.replaceAll('"','""')}"`:value
  const encodeRows=(data:string[][])=>iconv.encode(data.map(row=>row.map(quote).join(',')+'\r\n').join(''),encoding,{addBOM:true}),data=encodeRows([header,...rows]),sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex')
  await writeFile(path,data);const original=sha(data),engine=new TableEngine();await engine.open('a',path,{encoding,delimiter:','});await engine.edit('a',{type:'cell',rowId:'2',column:1,value:'nuevo'})
  const saved=await engine.serialize('a');expect(saved).toEqual(encodeRows([header,rows[0],['02','nuevo']]))
  expect(parse(iconv.decode(saved,encoding),{record_delimiter:['\r\n','\n','\r']})).toEqual([header,rows[0],['02','nuevo']]);expect(sha(await readFile(path))).toBe(original)
 }finally{await rm(folder,{recursive:true,force:true})}
})
for(const encoding of ['utf8','utf16le','win1252'] as const)for(const delimiter of [',',';','\t','|'])it(`${encoding}/${JSON.stringify(delimiter)}: conserva valores, orden y bytes con LF/CRLF/CR mezclados`,async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-search-preserve-'))
 try{
  const source=[['id','text','extra'],['000123','uno\rsolo','dijo "hola"'],['9007199254740993','dos\nlíneas'],['3','tres\r\nlíneas','','sobra'],['4','José Ñ','']]
  const quote=(value:string)=>value.includes(delimiter)||/["\r\n]/.test(value)?`"${value.replaceAll('"','""')}"`:value,eols=['\r\n','\n','\r','\r\n','']
  const text=source.map((row,i)=>row.map(quote).join(delimiter)+eols[i]).join(''),bom=encoding==='utf16le'?Buffer.from([255,254]):encoding==='utf8'?Buffer.from([239,187,191]):Buffer.alloc(0),data=Buffer.concat([bom,iconv.encode(text,encoding)]),path=join(folder,'mixed.csv')
  await writeFile(path,data)
  const expected=parse(iconv.decode(data,encoding).replace(/^\uFEFF/,''),{delimiter,record_delimiter:['\r\n','\n','\r'],relax_column_count:true}) as string[][]
  expect(expected).toEqual(source)
  const index=await buildIndex(path,{encoding,bomLength:bom.length,maxRecord:1048576,every:2,chunk:encoding==='utf16le'?2:1})
  expect(index.records).toBe(expected.length)
  expect((await readRecords(index,0,index.records)).map(record=>splitFields(record,delimiter))).toEqual(expected)
  for(const batchRecords of [1,3]){
   const raw:Buffer[]=[]
   for await(const batch of recordBatches(index,{batchRecords,chunk:encoding==='utf16le'?3:1}))raw.push(...batch.records)
   expect(Buffer.concat(raw)).toEqual(data.subarray(bom.length));expect(raw).toHaveLength(expected.length)
  }
  const editable=new TableEngine(),large=new TableEngine(()=>{},{largeBytes:1,extractBatch:1});await editable.open('a',path,{encoding,delimiter});await large.open('a',path,{encoding,delimiter})
  const query={offset:0,limit:1000,requestId:1}
  expect((await editable.page('a',query)).rows.map(row=>row.cells)).toEqual(expected.slice(1))
  expect((await large.page('a',query)).rows.map(row=>row.cells)).toEqual(expected.slice(1))
  const preview=await large.operation('a',{operation:'preview',requestId:crypto.randomUUID(),source:{revision:0},limit:100});expect(preview).toMatchObject({rows:expected.slice(1),scanned:4})
  const output=join(folder,'copy.csv');await large.operation('a',{operation:'filter_extract',requestId:crypto.randomUUID(),source:{revision:0},output});expect(await readFile(output)).toEqual(data);expect(await readFile(path)).toEqual(data)
  const projected=join(folder,'columns.csv');await large.operation('a',{operation:'filter_extract',requestId:crypto.randomUUID(),source:{revision:0},columns:[0,1],output:projected})
  expect(parse(iconv.decode(await readFile(projected),encoding),{delimiter,record_delimiter:['\r\n','\n','\r']})).toEqual(expected.map(row=>row.slice(0,2)));expect(await readFile(path)).toEqual(data)
  const analysis:string[][]=[];for await(const row of fileRecords(path,{encoding,delimiter,header:true,headerWidth:source[0].length,headers:source[0]},()=>{}))analysis.push(row)
  expect(analysis).toEqual(expected.slice(1))
 }finally{await rm(folder,{recursive:true,force:true})}
})
