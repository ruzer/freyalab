import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication|undefined,page:Page,folder:string,file:string
const KEY='freya-workspace'
async function launch(open=true){
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports'),...open?{FREYALAB_TEST_OPEN:JSON.stringify([file])}:{}},timeout:60000})
 // La ventana de arranque puede ser estrecha (en la CI lo es): un panel restaurado se abriría ampliado y ocultaría la tabla, así que cada prueba fija su tamaño antes de esperar la tabla.
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);if(open)await expect(page.locator('.csv-body')).toBeAttached()
}
async function quit(){if(!app)return;await app.evaluate(async({session,app})=>{await session.defaultSession.flushStorageData();app.exit(0)}).catch(()=>{});await app.close().catch(()=>{});app=undefined}
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-dock-expanded-'));await mkdir(join(folder,'saved'));await mkdir(join(folder,'exports'));file=join(folder,'ventas.csv')
 await writeFile(file,'Id,Ciudad,Valor,Campo\n'+Array.from({length:200},(_,r)=>`${r},C${r%5},${r%97},v${r}`).join('\n')+'\n')
})
test.afterEach(async()=>{await quit();await rm(folder,{recursive:true,force:true})})
const grid=()=>page.getByRole('grid')
const dock=()=>page.getByLabel('Panel de análisis',{exact:true})
const tools=()=>page.getByRole('tablist',{name:'Herramientas de análisis'})
const separator=()=>page.getByRole('separator',{name:'Ancho del panel'})
const back=()=>page.getByRole('button',{name:'Volver a la tabla',exact:true})
const status=()=>page.locator('#dock-announcement')
const width=async()=>Math.round((await dock().boundingBox())!.width)
async function openDock(button='Gráficos'){const open=page.getByRole('button',{name:button,exact:true});if(await open.getAttribute('aria-expanded')!=='true')await open.click();await expect(tools()).toBeVisible()}

test('ampliar y volver a la tabla conserva búsqueda, selección y posición de desplazamiento',async()=>{
 await launch();await page.setViewportSize({width:1920,height:1080});await openDock()
 await page.getByRole('textbox',{name:'Buscar en tabla'}).fill('C1')
 await expect.poll(()=>page.locator('[role=gridcell][data-column="0"]').count()).toBeGreaterThan(5)
 await page.locator('[role=gridcell][data-row="1"][data-column="1"]').click()
 const selection=await page.locator('.selection-bar').innerText();expect(selection).toContain('Rango')
 await grid().evaluate(element=>{element.scrollTop=300});const top=await grid().evaluate(element=>element.scrollTop);expect(top).toBeGreaterThan(100)
 const docked=await width()
 await page.getByRole('button',{name:'Ampliar',exact:true}).click()
 await expect(grid()).toBeHidden();await expect(back()).toBeVisible();await expect(separator()).toHaveCount(0);await expect(status()).toHaveText('Panel de análisis ampliado')
 expect(await width()).toBeGreaterThan(docked+400) // ocupa el área de trabajo
 await expect(page.getByRole('textbox',{name:'Buscar en tabla'})).toHaveValue('C1') // la barra de herramientas sigue a la vista
 await back().click()
 await expect(grid()).toBeVisible();await expect(back()).toHaveCount(0);await expect(grid()).toBeFocused();await expect(status()).toHaveText('Vuelves a la tabla')
 expect(await page.locator('.selection-bar').innerText()).toBe(selection)
 expect(Math.abs(await grid().evaluate(element=>element.scrollTop)-top)).toBeLessThanOrEqual(1)
 await expect(page.getByRole('textbox',{name:'Buscar en tabla'})).toHaveValue('C1')
 expect(Math.abs(await width()-docked)).toBeLessThanOrEqual(1);await expect(separator()).toHaveAttribute('aria-valuenow','520')
 await expect(tools().getByRole('tab',{name:'Gráficos'})).toHaveAttribute('aria-selected','true')
})

test('Escape en la vista ampliada vuelve a acoplar y un segundo Escape cierra el panel',async()=>{
 await launch();await page.setViewportSize({width:1920,height:1080});await openDock()
 await page.getByRole('button',{name:'Ampliar',exact:true}).click();await expect(grid()).toBeHidden()
 await page.getByRole('combobox',{name:'Columna X del gráfico'}).focus();await page.keyboard.press('Escape')
 await expect(grid()).toBeVisible();await expect(tools()).toBeVisible();await expect(page.getByLabel('Gráficos del CSV')).toBeVisible()
 await page.getByRole('combobox',{name:'Columna X del gráfico'}).focus();await page.keyboard.press('Escape')
 await expect(tools()).toHaveCount(0);await expect(page.getByRole('button',{name:'Gráficos',exact:true})).toBeFocused()
})

