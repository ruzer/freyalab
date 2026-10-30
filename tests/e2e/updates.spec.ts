import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {createServer,type Server,type ServerResponse} from 'node:http'
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {defaultSettings} from '../../src/shared/settings'
import {runApplicationMenu} from './application-menu'

let app:ElectronApplication|undefined,page:Page,folder:string,server:Server,requests=0,mode:'available'|'current'|'error'|'held'='available',held:ServerResponse[]=[]
const release={tag_name:'v0.1.0-alpha.10',name:'FreyaLab 0.1.0-alpha.10',draft:false,prerelease:true,published_at:'2026-10-28T12:00:00Z',html_url:'https://github.com/ruzer/freyalab/releases/tag/v0.1.0-alpha.10',assets:[{name:'FreyaLab-mac-arm64.dmg'}]}
const updateDialog=()=>page.getByRole('dialog',{name:/Buscar actualizaciones|Check for updates/})
async function launch(language='es'){
 const{ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('.')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:language,FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_UPDATES_URL:`http://127.0.0.1:${(server.address() as {port:number}).port}/releases`},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900});await page.locator('.sidebar-bottom .text-button').waitFor()
}
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-updates-e2e-'));requests=0;mode='available';held=[]
 server=createServer((_request,response)=>{requests++;if(mode==='held'){held.push(response);return}if(mode==='error'){response.writeHead(429);response.end();return}response.end(JSON.stringify(mode==='current'?[]:[release]))})
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
 await launch()
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});app=undefined;server?.closeAllConnections();if(server?.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

test('APP-04 U1/U2 · sesión sin red y las tres entradas abren el mismo flujo',async()=>{
 await page.getByRole('button',{name:'Nuevo archivo',exact:false}).click();await page.locator('.cm-content').fill('DOCUMENTO_SIN_CAMBIOS_POR_ACTUALIZAR')
 await expect.poll(()=>page.evaluate(()=>window.freya.documents())).toMatchObject([{text:'DOCUMENTO_SIN_CAMBIOS_POR_ACTUALIZAR'}]);expect(requests).toBe(0)
 await runApplicationMenu(app!,'app.updates');await expect(updateDialog()).toBeVisible();await expect(updateDialog().getByRole('heading',{name:'Hay una versión nueva',exact:true})).toBeVisible();await updateDialog().getByRole('button',{name:'Cerrar',exact:true}).click()
 await runApplicationMenu(app!,'app.about');await page.getByRole('dialog',{name:'Acerca de FreyaLab',exact:true}).getByRole('button',{name:'Buscar actualizaciones',exact:true}).click();await expect(updateDialog()).toBeVisible();await updateDialog().getByRole('button',{name:'Cerrar',exact:true}).click();await page.getByRole('dialog',{name:'Acerca de FreyaLab',exact:true}).getByRole('button',{name:'Cerrar',exact:true}).click()
 await runApplicationMenu(app!,'app.settings');await page.getByRole('tab',{name:'Actualizaciones',exact:true}).click();await page.getByRole('dialog',{name:'Ajustes',exact:true}).getByRole('button',{name:'Buscar actualizaciones',exact:true}).click();await expect(updateDialog()).toBeVisible();await updateDialog().getByRole('button',{name:'Cerrar',exact:true}).click()
 expect(requests).toBe(3);expect((await page.evaluate(()=>window.freya.documents()))[0].text).toBe('DOCUMENTO_SIN_CAMBIOS_POR_ACTUALIZAR')
})

test('APP-04 consumidor del cierre · el diálogo abierto bloquea X sin descartar el documento ni abortar la búsqueda',async()=>{
 const path=join(folder,'conservado.md'),original='# Original conservado\n',draft='# Borrador conservado\n';await writeFile(path,original)
 const[document]=await page.evaluate(path=>window.freya.openPaths([path]),path);await page.locator('.cm-content').fill(draft)
 await expect.poll(()=>page.evaluate(async id=>(await window.freya.documents()).find(document=>document.id===id)?.text,document.id)).toBe(draft)
 await app!.evaluate(({dialog})=>{const state=globalThis as typeof globalThis&{__updatesCloseQuestions?:number};state.__updatesCloseQuestions=0;Object.defineProperty(dialog,'showMessageBox',{configurable:true,value:async()=>{state.__updatesCloseQuestions!++;return{response:1,checkboxChecked:false}}})})
 mode='held';await runApplicationMenu(app!,'app.updates');await expect(updateDialog().getByRole('heading',{name:'Buscando…',exact:true})).toBeVisible();await expect.poll(()=>held.length).toBe(1)
 const cancel=updateDialog().getByRole('button',{name:'Cancelar',exact:true});await cancel.focus()
 const owner=await app!.evaluate(({BrowserWindow})=>{const owner=BrowserWindow.getAllWindows()[0];owner.close();return owner.id})
 await expect(updateDialog().getByRole('alert')).toContainText('Cierra el diálogo abierto');await expect(cancel).toBeFocused();expect(page.isClosed()).toBe(false)
 expect(await app!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(window=>window.id))).toEqual([owner])
 expect(await app!.evaluate(()=>(globalThis as typeof globalThis&{__updatesCloseQuestions?:number}).__updatesCloseQuestions)).toBe(0)
 expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===document.id)).toMatchObject({dirty:true,text:draft});expect(await readFile(path,'utf8')).toBe(original)
 held.splice(0).forEach(response=>response.end(JSON.stringify([release])))
 await expect(updateDialog().getByRole('heading',{name:'Hay una versión nueva',exact:true})).toBeVisible();expect(requests).toBe(1)
})

