import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {runApplicationMenu} from './application-menu'
let app:ElectronApplication,page:Page,folder:string,id:string,serial=0
const content=()=>page.locator('.cm-content'),toolbar=()=>page.getByRole('group',{name:'Formato Markdown',exact:true})
const foldKey=process.platform==='darwin'?'Meta+Alt+[':'Control+Shift+BracketLeft',unfoldKey=process.platform==='darwin'?'Meta+Alt+]':'Control+Shift+BracketRight'
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
async function readyToFold(){await expect(page.locator('.cm-foldGutter [title="Plegar sección"]').first()).toBeVisible()}
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
 const original='**Freya Luna**',{path}=await open(original);await clickAt(0,3);await clickAt(0,9,true);await expect(page.locator('.cm-cursor')).toHaveCount(2);await toolbar().getByRole('button',{name:'Negrita',exact:true}).click();await sameSource('Freya Luna')
 await page.keyboard.insertText('!');await sameSource('F!reya L!una');await page.keyboard.press('ControlOrMeta+Z');await sameSource('Freya Luna');await page.keyboard.press('ControlOrMeta+Z');await sameSource(original)
 await page.keyboard.press(process.platform==='darwin'?'Meta+Shift+Z':'Control+Y');await sameSource('Freya Luna');expect(await readFile(path,'utf8')).toBe(original)
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
 const original='# Uno\n\nCuerpo de la primera sección.\n\n# Dos\n\nFinal',{path}=await open(original);await watchAnnouncements();await readyToFold();await clickAt(0,2);await page.keyboard.press(foldKey)
 const placeholder=page.locator('.cm-foldPlaceholder');await expect(placeholder).toHaveCount(1);await expect(placeholder).toHaveAttribute('aria-label','Sección plegada');await expect(placeholder).toHaveAccessibleName('Sección plegada');await test.info().attach('plegado-arbol-accesible',{body:Buffer.from(await placeholder.ariaSnapshot()),contentType:'text/plain'});await expect.poll(announcements).toContain('Líneas plegadas');await sameSource(original,false);await expect(content()).toContainText('# Dos')
 await page.keyboard.press(unfoldKey);await expect(placeholder).toHaveCount(0);await expect.poll(announcements).toContain('Líneas desplegadas');await sameSource(original,false);expect(await readFile(path,'utf8')).toBe(original)
})
test('E2: flecha y widget de plegado no consumen el deshacer de una edición anterior',async()=>{
 const original='# Uno\n\nCuerpo\n\n# Dos\n\nFinal';await open(original);await clickAt(0,5);await page.keyboard.insertText('!');await expect.poll(source).toBe('# Uno!\n\nCuerpo\n\n# Dos\n\nFinal')
 await expect.poll(async()=>(await info())?.dirty).toBe(true);await page.locator('.cm-foldGutter [title="Plegar sección"]').first().click();await expect(page.locator('.cm-foldPlaceholder')).toHaveCount(1);await expect.poll(async()=>(await info())?.dirty).toBe(true);await page.locator('.cm-foldPlaceholder').click();await expect(page.locator('.cm-foldPlaceholder')).toHaveCount(0);await expect.poll(async()=>(await info())?.dirty).toBe(true);await content().focus();await page.keyboard.press('ControlOrMeta+Z');await sameSource(original)
})
test('E2: CRLF y encabezados aparentes en código/details conservan la fuente exacta',async()=>{
 const original='# Uno\r\n\r\n```md\r\n# No es una sección\r\n```\r\n\r\n<details>\r\n# Tampoco es sección\r\n</details>\r\n\r\n# Dos\r\n\r\nFinal',{path}=await open(original);await readyToFold();await clickAt(0,2);await page.keyboard.press(foldKey);await expect(page.locator('.cm-foldPlaceholder')).toHaveCount(1);await expect(content()).toContainText('# Dos');await page.keyboard.press(unfoldKey);await expect(content()).toContainText('No es una sección');await sameSource(original,false);expect(await readFile(path,'utf8')).toBe(original)
})
for(const [label,original,expected]of [['viñetas','- Uno','- Uno\n- '],['numeración','1. Uno','1. Uno\n2. '],['tareas','- [x] Lista','- [x] Lista\n- [ ] '],['citas','> Texto','> Texto\n> '],['vacío','- ',''],['segundo vacío','- Uno\n- ','- Uno\n'],['no compactas','- Uno\n\n- Dos','- Uno\n\n- Dos\n\n- ']]as const)test(`E3 existente: Intro en ${label}`,async()=>{
 await open(original);await content().focus();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.press('Enter');await expect.poll(source).toBe(expected);await page.keyboard.press('ControlOrMeta+Z');await sameSource(original)
})
test('E4: IME sintético no inserta formatos ni parte Unicode con varios cursores',async()=>{
 const original='uno\nuno';await open(original);await clickAt(0,3);await clickAt(1,3,true);await content().dispatchEvent('compositionstart',{data:''});await page.keyboard.press('ControlOrMeta+B');await page.keyboard.press('ControlOrMeta+I');await page.keyboard.press('ControlOrMeta+/');await expect(content().locator('.cm-line')).toHaveText(['uno','uno']);await expect.poll(source).toBe(original);await content().dispatchEvent('compositionend',{data:''});await page.keyboard.insertText('🐾');await expect.poll(source).toBe('uno🐾\nuno🐾')
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
 await open('# Documento de Freya\n\nUn párrafo que se pliega.\n\n# Otra sección\n\nTexto final.');await readyToFold();await clickAt(0,2);await page.keyboard.press(foldKey);await expect(page.locator('.cm-foldPlaceholder')).toHaveAttribute('aria-label','Sección plegada')
 for(const theme of ['light','dark']){await page.getByLabel('Tema',{exact:true}).selectOption(theme);await expect.poll(()=>page.locator('html').evaluate(node=>node.classList.contains('dark'))).toBe(theme==='dark');await expect(page.locator('.cm-foldPlaceholder')).toBeVisible();if(process.env.FREYALAB_ED01_EVIDENCE==='1')await page.screenshot({path:`docs/evidence/ed-01-${theme}-1440x900.png`,animations:'disabled'})}
})
test('E2/E4: sólo lectura permite plegar sin aceptar ediciones ni formato',{tag:'@perf'},async()=>{
 await open('# Preparar lectura\n\nEditor.','preparar-lectura.md')
 await expect(page.getByRole('button',{name:'Editar',exact:true})).toHaveClass(/\bactive\b/)
 const full='# Fuente protegida\n\n'+('Texto sin modificar.\n'.repeat(600000)),{path,doc}=await open(full,'protegido.md');expect(doc.readonly).toBe(true);const visible=await source();await readyToFold();await clickAt(0,2)
 await test.info().attach('readonly-foco',{body:Buffer.from(JSON.stringify(await content().evaluate(node=>({focused:node===document.activeElement,tabindex:node.getAttribute('tabindex'),editable:node.getAttribute('contenteditable')})))),contentType:'application/json'})
 await expect(content()).toBeFocused();await page.keyboard.press(foldKey);await expect(page.locator('.cm-foldPlaceholder')).toHaveCount(1);await page.keyboard.press(unfoldKey);await page.keyboard.press('ControlOrMeta+B');await page.keyboard.press('ControlOrMeta+/');await page.keyboard.type('(');await page.keyboard.insertText('X');await page.keyboard.press('Enter');await expect.poll(source).toBe(visible);await expect.poll(async()=>(await info())?.dirty).toBe(false);expect(await readFile(path,'utf8')).toBe(full)
})

