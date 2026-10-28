import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,open,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
let app:ElectronApplication,page:Page,folder:string,files:string
const source='ID,Nombre\n"001","Ana"\n9007199254740993,"dos\nlíneas"\n'
async function launch(){const {ELECTRON_RUN_AS_NODE:_,...env}=process.env;app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_TEST_LANGUAGE:'es',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_FOLDER:files}});page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'Abrir',exact:true}).waitFor()}
async function quit(){await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{})}
test.beforeEach(async()=>{folder=await mkdtemp(join(tmpdir(),'freya-txt01-'));files=join(folder,'files');await mkdir(files);await writeFile(join(files,'datos.csv'),source);await writeFile(join(files,'datos.tsv'),source.replaceAll(',','\t'));await launch()})
test.afterEach(async()=>{await quit();await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
const views=()=>page.getByRole('group',{name:'Vista del CSV',exact:true})
const table=()=>page.getByRole('grid',{name:'Tabla de datos',exact:true})
const editor=()=>page.getByRole('textbox',{name:'Editor CSV como texto',exact:true})
async function openCsv(){const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),join(files,'datos.csv'));await expect(table()).toBeVisible();return doc}

test('A: el conmutador Tabla Texto conserva una pestaña y recuerda el modo',async()=>{
 const doc=await openCsv();await expect(views()).toBeVisible({timeout:1000});await expect(views().getByRole('button',{name:'Tabla',exact:true})).toHaveAttribute('aria-pressed','true')
 await views().getByRole('button',{name:'Texto',exact:true}).click();await expect(editor()).toBeVisible();await expect(table()).toHaveCount(0);await expect(views().getByRole('button',{name:'Texto',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.toast')).toContainText('Vista Texto');expect(await page.evaluate(()=>window.freya.documents())).toMatchObject([{id:doc.id,kind:'csv',csvView:'text',text:source}]);await expect(page.getByRole('tab',{name:'datos.csv',exact:true})).toHaveCount(1)
 await views().getByRole('button',{name:'Tabla',exact:true}).focus();await page.keyboard.press('Enter');await expect(table()).toBeVisible();expect((await page.evaluate(()=>window.freya.documents()))[0].id).toBe(doc.id);await views().getByRole('button',{name:'Texto',exact:true}).click();await expect(editor()).toBeVisible();await quit();await launch();const [reopened]=await page.evaluate(path=>window.freya.openPaths([path]),join(files,'datos.csv'));expect(reopened.csvView).toBe('text');await expect(editor()).toBeVisible();expect(await readFile(join(files,'datos.csv'),'utf8')).toBe(source)
})

test('A: menú de CSV y TSV ofrece ambos modos y teclado devuelve el foco',async()=>{
 await page.locator('.toolbar-left').getByRole('button',{name:'Abrir carpeta',exact:true}).click();const file=page.getByRole('button',{name:'datos.csv',exact:true});await file.waitFor();await file.click({button:'right'});const menu=page.getByRole('menu',{name:'Abrir CSV',exact:true});await expect(menu.getByRole('menuitem',{name:'Abrir como tabla',exact:true})).toBeVisible();await expect(menu.getByRole('menuitem',{name:'Abrir como texto',exact:true})).toBeEnabled();await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(file).toBeFocused();await page.getByLabel('Buscar archivo',{exact:true}).fill('datos');const tsv=page.locator('.file-search-result').filter({hasText:'datos.tsv'});await tsv.waitFor();await tsv.focus();await page.keyboard.press('Shift+F10');await expect(menu).toBeVisible();await menu.getByRole('menuitem',{name:'Abrir como texto',exact:true}).click();await expect(editor()).toBeVisible();const docs=await page.evaluate(()=>window.freya.documents());expect(docs).toHaveLength(1);expect(docs[0].csvView).toBe('text');expect(await readFile(join(files,'datos.tsv'),'utf8')).toBe(source.replaceAll(',','\t'))
})

test('A: más de 10 MiB deshabilita Texto en la barra y el menú con ayuda explícita',async()=>{
 const path=join(files,'grande.csv'),handle=await open(path,'w');await handle.writeFile('ID,Nombre\n1,Ana\n');await handle.truncate(10*1024*1024+1);await handle.close();await page.evaluate(path=>window.freya.openPaths([path]),path);await expect(views()).toBeVisible();const button=views().getByRole('button',{name:'Texto',exact:true});await expect(button).toBeDisabled();await expect(button).toHaveAttribute('title','El modo Texto admite hasta 10 MiB. Usa la tabla.');await page.locator('.toolbar-left').getByRole('button',{name:'Abrir carpeta',exact:true}).click();await page.getByRole('button',{name:'grande.csv',exact:true}).click({button:'right'});const item=page.getByRole('menuitem',{name:'Abrir como texto',exact:true});await expect(item).toBeDisabled();await expect(item).toHaveAttribute('title','El modo Texto admite hasta 10 MiB. Usa la tabla.');expect(await page.evaluate(()=>window.freya.documents())).toHaveLength(1)
})
