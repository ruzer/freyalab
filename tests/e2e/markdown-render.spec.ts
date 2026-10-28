import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,directory:string,documentPath:string,documentId:string
const preview=()=>page.locator('.preview')
const article=()=>preview().locator('article')

test.beforeEach(async()=>{
 directory=await mkdtemp(join(tmpdir(),'freya-md002-'));await mkdir(join(directory,'exports'));await mkdir(join(directory,'saved'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_EXPORT_DIR:join(directory,'exports'),FREYALAB_TEST_SAVE_DIR:join(directory,'saved')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

async function open(source:string){
 documentPath=join(directory,'documento.md');await writeFile(documentPath,source)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),documentPath);documentId=doc.id
 await expect(page.locator('.cm-content')).toBeVisible();await expect(article()).not.toBeEmpty();await settled()
}
async function settled(){await expect(preview().locator('.render-progress')).toHaveCount(0)}
async function intact(source:string){
 expect(await readFile(documentPath,'utf8')).toBe(source)
 const state=await page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),documentId)
 expect(state?.text).toBe(source);expect(state?.dirty).toBe(false)
 await page.getByRole('button',{name:'Guardar',exact:true}).click()
 expect(await readFile(documentPath,'utf8')).toBe(source)
}
async function screenshots(block:string,prepare?:()=>Promise<void>){
 for(const theme of ['light','dark']){
  await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme)
  if(theme==='dark')await expect(page.locator('html')).toHaveClass(/dark/);else await expect(page.locator('html')).not.toHaveClass(/dark/)
  await settled()
  if(prepare)await prepare()
  if(process.env.FREYALAB_MD_EVIDENCE)await page.screenshot({path:resolve(`docs/evidence/md-002-${block}-${theme}-1440x900.png`),animations:'disabled'})
 }
}
async function exportFile(format:'html'|'pdf'){
 const name=`documento.${format}`,path=join(directory,'exports',name);await rm(path,{force:true})
 await page.getByRole('button',{name:'Exportar',exact:true}).click()
 await page.getByRole('button',{name:format==='html'?'HTML autónomo':'Documento PDF',exact:true}).click()
 await expect.poll(()=>readdir(join(directory,'exports')),{timeout:30_000}).toContain(name)
 return path
}
async function pdfText(path:string){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),loading=getDocument({data:new Uint8Array(await readFile(path)),useSystemFonts:true})
 try{const pdf=await loading.promise,text:string[]=[];for(let index=1;index<=pdf.numPages;index++)text.push((await(await pdf.getPage(index)).getTextContent()).items.map(item=>'str'in item?item.str:'').join(' '));return text.join(' ').replace(/\s+/g,' ')}finally{await loading.destroy()}
}
async function standalone(path:string){
 // Partición distinta de la app, sin preload ni JavaScript: aquí solo funcionan los enlaces nativos.
 const opened=app.waitForEvent('window')
 await app.evaluate(async({BrowserWindow},path)=>{const window=new BrowserWindow({show:true,width:1000,height:800,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,javascript:false,partition:`md002-export-${Date.now()}`}});await window.loadFile(path)},path)
 const view=await opened;await view.waitForLoadState();expect(await view.evaluate(()=>typeof window.freya)).toBe('undefined');await expect(view.locator('script')).toHaveCount(0);return view
}
async function invariant(view:Page,selector:string,label:string){
 const result=await view.evaluate(selector=>{
  const root=document.querySelector(selector)!;const ids=Array.from(root.querySelectorAll('[id]'),node=>node.id),known=new Set(ids)
  const hrefs=Array.from(root.querySelectorAll('a[href^="#"]'),node=>node.getAttribute('href')!).filter(href=>href!=='#')
  const missing=hrefs.filter(href=>{try{return!known.has(decodeURIComponent(href.slice(1)))}catch{return true}})
  return{ids:ids.length,links:hrefs.length,missing,duplicates:ids.filter((id,index)=>ids.indexOf(id)!==index)}
 },selector)
 expect(result.missing).toEqual([]);expect(result.duplicates).toEqual([])
 await test.info().attach(label,{body:Buffer.from(JSON.stringify(result)),contentType:'application/json'})
 return result
}