test('E2 inline: los cuatro formatos desde el interior de una palabra renderizan y deshacen en un paso',async()=>{
 const original='Hola mundo',{path}=await open(original)
 await page.getByRole('button',{name:'Dividido',exact:true}).click()
 for(const [name,marker,tag] of [['Negrita','**','strong'],['Cursiva','*','em'],['Tachado','~~','del'],['Código en línea','`','code']] as const){
  await clickAt(0,3)
  const button=toolbar().getByRole('button',{name,exact:true})
  await button.click()
  await sameSource(marker+'Hola'+marker+' mundo',true)
  await expect(button).toHaveAttribute('aria-pressed','true')
  await expect(page.locator('.markdown-body '+tag)).toHaveText('Hola')
  await expect(page.locator('.markdown-body p')).toHaveText(original)
  await page.keyboard.press('ControlOrMeta+Z')
  await sameSource(original)
 }
 expect(await readFile(path,'utf8')).toBe(original)
})

test('E2 inline: selección inversa entre párrafos conserva CRLF, alterna por tramo y deshace en un paso',async()=>{
 const original='Hola mundo\r\n\r\nOtra línea',{path}=await open(original)
 await page.getByRole('button',{name:'Dividido',exact:true}).click()
 await clickAt(2,3)
 for(let i=0;i<15;i++)await page.keyboard.press('Shift+ArrowLeft')
 await page.keyboard.press('ControlOrMeta+B')
 const formatted='**Hola mundo**\r\n\r\n**Otr**a línea'
 await sameSource(formatted,true)
 await expect(page.locator('.markdown-body strong')).toHaveText(['Hola mundo','Otr'])
 await expect.poll(()=>page.evaluate(()=>window.getSelection()?.toString())).toBe('Hola mundo**\n\n**Otr')
 await page.keyboard.press('ControlOrMeta+B');await sameSource(original)
 await page.keyboard.press('ControlOrMeta+Z');await sameSource(formatted,true)
 await page.keyboard.press('ControlOrMeta+Z');await sameSource(original)
 expect(await readFile(path,'utf8')).toBe(original)
})

