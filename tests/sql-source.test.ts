import {beforeEach,afterEach,it,expect} from 'vitest'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {tableFromIPC} from 'apache-arrow'
import {TableEngine} from '../src/main/table-engine'
import {quoteIdentifier,sqlColumns} from '../src/shared/sql-helpers'
import {assistedSQL,type SqlAssist} from '../src/shared/sql-assist'
let folder:string,path:string,engine:TableEngine
beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-sql-source-'));path=join(folder,'data.csv');engine=new TableEngine()})
afterEach(async()=>{await rm(folder,{recursive:true,force:true})})
async function source(text:string){await writeFile(path,text);return engine.open('a',path)}
async function rows(ticket:string){const data:(string|null)[][]=[];while(true){const chunk=await engine.analysisNext(ticket);if(chunk.done)break;const table=tableFromIPC(chunk.data);for(let i=0;i<table.numRows;i++)data.push(Array.from({length:table.numCols},(_,col)=>table.getChildAt(col)!.get(i) as string|null))}return data}

it('transfiere cambios en memoria, vacíos y ausentes como VARCHAR sin alterar guardado o recuperación',async()=>{
 const original='Código,Nota,Final\r\n00123,"Dice ""hola""\r\n😀",\r\n9007199254740993\r\n';await source(original)
 await engine.edit('a',{type:'cell',rowId:'1',column:1,value:'Pendiente á\u0000'});const before=await engine.snapshot('a')
 await engine.analysisStart('a','t',1,path);expect(await rows('t')).toEqual([['00123','Pendiente á\u0000',''],['9007199254740993',null,null]])
 expect(await engine.snapshot('a')).toEqual(before);await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(original)
})
it('cancela entre bloques por revisión, cierre o cancelación explícita y rechaza revisiones antiguas',async()=>{
 await source('A\n'+'001\n'.repeat(3000));await engine.analysisStart('a','old',0,path);expect((await engine.analysisNext('old')).rows).toBe(1000)
 await engine.edit('a',{type:'cell',rowId:'1',column:0,value:'002'});await expect(engine.analysisNext('old')).rejects.toThrow('cancelada');await expect(engine.analysisStart('a','stale',0,path)).rejects.toThrow('cambió')
 await engine.analysisStart('a','cancel',1,path);await engine.analysisClose('cancel');await expect(engine.analysisNext('cancel')).rejects.toThrow('disponible')
 await engine.analysisStart('a','closed',1,path);await engine.close('a');await expect(engine.analysisNext('closed')).rejects.toThrow('disponible')
})
it('lee íntegra una fuente de un millón por cuatro columnas que el editor abre como archivo grande',async()=>{
 const block=Array.from({length:1000},(_,i)=>`${String(i).padStart(5,'0')},Ciudad ${i%10},${i%100},nota`).join('\n')+'\n';await writeFile(path,'Código,Ciudad,Valor,Nota\n'+block.repeat(1000));const info=await engine.open('a',path);expect(info.readonly).toBe(true);expect(info.large).toBe(true);expect(info.rowCount).toBe(1000000)
 await expect(engine.analysisStart('a','partial-filter',info.revision,path,{offset:0,limit:1,requestId:1,search:'Ciudad'})).rejects.toThrow('archivos grandes')
 await engine.analysisStart('a','large',info.revision,path);let count=0;while(true){const chunk=await engine.analysisNext('large');if(chunk.done)break;const table=tableFromIPC(chunk.data);count+=chunk.rows;expect(table.numCols).toBe(4);expect(table.getChildAt(0)!.get(0)).toBe('00000')}
 expect(count).toBe(1000000);expect((await engine.info('a')).readonly).toBe(true);expect((await engine.info('a')).dirty).toBe(false)
 await engine.analysisStart('a','where-full-disk',info.revision,path,undefined,{filterMode:'all',conditions:[{column:1,op:'equals',value:'Ciudad 9'}]});let matching=0;while(true){const chunk=await engine.analysisNext('where-full-disk');if(chunk.done)break;matching+=chunk.rows;const table=tableFromIPC(chunk.data);expect(table.getChildAt(1)!.get(0)).toBe('Ciudad 9')}expect(matching).toBe(100000)
},60000)
it('no presenta una lectura parcial como completa ante estructura irregular o cambios externos',async()=>{
 const {arrowBatches,fileRecords}=await import('../src/main/analysis-source');await writeFile(path,'A\nx\ny,z\n')
 const records=fileRecords(path,{encoding:'utf8',delimiter:',',header:true,headerWidth:1,headers:['A']},()=>{})
 await expect((async()=>{for await(const _ of arrowBatches(records,1,()=>{})){}})()).rejects.toThrow('más columnas')
 await writeFile(path,'A\n'+'x\n'.repeat(2000));const changing=arrowBatches(fileRecords(path,{encoding:'utf8',delimiter:',',header:true,headerWidth:1,headers:['A']},()=>{}),1,()=>{});await changing.next();await writeFile(path,'A\ncambio\n');await expect((async()=>{while(!(await changing.next()).done){}})()).rejects.toThrow('cambió')
})
it('genera nombres y SQL asistido sin interpolar identificadores o categorías como código',()=>{
 expect(sqlColumns(['A','a','A_2','','  ','1','__proto__']).map(c=>c.name)).toEqual(['A','a_2','A_2_2','Columna 4','Columna 5','1','__proto__'])
 expect(quoteIdentifier('a";DROP')).toBe('"a"";DROP"')
 const options:SqlAssist={mode:'group',group:0,measure:1,category:1,values:"Oaxaca\nPuebla'); DROP TABLE datos;--",aggregate:'sum',scale:2,leftKey:0,rightKey:0,leftJoin:true,otherTable:2}
 expect(assistedSQL(['Ciudad','Total'],[],options)).toContain('DECIMAL(38,2)');expect(assistedSQL(['Ciudad','Total'],[],{...options,mode:'pivot'})).toContain("'Puebla''); DROP TABLE datos;--'")
 expect(assistedSQL(['Código'],['Clave'],{...options,mode:'join'})).toContain('NULLIF(a."Código", \'\') = NULLIF(b."Clave", \'\')')
 expect(()=>assistedSQL(['A'],[],{...options,scale:40})).toThrow('decimales')
})

