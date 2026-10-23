import {it,expect,beforeEach,afterEach} from 'vitest'
import {mkdtemp,writeFile,truncate,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {randomUUID} from 'node:crypto'
import {TableEngine} from '../src/main/table-engine'
import type {TableStatsOptions,TableRange} from '../src/shared/types'
let engine:TableEngine,folder:string
const query={offset:0,limit:100,requestId:1}
beforeEach(async()=>{engine=new TableEngine();folder=await mkdtemp(join(tmpdir(),'freya-selection-stats-'))})
afterEach(async()=>rm(folder,{recursive:true,force:true}))
async function open(source:string){const path=join(folder,'data.csv');await writeFile(path,source);await engine.open('a',path);return path}
async function options(range?:TableRange):Promise<TableStatsOptions>{return{revision:(await engine.info('a')).revision,requestId:randomUUID(),range}}

it('calcula descriptivas compartidas, vacíos/ausentes/espacios y exclusiones sin modificar texto ni estado',async()=>{
 const source='ID,A,B\r\n00123,2,10\r\n9007199254740993,4,\r\n00007,6, \r\n00008,no\r\n';await open(source);const before=await engine.snapshot('a'),result=await engine.stats('a',null,[1,1,2],await options())
 expect(result).toMatchObject({cells:8,empty:3,missing:1,whitespace:1,unique:7,numeric:4,excluded:1,sum:22,average:5.5,median:5,min:2,max:10,revision:0,sample:false})
 expect(result).toMatchObject({variance:8.75,percentile25:3.5,percentile75:7});expect(result.sampleVariance).toBeCloseTo(35/3,12);expect(result.percentile10).toBeCloseTo(2.6,12);expect(result.percentile90).toBeCloseTo(8.8,12)
 expect(result.deviation).toBeCloseTo(Math.sqrt(8.75),12);expect(result.sampleDeviation).toBeCloseTo(Math.sqrt(35/3),12)
 expect(await engine.snapshot('a')).toEqual(before);expect((await engine.serialize('a')).toString()).toBe(source)
})
it('resuelve el rectángulo de una vista filtrada/ordenada y admite resumen conjunto o por columna',async()=>{
 await open('ID,Grupo,X,Y\n001,A,2,10\n002,B,100,1000\n003,A,4,20\n004,A,6,30\n');const before=await engine.snapshot('a')
 const range:TableRange={top:0,bottom:1,left:2,right:3,revision:0,query:{...query,search:'A',order:[{column:2,descending:true,numeric:true}]}},request=await options(range)
 const all=await engine.stats('a',null,[],request);expect(all).toMatchObject({cells:4,sum:60,average:15,median:13,min:4,max:30});expect(all.deviation).toBeCloseTo(Math.sqrt(113),12);expect(all).toMatchObject({variance:113,percentile25:5.5,percentile75:22.5,percentile90:27});expect(all.sampleVariance).toBeCloseTo(452/3,12);expect(all.percentile10).toBeCloseTo(4.6,12)
 expect(await engine.stats('a',null,[2],await options(range))).toMatchObject({cells:2,sum:10,average:5,median:5,deviation:1,variance:1,sampleVariance:2,percentile10:4.2,percentile25:4.5,percentile75:5.5,percentile90:5.8})
 expect(await engine.stats('a',null,[3],await options(range))).toMatchObject({cells:2,sum:50,average:25,median:25,deviation:5,variance:25,sampleVariance:50,percentile10:21,percentile25:22.5,percentile75:27.5,percentile90:29})
 expect(await engine.snapshot('a')).toEqual(before)
})
it('rechaza rangos obsoletos, columnas ajenas y alcances mezclados sin resultados amplios silenciosos',async()=>{
 await open('A,B\n1,2\n3,4\n');const before=await engine.snapshot('a'),range:TableRange={top:0,bottom:0,left:1,right:1,revision:0,query}
 await expect(engine.stats('a',null,[0],await options(range))).rejects.toThrow('no pertenece')
 await expect(engine.stats('a',[],[],await options(range))).rejects.toThrow('sin combinar')
 await expect(engine.stats('a',null,[],await options({...range,bottom:2}))).rejects.toThrow('excede')
 await expect(engine.stats('a',null,[0],{...await options(),revision:9})).rejects.toThrow('cambió')
 expect(await engine.snapshot('a')).toEqual(before)
 await engine.edit('a',{type:'cell',rowId:'1',column:0,value:'pendiente'});await expect(engine.stats('a',null,[],await options(range))).rejects.toThrow('seleccionó el rango')
})
it('cancela la recopilación entre celdas sin cambiar datos, deshacer o rehacer, incluso en una fila ancha',async()=>{
 await open(Array.from({length:2000},(_,i)=>'C'+i).join(',')+'\n'+Array(2000).fill('00123').join(',')+'\n');await engine.edit('a',{type:'cell',rowId:'1',column:0,value:'cambio'});await engine.undo('a');const snapshot=await engine.snapshot('a');let progressed=0
 engine=new TableEngine(event=>{progressed++;if(event.rows>0)void engine.cancelAnalysis('a',event.requestId)});await engine.restore('a',snapshot);const before=await engine.snapshot('a'),revision=(await engine.info('a')).revision
 await expect(engine.stats('a',null,[],await options({top:0,bottom:0,left:0,right:1999,revision,query}))).rejects.toThrow('se cancelaron');expect(progressed).toBe(2);expect(await engine.snapshot('a')).toEqual(before)
})
it('las consultas antiguas del pie no cancelan el panel; cancelar un ID anterior no afecta al nuevo',async()=>{
 await open('A\n'+'4\n'.repeat(5000));const snapshot=await engine.snapshot('a'),old=randomUUID(),footers:Promise<unknown>[]=[]
 engine=new TableEngine(event=>{if(event.rows===0){void engine.cancelAnalysis('a',old);footers.push(engine.stats('a',['1'],[0]))}});await engine.restore('a',snapshot);const before=await engine.snapshot('a')
 expect(await engine.stats('a',null,[0],await options())).toMatchObject({cells:5000,median:4,deviation:0,sampleDeviation:0});await Promise.all(footers);expect(footers).toHaveLength(1);expect(await engine.snapshot('a')).toEqual(before)
})
it('una consulta de páginas no interrumpe el rango; cambiar la revisión descarta resultados',async()=>{
 await open('A\n'+Array.from({length:10000},(_,i)=>String(i)).join('\n')+'\n');const request=await options({top:0,bottom:1,left:0,right:0,revision:0,query:{...query,order:[{column:0,descending:true,numeric:true}]}}),pending:Promise<unknown>[]=[];let paging=true,visits=0
 function paginate(){if(!paging)return;visits++;pending.push(engine.page('a',{...query,offset:visits}).catch(()=>{}));setImmediate(paginate)}paginate()
 try{expect(await engine.stats('a',null,[],request)).toMatchObject({cells:2,median:9998.5,deviation:0.5})}finally{paging=false;await Promise.all(pending)}expect(visits).toBeGreaterThan(1)
 const snapshot=await engine.snapshot('a');let changed=false;engine=new TableEngine(event=>{if(!changed&&event.rows>=512){changed=true;void engine.edit('a',{type:'cell',rowId:'1',column:0,value:'ajeno'})}});await engine.restore('a',snapshot)
 await expect(engine.stats('a',null,[0],await options())).rejects.toThrow('se cancelaron');const after=await engine.snapshot('a');expect(after.state.history).toHaveLength(1);expect(after.state.rows[0].cells).toEqual(['ajeno'])
})
it('trata datos vacíos, una cifra, identificadores inseguros y campos ausentes sin inventar números',async()=>{
 const source='A,B\n00123\n9007199254740993,\n,  \n';await open(source)
 expect(await engine.stats('a',null,[0])).toMatchObject({cells:3,numeric:1,excluded:1,empty:1,median:123,deviation:0,sampleDeviation:null,variance:0,sampleVariance:null,percentile10:123,percentile25:123,percentile75:123,percentile90:123})
 expect(await engine.stats('a',null,[1])).toMatchObject({cells:3,numeric:0,excluded:0,empty:3,missing:1,whitespace:1,median:null,deviation:null,sampleDeviation:null,sum:null,average:null,variance:null,sampleVariance:null,percentile10:null,percentile25:null,percentile75:null,percentile90:null})
 expect(await engine.stats('a',[],[0])).toMatchObject({cells:0,median:null,deviation:null,sampleDeviation:null,revision:0,sample:false,variance:null,sampleVariance:null,percentile10:null,percentile25:null,percentile75:null,percentile90:null});expect((await engine.serialize('a')).toString()).toBe(source)
})
it('conserva la cardinalidad del resumen anterior y rotula muestras sin atribuir totales del archivo',async()=>{
 await open('A\n'+Array.from({length:100001},(_,i)=>String(i)).join('\n')+'\n');expect(await engine.stats('a',null,[0],await options())).toMatchObject({cells:100001,unique:100001,median:50000,variance:833350000,percentile10:10000,percentile25:25000,percentile75:75000,percentile90:90000})
 const path=await open('A\n'+'00123\n'.repeat(250));await truncate(path,50*1024*1024+1);await engine.open('a',path);const revision=(await engine.info('a')).revision
 expect(await engine.stats('a',null,[],await options({top:0,bottom:1,left:0,right:0,revision,query}))).toMatchObject({cells:2,median:123,sample:true,revision,variance:0,sampleVariance:0,percentile10:123,percentile25:123,percentile75:123,percentile90:123})
})

it('limita celdas lógicas de tablas irregulares antes de devolver un resumen parcial',async()=>{
 const width=2000,count=1001;await open(Array.from({length:width},(_,i)=>'C'+i).join(',')+'\n'+'1\n'.repeat(count));const before=await engine.snapshot('a'),columns=Array.from({length:width},(_,i)=>i)
 await expect(engine.stats('a',null,columns,await options())).rejects.toThrow('dos millones')
 await expect(engine.stats('a',null,[],await options({top:0,bottom:count-1,left:0,right:width-1,revision:0,query}))).rejects.toThrow('dos millones')
 await expect(engine.stats('a',Array.from({length:count},(_,i)=>String(i+1)),columns)).rejects.toThrow('dos millones')
 expect(await engine.snapshot('a')).toEqual(before);expect(await engine.stats('a',['1'],columns)).toMatchObject({cells:2000,missing:1999,empty:1999,numeric:1,median:1})
},30000)