test('A: propiedades plegadas y de solo lectura; abrir, guardar y exportar no reescriben ni filtran YAML al documento',async()=>{
 const yaml='title: PROPIEDAD_PRIVADA_MD002\ntags: [universidad, trabajo]\ncomentario: "<script>no ejecutar</script>"\n'
 const source=`---\n${yaml}---\n\n# Guía principal\n\nContenido principal conservado.\n`
 await open(source)
 const properties=preview().locator('details.document-properties'),summary=properties.locator('summary')
 await expect(summary).toHaveText('Propiedades del documento');await expect(properties).not.toHaveAttribute('open','')
 await expect(article()).not.toContainText('PROPIEDAD_PRIVADA_MD002');await page.locator('.document-tools').getByRole('button',{name:'Índice',exact:true}).click();await expect(page.getByRole('tabpanel',{name:'Índice del documento',exact:true}).locator('.sidebar-heading')).toHaveText(['Guía principal'])
 await summary.focus();await page.keyboard.press('Enter');await expect(properties).toHaveAttribute('open','')
 await expect(properties.locator('pre')).toHaveText(yaml);await expect(properties.locator('script')).toHaveCount(0)
 await expect(article().getByRole('heading',{name:'Guía principal',exact:true})).toBeVisible()
 await screenshots('a')
 const htmlPath=await exportFile('html'),html=await readFile(htmlPath,'utf8')
 expect(html).not.toContain('PROPIEDAD_PRIVADA_MD002');expect(html).not.toContain('Propiedades del documento');expect(html).toContain('Contenido principal conservado.')
 const text=await pdfText(await exportFile('pdf'));expect(text).toContain('Contenido principal conservado.');expect(text).not.toContain('PROPIEDAD_PRIVADA_MD002');expect(text).not.toContain('Propiedades del documento')
 await intact(source)
})

test('B: enlaces con acentos, mayúsculas y porcentaje navegan y enfocan; huérfanos avisan y no son tabulables',async()=>{
 const source='# Navegación\n\n[ir](#instalacion) · [mayúsculas](#Instalación) · [codificado](#Instalaci%C3%B3n) · [primer Uno](#uno)\n\n[perdido](#ausente) · [inicio](#) · [externo](https://example.com/guia#Parte) · [correo](mailto:equipo@example.com)\n\n'+Array.from({length:22},(_,index)=>`Párrafo de espacio ${index+1}.`).join('\n\n')+'\n\n# Instalación\n\nDestino de la guía.\n\n# Uno\n\nPrimer título repetido.\n\n# Uno\n\nSegundo título repetido.\n'
 await open(source)
 const target=article().locator('#heading-instalacion')
 for(const label of ['ir','mayúsculas','codificado']){
  const link=article().getByRole('link',{name:label,exact:true});await expect(link).toHaveAttribute('href','#heading-instalacion');await link.click();await expect(target).toBeFocused();await expect.poll(()=>preview().evaluate(node=>node.scrollTop)).toBeGreaterThan(0)
 }
 await article().getByRole('link',{name:'primer Uno',exact:true}).click();await expect(article().locator('#heading-uno')).toBeFocused()
 const broken=article().locator('.enlace-roto');await expect(broken).toHaveText('perdido');await expect(broken).toHaveAttribute('data-seccion-faltante','ausente');await expect(broken).not.toHaveAttribute('href');expect(await broken.evaluate(node=>(node as HTMLElement).tabIndex)).toBe(-1)
 await broken.click();await expect(page.getByRole('status').filter({hasText:'No encontré la sección “ausente” en este documento'})).toBeVisible()
 await expect(article().getByRole('link',{name:'inicio',exact:true})).toHaveAttribute('href','#')
 await article().getByRole('link',{name:'inicio',exact:true}).click();await expect.poll(()=>preview().evaluate(node=>node.scrollTop)).toBe(0)
 await app.evaluate(({shell})=>{const state=globalThis as unknown as {md002Opened:string[]};state.md002Opened=[];shell.openExternal=async url=>{state.md002Opened.push(url)}})
 await article().getByRole('link',{name:'externo',exact:true}).click();await article().getByRole('link',{name:'correo',exact:true}).click()
 await expect.poll(()=>app.evaluate(()=>(globalThis as unknown as {md002Opened:string[]}).md002Opened)).toEqual(['https://example.com/guia#Parte','mailto:equipo@example.com'])
 const allowedLinks=['mailto:equipo@example.com?subject=Consulta&body=Texto%20con%20attachment','MAILTO:equipo@example.com?SUBJECT=attach&body=Adjunto%20no%20incluido','mailto:equipo@example.com?attachmentName=referencia','http://example.com/guia?attach=referencia','https://example.com/guia?attachment=referencia']
 for(const href of allowedLinks)await page.evaluate(href=>window.freya.openLink(href),href)
 const opened=['https://example.com/guia#Parte','mailto:equipo@example.com',...allowedLinks]
 for(const query of ['attach=archivo.txt','attachment=','ATTACH=','Attachment=archivo.txt','a%74tach=archivo.txt','%61ttachment=','subject=Consulta&AtTaChMeNt=archivo.txt','attach&body=Texto'])await expect(page.evaluate(href=>window.freya.openLink(href),`mailto:equipo@example.com?${query}`)).rejects.toThrow(/adjuntos/i)
 for(const href of ['file:///tmp/no-abras.md','javascript:alert(1)','data:text/html,<script>alert(1)</script>'])await expect(page.evaluate(href=>window.freya.openLink(href),href)).rejects.toThrow(/permiten|permitidos|enlaces/i)
 expect(await app.evaluate(()=>(globalThis as unknown as {md002Opened:string[]}).md002Opened)).toEqual(opened)
 const count=await invariant(page,'.preview article','invariante-b-vista');expect(count.links).toBe(4)
 await screenshots('b')
 const view=await standalone(await exportFile('html'))
 try{
  await invariant(view,'body','invariante-b-html-autonomo')
  await view.getByRole('link',{name:'codificado',exact:true}).click();await expect(view.locator(':target')).toHaveAttribute('id','heading-instalacion')
  await view.getByRole('link',{name:'primer Uno',exact:true}).click();await expect(view.locator(':target')).toHaveAttribute('id','heading-uno')
  const missing=view.locator('.enlace-roto');await expect(missing).toHaveText('perdido');await expect(missing).not.toHaveAttribute('href');expect(await missing.evaluate(node=>getComputedStyle(node).textDecorationStyle)).toBe('dotted')
 }finally{await view.close()}
 await intact(source)
})

