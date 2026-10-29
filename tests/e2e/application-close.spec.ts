import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
let app:ElectronApplication,page:Page,folder:string,questions:string
const original='id,nombre\n00123,Freya\n'
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-close-e2e-'));questions=join(folder,'questions.json');await writeFile(questions,'[]')
 const{ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('.')],env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile')},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await expect(page.locator('.welcome')).toBeVisible()
 await app.evaluate(({dialog},file)=>{const fs=process.getBuiltinModule('node:fs'),records:string[]=[];Object.defineProperty(dialog,'showMessageBox',{configurable:true,value:async(...args:unknown[])=>{records.push((args.at(-1) as {message:string}).message);fs.writeFileSync(file,JSON.stringify(records));return{response:1,checkboxChecked:false}}})},questions)
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function openCsv(){const path=join(folder,'datos.csv');await writeFile(path,original);const[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);await expect(page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true})).toHaveText('Freya');return{path,doc}}
async function request(action:'close'|'quit'){
 await app.evaluate(({app,BrowserWindow},action)=>{if(action==='quit')app.quit();else BrowserWindow.getAllWindows()[0].close()},action).catch(()=>{})
 await expect.poll(async()=>page.isClosed()||JSON.parse(await readFile(questions,'utf8')).length>0).toBe(true)
 expect(page.isClosed(),'El cierre no puede descartar un borrador local antes de confirmarlo.').toBe(false)
}

test('X prepara la celda activa y Cancelar conserva el documento completo',async()=>{
 const{path,doc}=await openCsv();await page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true}).dblclick();await page.getByRole('textbox',{name:'Editar celda',exact:true}).fill('Freya pendiente')
 await request('close');expect(JSON.parse(await readFile(questions,'utf8'))).toHaveLength(1)
 await expect(page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true})).toHaveText('Freya pendiente');expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)?.dirty).toBe(true);expect(await readFile(path,'utf8')).toBe(original)
})
test('Salir prepara el encabezado activo y Cancelar conserva datos y cambios',async()=>{
 const{path,doc}=await openCsv();await page.getByRole('button',{name:'Editar encabezado 2',exact:true}).click();await page.getByRole('textbox',{name:'Nombre del encabezado',exact:true}).fill('apodo')
 await request('quit');expect(JSON.parse(await readFile(questions,'utf8'))).toHaveLength(1)
 expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)).toMatchObject({headers:['id','apodo'],dirty:true});expect(await readFile(path,'utf8')).toBe(original)
})

for(const action of ['close','quit'] as const)for(const locale of ['es','en'] as const)test(`${action}: texto rechazado de más de 10 MiB queda abierto y explica cómo corregirlo en ${locale}`,async()=>{
 const{path,doc}=await openCsv();await page.getByRole('group',{name:'Vista del CSV',exact:true}).getByRole('button',{name:'Texto',exact:true}).click();const editor=page.locator('.editor-pane .cm-content');await expect(editor).toBeVisible()
 await page.evaluate(locale=>window.freya.setLanguage(locale),locale);await expect(page.locator('html')).toHaveAttribute('lang',locale)
 const before=await stat(path),marker='LOCAL_DRAFT_RETAINED',oversized='id,nombre\n00123,'+'x'.repeat(10*1024*1024)+marker
 await editor.focus();await page.keyboard.press('ControlOrMeta+a');await page.keyboard.insertText(oversized)
 await app.evaluate(({app,BrowserWindow},action)=>{if(action==='quit')app.quit();else BrowserWindow.getAllWindows()[0].close()},action).catch(()=>{})
 const alert=page.getByRole('alert').filter({hasText:'10 MiB'});await expect(alert).toBeVisible();await expect(alert).toContainText('datos.csv');await expect(alert).toContainText(locale==='es'?'Recórtalo':'Shorten');await expect(alert).toContainText(locale==='es'?'Tus documentos siguen abiertos':'Your documents are still open')
 expect(page.isClosed()).toBe(false);expect(JSON.parse(await readFile(questions,'utf8'))).toEqual([]);expect(await readFile(path,'utf8')).toBe(original);expect((await stat(path)).mtimeMs).toBe(before.mtimeMs)
 expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)?.text).toBe(original)
 await editor.press('ControlOrMeta+End');await expect.poll(async()=>(await editor.locator('.cm-line').last().textContent())?.includes(marker)).toBe(true)
 await page.getByRole('button',{name:locale==='es'?'Cerrar aviso de cierre':'Dismiss closing notice',exact:true}).click();await editor.press('ControlOrMeta+z');await expect(editor.locator('.cm-line').first()).toHaveText('id,nombre')
 await app.evaluate(({app,BrowserWindow},action)=>{if(action==='quit')app.quit();else BrowserWindow.getAllWindows()[0].close()},action).catch(()=>{});await expect.poll(()=>page.isClosed()).toBe(true);expect(await readFile(path,'utf8')).toBe(original)
})

