import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,folder:string,file:string,original:string
const panel=()=>page.locator('.charts-panel')
async function assign(field:string,zone:string){
 await panel().locator('.field-list').getByRole('button',{name:new RegExp(`^(Añadir|Mover) a… ${field}$`)}).click()
 await page.getByRole('menuitem',{name:new RegExp(`^Añadir a ${zone}(?: |$)`)}).click()
}
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-review-'));file=join(folder,'clientes.csv')
 original='Cliente,Ventas,Descuento,Canal,Fecha,Coste,Estado,Notas\n'+Array.from({length:842},(_,i)=>`C${i},${100+i*3},${(i%5+1)*10}%,${i%2?'Web':'Tienda'},2026-01-01,285600,Activo,Nota ${i}`).join('\n')+'\n'
 await writeFile(file,original)
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1280,height:720})
 await page.evaluate(file=>window.freya.openPaths([file]),file)
 await page.locator('[data-csv-view]').getByRole('button',{name:'Resumen y gráfico',exact:true}).click()
 await expect(panel().locator('.pivot-result')).toBeVisible()
 await assign('Cliente','Filas');await assign('Ventas','Valores')
 await expect(panel().locator('.pivot-result tfoot td').first()).toHaveText('1,146,383')
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true})})

test('Revisión108 · truncado conserva cien barras en su orden y un solo aviso sin Top10',async()=>{
 for(const [width,height] of [[1280,720],[1440,900]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.getByLabel('Tema',{exact:true}).selectOption(theme);await page.mouse.move(0,0)
  await page.screenshot({path:test.info().outputPath(`${process.env.FREYALAB_REVIEW_PHASE||'after'}-${theme}-${width}x${height}.png`)})
 }
 const notice=panel().locator('.truncated')
 await expect(notice).toContainText('Se muestran los primeros 100 de 842 grupos, en el orden elegido.')
 await expect(notice).not.toContainText('mayores');await expect(panel().locator('.top-notice')).toHaveCount(0)
 const bars=await panel().locator('.plot').evaluate(node=>node.querySelectorAll(`svg path[fill="${getComputedStyle(node).getPropertyValue('--accent').trim()}"]`).length)
 expect(bars).toBe(100)
 const categories=(await panel().locator('.plot svg text').allTextContents()).filter(text=>/^C\d+$/.test(text))
 expect(categories[0]).toBe('C0');expect(categories).not.toContain('C841')
 await expect(panel().locator('.pivot-result tbody td').last()).not.toHaveText('0%')
 expect(await readFile(file,'utf8')).toBe(original)
})

test('Revisión108 · motivo con línea propia y sin solapes a1280×720',async()=>{
 const boxes=await panel().evaluate(node=>Object.fromEntries(['.chart-types','.suggestion','.plot-scroll','.truncated'].map(selector=>{const b=node.querySelector(selector)!.getBoundingClientRect();return[selector,{top:b.top,bottom:b.bottom,height:b.height}]})))
 await writeFile(test.info().outputPath('geometry.json'),JSON.stringify(boxes,null,2))
 expect(boxes['.suggestion'].height).toBeGreaterThanOrEqual(16)
 expect(boxes['.suggestion'].top).toBeGreaterThanOrEqual(boxes['.chart-types'].bottom)
 expect(boxes['.suggestion'].bottom).toBeLessThanOrEqual(boxes['.plot-scroll'].top)
 expect(boxes['.truncated'].bottom).toBeLessThanOrEqual(boxes['.chart-types'].top)
})

test('Revisión108 · seis campos y acciones fijas visibles a1280×720',async()=>{
 const fields=panel().getByRole('complementary');await fields.locator('.field-list').evaluate(node=>node.scrollTop=0)
 const visible=await fields.locator('.field-list').evaluate(node=>{const area=node.getBoundingClientRect();return[...node.querySelectorAll('.field-entry')].filter(row=>{const r=row.getBoundingClientRect();return r.top>=area.top&&r.bottom<=area.bottom}).length})
 expect(visible).toBeGreaterThanOrEqual(6)
 await writeFile(test.info().outputPath('fields-visible.json'),JSON.stringify({visible}))
 await expect(fields.getByRole('button',{name:'Intercambiar filas y columnas',exact:true})).toBeInViewport({ratio:1})
 await expect(fields.getByRole('button',{name:'Limpiar todo',exact:true})).toBeInViewport({ratio:1})
 await fields.locator('.field-list').evaluate(node=>node.scrollTop=node.scrollHeight)
 await expect(fields.getByRole('button',{name:'Intercambiar filas y columnas',exact:true})).toBeInViewport({ratio:1})
 await expect(fields.getByRole('button',{name:'Limpiar todo',exact:true})).toBeInViewport({ratio:1})
 for(const zone of ['Filas','Columnas','Valores','Filtros'])await expect(fields.getByRole('region',{name:zone,exact:true})).toBeInViewport({ratio:1})
})

test('Revisión108 · cambiar una zona no atribuye una elección de tipo al usuario',async()=>{
 await assign('Descuento','Valores')
 await expect(panel().getByLabel('Resumir Descuento por',{exact:true})).toHaveValue('count')
 await expect(panel().locator('.suggestion')).not.toContainText('Elegiste')
 await expect(panel().locator('.field-badge.amount').first()).toHaveAttribute('title','Parece un monto o un porcentaje')
 await panel().locator('.chart-types').getByRole('button',{name:'Mapa de calor',exact:true}).click()
 await panel().locator('.chart-types').getByRole('button',{name:'Barras',exact:true}).click()
 await expect(panel().locator('.suggestion')).toContainText('Elegiste Barras.')
 await assign('Ventas','Valores');await expect(panel().locator('.suggestion')).not.toContainText('Elegiste')
 expect(await readFile(file,'utf8')).toBe(original)
})

test('Revisión108 · tabla, total, marcas y eje conservan el formato numérico al cambiar campo e idioma',async()=>{
 await assign('Coste','Valores');await assign('Cliente','Filtros')
 const filters=panel().getByRole('region',{name:'Filtros del gráfico',exact:true})
 await filters.getByLabel('Operador de condición 1',{exact:true}).selectOption('equals')
 await filters.getByLabel('Valor de condición 1',{exact:true}).fill('C0')
 await filters.getByRole('button',{name:'Aplicar filtros del gráfico',exact:true}).click()
 await expect(panel().locator('.pivot-result tfoot td').first()).toHaveText('285,600')
 await expect(panel().locator('.plot svg text').filter({hasText:/^285,600$/})).toHaveCount(1)
 await expect(panel().locator('.plot svg text').filter({hasText:/^300,000$/})).toHaveCount(1)
 for(const language of ['en','es']){
  await page.evaluate(language=>window.freya.setLanguage(language as 'es'|'en'),language)
  await expect(panel().locator('.pivot-result tbody td').first()).toHaveText('285,600')
  await expect(panel().locator('.pivot-result tfoot td').first()).toHaveText('285,600')
  await expect(panel().locator('.plot svg text').filter({hasText:/^285,600$/})).toHaveCount(1)
  await expect(panel().locator('.plot svg text').filter({hasText:/^300,000$/})).toHaveCount(1)
 }
 await assign('Ventas','Valores');await expect(panel().locator('.pivot-result tfoot td').first()).toHaveText('100')
 await assign('Coste','Valores');await expect(panel().locator('.pivot-result tfoot td').first()).toHaveText('285,600')
 await expect(panel().locator('.plot svg text').filter({hasText:/^285,600$/})).toHaveCount(1)
 expect(await readFile(file,'utf8')).toBe(original)
})
