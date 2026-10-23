import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'

let app:ElectronApplication|undefined,page:Page,folder:string,file:string
const KEY='freya-workspace'
async function launch(){
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_USER_DATA:join(folder,'profile'),FREYALAB_TEST_SAVE_DIR:join(folder,'saved'),FREYALAB_TEST_EXPORT_DIR:join(folder,'exports')},timeout:60000})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
}
// El tamaño se fija ANTES de abrir el archivo: la decisión de arranque se toma al medir el área de trabajo de la primera tabla.
async function openAt(width:number,height=800){await page.setViewportSize({width,height});await page.evaluate(path=>window.freya.openPaths([path]),file);await expect(page.locator('.csv-body')).toBeAttached()}
async function quit(){if(!app)return;await app.evaluate(async({session,app})=>{await session.defaultSession.flushStorageData();app.exit(0)}).catch(()=>{});await app.close().catch(()=>{});app=undefined}
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-dock-startup-'));await mkdir(join(folder,'saved'));await mkdir(join(folder,'exports'));file=join(folder,'ventas.csv')
 await writeFile(file,'Id,Ciudad,Valor\n'+Array.from({length:40},(_,r)=>`${r},C${r%5},${r%97}`).join('\n')+'\n')
})
test.afterEach(async()=>{await quit();await rm(folder,{recursive:true,force:true})})
const grid=()=>page.getByRole('grid')
const tools=()=>page.getByRole('tablist',{name:'Herramientas de análisis'})
const stored=async()=>JSON.parse((await page.evaluate(key=>localStorage.getItem(key),KEY))!)
const saved={version:1,dock:{visible:true,width:520,tab:'sql'}}
async function seedOpenDock(){await launch();await openAt(1920,1080);await page.getByRole('button',{name:'Análisis',exact:true}).click();await expect(tools()).toBeVisible();expect(await stored()).toEqual(saved);await quit()}

test('un panel guardado como abierto arranca cerrado si la ventana es estrecha y conserva lo guardado',async()=>{
 await seedOpenDock()
 await launch();await openAt(1100)
 await expect(grid()).toBeVisible();await expect(tools()).toHaveCount(0);await expect(page.getByText(/^Ventana estrecha/)).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Análisis',exact:true})).toHaveAttribute('aria-expanded','false');await expect(page.locator('.toast,[role=alert]')).toHaveCount(0)
 expect(await stored()).toEqual(saved) // la preferencia no se pierde: en una ventana ancha se restaurará abierto
 await page.getByRole('button',{name:'Análisis',exact:true}).click() // y la persona puede abrirlo cuando quiera
 await expect(tools()).toBeVisible();await expect(grid()).toBeHidden();await expect(page.getByText(/^Ventana estrecha/)).toBeVisible()
})

test('con una ventana ancha el mismo panel guardado se restaura abierto y acoplado',async()=>{
 await seedOpenDock()
 await launch();await openAt(1920,1080)
 await expect(tools()).toBeVisible();await expect(grid()).toBeVisible();await expect(page.getByRole('tab',{name:'SQL',exact:true})).toHaveAttribute('aria-selected','true')
 await expect(page.getByRole('separator',{name:'Ancho del panel'})).toBeVisible()
})

test('restaurado abierto en una ventana ancha: estrechar la ventana lo amplía y ensancharla lo acopla, sin cerrarlo',async()=>{
 await seedOpenDock()
 await launch();await openAt(1920,1080);await expect(tools()).toBeVisible()
 await page.setViewportSize({width:1100,height:800});await expect(tools()).toBeVisible();await expect(grid()).toBeHidden()
 await page.setViewportSize({width:1920,height:1080});await expect(tools()).toBeVisible();await expect(grid()).toBeVisible()
})

test('arrancó cerrado por la ventana estrecha: ensanchar la ventana después no lo abre solo',async()=>{
 await seedOpenDock()
 await launch();await openAt(1100);await expect(tools()).toHaveCount(0)
 await page.setViewportSize({width:1920,height:1080});await expect(grid()).toBeVisible();await expect(tools()).toHaveCount(0)
 expect(await stored()).toEqual(saved)
})
