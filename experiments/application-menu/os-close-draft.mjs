// Prueba diagnóstica fuera de la suite: documenta por separado X y Salir.
// No incorpora un handshake ni cambia el producto. Sólo usa perfiles sintéticos.
import {_electron as electron,expect} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import assert from 'node:assert/strict'

const action=process.argv[2],output=process.argv[3]
if(!['close','quit'].includes(action)||!output)throw new Error('Uso de desarrollo: close|quit y archivo JSON de evidencia.')
const folder=await mkdtemp(join(tmpdir(),'freya-os-close-draft-')),source=join(folder,'original.csv'),questions=join(folder,'questions.json')
let app,page
try{
 const bytes='id,nombre\n00123,Freya\n';await writeFile(source,bytes);await writeFile(questions,'[]')
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:electronPath,args:[resolve('.')],env:{...environment,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile')},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await expect(page.locator('.welcome')).toBeVisible()
 await page.evaluate(path=>window.freya.openPaths([path]),source)
 const cell=page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true});await expect(cell).toHaveText('Freya');await cell.dblclick();await page.getByRole('textbox',{name:'Editar celda',exact:true}).fill('BORRADOR_NO_CONFIRMADO')
 await app.evaluate(({dialog},path)=>{
  const fs=process.getBuiltinModule('node:fs'),values=[]
  Object.defineProperty(dialog,'showMessageBox',{configurable:true,value:async(...args)=>{values.push(args.at(-1).message);fs.writeFileSync(path,JSON.stringify(values));return{response:1,checkboxChecked:false}}})
 },questions)
 const info=await page.evaluate(()=>window.freya.appInfo()),before=await page.evaluate(()=>window.freya.documents())
 let closed=false;page.on('close',()=>closed=true)
 await app.evaluate(({app,BrowserWindow},action)=>{if(action==='quit')app.quit();else BrowserWindow.getAllWindows()[0].close()},action).catch(()=>{})
 await expect.poll(async()=>closed||JSON.parse(await readFile(questions,'utf8')).length>0,{timeout:10000}).toBe(true)
 const prompts=JSON.parse(await readFile(questions,'utf8')),report={platform:process.platform,arch:process.arch,version:info.version,build:info.build,dirtyBefore:before[0]?.dirty,action,closed,promptCount:prompts.length,sourceUnchanged:await readFile(source,'utf8')===bytes,pendingValue:'BORRADOR_NO_CONFIRMADO',expected:'El borrador debe prepararse antes de preguntar/cerrar; Cancelar conserva la ventana.'}
 await writeFile(output,JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify(report))
 assert.equal(closed,false,'Cerrar el sistema descartó el borrador local sin confirmación.')
 assert.equal(prompts.length,1,'No hubo confirmación para el borrador preparado.')
}finally{
 await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})
}
