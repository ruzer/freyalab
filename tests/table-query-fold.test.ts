import {it,expect,vi} from 'vitest'
import {compileTableQuery} from '../src/main/table-query'
for(const locale of ['en','es','lt','tr','az'])it(`${locale}: el compilador conserva el plegado nativo en ASCII, controles y Unicode`,()=>{
 const native=String.prototype.toLocaleLowerCase,fold=vi.spyOn(String.prototype,'toLocaleLowerCase').mockImplementation(function(this:string,locales){return native.call(this,locales??locale)})
 try{
  const ascii=Array.from({length:128},(_,i)=>i).filter(i=>i<65||i>90).map(i=>String.fromCharCode(i)).join(''),values=[ascii,'123.4500','2026-10-28','lowercase@example.invalid','ASCII I K','ĨÌÍİK','i\u0307','Straße','a'.repeat(10000),'\ud800','𐐀']
  for(const value of values)for(const needle of ['0','a','x','I','i','k',' ','\u0000','\u007f','\u0307','ss']){
   expect(compileTableQuery({search:needle,offset:0,limit:1,requestId:0},1).matches([value])).toBe(value.toLocaleLowerCase().includes(needle.toLocaleLowerCase()))
   expect(compileTableQuery({conditions:[{column:0,op:'contains',value:needle}],offset:0,limit:1,requestId:0},1).matches([value])).toBe(value.toLocaleLowerCase().includes(needle.toLocaleLowerCase()))
   expect(compileTableQuery({conditions:[{column:0,op:'equals',value:needle}],offset:0,limit:1,requestId:0},1).matches([value])).toBe(value.toLocaleLowerCase()===needle.toLocaleLowerCase())
  }
 }finally{fold.mockRestore()}
})
