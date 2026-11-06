import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {t} from '../../src/shared/i18n'
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,folder:string,id:string,serial=0

test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-md001-'));await mkdir(join(folder,'saved'));await mkdir(join(folder,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:test.info().title.includes('en-XA')?'en-XA':'es',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
const content=()=>page.locator('.cm-content')
const toolbar=()=>page.getByRole('group',{name:'Formato Markdown',exact:true})
const button=(name:string)=>toolbar().getByRole('button',{name,exact:true})
const block=()=>toolbar().getByRole('combobox',{name:'Tipo de bloque',exact:true})
const source=()=>page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id)?.text,id)
async function open(text='Freya',name=`documento-${++serial}.md`){const path=join(folder,name);await writeFile(path,text);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);id=doc.id;await expect(toolbar()).toBeVisible();await page.getByRole('button',{name:'Editar',exact:true}).click();return{path,doc}}
async function replace(text:string){await content().click();await page.keyboard.press('ControlOrMeta+A');if(text)await page.keyboard.insertText(text);else await page.keyboard.press('Backspace');await expect.poll(source).toBe(text)}
async function selectAll(){await content().focus();await page.keyboard.press('ControlOrMeta+A')}
async function cursorAt(position:number){await content().focus();await page.keyboard.press('ControlOrMeta+Home');for(let i=0;i<position;i++)await page.keyboard.press('ArrowRight')}
async function insert(label:string){await toolbar().getByLabel('Más opciones de Markdown',{exact:true}).click();await toolbar().getByRole('button',{name:label,exact:true}).click()}
const focusedEditor=()=>expect(content()).toBeFocused()

for(const [name,marker] of [['Negrita','**'],['Cursiva','*'],['Tachado','~~'],['Código en línea','`']]){
 test(`formato ${name}: aplica, muestra estado, devuelve foco y revierte sin alterar Unicode`,async()=>{
  await open('¡Freya 🐾 café!');await selectAll();await button(name).click()
  await expect.poll(source).toBe(marker+'¡Freya 🐾 café!'+marker);await expect(button(name)).toHaveAttribute('aria-pressed','true');await focusedEditor()
  await button(name).click();await expect.poll(source).toBe('¡Freya 🐾 café!');await expect(button(name)).toHaveAttribute('aria-pressed','false');await focusedEditor()
 })
}

test('selector de bloque: títulos multilínea, cambio de nivel, párrafo y deshacer en un paso',async()=>{
 const text='Primera\n\nTercera';await open(text);await selectAll();await block().selectOption('heading1')
 await expect.poll(source).toBe('# Primera\n# \n# Tercera');await expect(block()).toHaveValue('heading1');await focusedEditor()
 await block().selectOption('heading3');await expect.poll(source).toBe('### Primera\n### \n### Tercera')
 await page.keyboard.press('ControlOrMeta+Z');await expect.poll(source).toBe('# Primera\n# \n# Tercera')
 await page.keyboard.press(process.platform==='darwin'?'ControlOrMeta+Shift+Z':'ControlOrMeta+Y');await expect.poll(source).toBe('### Primera\n### \n### Tercera')
 await block().selectOption('paragraph');await expect.poll(source).toBe(text)
 await block().selectOption('heading2');await block().selectOption('heading2');await expect.poll(source).toBe(text)
})

test('Insertar: listas, tareas y citas aplican a líneas completas y vuelven al texto original',async()=>{
 const text='Uno\nDos';await open(text)
 for(const [label,expected] of [['Lista con viñetas','- Uno\n- Dos'],['Lista numerada','1. Uno\n2. Dos'],['Lista de tareas','- [ ] Uno\n- [ ] Dos'],['Cita','> Uno\n> Dos']]){
  await replace(text);await selectAll();await insert(label);await expect.poll(source).toBe(expected);await focusedEditor()
  await insert(label);await expect.poll(source).toBe(text);await focusedEditor()
 }
})

