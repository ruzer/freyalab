import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,directory:string,serial=0,documentId:string
const content=()=>page.locator('.cm-content')
const source=()=>page.evaluate(async id=>(await window.freya.documents()).find(document=>document.id===id)?.text,documentId)
test.beforeEach(async()=>{
 directory=await mkdtemp(join(tmpdir(),'freya-md005-'));await mkdir(join(directory,'saved'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_SAVE_DIR:join(directory,'saved')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 // Materializar todos los formatos y conservarlos únicamente en memoria de main; nunca adjuntarlos a logs.
 await app.evaluate(async({clipboard,ClipboardItem})=>{
  const items=await clipboard.read(),snapshot=await Promise.all(items.map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))))
  if(snapshot.length)await clipboard.write(snapshot) // Verificar restauración atómica antes de cambiar el contenido por datos de prueba.
  ;(globalThis as typeof globalThis&{freyaPasteClipboard?:typeof snapshot}).freyaPasteClipboard=snapshot
 })
})
test.afterEach(async()=>{
 try{
  if(app)await app.evaluate(async({clipboard})=>{const target=globalThis as typeof globalThis&{freyaPasteClipboard?:import('electron').ClipboardItem[]};if(target.freyaPasteClipboard){if(target.freyaPasteClipboard.length)await clipboard.write(target.freyaPasteClipboard);else clipboard.clear();delete target.freyaPasteClipboard}})
 }finally{
  await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})
 }
})
async function open(text:string,extension='md'){
 const path=join(directory,`documento-${++serial}.${extension}`);await writeFile(path,text)
 const [document]=await page.evaluate(path=>window.freya.openPaths([path]),path);documentId=document.id
 await expect(content()).toBeVisible();return{path,document}
}
async function selectAll(){await content().focus();await page.keyboard.press('ControlOrMeta+A')}
async function selectRange(from:number,length:number){
 await content().focus();await page.keyboard.press('ControlOrMeta+Home')
 for(let index=0;index<from;index++)await page.keyboard.press('ArrowRight')
 for(let index=0;index<length;index++)await page.keyboard.press('Shift+ArrowRight')
}
async function selection(){return page.evaluate(()=>getSelection()?.toString()??'')}
async function settled(){await expect(page.locator('.preview .render-progress')).toHaveCount(0)}
async function paste(text:string,plain=false){
 await app.evaluate(async({clipboard},text)=>{await clipboard.writeText(text);if(await clipboard.readText()!==text)throw new Error('El portapapeles de prueba no coincide.')},text)
 await content().focus();await page.keyboard.press(plain?'ControlOrMeta+Shift+V':'ControlOrMeta+V')
}

test('P1: una URL con espacio se pega normalmente en vez de convertirse en enlace',async()=>{
 const {path}=await open('texto'),url='https://example.com/una ruta';await selectAll();await paste(url)
 await expect.poll(source).not.toBe('texto');await expect(page.locator('.preview .render-progress')).toHaveCount(0)
 const actual={source:await source(),preview:await page.locator('.markdown-body').innerHTML(),selection:await page.evaluate(()=>getSelection()?.toString())}
 await test.info().attach('pegado-basal',{body:Buffer.from(JSON.stringify(actual,null,2)),contentType:'application/json'})
 if(process.env.FREYALAB_PASTE_EVIDENCE_DIR){await mkdir(process.env.FREYALAB_PASTE_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.FREYALAB_PASTE_EVIDENCE_DIR,`4-paste-${process.env.FREYALAB_PASTE_PHASE??'run'}.json`),JSON.stringify(actual,null,2))}
 expect(actual.source).toBe(url);await expect(page.locator('.markdown-body')).toHaveText(url)
 expect(await readFile(path,'utf8')).toBe('texto')
})

