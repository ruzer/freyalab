import Decimal from 'decimal.js'
import {RE2JS} from 're2js'
import type {TableFilter,TableQuery} from '../shared/types'
const numeric=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
const needsCaseFold=/[A-Z\u0080-\uffff]/
// Lowercase ASCII (including numbers/control characters) is unchanged in every locale.
const lower=(value:string)=>needsCaseFold.test(value)?value.toLocaleLowerCase():value
function decimal(text:string){const trimmed=text.trim();if(!numeric.test(trimmed))return null;const result=new Decimal(trimmed);return result.isFinite()?result:null}
export function date(text:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return null;const parsed=new Date(text+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===text?text:null}
export function compileTableQuery(query:TableQuery,width:number){
 const search=(query.search??'').toLocaleLowerCase()
 const column=(index:number)=>{if(!Number.isInteger(index)||index<0||index>=width)throw new Error('Columna de consulta no válida.')}
 const rules=query.conditions??[]
 if(rules.length>20)throw new Error('Se admiten hasta 20 condiciones por consulta.')
 const tests=rules.map((rule:TableFilter)=>{
  column(rule.column)
  const text=rule.value??'',fold=(value:string)=>rule.caseSensitive?value:lower(value),expected=fold(text)
  if(rule.op==='empty')return(cells:string[])=>!(cells[rule.column]??'').trim()
  if(rule.op==='notEmpty')return(cells:string[])=>!!(cells[rule.column]??'').trim()
  if(rule.op==='regex'){
   if(text.length>256)throw new Error('La expresión regular supera 256 caracteres.')
   let regex:RE2JS
   try{regex=RE2JS.compile(text,rule.caseSensitive?0:RE2JS.CASE_INSENSITIVE)}catch{throw new Error('Expresión regular no válida. RE2 no admite referencias hacia atrás ni lookaround.')}
   if(regex.programSize()>1000)throw new Error('La expresión regular es demasiado compleja.')
   return(cells:string[])=>{const value=cells[rule.column]??'';if(value.length>65536)throw new Error('La consulta regex contiene un campo de más de 64 KiB. Usa otra condición o reduce el campo.');return regex.matcher(value).find()}
  }
  if(['greater','greaterEqual','less','lessEqual'].includes(rule.op)){
   const bound=decimal(text);if(!bound||!bound.isFinite())throw new Error('Introduce un número decimal válido con punto decimal.')
   return(cells:string[])=>{const value=decimal(cells[rule.column]??'');if(!value||!value.isFinite())return false;const n=value.comparedTo(bound);return rule.op==='greater'?n>0:rule.op==='greaterEqual'?n>=0:rule.op==='less'?n<0:n<=0}
  }
  if(['dateBefore','dateOn','dateAfter'].includes(rule.op)){
   const bound=date(text);if(!bound)throw new Error('Introduce una fecha válida en formato AAAA-MM-DD.')
   return(cells:string[])=>{const value=date((cells[rule.column]??'').trim());return value!==null&&(rule.op==='dateBefore'?value<bound:rule.op==='dateAfter'?value>bound:value===bound)}
  }
  if(!['contains','equals','notEquals','starts','ends'].includes(rule.op))throw new Error('Operador de filtro no válido.')
  return(cells:string[])=>{const value=fold(cells[rule.column]??'');return rule.op==='equals'?value===expected:rule.op==='notEquals'?value!==expected:rule.op==='starts'?value.startsWith(expected):rule.op==='ends'?value.endsWith(expected):value.includes(expected)}
 })
 const order=query.order??(query.sort?[query.sort]:[]);if(order.length>20)throw new Error('Se admiten hasta 20 criterios de orden.')
 order.forEach(item=>column(item.column))
 const numbers=new Map<number,WeakMap<string[],Decimal|null>>()
 for(const item of order)if(item.numeric&&!numbers.has(item.column))numbers.set(item.column,new WeakMap())
 const parsed=(cells:string[],column:number)=>{const cache=numbers.get(column)!;if(cache.has(cells))return cache.get(cells)!;const result=decimal(cells[column]??'');cache.set(cells,result);return result}

 return{
  matches:(cells:string[])=>(!search||cells.some(value=>lower(value).includes(search)))&&(!tests.length||(query.filterMode==='any'?tests.some(test=>test(cells)):tests.every(test=>test(cells)))),
  ordered:order.length>0,
  compare:(a:string[],b:string[])=>{
   for(const item of order){const x=a[item.column]??'',y=b[item.column]??'';let comparison:number
    if(item.numeric){const nx=parsed(a,item.column),ny=parsed(b,item.column);if(nx===null||ny===null){if(nx===ny)continue;return nx===null?1:-1}comparison=nx.comparedTo(ny)}else comparison=x.localeCompare(y)
    if(comparison)return(item.descending?-1:1)*comparison
   }
   return 0
  }
 }
}
