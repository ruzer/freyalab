import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,readFile,readdir,realpath,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {basename,join,resolve} from 'node:path'
import {t,type Language} from '../../src/shared/i18n'
import type {ProjectManifest} from '../../src/shared/project'
import {closeElectron} from './close-electron'
import {runApplicationMenu} from './application-menu'
import {openAnalysis,showTable} from './panel'
import {projectTreeRow,openProjectRowMenu,chooseProjectAction} from './project-panel'

type Call={operation:string;args:unknown[];voidResult?:boolean;error?:string}
let app:ElectronApplication,page:Page,root:string,folder:string,source:string,original:Buffer,locale:Language,errors:string[]
let expectedFiles:Map<string,Buffer>
const tr=(key:string)=>t(key,{},locale)
const createDialog=()=>page.getByRole('dialog',{name:tr('project.new'),exact:true})
const sourceDialog=()=>page.getByRole('dialog',{name:tr('project.source.add'),exact:true})
const candidate=(name=basename(source))=>createDialog().getByRole('checkbox',{name:`Añadir «${name}» como primera fuente`,exact:true})
const calls=()=>app.evaluate(()=>Reflect.get(globalThis,'sim1eCalls') as Call[])
const manifest=async()=>JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8')) as ProjectManifest

async function fixture(path:string,bytes:Buffer){await writeFile(path,bytes);expectedFiles.set(path,bytes)}
async function openFile(path=source){
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.locator('.tabs[role=tablist]').getByRole('tab',{name:doc.name,exact:true})).toHaveAttribute('aria-selected','true')
 return doc
}
async function openCreate(){await runApplicationMenu(app,'file.newProject');await expect(createDialog()).toBeVisible()}
async function chooseFolder(){
 await createDialog().getByRole('button',{name:tr('project.pickFolder'),exact:true}).press('Enter')
 await expect(createDialog().getByRole('textbox',{name:tr('project.name'),exact:true})).toHaveValue('Censo')
}
async function create(){await chooseFolder();await createDialog().getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')}
async function cancelCreate(){await createDialog().press('Escape');await expect(createDialog()).toHaveCount(0)}
async function noCandidate(){await expect(createDialog().getByRole('checkbox')).toHaveCount(1);await expect(candidate()).toHaveCount(0)}
async function expectPrepared(count=1){
 await expect(createDialog()).toHaveCount(0);await expect(sourceDialog()).toBeVisible()
 await expect(sourceDialog().locator('.path')).toHaveText(source)
 await expect.poll(async()=>(await calls()).filter(call=>call.operation==='project:pickSource').map(call=>call.args)).toEqual(Array.from({length:count},()=>[source]))
 expect((await calls()).filter(call=>call.operation==='project:registerSource')).toEqual([])
 expect((await manifest()).sources).toEqual([])
}

test.beforeEach(async({},info)=>{
 locale=info.title.endsWith('[en-XA]')?'en-XA':info.title.endsWith('[en]')?'en':'es'
 root=await realpath(await mkdtemp(join(tmpdir(),'freya-project-from-csv-')));folder=join(root,'Censo');await mkdir(folder)
 expectedFiles=new Map();errors=[]
 const tsv=info.title.includes('TSV externo')
 source=join(tsv?root:folder,tsv?'externa.tsv':'encuesta.csv')
 original=await readFile(resolve(tsv?'tests/fixtures/project-from-open.tsv':'tests/fixtures/project-from-open.csv'));await fixture(source,original)
 const decoy=join(root,'selector-equivocado.csv');await fixture(decoy,Buffer.from('Archivo,Valor\nEquivocado,999\n'))
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:locale,FREYALAB_USER_DATA:join(root,'profile'),FREYALAB_TEST_FOLDER:folder,FREYALAB_TEST_PROJECT_SOURCE_PATH:decoy}})
 page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  type Call={operation:string;args:unknown[];voidResult?:boolean;error?:string}
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,handler=handlers.get('freya')!,calls:Call[]=[]
  Reflect.set(globalThis,'sim1eCalls',calls)
  handlers.set('freya',async(event,...args)=>{
   const operation=String(args[0]),observed=['project:pickFolder','project:create','project:pickSource','project:registerSource','project:discardSourceDraft','save','analyzeColumn','stats','sqlRun'].includes(operation)
   const call:Call={operation,args:structuredClone(args.slice(1))};if(observed)calls.push(call)
   try{const result=await handler(event,...args);if(operation==='project:create')call.voidResult=result===undefined;return result}
   catch(error){call.error=error instanceof Error?error.message:String(error);throw error}
  })
 })
})
test.afterEach(async({},info)=>{
 try{
  expect(errors).toEqual([])
  for(const [path,bytes] of expectedFiles)expect(await readFile(path)).toEqual(bytes)
  const observed=await calls();expect(observed.filter(call=>call.operation==='save')).toEqual([])
  await info.attach('sim1e-llamadas-reales',{body:JSON.stringify(observed,null,2),contentType:'application/json'})
 }finally{await closeElectron(app);await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
})

test('SIM-1e: el CSV limpio se prepara sin otro selector y solo se registra al confirmar la huella',async()=>{
 const doc=await openFile();expect(await calls()).toEqual([])
 await page.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
 await expect(candidate()).toBeChecked();await create();await expectPrepared()
 await expect(sourceDialog().getByRole('combobox',{name:tr('project.source.delimiter'),exact:true})).toHaveValue(';')
 await expect(sourceDialog().getByRole('combobox',{name:tr('project.source.eol'),exact:true})).toHaveValue('\r\n')
 await expect(sourceDialog().getByRole('listitem')).toHaveText(['ID','ID','(sin encabezado)','Nota'])
 await expect(sourceDialog()).not.toContainText(tr('project.source.externalNotice'))
 expect((await calls()).find(call=>call.operation==='project:create')?.voidResult).toBe(true)
 await sourceDialog().getByRole('button',{name:tr('project.source.register'),exact:true}).press('Enter')
 await expect(sourceDialog()).toHaveCount(0)
 const saved=await manifest();expect(saved.sources).toHaveLength(1)
 expect(saved.sources[0]).toMatchObject({path:'encuesta.csv',external:false,protection:'readonly',bytes:original.length,sha256:createHash('sha256').update(original).digest('hex'),format:{encoding:'utf8',delimiter:';',header:true,eol:'\r\n',finalEol:true}})
 expect(saved.sources[0].schema.columns).toEqual([{position:1,name:'ID'},{position:2,name:'ID'},{position:3,name:''},{position:4,name:'Nota'}])
 expect((await calls()).filter(call=>call.operation==='project:registerSource')).toHaveLength(1)
 expect((await calls()).filter(call=>['analyzeColumn','stats','sqlRun'].includes(call.operation))).toEqual([])
 expect((await page.evaluate(()=>window.freya.documents())).find(item=>item.id===doc.id)).toMatchObject({path:source,dirty:false,readonly:true,projectSource:'protected'})
 await expect(projectTreeRow(page,'encuesta.csv')).toBeVisible()
 await page.evaluate(async()=>{const {project,sources}=await window.freya.projectState();await window.freya.projectSaveRecipe(project!.id,{name:'Solo ID',sourceId:sources[0].id,steps:[{op:'select',columns:[{position:1,name:'ID'}]}]})})
 await chooseProjectAction(await openProjectRowMenu(projectTreeRow(page,'Solo ID')),'analysis.tab.open')
 await expect(page.locator('.tabs[role=tablist]').getByRole('tab',{selected:true})).toHaveAttribute('id',/^workspace-tab-analysis:/)
 expect((await page.evaluate(()=>window.freya.documents())).some(item=>item.analysisSubset&&item.path===null)).toBe(true)
 await openCreate();await noCandidate();await cancelCreate()
})

test('SIM-1e: el TSV externo conserva el aviso, permite cancelar la fuente y registra la ruta real',async()=>{
 await openFile();await openCreate();await expect(candidate()).toBeChecked();await create();await expectPrepared()
 await expect(sourceDialog().getByRole('listitem')).toHaveText(['Código','Ciudad','Nota'])
 await expect(sourceDialog().getByRole('combobox',{name:tr('project.source.delimiter'),exact:true})).toHaveValue('\t')
 await expect(sourceDialog().getByRole('status')).toHaveText(tr('project.source.externalNotice'))
 await sourceDialog().press('Escape');await expect(sourceDialog()).toHaveCount(0)
 expect((await manifest()).sources).toEqual([])
 await expect.poll(async()=>(await calls()).filter(call=>call.operation==='project:discardSourceDraft').length).toBe(1)
 await openCreate();await expect(candidate()).toBeChecked();await create();await expectPrepared(2)
 await expect(sourceDialog().getByRole('status')).toHaveText(tr('project.source.externalNotice'))
 await sourceDialog().getByRole('button',{name:tr('project.source.register'),exact:true}).press('Enter');await expect(sourceDialog()).toHaveCount(0)
 const saved=await manifest();expect(saved.sources).toHaveLength(1)
 expect(saved.sources[0]).toMatchObject({path:source,external:true,protection:'readonly',bytes:original.length,sha256:createHash('sha256').update(original).digest('hex'),format:{delimiter:'\t',eol:'\n',header:true}})
 expect(saved.sources[0].schema.columns.map(column=>column.name)).toEqual(['Código','Ciudad','Nota'])
 expect((await calls()).filter(call=>call.operation==='project:pickSource').map(call=>call.args)).toEqual([[source],[source]])
 expect((await calls()).filter(call=>call.operation==='project:registerSource')).toHaveLength(1)
})

test('SIM-1e: Escape no crea el proyecto y desmarcar la primera fuente no prepara ni registra nada',async()=>{
 await openFile();await openCreate();await expect(candidate()).toBeChecked();await chooseFolder();await cancelCreate()
 expect(await readdir(folder)).toEqual(['encuesta.csv']);expect((await page.evaluate(()=>window.freya.projectState())).project).toBeNull()
 await openCreate();await expect(candidate()).toBeChecked();await candidate().uncheck();await create()
 await expect(createDialog()).toHaveCount(0);await expect(page.getByRole('tab',{name:tr('project.tab'),exact:true})).toHaveAttribute('aria-selected','true')
 await expect(sourceDialog()).toHaveCount(0);expect((await manifest()).sources).toEqual([])
 expect((await calls()).filter(call=>['project:pickSource','project:registerSource'].includes(call.operation))).toEqual([])
 await openCreate();await expect(candidate()).toBeChecked();await cancelCreate()
})

test('SIM-1e: no ofrece el CSV desde cambios pendientes, texto, documentos sin ruta u otra pestaña',async()=>{
 await openFile();await openCreate();await expect(candidate()).toBeChecked();await cancelCreate()
 const cell=page.getByRole('gridcell',{name:'Fila 1, ID',exact:true}).first();await cell.dblclick();await cell.getByRole('textbox').fill('00777')
 await openCreate();await noCandidate();await cancelCreate()
 await expect(cell).toContainText('00777');expect((await page.evaluate(()=>window.freya.documents())).find(doc=>doc.path===source)?.dirty).toBe(true)
 const textFile=join(root,'texto.csv');await fixture(textFile,original);await openFile(textFile)
 await page.locator('[data-csv-view]').getByRole('button',{name:'Texto',exact:true}).click()
 const editor=page.locator('.cm-content');await editor.click();await editor.press('ControlOrMeta+End');await page.keyboard.insertText('00009;Puebla;;pendiente\r\n')
 await openCreate();await noCandidate();await cancelCreate()
 expect((await page.evaluate(()=>window.freya.documents())).find(doc=>doc.path===textFile)?.dirty).toBe(true)
 await page.locator('.toolbar-left').getByRole('button',{name:/^Nuevo/}).click();await page.getByRole('button',{name:'Tabla CSV',exact:true}).click()
 await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
 const selected=await page.locator('.tabs[role=tablist]').getByRole('tab',{selected:true}).getAttribute('id')
 expect((await page.evaluate(()=>window.freya.documents())).find(doc=>'workspace-tab-'+doc.id===selected)).toMatchObject({kind:'csv',path:null})
 await openCreate();await noCandidate();await cancelCreate()
 const markdown=join(root,'notas.md');await fixture(markdown,Buffer.from('# Documento guardado\n'));await openFile(markdown)
 await openCreate();await noCandidate();await cancelCreate()
 const clean=join(root,'contexto.csv');await fixture(clean,original);await openFile(clean);await openAnalysis(page)
 await expect(page.locator('.tabs[role=tablist]').getByRole('tab',{selected:true})).toHaveAttribute('id',/^workspace-tab-analysis:/)
 await openCreate();await noCandidate();await cancelCreate()
 await showTable(page);await openCreate();await expect(candidate('contexto.csv')).toBeChecked();await cancelCreate()
 expect((await calls()).filter(call=>['project:create','project:pickSource','project:registerSource'].includes(call.operation))).toEqual([])
})

for(const language of ['es','en','en-XA'] as const)test(`SIM-1e: Inicio, Nuevo, lateral y menú nativo comparten el diálogo [${language}]`,async()=>{
 const welcome=page.locator('.welcome-actions')
 await expect(welcome.getByRole('button')).toHaveCount(4)
 await welcome.getByRole('button').filter({has:page.getByText(tr('menu.file.newProject'),{exact:true})}).press('Enter')
 await expect(createDialog()).toBeVisible();await noCandidate();await cancelCreate()
 await page.locator('.toolbar-left').getByRole('button',{name:/^Nuevo/}).click()
 await page.locator('.dropdown').getByRole('button',{name:tr('menu.file.newProject'),exact:true}).press('Enter')
 await expect(createDialog()).toBeVisible();await noCandidate();await cancelCreate()
 await page.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
 await expect(createDialog()).toBeVisible();await noCandidate();await cancelCreate()
 await openCreate();await noCandidate();await cancelCreate()
 expect(await readdir(folder)).toEqual(['encuesta.csv'])
 expect((await calls()).filter(call=>['project:create','project:pickSource','project:registerSource'].includes(call.operation))).toEqual([])
})

test('SIM-1e: cambiar el archivo después de preparar la fuente conserva el rechazo y no registra datos distintos',async()=>{
 await openFile();await openCreate();await expect(candidate()).toBeChecked();await create();await expectPrepared()
 const changed=Buffer.concat([original,Buffer.from('00009;Puebla;;cambio externo\r\n')]);await fixture(source,changed)
 await sourceDialog().getByRole('button',{name:tr('project.source.register'),exact:true}).press('Enter')
 await expect(sourceDialog().getByRole('alert')).toHaveText(tr('project.source.changed'))
 expect((await manifest()).sources).toEqual([])
 expect((await calls()).filter(call=>call.operation==='project:registerSource')).toHaveLength(1)
 expect((await calls()).find(call=>call.operation==='project:registerSource')?.error).toContain(tr('project.source.changed'))
})

test('SIM-1e: una carpeta con proyecto futuro conserva sus bytes y rechaza la primera fuente',async()=>{
 const future=Buffer.from('{"format":"freyalab-project","version":2,"id":"future","name":"El futuro","datosDesconocidos":{"keep":true}}\n')
 await fixture(join(folder,'proyecto.freyalab'),future)
 await openFile();await openCreate();await expect(candidate()).toBeChecked();await create()
 await expect(createDialog()).toHaveCount(0);await expect(sourceDialog()).toHaveCount(0)
 await expect(page.locator('.toast.error')).toContainText(tr('project.error.readonly'))
 expect((await page.evaluate(()=>window.freya.projectState())).project).toMatchObject({id:'future',version:2,readonly:true})
 expect(await readFile(join(folder,'proyecto.freyalab'))).toEqual(future)
 expect((await calls()).filter(call=>call.operation==='project:registerSource')).toEqual([])
})
