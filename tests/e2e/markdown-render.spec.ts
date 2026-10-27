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
async function screenshots(block:string){
 for(const theme of ['light','dark']){
  await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme)
  if(theme==='dark')await expect(page.locator('html')).toHaveClass(/dark/);else await expect(page.locator('html')).not.toHaveClass(/dark/)
  await settled()
  if(process.env.FREYALAB_MD_EVIDENCE)await page.screenshot({path:resolve(`docs/evidence/md-002-${block}-${theme}-1440x900.png`),animations:'disabled'})
 }
}
async function exportFile(format:'html'|'pdf'){
 await page.getByRole('button',{name:'Exportar',exact:true}).click()
 await page.getByRole('button',{name:format==='html'?'HTML autónomo':'Documento PDF',exact:true}).click()
 const name=`documento.${format}`;await expect.poll(()=>readdir(join(directory,'exports')),{timeout:30_000}).toContain(name)
 return join(directory,'exports',name)
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
 await expect(article()).not.toContainText('PROPIEDAD_PRIVADA_MD002');await expect(page.locator('.outline button')).toHaveText(['Guía principal'])
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
 for(const href of ['file:///tmp/no-abras.md','javascript:alert(1)','data:text/html,<script>alert(1)</script>'])await expect(page.evaluate(href=>window.freya.openLink(href),href)).rejects.toThrow(/permiten|permitidos|enlaces/i)
 expect(await app.evaluate(()=>(globalThis as unknown as {md002Opened:string[]}).md002Opened)).toEqual(['https://example.com/guia#Parte','mailto:equipo@example.com'])
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

