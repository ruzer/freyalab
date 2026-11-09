import type {ColumnRead} from './calculated-column'
import {quoteIdentifier} from './sql-helpers'
import type {ColumnProfile} from './types'

// El validador y la ayuda comparten el mismo catálogo de llamadas escalares.
export const calculationFunctionGroups={
 number:'abs acos asin atan atan2 ceil ceiling cos exp floor ln log log10 mod pow power round sign sin sqrt tan trunc'.split(' '),
 text:'char_length character_length concat concat_ws contains ends_with instr left length lower ltrim replace reverse right rtrim starts_with strpos substr substring trim upper'.split(' '),
 date:'date_add date_diff date_part date_sub datediff day dayofmonth dayofweek dayofyear extract make_date month strftime week year'.split(' '),
 conditional:'coalesce if ifnull nullif greatest least'.split(' '),
 conversion:'cast try_cast try'.split(' '),
}

const patterns=[
 ['multiply','number',2,(a,b)=>`${a} * ${b}`],
 ['percentage','number',2,(a,b)=>`${a} / ${b} * 100`],
 ['round','number',1,a=>`round(${a}, 2)`],
 ['year','date',1,a=>`year(${a})`],
 ['month','date',1,a=>`month(${a})`],
 ['join','text',2,(a,b)=>`${a} || ' ' || ${b}`],
 ['condition','number',1,a=>`if(${a} > 10, 'Mayorista', 'Minorista')`],
 ['fill','number',1,a=>`coalesce(${a}, 0)`],
] as const satisfies readonly (readonly [string,ColumnRead['read'],number,(a:string,b:string)=>string])[]

export function calculationExamples(fields:readonly {index:number;name:string}[],profiles:Readonly<Record<number,Pick<ColumnProfile,'kind'|'decimalPlaces'>|null>>){
 const candidates={number:[],date:[],text:[]} as Record<ColumnRead['read'],{index:number;name:string}[]>
 for(const field of fields){
  const kind=profiles[field.index]?.kind
  if(kind==='number'||kind==='date'||kind==='text'||kind==='category')candidates[kind==='category'?'text':kind].push(field)
 }
 return patterns.map(([id,read,count,format])=>{
  const selected=candidates[read].slice(0,count)
  if(selected.length<count)return {id,reason:`${read}${count}`,recipe:undefined}
  const [a,b]=selected.map(field=>quoteIdentifier(field.name))
  const columns=selected.map(({index}):ColumnRead=>read==='number'?{index,read,scale:profiles[index]?.decimalPlaces??0}:{index,read})
  return {id,reason:`${read}${count}`,recipe:{expression:format(a,b??''),columns}}
 })
}
