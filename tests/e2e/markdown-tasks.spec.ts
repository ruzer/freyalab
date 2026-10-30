import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,directory:string,id:string,serial=0
const article=()=>page.locator('.preview article')
const boxes=()=>article().getByRole('checkbox')
const content=()=>page.locator('.cm-content')
const source=()=>page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id)?.text,id)
const info=()=>page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),id)
const settled=()=>expect(page.locator('.preview .render-progress')).toHaveCount(0)
test.beforeEach(async()=>{
 serial=0
 directory=await mkdtemp(join(tmpdir(),'freya-md004-'));await mkdir(join(directory,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_EXPORT_DIR:join(directory,'exports')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function open(text:string){const path=join(directory,`tareas-${++serial}.md`);await writeFile(path,text);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);id=doc.id;await expect(article()).not.toBeEmpty();await settled();return{path,doc}}
async function exportFile(format:'html'|'pdf'){
 const name=`tareas-${serial}.${format}`;await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByRole('button',{name:format==='html'?'HTML autónomo':'Documento PDF',exact:true}).click()
 await expect.poll(()=>readdir(join(directory,'exports')),{timeout:30_000}).toContain(name);return join(directory,'exports',name)
}

test('C1/C2: una casilla modifica solo el marcador, marca cambios y se deshace en un paso',async()=>{
 const original='# Pendientes\n\n- [ ] Revisar informe 🐾\n- [x] Enviar acta\n',{path}=await open(original)
 await expect(boxes().first()).toBeEnabled();await expect(boxes().first()).toHaveAccessibleName('Marcar tarea: Revisar informe 🐾')
 await boxes().first().click();await expect.poll(source).toBe(original.replace('[ ]','[x]'));expect((await info())?.dirty).toBe(true);expect(await readFile(path,'utf8')).toBe(original)
 await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect.poll(source).toBe(original);await expect(boxes().first()).not.toBeChecked()
 await page.getByRole('button',{name:'Rehacer',exact:true}).click();await expect.poll(source).toBe(original.replace('[ ]','[x]'))
})

test('C1/C3: CRLF, YAML, citas, anidación y [X] conservan literalmente el resto',async()=>{
 const original='\ufeff---\r\ntitle: Tareas\r\n---\r\n\r\n# Lista\r\n\r\n* [ ] Uno\r\n  + [X] Dos\r\n\r\n> 1. [ ] Tres\r\n\r\n```markdown\r\n- [ ] No interactiva\r\n```\r\n',{path}=await open(original)
 await expect(boxes()).toHaveCount(3)
 expect(await article().locator('li.task-list-item').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-line')))).toEqual(['7','8','10'])
 await boxes().nth(1).click();const first=original.replace('[X]','[ ]');await expect.poll(source).toBe(first);await settled()
 await boxes().nth(2).click();await expect.poll(source).toBe(first.replace('1. [ ]','1. [x]'));expect(await readFile(path,'utf8')).toBe(original)
 await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect.poll(source).toBe(first)
 await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect.poll(source).toBe(original)
})

test('C1: mezcla LF/CRLF y un plegable compacto con marcador literal previo no eligen otra casilla',async()=>{
 const original='Antes 🐾\r\n\n<details open><summary>Literal [ ]</summary>- [ ] Correcta</details>\r\n\n- [ ] Última\n';await open(original)
 await expect(boxes()).toHaveCount(2);await boxes().first().click();await expect.poll(source).toBe(original.replace('- [ ] Correcta','- [x] Correcta'));await settled()
 await boxes().last().click();await expect.poll(source).toBe(original.replace('- [ ] Correcta','- [x] Correcta').replace('- [ ] Última','- [x] Última'))
 await page.getByRole('button',{name:'Deshacer',exact:true}).click();await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect.poll(source).toBe(original)
})

test('C2: Vista previa sin CodeMirror conserva teclado local e historial mediante el menú nativo',async()=>{
 const original='- [ ] Teclado\n';await open(original);await page.getByRole('button',{name:'Vista previa',exact:true}).click();await expect(page.locator('.cm-editor')).toHaveCount(0)
 await boxes().first().focus();await page.keyboard.press('Space');await expect.poll(source).toBe('- [x] Teclado\n');await settled();await expect(boxes().first()).toBeFocused()
 await page.keyboard.press('Enter');await expect.poll(source).toBe(original);await settled();await expect(boxes().first()).toBeFocused()
 // En el macOS medido, CDP/sendInputEvent no activaron NSMenu. Se
 // comprueban estado, acelerador y despacho real; no se simula una tecla del SO.
 for(const [command,expected]of [['edit.undo','- [x] Teclado\n'],['edit.redo',original]]as const){
  const observed=await app.evaluate(({Menu,BrowserWindow},id)=>{
   const item=Menu.getApplicationMenu()!.getMenuItemById(id)!,contents=BrowserWindow.getAllWindows()[0].webContents,send=contents.send.bind(contents)
   const state=globalThis as unknown as {taskMenuDispatches:number};state.taskMenuDispatches=0
   contents.send=(channel:string,...args:unknown[])=>{if(channel==='freya:command'&&(args[0]as{id?:string})?.id===id)state.taskMenuDispatches++;return send(channel,...args)}
   const snapshot={enabled:item.enabled,accelerator:item.accelerator};item.click(item,undefined,{}as Electron.KeyboardEvent);return snapshot
  },command)
  expect(observed.enabled).toBe(true);expect(observed.accelerator).toBe(command==='edit.undo'?'CommandOrControl+Z':process.platform==='win32'?'Control+Y':'CommandOrControl+Shift+Z')
  await expect.poll(source).toBe(expected);expect(await app.evaluate(()=>(globalThis as unknown as {taskMenuDispatches:number}).taskMenuDispatches)).toBe(1)
 }
 await page.getByRole('button',{name:'Dividido',exact:true}).click();await expect(content()).toBeVisible();await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect.poll(source).toBe('- [x] Teclado\n')
})

test('C2: guardar no borra el historial y cambiar pestaña no aplica un cambio a otro documento',async()=>{
 const original='- [ ] Primera\n',{path}=await open(original);const firstId=id
 await boxes().first().click();await expect.poll(source).toBe('- [x] Primera\n');await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect.poll(()=>readFile(path,'utf8')).toBe('- [x] Primera\n');expect((await info())?.dirty).toBe(false)
 await open('- [ ] Segunda\n');const secondId=id;await page.getByRole('button',{name:'Vista previa',exact:true}).click();await expect(page.locator('.cm-editor')).toHaveCount(0);await boxes().first().click();await expect.poll(source).toBe('- [x] Segunda\n');await settled();await page.getByRole('tab',{name:/tareas-1.md/}).click();id=firstId;await settled()
 await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect.poll(source).toBe(original);expect((await info())?.dirty).toBe(true);expect(await readFile(path,'utf8')).toBe('- [x] Primera\n')
 await page.getByRole('tab',{name:/tareas-2.md/}).click();id=secondId;await expect(article()).toContainText('Segunda');await expect(boxes().first()).toBeChecked();await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect.poll(source).toBe('- [ ] Segunda\n');await page.getByRole('button',{name:'Dividido',exact:true}).click();await expect(content()).toContainText('Segunda');await expect(boxes().first()).not.toBeChecked()
})

test('C4: una edición entre render y clic avisa sin escribir sobre el snapshot anterior',async()=>{
 const original='- [ ] Revisar\n\nNotas';await open(original)
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await content().focus();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.insertText(' nuevas');await page.clock.runFor(40)
 await expect.poll(source).toBe(original+' nuevas');await boxes().first().evaluate(node=>(node as HTMLInputElement).click())
 await expect(page.getByRole('status').filter({hasText:'La lista cambió'})).toBeVisible();expect(await source()).toBe(original+' nuevas');await page.clock.resume();await settled();await expect(boxes().first()).not.toBeChecked()
})

test('C4: dos clics rápidos sobre un render no repiten la escritura ni alteran otra tarea idéntica',async()=>{
 const original='- [ ] Igual\n- [ ] Igual\n';await open(original);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000))
 await boxes().first().evaluate(node=>{(node as HTMLInputElement).click();(node as HTMLInputElement).click()})
 await expect.poll(source).toBe('- [x] Igual\n- [ ] Igual\n');await expect(page.getByRole('status').filter({hasText:'La lista cambió'})).toBeVisible();await page.clock.resume();await settled();await expect(boxes().first()).toBeChecked();await expect(boxes().last()).not.toBeChecked()
})

test('C5: solo lectura no habilita casillas ni escribe mediante teclado o eventos sintéticos',{tag:'@perf'},async()=>{
 const text='# Muestra\n\n- [ ] No modificar\n\n'+'Texto. '.repeat(Math.ceil(10*1024*1024/7)),{path,doc}=await open(text);expect(doc.readonly).toBe(true);const before=await source()
 await expect(boxes().first()).toBeDisabled();await boxes().first().evaluate(node=>{(node as HTMLInputElement).click();node.dispatchEvent(new Event('change',{bubbles:true}));node.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})
 expect(await source()).toBe(before);expect((await info())?.dirty).toBe(false);expect(await readFile(path,'utf8')).toBe(text)
})

test('C5: recargar una muestra que pasa a editable no deja bloqueado el estado compartido',{tag:'@perf'},async()=>{
 const large='- [ ] Antes\n\n'+'Texto. '.repeat(Math.ceil(10*1024*1024/7)),{path,doc}=await open(large);expect(doc.readonly).toBe(true);await expect(boxes().first()).toBeDisabled();await page.getByRole('button',{name:'Vista previa',exact:true}).click();await expect(page.locator('.cm-editor')).toHaveCount(0)
 const next='- [ ] Editable tras recargar\n';await writeFile(path,next);await expect(page.locator('.external-banner')).toBeVisible();await page.getByRole('button',{name:'Recargar',exact:true}).click();await expect.poll(source).toBe(next);await settled();expect((await info())?.readonly).toBe(false)
 await expect(boxes().first()).toBeEnabled();await boxes().first().click();await expect.poll(source).toBe('- [x] Editable tras recargar\n');expect(await readFile(path,'utf8')).toBe(next)
})

test('C5/C6: HTML y PDF conservan casillas deshabilitadas, sin metadatos internos ni scripts',async()=>{
 await open('# Informe\n\n- [ ] Pendiente\n- [x] Completada\n');await boxes().first().click();await expect.poll(source).toBe('# Informe\n\n- [x] Pendiente\n- [x] Completada\n');await settled()
 const html=await readFile(await exportFile('html'),'utf8'),parsed=await page.evaluate(html=>{
  const doc=new DOMParser().parseFromString(html,'text/html');return{boxes:Array.from(doc.querySelectorAll('input[type=checkbox]'),node=>({disabled:node.hasAttribute('disabled'),checked:node.hasAttribute('checked')})),internal:doc.querySelectorAll('[data-line],[data-freya-open]').length,scripts:doc.querySelectorAll('script').length}
 },html)
 expect(parsed).toEqual({boxes:[{disabled:true,checked:true},{disabled:true,checked:true}],internal:0,scripts:0})
 const pdfPath=await exportFile('pdf'),{getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),loading=getDocument({data:new Uint8Array(await readFile(pdfPath)),useSystemFonts:true})
 try{const pdf=await loading.promise,fields=[] as unknown[],text:string[]=[];for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n);fields.push(...await p.getAnnotations());text.push((await p.getTextContent()).items.map(item=>'str'in item?item.str:'').join(' '))}expect(fields).toEqual([]);expect(text.join(' ')).toContain('Pendiente');expect(text.join(' ')).toContain('Completada')}finally{await loading.destroy()}
 await expect(boxes().first()).toBeEnabled()
})

