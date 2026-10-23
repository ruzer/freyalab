import {afterEach,beforeEach,expect,it} from 'vitest'
import {mkdtemp,writeFile,rm,truncate} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {randomUUID} from 'node:crypto'
import {stringify} from 'csv-stringify/sync'
import {columnSummary} from '../src/shared/column-profile'
import {TableEngine,TABLE_LIMITS} from '../src/main/table-engine'
import type {ColumnAnalysisRequest} from '../src/shared/types'
let engine:TableEngine,folder:string,path:string
beforeEach(async()=>{engine=new TableEngine();folder=await mkdtemp(join(tmpdir(),'freya-analysis-'));path=join(folder,'data.csv')})
afterEach(async()=>{await rm(folder,{recursive:true,force:true})})
const request=(options:Partial<ColumnAnalysisRequest>={}):ColumnAnalysisRequest=>({column:0,revision:0,requestId:randomUUID(),frequencyOffset:0,duplicatesOnly:false,bins:4,...options})
async function open(source:string){await writeFile(path,source);return engine.open('a',path)}

it('descriptivas conocidas, intervalos y Pearson sin mutación ni pérdida de identificadores',async()=>{
 const source='Valor,Doble,Clave\r\n'+[2,4,4,4,5,5,7,9].map((n,i)=>`${n},${n*2},${i===0?'9007199254740993':String(i).padStart(5,'0')}`).join('\r\n')+'\r\n'
 await open(source);const snapshot=await engine.snapshot('a'),result=await engine.analyzeColumn('a',request({otherColumn:1}))
 expect(result).toMatchObject({cells:8,empty:0,numeric:8,unique:5,duplicateGroups:2,duplicateRows:5,extraDuplicates:3,sum:40,average:5,median:4.5,min:2,max:9,deviation:2,sample:false,filtered:false,revision:0})
 expect(result.sampleDeviation).toBeCloseTo(Math.sqrt(32/7));expect(result.correlation).toMatchObject({column:1,pairs:8,omitted:0});expect(result.correlation!.value).toBeCloseTo(1)
 expect(result.histogram).toEqual([{lower:2,upper:3.75,count:1},{lower:3.75,upper:5.5,count:5},{lower:5.5,upper:7.25,count:1},{lower:7.25,upper:9,count:1}])
 expect(result.frequencies.slice(0,2)).toEqual([{value:'4',count:3,firstRow:2,rowId:'2',truncated:false},{value:'5',count:2,firstRow:5,rowId:'5',truncated:false}])
 const identifiers=await engine.analyzeColumn('a',request({column:2}));expect(identifiers.excluded).toBe(1);expect(identifiers.leadingZeros).toBe(7);expect(identifiers.profile).toMatchObject({kind:'identifier',headerHint:true,identifierZeros:7,unsafeIntegers:1})
 expect(await engine.snapshot('a')).toEqual(snapshot);expect((await engine.serialize('a')).toString()).toBe(source)
})

it('distingue vacíos, campos ausentes, espacios y texto exacto con vistas filtradas',async()=>{
 await open('Grupo,Valor,Par\nvisible,0,0\noculto,9,18\nvisible,,2\nvisible,"  ",3\nvisible\nvisible,no,4\nvisible,2,4\n')
 const query={offset:0,limit:1,requestId:1,filters:{'0':'visible'},order:[{column:1,descending:true,numeric:true}]}
 const result=await engine.analyzeColumn('a',request({column:1,otherColumn:2,query}))
 expect(result).toMatchObject({cells:6,empty:3,missing:1,whitespace:1,numeric:2,excluded:1,sum:2,median:1,filtered:true,duplicateGroups:1,duplicateRows:2})
 expect(result.correlation).toMatchObject({column:2,pairs:2,omitted:4});expect(result.correlation!.value).toBeCloseTo(1)
 expect(result.missingRows.map(item=>item.row).sort()).toEqual([3,4,5]);expect(result.frequencies.find(item=>item.value==='')).toMatchObject({count:2,firstRow:3})
 const all=await engine.analyzeColumn('a',request({column:1}));expect(all.cells).toBe(7);expect(all.sum).toBe(11)
 await engine.edit('a',{type:'cell',rowId:'1',column:1,value:'10'})
 await expect(engine.analyzeColumn('a',request())).rejects.toThrow('cambió')
 expect((await engine.analyzeColumn('a',request({column:1,revision:1}))).sum).toBe(21)
})

