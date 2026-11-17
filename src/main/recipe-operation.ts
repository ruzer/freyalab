import {constants} from 'node:fs'
import {lstat,open} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {setImmediate as yieldTurn} from 'node:timers/promises'
import {fieldsOf} from './operations'
import {recordBatches} from './large-table'
import {compileTableQuery} from './table-query'
import {ANALYSIS_LIMITS} from './analysis-source'
import {RecipeOperationError,type RecipeColumn,type RecipeStep,type RecipeSampling,type RecipeOperationSource,type RecipeOperationHooks,type RecipeOperationResult} from '../shared/recipe-operation'

type Row={cells:string[];ordinal:number;arrival:number}
type Compiled={step:RecipeStep;matches?:(row:Row)=>boolean;compare?:(a:Row,b:Row)=>number;threshold?:bigint}
const failure=(code:ConstructorParameters<typeof RecipeOperationError>[0],data:Record<string,unknown>={})=>new RecipeOperationError(code,data)
const increment=(value:number)=>{if(value>=Number.MAX_SAFE_INTEGER)throw failure('counter');return value+1}
const ordinal=(a:string,b:string)=>a<b?-1:a>b?1:0
function invalidEncoding(cause:unknown){for(let depth=0;cause instanceof Error&&depth<8;depth++,cause=cause.cause)if((cause as NodeJS.ErrnoException).code==='ERR_ENCODING_INVALID_ENCODED_DATA')return true;return false}
const modulus=1n<<64n,mask=modulus-1n,gamma=0x9e3779b97f4a7c15n
function mix64(word:bigint){word=((word^(word>>30n))*0xbf58476d1ce4e5b9n)&mask;word=((word^(word>>27n))*0x94d049bb133111ebn)&mask;return word^(word>>31n)}
function percentageThreshold(percent:number){
 const [coefficient,exponent='0']=String(percent).split('e'),fraction=coefficient.split('.')[1]?.length??0,scale=fraction-Number(exponent)
 const numerator=BigInt(coefficient.replace('.',''))*(scale<0?10n**BigInt(-scale):1n),denominator=scale>0?10n**BigInt(scale):1n
 return numerator*modulus/(100n*denominator)
}
function reservoir(capacity:number,seed:number,stats:RecipeSampling){
 let state=BigInt(seed)&mask
 const rows:Row[]=[]
 return{
  offer(row:Row){
   stats.eligible=increment(stats.eligible)
   if(rows.length<capacity)rows.push({...row,arrival:stats.eligible})
   else{
    const count=BigInt(stats.eligible),limit=modulus-modulus%count
    let word:bigint
    do{state=(state+gamma)&mask;word=mix64(state)}while(word>=limit)
    const slot=word%count
    if(slot<BigInt(capacity))rows[Number(slot)]={...row,arrival:stats.eligible}
   }
   stats.selected=rows.length
  },
  finish:()=>rows
 }
}