it('conserva codificación, BOM, delimitador y campos multilínea al releer el archivo completo',async()=>{
 const {fileRecords,arrowBatches}=await import('../src/main/analysis-source'),iconv=(await import('iconv-lite')).default
 for(const encoding of ['utf8','utf16le','win1252'] as const){
  const text='Código;Nota;Vacío\r\n001;"Dice ""sí""\r\nCanción";\r\n9007199254740993;=1+1;\r\n'
  await writeFile(path,iconv.encode((encoding!=='win1252'?'\uFEFF':'')+text,encoding));const result:(string|null)[][]=[]
  for await(const chunk of arrowBatches(fileRecords(path,{encoding,delimiter:';',header:true,headerWidth:3,headers:['Código','Nota','Vacío']},()=>{}),3,()=>{})){const table=tableFromIPC(chunk.data);for(let i=0;i<table.numRows;i++)result.push(Array.from({length:table.numCols},(_,col)=>table.getChildAt(col)!.get(i) as string|null))}
  expect(result).toEqual([['001','Dice "sí"\r\nCanción',''],['9007199254740993','=1+1','']])
 }
 await writeFile(path,Buffer.from([0x41,0x0a,0xff]));await expect((async()=>{for await(const _ of fileRecords(path,{encoding:'utf8',delimiter:',',header:true,headerWidth:1,headers:['A']},()=>{})){}})()).rejects.toThrow('UTF-8')
})
it('transfiere la vista filtrada completa sin paginar ni ordenar el documento, preservando ausentes y ceros',async()=>{
 const original='Código,Grupo,Nota\n001,A,\n002,B,no\n9007199254740993,A\n';await source(original);const before=await engine.snapshot('a')
 await engine.analysisStart('a','filtered',0,path,{offset:1,limit:1,requestId:3,conditions:[{column:1,op:'equals',value:'A'}],order:[{column:0,numeric:false,descending:true}]})
 expect(await rows('filtered')).toEqual([['001','A',''],['9007199254740993','A',null]])
 expect(await engine.snapshot('a')).toEqual(before);expect((await engine.serialize('a')).toString()).toBe(original)
 await engine.analysisStart('a','empty',0,path,{offset:0,limit:1,requestId:4,search:'sin resultados'});expect(await rows('empty')).toEqual([])
 await engine.analysisStart('a','invalid',0,path,{offset:0,limit:1,requestId:5,conditions:[{column:999,op:'equals',value:'A'}]});await expect(rows('invalid')).rejects.toThrow('Columna')
})
it('cancela la preparación de la vista filtrada sin cambiar el historial ni el documento',async()=>{
 const original='ID,Grupo\n'+Array.from({length:5000},(_,i)=>`${String(i).padStart(5,'0')},A`).join('\n')+'\n';await source(original);const before=await engine.snapshot('a')
 await engine.analysisStart('a','cancel-filtered',0,path,{offset:0,limit:1,requestId:1,search:'A'})
 const rejected=expect(engine.analysisNext('cancel-filtered')).rejects.toThrow('cancelada');await engine.analysisClose('cancel-filtered');await rejected
 expect(await engine.snapshot('a')).toEqual(before);expect((await engine.serialize('a')).toString()).toBe(original)
})