test('C6: contenido hostil no crea controles con privilegios, código y tablas siguen literales',async()=>{
 const original='- [ ] Válida\n\n<li data-line="1" onclick="alert(1)"><input type="checkbox"></li>\n\n```md\n- [ ] Código\n```\n\n| Texto |\n| --- |\n| [ ] Tabla |\n';await open(original)
 await expect(boxes()).toHaveCount(1);await expect(boxes().first()).toBeEnabled();await expect(article().locator('[onclick],script')).toHaveCount(0);await expect(article().locator('[data-line]')).toHaveCount(1)
 await boxes().first().click();await expect.poll(source).toBe(original.replace('- [ ] Válida','- [x] Válida'));await expect(article()).toContainText('- [ ] Código');await expect(article()).toContainText('[ ] Tabla')
})

test('el documento largo mantiene correspondencia al final; dos temas y misma altura de barra',async()=>{
 const original='# Lista larga\n\n'+'Párrafo de espacio.\n\n'.repeat(2500)+'- [ ] Última tarea 🐾\n';await open(original);await boxes().first().scrollIntoViewIfNeeded();await boxes().first().click();await expect.poll(source).toBe(original.replace('- [ ] Última','- [x] Última'));await settled()
 await open('# Pendientes de Freya\n\n- [ ] Revisar borrador 🐾\n  - [X] Comprobar referencias\n\n> 1. [ ] Preparar presentación\n\nLas casillas actualizan el Markdown y se pueden deshacer.\n');await boxes().first().click();await expect.poll(source).toContain('- [x] Revisar borrador');await settled()
 for(const theme of ['light','dark']){
  await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme);await settled();await boxes().first().focus();await expect(boxes().first()).toHaveAccessibleName('Marcar tarea: Revisar borrador 🐾')
  expect((await page.locator('.document-tools').boundingBox())!.height).toBeLessThanOrEqual(43)
  if(process.env.FREYALAB_TASK_EVIDENCE_DIR){await mkdir(process.env.FREYALAB_TASK_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:join(process.env.FREYALAB_TASK_EVIDENCE_DIR,`6-tasks-${theme}-1440x900.png`),animations:'disabled'})}
 }
})

