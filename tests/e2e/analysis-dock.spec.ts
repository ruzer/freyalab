import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication,page:Page,folder:string
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-dock-'));await mkdir(join(folder,'saved'));await mkdir(join(folder,'exports'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
 const file=join(folder,'ancha.csv'),columns=14
 await writeFile(file,Array.from({length:columns},(_,c)=>c===0?'Id':c===1?'Ciudad':c===2?'Valor':`Campo ${c+1}`).join(',')+'\n'+Array.from({length:80},(_,r)=>Array.from({length:columns},(_,c)=>c===0?r:c===1?`C${r%5}`:c===2?r%97:`v${c}-${r%13}`).join(',')).join('\n')+'\n')
 await page.evaluate(path=>window.freya.openPaths([path]),file);await expect(page.getByRole('grid')).toBeVisible()
})
test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true})})

// Filas de datos totalmente visibles: dentro de la tabla y por encima de la barra de estado.
const visibleRows=()=>page.evaluate(()=>{
 const grid=document.querySelector('[role=grid]')!,box=grid.getBoundingClientRect()
 const limit=Math.min(document.querySelector('main')!.getBoundingClientRect().bottom,document.querySelector('footer')?.getBoundingClientRect().top??innerHeight,innerHeight)
 const header=grid.querySelector('[role=columnheader]')?.getBoundingClientRect().height??0
 return [...grid.querySelectorAll('[role=gridcell][data-column="0"]')].filter(cell=>{const r=cell.getBoundingClientRect();return r.top>=box.top+header-1&&r.bottom<=limit+1}).length
})
const visibleColumns=()=>page.evaluate(()=>{
 const grid=document.querySelector('[role=grid]')!,box=grid.getBoundingClientRect()
 return [...grid.querySelectorAll('[role=columnheader]')].filter(header=>{const r=header.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1}).length
})
// Espera a que el reparto de la tabla se asiente (en una ejecución lenta la primera lectura puede ser anterior al último ajuste).
const stableRows=async()=>{let last=-1,same=0;for(let i=0;i<50&&same<3;i++){const now=await visibleRows();same=now===last?same+1:0;last=now;await page.waitForTimeout(100)}return last}
const tools=()=>page.getByRole('tablist',{name:'Herramientas de análisis'})
const panels=[
 {button:'Gráficos',ready:()=>page.getByLabel('Gráficos del CSV')},
 {button:'Estadísticas',ready:()=>page.getByRole('heading',{name:'Estadísticas por columna'})},
 {button:'Análisis',ready:()=>page.getByLabel('Análisis SQL y asistentes')}
]
const close=async()=>{const open=page.getByRole('button',{expanded:true}).filter({hasText:/Gráficos|Estadísticas|Análisis/});if(await open.count())await open.first().click()}

test('con un panel de análisis abierto la tabla conserva las filas que tenía sin panel',async()=>{
 for(const [width,height] of [[1440,900],[1366,768]] as const){
  await page.setViewportSize({width,height})
  await expect.poll(visibleRows,{message:`sin panel ${width}×${height}`}).toBeGreaterThan(5)
  const without=await stableRows()
  for(const panel of panels){
   await page.getByRole('button',{name:panel.button,exact:true}).click();await expect(panel.ready()).toBeVisible()
   await expect.poll(visibleRows,{message:`${panel.button} abierto en ${width}×${height} (sin panel: ${without} filas)`}).toBe(without)
   await close();await expect(panel.ready()).toHaveCount(0)
  }
 }
})

test('con el panel acoplado a 1366×768 la tabla sigue mostrando al menos tres columnas y no queda debajo del panel',async()=>{
 await page.setViewportSize({width:1366,height:768})
 await page.getByRole('button',{name:'Gráficos',exact:true}).click();await expect(page.getByLabel('Gráficos del CSV')).toBeVisible()
 await expect.poll(visibleColumns).toBeGreaterThanOrEqual(3)
 const [grid,dock]=await Promise.all([page.getByRole('grid').boundingBox(),page.getByLabel('Panel de análisis').boundingBox()])
 expect(dock!.x).toBeGreaterThanOrEqual(grid!.x+grid!.width-1)
})

