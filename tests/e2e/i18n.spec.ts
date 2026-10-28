import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
let app:ElectronApplication,page:Page,folder:string

test.beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-i18n-'))})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function launch(language:string,testMode=true){
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[process.env.FREYALAB_I18N_TEST_ENTRY??resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:testMode?'1':'0',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_LANG:language}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
}
async function language(value:'es'|'en'|'sistema'){await page.evaluate(value=>window.freya.setLanguage(value),value)}
async function screenshots(name:string){
 for(const size of [{width:1440,height:900},{width:720,height:600}]){
  await page.setViewportSize(size)
  for(const theme of ['light','dark']){
   await page.getByLabel('Tema',{exact:true}).selectOption(theme)
   await expect(page.locator('.preview .render-progress')).toHaveCount(0)
   if(process.env.FREYALAB_I18N_EVIDENCE==='1')await page.screenshot({path:`docs/evidence/i18n-01-${name}-${theme}-${size.width}x${size.height}.png`,animations:'disabled'})
  }
 }
 await page.setViewportSize({width:1440,height:900})
}
test('I5/I6 · cambiar de idioma actualiza el piloto y los diálogos, sin tocar documentos',async()=>{
 await launch('es')
 await expect.poll(()=>page.evaluate(()=>typeof window.freya.language)).toBe('function')
 expect(await page.evaluate(()=>window.freya.language())).toEqual({preference:'sistema',language:'es'})
 const path=join(folder,'informe á.md'),source='# Informe\n\nContenido original.';await writeFile(path,source)
 const[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.locator('.cm-content')).toBeVisible();await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.insertText('\nCambio sin guardar')
 const snapshot=await page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),doc.id)
 await screenshots('es')
 await language('en');await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.getByRole('button',{name:'Open',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Save',exact:true})).toBeEnabled();await screenshots('en')
 await app.evaluate(({dialog})=>{
  const state=globalThis as typeof globalThis&{nativeOpen?:Electron.OpenDialogOptions;nativeSave?:Electron.SaveDialogOptions;nativeClose?:Electron.MessageBoxOptions}
  dialog.showOpenDialog=(async(_window:Electron.BaseWindow,options:Electron.OpenDialogOptions)=>{state.nativeOpen=options;return{canceled:true,filePaths:[]}}) as unknown as typeof dialog.showOpenDialog
  dialog.showSaveDialog=(async(_window:Electron.BaseWindow,options:Electron.SaveDialogOptions)=>{state.nativeSave=options;return{canceled:true,filePath:''}}) as unknown as typeof dialog.showSaveDialog
  dialog.showMessageBox=(async(_window:Electron.BaseWindow,options:Electron.MessageBoxOptions)=>{state.nativeClose=options;return{response:options.type==='warning'?0:1,checkboxChecked:false}}) as unknown as typeof dialog.showMessageBox
 })
 await page.getByRole('button',{name:'Open',exact:true}).click()
 await expect.poll(()=>app.evaluate(()=>(globalThis as typeof globalThis&{nativeOpen?:Electron.OpenDialogOptions}).nativeOpen)).toMatchObject({title:'Open files',buttonLabel:'Open',filters:[{name:'Documents'}]})
 await page.getByRole('button',{name:'Open folder',exact:true}).click()
 await expect.poll(()=>app.evaluate(()=>(globalThis as typeof globalThis&{nativeOpen?:Electron.OpenDialogOptions}).nativeOpen)).toMatchObject({title:'Open folder',buttonLabel:'Open',properties:['openDirectory']})
 await page.getByRole('button',{name:'Save as',exact:true}).click()
 await expect.poll(()=>app.evaluate(()=>(globalThis as typeof globalThis&{nativeSave?:Electron.SaveDialogOptions}).nativeSave)).toMatchObject({title:'Save file'})
 await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByRole('button',{name:'HTML autónomo',exact:true}).click()
 await expect.poll(()=>app.evaluate(()=>(globalThis as typeof globalThis&{nativeSave?:Electron.SaveDialogOptions}).nativeSave)).toMatchObject({title:'Export a copy',buttonLabel:'Save'})
 await page.evaluate(id=>window.freya.reload(id),doc.id)
 expect(await app.evaluate(()=>(globalThis as typeof globalThis&{nativeClose?:Electron.MessageBoxOptions}).nativeClose)).toMatchObject({title:'External changes',buttons:['Keep my changes','Reload and discard changes']})
 expect(await page.evaluate(id=>window.freya.close(id),doc.id)).toBe(false)
 expect(await app.evaluate(()=>(globalThis as typeof globalThis&{nativeClose?:Electron.MessageBoxOptions}).nativeClose)).toMatchObject({buttons:['Save','Cancel','Discard changes'],message:'Save changes to informe á.md?'})
 await expect(page.evaluate(()=>window.freya.setLanguage('invalido' as 'es'))).rejects.toThrow('Invalid operation data.')
 try{await page.evaluate(()=>window.freya.setLanguage('invalido' as 'es'));throw new Error('Se aceptó un idioma inválido')}catch(error){expect(String(error)).not.toContain('Error invoking remote method')}
 const after=await page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),doc.id)
 expect(after?.text).toBe(snapshot?.text);expect(after?.dirty).toBe(true);expect(await readFile(path,'utf8')).toBe(source)
 await language('es');await expect(page.locator('html')).toHaveAttribute('lang','es');await expect(page.getByRole('button',{name:'Abrir',exact:true})).toBeVisible()
})
test('I7/I13 · en-XA muestra el piloto expandido, sin desbordes ni selector prematuro',async()=>{
 await launch('en-XA');await expect(page.locator('html')).toHaveAttribute('lang','en-XA')
 await expect(page.getByRole('button',{name:/^\[Öpën~+\]$/})).toBeVisible()
 const controls=page.locator('.toolbar button').filter({hasText:/\[/})
 expect(await controls.count()).toBeGreaterThan(0)
 expect(await controls.evaluateAll(buttons=>buttons.every(button=>button.scrollWidth<=button.clientWidth))).toBe(true)
 await expect(page.getByRole('combobox',{name:/Idioma|Language/})).toHaveCount(0)
 await screenshots('en-XA')
})
test('I9 · FREYALAB_LANG se ignora fuera de FREYALAB_TEST',async()=>{
 await launch('en-XA',false);await expect.poll(()=>page.evaluate(()=>typeof window.freya.language)).toBe('function')
 const actual=await page.evaluate(()=>window.freya.language()),preferred=await app.evaluate(({app})=>app.getPreferredSystemLanguages())
 expect(actual.language).toBe(/^es(?:-|$)/i.test(preferred[0]??'')?'es':'en');expect(actual.language).not.toBe('en-XA')
})