it('combina vista O con filtros propios O mediante Y, sin modificar orden ni valores del documento',async()=>{
 const original='ID,Grupo,Total,Nota\r\n001,A,10,\r\n002,B,30,texto\r\n9007199254740993,A,40\r\n004,C,50,texto\r\n005,A,5,texto\r\n';await source(original);const before=await engine.snapshot('a')
 const query={offset:100,limit:1,requestId:1,filterMode:'any' as const,conditions:[{column:1,op:'equals' as const,value:'A'},{column:1,op:'equals' as const,value:'B'}],order:[{column:0,numeric:false,descending:true}]}
 const where={filterMode:'any' as const,conditions:[{column:2,op:'greater' as const,value:'20'},{column:3,op:'empty' as const}]}
 await engine.analysisStart('a','both',0,path,query,where);expect(await rows('both')).toEqual([['001','A','10',''],['002','B','30','texto'],['9007199254740993','A','40',null]])
 await engine.analysisStart('a','own-only',0,path,undefined,where);expect((await rows('own-only')).map(row=>row[0])).toEqual(['001','002','9007199254740993','004'])
 await expect(engine.analysisStart('a','bad-where',0,path,undefined,{filterMode:'all',conditions:[{column:99,op:'equals',value:'x'}]})).rejects.toThrow('Columna')
 await expect(engine.analysisStart('a','bad-regex',0,path,undefined,{filterMode:'all',conditions:[{column:0,op:'regex',value:'('}]})).rejects.toThrow('regular')
 expect(await engine.snapshot('a')).toEqual(before);expect((await engine.serialize('a')).toString()).toBe(original)
})

it('los filtros no ocultan estructuras inválidas ni el límite de lectura y ceden el control aunque no coincida nada',async()=>{
 const {arrowBatches,ANALYSIS_LIMITS}=await import('../src/main/analysis-source')
 const consume=async(records:Iterable<string[]>|AsyncIterable<string[]>,width:number)=>{for await(const _ of arrowBatches(records,width,()=>{},()=>false)){}}
 await expect(consume([['x','extra']],1)).rejects.toThrow('más columnas')
 await expect(consume([['x'.repeat(1024*1024+1)]],1)).rejects.toThrow('1 MiB')
 const previous=ANALYSIS_LIMITS.rows;try{ANALYSIS_LIMITS.rows=2;await expect(consume([['1'],['2'],['3']],1)).rejects.toThrow('dos millones')}finally{ANALYSIS_LIMITS.rows=previous}
 await source('ID\n'+'001\n'.repeat(10000));await engine.analysisStart('a','all-rejected',0,path,undefined,{filterMode:'all',conditions:[{column:0,op:'equals',value:'sin coincidencias'}]})
 const cancel=setImmediate(()=>void engine.analysisClose('all-rejected'));try{await expect(engine.analysisNext('all-rejected')).rejects.toThrow('cancelada')}finally{clearImmediate(cancel)}
 expect((await engine.info('a')).dirty).toBe(false)
})