test('P3: una URL válida crea el enlace; un deshacer restaura texto y selección y rehacer recupera el resultado',async()=>{
 const original='texto',url='https://example.com/recurso';await open(original);await selectAll();expect(await selection()).toBe(original)
 await paste(url);await expect.poll(source).toBe(`[texto](${url})`);expect(await selection()).toBe('')
 await settled();await expect(page.locator('.markdown-body a')).toHaveAttribute('href',url)
 await page.keyboard.press('ControlOrMeta+Z');await expect.poll(source).toBe(original);expect(await selection()).toBe(original)
 // CodeMirror conserva al rehacer la selección del rango insertado (semántica nativa de history).
 await page.keyboard.press(process.platform==='darwin'?'ControlOrMeta+Shift+Z':'ControlOrMeta+Y');await expect.poll(source).toBe(`[texto](${url})`);expect(await selection()).toBe(`[texto](${url})`)
})

test('P4: paréntesis y corchetes se escapan sin cambiar el texto visible ni el destino del enlace',async()=>{
 const text='Freya (demo)',url='https://example.com/wiki/A_(B)[C]';await open(text);await selectAll();await paste(url)
 await expect.poll(source).toBe('[Freya \\(demo\\)](https://example.com/wiki/A_\\(B\\)\\[C\\])')
 await settled();const anchor=page.locator('.markdown-body a');await expect(anchor).toHaveText(text)
 // El renderizador codifica los corchetes en el href; el destino conserva la misma URL.
 expect(await anchor.getAttribute('href')).toBe('https://example.com/wiki/A_(B)%5BC%5D')
})

test('P1: esquemas no admitidos, controles, varias URLs, selección multilínea y selección vacía conservan el pegado normal',async()=>{
 for(const value of ['xmpp:freya@example.com','www.example.com','javascript:alert(1)','data:text/plain,nota','https://example.com/a\nhttps://example.com/b','https://example.com/a\tfin','https://example.com/a ']){
  await open('texto');await selectAll();await paste(value);await expect.poll(source).toBe(value)
 }
 await open('uno\ndos');await selectAll();await paste('https://example.com');await expect.poll(source).toBe('https://example.com')
 await open('texto');await content().focus();await page.keyboard.press('ControlOrMeta+End');await paste('https://example.com')
 await expect.poll(source).toBe('textohttps://example.com')
})

test('P2: código en línea, bloque, enlace existente y URL literal no se convierten en enlaces anidados',async()=>{
 const url='https://example.com/nuevo'
 for(const item of [
  {text:'`Freya`',from:1,length:5,expected:`\`${url}\``},
  {text:'```text\nFreya\n```',from:8,length:5,expected:'```text\n'+url+'\n```'},
  {text:'[Freya](https://original.example)',from:1,length:5,expected:`[${url}](https://original.example)`},
  {text:'https://original.example/path',from:0,length:29,expected:url}
 ]){
  await open(item.text);await selectRange(item.from,item.length);await paste(url);await expect.poll(source).toBe(item.expected)
 }
})

test('se puede enlazar texto dentro de negrita y dentro de un título conservando sus marcadores',async()=>{
 const url='mailto:freya@example.com'
 for(const item of [{text:'**Freya**',from:2,expected:`**[Freya](${url})**`},{text:'# Freya',from:2,expected:`# [Freya](${url})`}]){
  await open(item.text);await selectRange(item.from,5);await paste(url);await expect.poll(source).toBe(item.expected)
  await settled();await expect(page.locator('.markdown-body a')).toHaveAttribute('href',url)
 }
})

test('pegar sin formato mediante Ctrl/Cmd Mayús V conserva la URL literal y no el texto seleccionado',async()=>{
 const url='https://example.com/plano';await open('texto');await selectAll()
 await app.evaluate(({ipcMain})=>{const state=globalThis as typeof globalThis&{freyaPasteMessages?:number};state.freyaPasteMessages=0;ipcMain.on('freya:paste-plain',()=>{state.freyaPasteMessages=(state.freyaPasteMessages??0)+1})})
 const trusted=await content().evaluate((node,mac)=>{const event=new KeyboardEvent('keydown',{key:'V',code:'KeyV',metaKey:mac,ctrlKey:!mac,shiftKey:true,bubbles:true,cancelable:true});node.dispatchEvent(event);return event.isTrusted},process.platform==='darwin')
 expect(trusted).toBe(false);await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
 expect(await source()).toBe('texto');expect(await app.evaluate(()=>(globalThis as typeof globalThis&{freyaPasteMessages?:number}).freyaPasteMessages)).toBe(0)
 await paste(url,true);await expect.poll(source).toBe(url)
 expect(await app.evaluate(()=>(globalThis as typeof globalThis&{freyaPasteMessages?:number}).freyaPasteMessages)).toBe(1)
 await page.keyboard.press('ControlOrMeta+Z');await expect.poll(source).toBe('texto');expect(await selection()).toBe('texto')
})

