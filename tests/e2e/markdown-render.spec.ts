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