test('enlace, separador y código con lenguaje se insertan sin escribir sintaxis y se deshacen en un paso',async()=>{
 await open('Freya');await selectAll();await insert('Enlace');await expect.poll(source).toBe('[Freya](https://ejemplo.com)');await focusedEditor()
 await page.keyboard.press('ControlOrMeta+Z');await expect.poll(source).toBe('Freya')
 await replace('');await insert('Separador');await expect.poll(source).toBe('---');await focusedEditor();await page.keyboard.press('ControlOrMeta+Z');await expect.poll(source).toBe('')
 await replace('print("🐾")');await selectAll();await toolbar().getByLabel('Más opciones de Markdown',{exact:true}).click()
 await toolbar().getByRole('combobox',{name:'Lenguaje del bloque de código',exact:true}).selectOption('python')
 await toolbar().getByRole('button',{name:'Bloque de código',exact:true}).click();await expect.poll(source).toBe('```python\nprint("🐾")\n```');await focusedEditor()
 await page.keyboard.press('ControlOrMeta+Z');await expect.poll(source).toBe('print("🐾")')
})

test('estado activo y selector siguen al cursor y se reinician al cambiar de documento',async()=>{
 const text='**uno** y *dos* y ~~tres~~ y `cuatro`\n# Título\ntexto';const first=await open(text,'primero.md')
 await cursorAt(3);await expect(button('Negrita')).toHaveAttribute('aria-pressed','true');await expect(button('Cursiva')).toHaveAttribute('aria-pressed','false')
 await cursorAt(text.indexOf('dos')+1);await expect(button('Cursiva')).toHaveAttribute('aria-pressed','true');await expect(button('Negrita')).toHaveAttribute('aria-pressed','false')
 await cursorAt(text.indexOf('tres')+1);await expect(button('Tachado')).toHaveAttribute('aria-pressed','true')
 await cursorAt(text.indexOf('cuatro')+1);await expect(button('Código en línea')).toHaveAttribute('aria-pressed','true')
 await cursorAt(text.indexOf('Título')+1);await expect(block()).toHaveValue('heading1')
 await open('Párrafo','segundo.md');await expect(block()).toHaveValue('paragraph');for(const name of ['Negrita','Cursiva','Tachado','Código en línea'])await expect(button(name)).toHaveAttribute('aria-pressed','false')
 await page.getByRole('tab',{name:'primero.md',exact:true}).click();id=first.doc.id;await cursorAt(3);await expect(button('Negrita')).toHaveAttribute('aria-pressed','true')
})

test('teclado: formatos y títulos tienen atajos; menú, lenguaje y acciones son alcanzables sin ratón',async()=>{
 await open('Freya');await selectAll()
 const accelerators=await app.evaluate(({Menu})=>{
  const visit=(menu:ReturnType<typeof Menu.getApplicationMenu>):Array<{label:string;accelerator:string}>=>menu?menu.items.flatMap(item=>[...(item.accelerator?[{label:item.label,accelerator:item.accelerator}]:[]),...visit(item.submenu??null)]):[]
  return visit(Menu.getApplicationMenu())
 })
 const normalize=(value:string)=>value.toLowerCase().split('+').map(token=>/^(commandorcontrol|cmdorctrl|command|control|cmd|ctrl|meta)$/.test(token)?'mod':token==='option'?'alt':token).sort().join('+')
 const shortcuts=['Mod+Alt+0','Mod+Alt+1','Mod+Alt+2','Mod+Alt+3','Mod+Shift+X'].map(normalize)
 expect(accelerators.filter(item=>shortcuts.includes(normalize(item.accelerator)))).toEqual([])
 await test.info().attach('md001-aceleradores-electron',{body:Buffer.from(JSON.stringify(accelerators,null,2)),contentType:'application/json'})
 for(const [key,expected] of [['ControlOrMeta+B','**Freya**'],['ControlOrMeta+B','Freya'],['ControlOrMeta+I','*Freya*'],['ControlOrMeta+I','Freya'],['ControlOrMeta+Shift+X','~~Freya~~'],['ControlOrMeta+Shift+X','Freya'],['ControlOrMeta+Alt+1','# Freya'],['ControlOrMeta+Alt+2','## Freya'],['ControlOrMeta+Alt+3','### Freya'],['ControlOrMeta+Alt+0','Freya']]){await page.keyboard.press(key);await expect.poll(source).toBe(expected)}
 // Recorre el orden real de tabulación desde el selector, no invoca handlers de la aplicación.
 await block().focus();await page.keyboard.press('Tab');await expect(button('Negrita')).toBeFocused()
 await page.keyboard.press('Enter');await expect.poll(source).toBe('**Freya**');await focusedEditor()
 const summary=toolbar().getByLabel('Más opciones de Markdown',{exact:true});await summary.focus();await page.keyboard.press('Enter')
 await page.keyboard.press('Tab');await expect(toolbar().getByRole('button',{name:'Lista con viñetas',exact:true})).toBeFocused()
 await page.keyboard.press('Enter');await focusedEditor()
})

