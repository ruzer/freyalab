import {test,expect,_electron as electron} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import type {CalculateColumnEdit} from '../../src/shared/calculated-column'

test('medición H15-1, 200.000 filas por seis columnas @perf',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'freya-h15-measurement-'))
 const path=join(dir,'ventas.csv'),rows=200_000,header='ID,Precio unitario,Cantidad,Fecha,Región,Nota'
 const records=Array.from({length:rows},(_,index)=>`${String(index+1).padStart(6,'0')},${index%2?'0.1':'10.10'},3,2026-11-09,"México",original`)
 const source=[header,...records].join('\r\n')+'\r\n'
 const expected=[`${header},Total`,...records.map((row,index)=>`${row},${index%2?'0.30':'30.30'}`)].join('\r\n')+'\r\n'
 let app:Awaited<ReturnType<typeof electron.launch>>|undefined
 try{
  await writeFile(path,source)
  const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
  app=await electron.launch({chromiumSandbox:true,executablePath:electronPath as unknown as string,args:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(dir,'profile')},timeout:60000})
  const page=await app.firstWindow()
  await page.waitForFunction(()=>!!window.freya)
  const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
  expect(doc.rowCount).toBe(rows)
  const output=await page.evaluate(async({id,revision,rows})=>{
   const edit:CalculateColumnEdit={type:'structure',operation:'calculate',name:'Total',position:6,expression:'"Precio unitario" * Cantidad',columns:[{index:1,read:'number',scale:2},{index:2,read:'number',scale:0}],onError:'abort',revision,requestId:crypto.randomUUID()}
   const start=performance.now(),preview=await window.freya.transformPreview(id,edit),afterPreview=performance.now()
   const updated=await window.freya.tableEdit(id,edit),afterApply=performance.now()
   const last=(await window.freya.tablePage(id,{offset:rows-1,limit:1,requestId:1})).rows[0]?.cells
   return {previewMs:afterPreview-start,applyMs:afterApply-afterPreview,totalMs:afterApply-start,rows:preview.rows,emptyRows:preview.emptyRows,dirty:updated.dirty,last}
  },{id:doc.id,revision:doc.revision,rows})
  expect(output).toMatchObject({rows,emptyRows:0,dirty:true,last:['200000','0.1','3','2026-11-09','México','original','0.30']})
  const hash=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex')
  expect(hash(await readFile(path))).toBe(hash(source))
  const saveStart=performance.now()
  await page.evaluate(id=>window.freya.save(id),doc.id)
  const saveMs=performance.now()-saveStart
  console.log('H15-MEASUREMENT '+JSON.stringify({platform:process.platform,arch:process.arch,rows,columns:6,previewMs:output.previewMs,applyMs:output.applyMs,totalMs:output.totalMs,saveMs}))
  expect(hash(await readFile(path))).toBe(hash(expected))
 }finally{
  await app?.evaluate(({app})=>app.exit(0)).catch(()=>{})
  await app?.close().catch(()=>{})
  await rm(dir,{recursive:true,force:true})
 }
})
