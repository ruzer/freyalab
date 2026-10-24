import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import electronPath from 'electron'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {analyzeButton} from './panel'
let app:ElectronApplication,page:Page,directory:string

test.beforeEach(async()=>{
 directory=await mkdtemp(join(tmpdir(),'freyalab-icons-'))
 await mkdir(join(directory,'exports'));await mkdir(join(directory,'saved'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(directory,'profile'),FREYALAB_TEST_EXPORT_DIR:join(directory,'exports'),FREYALAB_TEST_SAVE_DIR:join(directory,'saved')},timeout:60_000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
 await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{})}await rm(directory,{recursive:true,force:true})})

// Los iconos son SVG decorativos: nunca forman parte del nombre accesible ni se leen como texto.
const audit=()=>page.evaluate(()=>{
 const controls=[...document.querySelectorAll('button,summary,[role=tab]')].filter(e=>(e as HTMLElement).offsetParent)
 return{
  glyphs:controls.map(e=>`${e.getAttribute('aria-label')??''} ${e.textContent??''}`.trim()).filter(text=>/[▥▰▱＋↶↷⋯⇧⌕☷✎▦◇▤≡☑⊞▾▸]/.test(text)),
  exposed:[...document.querySelectorAll('svg.icon')].filter(svg=>svg.getAttribute('aria-hidden')!=='true'&&!svg.getAttribute('aria-label')).length,
  icons:document.querySelectorAll('svg.icon').length,
  unnamed:controls.filter(e=>{const label=e.getAttribute('aria-label')?.trim()||e.getAttribute('title')?.trim()||(e.textContent??'').trim();return!label}).length
 }
})

test('iconos: la bienvenida, un CSV y un Markdown no usan glifos ni exponen los SVG',async()=>{
 await expect(page.getByRole('heading',{name:'Tu siguiente idea empieza aquí.'})).toBeVisible()
 let result=await audit();expect(result.icons).toBeGreaterThan(8);expect(result.glyphs).toEqual([]);expect(result.exposed).toBe(0);expect(result.unnamed).toBe(0)
 const csv=join(directory,'ventas.csv'),md=join(directory,'informe.md')
 await writeFile(csv,'Ciudad,Total\nMérida,10\nPuebla,20\n');await writeFile(md,'# Informe\n\nTexto.\n')
 await page.evaluate(paths=>window.freya.openPaths(paths),[csv,md])
 await expect(page.getByRole('tab',{name:/informe\.md/})).toBeVisible()
 result=await audit();expect(result.glyphs).toEqual([]);expect(result.exposed).toBe(0);expect(result.unnamed).toBe(0)
 await page.getByRole('tab',{name:/ventas\.csv/}).click();await expect(page.getByRole('grid')).toBeVisible()
 result=await audit();expect(result.glyphs).toEqual([]);expect(result.exposed).toBe(0);expect(result.unnamed).toBe(0)
 await expect(page.getByRole('button',{name:'Exportar',exact:true})).toBeEnabled()
 await expect(analyzeButton(page).locator('svg.icon')).toHaveCount(1)
})

test('iconos: los avisos distinguen éxito y error con icono y texto, y Exportar deshabilitado no es azul',async()=>{
 const exportButton=page.getByRole('button',{name:'Exportar',exact:true});await expect(exportButton).toBeDisabled()
 expect(await exportButton.evaluate(element=>getComputedStyle(element).backgroundColor)).not.toBe('rgb(10, 108, 240)')
 const file=join(directory,'a.md');await writeFile(file,'# A\n');await page.evaluate(path=>window.freya.openPaths([path]),file)
 await expect(page.getByRole('document').getByRole('heading',{name:'A',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Guardar',exact:true}).click()
 const toast=page.locator('.toast.info');await expect(toast).toContainText('Archivo guardado');await expect(toast.locator('svg.icon')).toHaveCount(2)
})
