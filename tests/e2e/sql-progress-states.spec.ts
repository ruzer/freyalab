import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t,type Language} from '../../src/shared/i18n'
import {closeElectron} from './close-electron'
import {openAnalysis,chartPanel,createSuggestedChart} from './panel'

type Phase='engine'|'loading'|'query'|'results'
let app:ElectronApplication,page:Page,folder:string
const csv='Ciudad,Valor\r\n'+Array.from({length:2400},(_,i)=>`${i%2?'Sur':'Norte'},${i%10+1}`).join('\r\n')+'\r\n'

test.beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-sql-progress-'))})
test.afterEach(async()=>{
 if(app){await releaseAll();await closeElectron(app)}
 await rm(folder,{recursive:true,force:true})
})

async function launch(language:Language){
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:language,FREYALAB_USER_DATA:join(folder,'profile')},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 const path=join(folder,'ventas.csv');await writeFile(path,csv)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('tab',{name:doc.name,exact:true})).toHaveAttribute('aria-selected','true')
 return{path,doc}
}

// Solo pausa las fronteras para observar cada estado; Chromium, DuckDB, Arrow y la consulta siguen siendo reales.
async function installGates(){
 await app.evaluate(({BrowserWindow,ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  type Stage='engine'|'loading'|'query'|'results'
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,handler=handlers.get('freya')!,load=BrowserWindow.prototype.loadURL
  const gates=new Map<Stage,{entered:boolean;used:boolean;release:()=>void}>(['engine','loading','query','results'].map(stage=>[stage as Stage,{entered:false,used:false,release:()=>{}}]))
  const restoreScripts:(()=>void)[]=[]
  const hold=async(stage:Stage)=>{
   const gate=gates.get(stage)!
   if(gate.used)return
   gate.used=true
   await new Promise<void>(resolve=>{gate.entered=true;gate.release=resolve})
  }
  BrowserWindow.prototype.loadURL=async function(this:Electron.BrowserWindow,url:string,options?:Electron.LoadURLOptions){
   if(url.startsWith('freyalab-analysis://engine/')){
    const contents=this.webContents,execute=contents.executeJavaScript
    contents.executeJavaScript=async function(code,userGesture){
     if(code.includes('globalThis.freyaSQL.append('))await hold('loading')
     if(code.includes('globalThis.freyaSQL.query('))await hold('query')
     return execute.call(this,code,userGesture)
    }
    restoreScripts.push(()=>{contents.executeJavaScript=execute})
    await hold('engine')
   }
   return load.call(this,url,options)
  }
  handlers.set('freya',async(event,...args)=>{
   const response=await handler(event,...args)
   if(args[0]==='sqlRun')await hold('results')
   return response
  })
  Reflect.set(globalThis,'sqlProgressGates',{
   entered:(stage:Stage)=>gates.get(stage)!.entered,
   release:(stage:Stage)=>gates.get(stage)!.release(),
   dispose:()=>{for(const gate of gates.values()){gate.used=true;gate.release()}BrowserWindow.prototype.loadURL=load;handlers.set('freya',handler);for(const restore of restoreScripts)restore();Reflect.deleteProperty(globalThis,'sqlProgressGates')}
  })
 })
}

async function releaseAll(){await app.evaluate(()=>Reflect.get(globalThis,'sqlProgressGates')?.dispose()).catch(()=>{})}
async function verifyPhases(visible:Locator,language:Language,announcement=visible){
 for(const phase of ['engine','loading','query','results'] as const){
  await expect.poll(()=>app.evaluate((_electron,phase)=>Reflect.get(globalThis,'sqlProgressGates').entered(phase),phase)).toBe(true)
  const message=t('analysis.progress.'+phase,{},language)
  await expect(visible).toHaveText(message);await expect(announcement).toHaveText(message)
  await visible.scrollIntoViewIfNeeded();await expect(visible).toBeVisible()
  await expect.poll(async()=>(await visible.boundingBox())?.height??0).toBeGreaterThanOrEqual(12)
  await expect(announcement).toHaveAttribute('role','status')
  await app.evaluate((_electron,phase)=>Reflect.get(globalThis,'sqlProgressGates').release(phase),phase)
 }
}

for(const language of ['es','en','en-XA'] as const)test(`SQL muestra fases reales en ${language}, con resultado exacto y CSV intacto`,async()=>{
 const {path,doc}=await launch(language)
 await openAnalysis(page,'SQL')
 const panel=page.getByRole('region',{name:'Análisis SQL y asistentes',exact:true}),editor=panel.getByRole('textbox',{name:'Consulta SQL',exact:true})
 await editor.focus();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText('SELECT COUNT(*) AS Filas, SUM(CAST("Valor" AS BIGINT)) AS Total FROM datos')
 await installGates()
 try{
  await panel.getByRole('button',{name:'Ejecutar consulta',exact:true}).click()
  await verifyPhases(panel.getByRole('status'),language)
  await expect(panel.getByRole('status')).toContainText('Consulta completa')
  await expect.poll(()=>panel.locator('.sql-results tbody tr td').allTextContents()).toEqual(['2400','13200'])
  expect((await page.evaluate(()=>window.freya.documents())).find(current=>current.id===doc.id)).toMatchObject({dirty:false,revision:doc.revision,rowCount:2400})
  expect(await readFile(path,'utf8')).toBe(csv)
 }finally{await releaseAll()}
})

test('el gráfico muestra la misma fase visible y anunciada antes de dibujar datos reales',async()=>{
 const {path,doc}=await launch('es')
 await openAnalysis(page,'Gráficos');const panel=chartPanel(page)
 await installGates()
 try{
  await createSuggestedChart(page)
  await verifyPhases(panel.locator('.result-status'),'es',panel.locator('.result-announcement'))
  await expect(panel.locator('.pivot-result tbody tr')).toHaveCount(2)
  await expect(panel.locator('.pivot-result tbody tr').filter({hasText:'Norte'}).locator('td').first()).toHaveText('6,000')
  await expect(panel.locator('.pivot-result tbody tr').filter({hasText:'Sur'}).locator('td').first()).toHaveText('7,200')
  await expect(panel.locator('.pivot-result tfoot td').first()).toHaveText('13,200')
  await expect(panel.locator('.plot svg')).toBeVisible()
  expect((await page.evaluate(()=>window.freya.documents())).find(current=>current.id===doc.id)).toMatchObject({dirty:false,revision:doc.revision,rowCount:2400})
  expect(await readFile(path,'utf8')).toBe(csv)
 }finally{await releaseAll()}
})
