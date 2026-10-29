import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
let app:ElectronApplication,page:Page,folder:string,id:string,serial=0
const content=()=>page.locator('.cm-content'),toolbar=()=>page.getByRole('group',{name:'Formato Markdown',exact:true})
const foldKey=process.platform==='darwin'?'Meta+Alt+[':'Control+Shift+[',unfoldKey=process.platform==='darwin'?'Meta+Alt+]':'Control+Shift+]'
const source=()=>page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id)?.text,id)
const info=()=>page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),id)
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-ed01-'));const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[process.env.FREYALAB_ED01_TEST_ENTRY??resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function open(text:string,name=`documento-${++serial}.md`){const path=join(folder,name);await writeFile(path,text);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);id=doc.id;await expect(content()).toBeVisible();if(name.endsWith('.md'))await page.getByRole('button',{name:'Editar',exact:true}).click();return{path,doc}}
async function point(line:number,offset:number){return content().locator('.cm-line').nth(line).evaluate((node,offset)=>{
 const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let text:Node|null,remaining=offset
 while(text=walker.nextNode()){if(remaining<=(text.textContent??'').length){const range=document.createRange();range.setStart(text,remaining);range.collapse(true);const box=range.getBoundingClientRect();return{x:box.x+.2,y:box.y+box.height/2}}remaining-=(text.textContent??'').length}
 throw new Error('La posición solicitada no está en la línea visible.')
},offset)}
async function clickAt(line:number,offset:number,add=false){const coordinate=await point(line,offset);if(add)await page.keyboard.down('Alt');try{await page.mouse.click(coordinate.x,coordinate.y)}finally{if(add)await page.keyboard.up('Alt')}}
async function selectTwo(){await clickAt(0,2);await page.keyboard.press('ControlOrMeta+D');await page.keyboard.press('ControlOrMeta+D');await expect(page.locator('.cm-selectionBackground')).toHaveCount(2)}
async function sameSource(text:string,dirty?:boolean){await expect.poll(source).toBe(text);if(dirty!==undefined)await expect.poll(async()=>(await info())?.dirty).toBe(dirty)}
async function watchAnnouncements(){await page.evaluate(()=>{const messages:string[]=[],node=document.querySelector('.cm-announced')!;new MutationObserver(()=>{if(node.textContent?.trim())messages.push(node.textContent)}).observe(node,{childList:true,subtree:true,characterData:true});(window as typeof window&{ed01Announcements:string[]}).ed01Announcements=messages})}
const announcements=()=>page.evaluate(()=>(window as typeof window&{ed01Announcements:string[]}).ed01Announcements.join('\n'))

