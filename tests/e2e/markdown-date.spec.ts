import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,directory:string,documentId:string,serial=0
const content=()=>page.locator('.cm-content')
const toolbar=()=>page.getByRole('group',{name:'Formato Markdown',exact:true})
const menu=()=>toolbar().getByLabel('Más opciones de Markdown',{exact:true})
const action=(name:string)=>toolbar().getByRole('button',{name,exact:true})
const source=()=>page.evaluate(async id=>(await window.freya.documents()).find(document=>document.id===id)?.text,documentId)
test.beforeEach(async()=>{
 directory=await mkdtemp(join(tmpdir(),'freya-md008-'));await mkdir(join(directory,'saved'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_SAVE_DIR:join(directory,'saved')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 // Solo fija Date; no congela temporizadores, requestAnimationFrame ni el debounce de la vista previa.
 await page.clock.setFixedTime(new Date(2024,1,29,9,5))
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function open(text:string,extension='md'){
 const path=join(directory,`documento-${++serial}.${extension}`);await writeFile(path,text)
 const [document]=await page.evaluate(path=>window.freya.openPaths([path]),path);documentId=document.id
 await expect(content()).toBeVisible();return{path,document}
}
async function cursorAt(offset:number){await content().focus();await page.keyboard.press('ControlOrMeta+Home');for(let index=0;index<offset;index++)await page.keyboard.press('ArrowRight')}
async function selectRange(from:number,length:number){await cursorAt(from);for(let index=0;index<length;index++)await page.keyboard.press('Shift+ArrowRight')}
async function insert(name:string){await menu().click();await action(name).click()}
const selection=()=>page.evaluate(()=>getSelection()?.toString()??'')
const documentInfo=()=>page.evaluate(async id=>(await window.freya.documents()).find(document=>document.id===id),documentId)
async function settled(){await expect(page.locator('.preview .render-progress')).toHaveCount(0)}
async function capture(name:string){if(process.env.FREYALAB_DATE_EVIDENCE_DIR){await mkdir(process.env.FREYALAB_DATE_EVIDENCE_DIR,{recursive:true});const path=join(process.env.FREYALAB_DATE_EVIDENCE_DIR,name);await page.screenshot({path,animations:'disabled'});await test.info().attach(name,{path,contentType:'image/png'})}}

test('F1: Fecha de hoy inserta la fecha local fija en el cursor sin cambiar el original en disco',async()=>{
 const original='Antes  después',{path}=await open(original);await cursorAt(6);await menu().click()
 const diagnostic={source:await source(),menuLabels:await toolbar().locator('.dropdown button').allTextContents()}
 await test.info().attach('menu-fecha',{body:Buffer.from(JSON.stringify(diagnostic,null,2)),contentType:'application/json'})
 if(process.env.FREYALAB_DATE_EVIDENCE_DIR){await mkdir(process.env.FREYALAB_DATE_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.FREYALAB_DATE_EVIDENCE_DIR,`5-date-${process.env.FREYALAB_DATE_PHASE??'run'}.json`),JSON.stringify(diagnostic,null,2))}
 await expect(action('Fecha de hoy')).toBeVisible();await action('Fecha de hoy').click()
 await expect.poll(source).toBe('Antes 2024-02-29 después');await expect(content()).toBeFocused()
 expect(await selection()).toBe('');await page.keyboard.insertText('!');await expect.poll(source).toBe('Antes 2024-02-29! después')
 expect(await readFile(path,'utf8')).toBe(original)
})

test('F2/F8: Fecha y hora reemplaza una selección multilínea, conserva CRLF y Unicode y deshacer la restaura completa',async()=>{
 const original='Inicio\r\nuno\r\ndos\r\n🐾 café',{path}=await open(original)
 // Estos desplazamientos cruzan solo ASCII/LF; el Unicode del final no se divide.
 await selectRange(7,7);await insert('Fecha y hora');await expect.poll(source).toBe('Inicio\r\n2024-02-29 09:05\r\n🐾 café')
 expect(await selection()).toBe('');await page.keyboard.press('Shift+ArrowLeft');expect(await selection()).toBe('5');await page.keyboard.press('ArrowRight')
 await page.keyboard.press('ControlOrMeta+Z');await expect.poll(source).toBe(original);expect((await selection()).replace(/\r\n/g,'\n')).toBe('uno\ndos')
 expect(await readFile(path,'utf8')).toBe(original)
})

test('F3: dos inserciones son dos pasos de deshacer y rehacer mantiene el historial estándar',async()=>{
 const original='Nota ';await open(original);await content().focus();await page.keyboard.press('ControlOrMeta+End')
 await insert('Fecha de hoy');await expect.poll(source).toBe('Nota 2024-02-29')
 await insert('Fecha y hora');await expect.poll(source).toBe('Nota 2024-02-292024-02-29 09:05')
 await page.keyboard.press('ControlOrMeta+Z');await expect.poll(source).toBe('Nota 2024-02-29')
 await page.keyboard.press('ControlOrMeta+Z');await expect.poll(source).toBe(original)
 await page.keyboard.press(process.platform==='darwin'?'ControlOrMeta+Shift+Z':'ControlOrMeta+Y');await expect.poll(source).toBe('Nota 2024-02-29');expect(await selection()).toBe('')
 await page.keyboard.insertText('!');await expect.poll(source).toBe('Nota 2024-02-29!')
})

test('F3: insertar marca cambios; guardar escribe únicamente el resultado esperado',async()=>{
 const original='Acta',{path}=await open(original);expect((await documentInfo())?.dirty).toBe(false)
 await content().focus();await page.keyboard.press('ControlOrMeta+A');await insert('Fecha de hoy')
 await expect.poll(source).toBe('2024-02-29');expect((await documentInfo())?.dirty).toBe(true)
 expect(await readFile(path,'utf8')).toBe(original);await expect(page.locator('.statusbar')).toContainText('Cambios pendientes')
 await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect.poll(()=>readFile(path,'utf8')).toBe('2024-02-29')
 await expect.poll(async()=>(await documentInfo())?.dirty).toBe(false);await expect(page.locator('.statusbar')).toContainText('Guardado')
})

test('F1/F4: fecha local, medianoche, 23:59, cambio de año y ceros a la izquierda no dependen del idioma',async()=>{
 for(const item of [
  {date:new Date(2025,0,1,0,0),expected:'2025-01-01 00:00'},
  {date:new Date(2024,11,31,23,59),expected:'2024-12-31 23:59'},
  {date:new Date(2024,1,29,9,5),expected:'2024-02-29 09:05'}
 ]){await page.clock.setFixedTime(item.date);await open('');await content().focus();await insert('Fecha y hora');await expect.poll(source).toBe(item.expected)}
})

test('F8: código y front matter reciben texto literal sin transformar el resto del documento',async()=>{
 for(const item of [
  {text:'```text\n\n```',from:8,expected:'```text\n2024-02-29 09:05\n```'},
  {text:'---\ncreated: \n---\n\n# Freya',from:13,expected:'---\ncreated: 2024-02-29 09:05\n---\n\n# Freya'}
 ]){await open(item.text);await cursorAt(item.from);await insert('Fecha y hora');await expect.poll(source).toBe(item.expected);await page.keyboard.press('ControlOrMeta+Z');await expect.poll(source).toBe(item.text)}
})

test('F6: muestra Markdown de solo lectura deshabilita las fechas y TXT/Mermaid no ofrecen estas acciones',async()=>{
 const line='Fuente sin modificar. '.repeat(35)+'\n',bytes=10*1024*1024+1,original=Buffer.alloc(bytes,32);original.write(line.repeat(Math.floor(bytes/line.length)),0,'ascii')
 const path=join(directory,'solo-lectura.md');await writeFile(path,original)
 const [document]=await page.evaluate(path=>window.freya.openPaths([path]),path);documentId=document.id;expect(document.readonly).toBe(true)
 const before=await source();await expect(menu()).toHaveAttribute('aria-disabled','true')
 for(const name of ['Fecha de hoy','Fecha y hora'])await expect(toolbar().getByRole('button',{name,exact:true,includeHidden:true})).toBeDisabled()
 await menu().focus();await page.keyboard.press('Enter');await expect(toolbar().locator('details[open]')).toHaveCount(0)
 expect(await source()).toBe(before);expect((await readFile(path)).equals(original)).toBe(true)
 for(const item of [{text:'Texto plano',extension:'txt'},{text:'flowchart LR\n A --> B',extension:'mmd'}]){
  await open(item.text,item.extension);await expect(toolbar()).toHaveCount(0);await expect(page.getByRole('button',{name:'Fecha de hoy',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Fecha y hora',exact:true})).toHaveCount(0);expect(await source()).toBe(item.text)
 }
})

test('F7: ambas acciones se alcanzan por el orden de tabulación y devuelven el foco al editor',async()=>{
 await open('Nota');await content().focus();await page.keyboard.press('ControlOrMeta+A')
 await menu().focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab')
 for(let index=0;index<6;index++)await page.keyboard.press('Tab')
 await expect(action('Fecha de hoy')).toBeFocused();await page.keyboard.press('Enter');await expect.poll(source).toBe('2024-02-29');await expect(content()).toBeFocused()
 await menu().focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab')
 for(let index=0;index<7;index++)await page.keyboard.press('Tab')
 await expect(action('Fecha y hora')).toBeFocused();await page.keyboard.press('Enter');await expect.poll(source).toBe('2024-02-292024-02-29 09:05');await expect(content()).toBeFocused()
})

test('F5: composición IME sintética bloquea la inserción; no acredita un IME físico',async()=>{
 const original='Freya🐾';await open(original);await content().focus();await page.keyboard.press('ControlOrMeta+End');await menu().click();await content().focus()
 const trusted=await content().evaluate(node=>{const event=new CompositionEvent('compositionstart',{data:'',bubbles:true});node.dispatchEvent(event);return event.isTrusted})
 expect(trusted).toBe(false);await action('Fecha de hoy').dispatchEvent('click');expect(await source()).toBe(original)
 await content().dispatchEvent('compositionend',{data:''});await insert('Fecha de hoy');await expect.poll(source).toBe('Freya🐾2024-02-29')
 await test.info().attach('ime-sintetico',{body:Buffer.from(JSON.stringify({compositionEventTrusted:false,click:'sintético para conservar la composición',physicalIME:false})),contentType:'application/json'})
})

test('menú y resultado permanecen claros en ambos temas a 1440×900 sin añadir altura de barra',async()=>{
 const original='# Registro de Freya\n\nActualizado: ';await open(original);await content().focus();await page.keyboard.press('ControlOrMeta+End')
 for(const theme of ['light','dark']){
  await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme);await settled();await menu().click()
  await expect(action('Fecha de hoy')).toBeVisible();await expect(action('Fecha y hora')).toBeVisible()
  const labels=await toolbar().locator('.dropdown button').allTextContents();expect(labels.indexOf('Fecha de hoy')).toBe(labels.indexOf('Enlace')+1);expect(labels.indexOf('Fecha y hora')).toBe(labels.indexOf('Fecha de hoy')+1)
  const bar=await page.locator('.document-tools').boundingBox();expect(bar!.height).toBeLessThanOrEqual(43)
  await capture(`5-date-menu-${theme}-1440x900.png`);await action('Fecha y hora').click()
  await expect.poll(source).toBe(original+'2024-02-29 09:05');await settled();await expect(page.locator('.markdown-body')).toContainText('Actualizado: 2024-02-29 09:05')
  await capture(`5-date-result-${theme}-1440x900.png`);await page.keyboard.press('ControlOrMeta+Z');await expect.poll(source).toBe(original)
 }
})
