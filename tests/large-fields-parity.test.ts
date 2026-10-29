import {it,expect} from 'vitest'
import {stringify} from 'csv-stringify/sync'
import {parse} from 'csv-parse/sync'
import {splitFields} from '../src/main/large-table'
for(const delimiter of [',',';','\t','|'])it(`separador ${JSON.stringify(delimiter)}: 300 registros con comillas coinciden con el analizador estricto`,()=>{
 const values=['','a','00123','9007199254740993','José Kelvin İ','"','""','a"b','a,b;c|d\te','a\rb\nc\r\nd','  borde  ','\uFEFFdato']
 for(let i=0;i<300;i++){
  const cells=Array.from({length:1+i%8},(_,j)=>values[(i+j*7)%values.length]),text=stringify([cells],{delimiter,record_delimiter:'\r\n',eof:false,quoted:i%2===0,quoted_empty:i%3===0,quoted_match:/[\r\n]/}),strict=(parse(text,{delimiter,record_delimiter:['\r\n','\n','\r']}) as string[][])[0]
  expect(splitFields(text,delimiter)).toEqual(strict);for(let through=0;through<cells.length;through++)expect(splitFields(text,delimiter,through)).toEqual(strict.slice(0,through+1))
 }
 const long=['prefix','a'.repeat(131072)+'"middle"\r\n'+'z'.repeat(131072),'last'],raw=stringify([long],{delimiter,eof:false,quoted_match:/[\r\n]/});expect(splitFields(raw,delimiter)).toEqual(long)
})
it('la rama tolerante conserva el contenido previo de registros mal formados; la guarda estricta decide su rechazo',()=>{
 for(const [text,expected] of [['"abc"tail,x',['abctail','x']],['"abc',['abc']],['a"b,c',['a"b','c']],['"a""b",x',['a"b','x']]] as const)expect(splitFields(text,',')).toEqual(expected)
})