function prepare(source:RecipeOperationSource,steps:RecipeStep[]){
 const root=source.schema.columns,width=root.length
 if(root.some((column,index)=>column.position!==index+1))throw failure('schema')
 let columns=[...root],available=new Set(root.map(column=>column.position))
 const reference=(column:RecipeColumn,index:number)=>{
  if(!Number.isSafeInteger(column.position)||root[column.position-1]?.name!==column.name)throw failure('schema',{step:index,position:column.position,name:column.name,actualName:root[column.position-1]?.name??''})
  if(!available.has(column.position))throw failure('columns',{step:index,position:column.position,name:column.name})
 }
 const compiled:Compiled[]=steps.map((step,index)=>{
  if(step.op==='select'){
   step.columns.forEach(column=>reference(column,index));columns=[...step.columns];available=new Set(columns.map(column=>column.position));return{step}
  }
  if(step.op==='filter'){
   step.conditions.forEach(rule=>reference(rule.column,index))
   try{
    const tests=step.conditions.map(rule=>{
     const fold=!rule.caseSensitive&&['equals','notEquals','contains','starts','ends'].includes(rule.op)
     const test=compileTableQuery({offset:0,limit:1,requestId:0,conditions:[{...rule,column:rule.column.position-1,value:fold?rule.value.toLowerCase():rule.value,caseSensitive:fold?true:rule.caseSensitive}]},width).matches
     return(row:Row)=>{if(!fold)return test(row.cells);const cells=[...row.cells];cells[rule.column.position-1]=(cells[rule.column.position-1]??'').toLowerCase();return test(cells)}
    })
    if(tests.length>20)throw failure('plan',{step:index,constraint:'conditions'})
    return{step,matches:(row:Row)=>!tests.length||(step.mode==='any'?tests.some(test=>test(row)):tests.every(test=>test(row)))}
   }catch(cause){if(cause instanceof RecipeOperationError)throw cause;throw failure('plan',{step:index,constraint:'filter',detail:(cause as Error).message})}
  }
  if(step.op==='order'){
   step.by.forEach(item=>reference(item.column,index))
   if(step.by.length>20)throw failure('plan',{step:index,constraint:'order'})
   const compares=step.by.map(item=>item.numeric?compileTableQuery({offset:0,limit:1,requestId:0,order:[{...item,column:item.column.position-1}]},width).compare:(a:string[],b:string[])=>ordinal(a[item.column.position-1]??'',b[item.column.position-1]??'')*(item.descending?-1:1))
   return{step,compare:(a:Row,b:Row)=>{for(const compare of compares){const result=compare(a.cells,b.cells);if(result)return result}return 0}}
  }
  if(step.op==='sample'&&step.method==='first'){
   if(!Number.isSafeInteger(step.rows)||step.rows<1||step.rows>1_000_000)throw failure('plan',{step:index,constraint:'sample'})
   return{step}
  }
  if(step.op==='sample'&&step.method==='random'){
   if(!Number.isInteger(step.seed)||step.seed<-(2**31)||step.seed>=2**31)throw failure('plan',{step:index,constraint:'sample'})
   if('rows'in step){if(!Number.isSafeInteger(step.rows)||step.rows<1||step.rows>1_000_000)throw failure('plan',{step:index,constraint:'sample'});return{step}}
   if(!Number.isFinite(step.percent)||step.percent<0.01||step.percent>100)throw failure('plan',{step:index,constraint:'sample'})
   return{step,threshold:percentageThreshold(step.percent)}
  }
  throw failure('plan',{step:index,constraint:'sample'})
 })
 let bounded=false,ordered=false
 for(const [index,{step}]of compiled.entries()){
  if(step.op==='order'&&!bounded)ordered=true
  if(step.op==='sample'&&'rows'in step){
   if(ordered&&step.method==='random')throw failure('plan',{step:index,constraint:'unbounded-order'})
   bounded=true
   ordered=false
  }
 }
 return{columns,compiled}
}

// A max-heap retains only the first K rows in stable result order, never an unbounded sort.
function topRows(capacity:number,compare:(a:Row,b:Row)=>number){
 const rows:Row[]=[]
 const offer=(row:Row)=>{
  if(rows.length<capacity){rows.push(row);let index=rows.length-1;while(index){const parent=(index-1)>>1;if(compare(rows[parent],rows[index])>=0)break;[rows[parent],rows[index]]=[rows[index],rows[parent]];index=parent}return}
  if(compare(row,rows[0])>=0)return
  rows[0]=row;let index=0
  while(true){let child=index*2+1;if(child>=rows.length)break;if(child+1<rows.length&&compare(rows[child+1],rows[child])>0)child++;if(compare(rows[index],rows[child])>=0)break;[rows[index],rows[child]]=[rows[child],rows[index]];index=child}
 }
 return{offer,finish:()=>rows}
}

