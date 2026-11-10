import {expect,test,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import { closeElectron } from './close-electron'
import electronPath from 'electron'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t,type Language} from '../../src/shared/i18n'

let app:ElectronApplication,page:Page,folder:string,locale:Language
const label=(key:string,values?:Record<string,string>)=>t('textEncoding.'+key,values,locale)
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-text-encoding-'))
 locale=(test.info().title.match(/\[(en|en-XA)\]$/)?.[1]??'es') as Language
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[process.env.FREYALAB_H13_ENCODING_ENTRY??resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:locale,FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
})
test.afterEach(async()=>{await closeElectron(app);await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

async function open(name:string,bytes:Buffer){
 const path=join(folder,name);await writeFile(path,bytes)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('tab',{name,exact:true})).toBeVisible()
 return {path,doc}
}
const panel=()=>page.getByRole('dialog',{name:label('title'),exact:true})
const control=(encoding='Windows-1252')=>page.locator('footer').getByRole('button',{name:label('control',{encoding}),exact:true})
const content=()=>page.locator('.cm-content')
const status=()=>page.locator('.statusbar')
const current=(id:string)=>page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),id)
const saveButton=(as=false)=>page.getByRole('button',{name:as?'Guardar como':'Guardar',exact:true})

type HeldOperation='save'|'saveTextEncoding'|'update'
type SaveTestGlobal=typeof globalThis&{heldReplies?:Partial<Record<HeldOperation,()=>void>>}
async function holdReplies(id:string,operations:HeldOperation[]){
 await app.evaluate(({ipcMain},{id,operations})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  const state=globalThis as SaveTestGlobal,remaining=new Set(operations)
  state.heldReplies={}
  handlers.set('freya',async(event,...args)=>{
   const [operation,documentId]=args as [HeldOperation,string]
   if(documentId!==id||!remaining.delete(operation))return original(event,...args)
   if(!remaining.size)handlers.set('freya',original)
   const response=await original(event,...args)
   // Pause only the reply. The real operation and its disk writes have completed.
   await new Promise<void>(release=>{state.heldReplies![operation]=release})
   return response
  })
 },{id,operations})
}
async function waitForReply(operation:HeldOperation){
 await expect.poll(()=>app.evaluate((_,operation)=>!!(globalThis as SaveTestGlobal).heldReplies?.[operation],operation)).toBe(true)
}
async function releaseReply(operation:HeldOperation){
 await app.evaluate((_,operation)=>(globalThis as SaveTestGlobal).heldReplies![operation]!(),operation)
}
async function append(text:string){
 await content().focus();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.insertText(text)
}

for(const {name,original,line,as,holdUpdate} of [
 {name:'carrera.txt',original:'UNO\n',line:'DOS\n',as:false,holdUpdate:false},
 {name:'carrera.mmd',original:'flowchart LR\n  A --> B\n',line:'%% DOS\n',as:true,holdUpdate:false},
 {name:'carrera.csv',original:'ID,Nombre\n1,UNO\n',line:'2,DOS\n',as:false,holdUpdate:true}
])test(`Guardado en curso conserva las ediciones posteriores (${name})`,async()=>{
 const {doc,path}=await open(name,Buffer.from(original)),target=as?join(folder,'copia.mmd'):path
 if(name.endsWith('.csv'))await page.getByRole('button',{name:'Texto',exact:true}).click()
 await expect(content()).toHaveAttribute('contenteditable','true')
 await append(line)
 const snapshot=original+line
 await expect.poll(async()=>(await current(doc.id))?.text).toBe(snapshot)
 if(as)await app.evaluate((_,target)=>{process.env.FREYALAB_TEST_SAVE_PATH=target},target)
 await holdReplies(doc.id,holdUpdate?['save','update']:['save'])
 await saveButton(as).click();await waitForReply('save')
 expect(await readFile(target,'utf8')).toBe(snapshot)

 const newer=name.endsWith('.csv')?'3,TRES\n':as?'%% TRES\n':'TRES\n'
 await append(newer)
 await expect(content()).toContainText('TRES')
 if(holdUpdate)await waitForReply('update')
 await expect.poll(()=>current(doc.id)).toMatchObject({path:as?target:doc.path,dirty:true,text:snapshot+newer})
 await releaseReply('save')
 await expect(status()).toContainText('Archivo guardado')
 await expect(content()).toContainText('TRES')
 await expect(status().getByText('Cambios pendientes',{exact:true})).toBeVisible()
 if(as)await expect(page.getByRole('tab',{name:/^copia\.mmd/,selected:true})).toBeVisible()
 if(holdUpdate)await releaseReply('update')
 await saveButton().click()
 await expect(status().getByText('Guardado',{exact:true})).toBeVisible()
 expect(await readFile(target,'utf8')).toBe(snapshot+newer)
 if(as)expect(await readFile(path,'utf8')).toBe(original)
})

