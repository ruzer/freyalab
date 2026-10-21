import {it,expect,beforeEach,afterEach} from 'vitest'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {randomUUID} from 'node:crypto'
import {TableEngine} from '../src/main/table-engine'
import type {TableTransformEdit} from '../src/shared/types'
let engine:TableEngine,folder:string
const query={offset:0,limit:100,requestId:1}
beforeEach(async()=>{engine=new TableEngine();folder=await mkdtemp(join(tmpdir(),'freya-structure-'))})
afterEach(async()=>rm(folder,{recursive:true,force:true}))
async function open(source:string){const path=join(folder,'data.csv');await writeFile(path,source);await engine.open('a',path)}
async function edit(operation:TableTransformEdit['operation'],columns=[0],extra:Partial<TableTransformEdit>={}):Promise<TableTransformEdit>{return{type:'structure',operation,columns,revision:(await engine.info('a')).revision,requestId:randomUUID(),...extra}}
async function cells(){return(await engine.page('a',query)).rows.map(row=>row.cells)}

it('divide texto literal sin quitar originales; conserva ceros, saltos, huecos y forma irregular al recuperar/deshacer',async()=>{
 const source='ID,Partes,Final\r\n001,"a;;b\r\nc;",x\r\n002\r\n003,"dice ""hola"";0007",z\r\n';await open(source)
 const request=await edit('split',[1],{separator:';'}),before=await engine.snapshot('a'),preview=await engine.transformPreview('a',request)
 expect(preview).toMatchObject({rows:3,affected:3,addedColumns:4,deletedRows:0});expect(await engine.snapshot('a')).toEqual(before)
 await engine.edit('a',request);expect((await engine.info('a')).headers).toEqual(['ID','Partes','Partes_1','Partes_2','Partes_3','Partes_4','Final'])
 expect(await cells()).toEqual([['001','a;;b\r\nc;','a','','b\r\nc','','x'],['002','','','','',''],['003','dice "hola";0007','dice "hola"','0007','','','z']])
 await engine.restore('b',JSON.parse(JSON.stringify(await engine.snapshot('a'))));await engine.undo('b');expect((await engine.serialize('b')).toString()).toBe(source)
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source);await engine.undo('a',true);expect((await engine.info('a')).headers).toHaveLength(7)
})
it('combina según el orden original y añade una columna sin convertir identificadores o fechas',async()=>{
 const source='ID,Fecha,Nota\n00123,2026-10-21,"á\nñ"\n9007199254740993,,\n';await open(source)
 const request=await edit('combine',[2,0],{separator:' | ',name:'Resumen'});await engine.edit('a',request)
 expect(await cells()).toEqual([['00123','2026-10-21','á\nñ','00123 | á\nñ'],['9007199254740993','','','9007199254740993 | ']])
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source)
})
it('deduplica por claves compuestas exactas y conserva primera fila, vacíos frente a ausentes y filas originales',async()=>{
 const source='Clave,Grupo,Nota\n001,A,primera\n001,A,segunda\n001,B,otra\n001,,vacío\n001\n001\n';await open(source)
 const request=await edit('deduplicate',[0,1]),before=await engine.snapshot('a'),preview=await engine.transformPreview('a',request)
 expect(preview).toMatchObject({deletedRows:2,affected:2});expect(preview.samples.map(item=>item.row)).toEqual([1,5]);expect(await engine.snapshot('a')).toEqual(before)
 await engine.edit('a',request);expect((await engine.page('a',query)).rows.map(row=>row.id)).toEqual(['1','3','4','5'])
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source);await engine.undo('a',true);expect((await engine.info('a')).rowCount).toBe(4)
})
it('normaliza Unicode explícito y encabezados sin perder sus nombres o longitudes al deshacer',async()=>{
 const source='  Nombre Largo  ,NOMBRE LARGO,nombre_largo_2,,\nCafé,00123\n';await open(source)
 await engine.edit('a',await edit('normalize',[0,1]));expect((await cells())[0]).toEqual(['Café','00123']);await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source)
 await engine.edit('a',await edit('headers'))
 expect((await engine.info('a')).headers).toEqual(['nombre_largo','nombre_largo_2','nombre_largo_2_2','columna_4','columna_5']);expect((await cells())[0]).toEqual(['Café','00123'])
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source)
})
it('rechaza revisiones antiguas, límites y parámetros inválidos antes de modificar',async()=>{
 await open('A,B\na;b,1\n');const before=await engine.snapshot('a')
 for(const request of [await edit('split',[0,1],{separator:';'}),await edit('split',[0],{separator:''}),await edit('normalize',[2]),await edit('combine',[0],{separator:undefined}),await edit('combine',[0],{separator:',' ,revision:99})])await expect(engine.edit('a',request)).rejects.toThrow()
 expect(await engine.snapshot('a')).toEqual(before)
 await open('A\n'+Array(33).fill('x').join(';')+'\n');const wide=await engine.snapshot('a');await expect(engine.transformPreview('a',await edit('split',[0],{separator:';'}))).rejects.toThrow('32 columnas');expect(await engine.snapshot('a')).toEqual(wide)
 await engine.markSaved('a');const old=await edit('normalize');await engine.edit('a',{type:'cell',rowId:'1',column:0,value:'Nuevo'});await expect(engine.edit('a',old)).rejects.toThrow('cambió')
})
it('cancela preparación y aplicación reales entre bloques, con datos e historial intactos',async()=>{
 await open('A\n'+'é\n'.repeat(5000));let cancel=false,progress=0
 const snapshot=await engine.snapshot('a');engine=new TableEngine(event=>{progress++;if(cancel&&event.rows>=513)void engine.cancelAnalysis('a',event.requestId)});await engine.restore('a',snapshot)
 const before=await engine.snapshot('a');cancel=true
 await expect(engine.transformPreview('a',await edit('normalize'))).rejects.toThrow('cancelada');expect(await engine.snapshot('a')).toEqual(before)
 await expect(engine.edit('a',await edit('normalize'))).rejects.toThrow('cancelada');expect(await engine.snapshot('a')).toEqual(before);expect(progress).toBeGreaterThan(3)
 cancel=false;await engine.edit('a',await edit('normalize'));expect((await cells())[0][0]).toBe('é')
})
it('elimina y restaura muchos grupos de filas sin splices cuadráticos ni expansión excesiva de argumentos',async()=>{
 const source='Clave\n'+Array.from({length:100000},(_,i)=>String(Math.floor(i/2)).padStart(5,'0')).join('\n')+'\n';await open(source)
 await engine.edit('a',await edit('deduplicate'));expect((await engine.info('a')).rowCount).toBe(50000)
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source);await engine.undo('a',true);expect((await engine.info('a')).rowCount).toBe(50000)
 await open('A\n'+'x\n'.repeat(140000));await engine.edit('a',await edit('deduplicate'));expect((await engine.info('a')).rowCount).toBe(1);await engine.undo('a');expect((await engine.info('a')).rowCount).toBe(140000)
},30000)

