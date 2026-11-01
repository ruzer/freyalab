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

test('S1b: guardar un CSV inválido mantiene Texto limpio con un solo aviso y detalle',async()=>{
 const invalid='ID,Nombre\n1,"abc\n2,fin\n'
 const [opened]=await page.evaluate(path=>window.freya.openPaths([path]),join(files,'datos.csv'));await expect(table()).toBeVisible()
 await views().getByRole('button',{name:'Texto',exact:true}).click();await editor().press('ControlOrMeta+a');await page.keyboard.insertText(invalid)
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents()))[0].text).toBe(invalid)
 await views().getByRole('button',{name:'Tabla',exact:true}).click();await expect(dialog()).toBeVisible()
 await dialog().getByRole('button',{name:'Guardar y cambiar',exact:true}).click()
 const warning=page.getByRole('alert',{name:'Problema de formato CSV',exact:true})
 await expect(warning).toContainText('Se guardó, pero la tabla no puede abrirlo (línea 3). Sigues en Texto.')
 await expect(dialog()).toHaveCount(0);await expect(page.getByRole('alert')).toHaveCount(1)
 await expect(warning.getByRole('button',{name:'Abrir como texto',exact:true})).toHaveCount(0)
 await expect(warning.locator('details')).toHaveJSProperty('open',false)
 await warning.getByText('Detalle técnico del CSV',{exact:true}).click();await expect(warning.locator('pre')).toContainText('Quote Not Closed')
 await expect(editor()).toBeVisible();await expect(page.locator('.dirty-badge,.tabs .dirty-dot')).toHaveCount(0);await expect(page.locator('footer')).not.toContainText('Cambios pendientes')
 expect(await page.evaluate(()=>window.freya.documents())).toMatchObject([{id:opened.id,csvView:'text',dirty:false,text:invalid}])
 expect(await readFile(join(files,'datos.csv'),'utf8')).toBe(invalid)
 await warning.getByRole('button',{name:'Cerrar aviso de formato CSV',exact:true}).click();await expect(warning).toHaveCount(0);await expect(editor()).toBeVisible()
})

test('S1b: un aviso anterior no oculta un fallo nuevo tras guardar el CSV corregido',async()=>{
 const invalid='ID,Nombre\n1,"abc\n2,fin\n',corrected=source.replace('Ana','Corregida')
 const [opened]=await page.evaluate(path=>window.freya.openPaths([path]),join(files,'datos.csv'));await expect(table()).toBeVisible()
 await views().getByRole('button',{name:'Texto',exact:true}).click();await editor().press('ControlOrMeta+a');await page.keyboard.insertText(invalid)
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents()))[0].text).toBe(invalid)
 await views().getByRole('button',{name:'Tabla',exact:true}).click();await dialog().getByRole('button',{name:'Guardar y cambiar',exact:true}).click()
 const warning=page.getByRole('alert',{name:'Problema de formato CSV',exact:true})
 await expect(warning).toContainText('Se guardó, pero la tabla no puede abrirlo (línea 3). Sigues en Texto.')
 await editor().press('ControlOrMeta+a');await page.keyboard.insertText(corrected)
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents()))[0].text).toBe(corrected)
 // Sólo falla recordar Tabla: el CSV y recents.json conservan sus destinos normales.
 const preferences=join(folder,'profile','csv-views.json');await rm(preferences);await mkdir(preferences)
 await views().getByRole('button',{name:'Tabla',exact:true}).click();await dialog().getByRole('button',{name:'Guardar y cambiar',exact:true}).click()
 await expect(dialog().getByRole('alert')).toContainText('csv-views.json')
 await expect(dialog().getByRole('alert')).not.toContainText('Quote Not Closed');await expect(warning).toHaveCount(0)
 expect(await page.evaluate(()=>window.freya.documents())).toMatchObject([{id:opened.id,csvView:'text',dirty:false,text:corrected}])
 expect(await readFile(join(files,'datos.csv'),'utf8')).toBe(corrected)
 await expect(page.locator('.dirty-badge,.tabs .dirty-dot')).toHaveCount(0)
 await dialog().getByRole('button',{name:'Cancelar',exact:true}).click();await expect(dialog()).toHaveCount(0);await expect(warning).toHaveCount(0);await expect(editor()).toBeVisible()
})