test('APP-04 U1/U7/U9/U15 · estados, enlaces limitados, reintentar y Esc cancela',async()=>{
 mode='held';await runApplicationMenu(app!,'app.updates');await expect(updateDialog().getByRole('heading',{name:'Buscando…',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(updateDialog()).toHaveCount(0)
 mode='error';await runApplicationMenu(app!,'app.updates');await expect(updateDialog().getByRole('heading',{name:'No se pudo comprobar',exact:true})).toBeVisible();mode='current';await updateDialog().getByRole('button',{name:'Reintentar',exact:true}).click();await expect(updateDialog().getByRole('heading',{name:'Estás al día',exact:true})).toBeVisible();await updateDialog().getByRole('button',{name:'Cerrar',exact:true}).click()
 mode='available';await runApplicationMenu(app!,'app.updates');await expect(updateDialog().getByRole('heading',{name:'Hay una versión nueva',exact:true})).toBeVisible()
 await expect(page.evaluate(()=>window.freya.openUpdate('https://evil.invalid/asset.dmg'))).rejects.toThrow()
 await app!.evaluate(({shell})=>{const state=globalThis as typeof globalThis&{__updateLinks?:string[]};state.__updateLinks=[];shell.openExternal=async url=>{state.__updateLinks!.push(url)}})
 await updateDialog().getByRole('button',{name:'Descargar',exact:true}).click();await updateDialog().getByRole('button',{name:'Notas de la versión',exact:true}).click()
 expect(await app!.evaluate(()=>((globalThis as typeof globalThis&{__updateLinks?:string[]}).__updateLinks))).toEqual([release.html_url,release.html_url])
 for(let i=0;i<12;i++)await page.keyboard.press('Tab');expect(await updateDialog().evaluate(node=>node.contains(document.activeElement))).toBe(true)
})

test('APP-04 U10/U11/U12 · aviso automático conserva el foco y omitir sobrevive al reinicio',async()=>{
 await app!.evaluate(({app})=>app.exit(0));await app!.close();app=undefined
 const values=defaultSettings();values.actualizaciones.buscarAlIniciar=true;await mkdir(join(folder,'profile'),{recursive:true});await writeFile(join(folder,'profile','settings.json'),JSON.stringify(values))
 mode='held';await launch();await expect.poll(()=>requests).toBe(1)
 const input=page.getByPlaceholder('Buscar archivo…');await input.focus();held.splice(0).forEach(response=>response.end(JSON.stringify([release])))
 const notice=page.getByRole('status').filter({has:page.getByRole('button',{name:'Ver',exact:true})});await expect(notice).toBeVisible();await expect(input).toBeFocused();await expect(page.getByRole('dialog')).toHaveCount(0)
 await notice.getByRole('button',{name:'Omitir esta versión',exact:true}).click();await expect(notice).toHaveCount(0)
 const persisted=JSON.parse(await readFile(join(folder,'profile','settings.json'),'utf8'));expect(persisted.actualizaciones.versionesOmitidas).toEqual(['0.1.0-alpha.10'])
 await app!.evaluate(({app})=>app.exit(0));await app!.close();app=undefined;mode='available';await launch();expect(requests).toBe(1)
 await runApplicationMenu(app!,'app.settings');await page.getByRole('tab',{name:'Actualizaciones',exact:true}).click();await expect(page.getByText('0.1.0-alpha.10',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Olvidar omitidas',exact:true}).click();await expect.poll(async()=>JSON.parse(await readFile(join(folder,'profile','settings.json'),'utf8')).actualizaciones.versionesOmitidas).toEqual([])
 const automatic=page.getByRole('checkbox',{name:'Buscar al iniciar',exact:true});await automatic.uncheck();await expect.poll(async()=>JSON.parse(await readFile(join(folder,'profile','settings.json'),'utf8')).actualizaciones.buscarAlIniciar).toBe(false);await automatic.check();await expect.poll(async()=>JSON.parse(await readFile(join(folder,'profile','settings.json'),'utf8')).actualizaciones.buscarAlIniciar).toBe(true)
 await page.getByRole('button',{name:'Restablecer esta sección',exact:true}).click();await expect.poll(async()=>JSON.parse(await readFile(join(folder,'profile','settings.json'),'utf8')).actualizaciones).toEqual(defaultSettings().actualizaciones)
 expect((await readdir(join(folder,'profile'))).filter(name=>name.endsWith('.dmg')||name.endsWith('.exe')||name.endsWith('.AppImage'))).toEqual([])
})

test('APP-04 U13 · el idioma cambia durante la petición sin reiniciarla',async()=>{
 mode='held';await runApplicationMenu(app!,'app.updates');await expect(updateDialog().getByRole('heading',{name:'Buscando…',exact:true})).toBeVisible();await expect.poll(()=>held.length).toBe(1)
 await page.evaluate(()=>window.freya.setLanguage('en'));await expect(updateDialog()).toHaveAccessibleName('Check for updates');await expect(updateDialog().getByRole('heading',{name:'Checking…',exact:true})).toBeVisible()
 held.splice(0).forEach(response=>response.end(JSON.stringify([release])))
 await expect(updateDialog().getByRole('heading',{name:'A new version is available',exact:true})).toBeVisible();await expect(updateDialog()).toContainText('October 28, 2026');expect(requests).toBe(1)
})

for(const action of [{operation:'updates:skip',label:'Omitir esta versión'},{operation:'updates:remind',label:'Recordármelo después'}]){
 test(`APP-04 U10/U15 · respuesta anterior de ${action.operation} no cierra un diálogo nuevo`,async()=>{
  await runApplicationMenu(app!,'app.updates');await expect(updateDialog().getByRole('heading',{name:'Hay una versión nueva',exact:true})).toBeVisible()
  // Retener la respuesta real después de persistir; no se sustituye la operación ni el dato.
  await app!.evaluate(({ipcMain},operation)=>{
   type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
   const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')
   if(!original)throw new Error('No existe el manejador real de freya')
   const state=globalThis as typeof globalThis&{__updateReplyGate?:{held:boolean;release?:()=>void;restore:()=>void}}
   state.__updateReplyGate={held:false,restore:()=>handlers.set('freya',original)}
   handlers.set('freya',async(event,...args)=>{
    const result=await original(event,...args)
    if(args[0]===operation){state.__updateReplyGate!.held=true;await new Promise<void>(resolve=>state.__updateReplyGate!.release=resolve)}
    return result
   })
  },action.operation)
  try{
   await updateDialog().getByRole('button',{name:action.label,exact:true}).click()
   await expect.poll(()=>app!.evaluate(()=>(globalThis as typeof globalThis&{__updateReplyGate?:{held:boolean}}).__updateReplyGate?.held)).toBe(true)
   await page.keyboard.press('Escape');await expect(updateDialog()).toHaveCount(0)
   await runApplicationMenu(app!,'app.updates');await expect(updateDialog().getByRole('heading',{name:'Hay una versión nueva',exact:true})).toBeVisible()
   const next=await updateDialog().elementHandle();expect(next).not.toBeNull()
   await app!.evaluate(()=>{const state=globalThis as typeof globalThis&{__updateReplyGate?:{release?:()=>void}};state.__updateReplyGate!.release!()})
   // Drenar la respuesta genuina y las reacciones de render, sin temporizadores arbitrarios.
   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
   expect(await next!.evaluate(node=>node.isConnected&&(node as HTMLDialogElement).open)).toBe(true)
   await expect(updateDialog().getByRole('heading',{name:'Hay una versión nueva',exact:true})).toBeVisible()
   await test.info().attach('respuesta-de-accion-anterior',{body:Buffer.from(JSON.stringify({operation:action.operation,requests,newDialogStillOpen:true})),contentType:'application/json'})
  }finally{
   await app!.evaluate(()=>{const state=globalThis as typeof globalThis&{__updateReplyGate?:{release?:()=>void;restore:()=>void}};state.__updateReplyGate?.release?.();state.__updateReplyGate?.restore();delete state.__updateReplyGate}).catch(()=>{})
  }
 })
}

test('APP-04 U13/U15/U16 · cuatro estados sin desbordes y con contraste en es, en y en-XA',async()=>{
 const reports:{locale:string;theme:string;width:number;height:number;state:string;minimum:number}[]=[]
 const directory=process.env.FREYALAB_APP04_EVIDENCE_DIR
 if(directory)await mkdir(directory,{recursive:true})
 for(const locale of ['es','en','en-XA']){
  if(locale!=='es'){await app!.evaluate(({app})=>app.exit(0));await app!.close();app=undefined;await launch(locale)}
  for(const theme of ['light','dark'] as const){
   await page.evaluate(theme=>window.freya.setSettings({tema:theme}),theme);await expect.poll(()=>page.locator('html').evaluate(node=>node.classList.contains('dark'))).toBe(theme==='dark')
   for(const viewport of [{width:1440,height:900},{width:720,height:600}]){
    await page.setViewportSize(viewport)
    for(const state of ['held','available','current','error'] as const){
     mode=state;await runApplicationMenu(app!,'app.updates');const dialog=page.locator('dialog.update-dialog')
     await expect(dialog).toBeVisible()
     await expect.poll(()=>dialog.locator('h3').innerText()).toBeTruthy()
     if(state==='held')await expect.poll(()=>held.filter(response=>!response.destroyed).length).toBe(1)
     await expect(dialog).toHaveAttribute('aria-busy',state==='held'?'true':'false')
     const box=await dialog.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width);expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height)
     expect(await dialog.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true)
     const minimum=await dialog.evaluate(node=>{
      function luminance(color:string){const[r,g,b]=color.match(/[\d.]+/g)!.slice(0,3).map(value=>{const channel=Number(value)/255;return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b}
      return Math.min(...Array.from(node.querySelectorAll<HTMLElement>('h2,h3,p,button:not(:disabled)')).filter(element=>element.textContent?.trim()).map(element=>{let background:Element|null=element,color=getComputedStyle(element).backgroundColor;while((color==='rgba(0, 0, 0, 0)'||color==='transparent')&&background?.parentElement){background=background.parentElement;color=getComputedStyle(background).backgroundColor}const foreground=luminance(getComputedStyle(element).color),surface=luminance(color);return(Math.max(foreground,surface)+.05)/(Math.min(foreground,surface)+.05)}))
     })
     expect(minimum).toBeGreaterThanOrEqual(4.5);reports.push({locale,theme,...viewport,state,minimum})
     const name=`app-04-${locale}-${theme}-${viewport.width}x${viewport.height}-${state}.png`
     await page.screenshot({path:directory?join(directory,name):test.info().outputPath(name),animations:'disabled'})
     await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);held=[]
    }
   }
  }
 }
 expect(reports).toHaveLength(48);await test.info().attach('app-04-contraste',{body:Buffer.from(JSON.stringify(reports,null,2)),contentType:'application/json'})
 if(directory)await writeFile(join(directory,'contrast.json'),JSON.stringify(reports,null,2)+'\n')
})