// Same yielding bottom-up merge used by TableEngine.indices, with a caller-owned cancellation checkpoint.
async function sorted(rows:Row[],compare:(a:Row,b:Row)=>number,checkpoint:()=>Promise<void>){
 let work=rows,scratch=new Array<Row>(rows.length)
 for(let width=1;width<rows.length;width*=2){
  for(let left=0;left<rows.length;left+=2*width){
   let a=left,b=Math.min(left+width,rows.length),endA=b,endB=Math.min(left+2*width,rows.length),out=left
   while(a<endA||b<endB){scratch[out++]=b>=endB||(a<endA&&compare(work[a],work[b])<=0)?work[a++]:work[b++];if(out%2048===0)await checkpoint()}
  }
  [work,scratch]=[scratch,work];await checkpoint()
 }
 return work
}

async function boundedRows(rows:Row[],compiled:Compiled[],start:number,sampling:RecipeSampling[],checkpoint:()=>Promise<void>){
 for(let index=start;index<compiled.length;index++){
  const item=compiled[index],step=item.step
  if(item.matches||item.threshold!==undefined){
   const filtered:Row[]=[]
   for(let row=0;row<rows.length;row++){if(passes(item,rows[row],index,sampling))filtered.push(rows[row]);if(row%2048===0)await checkpoint()}
   rows=filtered
  }
  else if(item.compare)rows=await sorted(rows,item.compare,checkpoint)
  else if(step.op==='sample'&&step.method==='random'&&'rows'in step){
   const sample=reservoir(step.rows,step.seed,sampling.find(item=>item.step===index)!)
   for(let row=0;row<rows.length;row++){sample.offer(rows[row]);if(row%2048===0)await checkpoint()}
   rows=await sorted(sample.finish(),(a,b)=>a.arrival-b.arrival,checkpoint)
  }
  else if(step.op==='sample'&&step.method==='first'){
   const stats=sampling.find(item=>item.step===index)!;stats.eligible=rows.length
   rows=rows.slice(0,step.rows);stats.selected=rows.length
  }
  await checkpoint()
 }
 return rows
}

function passes(item:Compiled,row:Row,index:number,sampling:RecipeSampling[]){
 if(item.matches)return item.matches(row)
 if(item.threshold!==undefined&&item.step.op==='sample'&&item.step.method==='random'){
  const stats=sampling.find(item=>item.step===index)!
  stats.eligible=increment(stats.eligible)
  const match=mix64((BigInt(item.step.seed)+BigInt(row.ordinal)*gamma)&mask)<item.threshold
  if(match)stats.selected=increment(stats.selected)
  return match
 }
 return true
}

