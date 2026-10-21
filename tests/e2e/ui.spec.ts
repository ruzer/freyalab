import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import electronPath from 'electron'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
let app:ElectronApplication,page:Page,directory:string

test.beforeEach(async()=>{
 directory=await mkdtemp(join(tmpdir(),'freyalab-ui-'))
 await mkdir(join(directory,'exports'));await mkdir(join(directory,'saved'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_EXPORT_DIR:join(directory,'exports'),FREYALAB_TEST_SAVE_DIR:join(directory,'saved')},timeout:60_000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
 await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}await rm(directory,{recursive:true,force:true})})
async function replaceEditor(text:string){const editor=page.locator('.cm-content');await editor.click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.insertText(text)}

test('interfaz: crear, editar, visualizar, guardar y exportar Markdown en ambos temas',async()=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 await expect(page.getByRole('heading',{name:'Tu siguiente idea empieza aquí.'})).toBeVisible()
 await page.getByRole('button',{name:'＋ Nuevo ▾',exact:true}).click()
 await page.getByRole('button',{name:'▤ Documento Markdown',exact:true}).click()
 await replaceEditor('# Guía de Freya\n\nUna idea **editable** con fórmula $x^2$.\n\n| Archivo | Estado |\n| --- | --- |\n| Guía | Lista |\n\n```mermaid\nflowchart LR\n A[Recibir] --> B[Revisar]\n```\n')
 await expect(page.locator('.markdown-body h1')).toHaveText('Guía de Freya')
 await expect(page.locator('.markdown-body .katex')).toHaveCount(1)
 await expect(page.locator('.markdown-body .mermaid-render svg')).toBeVisible({timeout:40_000})
 await page.getByRole('button',{name:'Guardar',exact:true}).click()
 await expect(page.locator('.statusbar')).toContainText('Guardado')
 const savedFiles=await readdir(join(directory,'saved'))
 expect(savedFiles.length).toBe(1)
 expect(await readFile(join(directory,'saved',savedFiles[0]),'utf8')).toContain('Guía de Freya')
 for(const theme of ['dark','light']){
  await page.getByLabel('Tema',{exact:true}).selectOption(theme)
  await expect(page.locator('.markdown-body .mermaid-render svg')).toBeVisible()
  await expect(page.locator('.render-progress')).toHaveCount(0)
  await page.screenshot({path:test.info().outputPath(`markdown-${theme}-1440x900.png`)})
 }
 await page.getByRole('button',{name:'⇧ Exportar ▾',exact:true}).click()
 await page.getByRole('button',{name:'HTML autónomo',exact:true}).click()
 await expect(page.locator('.toast')).toContainText('Exportado:',{timeout:30_000})
 const exportedFiles=await readdir(join(directory,'exports'));const html=await readFile(join(directory,'exports',exportedFiles.find(name=>name.endsWith('.html'))!),'utf8')
 expect(html).toContain('<svg');expect(html).toContain('katex');expect(html).not.toContain('<script')
 await page.setViewportSize({width:1280,height:800});await page.screenshot({path:test.info().outputPath('markdown-light-1280x800.png')})
 expect(errors).toEqual([])
})

test('interfaz CSV: buscar, editar una fila filtrada, deshacer y guardar',async()=>{
 const path=join(directory,'inventario.csv')
 await writeFile(path,'Código,Artículo,Existencias\n'+Array.from({length:5000},(_,i)=>`${String(i).padStart(6,'0')},Artículo ${i},${i%100}`).join('\n'))
 await page.evaluate(async path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('grid',{name:'Tabla de datos'})).toBeVisible()
 await expect(page.getByRole('gridcell',{name:'Fila 1, Código',exact:true})).toContainText('000000')
 await page.getByRole('grid',{name:'Tabla de datos'}).evaluate(element=>element.scrollTop=48_000)
 await expect(page.getByRole('gridcell',{name:'Fila 1501, Código',exact:true})).toContainText('001500')
 await page.getByLabel('Buscar en tabla',{exact:true}).fill('000123')
 await expect(page.locator('.csv-toolbar')).toContainText(/1 de 5[,.]000 filas/)
 const cell=page.getByRole('gridcell',{name:'Fila 1, Existencias',exact:true})
 await cell.dblclick();await page.getByLabel('Editar celda',{exact:true}).fill('42');await page.getByLabel('Editar celda',{exact:true}).press('Enter')
 await expect(cell).toContainText('42')
 await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(cell).toContainText('23')
 await page.getByRole('button',{name:'Rehacer',exact:true}).click();await expect(cell).toContainText('42')
 await page.getByRole('button',{name:'☷ Filtros',exact:true}).click()
 await page.getByLabel('Filtrar Artículo',{exact:true}).fill('No existe')
 await expect(page.locator('.csv-toolbar')).toContainText(/0 de 5[,.]000 filas/)
 await page.getByLabel('Filtrar Artículo',{exact:true}).fill('Artículo 123')
 await expect(cell).toContainText('42')
 await page.getByRole('button',{name:'Guardar',exact:true}).click()
 await expect(page.locator('.statusbar')).toContainText('Guardado')
 expect(await readFile(path,'utf8')).toContain('000123,Artículo 123,42')
 await page.screenshot({path:test.info().outputPath('csv-edicion-1440x900.png')})
})

test('interfaz Mermaid: renderizar y exportar SVG válido',async()=>{
 await page.getByRole('button',{name:'＋ Nuevo ▾',exact:true}).click()
 await page.getByRole('button',{name:'◇ Diagrama Mermaid',exact:true}).click()
 await replaceEditor('flowchart LR\n A[Recibir archivo] --> B[Revisar]\n B --> C[Exportar]')
 await expect(page.locator('.diagram-svg svg')).toBeVisible({timeout:40_000})
 await page.getByRole('button',{name:'Acercar',exact:true}).click()
 await expect(page.locator('.diagram-toolbar')).toContainText('110%')
 await page.getByRole('button',{name:'⇧ Exportar ▾',exact:true}).click()
 await page.getByRole('button',{name:'Imagen SVG',exact:true}).click()
 await expect(page.locator('.toast')).toContainText('Exportado:')
 const files=await readdir(join(directory,'exports'));expect(await readFile(join(directory,'exports',files.find(name=>name.endsWith('.svg'))!),'utf8')).toMatch(/Recibir[\s\S]*archivo/)
 await page.screenshot({path:test.info().outputPath('mermaid-1440x900.png')})
})


test('formato Markdown: negritas y cursivas sin ocultar el explorador',async()=>{
 await page.getByRole('button',{name:'＋ Nuevo ▾',exact:true}).click()
 await page.getByRole('button',{name:'▤ Documento Markdown',exact:true}).click()
 await replaceEditor('Freya')
 await page.keyboard.press('ControlOrMeta+A')
 await page.keyboard.press('ControlOrMeta+B')
 await expect(page.locator('.cm-content')).toHaveText('**Freya**')
 await expect(page.locator('.markdown-body strong')).toHaveText('Freya')
 await expect(page.getByLabel('Buscar archivo',{exact:true})).toBeVisible()
 await page.keyboard.press('ControlOrMeta+B')
 await expect(page.locator('.cm-content')).toHaveText('Freya')
 await page.keyboard.press('ControlOrMeta+I')
 await expect(page.locator('.cm-content')).toHaveText('*Freya*')
 await expect(page.locator('.markdown-body em')).toHaveText('Freya')
 await page.keyboard.press('ControlOrMeta+I')
 await expect(page.locator('.cm-content')).toHaveText('Freya')
})