test('Guardar con codificación aplica la firma y conserva las ediciones posteriores',async()=>{
 const {path,doc}=await open('codificacion.txt',Buffer.from('UNO\n'))
 await append('DOS\n')
 const snapshot='UNO\nDOS\n',encoded=(text:string)=>Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(text,'utf16le')])
 await expect.poll(async()=>(await current(doc.id))?.text).toBe(snapshot)
 await holdReplies(doc.id,['saveTextEncoding'])
 await control('UTF-8').click()
 await panel().getByRole('combobox',{name:label('choice'),exact:true}).selectOption('utf16le')
 await panel().getByRole('button',{name:label('save'),exact:true}).click()
 await waitForReply('saveTextEncoding')
 expect(await readFile(path)).toEqual(encoded(snapshot))

 // The native modal normally blocks input. Allow a real editor transaction during the held reply.
 await panel().evaluate(dialog=>(dialog as HTMLDialogElement).close())
 await append('TRES\n')
 await expect.poll(async()=>(await current(doc.id))?.text).toBe(snapshot+'TRES\n')
 await releaseReply('saveTextEncoding')
 await expect(status()).toContainText(label('saved'))
 await expect(content()).toContainText('TRES')
 await expect(status().getByText('Cambios pendientes',{exact:true})).toBeVisible()
 await expect(control('UTF-16 LE · BOM')).toBeEnabled()
 await saveButton().click()
 await expect(status().getByText('Guardado',{exact:true})).toBeVisible()
 expect(await readFile(path)).toEqual(encoded(snapshot+'TRES\n'))
})

test('Markdown sigue bloqueado mientras espera la confirmación de guardado',async()=>{
 const {path,doc}=await open('carrera.md',Buffer.from('# UNO\n'))
 await page.getByRole('button',{name:'Editar',exact:true}).click()
 await append('DOS\n')
 const snapshot='# UNO\nDOS\n'
 await expect.poll(async()=>(await current(doc.id))?.text).toBe(snapshot)
 await holdReplies(doc.id,['save'])
 await saveButton().click();await waitForReply('save')
 await expect(content()).toHaveAttribute('contenteditable','false')
 await append('TRES\n')
 await expect(content()).not.toContainText('TRES')
 await releaseReply('save')
 await expect(content()).toHaveAttribute('contenteditable','true')
 await expect(status().getByText('Guardado',{exact:true})).toBeVisible()
 expect(await readFile(path,'utf8')).toBe(snapshot)
 expect(await current(doc.id)).toMatchObject({dirty:false,text:snapshot})
})

test('H13-2: un Markdown legado requiere confirmación y conserva los bytes al guardarlo',async()=>{
 const original=Buffer.from('# café\r\nPrecio \x80\n','latin1'),{path}=await open('legado.md',original)
 await page.getByRole('button',{name:'Editar',exact:true}).click()
 await expect(content()).toHaveAttribute('contenteditable','false')
 await expect(page.locator('.warning-banner')).toContainText('Windows-1252')
 expect(await readFile(path)).toEqual(original)

 await page.getByRole('button',{name:label('confirm'),exact:true}).press('Enter')
 await expect(panel()).toBeVisible()
 await expect(panel().getByRole('button',{name:label('save'),exact:true})).toBeDisabled()
 await panel().getByRole('button',{name:label('reopen'),exact:true}).press('Enter')
 await expect(panel()).toHaveCount(0)
 await expect(content()).toHaveAttribute('contenteditable','true')
 await expect(content()).toContainText('Precio €')
 expect(await readFile(path)).toEqual(original)

 await expect(control()).toBeFocused()
 await control().press('Enter')
 await panel().getByRole('button',{name:label('save'),exact:true}).press('Enter')
 await expect(panel()).toHaveCount(0)
 expect(await readFile(path)).toEqual(original)

 await control().press('Enter')
 await panel().getByRole('combobox',{name:label('choice'),exact:true}).selectOption('utf8')
 await expect(panel()).toContainText(label('writeExplanation',{encoding:'UTF-8'}))
 expect(await readFile(path)).toEqual(original)
 await panel().getByRole('button',{name:label('save'),exact:true}).press('Enter')
 await expect(panel()).toHaveCount(0)
 expect(await readFile(path)).toEqual(Buffer.from('# café\r\nPrecio €\n'))
})

for(const lang of ['en','en-XA'])test(`H13-2: UTF-16 BE muestra su firma, guarda intacto y protege el BOM [${lang}]`,async()=>{
 const original=Buffer.concat([Buffer.from([0xfe,0xff]),Buffer.from('flowchart LR\r\n A-->B\n','utf16le').swap16()])
 const {path}=await open('diagrama.mmd',original),button=control('UTF-16 BE · BOM')
 await expect(button).toContainText('BOM')
 await button.press('Enter')
 await expect(panel().getByRole('combobox',{name:label('choice'),exact:true})).toHaveValue('utf16be')
 await panel().getByRole('button',{name:label('save'),exact:true}).press('Enter')
 await expect(panel()).toHaveCount(0)
 expect(await readFile(path)).toEqual(original)
 await button.press('Enter')
 await panel().getByRole('combobox',{name:label('choice'),exact:true}).selectOption('latin1')
 await panel().getByRole('button',{name:label('save'),exact:true}).press('Enter')
 await expect(panel().getByRole('alert')).toHaveText(label('error.bomSave'))
 expect(await readFile(path)).toEqual(original)
 await page.keyboard.press('Escape')
 await expect(button).toBeFocused()
})