test('P5: HTML rico del portapapeles no se ejecuta ni provoca red y se usa su única URL de texto plano',async()=>{
 const url='https://example.com/seguro',requests:string[]=[];await open('texto');await selectAll()
 page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url())})
 await page.evaluate(()=>{(window as typeof window&{pasteExecuted?:boolean}).pasteExecuted=false})
 await app.evaluate(async({clipboard,ClipboardItem},{url,html})=>{await clipboard.write([new ClipboardItem({'text/plain':url,'text/html':html})])},{url,html:'<img src="https://example.com/imagen" onerror="window.pasteExecuted=true"><script>window.pasteExecuted=true</script>'})
 await content().focus();await page.keyboard.press('ControlOrMeta+V');await expect.poll(source).toBe(`[texto](${url})`);await settled()
 expect(await page.evaluate(()=>(window as typeof window&{pasteExecuted?:boolean}).pasteExecuted)).toBe(false)
 await expect(content().locator('img,script')).toHaveCount(0);await expect(page.locator('.markdown-body img,.markdown-body script')).toHaveCount(0)
 expect(requests).toEqual([])
})

test('P6: documento Markdown de solo lectura no cambia al pegar sobre su muestra',async()=>{
 const line='texto '.repeat(140)+'\n',bytes=10*1024*1024+1,original=Buffer.alloc(bytes,32);original.write(line.repeat(Math.floor(bytes/line.length)),0,'ascii')
 const path=join(directory,'solo-lectura.md');await writeFile(path,original)
 const [document]=await page.evaluate(path=>window.freya.openPaths([path]),path);documentId=document.id
 expect(document.readonly).toBe(true);await expect(content()).toHaveAttribute('contenteditable','false')
 const before=await source();await content().click();await paste('https://example.com')
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
 expect(await source()).toBe(before);expect((await readFile(path)).equals(original)).toBe(true)
})

test('IME sintético: no transforma en enlace durante composición y no acredita un IME físico',async()=>{
 const url='https://example.com';await open('texto');await selectAll()
 const event=await content().evaluate((node,url)=>{
  node.dispatchEvent(new CompositionEvent('compositionstart',{data:'',bubbles:true}))
  const clipboardData=new DataTransfer();clipboardData.setData('text/plain',url)
  const event=new ClipboardEvent('paste',{clipboardData,bubbles:true,cancelable:true});node.dispatchEvent(event)
  node.dispatchEvent(new CompositionEvent('compositionend',{data:'',bubbles:true}));return{trusted:event.isTrusted}
 },url)
 expect(event.trusted).toBe(false);await expect.poll(source).toBe(url)
 await test.info().attach('ime-sintetico',{body:Buffer.from(JSON.stringify({event:'ClipboardEvent + CompositionEvent sintéticos',physicalIME:false})),contentType:'application/json'})
})

test('enlace pegado y vista previa se conservan en claro y oscuro a 1440×900',async()=>{
 const url='https://example.com/freya';await open('Freya');await selectAll();await paste(url);await expect.poll(source).toBe(`[Freya](${url})`)
 for(const theme of ['light','dark']){
  await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme);await settled()
  await expect(page.locator('.markdown-body a')).toHaveAttribute('href',url)
  if(process.env.FREYALAB_PASTE_EVIDENCE_DIR){await mkdir(process.env.FREYALAB_PASTE_EVIDENCE_DIR,{recursive:true});const path=join(process.env.FREYALAB_PASTE_EVIDENCE_DIR,`4-paste-${theme}-1440x900.png`);await page.screenshot({path,animations:'disabled'});await test.info().attach(theme,{path,contentType:'image/png'})}
 }
})
