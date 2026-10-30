import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

let app:ElectronApplication|undefined,page:Page,folder:string,path:string
test.skip(!!process.env.FREYALAB_EXECUTABLE,'La reproducción controla el registro de IPC antes de cargar Main; no sustituye el arranque real del paquete.')
const source='# Manual abierto\n\nTexto intacto.\n'
async function launch(withDocument=false){
 folder=await mkdtemp(join(tmpdir(),'freya-bootstrap-documents-'));path=join(folder,'manual.md')
 const bootstrap=join(folder,'bootstrap.cjs');await writeFile(path,source)
 await writeFile(bootstrap,`const {ipcMain}=require('electron');
const original=ipcMain.handle.bind(ipcMain);
let first=true;
globalThis.initialDocuments={captured:null,release:null,released:false,applied:false};
ipcMain.handle=(channel,listener)=>original(channel,async(...args)=>{
 if(channel==='freya'&&args[1]==='documents'&&first){
  first=false;
  ${withDocument?`await listener(args[0],'openPaths',[${JSON.stringify(path)}]);`:''}
  const result=await listener(...args);
  globalThis.initialDocuments.captured=structuredClone(result);
  await new Promise(resolve=>globalThis.initialDocuments.release=()=>{globalThis.initialDocuments.released=true;resolve()});
  return result;
 }
 const result=await listener(...args);
 if(channel==='freya'&&args[1]==='recents'&&globalThis.initialDocuments.released)globalThis.initialDocuments.applied=true;
 return result;
});
void import(${JSON.stringify(pathToFileURL(resolve('out/main/index.js')).href)});
`)
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:electronPath as unknown as string,args:[bootstrap],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_FOLDER:folder}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
 await expect.poll(()=>app!.evaluate(()=>(globalThis as unknown as {initialDocuments:{captured:unknown[]|null}}).initialDocuments.captured?.length)).toBe(withDocument?1:0)
}
async function release(){
 await app!.evaluate(()=>(globalThis as unknown as {initialDocuments:{release:()=>void}}).initialDocuments.release())
 await expect.poll(()=>app!.evaluate(()=>(globalThis as unknown as {initialDocuments:{applied:boolean}}).initialDocuments.applied)).toBe(true)
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
}
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});if(folder)await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200});app=undefined})

test('el inventario inicial vacío retrasado conserva un documento abierto mientras arranca',async()=>{
 await launch()
 const[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('tab',{name:'manual.md',exact:true})).toHaveAttribute('aria-selected','true')
 await expect(page.locator('.cm-content')).toContainText('Manual abierto')
 await release()
 await expect(page.getByRole('tab',{name:'manual.md',exact:true})).toHaveAttribute('aria-selected','true')
 await expect(page.locator('.cm-content')).toContainText('Manual abierto')
 expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)?.text).toBe(source)
 expect(await readFile(path,'utf8')).toBe(source)
})

test('el inventario inicial antiguo no sobrescribe una edición ni cambia el documento activo',async()=>{
 await launch(true)
 await expect(page.getByRole('tab',{name:'manual.md',exact:true})).toHaveAttribute('aria-selected','true')
 const content=page.locator('.cm-content');await content.focus();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.insertText('Edición posterior')
 await expect.poll(()=>page.evaluate(async()=>(await window.freya.documents()).find(value=>value.name==='manual.md')?.text)).toBe(source+'Edición posterior')
 const other=join(folder,'otro.md');await writeFile(other,'# Otro documento\n');await page.evaluate(path=>window.freya.openPaths([path]),other)
 await expect(page.getByRole('tab',{name:'otro.md',exact:true})).toHaveAttribute('aria-selected','true')
 await release()
 await expect(page.getByRole('tab',{name:'otro.md',exact:true})).toHaveAttribute('aria-selected','true')
 await test.info().attach('estado-tras-inventario',{body:Buffer.from(JSON.stringify(await page.getByRole('tab').evaluateAll(nodes=>nodes.map(node=>({text:node.textContent,title:node.getAttribute('title'),selected:node.getAttribute('aria-selected')}))))),contentType:'application/json'})
 await page.getByRole('tab',{name:/^manual\.md/}).click();await expect(content).toContainText('Edición posterior')
 expect(await readFile(path,'utf8')).toBe(source)
})

test('el inventario inicial retrasado no resucita un documento cerrado durante el arranque',async()=>{
 await launch(true)
 await expect(page.getByRole('tab',{name:'manual.md',exact:true})).toHaveAttribute('aria-selected','true')
 await page.getByRole('button',{name:'Cerrar manual.md',exact:true}).click();await expect(page.getByRole('tab',{name:'manual.md',exact:true})).toHaveCount(0)
 expect(await page.evaluate(()=>window.freya.documents())).toEqual([])
 await release()
 await expect(page.getByRole('tab',{name:'manual.md',exact:true})).toHaveCount(0)
 await expect(page.locator('.welcome')).toBeVisible()
 expect(await page.evaluate(()=>window.freya.documents())).toEqual([]);expect(await readFile(path,'utf8')).toBe(source)
})