test('Guardar A y Cancelar B conserva ambos y anuncia el guardado ya realizado',async()=>{
 const A=join(folder,'A.md'),B=join(folder,'B.md');await writeFile(A,'# A original\n');await writeFile(B,'# B original\n')
 // Este caso prueba la confirmación de dos registros y sus escrituras exactas;
 // los borradores de editores activos tienen casos separados arriba.
 await page.evaluate(async paths=>{const documents=await window.freya.openPaths(paths);await window.freya.update(documents[0].id,'# A original\nA pendiente\n');await window.freya.update(documents[1].id,'# B original\nB pendiente\n')},[A,B])
 await expect(page.getByRole('tab',{name:/B.md/})).toHaveAttribute('aria-selected','true')
 await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).every(doc=>doc.dirty)).toBe(true)
 await app.evaluate(({dialog})=>{const responses=[0,1];Object.defineProperty(dialog,'showMessageBox',{configurable:true,value:async()=>({response:responses.shift()??1,checkboxChecked:false})})})
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close())
 await expect(page.getByRole('status').filter({hasText:'Se canceló el cierre. Se guardó «A.md».'})).toBeVisible()
 const docs=await page.evaluate(()=>window.freya.documents());expect(docs).toHaveLength(2);expect(docs.find(doc=>doc.name==='A.md')?.dirty).toBe(false);expect(docs.find(doc=>doc.name==='B.md')?.dirty).toBe(true)
 await expect(page.getByRole('tab',{name:'A.md',exact:true})).toBeVisible();await expect(page.getByRole('tab',{name:/B.md/})).toBeVisible();expect(await readFile(A,'utf8')).toBe('# A original\nA pendiente\n');expect(await readFile(B,'utf8')).toBe('# B original\n')
})

test('un diálogo abierto rechaza el cierre con aviso accesible dentro del diálogo y sin perder foco',async()=>{
 const origin=page.getByRole('button',{name:'Mostrar u ocultar explorador',exact:true});await origin.focus()
 await app.evaluate(({Menu})=>{const item=Menu.getApplicationMenu()!.getMenuItemById('app.settings')!;item.click(item,undefined,{} as Electron.KeyboardEvent)})
 const dialog=page.getByRole('dialog',{name:'Ajustes',exact:true});await expect(dialog).toBeVisible();const tab=dialog.getByRole('tab',{name:'General',exact:true});await tab.focus()
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await expect(dialog.getByRole('alert')).toContainText('Cierra el diálogo abierto');await expect(tab).toBeFocused();expect(page.isClosed()).toBe(false)
})

test('una composición activa rechaza el cierre sin descartar el texto ni mover el foco',async()=>{
 const{path}=await openCsv();await page.getByRole('group',{name:'Vista del CSV',exact:true}).getByRole('button',{name:'Texto',exact:true}).click();const editor=page.locator('.editor-pane .cm-content');await editor.focus()
 await editor.dispatchEvent('compositionstart',{data:'あ'})
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close())
 await expect(page.getByRole('alert')).toContainText('Termina la palabra');await expect(editor).toBeFocused();expect(page.isClosed()).toBe(false);expect(JSON.parse(await readFile(questions,'utf8'))).toEqual([]);expect(await readFile(path,'utf8')).toBe(original)
 await editor.dispatchEvent('compositionend',{data:'あ'})
})

// Se ejercita la entrada SO real de Main con eventos sintéticos y un diálogo
// nativo retenido. No abre Finder ni concede rutas desde el renderer.
for(const action of ['cancel','quit'] as const)test(`una apertura SO durante el cierre espera y ${action==='cancel'?'se reanuda al cancelar':'se ignora al confirmar Salir'}`,async()=>{
 const{path,doc}=await openCsv(),B=join(folder,'entrada-SO.md'),opened=join(folder,'opened.json');await writeFile(B,'# Documento B\n');await writeFile(opened,'[]')
 await page.getByRole('gridcell',{name:'Fila 1, nombre',exact:true}).dblclick();await page.getByRole('textbox',{name:'Editar celda',exact:true}).fill('Freya pendiente')
 await app.evaluate(({dialog,BrowserWindow},files)=>{
  const fs=process.getBuiltinModule('node:fs'),state=globalThis as unknown as {releaseClose?:(response:number)=>void},records:string[]=[],events:string[]=[]
  Object.defineProperty(dialog,'showMessageBox',{configurable:true,value:async(...args:unknown[])=>{records.push((args.at(-1) as {message:string}).message);fs.writeFileSync(files.questions,JSON.stringify(records));return new Promise(resolve=>{state.releaseClose=response=>resolve({response,checkboxChecked:false})})}})
  const contents=BrowserWindow.getAllWindows()[0].webContents,send=contents.send.bind(contents)
  contents.send=(channel:string,...args:unknown[])=>{const event=args[0] as {type?:string;document?:{name:string}};if(channel==='freya:event'&&event?.type==='opened'&&event.document){events.push(event.document.name);fs.writeFileSync(files.opened,JSON.stringify(events))}return send(channel,...args)}
 },{questions,opened})
 await page.clock.install();await app.evaluate(({app,BrowserWindow},action)=>{if(action==='quit')app.quit();else BrowserWindow.getAllWindows()[0].close()},action)
 await expect.poll(async()=>JSON.parse(await readFile(questions,'utf8')).length).toBe(1)
 await app.evaluate(({app},B)=>{process.env.FREYALAB_TEST='0';app.emit('open-file',{preventDefault(){}},B)},B)
 await expect(page.evaluate(B=>window.freya.openPaths([B]),B)).rejects.toThrow()
 expect(await page.evaluate(()=>window.freya.documents())).toHaveLength(1);expect(JSON.parse(await readFile(opened,'utf8'))).toEqual([])
 await page.clock.fastForward(1100);await expect(page.getByRole('status').filter({hasText:'Preparando el cierre…'})).toBeVisible()
 await app.evaluate((_electron,response)=>(globalThis as unknown as {releaseClose:(response:number)=>void}).releaseClose(response),action==='cancel'?1:2)
 if(action==='cancel'){
  await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).length).toBe(2)
  const documents=await page.evaluate(()=>window.freya.documents());expect(documents.find(value=>value.id===doc.id)?.dirty).toBe(true);expect(documents.some(value=>value.name==='entrada-SO.md')).toBe(true)
  await expect(page.getByRole('status').filter({hasText:'Se canceló el cierre.'})).toBeVisible();expect(JSON.parse(await readFile(opened,'utf8'))).toEqual(['entrada-SO.md'])
 }else{await expect.poll(()=>page.isClosed()).toBe(true);expect(JSON.parse(await readFile(opened,'utf8'))).toEqual([])}
 expect(await readFile(path,'utf8')).toBe(original);expect(await readFile(B,'utf8')).toBe('# Documento B\n')
})