test('la vista ampliada no se guarda: tras reiniciar el panel vuelve acoplado',async()=>{
 await launch();await page.setViewportSize({width:1920,height:1080});await openDock('Análisis')
 await page.getByRole('button',{name:'Ampliar',exact:true}).click();await expect(grid()).toBeHidden()
 expect(JSON.parse((await page.evaluate(key=>localStorage.getItem(key),KEY))!)).toEqual({version:1,dock:{visible:true,width:520,tab:'sql'}})
 await quit();await launch(false);await page.setViewportSize({width:1920,height:1080});await page.evaluate(path=>window.freya.openPaths([path]),file) // el tamaño primero: un panel restaurado arranca cerrado si la ventana es estrecha
 await expect(tools()).toBeVisible();await expect(grid()).toBeVisible();await expect(separator()).toBeVisible();await expect(back()).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Ampliar',exact:true})).toBeVisible()
})

test('en una ventana estrecha el panel se abre ampliado con un aviso y al ensanchar vuelve a acoplarse sin perder nada',async()=>{
 await launch();await page.setViewportSize({width:1280,height:720});await openDock()
 await expect(grid()).toBeHidden();await expect(back()).toBeVisible()
 await expect(dock().getByText(/^Ventana estrecha/)).toContainText('Ventana estrecha: el panel ocupa toda el área. Oculta el explorador o amplía la ventana para verlo junto a la tabla.')
 await expect(page.getByRole('button',{name:'Ampliar',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Acoplar',exact:true})).toHaveCount(0)
 const x=page.getByRole('combobox',{name:'Columna X del gráfico'});await x.selectOption({label:'2. Ciudad'});const chosen=await x.inputValue()
 await page.setViewportSize({width:1920,height:1080})
 await expect(grid()).toBeVisible();await expect(separator()).toBeVisible();await expect(back()).toHaveCount(0);await expect(dock().getByText(/^Ventana estrecha/)).toHaveCount(0)
 await expect(tools().getByRole('tab',{name:'Gráficos'})).toHaveAttribute('aria-selected','true');await expect(x).toHaveValue(chosen)
 await page.setViewportSize({width:1280,height:720});await expect(grid()).toBeHidden();await expect(x).toHaveValue(chosen) // y al estrechar, otra vez ampliado
})

test('en una ventana estrecha «Volver a la tabla» cierra el panel y devuelve el foco a su botón',async()=>{
 await launch();await page.setViewportSize({width:1280,height:720});await openDock('Estadísticas')
 await back().click()
 await expect(grid()).toBeVisible();await expect(tools()).toHaveCount(0);await expect(page.getByRole('button',{name:'Estadísticas',exact:true})).toBeFocused()
})

test('a 900×600 los tres paneles son utilizables en la vista ampliada',async()=>{
 await launch();await page.setViewportSize({width:900,height:600})
 const panels=[{button:'Gráficos',control:()=>page.getByRole('button',{name:'Generar gráfico'})},{button:'Análisis',control:()=>page.getByRole('button',{name:'Ejecutar consulta',exact:true})},{button:'Estadísticas',control:()=>page.getByRole('button',{name:'Analizar',exact:true})}]
 for(const panel of panels){
  await openDock(panel.button);await expect(grid()).toBeHidden()
  const control=panel.control();await control.scrollIntoViewIfNeeded();await expect(control).toBeVisible();await expect(control).toBeInViewport({ratio:1})
  expect(await width()).toBeGreaterThanOrEqual(500) // el panel usa el área de trabajo, no los 140 px que quedaban junto a la tabla
  await page.getByRole('button',{name:panel.button,exact:true}).click();await expect(tools()).toHaveCount(0)
 }
})

test('los comandos amplían y acoplan el panel, y solo están disponibles cuando tienen sentido',async()=>{
 await launch();await page.setViewportSize({width:1920,height:1080})
 const palette=()=>page.getByRole('dialog',{name:'Comandos CSV',exact:true})
 const command=(name:RegExp)=>palette().getByRole('button',{name})
 const show=async(query:string)=>{await page.getByRole('button',{name:'Comandos',exact:true}).click();await palette().getByLabel('Buscar comando CSV',{exact:true}).fill(query)}
 await show('panel de análisis');await expect(command(/Ampliar panel de análisis/)).toBeDisabled();await expect(command(/Acoplar panel de análisis/)).toBeDisabled() // cerrado
 await page.keyboard.press('Escape');await openDock()
 await show('panel de análisis');await expect(command(/Ampliar panel de análisis/)).toBeEnabled();await expect(command(/Acoplar panel de análisis/)).toBeDisabled()
 await command(/Ampliar panel de análisis/).click();await expect(grid()).toBeHidden()
 await show('panel de análisis');await expect(command(/Acoplar panel de análisis/)).toBeEnabled();await expect(command(/Ampliar panel de análisis/)).toBeDisabled()
 await command(/Acoplar panel de análisis/).click();await expect(grid()).toBeVisible();await expect(separator()).toBeVisible()
})
