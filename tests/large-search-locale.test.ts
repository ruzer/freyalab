import {it,expect,vi} from 'vitest'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {parse} from 'csv-parse/sync'
import {buildIndex} from '../src/main/large-table'
import {scanSearch} from '../src/main/large-search-scan'

for(const locale of ['en','lt','tr','az'])it(`${locale}: prefiltro y recorrido completo respetan el mismo plegado regional de JavaScript`,async()=>{
 const folder=await mkdtemp(join(tmpdir(),'freya-search-locale-')),path=join(folder,'data.csv'),text='id,text\n1,Ĩ\n2,Ì\n3,Í\n4,ASCII I\n5,Kelvin\n6,İSTANBUL\n7,otro\n',native=String.prototype.toLocaleLowerCase
 // Cada motor ve el mismo locale explícito, también en Windows; el contraste externo LC_ALL=lt usa el runtime sin sustituir métodos.
 const folding=vi.spyOn(String.prototype,'toLocaleLowerCase').mockImplementation(function(this:string,locales){return native.call(this,locales??locale)})
 try{
  await writeFile(path,text);const index=await buildIndex(path,{encoding:'utf8',bomLength:0,maxRecord:1048576,delimiter:','}),rows=parse(text).slice(1) as string[][]
  for(const search of ['i','k','i\u0307',' ']){
   const expected=rows.flatMap((cells,i)=>cells.some(cell=>cell.toLocaleLowerCase().includes(search.toLocaleLowerCase()))?[i+1]:[])
   for(const prefilter of [false,true]){const actual:number[]=[];await scanSearch({taskId:1,index,range:{from:0,to:index.size,first:0},query:{search},delimiter:',',header:true,width:2,cancel:new SharedArrayBuffer(4),stop:new SharedArrayBuffer(4),prefilter,batchRecords:1},chunk=>{actual.push(...chunk.rows)});expect(actual).toEqual(expected)}
  }
 }finally{folding.mockRestore();await rm(folder,{recursive:true,force:true})}
})
