import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,folder:string
const phase=process.env.FREYALAB_SELECTION_PHASE??'after'
const screenshotStyle='.cm-cursorLayer{visibility:hidden!important}'
// El foco de la ventana es un recurso global: estos casos comparten la fase serial.
test.describe('E1 · selección visible',{tag:'@solo'},()=>{
 test.beforeEach(async()=>{
  folder=await mkdtemp(join(tmpdir(),'freya-selection-'))
  const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
  app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile')}})
  page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
  // El puntero físico no debe interrumpir el arrastre enviado por Playwright.
  await(await app.browserWindow(page)).evaluate(window=>window.setIgnoreMouseEvents(true))
  await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'reduce'})
 })
 test.afterEach(async()=>{
  await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{})
  await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})
 })
 const csvTextEditor=()=>page.getByLabel('Editor CSV como texto',{exact:true})
 async function open(name:string,text:string){
  const path=join(folder,name);await writeFile(path,text);await page.evaluate(path=>window.freya.openPaths([path]),path)
  await expect(page.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true')
  if(name.endsWith('.csv')){
   const textView=page.getByRole('group',{name:'Vista del CSV',exact:true}).getByRole('button',{name:'Texto',exact:true})
   await textView.click()
   await expect(textView).toHaveAttribute('aria-pressed','true')
   // El cambio de vista acaba al devolver el foco al conmutador nuevo.
   await expect(textView).toBeFocused()
   await expect(csvTextEditor()).toBeVisible()
  }else{
   await page.getByRole('button',{name:'Editar',exact:true}).click()
   await expect(page.locator('.cm-content')).toBeVisible()
  }
  return path
 }
 const line=()=>page.locator('.cm-line').filter({hasText:'Hola mundo'})
 async function position(node:Locator,offset:number){return node.evaluate((element,offset)=>{
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT)
  let text:Node|null,remaining=offset
  while(text=walker.nextNode()){
   if(remaining<=(text.textContent??'').length){
    const range=document.createRange();range.setStart(text,remaining);range.collapse(true)
    const box=range.getBoundingClientRect(),line=element.getBoundingClientRect()
    const x=box.x+.1,y=box.y+box.height/2
    return{x,y,relative:{x:x-line.left,y:y-line.top}}
   }
   remaining-=(text.textContent??'').length
  }
  throw new Error('No se encontró la posición del texto de prueba.')
 },offset)}
 async function word(node:Locator){
  await page.evaluate(()=>document.fonts.ready)
  const start=(await node.textContent())!.indexOf('mundo')
  const from=await position(node,start),to=await position(node,start+5)
  return {from,to,clip:{x:Math.floor(from.x),y:Math.floor(from.y-10),width:Math.ceil(to.x-from.x),height:20}}
 }
 async function capture(name:string,clip:{x:number;y:number;width:number;height:number}){
  const image=await page.screenshot({clip,style:screenshotStyle,animations:'disabled',path:test.info().outputPath(`${phase}-${name}.png`)})
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
  return image
 }
 async function captureWord(name:string,node:Locator){
  await node.scrollIntoViewIfNeeded()
  return capture(name,(await word(node)).clip)
 }
 async function keyboardSelection(node:Locator){
  const {from}=await word(node);await page.mouse.click(from.x,from.y)
  await extendSelection()
 }
 async function extendSelection(){
  for(let i=0;i<5;i++)await page.keyboard.press('Shift+ArrowRight')
  await expect.poll(()=>page.evaluate(()=>window.getSelection()?.toString())).toBe('mundo')
 }
 async function paintedColor(image:Buffer){return page.evaluate(async bytes=>{
  const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}))
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height
  const context=canvas.getContext('2d')!;context.drawImage(bitmap,0,0);bitmap.close()
  const pixels=context.getImageData(0,0,canvas.width,canvas.height).data,counts=new Map<string,number>()
  for(let i=0;i<pixels.length;i+=4){const color=Array.from(pixels.slice(i,i+3)).join(',');counts.set(color,(counts.get(color)??0)+1)}
  return [...counts].sort((a,b)=>b[1]-a[1])[0][0].split(',').map(Number)
 },Array.from(image))}
 function contrast(a:number[],b:number[]){
  const luminance=(rgb:number[])=>rgb.map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0)
  const first=luminance(a),second=luminance(b);return(Math.max(first,second)+.05)/(Math.min(first,second)+.05)
 }
 async function readable(image:Buffer){
  const background=await paintedColor(image)
  const foreground=await line().evaluate(node=>getComputedStyle(node,'::selection').color.match(/[\d.]+/g)!.slice(0,3).map(Number))
  const ratio=contrast(foreground,background);expect(ratio).toBeGreaterThanOrEqual(4.5)
  return{foreground,background,ratio}
 }
 for(const theme of ['light','dark'])test(`${theme}: doble clic, arrastre, teclado, ventana sin foco y colores forzados`,async()=>{
  const original='Hola mundo\n\nOtra línea.',path=await open('seleccion.md',original)
  await page.getByLabel('Tema',{exact:true}).selectOption(theme)
  const samples=[]
  for(const method of ['double','drag','keyboard']){
   const {from,to,clip}=await word(line());await page.mouse.click(from.x,from.y)
   await expect(page.locator('.cm-selectionBackground')).toHaveCount(0)
   const before=await capture(`${theme}-${method}-sin-seleccion`,clip)
   if(method==='double')await page.mouse.dblclick((from.x+to.x)/2,from.y)
   else if(method==='drag'){await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await page.mouse.up()}
   else await keyboardSelection(line())
   await expect.poll(()=>page.evaluate(()=>window.getSelection()?.toString())).toBe('mundo')
   await expect(line()).toHaveClass(/cm-activeLine/);await expect(page.locator('.cm-selectionBackground')).toHaveCount(1)
   const selected=await capture(`${theme}-${method}-seleccion`,clip)
   expect.soft(selected.equals(before),`${method}: el recorte de la palabra debe mostrar el resaltado`).toBe(false)
   expect.soft(await paintedColor(selected)).not.toEqual(await paintedColor(before))
   samples.push({state:method,...await readable(selected)})
  }
  const {clip}=await word(line())
  const focused=await capture(`${theme}-focused`,clip)
  const mainWindow=await app.browserWindow(page),mainWindowId=await mainWindow.evaluate(window=>window.id)
  const cdp=await page.context().newCDPSession(page)
  // Playwright fuerza document.hasFocus() por defecto; aquí comprobamos el foco real.
  await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false})
  await app.evaluate(async({BrowserWindow,app})=>{const other=new BrowserWindow({width:360,height:240,show:false,webPreferences:{sandbox:true}});await other.loadURL('about:blank');app.focus({steal:true});other.show();other.focus()})
  await expect.poll(()=>page.evaluate(()=>document.hasFocus())).toBe(false)
  await expect(page.locator('.cm-editor')).not.toHaveClass(/cm-focused/)
  const inactive=await capture(`${theme}-inactive`,clip)
  expect.soft(inactive.equals(focused)).toBe(false);samples.push({state:'inactive',...await readable(inactive)})
  await app.evaluate(({BrowserWindow},id)=>{BrowserWindow.getAllWindows().filter(window=>window.id!==id).forEach(window=>window.destroy());BrowserWindow.fromId(id)!.focus()},mainWindowId)
  await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});await cdp.detach()
  await page.bringToFront();await page.locator('.cm-content').focus();await keyboardSelection(line())
  await page.emulateMedia({forcedColors:'active'})
  const forced=await capture(`${theme}-forced-colors`,clip)
  const systemColors=await page.evaluate(()=>{
   const node=document.createElement('span');node.style.cssText='color:HighlightText;background:Highlight;forced-color-adjust:none';document.body.append(node)
   const style=getComputedStyle(node),colors={background:style.backgroundColor,foreground:style.color};node.remove();return colors
  })
  expect.soft(await page.locator('.cm-selectionBackground').evaluate(node=>getComputedStyle(node).backgroundColor)).toBe(systemColors.background)
  expect.soft(await line().evaluate(node=>getComputedStyle(node,'::selection').color)).toBe(systemColors.foreground)
  samples.push({state:'forced-colors',...await readable(forced)})
  await writeFile(test.info().outputPath('contrast.json'),JSON.stringify(samples,null,2))
  await test.info().attach('contraste',{path:test.info().outputPath('contrast.json'),contentType:'application/json'})
  expect(await readFile(path,'utf8')).toBe(original)
  expect((await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(false)
 })
 test('Mermaid, CSV Texto y vista previa conservan selección visible en ambos temas',async()=>{
  for(const theme of ['light','dark']){
   await page.getByLabel('Tema',{exact:true}).selectOption(theme)
   for(const [name,text]of [['diagrama.mmd','flowchart LR\n A[Hola mundo] --> B[Fin]'],['tabla.csv','Saludo\nHola mundo\n'],['previa.md','Hola mundo\n']]as const){
    const path=await open(name,text)
    if(name==='previa.md'){await page.getByRole('button',{name:'Vista previa',exact:true}).click();await expect(page.locator('.markdown-body p')).toHaveText('Hola mundo')}
    const node=name==='previa.md'?page.locator('.markdown-body p'):name==='tabla.csv'?csvTextEditor().locator('.cm-line',{hasText:'Hola mundo'}):line()
    const {from}=await word(node)
    await node.click({position:from.relative});const before=await captureWord(`${theme}-${name}-sin-seleccion`,node)
    if(name==='previa.md'){
     const {from,to}=await word(node);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await page.mouse.up()
    }else{
     const {from}=await word(node)
     await node.click({position:from.relative})
     await extendSelection()
    }
    await expect.poll(()=>page.evaluate(()=>window.getSelection()?.toString())).toBe('mundo')
    const selected=await captureWord(`${theme}-${name}-seleccion`,node)
    expect.soft(selected.equals(before),name).toBe(false)
    expect.soft(await paintedColor(selected),name).not.toEqual(await paintedColor(before))
    expect(await readFile(path,'utf8')).toBe(text)
   }
  }
 })
})
