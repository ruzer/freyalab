import {test,expect,_electron as electron,type ElectronApplication} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {chartPanel,chartSuggestion,openAnalysis} from './panel'
import {closeElectron} from './close-electron'

let app:ElectronApplication|undefined,folder:string|undefined
test.afterEach(async()=>{if(app)await closeElectron(app);if(folder)await rm(folder,{recursive:true,force:true})})

test('los 200 campos publican sus tipos juntos, sin una clasificación provisional durante la lectura',async({},info)=>{
 folder=await mkdtemp(join(tmpdir(),'freya-field-loading-'))
 const headers=['Ventas','Fecha','Código «México»','Descuento','Importe','Grupo',...Array.from({length:194},(_,i)=>'Campo '+(i+6))]
 const quote=(value:string)=>/[",\r\n]/.test(value)?'"'+value.replaceAll('"','""')+'"':value
 const rows=Array.from({length:3},(_,i)=>[String(1200+i/2),'2026-01-0'+(i+1),'00'+(123+i),i===1?'20%':'10%','$1,200.50',i===1?'Sur':'Norte',...Array.from({length:194},(_,column)=>String(column+i+1))])
 const original=[headers,...rows].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n',path=join(folder,'campos.csv')
 await writeFile(path,original)
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile')}})
 const page=await app.firstWindow()
 await page.waitForFunction(()=>!!window.freya)
 await page.setViewportSize({width:1280,height:720})
 await page.emulateMedia({reducedMotion:'reduce'})
 await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('tab',{name:'campos.csv',exact:true})).toHaveAttribute('aria-selected','true')
 await page.evaluate(()=>{
  const state={loadingSeen:false,provisional:[] as {numeric:number;fields:number}[]}
  const inspect=()=>{
   const fields=document.querySelector('.analysis-workspace:not([hidden]) .charts-panel .chart-fields')
   if(!fields||![...fields.querySelectorAll(':scope>p')].some(node=>node.textContent==='Leyendo los tipos de campo…'))return
   state.loadingSeen=true
   const numeric=fields.querySelectorAll('.field-badge[title="Número"]').length
   if(numeric>0&&numeric<195&&state.provisional.length<5&&!state.provisional.some(value=>value.numeric===numeric))state.provisional.push({numeric,fields:fields.querySelectorAll('[role="listitem"]').length})
  }
  const observer=new MutationObserver(inspect)
  observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','hidden']})
  ;(window as Window&{stopFieldLoadingObservation?:()=>typeof state}).stopFieldLoadingObservation=()=>{inspect();observer.disconnect();return state}
 })
 await openAnalysis(page,'Gráficos')
 let observation={loadingSeen:false,provisional:[] as {numeric:number;fields:number}[]}
 try{await expect(chartSuggestion(page)).toBeEnabled()}
 finally{
  observation=await page.evaluate(()=>{const target=window as Window&{stopFieldLoadingObservation?:()=>{loadingSeen:boolean;provisional:{numeric:number;fields:number}[]}};const result=target.stopFieldLoadingObservation!();delete target.stopFieldLoadingObservation;return result})
  await info.attach('publicacion-de-perfiles',{body:JSON.stringify(observation,null,2),contentType:'application/json'})
 }
 expect(observation.provisional,'Durante «Leyendo los tipos de campo…» no se deben presentar tipos parcialmente calculados.').toEqual([])
 const fields=chartPanel(page).getByRole('complementary',{name:'Campos y zonas',exact:true})
 await expect(fields.getByRole('listitem')).toHaveCount(200)
 const badge=(name:string)=>fields.getByRole('listitem').filter({has:page.getByText(name,{exact:true})}).locator('.field-badge')
 await expect(badge('Ventas')).toHaveText('Número')
 await expect(badge('Campo 199')).toHaveText('Número')
 await expect(badge('Fecha')).toHaveText('Fecha')
 await expect(badge('Código «México»')).toHaveText('Texto')
 await expect(badge('Grupo')).toHaveText('Categoría')
 for(const name of ['Descuento','Importe']){
  await expect(badge(name)).toHaveText('Categoría')
  await expect(badge(name)).toHaveAttribute('title','Parece un monto o un porcentaje')
 }
 await expect(fields.locator('.field-badge[title="Número"]')).toHaveCount(195)
 await expect(fields.getByText('Leyendo los tipos de campo…',{exact:true})).toHaveCount(0)
 await expect(chartPanel(page).locator('.pivot-result')).toHaveCount(0)
 expect(await readFile(path,'utf8')).toBe(original)
})