async function openH13(text:string,extension:string){
 const name=`h13-${++serial}.${extension}`,path=join(folder,name);await writeFile(path,text)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);id=doc.id
 await expect(page.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true')
 if(extension==='csv'){
  const textView=page.getByRole('group',{name:'Vista del CSV',exact:true}).getByRole('button',{name:'Texto',exact:true})
  await textView.click();await expect(textView).toHaveAttribute('aria-pressed','true');await expect(textView).toBeFocused()
  await expect(page.getByRole('textbox',{name:'Editor CSV como texto',exact:true})).toBeVisible()
 }else await page.getByRole('button',{name:'Editar',exact:true}).click()
 await expect(content()).toBeVisible()
 return{path}
}

test('H13-1: cuatro gestos de multicursor editan y deshacen en cada formato',async()=>{
 for(const extension of ['txt','mmd','md','csv']){
  await test.step(extension,async()=>{
   const first=extension==='mmd'||extension==='csv'?1:0,offset=first?4:0
   const fixture=(words:readonly string[])=>{
    const rows=words.map((word,index)=>`${word} ${index+1}`)
    if(extension==='mmd')return ['flowchart LR',...rows.map((row,index)=>`  ${'ABC'[index]}[${row}]`)].join('\r\n')
    if(extension==='csv')return `id,valor\r\n001,${rows[0]}\n002,${rows[1]}\r003,${rows[2]}\r\n`
    return rows.join('\r\n')
   }
   const original=fixture(['Freya','Freya','Freya']),{path}=await openH13(original,extension)
   const replace=async(words:readonly string[],insert:string)=>{
    await page.keyboard.insertText(insert);await sameSource(fixture(words))
    await page.keyboard.press('ControlOrMeta+Z');await sameSource(original)
   }
   await clickAt(first,offset+5);await clickAt(first+1,offset+5,true)
   await replace(['Freya!','Freya!','Freya'],'!')
   if(extension==='csv'){
    const modifier=process.platform==='darwin'?'Meta':'Control'
    await clickAt(first,offset+5);await page.keyboard.down(modifier)
    try{await clickAt(first+1,offset+5)}finally{await page.keyboard.up(modifier)}
    await replace(['Freya!','Freya!','Freya'],'!')
   }
   await clickAt(first,offset+2);await page.keyboard.press('ControlOrMeta+D');await page.keyboard.press('ControlOrMeta+D')
   await replace(['Luna','Luna','Freya'],'Luna')
   await clickAt(first,offset+2);await page.keyboard.press('ControlOrMeta+D');await page.keyboard.press('ControlOrMeta+Shift+L')
   await replace(['Luna','Luna','Luna'],'Luna')
   for(const [key,words]of [['ArrowUp',['Freya!','Freya!','Freya']],['ArrowDown',['Freya','Freya!','Freya!']]]as const){
    await clickAt(first+1,offset+5);await page.keyboard.press(`Control+Alt+${key}`)
    await replace(words,'!')
   }
   expect(await readFile(path,'utf8')).toBe(original)
  })
 }
})