test('C: notas al pie en español, sin doble prefijo ni índice; ida y vuelta también en HTML sin JavaScript',async()=>{
 const source='# Apuntes\n\nUna referencia[^uno], otra nota[^dos] y la primera de nuevo[^uno].\n\n[^uno]: Nota idéntica.\n[^dos]: Nota idéntica.\n[^sinuso]: Esta nota nunca fue usada.\n'
 await open(source)
 const notes=article().locator('section[data-footnotes]'),refs=article().locator('a[data-footnote-ref]'),backs=article().locator('a[data-footnote-backref]')
 await expect(notes.getByRole('heading',{name:'Notas al pie',exact:true})).toBeAttached();await page.locator('.document-tools').getByRole('button',{name:'Índice',exact:true}).click();await expect(page.getByRole('tabpanel',{name:'Índice del documento',exact:true}).locator('.sidebar-heading')).toHaveText(['Apuntes'])
 await expect(refs).toHaveCount(3);await expect(backs).toHaveCount(3);expect(await article().innerHTML()).not.toContain('user-content-user-content-');await expect(article()).not.toContainText('Esta nota nunca fue usada.')
 for(const back of await backs.all())expect(await back.getAttribute('aria-label')).toMatch(/^Volver a la referencia \d/)
 const href=await refs.first().getAttribute('href');expect(href).toBeTruthy();await refs.first().click();await expect(article().locator(`[id="${href!.slice(1)}"]`)).toBeFocused()
 const backHref=await backs.first().getAttribute('href');await backs.first().click();await expect(article().locator(`[id="${backHref!.slice(1)}"]`)).toBeFocused()
 const count=await invariant(page,'.preview article','invariante-c-vista');expect(count.links).toBe(6)
 await screenshots('c')
 const view=await standalone(await exportFile('html'))
 try{
  await invariant(view,'body','invariante-c-html-autonomo')
  const forward=view.locator('a[href]').filter({hasText:'1'}).first(),forwardHref=await forward.getAttribute('href');expect(forwardHref).toBeTruthy();await forward.click();await expect(view.locator(':target')).toHaveAttribute('id',forwardHref!.slice(1))
  const back=view.locator('a[aria-label^="Volver a la referencia"]').first(),backTarget=await back.getAttribute('href');expect(backTarget).toBeTruthy();await back.click();await expect(view.locator(':target')).toHaveAttribute('id',backTarget!.slice(1))
  await expect(view.getByRole('heading',{name:'Notas al pie',exact:true})).toBeVisible()
 }finally{await view.close()}
 await intact(source)
})