test('integración con el contador: cada pestaña en Vista previa conserva su propia selección sin Editor montado',async()=>{
 const counter=page.locator('.statusbar .text-stats'),firstSource='Uno dos tres\n\n- [ ] Primera\n'
 const first=await open(firstSource);const firstId=id
 await expect(counter).toContainText('4 palabras');await content().focus();await page.keyboard.press('ControlOrMeta+Home')
 for(let index=0;index<3;index++)await page.keyboard.press('Shift+ArrowRight')
 await expect(counter).toContainText('1 de 4 palabras')
 await page.getByRole('button',{name:'Vista previa',exact:true}).click();await expect(page.locator('.cm-editor')).toHaveCount(0)
 const secondSource='Segundo documento distinto\n\n- [ ] Otra\n',second=await open(secondSource)
 await expect(page.locator('.cm-editor')).toHaveCount(0);await expect(counter).toContainText('4 palabras');await expect(counter).toHaveAttribute('aria-busy','false');await expect(counter).not.toContainText(' de ')
 await boxes().first().click();await expect.poll(source).toBe(secondSource.replace('[ ]','[x]'));await settled();await expect(counter).not.toContainText(' de ')
 expect(await readFile(second.path,'utf8')).toBe(secondSource)
 await page.getByRole('tab').filter({hasText:first.doc.name}).click();id=firstId
 await expect(page.locator('.cm-editor')).toHaveCount(0);await expect(counter).toContainText('1 de 4 palabras')
 expect(await readFile(first.path,'utf8')).toBe(firstSource);expect(await source()).toBe(firstSource)
})
