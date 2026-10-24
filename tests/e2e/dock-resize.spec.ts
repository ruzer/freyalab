import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {showPanel} from './panel'

let app:ElectronApplication|undefined,page:Page,folder:string
const KEY='freya-workspace'
const csv=(name:string)=>`Id,Ciudad,Valor,${name}\n`+Array.from({length:40},(_,r)=>`${r},C${r%5},${r%97},${name}${r}`).join('\n')+'\n'
async function launch(open:string[]=[]){
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports'),...open.length?{FREYALAB_TEST_OPEN:JSON.stringify(open)}:{}},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
}
// El almacenamiento local se escribe en segundo plano: se vuelca a disco antes de cerrar para que el siguiente arranque lo vea.
async function quit(){if(!app)return;await app.evaluate(async({session,app})=>{await session.defaultSession.flushStorageData();app.exit(0)}).catch(()=>{});await app.close().catch(()=>{});app=undefined}
let files:string[]
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-dock-resize-'));await mkdir(join(folder,'saved'));await mkdir(join(folder,'exports'))
 files=['uno.csv','dos.csv'].map(name=>join(folder,name));await Promise.all(files.map((file,i)=>writeFile(file,csv(i?'dos':'uno'))))
})
test.afterEach(async()=>{await quit();await rm(folder,{recursive:true,force:true})})
const separator=()=>page.getByRole('separator',{name:'Ancho del panel'})
const dockWidth=async()=>Math.round((await page.getByLabel('Panel de análisis').boundingBox())!.width)
const area=()=>page.locator('.csv-body').evaluate(element=>element.clientWidth)
const stored=()=>page.evaluate(key=>localStorage.getItem(key),KEY)
async function openDock(button:'Gráficos'|'Estadísticas'|'Análisis'='Gráficos'){await showPanel(page,button);await expect(page.getByRole('tablist',{name:'Herramientas de análisis'})).toBeVisible()}

test('el divisor expone su estado y se mueve con el teclado dentro del rango',async()=>{
 await launch(files);await expect(page.getByRole('grid')).toBeVisible();await page.setViewportSize({width:1920,height:1080});await openDock()
 const total=await area(),max=total-600
 await expect(separator()).toHaveAttribute('aria-orientation','vertical');await expect(separator()).toHaveAttribute('aria-valuemin','520');await expect(separator()).toHaveAttribute('aria-valuemax',String(max));await expect(separator()).toHaveAttribute('aria-valuenow','520')
 await expect(separator()).toHaveAttribute('aria-controls',/.+/);await expect(separator()).toHaveAttribute('tabindex','0')
 const press=async(key:string,expected:number)=>{await page.keyboard.press(key);await expect(separator()).toHaveAttribute('aria-valuenow',String(expected));expect(Math.abs(await dockWidth()-expected)).toBeLessThanOrEqual(1)}
 await separator().focus()
 await press('ArrowLeft',536);await press('Shift+ArrowLeft',600);await press('ArrowRight',584);await press('Shift+ArrowRight',520);await press('ArrowRight',520) // no baja del mínimo
 await press('End',max);await press('ArrowLeft',max) // no supera el máximo
 expect((await page.getByRole('grid').boundingBox())!.width).toBeGreaterThanOrEqual(600-60) // la tabla conserva su espacio mínimo (menos la numeración)
 await press('Home',520);await press('End',max);await press('Enter',520)
})