it('acota frecuencias y vistas previas sin mezclar valores distintos; solo repetidos conserva los totales',async()=>{
 const long='x'.repeat(256);await open('Valor\n'+Array.from({length:60},(_,i)=>`00${i}`).join('\n')+`\n${long}a\n${long}b\n001\n`)
 const first=await engine.analyzeColumn('a',request());expect(first.frequencies).toHaveLength(50);expect(first.frequencyTotal).toBe(62);expect(first.frequencies[0]).toMatchObject({value:'001',count:2})
 const next=await engine.analyzeColumn('a',request({frequencyOffset:50}));expect(next.frequencies).toHaveLength(12);expect(next.frequencies.filter(item=>item.truncated)).toHaveLength(2);expect(next.frequencies.filter(item=>item.truncated).map(item=>item.value)).toEqual([long,long])
 const duplicates=await engine.analyzeColumn('a',request({duplicatesOnly:true}));expect(duplicates.frequencies).toHaveLength(1);expect(duplicates.cells).toBe(63);expect(duplicates.unique).toBe(62);expect(next.profile).toEqual(first.profile);expect(duplicates.profile).toEqual(first.profile)
})

it('maneja tablas vacías, constantes, muestras, fórmulas y números no representables',async()=>{
 await open('A,B\n');const empty=await engine.analyzeColumn('a',request({otherColumn:1}));expect(empty.median).toBeNull();expect(empty.histogram).toEqual([]);expect(empty.correlation?.value).toBeNull()
 await open('A,B\n1,4\n1,4\n');const constant=await engine.analyzeColumn('a',request({revision:1,otherColumn:1}));expect(constant.histogram).toEqual([{lower:1,upper:1,count:2}]);expect(constant.deviation).toBe(0);expect(constant.correlation?.value).toBeNull()
 await open('A\n=SUM(A1)\n9007199254740993\n1e309\n0.00000000001\n');const unusual=await engine.analyzeColumn('a',request({revision:2}));expect(unusual.numeric).toBe(1);expect(unusual.excluded).toBe(3);expect(unusual.frequencies[0].value).toBe('=SUM(A1)')
 await writeFile(path,'A\n'+'2\n'.repeat(250));await truncate(path,TABLE_LIMITS.bytes+1);await engine.open('a',path)
 const sample=await engine.analyzeColumn('a',request({revision:3}));expect(sample.sample).toBe(true);expect(sample.cells).toBe(200);expect(sample.sum).toBe(400);expect(sample.profile.kind).toBe('number')
})

it('cancela trabajo entre bloques, descarta revisiones antiguas y permite otra solicitud',async()=>{
 await open('A\n'+'2\n'.repeat(100000))
 const selected=request(),pending=engine.analyzeColumn('a',selected),cancelled=expect(pending).rejects.toThrow('cancelado');await engine.cancelAnalysis('a',selected.requestId);await cancelled
 const stale=engine.analyzeColumn('a',request()),rejected=expect(stale).rejects.toThrow('cancelado');await engine.edit('a',{type:'cell',rowId:'1',column:0,value:'00123'});await rejected
 const old=engine.analyzeColumn('a',request({revision:1})),superseded=expect(old).rejects.toThrow('cancelado');const fresh=await engine.analyzeColumn('a',request({revision:1}));await superseded;expect(fresh.cells).toBe(100000);expect(fresh.sum).toBe(200121)
 await expect(engine.analyzeColumn('a',request({revision:1,column:20}))).rejects.toThrow('Columna no válida')
 await expect(engine.analyzeColumn('a',request({revision:1,bins:0}))).rejects.toThrow('Opciones')
})

// Shared Intel runners have exceeded 5 s for this 100 001-row integration fixture.
it('rechaza una cardinalidad excesiva con error explícito y conserva el documento',async()=>{
 await open('A\n'+Array.from({length:100001},(_,i)=>String(i)).join('\n')+'\n')
 await expect(engine.analyzeColumn('a',request())).rejects.toThrow('100 000 valores distintos')
 expect((await engine.info('a')).dirty).toBe(false);expect((await engine.page('a',{offset:100000,limit:1,requestId:1})).rows[0].cells[0]).toBe('100000')
},15000)


