// Medición local con datos sintéticos; no es un comando del producto ni una garantía por plataforma.
import {_electron,expect} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir,cpus,totalmem} from 'node:os'
import assert from 'node:assert/strict'
const output=resolve(process.argv[2]??'/private/tmp/freyalab-resumen-f2a-evidence/measure')
await mkdir(output,{recursive:true});const folder=await mkdtemp(join(tmpdir(),'freya-f2a-measure-'))
const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
const app=await _electron.launch({chromiumSandbox:true,executablePath:electronPath,args:[resolve('out/main/index.js')],env:{...env,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile')}})
const results=[]
try{
 const page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1280,height:720})
 for(const [rows,columns,padding] of [[100,3,0],[3000,3,0],[1000,200,0],[3000,67,0],[3000,3,350],[3000,3,10000],[100000,3,0],[1000000,3,0]]){
  const name=`r${rows}-c${columns}-p${padding}.csv`,file=join(folder,name),headers=Array.from({length:columns},(_,i)=>i===0?'Grupo':`Campo ${i}`)
  const content=headers.join(',')+'\n'+Array.from({length:rows},(_,i)=>[`G${i%4}`,...Array.from({length:columns-1},(_,j)=>j===0?String(i%100):padding?'x'.repeat(padding):'v')].join(',')).join('\n')+'\n'
  await writeFile(file,content);const [doc]=await page.evaluate(file=>window.freya.openPaths([file]),file)
  const timings=[]
  await page.locator('[data-csv-view]').getByRole('button',{name:'Resumen y gráfico',exact:true}).click();const panel=page.locator('.charts-panel')
  await expect(panel.locator('.info-content')).toContainText(name)
  const automatic=!doc.readonly&&!doc.large&&doc.byteLength<=1024*1024&&doc.rowCount<=3000&&doc.rowCount*columns<=200000
  if(!automatic){await expect(panel.locator('.manual')).toBeVisible();await panel.getByRole('button',{name:'Generar gráfico',exact:true}).click()}
  await expect(panel.getByRole('status')).toContainText('Gráfico listo',{timeout:120000})
  // Tres regeneraciones de la misma configuración: incluye preparación, dos consultas y resumen, sin cambiar plazos de la suite.
  await panel.locator('.more-options>summary').click()
  for(let trial=0;trial<3;trial++){
   const start=performance.now();await panel.getByRole('button',{name:'Generar gráfico',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Gráfico listo',{timeout:120000});timings.push(performance.now()-start)
  }
  const result={rows,columns,bytes:doc.byteLength,large:!!doc.large,automatic:await panel.locator('.manual').count()===0,timings,median:[...timings].sort((a,b)=>a-b)[1]};results.push(result);console.log(JSON.stringify(result))
  assert.equal(await readFile(file,'utf8'),content)
 }
 await writeFile(join(output,'measurements.json'),JSON.stringify({hardware:cpus()[0].model,memory:totalmem(),node:process.version,platform:process.platform,arch:process.arch,results},null,2)+'\n')
}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});await rm(folder,{recursive:true,force:true})}
