import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import { closeElectron } from './close-electron'
import {traceElectronFailure} from './electron-trace'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t} from '../../src/shared/i18n'

let app:ElectronApplication,page:Page,folder:string
let stopTrace:(()=>Promise<void>)|undefined
test.beforeEach(async()=>{
 stopTrace=undefined
 folder=await mkdtemp(join(tmpdir(),'freya-editor-status-'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env,locale=test.info().title.match(/\[(en|en-XA)\]$/)?.[1]??'es'
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:locale,FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 if(process.platform==='win32'||process.env.FREYALAB_H13_UNDO_PROBE==='1'){
  await app.evaluate(({BrowserWindow})=>{
   const contents=BrowserWindow.getAllWindows()[0].webContents,original=contents.send
   const probe={seen:0,released:0,held:undefined as unknown[]|undefined,events:[] as {event:string;at:number}[],release(){if(this.held){const args=this.held;this.held=undefined;this.released++;this.events.push({event:'release',at:Date.now()});original.call(contents,'freya:command',...args);return true}return false},stop(){contents.send=original}}
   Reflect.set(globalThis,'h13RealUndo',probe)
   contents.send=function(channel:string,...args:unknown[]){
    if(channel==='freya:command'&&(args[0] as {id?:string})?.id==='edit.undo'&&probe.seen===0){probe.seen++;probe.held=args;probe.events.push({event:'genuine-native-undo-held',at:Date.now()});return}
    return original.call(contents,channel,...args)
   }
  })
  await page.evaluate(()=>{
   const events:unknown[]=[];Reflect.set(window,'h13UndoEvents',events)
   for(const name of ['keydown','beforeinput'])document.addEventListener(name,event=>{
    const key=event as KeyboardEvent,input=event as InputEvent
    if(name==='keydown'&&key.key.toLowerCase()!=='z'||name==='beforeinput'&&input.inputType!=='historyUndo')return
    const item={type:name,key:key.key,inputType:input.inputType,at:Date.now(),trusted:event.isTrusted,prevented:false};events.push(item);queueMicrotask(()=>{item.prevented=event.defaultPrevented})
   },true)
  })
 }
})
test.afterEach(async()=>{await stopTrace?.();await closeElectron(app);await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function open(name:string,source:string){
 const path=join(folder,name);await writeFile(path,source)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 if(name.endsWith('.csv'))await page.getByRole('group',{name:'Vista del CSV',exact:true}).getByRole('button',{name:'Texto',exact:true}).click()
 await expect(page.locator('.cm-content')).toBeVisible()
 return {path,id:doc.id}
}

test('H13-2: posición, selección, sangría y fin de línea de los cuatro editores',async()=>{
 stopTrace=await traceElectronFailure(app.context(),test.info())
 const cases=[['datos.md','Markdown'],['datos.txt','Texto'],['datos.mmd','Mermaid'],['datos.csv','CSV Texto']]
 for(const [name,format] of cases){
  const {id,path}=await open(name,'a,b\r\nc,d\ne,f')
  const bar=page.getByRole('group',{name:'Estado del editor',exact:true})
  await expect(bar.getByText(format,{exact:true})).toBeVisible()
  await expect(bar).toContainText('2 espacios')
  const editor=page.locator('.cm-content')
  await editor.focus();await page.keyboard.press('ControlOrMeta+A')
  await expect(bar).toContainText('Lín 3, Col 4')
  await expect(bar).toContainText('3 líneas, 11 caracteres')
  const endings=bar.getByRole('combobox',{name:'Fin de línea',exact:true})
  await expect(endings).toHaveValue('mixed');await endings.selectOption('CRLF')
  await expect(editor).toBeFocused()
  await expect(endings).toHaveValue('CRLF')
  const text=()=>page.evaluate(async id=>(await window.freya.documents()).find(item=>item.id===id)?.text,id)
  await expect.poll(text).toBe('a,b\r\nc,d\r\ne,f');expect(await readFile(path,'utf8')).toBe('a,b\r\nc,d\ne,f')
  await page.keyboard.press('ControlOrMeta+z')
  let nativeOnlyTentative=false
  if((process.platform==='win32'||process.env.FREYALAB_H13_UNDO_PROBE==='1')&&name==='datos.md'){
   const state=await app.evaluate(({BrowserWindow})=>{const p=Reflect.get(globalThis,'h13RealUndo');return{seen:p.seen,released:p.released,held:!!p.held,events:p.events,windowFocused:BrowserWindow.getAllWindows()[0]?.isFocused()}}),current=await text()
   console.log('[H13-REAL-UNDO] after key',JSON.stringify({state,current,dom:await page.evaluate(()=>({hasFocus:document.hasFocus(),active:document.activeElement?.tagName,events:Reflect.get(window,'h13UndoEvents')}))}))
   if(state.held&&current!=='a,b\r\nc,d\ne,f'){nativeOnlyTentative=true;console.log('[H13-REAL-UNDO] tentative native-only snapshot (inconclusive): releasing before the original mixed assertion');await app.evaluate(()=>Reflect.get(globalThis,'h13RealUndo').release())}
  }
  await expect.poll(text).toBe('a,b\r\nc,d\ne,f')
  await endings.selectOption('LF');await expect.poll(text).toBe('a,b\nc,d\ne,f')
  if((process.platform==='win32'||process.env.FREYALAB_H13_UNDO_PROBE==='1')&&name==='datos.md'){
   const released=await app.evaluate(()=>Reflect.get(globalThis,'h13RealUndo').release())
   console.log('[H13-REAL-UNDO] after LF',JSON.stringify({released,nativeOnlyTentative,state:await app.evaluate(({BrowserWindow})=>{const p=Reflect.get(globalThis,'h13RealUndo');return{seen:p.seen,released:p.released,held:!!p.held,events:p.events,windowFocused:BrowserWindow.getAllWindows()[0]?.isFocused()}})}))
   if(released&&!nativeOnlyTentative){await expect.poll(text).toBe('a,b\r\nc,d\ne,f');console.log('[H13-REAL-UNDO] genuine late undo restored original mixed text')}
   else if(!released&&!nativeOnlyTentative)console.log('[H13-REAL-UNDO] no genuine native command captured; no conclusion about double undo')
   console.log('[H13-REAL-UNDO] before save',JSON.stringify({current:await text(),dom:await page.evaluate(()=>({hasFocus:document.hasFocus(),active:document.activeElement?.tagName,events:Reflect.get(window,'h13UndoEvents')}))}))
   await app.evaluate(()=>Reflect.get(globalThis,'h13RealUndo').stop())
  }
  await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect.poll(()=>readFile(path,'utf8')).toBe('a,b\nc,d\ne,f')
 }
})

for(const locale of ['en','en-XA'] as const)test(`H13-2: la barra cabe a 800 px y anuncia la conversión [${locale}]`,async()=>{
 await page.setViewportSize({width:800,height:720})
 await open('nota.txt','Uno\r\nDos\nTres')
 const bar=page.getByRole('group',{name:t('editor.status.group',{},locale),exact:true})
 const endings=bar.getByRole('combobox',{name:t('editor.status.endings',{},locale),exact:true})
 await expect(endings).toBeInViewport();await endings.focus();await expect(endings).toBeFocused()
 await endings.selectOption('CRLF')
 await expect(bar.getByRole('status')).toContainText('CRLF')
 await expect(page.locator('.cm-content')).toBeFocused()
})
