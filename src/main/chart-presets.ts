import {randomUUID,createHash} from 'node:crypto'
import {mkdir,readFile,stat} from 'node:fs/promises'
import {dirname} from 'node:path'
import {z} from 'zod'
import {atomicWrite} from './files'
import {query,conditionGroup} from './query-schema'
import {compileTableQuery} from './table-query'
import {chartSQL,chartKinds,chartAggregates,chartTimeGroups} from '../shared/charts'
import {matchingChartHeaders} from '../shared/chart-presets'
import type {ChartConfiguration,ChartPreset} from '../shared/chart-presets'
const keys=<T extends Record<string,unknown>>(value:T)=>Object.keys(value) as [keyof T & string,...(keyof T & string)[]]
const index=z.number().int().min(-1).max(199)
const configuration=z.object({
 headers:z.array(z.string().max(100000)).min(1).max(200),
 options:z.object({kind:z.enum(keys(chartKinds)),x:index.min(0),y:index,bins:z.number().int().min(1).max(30),aggregate:z.enum(keys(chartAggregates)),descending:z.boolean(),measureType:z.enum(['text','number']),series:index.optional(),time:z.enum(keys(chartTimeGroups)).optional()}).strict(),
 where:conditionGroup,
 view:query.pick({search:true,filters:true,conditions:true,filterMode:true}).strict().optional()
}).strict()
const preset=z.object({id:z.uuid(),name:z.string().trim().min(1).max(80),createdAt:z.iso.datetime(),configuration}).strict()
const store=z.object({version:z.literal(1),presets:z.array(preset).max(50)}).strict()
const input=z.object({name:preset.shape.name,configuration}).strict()
const maxBytes=8*1024*1024
function validate(config:ChartConfiguration){
 const width=config.headers.length
 for(const column of [config.options.x,config.options.y,config.options.series??-1])if(column>=width)throw new Error('La configuración hace referencia a una columna inexistente.')
 chartSQL(config.headers,config.options)
 for(const group of [config.where,config.view])if(group){
  compileTableQuery({...group,offset:0,limit:1,requestId:0},width)
  if('filters' in group)for(const key of Object.keys(group.filters??{}))if(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=width)throw new Error('La configuración contiene un filtro de columna no válido.')
 }
}
export class ChartPresets {
 private pending:Promise<unknown>=Promise.resolve()
 constructor(private path:string){}
 private async read(){
  let raw:Buffer
  try{if((await stat(this.path)).size>maxBytes)throw new Error('La biblioteca supera 8 MiB. El archivo se conserva.');raw=await readFile(this.path)}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return{presets:[] as ChartPreset[],hash:undefined};throw error}
  try{if(raw.length>maxBytes)throw new Error();const parsed=store.parse(JSON.parse(raw.toString('utf8')));if(new Set(parsed.presets.map(item=>item.id)).size!==parsed.presets.length)throw new Error();for(const item of parsed.presets)validate(item.configuration);return{presets:parsed.presets,hash:createHash('sha256').update(raw).digest('hex')}}catch{throw new Error('No se puede leer la biblioteca de gráficos: formato no válido o versión incompatible. El archivo se conserva sin sobrescribir.')}
 }
 async list(){await this.pending;return(await this.read()).presets}
 private change<T>(operation:()=>Promise<T>):Promise<T>{const next=this.pending.then(operation);this.pending=next.catch(()=>{});return next}
 private async write(presets:ChartPreset[],hash?:string){const data=JSON.stringify({version:1,presets});if(Buffer.byteLength(data)>maxBytes)throw new Error('La biblioteca supera 8 MiB. Elimina configuraciones antes de añadir otra.');await mkdir(dirname(this.path),{recursive:true,mode:0o700});await atomicWrite(this.path,data,hash)}
 save(value:unknown,headers:string[]){return this.change(async()=>{
  const entry=input.parse(value);validate(entry.configuration)
  if(!matchingChartHeaders(entry.configuration.headers,headers))throw new Error('Las columnas cambiaron. Revisa el gráfico antes de guardarlo.')
  const current=await this.read()
  if(current.presets.length>=50)throw new Error('Puedes guardar hasta 50 configuraciones. Elimina una para continuar.')
  if(current.presets.some(item=>item.name===entry.name))throw new Error('Ese nombre ya existe. Elige otro para conservar ambas configuraciones.')
  const result:ChartPreset={id:randomUUID(),createdAt:new Date().toISOString(),...entry}
  await this.write([...current.presets,result],current.hash);return result
 })}
 delete(value:string){return this.change(async()=>{const id=z.uuid().parse(value),current=await this.read();if(!current.presets.some(item=>item.id===id))throw new Error('La configuración ya no existe. Actualiza la biblioteca.');await this.write(current.presets.filter(item=>item.id!==id),current.hash)})}
}
