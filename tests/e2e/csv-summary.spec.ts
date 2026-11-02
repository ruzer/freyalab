import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
async function chartDetails(panel:Locator){const info=panel.locator('.chart-info');if(await info.getAttribute('open')===null)await info.locator(':scope>summary').click()}
let app:ElectronApplication,page:Page,folder:string,path:string
const original='Región,Canal,Ventas,Descuento\nNorte,Web,1200,10%\nNorte,Tienda,800,10%\nCentro,Web,1600,10%\nCentro,Tienda,900,10%\nSur,Web,900,10%\nSur,Tienda,600,10%\nOeste,Web,700,10%\nOeste,Tienda,500,10%\n'
async function launch(language='es',profile='profile'){
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:language,FREYALAB_USER_DATA:join(folder,profile),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1280,height:720});await page.evaluate(path=>window.freya.openPaths([path]),path)
}
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-summary-'));path=join(folder,'ventas.csv');await writeFile(path,original);await mkdir(join(folder,'exports'))
 await launch()
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true})})
test('F2a: pestaña hermana muestra gráfico y resumen sin generar, con opciones plegadas y fuente intacta',async()=>{
 const mode=page.locator('[data-csv-view]')
 await expect(mode.getByRole('button',{name:'Tabla',exact:true})).toBeVisible()
 await expect(mode.getByRole('button',{name:'Texto',exact:true})).toBeVisible()
 await mode.getByRole('button',{name:'Resumen y gráfico',exact:true}).click()
 const panel=page.locator('.charts-panel')
 await expect(panel.locator('.plot svg path').first()).toBeAttached()
 await expect(panel.getByRole('table',{name:/Resumen/})).toBeVisible()
 await expect(panel.getByText('Más opciones',{exact:true})).toBeVisible()
 await expect(panel.getByLabel('Tipo de gráfico',{exact:true})).toBeHidden()
 const plot=await panel.locator('.plot-scroll').boundingBox(),table=await panel.locator('.pivot-result').boundingBox()
 expect(plot!.height).toBeGreaterThan(160);expect(table!.y+table!.height).toBeLessThanOrEqual(720)
 await expect(page.getByRole('button',{name:'Volver a la tabla',exact:true})).toHaveCount(0)
 await expect(panel.locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado')
 expect(await readFile(path,'utf8')).toBe(original)
 await mode.getByRole('button',{name:'Tabla',exact:true}).click();await expect(page.getByRole('grid')).toBeVisible()
})

async function summary(){await page.locator('[data-csv-view]').getByRole('button',{name:'Resumen y gráfico',exact:true}).click();const panel=page.locator('.charts-panel');await expect(panel.locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado');return panel}
async function configureSum(){const panel=await summary();await panel.locator('.more-options>summary').click();await panel.getByLabel('Columna Y del gráfico').selectOption('2');await panel.getByLabel('Tipo de medida del gráfico').selectOption('number');await panel.getByLabel('Resumen del gráfico').selectOption('sum');await panel.getByLabel('Series del gráfico').selectOption('1');await expect(panel.locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado');await panel.locator('.more-options>summary').click();return panel}

test('F2a: suma por serie, total real, porcentajes y seis tipos alcanzables con teclado',async()=>{
 const panel=await configureSum(),table=panel.locator('.pivot-result table')
 await expect(table.locator('tbody tr')).toHaveCount(4)
 await expect(table.locator('tfoot')).toContainText('4,400');await expect(table.locator('tfoot')).toContainText('2,800');await expect(table.locator('tfoot')).toContainText('7,200');await expect(table.locator('tfoot')).toContainText('100%')
 await expect(table.getByRole('columnheader',{name:'% del total',exact:true})).toBeVisible()
 const types=panel.getByRole('group',{name:'Formas de visualizar',exact:true});await expect(types.getByRole('button')).toHaveCount(6)
 await types.getByRole('button',{name:'Mapa de calor',exact:true}).focus();await page.keyboard.press('Enter');await expect(types.getByRole('button',{name:'Mapa de calor',exact:true})).toHaveAttribute('aria-pressed','true')
 expect(await readFile(path,'utf8')).toBe(original)
})

test('F2a: cuatro capturas reales, resultado y límites visibles en ambos temas sin desplazar',async()=>{
 const panel=await configureSum()
 for(const [width,height] of [[1440,900],[1280,720]])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height});await page.getByLabel('Tema',{exact:true}).selectOption(theme)
  await expect(panel.locator('.plot svg path').first()).toBeAttached()
  const plot=await panel.locator('.plot-scroll').boundingBox(),table=await panel.locator('.pivot-result').boundingBox()
  expect(plot!.height).toBeGreaterThan(160);expect(plot!.y+plot!.height).toBeLessThanOrEqual(height);expect(table!.y+table!.height).toBeLessThanOrEqual(height)
  expect(await panel.evaluate(e=>e.scrollTop)).toBe(0)
  const marks=await panel.locator('.plot').evaluate(element=>{
   const css=getComputedStyle(element),box=element.getBoundingClientRect()
   return{background:css.getPropertyValue('--panel').trim(),text:css.getPropertyValue('--text').trim(),patterns:element.querySelectorAll('pattern').length,texts:[...element.querySelectorAll('svg text')].map(text=>({value:text.textContent??'',color:getComputedStyle(text).fill,left:text.getBoundingClientRect().left-box.left}))}
  })
  const luminance=(color:string)=>{const parts=color.startsWith('#')?color.slice(1).match(/../g)!.map(value=>parseInt(value,16)):color.match(/[\d.]+/g)!.slice(0,3).map(Number);const [r,g,b]=parts.map(value=>{const n=value/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b}
  for(const text of marks.texts){const a=luminance(text.color),b=luminance(marks.background);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05),text.value).toBeGreaterThanOrEqual(4.5)}
  expect(marks.patterns).toBeGreaterThan(0)
  const ticks=marks.texts.filter(text=>text.left<80&&/^[\d,]+$/.test(text.value)).map(text=>Number(text.value.replaceAll(',','')))
  expect(ticks.length).toBeGreaterThan(2);for(const tick of ticks)expect(tick%100).toBe(0)
  await test.info().attach(`marks-${theme}-${width}`,{body:JSON.stringify(marks,null,2),contentType:'application/json'})
  await page.mouse.move(0,0);await page.screenshot({path:test.info().outputPath(`after-${theme}-${width}x${height}.png`)})
 }
 await panel.locator('.more-options>summary').click();await expect(panel.getByText('Ver consulta',{exact:true})).toBeVisible()
})

test('F2a: estados vacío, error numérico, truncado y ventana estrecha con captura',async()=>{
 let panel=await summary();const [doc]=await page.evaluate(()=>window.freya.documents())
 const empty=join(folder,'vacio.csv');await writeFile(empty,'Campo,Valor\n');await page.evaluate(file=>window.freya.openPaths([file]),empty)
 await page.locator('[data-csv-view]').getByRole('button',{name:'Resumen y gráfico',exact:true}).click()
 await expect(page.getByText('Elige qué quieres ver: coloca un campo en Filas y un número en Valores.',{exact:true})).toBeVisible();await page.mouse.move(0,0);await page.screenshot({path:test.info().outputPath('state-empty.png')})
 await page.getByRole('tab',{name:'ventas.csv',exact:true}).click();panel=await summary()
 await panel.locator('.more-options>summary').click();await panel.getByLabel('Columna Y del gráfico').selectOption('3');await panel.getByLabel('Tipo de medida del gráfico').selectOption('number');await panel.getByLabel('Resumen del gráfico').selectOption('sum')
 await expect(panel.locator('.result-announcement')).toContainText('No se pudo calcular el resultado. El archivo no se modificó.');expect(await page.locator('body').innerText()).not.toContain('No hay valores numéricos utilizables');await panel.locator('.chart-info>summary').click();await expect(panel.locator('.info-content')).toContainText('No hay valores numéricos utilizables');await page.mouse.move(0,0);await page.screenshot({path:test.info().outputPath('state-error.png')});await page.getByRole('button',{name:'Cerrar aviso',exact:true}).click()
 const many=join(folder,'grupos.csv');await writeFile(many,'Grupo,Valor\n'+Array.from({length:150},(_,i)=>`G${i},${i}`).join('\n')+'\n');await page.evaluate(file=>window.freya.openPaths([file]),many)
 panel=await summary();await expect(panel.locator('.truncated')).toContainText('Mostrando 100 de 150 grupos');await page.mouse.move(0,0);await page.screenshot({path:test.info().outputPath('state-truncated.png')})
 await page.setViewportSize({width:800,height:720});await expect(page.locator('.sidebar')).toBeHidden();await expect(page.getByRole('button',{name:'Volver a la tabla',exact:true})).toHaveCount(0)
 const box=await panel.boundingBox();expect(box!.width).toBeGreaterThan(760);await page.mouse.move(0,0);await page.screenshot({path:test.info().outputPath('state-narrow.png')})
 expect(await readFile(path,'utf8')).toBe(original)
})

test('F2a: cargando con cancelar y reintento explícito en 100.000 filas, sin escribir el original',async()=>{
 const content='Grupo,Valor\n'+Array.from({length:100000},(_,i)=>`${i%2?'A':'B'},${i}`).join('\n')+'\n',file=join(folder,'grande.csv');await writeFile(file,content);await page.evaluate(file=>window.freya.openPaths([file]),file)
 await page.locator('[data-csv-view]').getByRole('button',{name:'Resumen y gráfico',exact:true}).click();const panel=page.locator('.charts-panel')
 await expect(panel.getByText('Vista previa manual para este archivo.',{exact:true})).toBeVisible();await expect(panel.locator('.plot svg path')).toHaveCount(0)
 await panel.getByRole('button',{name:'Generar gráfico',exact:true}).focus();await page.keyboard.press('Enter');await expect(panel.getByRole('button',{name:'Cancelar gráfico',exact:true})).toBeVisible()
 await page.mouse.move(0,0);await page.screenshot({path:test.info().outputPath('state-loading.png')});await panel.getByRole('button',{name:'Cancelar gráfico',exact:true}).click();await expect(panel.locator('.chart-result>.result-announcement')).toContainText('Gráfico cancelado');await expect(panel.locator('.plot svg path')).toHaveCount(0)
 await panel.getByRole('button',{name:'Generar gráfico',exact:true}).click();await expect(panel.locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado');await expect(panel.locator('.result-status')).toContainText('100,000 filas');await expect(panel.locator('.pivot-result tfoot')).toContainText('100,000')
 expect(await readFile(file,'utf8')).toBe(content)
})

test('F2a: idioma inglés, foco, anuncios y ventana de 800 px',async()=>{
 const panel=await configureSum()
 await page.evaluate(()=>window.freya.setLanguage('en'))
 await expect(page.locator('[data-csv-view]').getByRole('button',{name:'Summary and chart',exact:true})).toHaveAttribute('aria-pressed','true')
 await expect(panel.getByLabel('Chart configuration',{exact:true})).toHaveText('Sum of Ventas by Región · split by Canal')
 await expect(panel.locator('.chart-result>.result-announcement')).toContainText('Result updated');await expect(panel.locator('.chart-result>.result-announcement')).toHaveAttribute('aria-live','polite')
 await panel.locator('.more-options>summary').focus();await page.keyboard.press('Enter');await expect(panel.getByLabel('Chart X column')).toBeVisible();await panel.locator('.more-options>summary').focus();await page.keyboard.press('Enter')
 await page.mouse.move(0,0);await page.screenshot({path:test.info().outputPath('state-en.png')})
 await page.evaluate(()=>window.freya.setLanguage('es'))
 await page.setViewportSize({width:800,height:720});const box=await panel.locator('.pivot-result').boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(720)
 await page.mouse.move(0,0);await page.screenshot({path:test.info().outputPath('state-narrow-keyboard.png')})
})


test('F2a: en-XA real no recorta el resultado ni desborda los controles',async()=>{
 await app.evaluate(({app})=>app.exit(0));await app.close().catch(()=>{});await launch('en-XA','profile-XA')
 const button=page.locator('[data-csv-view]').getByRole('button').filter({hasText:'Sümmáry'});await expect(button).toBeVisible();await button.click()
 const panel=page.locator('.charts-panel');await expect(panel.locator('.plot svg path').first()).toBeAttached();await expect(panel.locator('.pivot-result')).toBeVisible()
 const box=await panel.locator('.pivot-result').boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(720)
 expect(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);await expect(panel.locator('.chart-result>.result-announcement')).toHaveAttribute('aria-live','polite')
 await page.mouse.move(0,0);await page.screenshot({path:test.info().outputPath('state-en-XA.png')});expect(await readFile(path,'utf8')).toBe(original)
})

test('F2a: filtros del gráfico se pueden operar en inglés sin cambiar la tabla',async()=>{
 const panel=await configureSum();await page.evaluate(()=>window.freya.setLanguage('en'));await panel.locator('.more-options>summary').click();await panel.getByRole('button',{name:'Chart filters',exact:true}).click()
 const filters=panel.getByRole('region',{name:'Chart filters',exact:true});await expect(filters).toBeVisible();await filters.getByRole('button',{name:'Add condition',exact:true}).click()
 await filters.getByLabel('Condition column 1',{exact:true}).selectOption('0');await filters.getByLabel('Condition operator 1',{exact:true}).selectOption('equals');await filters.getByLabel('Condition value 1',{exact:true}).fill('Norte');await filters.getByRole('button',{name:'Apply chart filters',exact:true}).click()
 await expect(panel.locator('.chart-result>.result-announcement')).toContainText('Result updated');await expect(panel.locator('.pivot-result tfoot')).toContainText('2,000');expect(await readFile(path,'utf8')).toBe(original)
})

test('F2a: elegir Líneas aplica la agrupación mensual sugerida para fechas ISO',async()=>{
 const file=join(folder,'fechas.csv');await writeFile(file,'Fecha,Ventas\n2026-01-01,10\n2026-01-15,20\n2026-02-01,30\n');await page.evaluate(file=>window.freya.openPaths([file]),file)
 const panel=await summary();await panel.locator('.more-options>summary').click();await panel.getByLabel('Columna Y del gráfico').selectOption('1');await panel.getByLabel('Tipo de medida del gráfico').selectOption('number');await panel.getByLabel('Resumen del gráfico').selectOption('sum');await expect(panel.locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado');await panel.locator('.more-options>summary').click()
 await panel.locator('.chart-types').getByRole('button',{name:'Líneas',exact:true}).click();await expect(panel.locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado');await expect(panel.locator('.pivot-result tbody tr')).toHaveCount(2)
 await expect(panel.locator('.pivot-result tbody tr').first()).toContainText('2026-01');await expect(panel.locator('.pivot-result tfoot')).toContainText('60')
})

test('F2a: pocas filas con celdas grandes conservan vista previa manual y límites explicados',async()=>{
 const file=join(folder,'celdas-grandes.csv'),content='Grupo,Valor,Nota\n'+Array.from({length:3000},(_,i)=>`G${i%4},${i%100},${'x'.repeat(350)}`).join('\n')+'\n';await writeFile(file,content);await page.evaluate(file=>window.freya.openPaths([file]),file)
 await page.locator('[data-csv-view]').getByRole('button',{name:'Resumen y gráfico',exact:true}).click();const panel=page.locator('.charts-panel')
 await expect(panel.getByText('Vista previa manual para este archivo.',{exact:true})).toBeVisible();await expect(panel.locator('.plot svg path')).toHaveCount(0)
 await panel.getByRole('button',{name:'Generar gráfico',exact:true}).click();await expect(panel.locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado');await expect(panel.locator('.pivot-result tfoot')).toContainText('3,000')
 await panel.locator('.chart-info>summary').click();await expect(panel.locator('.info-content')).toContainText('Incluye todas las filas y los cambios pendientes');await page.mouse.move(0,0);await page.screenshot({path:test.info().outputPath('state-result-limits.png')});expect(await readFile(file,'utf8')).toBe(content)
})

test('F2a: cambiar desde una celda en edición confirma el borrador sin guardar el archivo',async()=>{
 const grid=page.getByRole('grid',{name:'Tabla de datos',exact:true});await grid.getByRole('gridcell').filter({hasText:'1200'}).first().dblclick();await page.getByRole('textbox',{name:'Editar celda',exact:true}).fill('1350')
 const panel=await summary();await expect(panel.locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado');await page.locator('[data-csv-view]').getByRole('button',{name:'Tabla',exact:true}).click()
 await expect(grid.getByRole('gridcell').filter({hasText:'1350'}).first()).toBeVisible();const [doc]=await page.evaluate(()=>window.freya.documents());expect(doc.dirty).toBe(true);expect(await readFile(path,'utf8')).toBe(original)
})

test('F2a: las herramientas de tabla siguen completas dentro de ambos anchos',async()=>{
 for(const [width,height] of [[1440,900],[1280,720]]){
  await page.setViewportSize({width,height});const bar=page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true})
  const box=await bar.getByRole('button',{name:'Estadísticas y SQL',exact:true}).boundingBox();expect(box!.x+box!.width).toBeLessThanOrEqual(width)
  await expect(bar.getByRole('button',{name:'Estadísticas y SQL',exact:true})).toBeVisible()
 }
})

test('F2a: desde Texto con cambios, Cancelar conserva el borrador y descartar abre Resumen sin escribir',async()=>{
 const mode=page.locator('[data-csv-view]');await mode.getByRole('button',{name:'Texto',exact:true}).click();const editor=page.getByRole('textbox',{name:'Editor CSV como texto',exact:true})
 await editor.press('ControlOrMeta+End');await page.keyboard.insertText('Extra,Web,50,0%\n');await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(true)
 await mode.getByRole('button',{name:'Resumen y gráfico',exact:true}).click();let dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Guardar y cambiar',exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(editor).toContainText('Extra,Web,50,0%');await expect(mode.getByRole('button',{name:'Texto',exact:true})).toHaveAttribute('aria-pressed','true')
 await mode.getByRole('button',{name:'Resumen y gráfico',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Descartar cambios y cambiar',exact:true}).click();await expect(mode.getByRole('button',{name:'Resumen y gráfico',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.charts-panel').locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado');expect(await readFile(path,'utf8')).toBe(original)
})

test('F2a: series sin depender del color y cifras legibles sobre las celdas del mapa de calor',async()=>{
 const file=join(folder,'series.csv');await writeFile(file,'Paso,Valor,Serie\n0,10,A\n1,20,A\n0,15,B\n1,25,B\n0,10,A\n');await page.evaluate(file=>window.freya.openPaths([file]),file)
 const panel=await summary();await panel.locator('.more-options>summary').click();await panel.getByLabel('Columna X del gráfico').selectOption('0');await panel.getByLabel('Columna Y del gráfico').selectOption('1');await panel.getByLabel('Tipo de medida del gráfico').selectOption('number');await panel.getByLabel('Resumen del gráfico').selectOption('sum');await panel.getByLabel('Series del gráfico').selectOption('2');await expect(panel.locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado');await panel.locator('.more-options>summary').click()
 await panel.locator('.chart-types').getByRole('button',{name:'Líneas',exact:true}).click();await expect(panel.locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado');await expect(panel.locator('.plot svg [stroke-dasharray]').first()).toBeAttached();await page.mouse.move(0,0);await page.screenshot({path:test.info().outputPath('state-line-patterns.png')})
 await panel.locator('.chart-types').getByRole('button',{name:'Mapa de calor',exact:true}).click();await panel.locator('.more-options>summary').click();await panel.getByLabel('Columna Y del gráfico').selectOption('2');await expect(panel.locator('.chart-result>.result-announcement')).toContainText('Resultado actualizado');await panel.locator('.more-options>summary').click()
 for(const theme of ['light','dark']){
  await page.getByLabel('Tema',{exact:true}).selectOption(theme)
  const cells=await panel.locator('.plot').evaluate(root=>{
   const shapes=[...root.querySelectorAll('svg path,svg rect')].map(node=>({fill:getComputedStyle(node).fill,box:node.getBoundingClientRect()}))
   return [...root.querySelectorAll('svg text')].flatMap(node=>{
    const color=getComputedStyle(node).fill;if(color!=='rgb(0, 0, 0)'||!/^\d+$/.test(node.textContent??''))return[]
    const box=node.getBoundingClientRect(),x=box.x+box.width/2,y=box.y+box.height/2,cell=shapes.filter(shape=>shape.box.width>10&&shape.box.height>10&&shape.fill.startsWith('rgb')&&x>=shape.box.x&&x<=shape.box.right&&y>=shape.box.y&&y<=shape.box.bottom).sort((a,b)=>a.box.width*a.box.height-b.box.width*b.box.height)[0]
    return cell?[{text:color,fill:cell.fill}]:[]
   })
  })
  expect(cells).toHaveLength(4)
  const luminance=(rgb:string)=>{const [r,g,b]=rgb.match(/[\d.]+/g)!.slice(0,3).map(Number).map(value=>{const n=value/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b}
  for(const cell of cells){const a=luminance(cell.text),b=luminance(cell.fill);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toBeGreaterThanOrEqual(4.5)}
  const axis=await panel.locator('.plot svg text').filter({hasText:/^Paso$/}).boundingBox(),ramp=await panel.locator('.plot svg [fill^="url("]').evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height}}).find(box=>box.width>=100&&box.height>=10&&box.height<=40))
  expect(axis).not.toBeNull();expect(ramp).toBeDefined();expect(axis!.y+axis!.height).toBeLessThanOrEqual(ramp!.y-2)
  await page.mouse.move(0,0);await page.screenshot({path:test.info().outputPath(`state-heatmap-${theme}.png`)})
 }
})

test('F2a: alternar Tabla y Resumen es presentación, sin reinterpretar el CSV por IPC',async()=>{
 await summary();const before=await page.evaluate(()=>window.freya.documents())
 // Mismo observador del manejador real que usa updates.spec.ts; no sustituye respuestas ni datos.
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya');if(!original)throw new Error('No existe el manejador real')
  const state=globalThis as typeof globalThis&{__csvPresentation?:{calls:number;restore:()=>void}};state.__csvPresentation={calls:0,restore:()=>handlers.set('freya',original)}
  handlers.set('freya',async(event,...args)=>{if(args[0]==='csvView')state.__csvPresentation!.calls++;return original(event,...args)})
 })
 try{
  await page.locator('[data-csv-view]').getByRole('button',{name:'Tabla',exact:true}).click();await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
  await page.evaluate(()=>window.freya.documents())
  expect(await app.evaluate(()=>(globalThis as typeof globalThis&{__csvPresentation?:{calls:number}}).__csvPresentation?.calls)).toBe(0)
  await summary();expect(await page.evaluate(()=>window.freya.documents())).toEqual(before);expect(await readFile(path,'utf8')).toBe(original)
 }finally{await app.evaluate(()=>(globalThis as typeof globalThis&{__csvPresentation?:{restore:()=>void}}).__csvPresentation?.restore())}
})
