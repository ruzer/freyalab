import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

// UX-01 · Barra CSV compacta: una sola fila de herramientas, menús para lo secundario y los metadatos del archivo en la barra de estado.
let app:ElectronApplication,page:Page,folder:string
const cities=['Cd. de México','Oaxaca de Juárez','Guadalajara','Monterrey','Mérida','Puebla']
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-compact-'));await mkdir(join(folder,'saved'));await mkdir(join(folder,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
 const file=join(folder,'ventas.csv')
 await writeFile(file,'Folio,Ciudad,Fecha,Categoría,Unidades,Importe_MXN,Estado\n'+Array.from({length:1240},(_,i)=>`F${String(i+1).padStart(5,'0')},${cities[i%6]},2026-0${1+i%9}-${String(1+i%28).padStart(2,'0')},Cat ${i%4},${1+i%12},${(100+i*7.3).toFixed(2)},${['Pagado','Pendiente','Cancelado'][i%3]}`).join('\n')+'\n')
 await page.setViewportSize({width:1440,height:900}) // el tamaño de la ventana real depende de la pantalla del equipo (en CI es más pequeña)
 await page.evaluate(path=>window.freya.openPaths([path]),file);await expect(page.getByRole('grid')).toBeVisible()
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true})})

const toolbar=()=>page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true})
const status=()=>page.locator('footer')
const resize=async(width:number,height:number)=>{await page.setViewportSize({width,height});await page.waitForTimeout(400)}
// Espacio entre el borde superior y la tabla, y filas de datos totalmente visibles.
const layout=()=>page.evaluate(()=>{
 const grid=document.querySelector('[role=grid]')!,box=grid.getBoundingClientRect(),header=grid.querySelector('[role=columnheader]')?.getBoundingClientRect().height??0
 const limit=Math.min(document.querySelector('main')!.getBoundingClientRect().bottom,document.querySelector('footer')?.getBoundingClientRect().top??innerHeight,innerHeight)
 const rows=[...grid.querySelectorAll('[role=gridcell][data-column="0"]')].filter(cell=>{const r=cell.getBoundingClientRect();return r.top>=box.top+header-1&&r.bottom<=limit+1}).length
 return {gridTop:Math.round(box.top),rows,bars:document.querySelectorAll('.csv-toolbar,.csv-operations,.csv-options,.selection-bar').length}
})

test('una sola fila de herramientas deja la tabla a 110 px del borde superior o menos', async()=>{
 for(const [width,height,minRows] of [[1440,900,22],[1280,720,16]] as const){
  await resize(width,height)
  const result=await layout()
  expect(result.bars,`franjas de controles a ${width}×${height}`).toBe(1)
  expect(result.gridTop,`inicio de la tabla a ${width}×${height}`).toBeLessThanOrEqual(110)
  expect(result.rows,`filas visibles a ${width}×${height}`).toBeGreaterThanOrEqual(minRows)
  if(process.env.FREYALAB_TXT_EVIDENCE==='1'){await test.info().attach(`distribución-${width}`,{body:JSON.stringify(result),contentType:'application/json'});for(const [theme,name]of [['light','claro'],['dark','oscuro']] as const){await page.getByRole('combobox',{name:'Tema',exact:true}).selectOption(theme);await page.screenshot({animations:'disabled',path:`docs/evidence/txt-01-tabla-${name}-${width}.png`})}}
 }
})

test('las cinco acciones principales se ven a la vez y lo demás está en menús con su nombre de siempre', async()=>{
 const bar=toolbar()
 await expect(bar.getByRole('textbox',{name:'Buscar en tabla',exact:true})).toBeVisible()
 for(const name of ['Reemplazar','Filtrar','Limpiar datos','Filas y columnas','Analizar'])await expect(bar.getByLabel(name,{exact:true})).toBeVisible()
 // Lo secundario ya no ocupa sitio en la barra.
 for(const name of ['Consulta avanzada','Estadísticas','Gráficos','Análisis','Comandos','Orden numérico'])await expect(bar.getByRole('button',{name,exact:true})).toHaveCount(0)
 const menus:Record<string,string[]>={
  'Filtrar':['Filtros por columna','Consulta avanzada','Orden numérico'],
  'Limpiar datos':['Transformar documento…','Quitar espacios al inicio y final','Convertir a mayúsculas','Convertir a minúsculas'],
  'Filas y columnas':['Añadir fila','Insertar fila arriba','Insertar fila abajo','Añadir columna','Duplicar filas seleccionadas','Duplicar columna seleccionada','Eliminar filas seleccionadas','Eliminar columna seleccionada']
 }
 for(const [menu,items] of Object.entries(menus)){
  await bar.getByLabel(menu,{exact:true}).click()
  const open=page.getByRole('group',{name:menu,exact:true}).or(bar.locator('details[open]'))
  for(const item of items)await expect(open.getByText(item,{exact:true}).first(),`«${item}» en «${menu}»`).toBeVisible()
  await page.keyboard.press('Escape');await expect(bar.locator('details[open]')).toHaveCount(0)
 }
 await expect(bar.getByLabel('Buscar acción',{exact:true})).toBeVisible() // la paleta de comandos conserva su acceso (Ctrl/⌘ + K)
})

test('la codificación, el separador, el encabezado y los recuentos viven en la barra de estado', async()=>{
 const bar=status()
 await expect(bar.getByLabel('Codificación',{exact:true})).toBeVisible()
 await expect(bar.getByLabel('Separador',{exact:true})).toBeVisible()
 await expect(bar.getByRole('checkbox',{name:'Primera fila como encabezado',exact:true})).toBeChecked()
 await expect(bar.getByText(/1[.,]240 de 1[.,]240 filas/)).toBeVisible()
 await expect(page.locator('.csv-workspace').getByLabel('Codificación',{exact:true})).toHaveCount(0)
 // Cambiar el separador sigue reinterpretando el archivo.
 await bar.getByLabel('Separador',{exact:true}).selectOption(';')
 await expect(page.getByRole('grid').getByRole('columnheader')).toHaveCount(1) // con «;» el archivo queda en una sola columna
})

test('Analizar abre el panel en la pestaña recordada y vuelve a cerrarlo con el foco en su botón', async()=>{
 const analyze=toolbar().getByLabel('Analizar',{exact:true}),tabs=page.getByRole('tablist',{name:'Herramientas de análisis'})
 await analyze.click();await expect(tabs).toBeVisible()
 for(const name of ['Resumen','Gráficos','SQL'])await expect(tabs.getByRole('tab',{name,exact:true})).toBeVisible()
 await tabs.getByRole('tab',{name:'Gráficos',exact:true}).click()
 await analyze.click();await expect(tabs).toHaveCount(0);await expect(analyze).toBeFocused()
 await analyze.click();await expect(tabs.getByRole('tab',{name:'Gráficos',exact:true})).toHaveAttribute('aria-selected','true') // recuerda la pestaña
})

test('un filtro activo queda a la vista como etiqueta y se quita con un clic', async()=>{
 const bar=toolbar()
 await bar.getByLabel('Filtrar',{exact:true}).click();await page.getByText('Filtros por columna',{exact:true}).click()
 await page.getByLabel('Filtrar Ciudad',{exact:true}).fill('Oaxaca')
 const chip=bar.getByRole('button',{name:/^1 filtro activo/})
 await expect(chip).toBeVisible()
 await expect(status().getByText(/207 de 1[.,]240 filas/)).toBeVisible()
 await chip.click();await expect(chip).toHaveCount(0);await expect(status().getByText(/1[.,]240 de 1[.,]240 filas/)).toBeVisible()
})
