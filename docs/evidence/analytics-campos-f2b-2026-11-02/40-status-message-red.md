# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: analysis-dock.spec.ts >> el gráfico generado en el panel acoplado no se desplaza en horizontal y queda a la vista
- Location: tests/e2e/analysis-dock.spec.ts:93:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.charts-panel .result-announcement')
Expected substring: "Gráfico listo"
Received string:    "Resultado actualizado: 5 grupos"
Timeout: 30000ms

Call log:
  - Expect "toContainText" locator('.charts-panel .result-announcement') with timeout 30000ms
  - waiting for locator('.charts-panel .result-announcement')
    6 × locator resolved to <p role="status" aria-live="polite" aria-atomic="true" class="sr-only result-announcement svelte-1wo6u31">Calculando el resultado…</p>
      - unexpected value "Calculando el resultado…"
    57 × locator resolved to <p role="status" aria-live="polite" aria-atomic="true" class="sr-only result-announcement svelte-1wo6u31">Resultado actualizado: 5 grupos</p>
       - unexpected value "Resultado actualizado: 5 grupos"

```

```yaml
- status: "Resultado actualizado: 5 grupos"
```

# Test source

```ts
  1   | import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
  2   | import electronPath from 'electron'
  3   | import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
  4   | import {tmpdir} from 'node:os'
  5   | import {join,resolve} from 'node:path'
  6   | import {analyzeButton,showPanel} from './panel'
  7   | 
  8   | let app:ElectronApplication,page:Page,folder:string
  9   | test.beforeEach(async()=>{
  10  |  folder=await mkdtemp(join(tmpdir(),'freya-dock-'));await mkdir(join(folder,'saved'));await mkdir(join(folder,'exports'))
  11  |  const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
  12  |  app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')},timeout:60000})
  13  |  page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
  14  |  const file=join(folder,'ancha.csv'),columns=14
  15  |  await writeFile(file,Array.from({length:columns},(_,c)=>c===0?'Id':c===1?'Ciudad':c===2?'Valor':`Campo ${c+1}`).join(',')+'\n'+Array.from({length:80},(_,r)=>Array.from({length:columns},(_,c)=>c===0?r:c===1?`C${r%5}`:c===2?r%97:`v${c}-${r%13}`).join(',')).join('\n')+'\n')
  16  |  await page.evaluate(path=>window.freya.openPaths([path]),file);await expect(page.getByRole('grid')).toBeVisible()
  17  | })
  18  | test.afterEach(async()=>{await app?.evaluate(({app})=>app.exit(0)).catch(()=>{});await app?.close().catch(()=>{});await rm(folder,{recursive:true,force:true})})
  19  | 
  20  | // Filas de datos totalmente visibles: dentro de la tabla y por encima de la barra de estado.
  21  | const visibleRows=()=>page.evaluate(()=>{
  22  |  const grid=document.querySelector('[role=grid]')!,box=grid.getBoundingClientRect()
  23  |  const limit=Math.min(document.querySelector('main')!.getBoundingClientRect().bottom,document.querySelector('footer')?.getBoundingClientRect().top??innerHeight,innerHeight)
  24  |  const header=grid.querySelector('[role=columnheader]')?.getBoundingClientRect().height??0
  25  |  return [...grid.querySelectorAll('[role=gridcell][data-column="0"]')].filter(cell=>{const r=cell.getBoundingClientRect();return r.top>=box.top+header-1&&r.bottom<=limit+1}).length
  26  | })
  27  | const visibleColumns=()=>page.evaluate(()=>{
  28  |  const grid=document.querySelector('[role=grid]')!,box=grid.getBoundingClientRect()
  29  |  return [...grid.querySelectorAll('[role=columnheader]')].filter(header=>{const r=header.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1}).length
  30  | })
  31  | // Espera a que el reparto de la tabla se asiente (en una ejecución lenta la primera lectura puede ser anterior al último ajuste).
  32  | const stableRows=async()=>{let last=-1,same=0;for(let i=0;i<50&&same<3;i++){const now=await visibleRows();same=now===last?same+1:0;last=now;await page.waitForTimeout(100)}return last}
  33  | const tools=()=>page.getByRole('tablist',{name:'Herramientas de análisis'})
  34  | const panels=[
  35  |  {button:'Gráficos' as const,ready:()=>page.getByLabel('Gráficos del CSV')},
  36  |  {button:'Estadísticas' as const,ready:()=>page.getByRole('heading',{name:'Estadísticas por columna'})},
  37  |  {button:'Análisis' as const,ready:()=>page.getByLabel('Análisis SQL y asistentes')}
  38  | ]
  39  | const close=async()=>{if(await analyzeButton(page).getAttribute('aria-expanded')==='true')await analyzeButton(page).click()}
  40  | 
  41  | test('con un panel de análisis abierto la tabla conserva las filas que tenía sin panel',async()=>{
  42  |  for(const [width,height] of [[1440,900],[1366,768]] as const){
  43  |   await page.setViewportSize({width,height})
  44  |   await expect.poll(visibleRows,{message:`sin panel ${width}×${height}`}).toBeGreaterThan(5)
  45  |   const without=await stableRows()
  46  |   for(const panel of panels){
  47  |    await showPanel(page,panel.button);await expect(panel.ready()).toBeVisible()
  48  |    if(panel.button==='Gráficos'){await expect(page.getByRole('grid')).toBeHidden();await page.locator('[data-csv-view]').getByRole('button',{name:'Tabla',exact:true}).click();await expect.poll(visibleRows).toBe(without)}else{await expect.poll(visibleRows,{message:`${panel.button} abierto en ${width}×${height} (sin panel: ${without} filas)`}).toBe(without);await close();await expect(panel.ready()).toHaveCount(0)}
  49  |   }
  50  |  }
  51  | })
  52  | 
  53  | test('con el panel acoplado a 1366×768 la tabla sigue mostrando al menos tres columnas y no queda debajo del panel',async()=>{
  54  |  await page.setViewportSize({width:1366,height:768})
  55  |  await showPanel(page,'Estadísticas');await expect(page.locator('.statistics-panel')).toBeVisible()
  56  |  await expect.poll(visibleColumns).toBeGreaterThanOrEqual(3)
  57  |  const [grid,dock]=await Promise.all([page.getByRole('grid').boundingBox(),page.getByLabel('Panel de análisis').boundingBox()])
  58  |  expect(dock!.x).toBeGreaterThanOrEqual(grid!.x+grid!.width-1)
  59  | })
  60  | 
  61  | test('las herramientas son pestañas accesibles con activación manual por teclado',async()=>{
  62  |  await showPanel(page,'Estadísticas');await expect(tools()).toBeVisible()
  63  |  const [resumen,graficos,sql]=['Resumen','Gráficos','SQL'].map(name=>tools().getByRole('tab',{name,exact:true}))
  64  |  await graficos.click();await expect(graficos).toHaveAttribute('aria-selected','true');await expect(resumen).toHaveAttribute('aria-selected','false')
  65  |  await expect(graficos).toHaveAttribute('tabindex','0');await expect(sql).toHaveAttribute('tabindex','-1')
  66  |  await graficos.focus();await page.keyboard.press('ArrowRight');await expect(sql).toBeFocused();await expect(graficos).toHaveAttribute('aria-selected','true') // mover el foco no activa
  67  |  await page.keyboard.press('Enter');await expect(sql).toHaveAttribute('aria-selected','true');await expect(page.getByLabel('Análisis SQL y asistentes')).toBeVisible();await expect(page.getByLabel('Gráficos del CSV')).toBeHidden()
  68  |  await page.keyboard.press('Home');await expect(resumen).toBeFocused();await page.keyboard.press('End');await expect(sql).toBeFocused();await page.keyboard.press('ArrowRight');await expect(resumen).toBeFocused() // da la vuelta
  69  |  await page.keyboard.press('Space');await expect(resumen).toHaveAttribute('aria-selected','true');await expect(page.getByRole('heading',{name:'Estadísticas por columna'})).toBeVisible()
  70  |  const panel=page.getByRole('tabpanel',{name:'Resumen'});await expect(panel).toBeVisible();await expect(panel).toHaveAttribute('id',(await resumen.getAttribute('aria-controls'))!)
  71  | })
  72  | 
  73  | test('cambiar de pestaña conserva la configuración del gráfico y el borrador SQL',async()=>{
  74  |  await showPanel(page,'Gráficos')
  75  |  await page.locator('.charts-panel .more-options>summary').click();const x=page.getByRole('combobox',{name:'Columna X del gráfico'});await x.selectOption({label:'Ciudad'});await expect(x).toHaveValue(/1/)
  76  |  const chosen=await x.inputValue()
  77  |  await showPanel(page,'Análisis')
  78  |  const editor=page.getByRole('textbox',{name:'Consulta SQL',exact:true});await editor.click();await page.keyboard.press(process.platform==='darwin'?'Meta+a':'Control+a');await page.keyboard.type('SELECT 42 AS respuesta')
  79  |  await showPanel(page,'Gráficos');await expect(x).toHaveValue(chosen)
  80  |  await showPanel(page,'Análisis');await expect(editor).toContainText('SELECT 42 AS respuesta')
  81  | })
  82  | 
  83  | test('las pestañas visitadas siguen montadas y ocultas; cerrar el panel las desmonta y devuelve el foco',async()=>{
  84  |  const charts=page.locator('.charts-panel'),sql=page.locator('.sql-panel')
  85  |  await expect(charts).toHaveCount(0);await expect(sql).toHaveCount(0)
  86  |  await showPanel(page,'Gráficos');await expect(charts).toBeVisible();await expect(sql).toHaveCount(0) // las no visitadas no se montan
  87  |  await showPanel(page,'Análisis');await expect(sql).toBeVisible();await expect(charts).toHaveCount(1);await expect(charts).toBeHidden()
  88  |  await page.getByRole('textbox',{name:'Consulta SQL',exact:true}).focus();await page.keyboard.press('Escape')
  89  |  await expect(sql).toHaveCount(0);await expect(charts).toBeHidden();await expect(tools()).toHaveCount(0)
  90  |  await expect(analyzeButton(page)).toBeFocused()
  91  | })
  92  | 
  93  | test('el gráfico generado en el panel acoplado no se desplaza en horizontal y queda a la vista',async()=>{
  94  |  await page.setViewportSize({width:1366,height:768})
  95  |  await showPanel(page,'Gráficos');await expect(page.getByLabel('Gráficos del CSV')).toBeVisible()
  96  |  await page.locator('.charts-panel .more-options>summary').click();await page.getByRole('combobox',{name:'Columna X del gráfico'}).selectOption({label:'Ciudad'})
  97  |  await page.getByRole('button',{name:'Generar gráfico'}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Generar gráfico'}).click()
> 98  |  await expect(page.locator('.charts-panel .result-announcement')).toContainText('Gráfico listo',{timeout:30_000});await page.locator('.charts-panel .more-options>summary').click()
      |                                                                   ^ Error: expect(locator).toContainText(expected) failed
  99  |  const inView=()=>page.locator('.plot-scroll').evaluate(plot=>{
  100 |   let ancestor=plot.parentElement;while(ancestor&&!(ancestor.scrollHeight>ancestor.clientHeight+1&&/auto|scroll/.test(getComputedStyle(ancestor).overflowY)))ancestor=ancestor.parentElement
  101 |   const box=plot.getBoundingClientRect(),area=(ancestor??document.documentElement).getBoundingClientRect()
  102 |   return{horizontal:plot.scrollWidth>plot.clientWidth+1,visible:Math.max(0,Math.min(box.bottom,area.bottom)-Math.max(box.top,area.top)),height:box.height}
  103 |  })
  104 |  await expect.poll(async()=>{const now=await inView();return !now.horizontal&&now.visible>=now.height-1},{message:JSON.stringify(await inView())}).toBe(true)
  105 | })
  106 | 
```