test('H13-1: teclear un par lo cierra, resalta y permite seguir dentro',async()=>{
 const original='Valor = ',{path}=await openH13(original,'txt')
 await clickAt(0,original.length);await page.keyboard.type('(')
 await sameSource('Valor = ()',true)
 await expect(content().locator('.cm-matchingBracket')).toHaveText(['(',')'])
 await page.keyboard.type('"hola")');await sameSource('Valor = ("hola")',true)
 expect(await readFile(path,'utf8')).toBe(original)
})

for(const extension of ['txt','md','mmd'])test(`H13-1b: Retroceso borra el par vacío en ${extension}`,async()=>{
 await openH13('',extension)
 await content().focus();await page.keyboard.type('(');await sameSource('()')
 await page.keyboard.press('Backspace');await sameSource('')
})

test('H13-1b: los pares resaltados tienen contorno Highlight con colores forzados',async()=>{
 await page.emulateMedia({forcedColors:'active'})
 await openH13('','txt');await content().focus();await page.keyboard.type('(')
 const brackets=content().locator('.cm-matchingBracket')
 await expect(brackets).toHaveText(['(',')'])
 const highlight=await page.evaluate(()=>{
  const sample=document.createElement('span');sample.style.color='Highlight';document.body.append(sample)
  const color=getComputedStyle(sample).color;sample.remove();return color
 })
 for(const bracket of await brackets.all()){
  await expect(bracket).toHaveCSS('outline-style','solid')
  await expect(bracket).toHaveCSS('outline-width','1px')
  await expect(bracket).toHaveCSS('outline-color',highlight)
 }
})

test('H13-1: comentar alterna la sintaxis del formato y omite texto plano y CSV',async()=>{
 const errors:Error[]=[];page.on('pageerror',error=>errors.push(error))
 for(const [extension,original,commented]of [
  ['mmd','flowchart LR\r\n  A --> B','flowchart LR\r\n  %% A --> B'],
  ['md','Freya','<!-- Freya -->'],
  ['txt','Freya','Freya'],
  ['csv','id,valor\r\n001,Freya\r\n','id,valor\r\n001,Freya\r\n'],
 ]as const){
  const {path}=await openH13(original,extension)
  if(extension==='mmd')await clickAt(1,4)
  else{await content().focus();await page.keyboard.press('ControlOrMeta+A')}
  await page.keyboard.press('ControlOrMeta+/');await sameSource(commented,commented===original?false:undefined)
  await page.keyboard.press('ControlOrMeta+/');await sameSource(original,commented===original?false:undefined)
  expect(await readFile(path,'utf8')).toBe(original)
 }
 expect(errors).toEqual([])
})

test('H13-1: Tab sangra según Ajustes y deja salir con Escape o Mayús+Tab',async()=>{
 const original='Freya',{path}=await openH13(original,'txt')
 const settings=page.getByRole('dialog',{name:'Ajustes',exact:true})
 const tabIndents=settings.getByRole('checkbox',{name:'Tab sangra',exact:true})
 const indentation=settings.getByRole('combobox',{name:'Sangría',exact:true})
 const openSettings=async()=>{await runApplicationMenu(app,'app.settings');await settings.getByRole('tab',{name:'Apariencia',exact:true}).click()}
 const closeSettings=async()=>{await settings.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(settings).toHaveCount(0)}
 await content().focus();await page.keyboard.press('Tab');await expect(content()).not.toBeFocused();await sameSource(original,false)
 await openSettings();await expect(tabIndents).toBeVisible();await expect(tabIndents).not.toBeChecked()
 await tabIndents.check();await expect(settings).toHaveAttribute('aria-busy','false');await expect(tabIndents).toBeChecked();await closeSettings()
 for(const [label,indent]of [['2 espacios','  '],['4 espacios','    '],['Tabulación','\t']]as const){
  await openSettings();await indentation.selectOption({label});await expect(settings).toHaveAttribute('aria-busy','false');await closeSettings()
  await clickAt(0,0);await page.keyboard.press('Tab');await sameSource(indent+original,true)
  await expect(content()).toBeFocused();await page.keyboard.press('ControlOrMeta+Z');await sameSource(original)
 }
 await page.keyboard.press('ControlOrMeta+A');await page.keyboard.press('Escape');await page.keyboard.press('Tab');await expect(content()).not.toBeFocused();await sameSource(original)
 await content().focus();await page.keyboard.press('Shift+Tab');await expect(content()).not.toBeFocused();await sameSource(original)
 expect(await readFile(path,'utf8')).toBe(original)
})