type RecipeAnalysisLimits=Pick<typeof ANALYSIS_LIMITS,'bytes'|'rows'|'cells'|'columns'>
export function runRecipe(source:RecipeOperationSource,steps:RecipeStep[],hooks:RecipeOperationHooks={}):Promise<RecipeOperationResult>{return executeRecipe(source,steps,hooks)}
// The worker uses the production limits; the optional argument lets unit tests exercise each boundary on small fixtures.
export function runRecipeAnalysis(source:RecipeOperationSource,steps:RecipeStep[],hooks:RecipeOperationHooks={},limits:RecipeAnalysisLimits=ANALYSIS_LIMITS):Promise<RecipeOperationResult>{return executeRecipe(source,steps,hooks,limits)}
async function executeRecipe(source:RecipeOperationSource,steps:RecipeStep[],hooks:RecipeOperationHooks,analysis?:RecipeAnalysisLimits):Promise<RecipeOperationResult>{
 const limit=(kind:keyof RecipeAnalysisLimits,value:number)=>{if(analysis&&value>analysis[kind])throw failure('analysis-limit',{kind,limit:analysis[kind]})}
 limit('bytes',source.bytes);limit('columns',source.schema.columns.length)
 const {columns,compiled}=prepare(source,steps),hash=createHash('sha256')
 const sampling:RecipeSampling[]=compiled.flatMap(({step},index)=>step.op==='sample'?[{step:index,method:step.method,...('rows'in step?{requestedRows:step.rows}:{percent:step.percent}),...('seed'in step?{seed:step.seed}:{}),eligible:0,selected:0}]:[])
 const block=compiled.findIndex(({step})=>step.op==='order'||step.op==='sample'&&'rows'in step),sampleStep=block<0?undefined:compiled[block].step
 const firstAfterOrder=sampleStep?.op==='order'?compiled.findIndex(({step},index)=>index>block&&step.op==='sample'&&step.method==='first'):-1
 const boundedFirst=firstAfterOrder<0?undefined:compiled[firstAfterOrder].step
 const middle=sampleStep?.op==='order'?compiled.slice(block,firstAfterOrder<0?compiled.length:firstAfterOrder):[]
 const sample=sampleStep?.op==='sample'&&sampleStep.method==='random'&&'rows'in sampleStep?reservoir(sampleStep.rows,sampleStep.seed,sampling.find(item=>item.step===block)!):undefined
 const first=sampleStep?.op==='sample'&&sampleStep.method==='first'?sampleStep:undefined,firstRows:Row[]=[]
 const prefix=compiled.slice(0,block<0?compiled.length:block)
 const order=middle.filter(item=>item.compare).reverse(),compare=(a:Row,b:Row)=>{for(const item of order){const n=item.compare!(a,b);if(n)return n}return a.arrival-b.arrival}
 const heap=topRows(boundedFirst?.op==='sample'&&boundedFirst.method==='first'?boundedFirst.rows:analysis?.rows??100,compare),cancelled=()=>hooks.cancelled?.()===true
 let scanned=0,resultCount=0,bytesRead=0,decodedBytes=0,wasCancelled=false,lastPosition=0,hashedThrough=0
 const progress=()=>hooks.progress?.({bytesRead,scanned,totalBytes:source.bytes})
 const read=(bytes:Buffer,position:number)=>{bytesRead+=bytes.length;hash.update(bytes.subarray(Math.max(0,hashedThrough-position)));hashedThrough=Math.max(hashedThrough,position+bytes.length);progress()}
 const before=await lstat(source.path).catch(()=>{throw failure('unavailable')})
 if(!before.isFile()||before.isSymbolicLink())throw failure('unavailable')
 if(before.size!==source.bytes||source.mtimeMs!==undefined&&before.mtimeMs!==source.mtimeMs||source.dev!==undefined&&before.dev!==source.dev||source.ino!==undefined&&before.ino!==source.ino)throw failure('changed')
 const handle=await open(source.path,process.platform==='win32'?'r':constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK).catch(()=>{throw failure('unavailable')})
 const same=(value:typeof before)=>value.isFile()&&value.dev===before.dev&&value.ino===before.ino&&value.size===before.size&&value.mtimeMs===before.mtimeMs
 try{
  if(!same(await handle.stat()))throw failure('changed')
  const unit=source.format.encoding==='utf16le'?2:1,bomLength=source.format.bom?(unit===2?2:3):0
  if(unit===2&&(source.bytes-bomLength)%2)throw failure('encoding')
  if(bomLength){const signature=Buffer.alloc(bomLength);const n=await handle.read(signature,0,bomLength,0);read(signature.subarray(0,n.bytesRead),0);if(n.bytesRead!==bomLength||!signature.equals(Buffer.from(unit===2?[255,254]:[239,187,191])))throw failure('encoding')}
  lastPosition=bomLength
  scanning:for await(const batch of recordBatches({path:source.path,size:source.bytes,bomLength,unit,maxRecord:1024*1024},{handle,onRead:read,firstBatchRecords:source.format.header?1:undefined,batchRecords:first&&!analysis?1:hooks.batchRecords,batchBytes:4*1024*1024,chunk:hooks.chunk})){
   if(cancelled()){wasCancelled=true;break}
   let parsed:string[][]
   try{parsed=fieldsOf(batch.records,batch.first,source.format)}catch(cause){throw failure(invalidEncoding(cause)?'encoding':'csv',{record:batch.first+1,detail:(cause as Error).message})}
   for(let index=0;index<parsed.length;index++){
    if(cancelled()){wasCancelled=true;break}
    const cells=parsed[index];lastPosition+=batch.records[index].length
    if(source.format.header&&batch.first+index===0){
     if(cells.length!==source.schema.columns.length)throw failure('schema',{expectedColumns:source.schema.columns.length,actualColumns:cells.length})
     for(const column of source.schema.columns)if(cells[column.position-1]!==column.name)throw failure('schema',{position:column.position,name:column.name,actualName:cells[column.position-1]??''})
     continue
    }
    scanned=increment(scanned)
    if(analysis){
     limit('rows',scanned);limit('cells',scanned*source.schema.columns.length)
     if(cells.length>source.schema.columns.length)throw failure('analysis-structure')
     decodedBytes+=cells.reduce((sum,value)=>sum+Buffer.byteLength(value,'utf8'),0);limit('bytes',decodedBytes)
    }
    const row={cells,ordinal:scanned,arrival:scanned}
    if(!prefix.every((item,index)=>passes(item,row,index,sampling)))continue
    if(sample)sample.offer(row)
    else if(first){
     const stats=sampling.find(item=>item.step===block)!;stats.eligible=increment(stats.eligible);if(firstRows.length<first.rows)firstRows.push(row);stats.selected=firstRows.length
     if(firstRows.length===first.rows&&!analysis)break scanning
    }else{
     if(!middle.every((item,index)=>passes(item,row,block+index,sampling)))continue
     resultCount=increment(resultCount);heap.offer(row)
     if(firstAfterOrder>=0){const stats=sampling.find(item=>item.step===firstAfterOrder)!;stats.eligible=resultCount;stats.selected=Math.min(resultCount,stats.requestedRows!)}
    }
   }
   if(wasCancelled)break
   progress();await yieldTurn()
  }
  if(!same(await handle.stat())||!same(await lstat(source.path).catch(()=>{throw failure('changed')})))throw failure('changed')
  const readComplete=!wasCancelled&&lastPosition===source.bytes,sha256=readComplete?hash.digest('hex'):undefined
  if(sha256&&sha256!==source.sha256.toLowerCase())throw failure('changed')
  const retained=sample?sample.finish():first?firstRows:heap.finish(),retainedCompare=sample||first?(a:Row,b:Row)=>a.arrival-b.arrival:compare
  const rest=sample||first?block+1:firstAfterOrder>=0?firstAfterOrder+1:compiled.length
  const cancelToken=Symbol(),checkpoint=async()=>{await yieldTurn();progress();if(cancelled())throw cancelToken}
  let rows:Row[]=[]
  if(wasCancelled){
   if(rest<compiled.length)resultCount=0
   else{
    const preview=topRows(100,retainedCompare)
    for(let index=0;index<retained.length;index++){preview.offer(retained[index]);if(index%2048===0)await yieldTurn()}
    rows=preview.finish().sort(retainedCompare)
    if(sample||first||firstAfterOrder>=0)resultCount=retained.length
   }
  }else try{
   rows=await boundedRows(await sorted(retained,retainedCompare,checkpoint),compiled,rest,sampling,checkpoint)
   if(sample||first||firstAfterOrder>=0)resultCount=rows.length
  }catch(cause){if(cause!==cancelToken)throw cause;wasCancelled=true;rows=[];resultCount=0}
  if(!same(await handle.stat())||!same(await lstat(source.path).catch(()=>{throw failure('changed')})))throw failure('changed')
  const complete=!wasCancelled&&readComplete
  const projected=(analysis?(wasCancelled?[]:rows):rows.slice(0,100)).map(row=>{
   const values:(string|null)[]=columns.map(column=>row.cells[column.position-1]??null)
   if(!steps.some(step=>step.op==='select'))values.push(...row.cells.slice(source.schema.columns.length))
   return values
  })
  return{headers:columns.map(column=>column.name),columns,rows:projected,scanned,eligible:sampling.at(-1)?.eligible??resultCount,resultCount:analysis&&wasCancelled?0:resultCount,complete,cancelled:wasCancelled,bytesRead,...(complete&&sha256?{sha256}:{}),sampling}
 }catch(cause){if(cause instanceof RecipeOperationError)throw cause;throw failure('csv',{detail:(cause as Error).message})}
 finally{await handle.close()}
}
