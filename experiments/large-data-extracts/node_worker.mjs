// Sólo comparador E0: reutiliza el PoC, no introduce un lector CSV de producto.
import {existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {eachRecord} from '../large-file-editor/lib/record-index.mjs'
import {decode, pickFields, splitEol, splitFields} from '../large-file-editor/lib/fields.mjs'
import {bulkTransform} from '../large-file-editor/lib/document.mjs'
const [task,source,hint,output]=process.argv.slice(2)
const encoding={'utf-8':'utf8','utf-8-sig':'utf8','utf-16':'utf16le',cp1252:'win1252'}[hint]
if(!encoding)throw new Error('Codificación no admitida.')
if(output!=='-'&&(resolve(source)===resolve(output)||existsSync(output)))throw new Error('No sobrescribir archivos existentes.')
let count=0,header,city,state,total,projection,fields
const groups=new Map()
function init(values){
 header=values
 if(new Set(header).size!==header.length)throw new Error('Cabeceras duplicadas no admitidas por este comparador.')
 city=header.indexOf('ciudad');state=header.indexOf('estado');total=header.indexOf('total_mxn')
 projection=['venta_id','ciudad','producto','total_mxn'].map(name=>header.indexOf(name))
 if([city,state,total,...projection].some(i=>i<0))throw new Error('Faltan columnas requeridas.')
 fields=pickFields(new Set([city,state,total]))
}
if(task==='T3'||task==='T5'){
 await bulkTransform(source,output,(values,ordinal)=>{
  if(ordinal===0){init(values);return task==='T3'?projection.map(i=>values[i]):undefined}
  if(task==='T3'){
   if(values[city]!=='Oaxaca'||values[state]!=='entregado')return null
   if(projection.some(i=>i>=values.length))throw new Error('Campo ausente en la proyección.')
   count++;return projection.map(i=>values[i])
  }
  count++;if(city>=values.length)return undefined
  const value=values[city].replaceAll('Mérida','Merida')
  if(value===values[city])return undefined
  const next=values.slice();next[city]=value;return next
 },{encoding})
}else{
 await eachRecord(source,(raw,ordinal)=>{
  if(ordinal===0){init(splitFields(splitEol(decode(raw,encoding)).body,',').map(f=>f.value));return}
  if(task==='T1'){count++;return}
  const text=decode(raw,encoding),values=fields(text)
  if(task==='T2')count+=Number(values.get(city)==='Oaxaca'&&values.get(state)==='entregado')
  else if(task==='T4'){
   const value=values.get(total)
   if(!/^-?\d+\.\d{2}$/.test(value))throw new Error('Importe fuera del contrato de dos decimales.')
   const item=groups.get(values.get(city))??[0,0n];item[0]++;item[1]+=BigInt(value.replace('.',''));groups.set(values.get(city),item);count++
  }else if(task==='T6')count+=Number(splitFields(splitEol(text).body,',').some(f=>f.value.includes('Primera línea')))
  else throw new Error('Tarea desconocida.')
 },{encoding})
}
const result={count}
if(task==='T4')result.groups=[...groups].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([ciudad,[count,sum]])=>({ciudad,count,sum_cents:String(sum)}))
console.log(JSON.stringify(result))
