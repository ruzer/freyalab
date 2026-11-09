import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import iconv from 'iconv-lite'
import {mkdtemp,readFile,rename,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {randomUUID} from 'node:crypto'
import type {CalculateColumnEdit} from '../../src/shared/calculated-column'
import type {DocumentInfo} from '../../src/shared/types'

let app:ElectronApplication,page:Page,folder:string

test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-calculated-column-'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({
  chromiumSandbox:true,
  executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,
  args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],
  env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile')},
  timeout:60000
 })
 page=await app.firstWindow()
 await page.waitForFunction(()=>!!window.freya)
})

test.afterEach(async()=>{
 await app?.evaluate(({app})=>app.exit(0)).catch(()=>{})
 await app?.close().catch(()=>{})
 await rm(folder,{recursive:true,force:true})
})

async function open(name:string,bytes:string|Buffer){
 const path=join(folder,name)
 await writeFile(path,bytes)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 expect(doc.kind).toBe('csv')
 return {doc,path}
}

function calculation(doc:DocumentInfo,overrides:Partial<CalculateColumnEdit>={}):CalculateColumnEdit{
 return {
  type:'structure',operation:'calculate',name:'Triple',position:doc.headers!.length,
  expression:'Cantidad * 3',columns:[{index:2,read:'number',scale:0}],onError:'abort',
  revision:doc.revision,requestId:randomUUID(),...overrides
 }
}

async function verifyUnchanged(doc:DocumentInfo,path:string,bytes:string|Buffer){
 const current=await page.evaluate(async id=>{
  const documents=await window.freya.documents()
  const [first]=(await window.freya.tablePage(id,{offset:0,limit:1,requestId:1})).rows
  return {doc:documents.find(document=>document.id===id),first:first.cells}
 },doc.id)
 expect(current.doc).toMatchObject({dirty:false,revision:doc.revision,headers:doc.headers,rowCount:doc.rowCount})
 expect(current.first).toEqual(['00123','Original','2'])
 expect(await readFile(path)).toEqual(Buffer.from(bytes))
}

test('H15-1 IPC: rechaza solicitudes inválidas y un archivo reemplazado tras la vista previa',async()=>{
 const source='ID,Nota,Cantidad\r\n00123,Original,2\r\n'
 const {doc,path}=await open('datos.csv',source),edit=calculation(doc)
 const errors=await page.evaluate(async({id,edit})=>{
  const invalid=[
   {...edit,requestId:'sin-uuid'},
   {...edit,position:-1},
   {...edit,columns:[{index:2,read:'number',scale:13}]},
   {...edit,columns:[{index:2,read:'moneda'}]},
   {...edit,extra:'campo no admitido'},
  ] as CalculateColumnEdit[]
  return Promise.all(invalid.map(async input=>{
   const result=[]
   for(const method of ['transformPreview','tableEdit'] as const){
    try{await window.freya[method](id,input);result.push('')}catch(error){result.push(String(error))}
   }
   return result
  }))
 },{id:doc.id,edit})
 for(const [index,field] of ['requestId','position','scale','read','extra'].entries()){
  for(const error of errors[index])expect(error,field).toContain('Datos de operación no válidos.')
 }
 await verifyUnchanged(doc,path,source)
 const preview=await page.evaluate(({id,edit})=>window.freya.transformPreview(id,edit),{id:doc.id,edit})
 expect(preview.samples[0].after).toBe('6')
 const replacement='ID,Nota,Cantidad\r\n00123,Externo,7\r\n',next=join(folder,'replacement.csv')
 await writeFile(next,replacement)
 await rename(next,path)
 const rejected=await page.evaluate(async({id,edit})=>{
  try{await window.freya.tableEdit(id,edit);return ''}catch(error){return String(error)}
 },{id:doc.id,edit})
 expect(rejected).toContain('El archivo cambió en disco')
 await verifyUnchanged(doc,path,replacement)
})

