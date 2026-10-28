import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,folder:string

test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-preview-edit-'));await mkdir(join(folder,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

const preview=()=>page.locator('.preview')
const article=()=>preview().locator('article.markdown-body')
const mode=(name:string)=>page.getByRole('group',{name:'Modo de edición',exact:true}).getByRole('button',{name,exact:true})
const current=(id:string)=>page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),id)
async function open(text:string,name:string){
 const path=join(folder,name);await writeFile(path,text)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true')
 await expect(page.locator('.cm-content .cm-line').first()).toHaveText(text.split(/\r?\n/)[0])
 return{path,doc}
}
async function replace(id:string,text:string){
 await page.locator('.cm-content').click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(text)
 await expect.poll(async()=>(await current(id))?.text).toBe(text)
}
async function settled(){await expect(preview().locator('.render-progress')).toHaveCount(0)}
async function exportHTML(expectedText:string){
 await page.getByRole('button',{name:'Exportar',exact:true}).click();await page.getByRole('button',{name:'HTML autónomo',exact:true}).click()
 const toast=page.locator('.toast');await expect(toast).toContainText('Exportado:');await expect(toast).toContainText('1 imagen no se encontró')
 const output=(await readdir(join(folder,'exports'))).find(name=>name.endsWith('.html'));expect(output).toBeTruthy()
 const html=await readFile(join(folder,'exports',output!),'utf8');expect(html).toContain(expectedText)
 await toast.getByRole('button',{name:'Cerrar aviso'}).click();await expect(toast).toHaveCount(0)
 return html
}

test('abrir un segundo Markdown en Editar no renderiza el article oculto; Dividido y Vista previa sí lo muestran',async()=>{
 const first=await open('# Primero\n\nDocumento inicial.\n','primero.md')
 await expect(article().getByRole('heading',{name:'Primero',exact:true})).toBeVisible();await settled();await mode('Editar').click()
 const text='# Segundo\n\nSolo se prepara cuando se muestra.\n',second=await open(text,'segundo.md')
 await expect(preview()).toBeHidden();await settled()
 // Se espera el estado del render, no una duración: la implementación anterior termina publicando el segundo documento oculto.
 await expect(article()).toBeEmpty()
 await mode('Dividido').click();await expect(article().getByRole('heading',{name:'Segundo',exact:true})).toBeVisible();await settled()
 await mode('Vista previa').click();await expect(article()).toContainText('Solo se prepara cuando se muestra.');await expect(page.locator('.cm-content')).toHaveCount(0)
 expect(await current(second.doc.id)).toMatchObject({text,dirty:false});expect(await readFile(second.path,'utf8')).toBe(text)
 expect(await readFile(first.path,'utf8')).toBe('# Primero\n\nDocumento inicial.\n')
})

test('editar con la vista previa oculta conserva su article y al mostrarla usa la fuente nueva',async()=>{
 const initial='# Documento\n\nPárrafo inicial.\n',{path,doc}=await open(initial,'edicion.md')
 await expect(article().getByRole('heading',{name:'Documento',exact:true})).toBeVisible();await settled();await mode('Editar').click();await settled()
 const before=await article().innerHTML(),updated='# Documento actualizado\n\nPárrafo cambiado en Editar.\n'
 await replace(doc.id,updated);await settled()
 await expect(preview()).toBeHidden();expect(await article().innerHTML()).toBe(before)
 expect(await current(doc.id)).toMatchObject({text:updated,dirty:true});expect(await readFile(path,'utf8')).toBe(initial)
 await mode('Vista previa').click();await expect(article().getByRole('heading',{name:'Documento actualizado',exact:true})).toBeVisible();await settled()
 await expect(article()).toContainText('Párrafo cambiado en Editar.');await expect(article()).not.toContainText('Párrafo inicial.')
 expect(await current(doc.id)).toMatchObject({text:updated,dirty:true});expect(await readFile(path,'utf8')).toBe(initial)
})

test('exportar HTML desde Editar prepara la fuente actual, Mermaid e imágenes sin activar el render oculto permanente',async()=>{
 await open('# Preparación\n','preparacion.md');await expect(article().getByRole('heading',{name:'Preparación',exact:true})).toBeVisible();await settled();await mode('Editar').click()
 await writeFile(join(folder,'imagen.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6X8sAAAAASUVORK5CYII=','base64'))
 const initial='# Informe\n\nTexto inicial.\n\n![Miniatura](imagen.png)\n\n![Ausente](no-existe.png)\n\n```mermaid\nflowchart LR\n A[Inicio] --> B[Fin]\n```\n',{path,doc}=await open(initial,'informe.md')
 const updated=initial.replace('Texto inicial.','Texto actualizado desde Editar.')
 await replace(doc.id,updated);await expect(preview()).toBeHidden()
 const beforeExport=await current(doc.id),html=await exportHTML('Texto actualizado desde Editar.')
 expect(html).toContain('<svg');expect(html).toContain('Inicio');expect(html).toContain('data:image/png');expect(html).toContain('Imagen no disponible: Ausente');expect(html).not.toContain('Preparando diagrama');expect(html).not.toContain(folder)
 await expect(preview()).toBeHidden();expect(await current(doc.id)).toEqual(beforeExport);expect(await readFile(path,'utf8')).toBe(initial)
 await settled();const rendered=await article().innerHTML(),last=updated+'\nNota posterior a exportación.\n'
 await replace(doc.id,last);await settled()
 expect(await article().innerHTML()).toBe(rendered) // El permiso temporal para exportar se cerró y no vuelve a analizar al escribir.
 const lastExport=await exportHTML('Nota posterior a exportación.')
 expect(lastExport).toContain('data:image/png');expect(lastExport).toContain('<svg');expect(lastExport).toContain('Imagen no disponible: Ausente')
 await expect(preview()).toBeHidden();expect(await current(doc.id)).toMatchObject({text:last,dirty:true});expect(await readFile(path,'utf8')).toBe(initial)
})
