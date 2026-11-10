import {expect,test,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
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
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

async function open(name:string,bytes:Buffer){
 const path=join(folder,name);await writeFile(path,bytes)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('tab',{name,exact:true})).toBeVisible()
 return {path,doc}
}
const panel=()=>page.getByRole('dialog',{name:label('title'),exact:true})
const control=(encoding='Windows-1252')=>page.locator('footer').getByRole('button',{name:label('control',{encoding}),exact:true})
const content=()=>page.locator('.cm-content')

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
