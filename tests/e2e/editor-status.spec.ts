import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import { closeElectron } from './close-electron'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t} from '../../src/shared/i18n'

let app:ElectronApplication,page:Page,folder:string
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-editor-status-'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env,locale=test.info().title.match(/\[(en|en-XA)\]$/)?.[1]??'es'
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:locale,FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await closeElectron(app);await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function open(name:string,source:string){
 const path=join(folder,name);await writeFile(path,source)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 if(name.endsWith('.csv'))await page.getByRole('group',{name:'Vista del CSV',exact:true}).getByRole('button',{name:'Texto',exact:true}).click()
 await expect(page.locator('.cm-content')).toBeVisible()
 return {path,id:doc.id}
}

test('H13-2: posición, selección, sangría y fin de línea de los cuatro editores',async()=>{
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
  await page.keyboard.press('ControlOrMeta+z');await expect.poll(text).toBe('a,b\r\nc,d\ne,f')
  await endings.selectOption('LF');await expect.poll(text).toBe('a,b\nc,d\ne,f')
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