test('selección que cruza un bloque cercado: títulos, listas y citas no alteran texto ni selección',async()=>{
 const text='Antes\n```python\nprint("hola")\n```\nDespués';await open(text);await selectAll();await block().selectOption('heading1');await expect.poll(source).toBe(text)
 for(const label of ['Lista con viñetas','Lista numerada','Lista de tareas','Cita']){await insert(label);await expect.poll(source).toBe(text)}
 await page.keyboard.insertText('Reemplazo');await expect.poll(source).toBe('Reemplazo') // la selección completa quedó intacta
})

test('CRLF se conserva al formatear y guardar; el original no cambia hasta guardar',async()=>{
 const {path}=await open('Uno\r\nDos\r\n');await selectAll();await insert('Cita');await expect.poll(source).toBe('> Uno\r\n> Dos\r\n')
 expect(await readFile(path,'utf8')).toBe('Uno\r\nDos\r\n')
 await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect.poll(()=>readFile(path,'utf8')).toBe('> Uno\r\n> Dos\r\n')
 await selectAll();await insert('Bloque de código')
 const fenced='```text\r\n> Uno\r\n> Dos\r\n\r\n```';await expect.poll(source).toBe(fenced)
 await expect(content().locator('.cm-line')).toHaveCount(5)
 await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect.poll(()=>readFile(path,'utf8')).toBe(fenced)
})

test('solo lectura deshabilita todos los controles y vista previa oculta la barra',{tag:'@perf'},async()=>{
 await open('Pequeño');await page.getByRole('button',{name:'Editar',exact:true}).click()
 const text='# Fuente protegida\n'+('Texto sin modificar.\n'.repeat(600000)),{path,doc}=await open(text,'solo-lectura.md');expect(doc.readonly).toBe(true)
 const before=await readFile(path,'utf8')
 for(const control of await toolbar().locator('button,select').all()){
  if(['Buscar','Índice'].includes((await control.innerText()).trim()))await expect(control).toBeEnabled()
  else await expect(control).toBeDisabled()
 }
 await expect(toolbar().getByLabel('Más opciones de Markdown',{exact:true})).toHaveAttribute('aria-disabled','true')
 await toolbar().getByLabel('Más opciones de Markdown',{exact:true}).press('Enter');await expect(toolbar().locator('details[open]')).toHaveCount(0)
 await page.setViewportSize({width:700,height:720})
 const more=toolbar().getByRole('button',{name:'Más',exact:true});await more.press('Enter')
 const task=toolbar().getByRole('menuitem',{name:'Tarea',exact:true})
 await expect(task).toHaveAttribute('aria-disabled','true')
 await expect(task).toHaveAttribute('aria-describedby','control-reason-readonly')
 await task.press('Enter');await expect(task).toBeFocused()
 await task.press('Escape');await expect(more).toBeFocused()
 await content().focus();await page.keyboard.press('ControlOrMeta+B');await page.keyboard.press('ControlOrMeta+Shift+X');expect((await page.evaluate(()=>window.freya.documents())).find(item=>item.id===id)?.dirty).toBe(false)
 expect(await readFile(path,'utf8')).toBe(before)
 await page.getByRole('button',{name:'Vista previa',exact:true}).click();await expect(toolbar()).toHaveCount(0)
})