test('D: plegables nativos con Markdown, tres niveles y teclado; HTML conserva open y PDF incluye el contenido cerrado',async()=>{
 const source='---\nprivado: PROPIEDAD_PRIVADA_MD002_D\n---\n\n# Plegables\n\n[Ir al contenido oculto](#encabezado-oculto)\n\n<details><summary>Guía exterior</summary>\n\n## Encabezado oculto\n\nContenido exterior de prueba.\n\n| Clave | Valor |\n| --- | --- |\n| dato | conservado |\n\n<details open><summary>Nivel dos</summary>\n\nContenido intermedio único.\n\n<details><summary>Nivel tres</summary>\n\nContenido profundo oculto.\n\n</details>\n\n</details>\n\n```python\nprint("código conservado")\n```\n\n</details>\n\n- Elemento\n\n  <details><summary>En lista</summary>\n\n  **Contenido en lista.**\n\n  </details>\n\n> <details><summary>En cita</summary>\n>\n> Contenido en cita.\n>\n> </details>\n'
 await open(source)
 const details=article().locator('details'),outer=details.filter({has:page.locator(':scope > summary',{hasText:'Guía exterior'})}).first()
 await expect(details).toHaveCount(5);await expect(outer).not.toHaveAttribute('open','')
 const states=await details.evaluateAll(nodes=>nodes.map(node=>node.hasAttribute('open')));expect(states).toEqual([false,true,false,false,false])
 const htmlPath=await exportFile('html'),view=await standalone(htmlPath)
 try{
  await expect(view.locator('details')).toHaveCount(5);expect(await view.locator('details').evaluateAll(nodes=>nodes.map(node=>node.hasAttribute('open')))).toEqual(states)
  await invariant(view,'body','invariante-d-html-autonomo')
  await view.locator('summary').filter({hasText:'Guía exterior'}).first().click();await expect(view.getByRole('heading',{name:'Encabezado oculto',exact:true})).toBeVisible()
 }finally{await view.close()}
 const text=await pdfText(await exportFile('pdf'))
 for(const content of ['Contenido exterior de prueba.','Contenido intermedio único.','Contenido profundo oculto.','Contenido en lista.','Contenido en cita.'])expect(text).toContain(content)
 expect(text).not.toContain('PROPIEDAD_PRIVADA_MD002_D');expect(await details.evaluateAll(nodes=>nodes.map(node=>node.hasAttribute('open')))).toEqual(states)
 const summary=outer.locator(':scope > summary');await summary.focus();await page.keyboard.press('Enter');await expect(outer).toHaveAttribute('open','')
 await expect(outer.locator('table')).toContainText('conservado');await expect(outer.locator('code.language-python')).toContainText('print("código conservado")')
 await summary.focus();await page.keyboard.press('Space');await expect(outer).not.toHaveAttribute('open','')
 await article().getByRole('link',{name:'Ir al contenido oculto',exact:true}).click();await expect(article().locator('#heading-encabezado-oculto')).toBeFocused();await expect(outer).toHaveAttribute('open','')
 const third=article().locator('details').filter({has:page.locator(':scope > summary',{hasText:'Nivel tres'})}).first()
 await third.locator(':scope > summary').focus();await page.keyboard.press('Space');await expect(third).toHaveAttribute('open','');await expect(third).toContainText('Contenido profundo oculto.')
 await article().locator('summary').filter({hasText:'Nivel dos'}).first().click()
 const uiStates=await details.evaluateAll(nodes=>nodes.map(node=>node.hasAttribute('open')));expect(uiStates).toEqual([true,false,true,false,false])
 const exported=await readFile(await exportFile('html'),'utf8')
 const exportedStates=await page.evaluate(html=>Array.from(new DOMParser().parseFromString(html,'text/html').querySelectorAll('details'),node=>node.hasAttribute('open')),exported)
 expect(exportedStates).toEqual(states);expect(exported).not.toContain('data-freya-open')
 expect(await details.evaluateAll(nodes=>nodes.map(node=>node.hasAttribute('open')))).toEqual(uiStates)
 const afterToggle=await pdfText(await exportFile('pdf'))
 for(const content of ['Contenido exterior de prueba.','Contenido intermedio único.','Contenido profundo oculto.','Contenido en lista.','Contenido en cita.'])expect(afterToggle).toContain(content)
 expect(afterToggle).not.toContain('PROPIEDAD_PRIVADA_MD002_D');expect(await details.evaluateAll(nodes=>nodes.map(node=>node.hasAttribute('open')))).toEqual(uiStates)
 await screenshots('d',async()=>{
  const close=page.getByRole('button',{name:'Cerrar aviso',exact:true});if(await close.isVisible())await close.click()
  for(const label of ['Guía exterior','Nivel dos','Nivel tres']){
   const summary=article().locator('summary').filter({hasText:label}).first(),details=summary.locator('..')
   if(!await details.evaluate(node=>(node as HTMLDetailsElement).open))await summary.click()
   await expect(details).toHaveAttribute('open','')
  }
 })
 await intact(source)
})