it('rechaza registros resultantes demasiado grandes y mantiene los límites de estructura',async()=>{
 await open('A,B\n'+ 'a'.repeat(300000)+','+'b'.repeat(300000)+'\n');const before=await engine.snapshot('a')
 await expect(engine.transformPreview('a',await edit('combine',[0,1],{separator:','}))).rejects.toThrow('registro resultante');expect(await engine.snapshot('a')).toEqual(before)
 await open(Array.from({length:200},(_,i)=>'C'+i).join(',')+'\na\n');const wide=await engine.snapshot('a');await expect(engine.edit('a',await edit('split',[0],{separator:';'}))).rejects.toThrow('200 columnas');expect(await engine.snapshot('a')).toEqual(wide)
})

it('genera encabezados derivados sin cortar caracteres Unicode y vuelve a abrir el resultado',async()=>{
 const header='a'.repeat(127)+'😀';await open(header+'\na;b\n');await engine.edit('a',await edit('split',[0],{separator:';'}));const saved=await engine.serialize('a'),path=join(folder,'result.csv');await writeFile(path,saved);await engine.open('b',path);expect((await engine.info('b')).headers).toEqual([header,header+'_1',header+'_2']);expect((await engine.page('b',query)).rows[0].cells).toEqual(['a;b','a','b'])
})
