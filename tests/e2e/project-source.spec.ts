import {expect,test,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t} from '../../src/shared/i18n'
import type {ProjectManifest} from '../../src/shared/project'
import {closeElectron} from './close-electron'

let app:ElectronApplication,page:Page,root:string,folder:string,source:string,copy:string
const fixture=Buffer.from('ID;ID;\r\n001;México;\r\n','utf8')
const projectTab=()=>page.getByRole('tab',{name:'Proyecto',exact:true})
const panel=()=>page.getByRole('tabpanel',{name:'Proyecto',exact:true})
const manifest=async()=>JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8')) as ProjectManifest

test.beforeEach(async({},info)=>{
 root=await mkdtemp(join(tmpdir(),'freya-source-e2e-'));folder=join(root,'Censo');await mkdir(folder)
 source=join(folder,'datos.csv');copy=join(root,'copia.csv');await writeFile(source,fixture)
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,
  args:process.env.FREYALAB_EXECUTABLE?[]:[resolve(process.env.FREYALAB_TEST_PROJECT_ENTRY??'out/main/index.js')],
  env:{...process.env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:info.title.endsWith('[en-XA]')?'en-XA':'es',FREYALAB_USER_DATA:join(root,'profile'),FREYALAB_TEST_FOLDER:folder,FREYALAB_TEST_PROJECT_SOURCE_PATH:source,FREYALAB_TEST_SAVE_PATH:copy}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya)
})
test.afterEach(async()=>{await closeElectron(app);await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

async function create(locale:'es'|'en-XA'='es'){
 const tr=(key:string)=>t(key,{},locale)
 await page.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
 const dialog=page.getByRole('dialog',{name:tr('project.new'),exact:true})
 await dialog.getByRole('button',{name:tr('project.pickFolder')}).press('Enter')
 await expect(dialog.getByRole('textbox',{name:tr('project.name'),exact:true})).toHaveValue('Censo')
 await dialog.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
}
async function register(){
 await panel().getByRole('button',{name:'Añadir fuente…',exact:true}).press('Enter')
 const dialog=page.getByRole('dialog',{name:'Añadir fuente…',exact:true})
 await expect(dialog.getByRole('combobox',{name:'Delimitador'})).toHaveValue(';')
 await expect(dialog.getByRole('combobox',{name:'Fin de línea'})).toHaveValue('\r\n')
 await expect(dialog.getByRole('listitem')).toHaveText(['ID','ID','(sin encabezado)'])
 await dialog.getByRole('checkbox',{name:'La primera fila contiene encabezados'}).press('Space')
 await expect(dialog.getByRole('listitem')).toHaveCount(3)
 await dialog.getByRole('checkbox',{name:'La primera fila contiene encabezados'}).press('Space')
 await expect(dialog.getByRole('listitem')).toHaveText(['ID','ID','(sin encabezado)'])
 await dialog.getByRole('button',{name:'Añadir y calcular huella',exact:true}).press('Enter')
 await expect(panel().getByText('Verificada · 🔒 Protegida')).toBeVisible()
}
test('registra un CSV con teclado, bloquea edición directa y deja guardar una copia exacta',async()=>{
 await create()
 await register()
 const [registered]=(await manifest()).sources
 expect(registered).toMatchObject({path:'datos.csv',external:false,protection:'readonly',sha256:createHash('sha256').update(fixture).digest('hex'),format:{encoding:'utf8',delimiter:';',eol:'\r\n',header:true}})
 expect(registered.schema.columns.map(column=>column.name)).toEqual(['ID','ID',''])
 await panel().getByRole('button',{name:'Abrir',exact:true}).press('Enter')
 await expect(page.getByRole('tab',{name:'datos.csv'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Guardar',exact:true})).toBeDisabled()
 const textView=page.locator('[data-csv-view]').getByRole('button',{name:'Texto',exact:true})
 await expect(textView).toBeDisabled()
 await expect(textView).toHaveAccessibleDescription(t('ui.reason.projectProtected'))
 await expect(textView).toHaveAttribute('title',`Texto · ${t('ui.reason.projectProtected')}`)
 const attempts=await page.evaluate(async()=>{
  const [document]=await window.freya.documents()
  const attempts=await Promise.allSettled([window.freya.save(document.id),window.freya.tableEdit(document.id,{type:'cell',rowId:'1',column:0,value:'cambio'}),window.freya.csvView(document.id,'text')])
  return attempts.map(result=>result.status)
 })
 expect(attempts).toEqual(['rejected','rejected','rejected'])
 await page.getByRole('button',{name:'Guardar como',exact:true}).press('Enter')
 await expect(page.getByRole('tab',{name:'copia.csv'})).toBeVisible()
 expect(await readFile(copy)).toEqual(fixture)
 expect(await readFile(source)).toEqual(fixture)
 expect((await page.evaluate(()=>window.freya.documents())).map(document=>[document.name,document.projectSource,document.readonly])).toEqual([['datos.csv','protected',true],['copia.csv',undefined,false]])
 await panel().getByRole('button',{name:'Cerrar proyecto',exact:true}).press('Enter')
 await expect(projectTab()).toHaveCount(0)
 expect((await page.evaluate(()=>window.freya.documents())).find(document=>document.name==='datos.csv')?.projectSource).toBe('closed')
 await page.getByRole('tab',{name:'datos.csv'}).click()
 await expect(textView).toBeDisabled()
 await expect(textView).toHaveAccessibleDescription(t('ui.reason.projectClosed'))
})

test('avisa cuando la fuente cambia y conserva la huella previa al volver a registrarla',async()=>{
 await create()
 await register()
 const [original]=(await manifest()).sources
 await panel().getByRole('button',{name:'Abrir',exact:true}).press('Enter')
 await expect(page.getByRole('tab',{name:'datos.csv'})).toBeVisible()
 const updated=Buffer.from('ID;ID;\r\n002;Xalapa;\r\n')
 await writeFile(source,updated)
 await expect(panel().getByText('Cambió desde que se registró · 🔒 Protegida')).toBeVisible()
 await panel().getByRole('button',{name:'Volver a registrar',exact:true}).press('Enter')
 await expect(panel().getByText('Verificada · 🔒 Protegida')).toBeVisible()
 const [saved]=(await manifest()).sources
 expect(saved).toMatchObject({id:original.id,sha256:createHash('sha256').update(updated).digest('hex'),history:[original.sha256]})
 expect(await readFile(source)).toEqual(updated)
})

test('busca por huella dentro del proyecto y solo reenlaza tras confirmar',async()=>{
 await create()
 await register()
 const [original]=(await manifest()).sources
 const moved=join(folder,'movido.csv');await rename(source,moved)
 await page.evaluate(async()=>{const state=await window.freya.projectState();await window.freya.projectClose(state.project!.id);await window.freya.projectOpenRecent(state.project!.path)})
 await projectTab().press('Enter')
 await expect(panel().getByText('No está en su ruta · 🔒 Protegida')).toBeVisible()
 await app.evaluate(({dialog})=>{dialog.showMessageBox=(async()=>({response:1,checkboxChecked:false})) as typeof dialog.showMessageBox})
 await panel().getByRole('button',{name:'Buscar en la carpeta del proyecto',exact:true}).press('Enter')
 await expect(panel().getByRole('button',{name:'Buscar en la carpeta del proyecto',exact:true})).toBeEnabled()
 expect((await manifest()).sources[0]?.path).toBe('datos.csv')
 await app.evaluate(({dialog})=>{dialog.showMessageBox=(async()=>({response:0,checkboxChecked:false})) as typeof dialog.showMessageBox})
 await panel().getByRole('button',{name:'Buscar en la carpeta del proyecto',exact:true}).press('Enter')
 await expect(panel().getByText('Verificada · 🔒 Protegida')).toBeVisible()
 expect((await manifest()).sources[0]).toMatchObject({id:original.id,sha256:original.sha256,path:'movido.csv'})
 expect(await readFile(moved)).toEqual(fixture)
})

for(const locale of ['es','en-XA'] as const)test(`diálogo y fuente protegida en colores claro y oscuro [${locale}]`,async({},info)=>{
 const tr=(key:string)=>t(key,{},locale)
 await create(locale)
 await page.setViewportSize({width:1440,height:900})
 const tab=page.getByRole('tabpanel',{name:tr('project.tab'),exact:true})
 await tab.getByRole('button',{name:tr('project.source.add'),exact:true}).press('Enter')
 const dialog=page.getByRole('dialog',{name:tr('project.source.add'),exact:true})
 await expect(dialog).toBeVisible()
 const theme=page.getByRole('combobox',{name:'Tema'})
 await dialog.press('Escape')
 await expect(dialog).toHaveCount(0)
 await theme.selectOption('light')
 await tab.getByRole('button',{name:tr('project.source.add'),exact:true}).press('Enter')
 await expect(dialog.getByRole('listitem')).toHaveCount(3)
 await page.screenshot({path:info.outputPath(`prj-01b-${locale}-light-1440x900.png`),animations:'disabled'})
 await dialog.getByRole('button',{name:tr('project.source.register'),exact:true}).press('Enter')
 await expect(tab.getByText(tr('project.source.badge'),{exact:false})).toBeVisible()
 await theme.selectOption('dark')
 await expect(page.locator('html')).toHaveClass(/dark/)
 await page.screenshot({path:info.outputPath(`prj-01b-${locale}-dark-1440x900.png`),animations:'disabled'})
})