test('un ACK retenido anuncia preparación, vence a30s reales e ignora respuestas tardías antes de reintentar',async()=>{
 const{path,doc}=await openCsv(),before=await stat(path)
 // EventEmitter público de Main: se retiene el ACK de esta instancia de prueba,
 // sin modificar el preload, el contrato de mensajes ni el contenido del usuario.
 await app.evaluate(({ipcMain})=>{
  const channel='freya:close-prepared',listeners=ipcMain.listeners(channel),state=globalThis as unknown as {heldClose:{listeners:Function[];calls:unknown[][];started:number}}
  state.heldClose={listeners,calls:[],started:performance.now()};ipcMain.removeAllListeners(channel);ipcMain.on(channel,(...args:unknown[])=>state.heldClose.calls.push(args))
 })
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close())
 await expect(page.getByRole('status').filter({hasText:'Preparando el cierre…'})).toBeVisible({timeout:5000})
 const progressMs=await app.evaluate(()=>{const state=globalThis as unknown as {heldClose:{started:number}};return performance.now()-state.heldClose.started})
 const alert=page.getByRole('alert').filter({hasText:'30 segundos'});await expect(alert).toBeVisible({timeout:40000});await expect(alert).toContainText('Tus documentos siguen abiertos')
 const elapsedMs=await app.evaluate(()=>{const state=globalThis as unknown as {heldClose:{started:number}};return performance.now()-state.heldClose.started})
 expect(page.isClosed()).toBe(false);expect(JSON.parse(await readFile(questions,'utf8'))).toEqual([]);expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)).toBeTruthy()
 const received=await app.evaluate(({ipcMain})=>{
  const channel='freya:close-prepared',state=globalThis as unknown as {heldClose:{listeners:((...args:unknown[])=>void)[];calls:unknown[][]}},held=state.heldClose
  ipcMain.removeAllListeners(channel);for(const listener of held.listeners)ipcMain.on(channel,listener)
  for(let reuse=0;reuse<2;reuse++)for(const args of held.calls)for(const listener of held.listeners)listener(...args)
  return held.calls.length
 })
 expect(received).toBe(1);expect(page.isClosed()).toBe(false);expect(await page.evaluate(()=>window.freya.documents())).toHaveLength(1);expect(await readFile(path,'utf8')).toBe(original);expect((await stat(path)).mtimeMs).toBe(before.mtimeMs)
 const chronology={startedUTC:new Date(Date.now()-elapsedMs).toISOString(),finishedUTC:new Date().toISOString(),progressMs,elapsedMs,received,lateAndReusedACK:'sin cierre ni diálogo',environment:{platform:process.platform,arch:process.arch,node:process.version},scope:'Flujo real de Electron con ACK retenido en el proceso de prueba; no garantiza tiempos en otros equipos'}
 await writeFile(test.info().outputPath('close-timeout.json'),JSON.stringify(chronology,null,2)+'\n')
 if(process.env.FREYALAB_APP01_EVIDENCE==='1')await writeFile('docs/evidence/app-close-timeout-native-2026-10-29.json',JSON.stringify(chronology,null,2)+'\n')
 await page.getByRole('button',{name:'Cerrar aviso de cierre',exact:true}).click();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await expect.poll(()=>page.isClosed()).toBe(true)
})