test('el divisor se arrastra con el puntero y solo guarda al soltar',async()=>{
 await launch(files);await page.setViewportSize({width:1920,height:1080});await openDock()
 await page.evaluate(key=>{const original=Storage.prototype.setItem;const w=window as unknown as {__writes:number};w.__writes=0;Storage.prototype.setItem=function(name:string,value:string){if(name===key)w.__writes++;return original.call(this,name,value)}},KEY)
 const box=(await separator().boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2
 await page.mouse.move(x,y);await page.mouse.down()
 for(let step=1;step<=15;step++)await page.mouse.move(x-step*8,y)
 await page.mouse.up()
 await expect.poll(dockWidth).toBeGreaterThanOrEqual(520+120-2);expect(await dockWidth()).toBeLessThanOrEqual(520+120+2)
 await expect(separator()).toHaveAttribute('aria-valuenow',/^6[34]\d$/)
 expect(await page.evaluate(()=>(window as unknown as {__writes:number}).__writes)).toBeLessThanOrEqual(1) // 15 movimientos, una escritura
 await page.mouse.move(x-120,y);await page.mouse.down();await page.mouse.move(x+400,y);await page.mouse.up() // arrastrar hacia la derecha no baja del mínimo
 await expect(separator()).toHaveAttribute('aria-valuenow','520')
})

test('el panel abierto, su pestaña y su ancho pasan de un documento a otro sin llevar el foco al panel',async()=>{
 await launch(files);await expect(page.getByRole('grid')).toBeVisible();await page.setViewportSize({width:1920,height:1080})
 await openDock('Estadísticas');await separator().focus();await page.keyboard.press('Shift+ArrowLeft')
 await expect(separator()).toHaveAttribute('aria-valuenow','584')
 await page.getByRole('tab',{name:'dos.csv'}).click();await expect(page.getByRole('tab',{name:'dos.csv'})).toHaveAttribute('aria-selected','true')
 await expect(page.getByRole('tablist',{name:'Herramientas de análisis'}).getByRole('tab',{name:'Resumen'})).toHaveAttribute('aria-selected','true')
 await expect(separator()).toHaveAttribute('aria-valuenow','584');await expect(page.getByRole('heading',{name:'Estadísticas por columna'})).toBeVisible()
 await expect(page.locator('.analysis-dock :focus')).toHaveCount(0) // el panel que ya estaba abierto no roba el foco
 await page.getByRole('button',{name:'Cerrar estadísticas'}).click();await page.getByRole('tab',{name:'uno.csv'}).click()
 await expect(page.getByRole('tablist',{name:'Herramientas de análisis'})).toHaveCount(0) // cerrado una vez, cerrado en todos los documentos
})

test('tras reiniciar con el mismo perfil se restauran visibilidad, pestaña y ancho, y solo se guarda eso',async()=>{
 await launch(files);await page.setViewportSize({width:1920,height:1080});await openDock('Análisis')
 await separator().focus();await page.keyboard.press('Shift+ArrowLeft');await page.keyboard.press('ArrowLeft')
 await expect(separator()).toHaveAttribute('aria-valuenow','600')
 expect(JSON.parse((await stored())!)).toEqual({version:1,dock:{visible:true,width:600,tab:'sql'}})
 await quit()
 await launch();await page.setViewportSize({width:1920,height:1080});await page.evaluate(paths=>window.freya.openPaths(paths),files);await expect(page.getByRole('grid')).toBeVisible() // el tamaño primero: un panel restaurado arranca cerrado si la ventana es estrecha (la de arranque en la CI lo es)
 await expect(page.getByRole('tablist',{name:'Herramientas de análisis'})).toBeVisible()
 await expect(page.getByRole('tab',{name:'SQL',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.getByLabel('Análisis SQL y asistentes')).toBeVisible()
 await expect(separator()).toHaveAttribute('aria-valuenow','600');expect(Math.abs(await dockWidth()-600)).toBeLessThanOrEqual(1)
 // cerrar también se recuerda
 await page.getByRole('button',{name:'Cerrar análisis SQL'}).click();await quit()
 await launch(files);await expect(page.getByRole('grid')).toBeVisible();await expect(page.getByRole('tablist',{name:'Herramientas de análisis'})).toHaveCount(0)
 expect(JSON.parse((await stored())!)).toEqual({version:1,dock:{visible:false,width:600,tab:'sql'}})
})

test('un valor guardado corrupto o de otra versión se ignora sin avisos y se usan los valores por defecto',async()=>{
 await launch(files);await page.evaluate(key=>localStorage.setItem(key,'{"version":2,"dock":{"visible":true,"width":900,"tab":"sql"}}'),KEY);await quit()
 await launch(files);await expect(page.getByRole('grid')).toBeVisible();await page.setViewportSize({width:1920,height:1080})
 await expect(page.getByRole('tablist',{name:'Herramientas de análisis'})).toHaveCount(0);await expect(page.locator('.toast,[role=alert]')).toHaveCount(0)
 await openDock('Estadísticas');await expect(separator()).toHaveAttribute('aria-valuenow','520');await expect(page.getByRole('tab',{name:'Resumen'})).toHaveAttribute('aria-selected','true')
 await page.evaluate(key=>localStorage.setItem(key,'{"version":1,"dock":'),KEY);await quit()
 await launch(files);await expect(page.getByRole('grid')).toBeVisible();await expect(page.getByRole('tablist',{name:'Herramientas de análisis'})).toHaveCount(0);await expect(page.locator('.toast,[role=alert]')).toHaveCount(0)
})
