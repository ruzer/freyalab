import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
let app:ElectronApplication,page:Page,directory:string,path:string,id:string
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6X8sAAAAASUVORK5CYII=','base64')
const article=()=>page.locator('.preview article')
const figure=(key:string,caption:string)=>`![${caption}](a.png){#fig:${key}}`
const table='| Clave | Valor |\n| - | - |\n| 001 | 2 |\n\n: Datos *revisados* {#tbl:datos}'
const source='# Informe de prueba\n\nVéase [@fig:segunda] y [@tbl:datos].\n\n'+figure('primera','**Primer** resultado')+'\n\n'+table+'\n\n'+figure('segunda','Segundo resultado')+'\n'
test.beforeEach(async()=>{
 directory=await mkdtemp(join(tmpdir(),'freya-ac01-'));path=join(directory,'informe.md');await mkdir(join(directory,'exports'));await writeFile(join(directory,'a.png'),png)
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 // La misma prueba puede demostrar el rojo contra un build congelado, sin hooks del producto.
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[process.env.FREYALAB_AC_TEST_ENTRY??resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_EXPORT_DIR:join(directory,'exports')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})})
async function open(text:string){await writeFile(path,text);const[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);id=doc.id;await expect(page.locator('.cm-content')).toBeVisible();await expect(article()).not.toBeEmpty();await settled()}
async function settled(){await expect(page.locator('.preview .render-progress')).toHaveCount(0)}
async function state(){return page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),id)}
async function anchors(view=page){
 const result=await view.locator('article').evaluate(root=>{
  const ids=Array.from(root.querySelectorAll('[id]'),node=>node.id),known=new Set(ids)
  const refs=Array.from(root.querySelectorAll('a[href^="#"]'),node=>node.getAttribute('href')!).filter(href=>href!=='#')
  return{ids:ids.length,links:refs.length,missing:refs.filter(href=>!known.has(decodeURIComponent(href.slice(1)))),duplicates:ids.filter((id,index)=>ids.indexOf(id)!==index)}
 });expect(result.missing).toEqual([]);expect(result.duplicates).toEqual([])
 await test.info().attach('invariante-anclas',{body:Buffer.from(JSON.stringify(result)),contentType:'application/json'})
}
async function exportFile(format:'html'|'pdf'){
 await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByRole('button',{name:format==='html'?'HTML autónomo':'Documento PDF',exact:true}).click()
 const name=`informe.${format}`;await expect.poll(()=>readdir(join(directory,'exports'))).toContain(name);return join(directory,'exports',name)
}
test('AC-01 N1–N7 · pies, referencias, renumeración y HTML/PDF conservan el documento',async()=>{
 await open(source)
 await expect(article().locator('figcaption')).toHaveText(['Figura 1. Primer resultado','Tabla 1. Datos revisados','Figura 2. Segundo resultado'])
 await expect(article().locator('figcaption strong')).toHaveText('Primer');await expect(article().locator('figcaption em')).toHaveText('revisados')
 await article().getByRole('link',{name:'Figura 2',exact:true}).click();await expect(article().locator('#figure-2')).toBeFocused();await anchors()
 for(const theme of ['light','dark']){
  await page.getByLabel('Tema',{exact:true}).selectOption(theme);await settled()
  await expect(article().locator('figcaption')).toHaveCount(3)
  if(process.env.FREYALAB_AC_EVIDENCE==='1')await page.screenshot({path:`docs/evidence/ac-01-${theme}-1440x900.png`,animations:'disabled'})
 }
 const html=await readFile(await exportFile('html'),'utf8')
 expect(html).toContain('<figcaption>Figura 1.');expect(html).toContain('<figcaption>Tabla 1.');expect(html).toContain('href="#figure-2"');expect(html).not.toContain('{#fig:');expect(html).not.toContain('<script')
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),loading=getDocument({data:new Uint8Array(await readFile(await exportFile('pdf'))),useSystemFonts:true})
 try{const pdf=await loading.promise,parts:string[]=[];for(let index=1;index<=pdf.numPages;index++)parts.push((await(await pdf.getPage(index)).getTextContent()).items.map(item=>'str'in item?item.str:'').join(' '));const text=parts.join(' ').replace(/\s+/g,' ');expect(text).toContain('Figura 1. Primer resultado');expect(text).toContain('Tabla 1. Datos revisados');expect(text).toContain('Figura 2. Segundo resultado')}finally{await loading.destroy()}
 expect((await state())?.text).toBe(source);expect((await state())?.dirty).toBe(false);expect(await readFile(path,'utf8')).toBe(source)
 const moved=figure('segunda','Segundo resultado')+'\n\n'+figure('primera','**Primer** resultado')+'\n\n[@fig:segunda]'
 await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(moved)
 await expect(article().getByRole('link',{name:'Figura 1',exact:true})).toHaveAttribute('href','#figure-1');await expect(article().locator('figcaption')).toHaveText(['Figura 1. Segundo resultado','Figura 2. Primer resultado']);await anchors()
 await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(article().locator('figcaption')).toHaveText(['Figura 1. Primer resultado','Tabla 1. Datos revisados','Figura 2. Segundo resultado']);expect(await readFile(path,'utf8')).toBe(source)
})
test('AC-01 N2,N7 · repetidos y ausentes son comprensibles; las etiquetas hostiles no crean HTML activo',async()=>{
 const text=figure('repetido','<script>CANARIO</script>')+'\n\n'+figure('repetido','Segundo')+'\n\n[@fig:repetido] [@tbl:ausente]'
 await open(text)
 const warnings=page.getByLabel('Advertencias del documento',{exact:true})
 await expect(warnings).toBeVisible();await warnings.locator('summary').focus();await page.keyboard.press('Enter');await expect(warnings).toContainText('«fig:repetido» está repetido')
 await expect(article().locator('script,[onclick],[onerror]')).toHaveCount(0);await expect(article().getByRole('link',{name:'Figura 1',exact:true})).toHaveAttribute('href','#figure-1');await anchors()
 const missing=article().locator('.enlace-roto');await expect(missing).not.toHaveAttribute('tabindex');await missing.click();await expect(page.locator('.toast')).toContainText('tbl:ausente')
 expect((await state())?.text).toBe(text);expect(await readFile(path,'utf8')).toBe(text)
})
