import {AsyncDuckDB,VoidLogger} from '@duckdb/duckdb-wasm'
import wasmURL from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import workerURL from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import {quoteIdentifier} from '../shared/sql-helpers'
const db=new AsyncDuckDB(new VoidLogger(),new Worker(new URL(workerURL,location.href).href))
await db.instantiate(new URL(wasmURL,location.href).href)
await db.open({maximumThreads:1,arrowLosslessConversion:true,query:{castBigIntToDouble:false,castDecimalToDouble:false}})
const connection=await db.connect()
for(const sql of ["SET memory_limit='384MB'","SET temp_directory=''","SET autoinstall_known_extensions=false","SET autoload_known_extensions=false","SET allow_community_extensions=false","SET allow_unsigned_extensions=false","SET enable_external_access=false"])await connection.query(sql)

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
 }
}
declare global{var freyaSQL:{table:(name:string,columns:string[])=>Promise<void>;append:(name:string,base64:string)=>Promise<void>;seal:()=>Promise<string>;query:(sql:string)=>Promise<{columns:{name:string;type:string}[];rows:(string|null)[][];limited:boolean}>}}