it.each([
 {name:'ceros iniciales',header:'Valor',values:['00123','+00124','2'],kind:'identifier',evidence:{identifierZeros:2}},
 {name:'entero largo',header:'Valor',values:['9007199254740993','2'],kind:'identifier',evidence:{unsafeIntegers:1}},
 {name:'nombre de identificador',header:'id_cliente',values:['12','24'],kind:'identifier',evidence:{headerHint:true}},
 {name:'nombre con acento',header:'Código',values:['a','b'],kind:'identifier',evidence:{headerHint:true}},
 {name:'nombre camelCase',header:'idCliente',values:['12','24'],kind:'identifier',evidence:{headerHint:true}},
 {name:'no confundir subcadena',header:'Identidad',values:['1','2.5'],kind:'number',evidence:{headerHint:false}},
 {name:'no confundir idioma',header:'Idioma',values:['es','es'],kind:'category',evidence:{headerHint:false}},
 {name:'texto numérico y exponentes',header:'Medida',values:[' 1.25 ','-2','1e2','.5'],kind:'number',evidence:{distinctNonEmpty:4}},
 {name:'calendario válido',header:'Fecha',values:['2024-02-29','0001-01-01','9999-12-31',' 2026-10-22 '],kind:'date',evidence:{dates:4,identifierZeros:0}},
 {name:'calendario inválido',header:'Fecha',values:['2025-02-29','2026-02-30','0000-01-01','2026-13-01'],kind:'mixed',evidence:{dates:0,invalidDates:4}},
 {name:'fecha válida e inválida',header:'Fecha',values:['2024-02-29','2025-02-29'],kind:'mixed',evidence:{dates:1,invalidDates:1}},
 {name:'fecha ambigua y timestamp',header:'Fecha',values:['01/02/2026','2026-10-22T10:30:00Z'],kind:'text',evidence:{dates:0,invalidDates:0}},
 {name:'tipos mezclados',header:'Datos',values:['1','2026-10-22','texto'],kind:'mixed',evidence:{dates:1}},
 {name:'todos vacíos',header:'Código',values:['','  ',''],kind:'empty',evidence:{headerHint:true}},
 {name:'categoría repetida',header:'Ciudad',values:['Oaxaca','Puebla','Oaxaca'],kind:'category',evidence:{distinctNonEmpty:2}},
 {name:'texto sin repeticiones',header:'Descripción',values:['a','b','c'],kind:'text',evidence:{distinctNonEmpty:3}},
 {name:'cardinalidad textual alta',header:'Categoría',values:[...Array.from({length:21},(_,i)=>'Texto '+i),'Texto 0'],kind:'text',evidence:{distinctNonEmpty:21}},
 {name:'cabecera vacía',header:'',values:['1','2'],kind:'number',evidence:{headerHint:false}},
 {name:'encabezados duplicados',header:'Grupo',values:['2','4'],kind:'number',evidence:{headerHint:false}}
])('tipo probable: $name sin convertir ni modificar el documento',async({header,values,kind,evidence})=>{
 const source=stringify([['Grupo',header],...values.map((value,i)=>[String(i),value])],{record_delimiter:'\r\n'});await open(source);const before=await engine.snapshot('a'),result=await engine.analyzeColumn('a',request({column:1}))
 expect(result.profile).toMatchObject({kind,...evidence});expect(await engine.snapshot('a')).toEqual(before);expect((await engine.serialize('a')).toString()).toBe(source);expect((await engine.info('a')).dirty).toBe(false)
 const summary=columnSummary(result);expect(summary.label).toBeTruthy();expect(summary.quality.reduce((sum,[,n])=>sum+n,0)).toBe(values.length)
})

it('calidad distingue ausentes, campos vacíos y espacios y la vista puede cambiar el tipo probable',async()=>{
 await open('Grupo,Valor\nA,2\nB,\nB,"  "\nB\nB,texto\n');const before=await engine.snapshot('a'),all=await engine.analyzeColumn('a',request({column:1}))
 expect(all.profile.kind).toBe('mixed');expect(columnSummary(all).quality).toEqual([['Con contenido',2],['Campos ausentes',1],['Campos vacíos exactos',1],['Solo espacios',1]])
 const view=await engine.analyzeColumn('a',request({column:1,query:{offset:0,limit:1,requestId:1,filters:{0:'A'}}}));expect(view).toMatchObject({filtered:true,cells:1,profile:{kind:'number'}});expect(await engine.snapshot('a')).toEqual(before)
})
