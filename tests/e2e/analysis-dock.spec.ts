import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import { closeElectron } from './close-electron'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {showPanel} from './panel'
import {runApplicationMenu} from './application-menu'

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
test.afterEach(async()=>{await closeElectron(app);await rm(folder,{recursive:true,force:true})})

const workspace=()=>page.locator('.analysis-workspace:not([hidden])')
const sections=()=>workspace().getByRole('group',{name:'Secciones de análisis',exact:true})

test('las secciones de la pestaña de análisis se alcanzan y activan con teclado',async()=>{
 await showPanel(page,'Gráficos')
 const [info,statistics,charts,sql]=['Información','Estadísticas','Gráficos','SQL'].map(name=>sections().getByRole('button',{name,exact:true}))
 await expect(charts).toHaveAttribute('aria-pressed','true');await expect(statistics).toHaveAttribute('aria-pressed','false')
 await charts.focus();await page.keyboard.press('Tab');await expect(sql).toBeFocused()
 await expect(charts).toHaveAttribute('aria-pressed','true')
 await page.keyboard.press('Enter');await expect(sql).toHaveAttribute('aria-pressed','true')
 await expect(workspace().getByLabel('Análisis SQL y asistentes')).toBeVisible()
 await expect(page.getByLabel('Gráficos del CSV')).toBeHidden()
 await info.focus();await page.keyboard.press('Enter');await expect(info).toHaveAttribute('aria-pressed','true')
 await statistics.focus();await page.keyboard.press('Enter')
 await expect(statistics).toHaveAttribute('aria-pressed','true')
 await expect(workspace().getByRole('heading',{name:'Estadísticas por columna',exact:true})).toBeVisible()
 await workspace().getByRole('button',{name:'Ir al CSV',exact:true}).click()
 await page.getByRole('button',{name:'Acciones de la columna Ciudad',exact:true}).click()
 await page.getByRole('menuitem',{name:'Estadísticas de la columna',exact:false}).click()
 await expect(workspace().getByLabel('Columnas para estadísticas',{exact:true})).toHaveValue('selected')
 await workspace().getByRole('button',{name:'Ir al CSV',exact:true}).click()
 const value=page.getByRole('gridcell',{name:'Fila 1, Valor',exact:true})
 await value.click();await page.keyboard.press('Shift+ArrowDown');await value.click({button:'right'})
 await page.getByRole('menuitem',{name:'Estadísticas del rango',exact:true}).click()
 await expect(workspace().getByLabel('Columnas para estadísticas',{exact:true})).toHaveValue('range')
})

test('cambiar de sección conserva la configuración del gráfico y el borrador SQL',async()=>{
 await showPanel(page,'Gráficos')
 await page.locator('.charts-panel .more-options>summary').click()
 const x=page.getByRole('combobox',{name:'Columna X del gráfico'})
 await x.selectOption({label:'Ciudad'});await expect(x).toHaveValue(/1/)
 const chosen=await x.inputValue()
 await showPanel(page,'Análisis')
 const editor=page.getByRole('textbox',{name:'Consulta SQL',exact:true})
 await editor.click();await page.keyboard.press(process.platform==='darwin'?'Meta+a':'Control+a');await page.keyboard.type('SELECT 42 AS respuesta')
 await showPanel(page,'Gráficos');await expect(x).toHaveValue(chosen)
 await showPanel(page,'Análisis');await expect(editor).toContainText('SELECT 42 AS respuesta')
})

test('las secciones visitadas se conservan y cerrar análisis las desmonta y devuelve el foco al CSV',async()=>{
 const charts=page.locator('.charts-panel'),sql=page.locator('.sql-panel')
 await expect(charts).toHaveCount(0);await expect(sql).toHaveCount(0)
 await showPanel(page,'Gráficos');await expect(charts).toBeVisible();await expect(sql).toHaveCount(0)
 await showPanel(page,'Análisis');await expect(sql).toBeVisible();await expect(charts).toHaveCount(1);await expect(charts).toBeHidden()
 await page.getByRole('textbox',{name:'Consulta SQL',exact:true}).focus();await page.keyboard.press('Escape')
 await expect(sql).toBeVisible()
 await page.getByRole('tab',{name:/^Análisis de /}).focus()
 await runApplicationMenu(app,'file.close')
 await expect(sql).toHaveCount(0);await expect(charts).toHaveCount(0)
 await expect(page.getByRole('tab',{name:/^Análisis de /})).toHaveCount(0)
 await expect(page.getByRole('tab',{name:'ancha.csv',exact:true})).toBeFocused()
})