test('H15-1 IPC: cancelar con progreso real durante la vista previa y al aplicar conserva el CSV',async()=>{
 const source='ID,Nota,Cantidad\n'+'00123,Original,2\n'.repeat(50000)
 const {doc,path}=await open('datos.csv',source)
 for(const action of ['transformPreview','tableEdit'] as const){
  const edit=calculation(doc)
  if(action==='tableEdit'){
   const preview=await page.evaluate(({id,edit})=>window.freya.transformPreview(id,edit),{id:doc.id,edit})
   expect(preview.rows).toBe(50000)
  }
  const result=await page.evaluate(async({id,edit,action})=>{
   let cancelled:Promise<void>|undefined,rows=0,error=''
   const stop=window.freya.onEvent(event=>{
    if(event.type!=='analysis'||event.progress?.requestId!==edit.requestId||cancelled)return
    const progress=event.progress
    const phase=action==='transformPreview'?'Calculando los valores':'calculate.progress.preparing'
    if(progress.phase!==phase||progress.rows===0)return
    rows=progress.rows
    cancelled=window.freya.cancelAnalysis(id,edit.requestId)
   })
   try{await window.freya[action](id,edit)}catch(cause){error=String(cause)}finally{stop()}
   await cancelled
   return {rows,error}
  },{id:doc.id,edit,action})
  expect(result.rows).toBeGreaterThan(0)
  expect(result.rows).toBeLessThan(50000)
  expect(result.error).toMatch(/cancelad[oa]/i)
  await verifyUnchanged(doc,path,source)
 }
})

test('H15-1 IPC: guardar añade solo el campo calculado en TSV, Windows-1252 y UTF-16 LE',async()=>{
 const fixtures=[
  {name:'datos.tsv',encoding:'utf8',header:true,bom:false,delimiter:'\t',eol:'\r\n',
   records:['ID\tNota\tCantidad','00123\t"cita\t«original»"\t2','9007199254740993\t"línea\r\n""dos"""\t3']},
  {name:'windows.csv',encoding:'win1252',header:true,bom:false,delimiter:';',eol:'\r\n',
   records:['ID;Nota;Cantidad','00123;"€ café";2','9007199254740993;"línea\r\n""dos""";3']},
  {name:'sin-encabezados.csv',encoding:'utf16le',header:false,bom:true,delimiter:';',eol:'\r\n',
   records:['00123;"你好\r\n""dos""";2','9007199254740993;"conservar";3']}
 ]
 for(const fixture of fixtures){
  const {name,encoding,header,bom,delimiter,eol,records}=fixture
  const encode=(lines:string[])=>iconv.encode(lines.join(eol)+(header?eol:''),encoding,{addBOM:bom})
  const original=encode(records),opened=await open(name,original)
  let doc=opened.doc
  if(!header)doc=await page.evaluate(id=>window.freya.tableOptions(id,{header:false}),doc.id)
  expect(doc.encoding,name).toBe(encoding)
  expect(doc.delimiter,name).toBe(delimiter)
  expect(doc.rowCount,name).toBe(2)
  const expression=header?'Cantidad * 3':'"Columna 3" * 3'
  const result=await page.evaluate(async({id,edit})=>{
   const preview=await window.freya.transformPreview(id,edit)
   const updated=await window.freya.tableEdit(id,edit)
   const data=await window.freya.tablePage(id,{offset:0,limit:2,requestId:1})
   return {preview,updated,values:data.rows.map(row=>row.cells.at(-1))}
  },{id:doc.id,edit:calculation(doc,{expression})})
  expect(result.preview).toMatchObject({rows:2,emptyRows:0,failures:0})
  expect(result.updated.dirty).toBe(true)
  expect(result.values).toEqual(['6','9'])
  expect(await readFile(opened.path),name).toEqual(original)
  await page.evaluate(id=>window.freya.save(id),doc.id)
  const fields=header?['Triple','6','9']:['6','9']
  expect(await readFile(opened.path),name).toEqual(encode(records.map((record,index)=>record+delimiter+fields[index])))
 }
})