test('barra compacta, estado visible y foco en claro/oscuro a 1440×900 y 1280×720',async()=>{
 await open('# Documento de Freya\n\nUn texto que puedes **editar** con la barra.\n\n- Revisar\n- Compartir')
 const layouts:Array<{width:number;height:number;theme:string;barHeight:number;toolbarHeight:number;barTop:number}>=[]
 for(const [width,height] of [[1440,900],[1280,720]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.getByLabel('Tema',{exact:true}).selectOption(theme)
  await cursorAt(65);await button('Negrita').click();await expect(button('Negrita')).toHaveAttribute('aria-pressed','true')
  await expect(toolbar()).toBeInViewport();await expect(button('Mermaid')).toBeInViewport();await expect(block()).toBeInViewport()
  const layout=await page.locator('.document-tools').boundingBox();expect(layout!.height).toBeLessThanOrEqual(43)
  const bounds=await toolbar().boundingBox();expect(bounds!.height).toBeLessThanOrEqual(33);layouts.push({width,height,theme,barHeight:layout!.height,toolbarHeight:bounds!.height,barTop:layout!.y})
  for(const control of await page.locator('.document-tools').getByRole('button').all()){
   const box=await control.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(layout!.x-.5);expect(box!.x+box!.width).toBeLessThanOrEqual(layout!.x+layout!.width+.5);expect(box!.y+box!.height).toBeLessThanOrEqual(layout!.y+layout!.height+.5)
  }
  await button('Negrita').focus();await expect(button('Negrita')).toBeFocused()
  if(process.env.FREYALAB_MD_EVIDENCE)await page.screenshot({path:resolve(`docs/evidence/md-001-${theme}-${width}x${height}.png`)})
  await button('Negrita').click()
 }
 await test.info().attach('md001-layout',{body:Buffer.from(JSON.stringify(layouts,null,2)),contentType:'application/json'})
})


test('composición IME sintética: los atajos no insertan marcadores y Unicode conserva el carácter completo',async()=>{
 await open('Freya');await content().focus();await page.keyboard.press('ControlOrMeta+End');await expect(page.getByLabel('Buscar archivo',{exact:true})).toBeVisible()
 await content().dispatchEvent('compositionstart',{data:''})
 await page.keyboard.press('ControlOrMeta+B');await page.keyboard.press('ControlOrMeta+I');await page.keyboard.press('ControlOrMeta+Shift+X')
 await expect.poll(source).toBe('Freya');await expect(page.getByLabel('Buscar archivo',{exact:true})).toBeVisible()
 await content().dispatchEvent('compositionend',{data:''});await page.keyboard.insertText('🐾')
 await expect.poll(source).toBe('Freya🐾');await selectAll();await button('Negrita').click();await expect.poll(source).toBe('**Freya🐾**')
 // Los eventos son sintéticos: este caso no sustituye una comprobación con un IME del sistema.
})

test('documento de 10 MiB: el estado sigue al cursor sin bloquear la navegación',{tag:'@perf'},async()=>{
 test.setTimeout(300_000)
 await open('Preparando la medición') // el siguiente documento conserva el modo Editar
 const bytes=10*1024*1024,prefix='# Inicio\n\n',suffix='\n# Final\nFin de Freya',line='dato '.repeat(48)+'\n'
 const rows=Math.floor((bytes-Buffer.byteLength(prefix+suffix))/Buffer.byteLength(line)),padding=bytes-Buffer.byteLength(prefix+suffix)-rows*Buffer.byteLength(line)
 const text=prefix+line.repeat(rows)+'x'.repeat(padding)+suffix,path=join(folder,'diez-MiB.md');await writeFile(path,text)
 const openingStart=performance.now(),[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);id=doc.id
 await expect(page.getByRole('tab',{name:'diez-MiB.md',exact:true})).toHaveAttribute('aria-selected','true',{timeout:180_000})
 await content().focus({timeout:180_000});const openingMs=performance.now()-openingStart
 expect(doc.readonly).toBe(false);expect((await stat(path)).size).toBe(bytes)
 await page.keyboard.press('ControlOrMeta+End');await expect(block()).toHaveValue('paragraph')
 await page.keyboard.press('ArrowUp');await expect(block()).toHaveValue('heading1');await page.keyboard.press('ArrowDown');await expect(block()).toHaveValue('paragraph')
 const timings:number[]=[]
 for(let i=0;i<20;i++){
  const start=await page.evaluate(()=>performance.now());await page.keyboard.press(i%2?'ArrowRight':'ArrowLeft')
  const end=await page.evaluate(()=>new Promise<number>(resolve=>requestAnimationFrame(()=>resolve(performance.now()))));timings.push(end-start)
 }
 const sorted=[...timings].sort((a,b)=>a-b),result={bytes,generatedShortLines:rows,openingMs,samples:timings,p50:(sorted[9]+sorted[10])/2,p95:sorted[18],max:sorted[19],platform:process.platform,architecture:process.arch,measurement:'Tiempo entre órdenes de Playwright y siguiente frame de Chromium, incluye comunicación del controlador; no es una garantía universal.'}
 await test.info().attach('md001-cursor-10MiB',{body:Buffer.from(JSON.stringify(result,null,2)),contentType:'application/json'})
 expect(result.max).toBeLessThan(5000)
 expect((await page.evaluate(()=>window.freya.documents())).find(item=>item.id===id)?.dirty).toBe(false)
})


test('estado en límites: fuera de los marcadores no hay formato activo',async()=>{
 await open('Freya')
 for(const [name,marker] of [['Negrita','**'],['Cursiva','*'],['Tachado','~~'],['Código en línea','`']]){
  const text=marker+'Freya'+marker;await replace(text)
  await cursorAt(0);await expect(button(name)).toHaveAttribute('aria-pressed','false')
  await cursorAt(text.length);await expect(button(name)).toHaveAttribute('aria-pressed','false')
  await cursorAt(marker.length+1);await expect(button(name)).toHaveAttribute('aria-pressed','true')
 }
})


for(const [name,marker] of [['Negrita','**'],['Cursiva','*'],['Tachado','~~'],['Código en línea','`']]){
 test(`selección vacía ${name}: marcadores con cursor dentro, estado activo y alternancia`,async()=>{
  await open('')
  for(const indent of ['', '  ']){
   await replace(indent);await button(name).click();await expect.poll(source).toBe(indent+marker+marker)
   await expect(button(name)).toHaveAttribute('aria-pressed','true');await focusedEditor()
   await button(name).click();await expect.poll(source).toBe(indent);await expect(button(name)).toHaveAttribute('aria-pressed','false');await focusedEditor()
  }
 })
}

const responsiveWidths=[1280,1100,1000,900,800,700]
async function clippedActions(){
 return page.locator('.document-tools').evaluate(bar=>{
  const bounds=bar.getBoundingClientRect()
  return [...bar.querySelectorAll<HTMLElement>('button,select,summary')].flatMap(item=>{
   if(item.closest('.dropdown')||!item.getClientRects().length||getComputedStyle(item).visibility==='hidden')return []
   const {left,right,top,bottom,width,height}=item.getBoundingClientRect()
   return left<bounds.left-.5||right>bounds.right+.5||top<bounds.top-.5||bottom>bounds.bottom+.5||Math.min(width,height)<24
    ?[{action:item.getAttribute('aria-label')||item.textContent?.trim(),width,height,right,limit:bounds.right}]:[]
  })
 })
}

test('H14-1: las acciones caben a los seis anchos y Más conserva su acceso por teclado',async()=>{
 await open('# Inicio\n\nFreya')
 const bar=page.locator('.document-tools')
 for(const width of responsiveWidths){
  await page.setViewportSize({width,height:720})
  // ResizeObserver puede actualizar la barra después de que cambie el viewport.
  const geometryWait={message:`${width} px`,timeout:5000}
  await expect.soft.poll(clippedActions,geometryWait).toEqual([])
  expect.soft((await bar.boundingBox())?.height).toBe(43)
  await expect.soft.poll(()=>bar.evaluate(node=>node.scrollWidth<=node.clientWidth),geometryWait).toBe(true)
 }
 const more=bar.getByRole('button',{name:'Más',exact:true})
 await more.press('Enter')
 const menu=bar.getByRole('menu',{name:'Más',exact:true})
 await expect(menu.getByRole('menuitem',{name:'Tarea',exact:true})).toBeFocused()
 await page.keyboard.press('ArrowDown')
 await expect(menu.getByRole('menuitem',{name:'Tabla',exact:true})).toBeFocused()
 await page.keyboard.press('Escape')
 await expect(menu).toBeHidden();await expect(more).toBeFocused()
 await more.press('ArrowDown');await page.keyboard.press('Enter')
 await expect.poll(source).toContain('- [ ]')
 await focusedEditor()
 await more.press('Enter')
 const insertItem=menu.getByRole('menuitem',{name:'Más opciones de Markdown',exact:true})
 await insertItem.press('Enter')
 const insertPanel=bar.getByRole('dialog',{name:'Más opciones de Markdown',exact:true})
 await expect(insertPanel.getByRole('button',{name:'Lista con viñetas',exact:true})).toBeFocused()
 await insertPanel.getByRole('combobox',{name:'Lenguaje del bloque de código',exact:true}).selectOption('python')
 await insertPanel.getByRole('button',{name:'Bloque de código',exact:true}).click()
 await expect.poll(source).toContain('```python')
 await focusedEditor()
 // Ensanchar solo el explorador debe actualizar la barra aunque no cambie la ventana.
 await page.setViewportSize({width:1280,height:720})
 const sidebar=page.getByRole('slider',{name:'Ancho del explorador'})
 for(let i=0;i<18;i++)await sidebar.press('ArrowRight')
 await expect(sidebar).toHaveAttribute('aria-valuenow','420')
 await expect(more).toBeVisible()
 await page.setViewportSize({width:700,height:720})
 await expect.poll(clippedActions).toEqual([])
 await page.setViewportSize({width:1280,height:720})
 await expect(sidebar).toHaveAttribute('aria-valuenow','420')
})

for(const locale of ['es','en-XA'] as const)test(`H14-1: TXT, Mermaid y CSV Texto conservan sus controles a los seis anchos (${locale})`,async()=>{
 const csvLabel=(key:string)=>t('csvText.'+key,{},locale)
 for(const [file,text] of [['nota.txt','Texto'],['flujo.mmd','flowchart LR\nA --> B'],['datos.csv','ID,Nombre\n1,Ana\n']]){
  await page.setViewportSize({width:1280,height:720})
  const path=join(folder,file);await writeFile(path,text)
  await page.evaluate(path=>window.freya.openPaths([path]),path)
  await expect(page.getByRole('tab',{name:file,exact:true})).toHaveAttribute('aria-selected','true')
  if(file.endsWith('.csv'))await page.getByRole('group',{name:csvLabel('viewGroup')}).getByRole('button',{name:csvLabel('text'),exact:true}).click()
  const bar=page.locator('.document-tools')
  await expect(bar.getByRole('button',{name:file.endsWith('.csv')?csvLabel('search'):'Buscar',exact:true})).toBeVisible()
  for(const width of responsiveWidths){
   await page.setViewportSize({width,height:720})
   expect.soft(await clippedActions(),`${file} · ${width} px`).toEqual([])
   expect.soft(await bar.evaluate(node=>node.scrollWidth<=node.clientWidth),`${file} · ${width} px`).toBe(true)
  }
 }
})

test('H14-1: en-XA, colores forzados y movimiento reducido conservan todas las acciones',async()=>{
 await expect(page.locator('html')).toHaveAttribute('lang','en-XA')
 const path=join(folder,'ampliado.md');await writeFile(path,'# Inicio\n\nFreya')
 await page.evaluate(path=>window.freya.openPaths([path]),path)
 await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'})
 const bar=page.locator('.document-tools'),more=bar.getByRole('button',{name:'[Mörë~~]',exact:true})
 const labels=['task','table','mermaid','insertLabel','search','index'].map(key=>t('markdown.toolbar.'+key,{},'en-XA'))
 for(const width of responsiveWidths){
  await page.setViewportSize({width,height:720})
  await expect.poll(clippedActions,{message:`en-XA · ${width} px`}).toEqual([])
  expect((await bar.boundingBox())?.height).toBe(43)
  expect(await bar.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true)
  if(await more.isVisible())await more.press('Enter')
  for(const name of labels){
   const action=bar.getByLabel(name,{exact:true}).or(bar.getByRole('button',{name,exact:true})).or(bar.getByRole('menuitem',{name,exact:true})).or(bar.getByRole('menuitemcheckbox',{name,exact:true}))
   await expect(action,`${width} px · ${name}`).toHaveCount(1)
   const box=await action.boundingBox()
   expect(box).not.toBeNull()
   expect(box!.width).toBeGreaterThanOrEqual(24);expect(box!.height).toBeGreaterThanOrEqual(24)
   expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+.5)
  }
  if(await more.isVisible()){
   await page.keyboard.press('Escape');await expect(more).toBeFocused()
  }
 }
 expect(await more.evaluate(node=>({
  forced:matchMedia('(forced-colors: active)').matches,outline:getComputedStyle(node).outlineStyle,
  duration:getComputedStyle(node).transitionDuration
 }))).toEqual({forced:true,outline:'solid',duration:'0s'})
})
