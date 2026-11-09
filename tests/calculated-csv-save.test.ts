import {createHash} from 'node:crypto'
import {mkdtemp,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import iconv from 'iconv-lite'
import {afterEach,beforeEach,expect,it} from 'vitest'
import {TableEngine} from '../src/main/table-engine'
import type {CalculateColumnEdit} from '../src/shared/calculated-column'

let folder:string, path:string, engine:TableEngine
beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freyalab-calculated-save-'))
 path=join(folder,'data.csv')
 engine=new TableEngine()
})
afterEach(async()=>{await engine.close('csv');await rm(folder,{recursive:true,force:true})})
const calculation=(revision:number,position=1):CalculateColumnEdit=>({
 type:'structure',operation:'calculate',name:'Nueva',position,expression:'1',
 columns:[],onError:'empty',revision,requestId:'save-test'
})
const values=[{rowId:'1',value:'1.25',invalid:[],failed:false},{rowId:'2',value:'2',invalid:[],failed:false}]

it.each([
 {encoding:'utf8',bom:true,delimiter:','},
 {encoding:'win1252',bom:false,delimiter:';'},
 {encoding:'utf16le',bom:true,delimiter:'\t'},
] as const)('saves exact original bytes around calculated and previously edited cells in $encoding',async({encoding,bom,delimiter})=>{
 const row=(...fields:string[])=>fields.join(delimiter)
 const original=row('"ID"','"Nombre"','Nota')+'\r\n'+row('"000124"','"Árbol"','"a""b\nc"')+'\n'+row('900719925474099312345','"café"','""')
 await writeFile(path,iconv.encode(original,encoding,{addBOM:bom}))
 await engine.open('csv',path,{encoding,delimiter})
 const {revision}=await engine.edit('csv',{type:'cell',rowId:'2',column:1,value:'Año'})
 await engine.calculationApply('csv',calculation(revision),values)
 const expected=row('"ID"','Nueva','"Nombre"','Nota')+'\r\n'+row('"000124"','1.25','"Árbol"','"a""b\nc"')+'\n'+row('900719925474099312345','2','Año','""')
 expect(await engine.serialize('csv')).toEqual(iconv.encode(expected,encoding,{addBOM:bom}))
})

it('keeps field and record identities through moves, undo, redo and recovery without the source',async()=>{
 const original='"ID",A,"B"\r\n0001,"same",same\r0002,same,"same"\n'
 await writeFile(path,original)
 let {revision}=await engine.open('csv',path)
 await engine.edit('csv',{type:'deleteColumn',index:2})
 await engine.undo('csv')
 ;({revision}=await engine.info('csv'))
 ;({revision}=await engine.edit('csv',{type:'structure',operation:'moveColumns',columns:[2],destination:1,requestId:'move-column',revision}))
 ;({revision}=await engine.edit('csv',{type:'structure',operation:'moveRows',columns:[],rowIds:['2'],destination:0,requestId:'move-row',revision}))
 const moved='"ID","B",A\r\n0002,"same",same\n0001,same,"same"\r'
 await engine.calculationApply('csv',calculation(revision,2),values)
 const expected='"ID","B",Nueva,A\r\n0002,"same",2,same\n0001,same,1.25,"same"\r'
 expect((await engine.serialize('csv')).toString()).toBe(expected)
 const snapshot=JSON.parse(JSON.stringify(await engine.snapshot('csv')))
 await engine.close('csv')
 await rm(path)
 await engine.restore('csv',snapshot)
 expect((await engine.serialize('csv')).toString()).toBe(expected)
 await engine.undo('csv')
 expect((await engine.serialize('csv')).toString()).toBe(moved)
 await engine.undo('csv',true)
 expect((await engine.serialize('csv')).toString()).toBe(expected)
})

it('uses the actual baseline after ordinary save and blocks a replacement before calculation',async()=>{
 await writeFile(path,'"ID",Value\r\n"0001","a"\r\n"0002","b"\r\n')
 await engine.open('csv',path)
 const {revision}=await engine.edit('csv',{type:'cell',rowId:'2',column:1,value:'changed'})
 const saved=await engine.serialize('csv')
 await writeFile(path,saved)
 const expected={path,hash:createHash('sha256').update(saved).digest('hex')}
 await engine.markSaved('csv',revision,expected)
 await engine.calculationApply('csv',calculation(revision),values,expected)
 expect((await engine.serialize('csv')).toString()).toBe('ID,Nueva,Value\r\n0001,1.25,a\r\n0002,2,changed\r\n')
 const previous=await engine.info('csv')
 await writeFile(path,Buffer.concat([saved,Buffer.from('new row\r\n')]))
 await expect(engine.calculationApply('csv',calculation(previous.revision),values,expected)).rejects.toThrow('archivo cambió')
 expect(await engine.info('csv')).toEqual(previous)
})

it.each([
 {source:'Header\r\n\nvalue\rother\n',destination:2,expected:'Header\r\nvalue\r""\nother\n'},
 {source:'Header\r\n\nvalue',destination:2,expected:'Header\r\nvalue\r\n""'},
])('preserves a moved empty record when its original line ending would lose it',async({source,destination,expected})=>{
 await writeFile(path,source)
 let {revision}=await engine.open('csv',path)
 ;({revision}=await engine.edit('csv',{type:'structure',operation:'moveRows',columns:[],rowIds:['1'],destination,requestId:'move-empty',revision}))
 const rows=(await engine.page('csv',{offset:0,limit:20,requestId:0})).rows
 await engine.calculationApply('csv',calculation(revision),rows.map(row=>({rowId:row.id,value:'1',invalid:[],failed:false})))
 await engine.undo('csv')
 const saved=await engine.serialize('csv')
 expect(saved.toString()).toBe(expected)
 await writeFile(path,saved)
 await engine.markSaved('csv',(await engine.info('csv')).revision,{path,hash:createHash('sha256').update(saved).digest('hex')})
 expect((await engine.open('csv',path)).rowCount).toBe(rows.length)
})

it('keeps original field bytes when undo restores a row deleted before a calculated save',async()=>{
 const original='"ID",Name\r\n"0001","same"\r"0002",same\n'
 await writeFile(path,original)
 await engine.open('csv',path)
 const {revision}=await engine.edit('csv',{type:'deleteRows',ids:['1']})
 const applied=await engine.calculationApply('csv',calculation(revision),[values[1]])
 const saved=await engine.serialize('csv')
 await writeFile(path,saved)
 await engine.markSaved('csv',applied.revision,{path,hash:createHash('sha256').update(saved).digest('hex')})
 await engine.undo('csv')
 await engine.undo('csv')
 expect((await engine.serialize('csv')).toString()).toBe(original)
})
