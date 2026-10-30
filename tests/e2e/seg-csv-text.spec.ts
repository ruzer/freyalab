import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,folder:string,files:string
const source='ID,Nombre\n00123,Ana\n9007199254740993,"dos\nlíneas"\n'
const table=()=>page.getByRole('grid',{name:'Tabla de datos',exact:true})
const editor=()=>page.getByRole('textbox',{name:'Editor CSV como texto',exact:true})
const views=()=>page.getByRole('group',{name:'Vista del CSV',exact:true})
const dialog=()=>page.getByRole('dialog',{name:'Cambiar vista del CSV',exact:true})

test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-seg-s1-'));files=join(folder,'files');await mkdir(files);await writeFile(join(files,'datos.csv'),source)
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_FOLDER:files}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'Abrir',exact:true}).waitFor()
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

async function fromExplorer(view:'Tabla'|'Texto'){
 await page.getByRole('button',{name:'datos.csv',exact:true}).click({button:'right'})
 await page.getByRole('menu',{name:'Abrir CSV',exact:true}).getByRole('menuitem',{name:view==='Tabla'?'Abrir como tabla':'Abrir como texto',exact:true}).click()
}

for(const view of ['Tabla','Texto'] as const)test(`S1a: explorador confirma cambios de ${view} y Cancelar conserva el documento`,async()=>{
 const [opened]=await page.evaluate(path=>window.freya.openPaths([path]),join(files,'datos.csv'));await expect(table()).toBeVisible()
 await page.locator('.toolbar-left').getByRole('button',{name:'Abrir carpeta',exact:true}).click()
 if(view==='Tabla'){
  const cell=table().getByRole('row').nth(1).getByRole('gridcell').nth(1);await cell.dblclick();await cell.getByRole('textbox').fill('Pendiente');await cell.getByRole('textbox').press('Enter')
 }else{
  await views().getByRole('button',{name:'Texto',exact:true}).click();await editor().press('ControlOrMeta+a');await page.keyboard.insertText(source.replace('Ana','Pendiente'))
 }
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(true)
 await fromExplorer(view==='Tabla'?'Texto':'Tabla');await expect(dialog()).toBeVisible()
 for(const name of ['Guardar y cambiar','Descartar cambios y cambiar','Cancelar'])await expect(dialog().getByRole('button',{name,exact:true})).toBeVisible()
 await dialog().getByRole('button',{name:'Cancelar',exact:true}).click();await expect(dialog()).toHaveCount(0)
 const documents=await page.evaluate(()=>window.freya.documents());expect(documents).toHaveLength(1);expect(documents[0]).toMatchObject({id:opened.id,csvView:view==='Tabla'?'table':'text',dirty:true})
 if(view==='Tabla')await expect(table().getByRole('row').nth(1).getByRole('gridcell').nth(1)).toHaveText('Pendiente')
 else await expect(editor()).toContainText('Pendiente')
 expect(await readFile(join(files,'datos.csv'),'utf8')).toBe(source)
})

test('S1a: explorador cambia un documento limpio en la misma pestaña',async()=>{
 const [opened]=await page.evaluate(path=>window.freya.openPaths([path]),join(files,'datos.csv'));await expect(table()).toBeVisible()
 await page.locator('.toolbar-left').getByRole('button',{name:'Abrir carpeta',exact:true}).click()
 for(const view of ['Texto','Tabla'] as const){await fromExplorer(view);await expect(view==='Tabla'?table():editor()).toBeVisible();await expect(dialog()).toHaveCount(0);expect(await page.evaluate(()=>window.freya.documents())).toMatchObject([{id:opened.id,csvView:view==='Tabla'?'table':'text',dirty:false}]);await expect(page.getByRole('tab',{name:'datos.csv',exact:true})).toHaveCount(1)}
 expect(await readFile(join(files,'datos.csv'),'utf8')).toBe(source)
})
