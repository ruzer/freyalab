import {beforeEach,afterEach,it,expect} from 'vitest'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {TableEngine} from '../src/main/table-engine'
import type {TableRange,TableRangeEdit} from '../src/shared/types'
let engine:TableEngine,folder:string
const query={offset:0,limit:20,requestId:1}
beforeEach(async()=>{engine=new TableEngine();folder=await mkdtemp(join(tmpdir(),'freya-range-'))})
afterEach(async()=>{await rm(folder,{recursive:true,force:true})})
async function open(text:string){const path=join(folder,'datos.csv');await writeFile(path,text);await engine.open('a',path);return path}
async function range(top=0,bottom=0,left=0,right=left):Promise<TableRange>{return{top,bottom,left,right,query,revision:(await engine.info('a')).revision}}
it('previsualiza y transforma un rectángulo filtrado/ordenado sin tocar filas ocultas ni encabezados',async()=>{
 const source='ID,Grupo,Nota,Otro\r\n001,A,"  Dos\r\nlíneas  ",x\r\n002,B,Intacto,y\r\n003,A,  ÁRBOL  ,z\r\n'
 const path=await open(source),before=await engine.snapshot('a')
 const selected={...await range(0,1,2),query:{...query,filters:{'1':'A'},sort:{column:0,descending:true,numeric:false}}}
 const edit:TableRangeEdit={type:'range',range:selected,operation:'trim'}
 const preview=await engine.rangePreview('a',edit)
 expect(preview.cells).toBe(2);expect(preview.changed).toBe(2);expect(preview.samples[0]).toMatchObject({row:0,column:2,before:'  ÁRBOL  ',after:'ÁRBOL'})
 expect(await engine.snapshot('a')).toEqual(before)
 expect(await engine.rangeClipboard('a',selected)).toBe('  ÁRBOL  \n"  Dos\r\nlíneas  "\n')
 await engine.edit('a',edit)
 expect((await engine.page('a',query)).rows.map(row=>row.cells[2])).toEqual(['Dos\r\nlíneas','Intacto','ÁRBOL'])
 expect(await readFile(path,'utf8')).toBe(source)
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source)
 await engine.undo('a',true);await engine.restore('b',await engine.snapshot('a'));await engine.undo('b');expect((await engine.serialize('b')).toString()).toBe(source)
})
it('rellena, borra, reemplaza y pega texto exacto; preserva filas irregulares al deshacer',async()=>{
 const source='ID,Nota,Valor\n001,"dice ""hola""",x\n002\n003,otro,z\n'
 await open(source)
 await engine.edit('a',{type:'range',range:await range(0,1,1,2),operation:'fill',value:'000123'})
 expect((await engine.page('a',query)).rows[1].cells).toEqual(['002','000123','000123'])
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source)
 await engine.edit('a',{type:'range',range:await range(0,0,1),operation:'replace',find:'hola',value:'adiós'})
 expect((await engine.page('a',query)).rows[0].cells[1]).toBe('dice "adiós"');await engine.undo('a')
 await engine.edit('a',{type:'range',range:await range(0,1,1,2),operation:'clear'})
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source)
 await engine.edit('a',{type:'range',range:await range(0,0,1),operation:'paste',values:[['9007199254740993','línea\n2'],['=SUM(A1)','á']]})
 expect((await engine.page('a',query)).rows[0].cells).toEqual(['001','9007199254740993','línea\n2'])
 expect((await engine.page('a',query)).rows[1].cells).toEqual(['002','=SUM(A1)','á'])
 await engine.undo('a');expect((await engine.serialize('a')).toString()).toBe(source)
})
it('opera más allá de una página y copia/exporta el mismo rango en su orden visible',async()=>{
 await open('ID,Valor\n'+Array.from({length:3000},(_,i)=>String(i).padStart(5,'0')+',x').join('\n')+'\n')
 const selected={...await range(190,250,0,1),query:{...query,sort:{column:0,numeric:true,descending:true}}}
 expect((await engine.rangeClipboard('a',selected)).split('\n')[0]).toBe('02809\tx')
 const exported=(await engine.serialize('a',{scope:'selection',range:selected})).toString()
 expect(exported.startsWith('ID,Valor\n02809,x\n')).toBe(true);expect(exported.endsWith('02749,x\n')).toBe(true)
 await engine.edit('a',{type:'range',range:{...selected,left:1,right:1},operation:'fill',value:'0007'})
 const rows=(await engine.page('a',{...query,offset:2748,limit:63})).rows
 expect(rows.filter(row=>row.cells[1]==='0007')).toHaveLength(61);expect(rows[0].cells[1]).toBe('x');expect(rows.at(-1)!.cells[1]).toBe('x')
})
it('rechaza rangos obsoletos, límites y bloques incompatibles íntegros',async()=>{
 await open('A,B\nx,y\nz,w\n');const selected=await range(0,1,0,1),before=await engine.snapshot('a')
 for(const bounds of [{top:-1},{bottom:2},{left:0.5},{right:2},{top:1,bottom:0}])await expect(engine.rangePreview('a',{type:'range',range:{...selected,...bounds},operation:'clear'})).rejects.toThrow()
 for(const values of [[['a','b','c']],[['a'],['b','c']]])await expect(engine.edit('a',{type:'range',range:selected,operation:'paste',values})).rejects.toThrow()
 await expect(engine.edit('a',{type:'range',range:selected,operation:'replace',find:'',value:'x'})).rejects.toThrow()
 expect(await engine.snapshot('a')).toEqual(before)
 await engine.edit('a',{type:'cell',rowId:'1',column:0,value:'actual'})
 const current=await engine.snapshot('a')
 await expect(engine.edit('a',{type:'range',range:selected,operation:'clear'})).rejects.toThrow('cambió')
 await expect(engine.rangeClipboard('a',selected)).rejects.toThrow('cambió')
 expect(await engine.snapshot('a')).toEqual(current)
})

it('rechaza una copia excesiva y una edición que no cabe en deshacer sin cambios parciales',async()=>{
 await open('A\n'+Array.from({length:10},()=> 'a'.repeat(900000)).join('\n')+'\n')
 await expect(engine.rangeClipboard('a',await range(0,9))).rejects.toThrow('8 MiB')
 await open(Array.from({length:25},(_,i)=>'C'+i).join(',')+'\n'+Array(25).fill('').join(',')+'\n')
 const before=await engine.snapshot('a')
 await expect(engine.edit('a',{type:'range',range:await range(0,0,0,24),operation:'fill',value:'x'.repeat(900000)})).rejects.toThrow('20 MiB')
 expect(await engine.snapshot('a')).toEqual(before)
})

it('recupera desde JSON una edición que salta campos ausentes y deshace a la estructura original',async()=>{
 const source='A,B,C\n001\n'
 for(const type of ['range','cell','paste'] as const){
  await open(source)
  const edit=type==='range'?{type,range:await range(0,0,2),operation:'fill' as const,value:'0009'}:type==='cell'?{type,rowId:'1',column:2,value:'0009'}:{type,rowId:'1',column:2,values:[['0009']]}
  await engine.edit('a',edit)
  await engine.restore('b',JSON.parse(JSON.stringify(await engine.snapshot('a'))))
  expect((await engine.page('b',query)).rows[0].cells).toEqual(['001','','0009'])
  await engine.undo('b');expect((await engine.serialize('b')).toString()).toBe(source)
 }
})
