import { createReadStream } from 'node:fs'
import { Transform } from 'node:stream'
import { open as openFile, stat } from 'node:fs/promises'
import { setImmediate as yieldTurn } from 'node:timers/promises'
import { parse } from 'csv-parse'
import { parse as parseSync } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import iconv from 'iconv-lite'
import type { Encoding, TableEdit, TableExport, TableOptions, TablePage, TableQuery, TableRow, TableStats } from '../shared/types'

export const TABLE_LIMITS = { bytes: 50 * 1024 * 1024, cells: 2_000_000, record: 1024 * 1024, sampleBytes: 8 * 1024 * 1024, sampleRows: 200 }
interface Metadata { encoding: Encoding; delimiter: string; eol: string; bom: boolean; header: boolean; finalEol: boolean; headerWidth: number }
interface State extends Metadata { rows: TableRow[]; headers: string[]; readonly: boolean; warning?: string; revision: number; nextId: number; token: number; savedToken: number; history: Change[]; future: Change[] }
type Mutation = { type: 'cell'; id: string; column: number; value: string; length?:number } | { type: 'header'; column: number; value: string; headerWidth?:number } | { type: 'rows'; index: number; remove: number; rows: TableRow[] } | { type: 'column'; index: number; remove: boolean; name: string; cells: string[]; headerWidth?:number; lengths?:number[] }
interface Change { forward: Mutation[]; backward: Mutation[]; before: number; after: number; bytes:number }
class LimitError extends Error {}
const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
function numeric(value: string): number | null { const v = value.trim(); const n = Number(v); return v && numberPattern.test(v) && Number.isFinite(n) ? n : null }
function validDelimiter(value: string) { if (![',', ';', '\t', '|'].includes(value)) throw new Error('Delimitador no válido.'); return value }
function detectEncoding(bytes: Buffer): Encoding {
 if(bytes[0]===0xff&&bytes[1]===0xfe)return 'utf16le'
 try { new TextDecoder('utf-8',{fatal:true}).decode(bytes,{stream:true}); return 'utf8' } catch { return 'win1252' }
}
function validateUtf8() { const decoder=new TextDecoder('utf-8',{fatal:true}); return new Transform({ transform(chunk,_encoding,callback){try{decoder.decode(chunk,{stream:true});callback(null,chunk)}catch{callback(new Error('El archivo no es UTF-8 válido. Selecciona Windows-1252 para volver a abrirlo.'))}},flush(callback){try{decoder.decode();callback()}catch{callback(new Error('El archivo termina con una secuencia UTF-8 incompleta.'))}} }) }
function metadata(bytes: Buffer, options: TableOptions, path = ''): Metadata {
 const encoding = options.encoding ?? detectEncoding(bytes)
 const text = iconv.decode(bytes, encoding)
 const counts = [',', ';', '\t', '|'].map(delimiter => {
  try { const first = parseSync(text, {delimiter, bom:true, to:1, relax_column_count:true}) as string[][]; return {delimiter,count:(first[0]?.length??1)-1} }
  catch { return {delimiter,count:0} }
 })
 counts.sort((a,b) => b.count-a.count)
 const delimiter = validDelimiter(options.delimiter ?? (path.endsWith('.tsv') ? '\t' : (counts[0].count ? counts[0].delimiter : ',')))
 const eol = text.match(/\r\n|\n|\r/)?.[0] ?? '\n'
 const bom = encoding === 'utf8' ? bytes.subarray(0, 3).equals(Buffer.from([0xef,0xbb,0xbf])) : encoding === 'utf16le' && bytes[0] === 0xff && bytes[1] === 0xfe
 return { encoding, delimiter, eol, bom, header: options.header ?? true, finalEol:/[\r\n]$/.test(text), headerWidth:0 }
}
async function prefix(path: string, max: number): Promise<Buffer> {
 const handle = await openFile(path, 'r')
 try { const result = Buffer.alloc(Math.min((await handle.stat()).size, max)); let offset = 0; while (offset < result.length) { const read = await handle.read(result, offset, result.length-offset, offset); if (!read.bytesRead) break; offset += read.bytesRead } return result.subarray(0, offset) } finally { await handle.close() }
}
async function endsWithEol(path:string,bytes:number,encoding:Encoding){const handle=await openFile(path,'r');try{const tail=Buffer.alloc(Math.min(bytes,4));await handle.read(tail,0,tail.length,Math.max(0,bytes-tail.length));return /[\r\n]$/.test(iconv.decode(tail,encoding))}finally{await handle.close()}}
function copyRow(row: TableRow): TableRow { return { id: row.id, cells: [...row.cells] } }