test('las herramientas son pestañas accesibles con activación manual por teclado',async()=>{
 await page.getByRole('button',{name:'Gráficos',exact:true}).click();await expect(tools()).toBeVisible()
 const [resumen,graficos,sql]=['Resumen','Gráficos','SQL'].map(name=>tools().getByRole('tab',{name,exact:true}))
 await expect(graficos).toHaveAttribute('aria-selected','true');await expect(resumen).toHaveAttribute('aria-selected','false')
 await expect(graficos).toHaveAttribute('tabindex','0');await expect(sql).toHaveAttribute('tabindex','-1')
 await graficos.focus();await page.keyboard.press('ArrowRight');await expect(sql).toBeFocused();await expect(graficos).toHaveAttribute('aria-selected','true') // mover el foco no activa
 await page.keyboard.press('Enter');await expect(sql).toHaveAttribute('aria-selected','true');await expect(page.getByLabel('Análisis SQL y asistentes')).toBeVisible();await expect(page.getByLabel('Gráficos del CSV')).toBeHidden()
 await page.keyboard.press('Home');await expect(resumen).toBeFocused();await page.keyboard.press('End');await expect(sql).toBeFocused();await page.keyboard.press('ArrowRight');await expect(resumen).toBeFocused() // da la vuelta
 await page.keyboard.press('Space');await expect(resumen).toHaveAttribute('aria-selected','true');await expect(page.getByRole('heading',{name:'Estadísticas por columna'})).toBeVisible()
 const panel=page.getByRole('tabpanel',{name:'Resumen'});await expect(panel).toBeVisible();await expect(panel).toHaveAttribute('id',(await resumen.getAttribute('aria-controls'))!)
})

test('cambiar de pestaña conserva la configuración del gráfico y el borrador SQL',async()=>{
 await page.getByRole('button',{name:'Gráficos',exact:true}).click()
 const x=page.getByRole('combobox',{name:'Columna X del gráfico'});await x.selectOption({label:'2. Ciudad'});await expect(x).toHaveValue(/1/)
 const chosen=await x.inputValue()
 await tools().getByRole('tab',{name:'SQL',exact:true}).click()
 const editor=page.getByRole('textbox',{name:'Consulta SQL',exact:true});await editor.click();await page.keyboard.press(process.platform==='darwin'?'Meta+a':'Control+a');await page.keyboard.type('SELECT 42 AS respuesta')
 await tools().getByRole('tab',{name:'Gráficos',exact:true}).click();await expect(x).toHaveValue(chosen)
 await tools().getByRole('tab',{name:'SQL',exact:true}).click();await expect(editor).toContainText('SELECT 42 AS respuesta')
})

test('las pestañas visitadas siguen montadas y ocultas; cerrar el panel las desmonta y devuelve el foco',async()=>{
 const charts=page.locator('.charts-panel'),sql=page.locator('.sql-panel')
 await expect(charts).toHaveCount(0);await expect(sql).toHaveCount(0)
 await page.getByRole('button',{name:'Gráficos',exact:true}).click();await expect(charts).toBeVisible();await expect(sql).toHaveCount(0) // las no visitadas no se montan
 await tools().getByRole('tab',{name:'SQL',exact:true}).click();await expect(sql).toBeVisible();await expect(charts).toHaveCount(1);await expect(charts).toBeHidden()
 await page.getByRole('textbox',{name:'Consulta SQL',exact:true}).focus();await page.keyboard.press('Escape')
 await expect(sql).toHaveCount(0);await expect(charts).toHaveCount(0);await expect(tools()).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Análisis',exact:true})).toBeFocused()
})

test('el gráfico generado en el panel acoplado no se desplaza en horizontal y queda a la vista',async()=>{
 await page.setViewportSize({width:1366,height:768})
 await page.getByRole('button',{name:'Gráficos',exact:true}).click();await expect(page.getByLabel('Gráficos del CSV')).toBeVisible()
 await page.getByRole('combobox',{name:'Columna X del gráfico'}).selectOption({label:'2. Ciudad'})
 await page.getByRole('button',{name:'Generar gráfico'}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Generar gráfico'}).click()
 await expect(page.getByText('Gráfico listo.')).toBeVisible({timeout:30_000})
 const inView=()=>page.locator('.plot-scroll').evaluate(plot=>{
  let ancestor=plot.parentElement;while(ancestor&&!(ancestor.scrollHeight>ancestor.clientHeight+1&&/auto|scroll/.test(getComputedStyle(ancestor).overflowY)))ancestor=ancestor.parentElement
  const box=plot.getBoundingClientRect(),area=(ancestor??document.documentElement).getBoundingClientRect()
  return{horizontal:plot.scrollWidth>plot.clientWidth+1,visible:Math.max(0,Math.min(box.bottom,area.bottom)-Math.max(box.top,area.top)),height:box.height}
 })
 await expect.poll(async()=>{const now=await inView();return !now.horizontal&&now.visible>=now.height-1},{message:JSON.stringify(await inView())}).toBe(true)
})
