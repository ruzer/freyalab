import {AsyncDuckDB,VoidLogger} from '@duckdb/duckdb-wasm'
import wasmURL from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import workerURL from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import type {AsyncRecordBatchStreamReader} from 'apache-arrow'
import {CalculationError,type CalculatedValue} from '../shared/calculated-column'
import {quoteIdentifier} from '../shared/sql-helpers'
import {calculationProjection,calculationResult,explainCalculationError,type CalculationColumn} from './calculated-column-sql'
const db=new AsyncDuckDB(new VoidLogger(),new Worker(new URL(workerURL,location.href).href))
await db.instantiate(new URL(wasmURL,location.href).href)
await db.open({maximumThreads:1,arrowLosslessConversion:true,query:{castBigIntToDouble:false,castDecimalToDouble:false}})
const connection=await db.connect()
for(const sql of ["SET memory_limit='384MB'","SET temp_directory=''","SET autoinstall_known_extensions=false","SET autoload_known_extensions=false","SET allow_community_extensions=false","SET allow_unsigned_extensions=false","SET enable_external_access=false"])await connection.query(sql)

let calculated:{iterator:AsyncIterator<CalculatedValue[]>;columns:CalculationColumn[]}|undefined

async function* calculatedRows(stream:AsyncRecordBatchStreamReader,columns:CalculationColumn[]){
 const invalidColumns=columns.filter(column=>column.read!=='text')
 const encoder=new TextEncoder()
 let rows:CalculatedValue[]=[],bytes=0
 for await(const batch of stream){
  const ids=batch.getChild('freya_row')!,values=batch.getChild('freya_output')!,failed=batch.getChild('freya_failed')!
  const flags=invalidColumns.map(column=>batch.getChild('freya_invalid_'+column.index)!)
  for(let index=0;index<batch.numRows;index++){
   const rowId=ids.get(index) as string,value=values.get(index) as string|null
   const invalid=invalidColumns.filter((_,flag)=>flags[flag].get(index)).map(column=>column.index)
   const size=encoder.encode(value??'').length+rowId.length+invalid.length*4+32
   if(rows.length&&(rows.length>=1000||bytes+size>1024*1024)){yield rows;rows=[];bytes=0}
   rows.push({rowId,value,invalid,failed:!!failed.get(index)});bytes+=size
  }
 }
 if(rows.length)yield rows
}

globalThis.freyaSQL={
 async table(name:string,columns:string[]){await connection.query(`CREATE TABLE ${quoteIdentifier('_'+name)} (${columns.map((_,i)=>`c${i+1} VARCHAR`).join(',')})`);await connection.query(`CREATE VIEW ${quoteIdentifier(name)} AS SELECT ${columns.map((column,i)=>`c${i+1} AS ${quoteIdentifier(column)}`).join(',')} FROM ${quoteIdentifier('_'+name)}`)},
 async append(name:string,base64:string){await connection.insertArrowFromIPCStream(Uint8Array.from(atob(base64),char=>char.charCodeAt(0)),{name:'_'+name,create:false})},
 async seal(){await connection.query('SET lock_configuration=true');return db.getVersion()},
 async query(input:string){
  await connection.query('BEGIN TRANSACTION READ ONLY')
  try{
   const statement=await connection.prepare(input);await statement.close()
   const tokens=await db.tokenize(input),bytes=new TextEncoder().encode(input),last=tokens.offsets.at(-1)
   // DuckDB token positions are UTF-8 byte offsets; JavaScript string offsets would corrupt Unicode SQL.
   const sql=last!==undefined&&bytes[last]===59?new TextDecoder().decode(bytes.subarray(0,last)):input
   const body=`(\n${sql}\n) AS freya_result`
   const schema=await connection.query(`DESCRIBE SELECT * FROM ${body}`)
   const columns=schema.toArray().map(row=>({name:String(row.column_name),type:String(row.column_type)}))
   if(!columns.length||columns.length>200)throw new Error('El resultado admite entre 1 y 200 columnas.')
   // SQL casts preserve decimal scales and long integers; Arrow scalar String() does not.
   const query=`SELECT ${columns.map(column=>`CAST(${quoteIdentifier(column.name)} AS VARCHAR) AS ${quoteIdentifier(column.name)}`).join(',')} FROM ${body} LIMIT 10001`
   const result=await connection.query(query),rows:(string|null)[][]=[];let size=0
   for(let i=0;i<Math.min(result.numRows,10000);i++){const row=columns.map((_,col)=>{const value=result.getChildAt(col)!.get(i) as string|null;size+=value===null?0:new TextEncoder().encode(value).length;return value});if(size>8*1024*1024)throw new Error('El resultado supera 8 MiB. Reduce las columnas o filas de la consulta.');rows.push(row)}
   return{columns,rows,limited:result.numRows>10000}
  }finally{await connection.query('ROLLBACK')}
 },
 async calculateStart(expression,columns,rowColumn){
  if(calculated)throw new CalculationError('incompatible')
  await connection.query('BEGIN TRANSACTION READ ONLY')
  try{
   const projection=calculationProjection(expression,await db.tokenize(expression),columns,rowColumn)
   const statement=await connection.prepare(projection);await statement.close()
   const schema=await connection.query('DESCRIBE '+projection)
   const names=schema.getChild('column_name')!,type=String(schema.getChild('column_type')!.get(1))
   if(schema.numRows!==3+columns.filter(column=>column.read!=='text').length||
      names.get(0)!=='freya_row'||names.get(1)!=='freya_value'||names.get(2)!=='freya_failed')throw new CalculationError('scalar')
   const stream=await connection.send(calculationResult(projection,type,columns),true)
   calculated={iterator:calculatedRows(stream,columns),columns}
  }catch(error){
   await connection.query('ROLLBACK')
   throw explainCalculationError(error,columns)
  }
 },
 async calculateNext(){
  const active=calculated
  if(!active)return {rows:[],done:true}
  try{
   const next=await active.iterator.next()
   if(!next.done)return {rows:next.value,done:false}
  }catch(error){
   calculated=undefined
   await connection.query('ROLLBACK')
   throw explainCalculationError(error,active.columns)
  }
  calculated=undefined
  await connection.query('ROLLBACK')
  return {rows:[],done:true}
 }
}
declare global{var freyaSQL:{
 table:(name:string,columns:string[])=>Promise<void>;append:(name:string,base64:string)=>Promise<void>;seal:()=>Promise<string>
 query:(sql:string)=>Promise<{columns:{name:string;type:string}[];rows:(string|null)[][];limited:boolean}>
 calculateStart:(expression:string,columns:CalculationColumn[],rowColumn:string)=>Promise<void>
 calculateNext:()=>Promise<{rows:CalculatedValue[];done:boolean}>
}}