export class TableEngine {
 private states = new Map<string, State>()
 private queries = new Map<string, number>()
 private openings = new Map<string, number>()
 private views = new Map<string,{key:string;indices:number[]}>()
 private serial = 0
 private get(id: string): State { const s = this.states.get(id); if (!s) throw new Error('La tabla ya no está abierta.'); return s }
 private editable(id: string): State { const s = this.get(id); if (s.readonly) throw new Error('La muestra es de solo lectura.'); return s }
 async create(id: string) { this.openings.set(id,++this.serial);this.views.delete(id);this.queries.delete(id);const revision=(this.states.get(id)?.revision??-1)+1;this.states.set(id, { encoding:'utf8', delimiter:',',eol:'\n',bom:false,header:true,finalEol:true,headerWidth:1,rows:[],headers:['Columna 1'],readonly:false,revision,nextId:1,token:0,savedToken:-1,history:[],future:[] }); return this.info(id) }
 async open(id: string, path: string, options: TableOptions = {}) {
  const generation=++this.serial;this.openings.set(id,generation);this.views.delete(id);this.queries.delete(id)
  const bytes = (await stat(path)).size
  const meta = metadata(await prefix(path, Math.min(bytes,65536)), options, path)
  meta.finalEol=await endsWithEol(path,bytes,meta.encoding)
  let records: string[][] = []; let readonly = bytes > TABLE_LIMITS.bytes; let reason = readonly ? 'El archivo supera 50 MiB.' : ''
  if (!readonly) {
   const input = createReadStream(path, {highWaterMark:65536}); const validator=meta.encoding==='utf8'?validateUtf8():new Transform({transform(chunk,_encoding,callback){callback(null,chunk)}}); const decoder = iconv.decodeStream(meta.encoding)
   const parser = parse({delimiter:meta.delimiter,bom:true,relax_column_count:true,max_record_size:TABLE_LIMITS.record})
   input.on('error', error => parser.destroy(error)); validator.on('error',error=>parser.destroy(error)); decoder.on('error', error => parser.destroy(error)); input.pipe(validator).pipe(decoder).pipe(parser)
   try { let cells = 0; for await (const row of parser) { const record=row as string[];const recordBytes=record.reduce((total,field)=>total+(meta.encoding==='utf8'?Buffer.byteLength(field,'utf8'):field.length*(meta.encoding==='utf16le'?2:1))+meta.delimiter.length,0);if(recordBytes>TABLE_LIMITS.record)throw new LimitError('Un registro supera 1 MiB.');records.push(record); cells += row.length; if (cells > TABLE_LIMITS.cells) throw new LimitError('El archivo supera dos millones de celdas.'); if (records.length % 2000 === 0) await yieldTurn() } }
   catch (error) { if (error instanceof LimitError || (error as {code?:string}).code === 'CSV_MAX_RECORD_SIZE') { readonly = true; reason = error instanceof LimitError ? error.message : 'Un registro supera 1 MiB.'; records = [] } else throw new Error(`CSV no válido: ${(error as Error).message}`) }
   finally { input.unpipe(validator); validator.unpipe(decoder); decoder.unpipe(parser); input.destroy(); validator.destroy(); decoder.end(); parser.destroy() }
  }
  if (readonly) {
   const sample = await prefix(path,TABLE_LIMITS.sampleBytes); const complete = sample.length === bytes
   const text = meta.encoding==='utf8'?new TextDecoder('utf-8',{fatal:true}).decode(sample,{stream:!complete}):iconv.decode(sample,meta.encoding)
   const parser = parse({delimiter:meta.delimiter,bom:true,relax_column_count:true,max_record_size:TABLE_LIMITS.record,raw:true,to:TABLE_LIMITS.sampleRows+(meta.header?1:0)})
   parser.end(text)
   try { for await (const item of parser) { if (complete || /[\r\n]$/.test(item.raw)) records.push(item.record as string[]); if (records.length >= TABLE_LIMITS.sampleRows+(meta.header ? 1:0)) break } }
   catch (error) { if (complete && (error as {code?:string}).code !== 'CSV_MAX_RECORD_SIZE') reason += ` El CSV contiene errores: ${(error as Error).message}` }
   finally { parser.destroy() }
  }
  const rawHeaders = meta.header ? records.shift() ?? [] : []
  meta.headerWidth=rawHeaders.length
  const width = Math.max(rawHeaders.length, ...records.slice(0,200).map(row=>row.length), 1)
  const headers = Array.from({length:width},(_,i)=>meta.header ? rawHeaders[i] ?? '' : `Columna ${i+1}`)
  const s: State = {...meta, rows:records.map((cells,i)=>({id:String(i+1),cells})),headers,readonly,warning:readonly ? `${reason} Muestra limitada: hasta 200 registros completos y 8 MiB leídos. Búsqueda, filtros y recuentos se refieren solo a la muestra.` : undefined,revision:0,nextId:records.length+1,token:0,savedToken:0,history:[],future:[]}
  // shortcut: irregular tables expose their widest row, large-file disk indexing is a later release.
  if (!readonly) { for (const row of s.rows) while(s.headers.length < row.cells.length) s.headers.push(meta.header ? '' : `Columna ${s.headers.length+1}`) }
  if(this.openings.get(id)!==generation)throw new Error('Apertura cancelada por una solicitud más reciente.')
  s.revision=(this.states.get(id)?.revision??-1)+1;this.views.delete(id);this.queries.delete(id);this.states.set(id,s); return this.info(id)
 }
 async info(id: string) { const s=this.get(id); return {headers:[...s.headers],rowCount:s.rows.length,readonly:s.readonly,warning:s.warning,encoding:s.encoding,delimiter:s.delimiter,revision:s.revision,dirty:s.token!==s.savedToken} }
 private async indices(id: string, query: TableQuery): Promise<number[]> {
  const s=this.get(id); const revision=s.revision; const ticket=++this.serial; this.queries.set(id,ticket)
  const search=(query.search??'').toLocaleLowerCase(); const filters=Object.entries(query.filters??{}).filter(([,value])=>value).map(([column,value])=>[Number(column),value.toLocaleLowerCase()] as const)
  const key=JSON.stringify([revision,search,filters,query.sort]); const cached=this.views.get(id);if(cached?.key===key)return cached.indices
  const indices:number[]=[]
  const ensure=()=>{if(this.queries.get(id)!==ticket || this.states.get(id)!==s || s.revision!==revision) throw new Error('Consulta cancelada por una solicitud más reciente.')}
  for(let i=0;i<s.rows.length;i++){const row=s.rows[i]; if((!search||row.cells.some(value=>value.toLocaleLowerCase().includes(search)))&&filters.every(([column,value])=>(row.cells[column]??'').toLocaleLowerCase().includes(value)))indices.push(i); if(i%2048===0){await yieldTurn();ensure()} }
  if(query.sort){const {column,descending,numeric:asNumber}=query.sort; const direction=descending?-1:1
   const compare=(a:number,b:number)=>{const x=s.rows[a].cells[column]??'',y=s.rows[b].cells[column]??''; if(asNumber){const nx=numeric(x),ny=numeric(y); if(nx===null||ny===null) return nx===ny ? a-b : nx===null ? 1:-1; return direction*(nx-ny)||a-b} return direction*x.localeCompare(y)||a-b}
   // Bottom-up merge sort yields between blocks so cancel messages remain actionable.
   let work=indices, scratch=new Array<number>(indices.length)
   for(let width=1;width<indices.length;width*=2){for(let left=0;left<indices.length;left+=2*width){let a=left,b=Math.min(left+width,indices.length),endA=b,endB=Math.min(left+2*width,indices.length),out=left; while(a<endA||b<endB){scratch[out++]=b>=endB||(a<endA&&compare(work[a],work[b])<=0)?work[a++]:work[b++]; if(out%8192===0){await yieldTurn();ensure()}}} [work,scratch]=[scratch,work];await yieldTurn();ensure()} this.views.set(id,{key,indices:work});return work
  }
  ensure();this.views.set(id,{key,indices});return indices
 }
 async page(id:string,query:TableQuery):Promise<TablePage>{if(!Number.isInteger(query.offset)||query.offset<0||!Number.isInteger(query.limit)||query.limit<1||query.limit>1000)throw new Error('Página no válida.');const s=this.get(id),revision=s.revision;const indices=await this.indices(id,query);if(this.states.get(id)!==s||s.revision!==revision)throw new Error('Consulta cancelada porque cambió la tabla.');return{rows:indices.slice(query.offset,query.offset+query.limit).map(i=>copyRow(s.rows[i])),total:s.rows.length,matched:indices.length,revision:s.revision,requestId:query.requestId,sample:s.readonly}}
 private apply(s:State,mutations:Mutation[]){const indexed=mutations.length>16?new Map(s.rows.map(row=>[row.id,row])):undefined;for(const mutation of mutations){switch(mutation.type){case'cell':{const row=indexed?.get(mutation.id)??s.rows.find(row=>row.id===mutation.id);if(!row)throw new Error('Fila no encontrada.');row.cells[mutation.column]=mutation.value;if(mutation.length!==undefined)row.cells.length=mutation.length;break}case'header':s.headers[mutation.column]=mutation.value;s.headerWidth=mutation.headerWidth??Math.max(s.headerWidth,mutation.column+1);break;case'rows':s.rows.splice(mutation.index,mutation.remove,...mutation.rows.map(copyRow));break;case'column':if(mutation.remove){s.headers.splice(mutation.index,1);s.rows.forEach((row,i)=>{row.cells.splice(mutation.index,1);if(mutation.lengths)row.cells.length=mutation.lengths[i]})}else{s.headers.splice(mutation.index,0,mutation.name);s.rows.forEach((row,i)=>{while(row.cells.length<mutation.index)row.cells.push('');row.cells.splice(mutation.index,0,mutation.cells[i]??'');if(mutation.lengths)row.cells.length=mutation.lengths[i]})}s.headerWidth=mutation.headerWidth??s.headers.length;break}}}
 async edit(id:string,edit:TableEdit){const s=this.editable(id);const revision=s.revision;const forward:Mutation[]=[],backward:Mutation[]=[]
  const add=(a:Mutation,b:Mutation)=>{forward.push(a);backward.push(b)}
  const rowIndex=(rowId:string)=>{const i=s.rows.findIndex(row=>row.id===rowId);if(i<0)throw new Error('Fila no encontrada.');return i}
  const column=(index:number,insert=false)=>{if(!Number.isInteger(index)||index<0||index>s.headers.length-(insert?0:1))throw new Error('Columna no válida.')}
  const value=(text:string)=>{if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>TABLE_LIMITS.record)throw new Error('El valor supera el límite de 1 MiB.');return text}
  switch(edit.type){
   case'cell':{column(edit.column);const row=s.rows[rowIndex(edit.rowId)];value(edit.value);if((row.cells[edit.column]??'')===edit.value)return this.info(id);add({type:'cell',id:row.id,column:edit.column,value:edit.value},{type:'cell',id:row.id,column:edit.column,value:row.cells[edit.column]??'',length:row.cells.length});break}
   case'paste':{column(edit.column);const start=rowIndex(edit.rowId);if(!edit.values.length)return this.info(id);const width=Math.max(...edit.values.map(row=>row.length));if(edit.column+width>s.headers.length||start+edit.values.length>s.rows.length)throw new Error('El pegado excede la tabla. Añade antes las filas o columnas necesarias.');edit.values.forEach((cells,offset)=>cells.forEach((text,col)=>{const row=s.rows[start+offset];value(text);add({type:'cell',id:row.id,column:edit.column+col,value:text},{type:'cell',id:row.id,column:edit.column+col,value:row.cells[edit.column+col]??'',length:row.cells.length})}));break}
   case'insertRow':{if((s.rows.length+1)*s.headers.length>TABLE_LIMITS.cells)throw new Error('La edición supera dos millones de celdas.');const index=edit.afterId?rowIndex(edit.afterId)+1:s.rows.length;const row={id:String(s.nextId++),cells:s.headers.map(()=>'')};add({type:'rows',index,remove:0,rows:[row]},{type:'rows',index,remove:1,rows:[]});break}
   case'duplicateRows':{
    const ids=new Set(edit.ids),indexes=s.rows.flatMap((row,index)=>ids.has(row.id)?[index]:[]).reverse()
    if(indexes.length!==ids.size)throw new Error('Fila no encontrada.')
    if((s.rows.length+indexes.length)*s.headers.length>TABLE_LIMITS.cells)throw new Error('La edición supera dos millones de celdas.')
    for(const [offset,index] of indexes.entries()){const row={...copyRow(s.rows[index]),id:String(s.nextId++)};add({type:'rows',index:index+1,remove:0,rows:[row]},{type:'rows',index:index+1,remove:1,rows:[]});if(offset%2048===0)await yieldTurn()}
    break
   }
   case'duplicateColumn':{
    column(edit.index)
    if(s.rows.length*(s.headers.length+1)>TABLE_LIMITS.cells)throw new Error('La edición supera dos millones de celdas.')
    add({type:'column',index:edit.index+1,remove:false,name:s.headers[edit.index]+' (copia)',cells:s.rows.map(row=>row.cells[edit.index]??'')},{type:'column',index:edit.index+1,remove:true,name:'',cells:[],headerWidth:s.headerWidth,lengths:s.rows.map(row=>row.cells.length)})
    break
   }
   case'deleteRows':{const indexes=[...new Set(edit.ids)].map(rowIndex).sort((a,b)=>b-a);for(const index of indexes)add({type:'rows',index,remove:1,rows:[]},{type:'rows',index,remove:0,rows:[copyRow(s.rows[index])]});break}
   case'insertColumn':{column(edit.index,true);value(edit.name);if(s.rows.length*(s.headers.length+1)>TABLE_LIMITS.cells)throw new Error('La edición supera dos millones de celdas.');add({type:'column',index:edit.index,remove:false,name:edit.name,cells:[]},{type:'column',index:edit.index,remove:true,name:'',cells:[],headerWidth:s.headerWidth,lengths:s.rows.map(row=>row.cells.length)});break}
   case'deleteColumn':{column(edit.index);if(s.headers.length===1)throw new Error('La tabla necesita al menos una columna.');add({type:'column',index:edit.index,remove:true,name:'',cells:[]},{type:'column',index:edit.index,remove:false,name:s.headers[edit.index],cells:s.rows.map(row=>row.cells[edit.index]??''),headerWidth:s.headerWidth,lengths:s.rows.map(row=>row.cells.length)});break}
   case'header':{column(edit.index);if(!s.header)throw new Error('Activa la primera fila como encabezados antes de editarlos.');value(edit.name);add({type:'header',column:edit.index,value:edit.name},{type:'header',column:edit.index,value:s.headers[edit.index],headerWidth:s.headerWidth});break}
   case'transform':{
    if(!['trim','upper','lower'].includes(edit.operation)||!edit.rowIds.length||!edit.columns.length)throw new Error('Selecciona filas y columnas para transformar.')
    const ids=new Set(edit.rowIds),columns=[...new Set(edit.columns)];columns.forEach(index=>column(index))
    const found=new Set(s.rows.filter(row=>ids.has(row.id)).map(row=>row.id));if(found.size!==ids.size)throw new Error('Fila no encontrada.')
    for(let i=0;i<s.rows.length;i++){
     const row=s.rows[i]
     if(ids.has(row.id))for(const col of columns){
      if(col>=row.cells.length)continue
      const text=row.cells[col],result=edit.operation==='trim'?text.trim():edit.operation==='upper'?text.toUpperCase():text.toLowerCase()
      if(result!==text){value(result);add({type:'cell',id:row.id,column:col,value:result},{type:'cell',id:row.id,column:col,value:text})}
     }
     if(i%2048===0)await yieldTurn()
    }
    break
   }
   case'replace':{if(!edit.find)throw new Error('Introduce el texto que quieres reemplazar.');if(edit.column!==undefined)column(edit.column);for(let i=0;i<s.rows.length;i++){const row=s.rows[i];row.cells.forEach((text,col)=>{if(edit.column!==undefined&&col!==edit.column)return;const result=text.split(edit.find).join(edit.replacement);if(result!==text){value(result);add({type:'cell',id:row.id,column:col,value:result},{type:'cell',id:row.id,column:col,value:text})}});if(i%2048===0)await yieldTurn()}break}
  }
  if(!forward.length)return this.info(id)
  if(this.states.get(id)!==s||s.revision!==revision)throw new Error('La tabla cambió durante la operación. Vuelve a intentarlo.')
  const before=s.token,after=++this.serial;const change={forward,backward:backward.reverse(),before,after,bytes:0};change.bytes=Buffer.byteLength(JSON.stringify(change),'utf8');if(change.bytes>20*1024*1024)throw new Error('El cambio supera el presupuesto de deshacer de 20 MiB. Reduce el número de celdas modificadas.');this.apply(s,forward);s.token=after;s.revision++;s.history.push(change);let budget=s.history.reduce((sum,item)=>sum+item.bytes,0);while(budget>20*1024*1024&&s.history.length>1)budget-=s.history.shift()!.bytes;s.future=[];return this.info(id)
 }
 async undo(id:string,redo=false){const s=this.editable(id);const source=redo?s.future:s.history,target=redo?s.history:s.future;const change=source.pop();if(change){this.apply(s,redo?change.forward:change.backward);s.token=redo?change.after:change.before;s.revision++;target.push(change)}return this.info(id)}
 private async selected(id:string,options:TableExport){const s=this.get(id),revision=s.revision;if(s.readonly)throw new Error('La muestra no permite exportar el archivo ni selecciones.');let indices:number[];if(options.scope==='filtered')indices=await this.indices(id,options.query??{offset:0,limit:500,requestId:0});else if(options.scope==='selection'){const ids=new Set(options.rowIds??[]);indices=s.rows.flatMap((row,i)=>ids.has(row.id)?[i]:[])}else indices=s.rows.map((_,i)=>i);if(this.states.get(id)!==s||s.revision!==revision)throw new Error('La tabla cambió durante la exportación.');const columns=options.columns??s.headers.map((_,i)=>i);if(columns.some(i=>!Number.isInteger(i)||i<0||i>=s.headers.length))throw new Error('Selección de columnas no válida.');return{rows:indices.map(i=>columns.map(col=>s.rows[i].cells[col]??'')),headers:columns.map(col=>s.headers[col])}}
 async stats(id:string,rowIds:string[],columns:number[]):Promise<TableStats>{const s=this.get(id),revision=s.revision;const ids=new Set(rowIds),values:string[]=[];for(let i=0;i<s.rows.length;i++){const row=s.rows[i];if(ids.has(row.id))for(const col of columns){if(!Number.isInteger(col)||col<0||col>=s.headers.length)throw new Error('Columna no válida.');values.push(row.cells[col]??'')}if(i%2048===0){await yieldTurn();if(this.states.get(id)!==s||s.revision!==revision)throw new Error('Las estadísticas se cancelaron porque cambió la tabla.')}}const nums=values.map(numeric).filter((n):n is number=>n!==null);let sum=0,min=Infinity,max=-Infinity;for(const n of nums){sum+=n;min=Math.min(min,n);max=Math.max(max,n)}return{cells:values.length,empty:values.filter(v=>!v.trim()).length,unique:new Set(values).size,numeric:nums.length,sum:nums.length&&Number.isFinite(sum)?sum:null,min:nums.length?min:null,max:nums.length?max:null,average:nums.length&&Number.isFinite(sum)?sum/nums.length:null}}
 async markdown(id:string,options:TableExport){const {rows,headers}=await this.selected(id,options);const escape=(v:string)=>v.replace(/\\/g,'\\\\').replace(/\|/g,'\\|').replace(/\r\n|\r|\n/g,'<br>');return[headers,headers.map(()=>'---'),...rows].map(row=>'| '+row.map(escape).join(' | ')+' |').join('\n')}
 async serialize(id:string,options?:TableExport):Promise<Buffer>{const s=this.editable(id),revision=s.revision;let records:string[][];if(options){const selection=await this.selected(id,options);records=s.header?[selection.headers,...selection.rows]:selection.rows}else records=s.header?[s.headers.slice(0,s.headerWidth),...s.rows.map(row=>row.cells)]:s.rows.map(row=>row.cells)
  if(this.states.get(id)!==s||s.revision!==revision)throw new Error('La tabla cambió durante la exportación.');
  const text=stringify(records,{delimiter:validDelimiter(options?.delimiter??s.delimiter),record_delimiter:s.eol,eof:options?true:s.finalEol})
  if(!options&&Buffer.byteLength(text,s.encoding==='utf16le'?'utf16le':'utf8')>TABLE_LIMITS.bytes)throw new Error('El resultado supera 50 MiB; reduce la tabla antes de guardarla.')
  const result=iconv.encode(text,s.encoding,{addBOM:s.bom});if(iconv.decode(result,s.encoding)!==text)throw new Error('La codificación seleccionada no representa todos los caracteres. Guarda una copia en UTF-8.');return result
 }
 async markSaved(id:string,expectedRevision?:number){const s=this.get(id);if(expectedRevision===undefined||s.revision===expectedRevision)s.savedToken=s.token;return this.info(id)}
 async snapshot(id:string){const s=this.get(id);return structuredClone({version:1,state:s})}
 async restore(id:string,snapshot:unknown){const data=snapshot as {version?:number;state?:State};if(data.version!==1||!data.state||!Array.isArray(data.state.rows)||!Array.isArray(data.state.headers))throw new Error('Formato de recuperación no compatible.');const s=structuredClone(data.state);if(s.rows.length*s.headers.length>TABLE_LIMITS.cells||s.rows.some(row=>typeof row.id!=='string'||!Array.isArray(row.cells)||row.cells.some(v=>typeof v!=='string')))throw new Error('Recuperación CSV no válida.');s.savedToken=-1;s.readonly=false;s.warning=undefined;this.serial=Math.max(this.serial,s.token,s.nextId);this.openings.set(id,++this.serial);this.queries.delete(id);this.views.delete(id);s.revision=Math.max(s.revision,this.states.get(id)?.revision??-1)+1;this.states.set(id,s);return this.info(id)}
 async close(id:string){this.states.delete(id);this.queries.delete(id);this.views.delete(id);this.openings.delete(id)}
}