test('E1: Alt+clic edita dos cursores y un paso de deshacer conserva el original',async()=>{
 const original='uno\nuno',{path}=await open(original);await clickAt(0,3);await clickAt(1,3,true)
 await expect(page.locator('.cm-cursor')).toHaveCount(2);await page.keyboard.insertText('🐾');await expect.poll(source).toBe('uno🐾\nuno🐾')
 await page.keyboard.press('ControlOrMeta+Z');await sameSource(original);await expect(page.locator('.cm-cursor')).toHaveCount(2);expect(await readFile(path,'utf8')).toBe(original)
})
test('E1: Mod+D reemplaza dos coincidencias y deja la tercera intacta con un único undo',async()=>{
 const original='Freya uno\nFreya dos\nFreya tres';await open(original);await selectTwo();await page.keyboard.insertText('Luna');await expect.poll(source).toBe('Luna uno\nLuna dos\nFreya tres');await page.keyboard.press('ControlOrMeta+Z');await sameSource(original)
})
test('E4: barra y atajos formatean sólo la principal y conservan la secundaria mapeada',async()=>{
 for(const [action,key,expected]of [['Negrita','ControlOrMeta+B','**Freya** uno\nFreya dos'],['Cursiva','ControlOrMeta+I','*Freya* uno\nFreya dos'],['Tachado','ControlOrMeta+Shift+X','~~Freya~~ uno\nFreya dos']]as const){
  const original='Freya uno\nFreya dos';await open(original);await selectTwo();await toolbar().getByRole('button',{name:action,exact:true}).click();await expect.poll(source).toBe(expected);await expect(toolbar().getByRole('button',{name:action,exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.cm-selectionBackground')).toHaveCount(2)
  await page.keyboard.insertText('Luna');await expect.poll(source).toContain('Luna dos');await page.keyboard.press('ControlOrMeta+Z');await expect.poll(source).toBe(expected);await page.keyboard.press('ControlOrMeta+Z');await sameSource(original);await page.keyboard.press(key);await expect.poll(source).toBe(expected);await expect(page.locator('.cm-selectionBackground')).toHaveCount(2)
 }
})
test('E4: título y estado activo siguen a la principal sin convertir la segunda línea',async()=>{
 const original='Freya uno\nFreya dos';await open(original);await selectTwo();await page.keyboard.press('ControlOrMeta+Alt+2');await expect.poll(source).toBe('## Freya uno\nFreya dos');await expect(toolbar().getByRole('combobox',{name:'Tipo de bloque',exact:true})).toHaveValue('heading2');await expect(page.locator('.cm-selectionBackground')).toHaveCount(2)
 await page.keyboard.press('ControlOrMeta+Z');await sameSource(original)
})
test('E4: pasar por vista previa y otra pestaña conserva múltiples selecciones de su documento',async()=>{
 const original='Freya uno\nFreya dos',first=await open(original,'primero.md');await selectTwo();await page.getByRole('button',{name:'Vista previa',exact:true}).click();await page.getByRole('button',{name:'Editar',exact:true}).click();await expect(page.locator('.cm-selectionBackground')).toHaveCount(2)
 await open('Otro documento','segundo.md');await page.getByRole('tab',{name:'primero.md',exact:true}).click();id=first.doc.id;await content().focus();await expect(page.locator('.cm-selectionBackground')).toHaveCount(2);await page.keyboard.insertText('Luna');await expect.poll(source).toBe('Luna uno\nLuna dos')
})
test('E2/E7: plegar y desplegar con teclado anuncia en español sin cambiar fuente ni dirty',async()=>{
 const original='# Uno\n\nCuerpo de la primera sección.\n\n# Dos\n\nFinal',{path}=await open(original);await watchAnnouncements();await clickAt(0,2);await page.keyboard.press(foldKey)
 const placeholder=page.locator('.cm-foldPlaceholder');await expect(placeholder).toHaveCount(1);await expect(placeholder).toHaveAttribute('aria-label','Sección plegada');await expect(placeholder).toHaveAccessibleName('Sección plegada');await test.info().attach('plegado-arbol-accesible',{body:Buffer.from(await placeholder.ariaSnapshot()),contentType:'text/plain'});await expect.poll(announcements).toContain('Líneas plegadas');await sameSource(original,false);await expect(content()).toContainText('# Dos')
 await page.keyboard.press(unfoldKey);await expect(placeholder).toHaveCount(0);await expect.poll(announcements).toContain('Líneas desplegadas');await sameSource(original,false);expect(await readFile(path,'utf8')).toBe(original)
})
test('E2: flecha y widget de plegado no consumen el deshacer de una edición anterior',async()=>{
 const original='# Uno\n\nCuerpo\n\n# Dos\n\nFinal';await open(original);await clickAt(0,5);await page.keyboard.insertText('!');await expect.poll(source).toBe('# Uno!\n\nCuerpo\n\n# Dos\n\nFinal')
 await expect.poll(async()=>(await info())?.dirty).toBe(true);await page.locator('.cm-foldGutter [title="Plegar sección"]').first().click();await expect(page.locator('.cm-foldPlaceholder')).toHaveCount(1);await expect.poll(async()=>(await info())?.dirty).toBe(true);await page.locator('.cm-foldPlaceholder').click();await expect(page.locator('.cm-foldPlaceholder')).toHaveCount(0);await expect.poll(async()=>(await info())?.dirty).toBe(true);await content().focus();await page.keyboard.press('ControlOrMeta+Z');await sameSource(original)
})
test('E2: CRLF y encabezados aparentes en código/details conservan la fuente exacta',async()=>{
 const original='# Uno\r\n\r\n```md\r\n# No es una sección\r\n```\r\n\r\n<details>\r\n# Tampoco es sección\r\n</details>\r\n\r\n# Dos\r\n\r\nFinal',{path}=await open(original);await clickAt(0,2);await page.keyboard.press(foldKey);await expect(page.locator('.cm-foldPlaceholder')).toHaveCount(1);await expect(content()).toContainText('# Dos');await page.keyboard.press(unfoldKey);await expect(content()).toContainText('No es una sección');await sameSource(original,false);expect(await readFile(path,'utf8')).toBe(original)
})
for(const [label,original,expected]of [['viñetas','- Uno','- Uno\n- '],['numeración','1. Uno','1. Uno\n2. '],['tareas','- [x] Lista','- [x] Lista\n- [ ] '],['citas','> Texto','> Texto\n> '],['vacío','- ',''],['segundo vacío','- Uno\n- ','- Uno\n'],['no compactas','- Uno\n\n- Dos','- Uno\n\n- Dos\n\n- ']]as const)test(`E3 existente: Intro en ${label}`,async()=>{
 await open(original);await content().focus();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.press('Enter');await expect.poll(source).toBe(expected);await page.keyboard.press('ControlOrMeta+Z');await sameSource(original)
})
test('E4: IME sintético no inserta formatos ni parte Unicode con varios cursores',async()=>{
 const original='uno\nuno';await open(original);await clickAt(0,3);await clickAt(1,3,true);await content().dispatchEvent('compositionstart',{data:''});await page.keyboard.press('ControlOrMeta+B');await page.keyboard.press('ControlOrMeta+I');await expect.poll(source).toBe(original);await content().dispatchEvent('compositionend',{data:''});await page.keyboard.insertText('🐾');await expect.poll(source).toBe('uno🐾\nuno🐾')
 await test.info().attach('ime-alcance',{body:Buffer.from(JSON.stringify({synthetic:true,physicalIME:false,screenReader:false})),contentType:'application/json'})
})
test('E5: texto plano y Mermaid mantienen su comportamiento sin plegado ni continuación Markdown',async()=>{
 for(const name of ['texto.txt','diagrama.mmd']){await open('- Uno',name);await expect(page.locator('.cm-foldGutter')).toHaveCount(0);await content().focus();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.press('Enter');await expect.poll(source).toBe('- Uno\n');await page.keyboard.press('ControlOrMeta+Z');await sameSource('- Uno')}
})
test('E5: CSV-texto conserva su multicursor instalado y sus finales mixtos, sin plegado Markdown',async()=>{
 const original='id,valor\r\n001,uno\n002,uno\r003,fin\r\n',path=join(folder,'datos.csv');await writeFile(path,original);const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);id=doc.id;await page.getByRole('group',{name:'Vista del CSV',exact:true}).getByRole('button',{name:'Texto',exact:true}).click();await expect(page.getByRole('textbox',{name:'Editor CSV como texto',exact:true})).toBeVisible();await expect(page.locator('.cm-foldGutter')).toHaveCount(0)
 await content().focus();await page.keyboard.press('ControlOrMeta+Home');await page.keyboard.press('ArrowDown');for(let i=0;i<5;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('ControlOrMeta+D');await page.keyboard.press('ControlOrMeta+D');await page.keyboard.insertText('dos');await expect.poll(source).toBe('id,valor\r\n001,dos\n002,dos\r003,fin\r\n');await page.keyboard.press('ControlOrMeta+Z');await sameSource(original);expect(await readFile(path,'utf8')).toBe(original)
})
test('E2/E7: aspecto claro y oscuro conserva nombres de plegado y foco',async()=>{
 await open('# Documento de Freya\n\nUn párrafo que se pliega.\n\n# Otra sección\n\nTexto final.');await clickAt(0,2);await page.keyboard.press(foldKey);await expect(page.locator('.cm-foldPlaceholder')).toHaveAttribute('aria-label','Sección plegada')
 for(const theme of ['light','dark']){await page.getByLabel('Tema',{exact:true}).selectOption(theme);await expect.poll(()=>page.locator('html').evaluate(node=>node.classList.contains('dark'))).toBe(theme==='dark');await expect(page.locator('.cm-foldPlaceholder')).toBeVisible();if(process.env.FREYALAB_ED01_EVIDENCE==='1')await page.screenshot({path:`docs/evidence/ed-01-${theme}-1440x900.png`,animations:'disabled'})}
})
test('E2/E4: sólo lectura permite plegar sin aceptar ediciones ni formato',{tag:'@perf'},async()=>{
 const full='# Fuente protegida\n\n'+('Texto sin modificar.\n'.repeat(600000)),{path,doc}=await open(full,'protegido.md');expect(doc.readonly).toBe(true);const visible=await source();await expect(page.locator('.cm-foldGutter [title="Plegar sección"]').first()).toBeVisible();await clickAt(0,2)
 await test.info().attach('readonly-foco',{body:Buffer.from(JSON.stringify(await content().evaluate(node=>({focused:node===document.activeElement,tabindex:node.getAttribute('tabindex'),editable:node.getAttribute('contenteditable')})))),contentType:'application/json'})
 await expect(content()).toBeFocused();await page.keyboard.press(foldKey);await expect(page.locator('.cm-foldPlaceholder')).toHaveCount(1);await page.keyboard.press(unfoldKey);await page.keyboard.press('ControlOrMeta+B');await page.keyboard.insertText('X');await page.keyboard.press('Enter');await expect.poll(source).toBe(visible);await expect.poll(async()=>(await info())?.dirty).toBe(false);expect(await readFile(path,'utf8')).toBe(full)
})