test('S1b: la ruta limpia tampoco conserva un aviso anterior de formato CSV',async()=>{
 const invalid='ID,Nombre\n1,"abc\n2,fin\n',corrected=source.replace('Ana','Corregida')
 const [opened]=await page.evaluate(path=>window.freya.openPaths([path]),join(files,'datos.csv'));await expect(table()).toBeVisible()
 await views().getByRole('button',{name:'Texto',exact:true}).click();await editor().press('ControlOrMeta+a');await page.keyboard.insertText(invalid)
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents()))[0].text).toBe(invalid)
 await views().getByRole('button',{name:'Tabla',exact:true}).click();await dialog().getByRole('button',{name:'Guardar y cambiar',exact:true}).click()
 const warning=page.getByRole('alert',{name:'Problema de formato CSV',exact:true})
 await expect(warning).toContainText('Se guardó, pero la tabla no puede abrirlo (línea 3). Sigues en Texto.')
 await editor().press('ControlOrMeta+a');await page.keyboard.insertText(corrected)
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents()))[0].text).toBe(corrected)
 await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(false)
 const preferences=join(folder,'profile','csv-views.json');await rm(preferences);await mkdir(preferences)
 await views().getByRole('button',{name:'Tabla',exact:true}).click();await expect(page.locator('.toast')).toContainText('csv-views.json')
 await expect(warning).toHaveCount(0);await expect(dialog()).toHaveCount(0)
 expect(await page.evaluate(()=>window.freya.documents())).toMatchObject([{id:opened.id,csvView:'text',dirty:false,text:corrected}]);expect(await readFile(join(files,'datos.csv'),'utf8')).toBe(corrected)
})

test('S1b: el fallo desde el explorador activa el CSV de destino y conserva el otro documento',async()=>{
 const invalid='ID,Nombre\n1,"abc\n2,fin\n',notes='# Notas\n\nTexto original de A.\n',draft=notes+'Cambios pendientes de A: ñ 🐕.\n'
 const [csv]=await page.evaluate(path=>window.freya.openPaths([path]),join(files,'datos.csv'));await expect(table()).toBeVisible()
 await views().getByRole('button',{name:'Texto',exact:true}).click();await editor().press('ControlOrMeta+a');await page.keyboard.insertText(invalid)
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).find(document=>document.id===csv.id)?.text).toBe(invalid)
 await writeFile(join(files,'notas.md'),notes);const [markdown]=await page.evaluate(path=>window.freya.openPaths([path]),join(files,'notas.md'))
 await expect(page.getByRole('tab',{name:'notas.md',exact:true})).toHaveAttribute('aria-selected','true')
 const markdownEditor=page.getByRole('textbox',{name:'Editor de texto',exact:true});await markdownEditor.press('ControlOrMeta+a');await page.keyboard.insertText(draft)
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).find(document=>document.id===markdown.id)?.text).toBe(draft)
 await page.locator('.toolbar-left').getByRole('button',{name:'Abrir carpeta',exact:true}).click();await fromExplorer('Tabla')
 await expect(dialog()).toContainText('datos.csv');await dialog().getByRole('button',{name:'Guardar y cambiar',exact:true}).click()
 await expect(page.getByRole('tab',{name:'datos.csv',exact:true})).toHaveAttribute('aria-selected','true')
 const warning=page.getByRole('alert',{name:'Problema de formato CSV',exact:true})
 await expect(warning).toContainText('datos.csv');await expect(warning).toContainText('Se guardó, pero la tabla no puede abrirlo (línea 3). Sigues en Texto.')
 await expect(dialog()).toHaveCount(0);await expect(editor()).toBeFocused()
 expect(await page.evaluate(()=>window.freya.documents())).toEqual(expect.arrayContaining([
  expect.objectContaining({id:csv.id,csvView:'text',dirty:false,text:invalid}),
  expect.objectContaining({id:markdown.id,dirty:true,text:draft}),
 ]))
 await expect(page.getByRole('tablist',{name:'Documentos abiertos',exact:true}).getByRole('tab')).toHaveCount(2)
 expect(await readFile(join(files,'datos.csv'),'utf8')).toBe(invalid);expect(await readFile(join(files,'notas.md'),'utf8')).toBe(notes)
})
