import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,directory:string,fixtures:string
const preview=()=>page.locator('.preview')
const article=()=>preview().locator('article.markdown-body')
const files=()=>page.getByRole('tabpanel',{name:'Archivos',exact:true})
const tags=()=>files().getByRole('group',{name:'Etiquetas',exact:true})
const search=()=>page.getByLabel('Buscar archivo',{exact:true})
const chip=(tag:string)=>preview().getByRole('button',{name:`Filtrar archivos por la etiqueta ${tag}`,exact:true})
const tagButton=(tag:string,count:number)=>tags().getByRole('button',{name:`${tag}, ${count} documentos`,exact:true})
const info=(id:string)=>page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),id)
const settled=()=>expect(preview().locator('.render-progress')).toHaveCount(0)
const markdown=(list:string,body='Contenido conservado.')=>`---\ntags: ${list}\n---\n\n# Documento\n\n${body}\n`

test.beforeEach(async()=>{
 directory=await mkdtemp(join(tmpdir(),'freya-md009-'));fixtures=join(directory,'files')
 await mkdir(fixtures);await mkdir(join(directory,'exports'));await mkdir(join(directory,'saved'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_FOLDER:fixtures,FREYALAB_TEST_SAVE_DIR:join(directory,'saved'),FREYALAB_TEST_EXPORT_DIR:join(directory,'exports')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

async function open(text:string,name='documento.md'){
 const path=join(fixtures,name);await writeFile(path,text)
 const[doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true')
 await expect(article().getByRole('heading',{name:'Documento',exact:true})).toBeVisible();await settled();return{path,doc}
}
async function openFolder(){await page.locator('.toolbar-left').getByRole('button',{name:'Abrir carpeta',exact:true}).click();await expect(page.locator('.folder-root')).toHaveAttribute('title',fixtures)}
async function intact(id:string,path:string,text:string){expect(await info(id)).toMatchObject({text,dirty:false});expect(await readFile(path,'utf8')).toBe(text)}
async function results(paths:string[]){
 await expect(files().locator('.file-search-status')).toHaveText(`${paths.length} archivos encontrados`)
 expect(await files().locator('.file-search-result').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('title')).sort())).toEqual([...paths].sort())
}
async function theme(value:'light'|'dark'){
 await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(value)
 if(value==='dark')await expect(page.locator('html')).toHaveClass(/dark/);else await expect(page.locator('html')).not.toHaveClass(/dark/)
 await settled()
}
async function screenshot(name:string){if(process.env.FREYALAB_TAGS_EVIDENCE_DIR){await mkdir(process.env.FREYALAB_TAGS_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:join(process.env.FREYALAB_TAGS_EVIDENCE_DIR,`md009-${name}-1440x900.png`),animations:'disabled'})}}
async function exportFile(name:string,format:'html'|'pdf'){
 await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByRole('button',{name:format==='html'?'HTML autónomo':'Documento PDF',exact:true}).click()
 const filename=`${name}.${format}`;await expect.poll(()=>readdir(join(directory,'exports'))).toContain(filename)
 return join(directory,'exports',filename)
}
async function pdfText(path:string){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),loading=getDocument({data:new Uint8Array(await readFile(path)),useSystemFonts:true})
 try{const pdf=await loading.promise,text:string[]=[];for(let index=1;index<=pdf.numPages;index++)text.push((await(await pdf.getPage(index)).getTextContent()).items.map(item=>'str'in item?item.str:'').join(' '));return text.join(' ')}finally{await loading.destroy()}
}

test('B1 E6–E8/E10: chips fuera del article, propiedades cerradas/abiertas y exportaciones sin etiquetas ni ejecución',async()=>{
 const hostile='<img src=x onerror=window.md009Executed=true>',onlyTag='solo-chip-no-exportar',text=markdown(`[${onlyTag}, "${hostile}"]`)
 await page.evaluate(()=>Reflect.set(window,'md009Executed',false));const{path,doc}=await open(text,'propiedades.md')
 const properties=preview().locator('details.document-properties'),summary=properties.locator('summary')
 for(const value of ['light','dark'] as const){
  await theme(value);if(await properties.getAttribute('open')!==null)await summary.click()
  await expect(properties).not.toHaveAttribute('open');await expect(chip(onlyTag)).toBeVisible();await expect(chip(hostile)).toBeVisible()
  await expect(chip(hostile)).toHaveText(hostile);await expect(chip(hostile)).toHaveAttribute('title',hostile);await expect(chip(hostile).locator('img,script')).toHaveCount(0)
  await expect(article().getByRole('button',{name:/Filtrar archivos por la etiqueta/})).toHaveCount(0);await screenshot(`chips-cerrados-${value}`)
  await summary.focus();await page.keyboard.press('Enter');await expect(properties).toHaveAttribute('open','');await expect(chip(onlyTag)).toBeVisible();await screenshot(`chips-abiertos-${value}`)
 }
 expect(await page.evaluate(()=>Reflect.get(window,'md009Executed'))).toBe(false)
 const html=await readFile(await exportFile('propiedades','html'),'utf8'),pdf=await pdfText(await exportFile('propiedades','pdf'))
 for(const exported of [html,pdf]){expect(exported).toContain('Contenido conservado.');expect(exported).not.toContain(onlyTag);expect(exported).not.toContain('md009Executed');expect(exported).not.toContain('Propiedades del documento');expect(exported).not.toContain('Filtrar archivos por la etiqueta')}
 await intact(doc.id,path,text);await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect.poll(async()=>(await info(doc.id))?.dirty).toBe(false);await intact(doc.id,path,text)
})

test('B3 E9/E24: sin carpeta el chip avisa y no cambia filtro, pestaña, documento ni estado guardado',async()=>{
 const text=markdown('[universidad]'),{path,doc}=await open(text)
 await search().fill('consulta previa');await page.getByRole('tab',{name:'Índice',exact:true}).click();const before=await info(doc.id)
 await chip('universidad').focus();await page.keyboard.press('Space')
 await expect(page.locator('.toast')).toContainText('Abre una carpeta para filtrar por etiqueta');await expect(page.getByRole('tab',{name:'Índice',exact:true})).toHaveAttribute('aria-selected','true')
 await expect(search()).toHaveValue('consulta previa');await expect(tags()).toHaveCount(0);expect(await info(doc.id)).toEqual(before);await intact(doc.id,path,text)
})


test('B2 E9/E12: un chip abre Archivos desde Índice oculto, enfoca la consulta y conserva una etiqueta con espacios sin duplicarla',async()=>{
 const text=markdown('["informe final", proyecto]'),{path,doc}=await open(text,'primero.md')
 await writeFile(join(fixtures,'segundo.md'),markdown('["informe final"]'));await writeFile(join(fixtures,'parecido.md'),markdown('["informe finales"]'))
 await openFolder();await page.getByRole('tab',{name:'Índice',exact:true}).click();await expect(page.getByRole('tabpanel',{name:'Índice del documento',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Mostrar u ocultar explorador',exact:true}).click();await expect(page.locator('aside.sidebar')).toHaveCount(0)
 await chip('informe final').focus();await page.keyboard.press('Enter')
 await expect(page.getByRole('tab',{name:'Archivos',exact:true})).toHaveAttribute('aria-selected','true');await expect(search()).toHaveValue('#"informe final"');await expect(search()).toBeFocused()
 await results([path,join(fixtures,'segundo.md')]);await chip('informe final').focus();await page.keyboard.press('Space');await expect(search()).toHaveValue('#"informe final"');await results([path,join(fixtures,'segundo.md')])
 await search().fill('#proy');await results([]);await search().fill('#PROYECTO');await results([path]);await intact(doc.id,path,text)
})


test('D1 E17–E20/E23/E25: recuentos por documento, acentos, orden y filtros AND accesibles en ambos temas',async()=>{
 const sources={'a.md':markdown('[Proyecto, proyecto, Árbol, "informe final"]'),'b.md':markdown('[proyecto, arbol]'),'c.md':markdown('[proyecto, 2026]'),'sub/d.md':markdown('["informe final"]')}
 await mkdir(join(fixtures,'sub'));for(const[name,text]of Object.entries(sources))await writeFile(join(fixtures,name),text)
 const{path,doc}=await open(sources['a.md'],'a.md');await openFolder()
 for(const value of ['light','dark'] as const){
  await theme(value);await expect(tags()).toBeVisible()
  await expect(tags().getByRole('button',{name:/, \d+ documentos$/})).toHaveText([/2026\s*1/,/Árbol\s*2/,/informe final\s*2/,/proyecto\s*3/])
  await tagButton('proyecto',3).focus();await page.keyboard.press('Enter');await expect(tagButton('proyecto',3)).toHaveAttribute('aria-pressed','true');await expect(search()).toHaveValue('#proyecto')
  await results(['a.md','b.md','c.md'].map(name=>join(fixtures,name)))
  await tagButton('Árbol',2).focus();await page.keyboard.press('Space');await expect(tagButton('Árbol',2)).toHaveAttribute('aria-pressed','true');await expect(search()).toHaveValue('#proyecto #Árbol');await results(['a.md','b.md'].map(name=>join(fixtures,name)));await screenshot(`lista-activa-${value}`)
  await tagButton('proyecto',3).focus();await page.keyboard.press('Enter');await expect(tagButton('proyecto',3)).toHaveAttribute('aria-pressed','false');await expect(search()).toHaveValue('#Árbol');await results(['a.md','b.md'].map(name=>join(fixtures,name)))
  await tagButton('Árbol',2).focus();await page.keyboard.press('Space');await expect(tagButton('Árbol',2)).toHaveAttribute('aria-pressed','false');await expect(search()).toHaveValue('')
 }
 await intact(doc.id,path,sources['a.md']);for(const[name,text]of Object.entries(sources))expect(await readFile(join(fixtures,name),'utf8')).toBe(text)
})

test('D2 E6/E21–E22: Actualizar relee el disco y guardar Markdown actualiza recuentos, sin usar cambios aún no guardados',async()=>{
 const original=markdown('[proyecto, temporal]'),{path,doc}=await open(original,'a.md'),other=join(fixtures,'b.md')
 await writeFile(other,markdown('[proyecto]'));await openFolder();await theme('dark');await expect(tagButton('proyecto',2)).toBeVisible();await expect(tagButton('temporal',1)).toBeVisible()
 const external=markdown('[proyecto, añadido]');await writeFile(other,external);await files().getByRole('button',{name:'Actualizar',exact:true}).click()
 await expect(tagButton('añadido',1)).toBeVisible();await expect(tagButton('proyecto',2)).toBeVisible();expect(await readFile(other,'utf8')).toBe(external);await intact(doc.id,path,original)
 const edited=markdown('[proyecto, "informe final"]');await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(edited)
 await expect.poll(async()=>(await info(doc.id))?.text).toBe(edited);await expect(chip('informe final')).toBeVisible();await expect(chip('temporal')).toHaveCount(0)
 expect((await info(doc.id))?.dirty).toBe(true);expect(await readFile(path,'utf8')).toBe(original);await expect(tagButton('temporal',1)).toBeVisible();await expect(tagButton('informe final',1)).toHaveCount(0)
 await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.locator('.toast')).toContainText('Archivo guardado');await expect.poll(async()=>(await info(doc.id))?.dirty).toBe(false)
 await expect(tagButton('temporal',1)).toHaveCount(0);await expect(tagButton('informe final',1)).toBeVisible();await expect(tagButton('proyecto',2)).toBeVisible();await intact(doc.id,path,edited);await screenshot('lista-guardada-dark')
 await rm(other);await files().getByRole('button',{name:'Actualizar',exact:true}).click();await expect(tagButton('añadido',1)).toHaveCount(0);await expect(tagButton('proyecto',1)).toBeVisible()
 const empty=markdown('[]');await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(empty)
 await expect.poll(async()=>(await info(doc.id))?.text).toBe(empty);await settled();await expect(preview().getByRole('button',{name:/Filtrar archivos por la etiqueta/})).toHaveCount(0)
 expect(await readFile(path,'utf8')).toBe(edited);await expect(tagButton('informe final',1)).toBeVisible()
})
