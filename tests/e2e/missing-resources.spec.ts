import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import electronPath from 'electron'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
let app:ElectronApplication,page:Page,directory:string

test.beforeEach(async()=>{
 directory=await mkdtemp(join(tmpdir(),'freyalab-missing-'))
 await mkdir(join(directory,'exports'));await mkdir(join(directory,'saved'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_EXPORT_DIR:join(directory,'exports'),FREYALAB_TEST_SAVE_DIR:join(directory,'saved')},timeout:60_000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
 await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}await rm(directory,{recursive:true,force:true})})

test('una imagen local ausente no bloquea Mermaid ni la exportación y no revela rutas',async()=>{
 const missing='logo-que-no-existe.png',file=join(directory,'informe.md')
 await writeFile(file,`# Informe\n\n![Logo](${missing})\n\nTexto con **negrita**.\n\n\`\`\`mermaid\nflowchart LR\n A[Inicio] --> B[Fin]\n\`\`\`\n`)
 await page.evaluate(path=>window.freya.openPaths([path]),file)
 await expect(page.locator('.markdown-body .mermaid-render svg')).toBeVisible({timeout:40_000})
 await expect(page.locator('.markdown-body strong')).toHaveText('negrita')
 await expect(page.locator('.markdown-body img')).toHaveAttribute('alt','Imagen no disponible: Logo')
 await expect(page.locator('.toast')).toHaveCount(0)
 for(const [name,extension] of [['HTML autónomo','html'],['Documento PDF','pdf']] as const){
  await page.getByRole('button',{name:'⇧ Exportar ▾',exact:true}).click();await page.getByRole('button',{name,exact:true}).click()
  const toast=page.locator('.toast');await expect(toast).toContainText('Exportado:',{timeout:30_000});await expect(toast).toContainText('1 imagen no se encontró')
  const text=await toast.innerText();for(const forbidden of ['ENOENT','realpath','Error invoking',join(directory,missing),missing])expect(text).not.toContain(forbidden)
  await toast.getByRole('button',{name:'Cerrar aviso'}).click()
  const output=(await readdir(join(directory,'exports'))).find(entry=>entry.endsWith(`.${extension}`));expect(output).toBeTruthy()
  const bytes=await readFile(join(directory,'exports',output!))
  if(extension==='html'){const html=bytes.toString('utf8');expect(html).toContain('<svg');expect(html).toContain('Imagen no disponible: Logo');expect(html).not.toContain(directory)}
  else expect(bytes.subarray(0,5).toString('latin1')).toBe('%PDF-')
 }
})

test('un documento sin imágenes ausentes se exporta sin avisos de recursos',async()=>{
 const file=join(directory,'limpio.md');await writeFile(file,'# Limpio\n\nSolo texto.\n')
 await page.evaluate(path=>window.freya.openPaths([path]),file)
 await expect(page.getByRole('document').getByRole('heading',{name:'Limpio'})).toBeVisible()
 await page.getByRole('button',{name:'⇧ Exportar ▾',exact:true}).click();await page.getByRole('button',{name:'HTML autónomo',exact:true}).click()
 const toast=page.locator('.toast');await expect(toast).toContainText('Exportado:',{timeout:30_000});await expect(toast).not.toContainText('imagen')
})
