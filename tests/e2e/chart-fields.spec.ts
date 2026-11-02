import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
let app:ElectronApplication,page:Page,folder:string,path:string
const original='Región,Canal,Ventas,Fecha,Descuento\nNorte,Web,1200,2026-01-01,10%\nNorte,Tienda,800,2026-01-15,10%\nCentro,Web,1600,2026-02-01,10%\nCentro,Tienda,900,2026-02-15,10%\nSur,Web,900,2026-03-01,10%\nSur,Tienda,600,2026-03-15,10%\nOeste,Web,700,2026-04-01,10%\nOeste,Tienda,500,2026-04-15,10%\n'
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-fields-'));path=join(folder,'ventas.csv');await writeFile(path,original);await mkdir(join(folder,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')}})
 page=await app.firstWindow();page.on('pageerror',error=>console.log('PAGE_ERROR',String(error)));await page.waitForFunction(()=>!!window.freya);await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1280,height:720});await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('tab',{name:'ventas.csv',exact:true})).toHaveAttribute('aria-selected','true')
 await page.locator('[data-csv-view]').getByRole('button',{name:'Resumen y gráfico',exact:true}).click()
})
test('F2b: herramientas con nombre, ayuda inmediata al foco y controles sin pintura nativa',async()=>{
 const toolbar=page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true})
 const statistics=toolbar.getByRole('button',{name:'Estadísticas y SQL',exact:true})
 await expect(statistics).toBeVisible();await statistics.focus()
 expect(await statistics.evaluate(node=>getComputedStyle(node,'::after').content)).toContain('estadísticas')
 await expect(page.locator('.charts-panel .pivot-result')).toBeVisible()
 for(const control of await page.locator('.charts-panel .chart-types button,.chart-fields button').all()){
  const style=await control.evaluate(node=>{const s=getComputedStyle(node);return{appearance:s.appearance,color:s.color,background:s.backgroundColor,opacity:s.opacity}});expect(style.appearance).toBe('none')
 }
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true})})
test('F2b: sugerencia inicial y dos acciones cambian qué se grafica sin Más opciones',async()=>{
 const panel=page.locator('.charts-panel')
 await expect(panel.locator('.pivot-result')).toBeVisible()
 for(const [width,height] of [[1440,900],[1280,720]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.getByLabel('Tema',{exact:true}).selectOption(theme)
  await page.screenshot({path:test.info().outputPath(`layout-${theme}-${width}x${height}.png`)})
 }
 await expect(panel.locator('.pivot-result tfoot')).toContainText('7,200')
 const fields=panel.getByRole('complementary',{name:'Campos y zonas',exact:true})
 await fields.getByRole('button',{name:'Añadir a… Fecha',exact:true}).click()
 await panel.getByRole('menuitem',{name:'Añadir a Filas (recomendado)',exact:true}).click()
 await expect(panel.locator('.chart-types button[aria-pressed=true]')).toContainText('Líneas')
 await expect(panel.locator('.pivot-result tbody tr')).toHaveCount(4)
 await expect(panel.locator('.pivot-result tbody tr').first()).toContainText('2026-01')
 await expect(panel.locator('.pivot-result tfoot')).toContainText('7,200')
 expect(await readFile(path,'utf8')).toBe(original)
})
test('F2b: teclado, búsqueda sin acentos, foco del menú y anuncios de acciones',async()=>{
 const panel=page.locator('.charts-panel'),fields=panel.getByRole('complementary',{name:'Campos y zonas',exact:true}),live=panel.locator('.chart-result>.analysis-announcement')
 await expect(panel.locator('.pivot-result')).toBeVisible()
 const search=fields.getByRole('searchbox');await search.focus();await page.keyboard.type('region');await expect(fields.getByRole('listitem')).toHaveCount(1);await expect(live).toHaveText('1 campos')
 await search.fill('');await page.keyboard.press('Tab');await expect(fields.getByRole('listitem').first()).toBeFocused()
 await page.keyboard.press('Enter');await expect(panel.getByRole('menuitem').first()).toBeFocused();await page.keyboard.press('End');await page.keyboard.press('Home');await page.keyboard.press('Escape')
 await expect(fields.getByRole('button',{name:'Mover a… Región',exact:true})).toBeFocused()
 const channel=fields.getByRole('button',{name:'Añadir a… Canal',exact:true});await channel.focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter')
 await expect(fields.getByRole('region',{name:'Columnas',exact:true})).toContainText('Canal');await expect(fields.getByRole('button',{name:'Mover a… Canal',exact:true})).toBeFocused()
 await expect(panel.locator('.pivot-result tfoot')).toContainText('7,200')
 await fields.getByRole('button',{name:'Intercambiar filas y columnas',exact:true}).focus();await page.keyboard.press('Enter');await expect(fields.getByRole('region',{name:'Filas',exact:true})).toContainText('Canal');await expect(live).toHaveText('Filas y columnas intercambiadas')
 await fields.getByRole('button',{name:'Limpiar todo',exact:true}).focus();await page.keyboard.press('Enter');await expect(live).toHaveText('Análisis limpiado');await expect(panel.getByRole('button',{name:'Empezar con una sugerencia',exact:true})).toBeVisible()
 await page.screenshot({path:test.info().outputPath('state-empty.png')});await panel.getByRole('button',{name:'Empezar con una sugerencia',exact:true}).focus();await page.keyboard.press('Enter');await expect(panel.locator('.pivot-result tfoot')).toContainText('7,200')
 expect(await readFile(path,'utf8')).toBe(original)
})
test('F2b: cada Resumir por coincide con datos independientes y porcentajes solo aditivos',async()=>{
 const panel=page.locator('.charts-panel');await expect(panel.locator('.pivot-result')).toBeVisible()
 const select=panel.getByLabel('Resumir Ventas por',{exact:true})
 for(const [aggregate,total] of [['sum','7,200'],['count','8'],['distinct','7'],['average','900'],['min','500'],['max','1,600'],['median','850']]){
  await select.selectOption(aggregate);await expect(panel.locator('.pivot-result tfoot td').first()).toHaveText(total)
  await expect(panel.locator('.pivot-result thead')).toContainText(aggregate==='count'||aggregate==='sum'?'% del total':'Región')
  if(!['sum','count'].includes(aggregate)){await expect(panel.locator('.pivot-result thead')).not.toContainText('% del total');await expect(panel.locator('.pivot-result tfoot')).toContainText('Total (recalculado)')}
 }
 await panel.locator('.chart-types').getByRole('button',{name:'Histograma',exact:true}).click();await expect(panel.locator('.pivot-result')).toBeVisible();await expect(panel.locator('.chart-types button[aria-pressed=true]')).toHaveText('Histograma')
 expect(await readFile(path,'utf8')).toBe(original)
})
test('F2b: texto no se suma, mapa solo cuenta y símbolos no se convierten',async()=>{
 const panel=page.locator('.charts-panel');await expect(panel.locator('.pivot-result')).toBeVisible()
 await panel.getByRole('button',{name:'Añadir a… Descuento',exact:true}).click();await panel.getByRole('menuitem',{name:'Añadir a Valores',exact:true}).click()
 const aggregate=panel.getByLabel('Resumir Descuento por',{exact:true});await expect(aggregate).toHaveValue('count');await expect(aggregate.locator('option[value=sum]')).toBeDisabled();await expect(aggregate.locator('option[value=distinct]')).toBeEnabled()
 await panel.getByRole('button',{name:'Usar como número…',exact:true}).first().click();await expect(panel.getByRole('region',{name:'Usar como número…',exact:true})).toContainText('Todavía no se pueden convertir símbolos como $ o %. El archivo no cambia.');await panel.getByRole('button',{name:'Cerrar',exact:true}).click()
 await panel.locator('.chart-types').getByRole('button',{name:'Mapa de calor',exact:true}).click();const heat=panel.getByLabel('Resumir Filas del archivo por',{exact:true});await expect(heat).toHaveValue('count');for(const operation of ['sum','distinct','average','min','max','median'])await expect(heat.locator(`option[value=${operation}]`)).toBeDisabled()
 await expect(panel.getByText('El mapa de calor solo cuenta filas',{exact:true})).toBeVisible();expect(await readFile(path,'utf8')).toBe(original)
})
test('F2b: 842 grupos conservan truncado y tabla paginada; Otros solo sobre resultados completos aditivos',async()=>{
 const file=join(folder,'grupos.csv'),content='Grupo,Ventas\n'+Array.from({length:842},(_,i)=>`G${i},${i+1}`).join('\n')+'\n';await writeFile(file,content);await page.evaluate(file=>window.freya.openPaths([file]),file)
 await page.locator('[data-csv-view]').getByRole('button',{name:'Resumen y gráfico',exact:true}).click();const panel=page.locator('.charts-panel')
 await expect(panel.locator('.pivot-result')).toBeVisible();await expect(panel.locator('.truncated')).toContainText('Mostrando 100 de 842 grupos');await expect(panel.locator('.top-notice')).toContainText('10 mayores');await expect(panel.locator('.top-notice')).not.toContainText('y «Otros»')
 await expect(panel.locator('.pivot-result tbody tr')).toHaveCount(5);await panel.getByLabel('Grupos por página',{exact:true}).selectOption('50');await expect(panel.locator('.pivot-result tbody tr')).toHaveCount(50)
 await panel.locator('.pivot-pages').getByRole('button',{name:'Datos siguientes',exact:true}).click();await expect(panel.locator('.pivot-result tbody tr')).toHaveCount(50)
 await page.screenshot({path:test.info().outputPath('state-842-groups.png')});expect(await readFile(file,'utf8')).toBe(content)
 const small=join(folder,'doce.csv');await writeFile(small,'Grupo,Ventas\n'+Array.from({length:12},(_,i)=>`G${i},${i+1}`).join('\n')+'\n');await page.evaluate(file=>window.freya.openPaths([file]),small);await page.locator('[data-csv-view]').getByRole('button',{name:'Resumen y gráfico',exact:true}).click()
 await expect(panel.locator('.top-notice')).toContainText('y «Otros»');await expect(panel.locator('.pivot-result tfoot')).toContainText('78')
 await panel.getByLabel('Resumir Ventas por',{exact:true}).selectOption('average');await expect(panel.locator('.top-notice')).not.toContainText('y «Otros»');await expect(panel.locator('.pivot-result tfoot')).toContainText('6.5')
})
test('F2b: filtros reutilizados, exportación y datos originales intactos',async()=>{
 const panel=page.locator('.charts-panel');await expect(panel.locator('.pivot-result')).toBeVisible()
 await panel.getByRole('button',{name:'Mover a… Región',exact:true}).click();await panel.getByRole('menuitem',{name:'Añadir a Filtros',exact:true}).click()
 const filters=panel.getByRole('region',{name:'Filtros del gráfico',exact:true});await filters.getByLabel('Operador de condición 1',{exact:true}).selectOption('equals');await filters.getByLabel('Valor de condición 1',{exact:true}).fill('Norte');await filters.getByRole('button',{name:'Aplicar filtros del gráfico',exact:true}).click()
 await expect(panel.locator('.pivot-result tfoot')).toContainText('2,000');await expect(panel.getByRole('region',{name:'Filtros',exact:true})).toContainText('Región')
 await expect(panel.getByRole('button',{name:'Mover a… Región',exact:true})).toBeFocused()
 await panel.locator('.more-options>summary').click();await panel.getByRole('button',{name:'Exportar gráfico SVG',exact:true}).click();await expect.poll(async()=>{try{return await readFile(join(folder,'exports','ventas.svg'),'utf8')}catch{return''}}).toContain('<svg')
 await panel.getByRole('button',{name:'Exportar gráfico PNG',exact:true}).click();await expect.poll(async()=>{try{return (await readFile(join(folder,'exports','ventas.png'))).subarray(1,4).toString()}catch{return''}}).toBe('PNG')
 await panel.getByRole('button',{name:'Exportar gráfico PDF',exact:true}).click();await expect.poll(async()=>{try{return (await readFile(join(folder,'exports','ventas.pdf'))).subarray(0,4).toString()}catch{return''}}).toBe('%PDF')
 expect(await readFile(path,'utf8')).toBe(original);expect((await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(false)
})
test('F2b: estrecho conserva foco al editar campos, inglés natural y resultado completo',async()=>{
 const panel=page.locator('.charts-panel');await expect(panel.locator('.pivot-result')).toBeVisible();await page.setViewportSize({width:800,height:720})
 await expect(panel.getByRole('complementary')).toBeHidden();await panel.getByRole('button',{name:'Campos y zonas',exact:true}).focus();await page.keyboard.press('Enter');await expect(panel.getByRole('complementary')).toBeVisible()
 await panel.getByRole('button',{name:'Añadir a… Fecha',exact:true}).focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');await expect(panel.locator('.chart-types button[aria-pressed=true]')).toHaveText('Líneas');await expect(panel.locator('.pivot-result')).toBeVisible();await expect(panel.getByRole('button',{name:'Mover a… Fecha',exact:true})).toBeFocused()
 await panel.getByRole('button',{name:'Campos y zonas',exact:true}).click();await expect(panel.getByRole('complementary')).toBeHidden();await page.screenshot({path:test.info().outputPath('state-narrow.png')})
 await page.evaluate(()=>window.freya.setLanguage('en'));await expect(panel.getByRole('button',{name:'Fields and zones',exact:true})).toBeVisible();await expect(panel.getByLabel('Chart configuration',{exact:true})).toContainText('Ventas');await page.screenshot({path:test.info().outputPath('state-en.png')})
 const result=await panel.locator('.pivot-result').boundingBox();expect(result!.y+result!.height).toBeLessThanOrEqual(720)
})
test('F2b: actualizar una celda no sustituye el resumen elegido ni guarda el CSV',async()=>{
 const panel=page.locator('.charts-panel');await expect(panel.locator('.pivot-result')).toBeVisible();await panel.getByLabel('Resumir Ventas por',{exact:true}).selectOption('average');await expect(panel.locator('.pivot-result tfoot')).toContainText('900')
 await page.locator('[data-csv-view]').getByRole('button',{name:'Tabla',exact:true}).click();await page.getByRole('gridcell').filter({hasText:'1200'}).first().dblclick();const editor=page.getByRole('textbox',{name:'Editar celda',exact:true});await editor.fill('1500');await editor.press('Enter')
 await page.locator('[data-csv-view]').getByRole('button',{name:'Resumen y gráfico',exact:true}).click();await expect(panel.getByLabel('Resumir Ventas por',{exact:true})).toHaveValue('average');await expect(panel.locator('.pivot-result tfoot')).toContainText('937.5');expect(await readFile(path,'utf8')).toBe(original)
})
test('F2b: 200 campos, nombres Unicode, idioma seudolocalizado y tamaños accesibles',async()=>{
 const file=join(folder,'campos.csv'),headers=Array.from({length:200},(_,i)=>i===198?'Crédito «México» "ñ"':'Campo '+i),content=headers.join(',').replace('Crédito «México» "ñ"','"Crédito «México» ""ñ"""')+'\n'+Array.from({length:3},()=>Array(200).fill('x').join(',')).join('\n')+'\n';await writeFile(file,content);await page.evaluate(file=>window.freya.openPaths([file]),file)
 await page.locator('[data-csv-view]').getByRole('button',{name:'Resumen y gráfico',exact:true}).click();const panel=page.locator('.charts-panel');await expect(panel.locator('.pivot-result')).toBeVisible()
 const search=panel.getByRole('searchbox');await search.fill('credito');await expect(panel.getByRole('listitem')).toHaveCount(1);await expect(panel.getByRole('listitem')).toContainText('Crédito «México» "ñ"')
 await page.screenshot({path:test.info().outputPath('state-200-fields.png')})
 await page.evaluate(()=>window.freya.setLanguage('en'));await expect(panel.getByRole('searchbox',{name:'Search fields…',exact:true})).toBeVisible();await search.fill('');await expect(panel.getByRole('listitem')).toHaveCount(200)
 const controls=await panel.locator('.chart-fields button,.chart-fields select,.chart-types button').evaluateAll(nodes=>nodes.filter(node=>!node.hasAttribute('disabled')).map(node=>{const rect=node.getBoundingClientRect();return{label:node.getAttribute('aria-label')||node.textContent,width:rect.width,height:rect.height}}));for(const box of controls){expect(box.width,box.label??'').toBeGreaterThanOrEqual(24);expect(box.height,box.label??'').toBeGreaterThanOrEqual(24)}
 expect(await readFile(file,'utf8')).toBe(content)
})
test('F2b: en-XA real, tema oscuro y ventana estrecha no recortan el resultado',async()=>{
 await app.evaluate(({app})=>app.exit(0));await app.close().catch(()=>{});const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'en-XA',FREYALAB_USER_DATA:join(folder,'xa')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1280,height:720});await page.evaluate(path=>window.freya.openPaths([path]),path);await page.locator('[data-csv-view]').getByRole('button').filter({hasText:'Sümmáry'}).click();const panel=page.locator('.charts-panel');await expect(panel.locator('.pivot-result tfoot')).toContainText('7,200')
 await page.locator('select').filter({has:page.locator('option[value=dark]')}).selectOption('dark')
 for(const [width,height] of [[1440,900],[1280,720],[800,720]]){await page.setViewportSize({width,height});const box=await panel.locator('.pivot-result').boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(height);expect(await panel.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);await page.screenshot({path:test.info().outputPath(`state-en-XA-${width}.png`)})}
 expect(await readFile(path,'utf8')).toBe(original)
})
test('F2b: contraste de textos y controles medido contra sus fondos reales en ambos temas',async()=>{
 const panel=page.locator('.charts-panel');await expect(panel.locator('.pivot-result')).toBeVisible()
 const luminance=(color:string)=>{const [r,g,b]=color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(value=>{const n=value/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b}
 for(const theme of ['light','dark']){
  await page.getByLabel('Tema',{exact:true}).selectOption(theme)
  const colors=await panel.locator('.chart-fields button,.chart-fields input,.chart-fields select,.chart-fields .field-badge,.chart-types button,.suggestion,.result-status').evaluateAll(nodes=>nodes.filter(node=>!node.hasAttribute('disabled')).map(node=>{
   const style=getComputedStyle(node),backgrounds:string[]=[];let parent:Element|null=node
   while(parent){backgrounds.push(getComputedStyle(parent).backgroundColor);parent=parent.parentElement}
   return{label:node.getAttribute('aria-label')||node.textContent,color:style.color,backgrounds,border:style.borderWidth==='0px'?null:style.borderColor}
  }))
  await writeFile(test.info().outputPath(`colors-${theme}.json`),JSON.stringify(colors,null,2))
  for(const color of colors){const background=color.backgrounds.find(value=>value!=='rgba(0, 0, 0, 0)')!;const a=luminance(color.color),b=luminance(background);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05),color.label??'').toBeGreaterThanOrEqual(4.5);if(color.border){const around=color.backgrounds.slice(1).find(value=>value!=='rgba(0, 0, 0, 0)')!,c=luminance(color.border),d=luminance(around);const border=(Math.max(c,d)+.05)/(Math.min(c,d)+.05),fill=(Math.max(b,d)+.05)/(Math.min(b,d)+.05);expect(Math.max(border,fill),color.label??'').toBeGreaterThanOrEqual(3)}}
 }
})
