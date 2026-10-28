import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import iconv from 'iconv-lite'
import {parse} from 'csv-parse/sync'
import {buildIndex,recordBatches,splitFields} from '../../src/main/large-table'
import {TableEngine} from '../../src/main/table-engine'
import {pickFields} from '../large-file-editor/lib/fields.mjs'
import {scan,decode,body,strictRows,byteCandidate,validateQuotes} from './scan'

export async function parity(folder:string){
 await mkdir(folder,{recursive:true})
 const source=[['id','nombre','texto','nota'],['000123','Ana','dice "hola"','x'],['9007199254740993','José, el "grande"','línea 1\r\nlínea 2',''],['4','corto'],['5','','',' espacios '],['6','Zoë','a;b','fin'],['7','Kelvin','İSTANBUL','ñ ÁÉÍÓÚ'],['8','ASCII K','ASCII I','tab\tinside'],['9','a\rb','a\nb','a\r\nb'],['10','header-like','a,b','']]
 const quote=(value:string,delimiter:string)=>value.includes(delimiter)||/["\r\n]/.test(value)?`"${value.replaceAll('"','""')}"`:value
 const variants=[['utf8',false,',','\n'],['utf8',true,',','\r\n'],['utf16le',true,',','\r\n'],['win1252',false,',','\r\n'],['utf8',false,';','\r'],['utf8',true,'\t','\n'],['utf8',false,'|','\r\n']] as const
 const valid:unknown[]=[],invalid:unknown[]=[]
 for(const [encoding,bom,delimiter,eol] of variants){
  const text=source.map(row=>row.map(value=>quote(value,delimiter)).join(delimiter)).join(eol),prefix=bom?(encoding==='utf16le'?Buffer.from([255,254]):Buffer.from([239,187,191])):Buffer.alloc(0)
  const data=Buffer.concat([prefix,iconv.encode(text,encoding)]),path=join(folder,`hostile-${encoding}-${bom}-${delimiter.charCodeAt(0)}.csv`)
  await writeFile(path,data)
  const index=await buildIndex(path,{encoding,bomLength:prefix.length,maxRecord:1048576,every:2,chunk:6})
  const expected=parse(iconv.decode(data,encoding).replace(/^\uFEFF/,''),{delimiter,relax_column_count:true,skip_empty_lines:false,record_delimiter:eol==='\r'?['\r']:['\r\n','\n']}) as string[][]
  const actual:string[][]=[],raws:Buffer[]=[]
  for await(const batch of recordBatches(index,{batchRecords:2,chunk:6})){actual.push(...batch.records.map(raw=>splitFields(body(decode(raw,index)),delimiter)));raws.push(...batch.records)}
  if(JSON.stringify(actual)!==JSON.stringify(expected)){
   valid.push({encoding,bom,delimiter,eol,records:index.records,expectedRecords:expected.length,rowsExact:false,actual,expected})
   continue
  }
  const pick=pickFields(new Set([2]),delimiter)
  for(let i=0;i<raws.length;i++)assert.equal(pick(body(decode(raws[i],index))).get(2)??'',expected[i][2]??'')
  const needles=['k','K','i','I','K','İ','i\u0307','mérida','ñ','Á',' ','  ','"',delimiter,'\n','\r','zzq99',...Array.from({length:220},(_,i)=>{const row=expected[1+i%(expected.length-1)],cell=row[(i*7)%row.length]??'';return cell.slice(i%Math.max(1,cell.length),(i%Math.max(1,cell.length))+1+i%6)})]
  const engine=new TableEngine();await engine.open('editable',path,{encoding,delimiter})
  for(let n=0;n<needles.length;n++){
   const needle=needles[n],wanted=expected.slice(1).flatMap((row,i)=>row.some(value=>value.toLocaleLowerCase().includes(needle.toLocaleLowerCase()))?[i+1]:[])
   const candidate=actual.slice(1).flatMap((row,i)=>byteCandidate(raws[i+1],needle,index,delimiter)&&row.some(value=>value.toLocaleLowerCase().includes(needle.toLocaleLowerCase()))?[i+1]:[])
   assert.deepEqual(candidate,wanted)
   const page=await engine.page('editable',{search:needle,offset:0,limit:1000,requestId:n})
   assert.deepEqual(page.rows.map(row=>Number(row.id)),wanted)
  }
  for(const needle of ['k','i','zzq99',delimiter,'ñ',' '])for(const batchRecords of [1,3,2000]){
   const strict=await scan(index,'strict',needle,{delimiter,batchRecords,chunk:6,retain:true}),own=await scan(index,'own',needle,{delimiter,batchRecords,chunk:6,retain:true}),prefilter=await scan(index,'prefilter',needle,{delimiter,batchRecords,chunk:6,retain:true})
   assert.deepEqual(own.list,strict.list);assert.deepEqual(prefilter.list,strict.list)
  }
  valid.push({encoding,bom,delimiter,eol,records:index.records,queries:needles.length,rowsExact:true,editableExact:true,prefilterExact:true,partialExact:true,batchSizes:[1,3,2000]})
 }
 // The fast L2 splitter is tolerant. These controls distinguish accepted values from strict rejection.
 for(const record of ['1,"valid"x','1,ab"cd"','1,"bad" "tail"','1,"bad"\t','1,"bad";x']){
  const path=join(folder,`invalid-${invalid.length}.csv`);await writeFile(path,`id,text\n${record}\n`)
  const index=await buildIndex(path,{encoding:'utf8',bomLength:0,maxRecord:1048576})
  let strictError='',editableError=''
  try{strictRows([Buffer.from(record+'\n')],index,',')}catch(error){strictError=(error as Error).message}
  try{await new TableEngine().open('invalid',path)}catch(error){editableError=(error as Error).message}
  assert.ok(strictError);assert.ok(editableError)
  let checkedError='';try{validateQuotes(Buffer.from(record+'\n'),index,',')}catch(error){checkedError=(error as Error).message}
  assert.ok(checkedError)
  for(const strategy of ['strict','own','prefilter','partial'] as const){let rejected=false;try{await scan(index,strategy,'zzq99')}catch{rejected=true}assert.ok(rejected)}
  invalid.push({record,own:splitFields(record,','),strictError,editableError,checkedError,rawParity:false,checkedParity:true})
 }
 const invalidPath=join(folder,'invalid-utf8.csv');await writeFile(invalidPath,Buffer.concat([Buffer.from('id,text\n1,'),Buffer.from([255]),Buffer.from('\n')]))
 const invalidIndex=await buildIndex(invalidPath,{encoding:'utf8',bomLength:0,maxRecord:1048576})
 for(const strategy of ['strict','own','prefilter','partial'] as const){let rejected=false;try{await scan(invalidIndex,strategy,'zzq99')}catch{rejected=true}assert.ok(rejected)}
 const mixed=[]
 for(const eol of ['\n','\r\n']){
  const path=join(folder,`mixed-${eol.length}.csv`),text=`id,text${eol}1,x\r\n2,y\n3,z\r\n`;await writeFile(path,text)
  const editable=new TableEngine(),large=new TableEngine(()=>{},{largeBytes:1});await editable.open('a',path);await large.open('a',path)
  const query={offset:0,limit:1000,requestId:1},editableRows=(await editable.page('a',query)).rows.map(row=>row.cells),largeRows=(await large.page('a',query)).rows.map(row=>row.cells),strict=parse(text,{record_delimiter:['\r\n','\n'],relax_column_count:true}).slice(1)
  assert.notDeepEqual(editableRows,strict);assert.deepEqual(largeRows,strict)
  mixed.push({firstEol:eol,editableRows,largeRows,strictRows:strict,parity:false})
 }
 return {valid,invalid,invalidUtf8Rejected:true,mixed,rawFastStrictParity:false,checkedUniformFormatParity:valid.every((entry:any)=>entry.rowsExact),totalParity:false,blockedBy:'editable_and_strict_mixed_record_delimiters'}
}
if(process.argv.includes('--parity'))console.log(JSON.stringify(await parity(process.argv.at(-1)!),null,2))
