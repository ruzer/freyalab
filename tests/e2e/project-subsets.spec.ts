import {expect,test,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import type {ProjectManifest,ProjectRecipe} from '../../src/shared/project'
import {closeElectron} from './close-electron'
import {menuItem,openCsvCommands} from './panel'
import {t,type Language} from '../../src/shared/i18n'
import {projectTreeRow,openProjectMenu,openProjectRowMenu,chooseProjectAction} from './project-panel'

let app:ElectronApplication,page:Page,root:string,folder:string,source:string,original:Buffer,locale:Language='es'
let pageErrors:string[]=[],consoleErrors:string[]=[]
const projectPanel=()=>page.getByRole('tabpanel',{name:t('project.tab',{},locale),exact:true})
const subsetPanel=()=>page.getByRole('region',{name:'Conjunto',exact:true})
const manifest=async()=>JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8')) as ProjectManifest

test.beforeEach(async({},info)=>{
 locale=info.title.endsWith('[en-XA]')?'en-XA':info.title.endsWith('[en]')?'en':'es'
 root=await mkdtemp(join(tmpdir(),'freya-subsets-e2e-'));folder=join(root,'Censo');await mkdir(folder)
 source=join(folder,'censo.csv');original=await readFile(resolve('tests/fixtures/prj02-censo.csv'));await writeFile(source,original)
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,
  args:process.env.FREYALAB_EXECUTABLE?[]:[resolve(process.env.FREYALAB_TEST_PROJECT_ENTRY??'out/main/index.js')],
  env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:locale,FREYALAB_USER_DATA:join(root,'profile'),FREYALAB_TEST_FOLDER:folder,FREYALAB_TEST_PROJECT_SOURCE_PATH:source}})
 page=await app.firstWindow();pageErrors=[];consoleErrors=[]
 page.on('pageerror',error=>pageErrors.push(error.stack??error.message))
 page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())})
 await page.waitForFunction(()=>!!window.freya)
 await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async({},info)=>{
 try{await info.attach('renderer-errors',{body:Buffer.from(JSON.stringify({pageErrors,consoleErrors},null,2)),contentType:'application/json'});expect(pageErrors).toEqual([]);expect(consoleErrors).toEqual([])}
 finally{if(app)await closeElectron(app);await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
})

async function registerFixture(open=true){
 const tr=(key:string)=>t(key,{},locale),panel=page.getByRole('tabpanel',{name:tr('project.tab'),exact:true})
 await page.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
 const create=page.getByRole('dialog',{name:tr('project.new'),exact:true})
 await create.getByRole('button',{name:tr('project.pickFolder'),exact:true}).press('Enter')
 await create.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
 await panel.getByRole('button',{name:tr('project.source.add'),exact:true}).press('Enter')
 const sourceDialog=page.getByRole('dialog',{name:tr('project.source.add'),exact:true})
 await expect(sourceDialog.getByRole('listitem')).toHaveText(['ID','Entidad','Edad','Ingreso','Nota'])
 await sourceDialog.getByRole('button',{name:tr('project.source.register'),exact:true}).press('Enter')
 const row=projectTreeRow(page,'censo.csv',locale)
 await expect(row).not.toContainText(tr('project.source.status.changed'))
 await expect(row).not.toContainText(tr('project.source.status.missing'))
 await expect(panel.getByTitle(tr('project.source.protected'),{exact:true})).toBeVisible()
 await expect(panel.getByTitle(tr('project.source.protected'),{exact:true})).toHaveCount(1)
 const menu=await openProjectRowMenu(row,locale)
 await expect(menu.getByRole('menuitem',{name:tr('dialog.open.button'),exact:true})).toBeEnabled()
 if(open){await chooseProjectAction(menu,'dialog.open.button',locale);await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()}
 else await page.keyboard.press('Escape')
}

async function seedRecipes(build:(source:ProjectManifest['sources'][number])=>ProjectRecipe[],version=1){
 const stored=await manifest(),path=(await page.evaluate(()=>window.freya.projectState())).project!.path;await chooseProjectAction(await openProjectMenu(page,locale),'project.close',locale)
 await writeFile(join(folder,'proyecto.freyalab'),JSON.stringify({...stored,version,recipes:build(stored.sources[0])},null,2)+'\n')
 await page.evaluate(path=>window.freya.projectOpenRecent(path),path)
}
const recipeRow=(name:string)=>projectTreeRow(page,name,locale)
async function openStored(name:string){const menu=await openProjectRowMenu(recipeRow(name),locale),button=menu.getByRole('menuitem',{name:t('dialog.open.button',{},locale),exact:true});await expect(button).toBeEnabled();await chooseProjectAction(menu,'dialog.open.button',locale);await expect(subsetPanel()).toBeVisible()}

test('PRJ-02a: guarda la consulta de la fuente como conjunto, prueba sus siete registros y conserva el original',async()=>{
 await registerFixture()
 await menuItem(page,'Filtrar','Consulta avanzada')
 const query=page.getByRole('region',{name:'Consulta avanzada',exact:true})
 await query.getByRole('button',{name:'Añadir condición',exact:true}).click()
 await query.getByLabel('Columna de condición 1',{exact:true}).selectOption('1')
 await query.getByLabel('Operador de condición 1',{exact:true}).selectOption('equals')
 await query.getByLabel('Valor de condición 1',{exact:true}).fill('Oaxaca')
 await query.getByRole('button',{name:'Añadir condición',exact:true}).click()
 await query.getByLabel('Columna de condición 2',{exact:true}).selectOption('2')
 await query.getByLabel('Operador de condición 2',{exact:true}).selectOption('greaterEqual')
 await query.getByLabel('Valor de condición 2',{exact:true}).fill('18')
 await query.getByRole('button',{name:'Añadir orden',exact:true}).click()
 await query.getByLabel('Columna de orden 1',{exact:true}).selectOption('2')
 await query.getByLabel('Dirección de orden 1',{exact:true}).selectOption('true')
 await query.getByLabel('Orden numérico 1',{exact:true}).check()
 await query.getByRole('button',{name:'Aplicar consulta',exact:true}).click()

 await page.getByRole('button',{name:'Guardar como conjunto…',exact:true}).press('Enter')
 const panel=subsetPanel(),name=panel.getByRole('textbox',{name:'Nombre',exact:true})
 await expect(name).toBeFocused()
 await expect(panel.getByLabel('Valor de condición 1',{exact:true})).toHaveValue('Oaxaca')
 await expect(panel.getByLabel('Valor de condición 2',{exact:true})).toHaveValue('18')
 await expect(panel.getByLabel('Dirección de orden 1',{exact:true})).toHaveValue('true')
 await name.fill('Oaxaca, adultos')
 await panel.getByRole('checkbox',{name:'Todas las columnas',exact:true}).uncheck()
 for(const column of [1,3,5])await panel.getByRole('checkbox',{name:`Incluir columna ${column}`,exact:true}).check()
 await panel.getByRole('button',{name:'Probar',exact:true}).press('Enter')
 await expect(panel.getByRole('status').filter({hasText:'3 de 7 registros'})).toBeVisible()
 const rows=panel.getByRole('table',{name:'Vista previa del conjunto',exact:true}).locator('tbody tr')
 await expect(rows.locator('th')).toHaveText(['00128','00126','00123'])
 await expect(rows.last()).toContainText('línea 1\nlínea 2')
 await panel.getByRole('button',{name:'Guardar',exact:true}).press('Enter')
 await expect(projectPanel()).toContainText('Oaxaca, adultos')
 const saved=await manifest(),recipe=saved.recipes.find(value=>value.name==='Oaxaca, adultos')!
 expect(recipe.steps.map(step=>step.op)).toEqual(['filter','order','select'])
 expect(recipe).toMatchObject({sourceId:saved.sources[0].id,sourceSha256:saved.sources[0].sha256,semantics:1})
 expect(createHash('sha256').update(await readFile(source)).digest('hex')).toBe(createHash('sha256').update(original).digest('hex'))
})

test('PRJ-02a: semilla 7 repite la muestra y Escape permite conservar o descartar el borrador sin escribir',async()=>{
 await registerFixture()
 await page.getByRole('button',{name:'Guardar como conjunto…',exact:true}).press('Enter')
 const panel=subsetPanel();await panel.getByRole('textbox',{name:'Nombre',exact:true}).fill('Muestra reproducible')
 await panel.getByRole('combobox',{name:'Quedarme con',exact:true}).selectOption('randomRows')
 await panel.getByRole('spinbutton',{name:'Número de filas',exact:true}).fill('3')
 await panel.getByRole('spinbutton',{name:'Semilla',exact:true}).fill('7')
 const ids=panel.getByRole('table',{name:'Vista previa del conjunto',exact:true}).locator('tbody th')
 for(let run=0;run<3;run++){await panel.getByRole('button',{name:'Probar',exact:true}).press('Enter');await expect(ids).toHaveText(['00124','9007199254740993','00128'])}
 await expect(panel).toContainText('semilla 7')
 await panel.getByRole('button',{name:'Otra muestra',exact:true}).press('Enter')
 await expect(panel.getByRole('spinbutton',{name:'Semilla',exact:true})).not.toHaveValue('7')
 await panel.getByRole('textbox',{name:'Nombre',exact:true}).focus();await page.keyboard.press('Escape')
 const confirmation=page.getByRole('dialog',{name:'Cambios del conjunto',exact:true})
 await expect(confirmation).toContainText('¿Descartar los cambios del conjunto?')
 await confirmation.getByRole('button',{name:'Cancelar',exact:true}).press('Enter')
 await expect(panel).toBeVisible()
 await panel.getByRole('textbox',{name:'Nombre',exact:true}).focus();await page.keyboard.press('Escape')
 await confirmation.getByRole('button',{name:'Descartar cambios',exact:true}).press('Enter')
 await expect(panel).toHaveCount(0)
 expect((await manifest()).recipes).toEqual([]);expect(await readFile(source)).toEqual(original)
})

test('PRJ-02a: la búsqueda no entra al conjunto y el orden aleatorio no acotado se explica antes de ejecutar',async()=>{
 await registerFixture();await page.getByRole('textbox',{name:'Buscar en tabla',exact:true}).fill('Oaxaca')
 await page.getByRole('button',{name:'Guardar como conjunto…',exact:true}).press('Enter')
 const panel=subsetPanel();await panel.getByRole('textbox',{name:'Nombre',exact:true}).fill('Todas desde disco')
 await expect(panel.getByRole('note')).toContainText('La búsqueda «Oaxaca» no se guarda')
 await panel.getByRole('button',{name:'Probar',exact:true}).press('Enter')
 await expect(panel.getByRole('table',{name:'Vista previa del conjunto',exact:true}).locator('tbody tr')).toHaveCount(7)
 await expect(panel).toContainText('Todos los registros (7)')
 await panel.getByRole('button',{name:'Añadir orden',exact:true}).press('Enter')
 await panel.getByLabel('Columna de orden 1',{exact:true}).selectOption('2')
 await panel.getByLabel('Dirección de orden 1',{exact:true}).selectOption('true')
 await panel.getByLabel('Orden numérico 1',{exact:true}).check()
 await panel.getByRole('combobox',{name:'Quedarme con',exact:true}).selectOption('randomRows')
 await expect(panel.getByRole('button',{name:'Probar',exact:true})).toBeDisabled()
 await expect(panel).toContainText('Esta muestra necesita ordenar todo el archivo sin un límite')
 await panel.getByRole('combobox',{name:'Quedarme con',exact:true}).selectOption('first')
 await panel.getByRole('spinbutton',{name:'Número de filas',exact:true}).fill('2')
 await panel.getByRole('button',{name:'Probar',exact:true}).press('Enter')
 await expect(panel.getByRole('table',{name:'Vista previa del conjunto',exact:true}).locator('tbody th')).toHaveText(['00128','00126'])
 expect((await manifest()).recipes).toEqual([]);expect(await readFile(source)).toEqual(original)
})

for(const language of ['es','en','en-XA'] as const)test(`PRJ-02a: controles alcanzables, temas y disposición del conjunto [${language}]`,async({},info)=>{
 await registerFixture();const tr=(key:string)=>t(key,{},language)
 await page.getByRole('button',{name:tr('subset.saveAs'),exact:true}).press('Enter')
 const panel=page.getByRole('region',{name:tr('subset.title'),exact:true})
 await expect(panel.getByRole('textbox',{name:tr('subset.name'),exact:true})).toBeFocused()
 await panel.getByRole('textbox',{name:tr('subset.name'),exact:true}).fill('Conjunto visible')
 await panel.getByRole('button',{name:tr('subset.try'),exact:true}).press('Enter')
 await expect(panel.getByRole('table',{name:tr('subset.preview'),exact:true}).locator('tbody tr')).toHaveCount(7)
 for(const width of [1440,1280])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:width===1440?900:720});await page.getByRole('combobox',{name:'Tema'}).selectOption(theme)
  await expect.poll(()=>page.locator('html').evaluate(html=>html.classList.contains('dark'))).toBe(theme==='dark')
  await expect.poll(async()=>{const box=await panel.locator('footer').boundingBox();return !!box&&box.y>=0&&box.y+box.height<=await page.evaluate(()=>innerHeight)}).toBe(true)
  for(const name of [tr('subset.try'),t('dialog.save',{},language),tr('subset.close')])await expect(panel.locator('footer').getByRole('button',{name,exact:true})).toBeInViewport({ratio:1})
  await expect(panel.locator('header').getByRole('button',{name:tr('subset.close'),exact:true})).toBeInViewport({ratio:1})
  if(process.env.FREYALAB_PRJ02_EVIDENCE)await page.screenshot({path:info.outputPath(`prj02a-subset-${language}-${theme}-${width}x${width===1440?900:720}.png`),animations:'disabled'})
 }
 await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'})
 await panel.getByRole('button',{name:tr('subset.try'),exact:true}).focus();await expect(panel.getByRole('button',{name:tr('subset.try'),exact:true})).toBeFocused()
})

test('PRJ-02a: el borrador del conjunto sobrevive a cambiar de documento sin escribir en el proyecto',async()=>{
 await registerFixture();await page.getByRole('button',{name:'Guardar como conjunto…',exact:true}).press('Enter')
 await subsetPanel().getByRole('textbox',{name:'Nombre',exact:true}).fill('No perder este borrador')
 await subsetPanel().getByRole('combobox',{name:'Quedarme con',exact:true}).selectOption('first')
 await subsetPanel().getByRole('spinbutton',{name:'Número de filas',exact:true}).fill('2')
 const other=join(root,'otro.md');await writeFile(other,'# Otro documento\n')
 await page.evaluate(path=>window.freya.openPaths([path]),other)
 await expect(page.getByRole('tab',{name:'otro.md',exact:true})).toHaveAttribute('aria-selected','true')
 await page.getByRole('tab',{name:'censo.csv',exact:true}).click()
 await expect(subsetPanel()).toBeVisible()
 await expect(subsetPanel().getByRole('textbox',{name:'Nombre',exact:true})).toHaveValue('No perder este borrador')
 await expect(subsetPanel().getByRole('combobox',{name:'Quedarme con',exact:true})).toHaveValue('first')
 await expect(subsetPanel().getByRole('spinbutton',{name:'Número de filas',exact:true})).toHaveValue('2')
 expect((await manifest()).recipes).toEqual([]);expect(await readFile(source)).toEqual(original)
})

test('PRJ-02a: la versión futura muestra el conjunto reconocido con base desconocida sin ocultarlo ni reescribirlo',async()=>{
 await registerFixture();const stored=await manifest(),path=(await page.evaluate(()=>window.freya.projectState())).project!.path,rootSource=stored.sources[0],createdAt='2026-11-16T00:00:00.000Z'
 await chooseProjectAction(await openProjectMenu(page,locale),'project.close',locale)
 const future={...stored,version:2,recipes:[
  {id:'future-base',name:'Instrucciones desconocidas',sourceId:rootSource.id,sourceSha256:rootSource.sha256,semantics:2,steps:[{op:'future-step',untouched:'conservar'}],createdAt},
  {id:'recognized-child',name:'Dependiente reconocido',baseRecipeId:'future-base',sourceSha256:rootSource.sha256,semantics:1,steps:[],createdAt}
 ]}
 const untouched=JSON.stringify(future,null,2)+'\n';await writeFile(join(folder,'proyecto.freyalab'),untouched)
 await page.evaluate(path=>window.freya.projectOpenRecent(path),path)
 const state=await page.evaluate(()=>window.freya.projectState())
 expect(state.recipes).toEqual(expect.arrayContaining([expect.objectContaining({id:'recognized-child',rootSourceId:'',executable:false})]))
 await expect(projectPanel().getByText('Dependiente reconocido',{exact:true})).toBeVisible()
 await expect(projectPanel().getByRole('heading',{name:'No disponibles',exact:true})).toBeVisible()
 await expect(projectPanel().getByText('Instrucciones desconocidas',{exact:true})).toHaveCount(0)
 const menu=await openProjectRowMenu(recipeRow('Dependiente reconocido'),locale)
 await expect(menu.getByRole('menuitem',{name:'Renombrar',exact:true})).toBeDisabled()
 await expect(menu.getByRole('menuitem',{name:'Renombrar',exact:true})).toHaveAccessibleDescription(t('project.future',{version:2},locale))
 await expect(menu.getByRole('menuitem',{name:'Eliminar',exact:true})).toBeDisabled()
 await expect(menu.getByRole('menuitem',{name:'Eliminar',exact:true})).toHaveAccessibleDescription(t('project.future',{version:2},locale))
 await page.keyboard.press('Escape')
 expect(await readFile(join(folder,'proyecto.freyalab'),'utf8')).toBe(untouched);expect(await readFile(source)).toEqual(original)
})

test('PRJ-02a: un conjunto manual con depósito antes del orden sigue siendo ejecutable en solo lectura',async()=>{
 await registerFixture()
 await seedRecipes(source=>[{id:'manual-bounded',name:'Manual acotado',sourceId:source.id,sourceSha256:source.sha256,semantics:1,createdAt:'2026-11-16T00:00:00.000Z',steps:[{op:'sample',method:'random',rows:3,seed:7},{op:'order',by:[{column:{position:3,name:'Edad'},numeric:true,descending:true}]}]}])
 await openStored('Manual acotado');const panel=subsetPanel()
 await expect(panel).toContainText('Este conjunto tiene pasos que el panel no edita')
 await expect(panel.getByRole('textbox',{name:'Nombre',exact:true})).toBeDisabled()
 await expect(panel.getByRole('button',{name:'Probar',exact:true})).toBeEnabled()
 await panel.getByRole('button',{name:'Probar',exact:true}).press('Enter')
 await expect(panel.getByRole('table',{name:'Vista previa del conjunto',exact:true}).locator('tbody th')).toHaveText(['00128','9007199254740993','00124'])
 expect(await readFile(source)).toEqual(original)
})

test('PRJ-02a: una proyección hija no pierde columnas cuando su base ya no las conserva',async()=>{
 await registerFixture()
 await seedRecipes(source=>[
  {id:'base-selection',name:'Base sin Edad',sourceId:source.id,sourceSha256:source.sha256,semantics:1,createdAt:'2026-11-16T00:00:00.000Z',steps:[{op:'select',columns:[{position:1,name:'ID'},{position:5,name:'Nota'}]}]},
  {id:'child-selection',name:'Hijo con Edad',baseRecipeId:'base-selection',sourceSha256:source.sha256,semantics:1,createdAt:'2026-11-16T00:00:00.000Z',steps:[{op:'select',columns:[{position:1,name:'ID'},{position:3,name:'Edad'}]}]}
 ])
 await openStored('Hijo con Edad');const panel=subsetPanel()
 await expect(panel.getByRole('button',{name:'Probar',exact:true})).toBeDisabled()
 await expect(panel.getByRole('button',{name:'Guardar',exact:true})).toBeDisabled()
 await expect(panel).toContainText('Las columnas de la fuente cambiaron')
 const untouched=await readFile(join(folder,'proyecto.freyalab'),'utf8')
 expect((await manifest()).recipes.find(recipe=>recipe.id==='child-selection')?.steps).toEqual([{op:'select',columns:[{position:1,name:'ID'},{position:3,name:'Edad'}]}])
 await panel.getByRole('checkbox',{name:'Todas las columnas',exact:true}).check()
 await expect(panel.getByRole('button',{name:'Guardar',exact:true})).toBeEnabled()
 expect(await readFile(join(folder,'proyecto.freyalab'),'utf8')).toBe(untouched)
 expect(await readFile(source)).toEqual(original)
})

test('PRJ-02a: el prefijo manual conserva el límite del paso separado de las filas finales',async()=>{
 await registerFixture()
 await seedRecipes(source=>[{id:'manual-prefix',name:'Dos y luego adultos',sourceId:source.id,sourceSha256:source.sha256,semantics:1,createdAt:'2026-11-16T00:00:00.000Z',steps:[{op:'sample',method:'first',rows:2},{op:'filter',mode:'all',conditions:[{column:{position:3,name:'Edad'},op:'greaterEqual',value:'18',caseSensitive:false}]}]}])
 await openStored('Dos y luego adultos');const panel=subsetPanel()
 await expect(panel.getByRole('table',{name:'Vista previa del conjunto',exact:true}).locator('tbody th')).toHaveText(['00123'])
 await expect(panel.locator('.coverage')).toContainText('Filas finales del conjunto: 1')
 await expect(panel.locator('.coverage')).toContainText('Límite de 2 primeras filas; 2 filas obtenidas')
 await expect(panel.locator('.coverage')).not.toContainText('Paso ')
 await expect(panel.locator('.coverage')).not.toContainText('Primeras 1 filas')
 await expect(panel.locator('.coverage')).not.toContainText(/\b1 de 2\b|\b2 de 2\b/)
 expect(await readFile(source)).toEqual(original)
})


test('PRJ-02a: Proyecto prueba un prefijo sin abrir ni indexar la fuente como Tabla',async()=>{
 await registerFixture(false)
 expect(await page.evaluate(()=>window.freya.documents())).toEqual([])
 await chooseProjectAction(await openProjectRowMenu(projectTreeRow(page,'censo.csv',locale),locale),'subset.new',locale)
 const panel=subsetPanel(),host=page.getByRole('dialog',{name:'Conjunto · censo.csv',exact:true})
 await expect(host).toBeVisible();await expect(host).toContainText('Censo')
 await expect(panel.getByRole('textbox',{name:'Nombre',exact:true})).toBeFocused()
 await panel.getByRole('textbox',{name:'Nombre',exact:true}).fill('Prefijo desde Proyecto')
 await panel.getByRole('combobox',{name:'Quedarme con',exact:true}).selectOption('first')
 await panel.getByRole('spinbutton',{name:'Número de filas',exact:true}).fill('2')
 await panel.getByRole('button',{name:'Probar',exact:true}).press('Enter')
 await expect(panel.getByRole('table',{name:'Vista previa del conjunto',exact:true}).locator('tbody th')).toHaveText(['00123','00124'])
 expect(await page.evaluate(()=>window.freya.documents())).toEqual([])
 expect((await manifest()).recipes).toEqual([]);expect(await readFile(source)).toEqual(original)
})


test('PRJ-02a: elegir una columna no autoriza sus renombres futuros al restaurar un borrador',async()=>{
 await registerFixture();await page.getByRole('button',{name:'Guardar como conjunto…',exact:true}).press('Enter')
 let panel=subsetPanel();await panel.getByRole('textbox',{name:'Nombre',exact:true}).fill('Edad elegida explícitamente')
 await panel.getByRole('button',{name:'Añadir condición',exact:true}).click()
 await panel.getByLabel('Columna de condición 1',{exact:true}).selectOption('2')
 await panel.getByLabel('Operador de condición 1',{exact:true}).selectOption('greaterEqual')
 await panel.getByLabel('Valor de condición 1',{exact:true}).fill('18')
 const other=join(root,'esquema.md');await writeFile(other,'# Mientras se registra el esquema\n')
 await page.evaluate(path=>window.freya.openPaths([path]),other)
 await expect(page.getByRole('tab',{name:'esquema.md',exact:true})).toHaveAttribute('aria-selected','true')
 const changed=Buffer.from(original.toString('utf8').replace('Edad','Años'));await writeFile(source,changed)
 await page.evaluate(async()=>{const state=await window.freya.projectState();await window.freya.projectReregisterSource(state.project!.id,state.sources[0].id,crypto.randomUUID())})
 await page.getByRole('tab',{name:'censo.csv',exact:true}).click();panel=subsetPanel()
 await expect(panel).toBeVisible()
 await expect(panel.getByRole('button',{name:'Probar',exact:true})).toBeDisabled()
 await expect(panel).toContainText('Las columnas de la fuente cambiaron')
 await panel.getByLabel('Columna de condición 1',{exact:true}).selectOption('2')
 await expect(panel.getByRole('button',{name:'Probar',exact:true})).toBeEnabled()
 expect((await manifest()).recipes).toEqual([]);expect(await readFile(source)).toEqual(changed)
})

test('PRJ-02a: cerrar y reabrir la fuente conserva el borrador en memoria sin persistirlo',async()=>{
 await registerFixture();await page.getByRole('button',{name:'Guardar como conjunto…',exact:true}).press('Enter')
 await subsetPanel().getByRole('textbox',{name:'Nombre',exact:true}).fill('Borrador de la fuente registrada')
 await page.getByRole('button',{name:'Cerrar censo.csv',exact:true}).click()
 await expect(page.getByRole('tab',{name:'censo.csv',exact:true})).toHaveCount(0)
 await chooseProjectAction(await openProjectRowMenu(projectTreeRow(page,'censo.csv',locale),locale),'dialog.open.button',locale)
 await expect(subsetPanel()).toBeVisible()
 await expect(subsetPanel().getByRole('textbox',{name:'Nombre',exact:true})).toHaveValue('Borrador de la fuente registrada')
 expect((await manifest()).recipes).toEqual([]);expect(await readFile(source)).toEqual(original)
})

for(const language of ['es','en-XA'] as const)test(`PRJ-02a: Proyecto presenta una cadena de tres niveles sin abrir la fuente [${language}]`,async({},info)=>{
 await registerFixture(false)
 await seedRecipes(source=>[
  {id:'three-base',name:'Adultos',sourceId:source.id,sourceSha256:source.sha256,semantics:1,createdAt:'2026-11-16T00:00:00.000Z',steps:[{op:'filter',mode:'all',conditions:[{column:{position:3,name:'Edad'},op:'greaterEqual',value:'18',caseSensitive:false}]}]},
  {id:'three-sample',name:'Muestra estable',baseRecipeId:'three-base',sourceSha256:source.sha256,semantics:1,createdAt:'2026-11-16T00:00:00.000Z',steps:[{op:'sample',method:'random',rows:3,seed:7}]},
  {id:'three-columns',name:'Identificador y nota',baseRecipeId:'three-sample',sourceSha256:source.sha256,semantics:1,createdAt:'2026-11-16T00:00:00.000Z',steps:[{op:'select',columns:[{position:1,name:'ID'},{position:5,name:'Nota'}]}]}
 ])
 for(const name of ['Adultos','Muestra estable','Identificador y nota'])await expect(projectPanel().getByText(name,{exact:true})).toBeVisible()
 const sourceRow=projectTreeRow(page,'censo.csv',locale)
 const adults=sourceRow.getByRole('group').getByRole('treeitem',{name:'Adultos',exact:true})
 const sample=adults.getByRole('group').getByRole('treeitem',{name:'Muestra estable',exact:true})
 const columns=sample.getByRole('group').getByRole('treeitem',{name:'Identificador y nota',exact:true})
 await expect(columns).toHaveCount(1)
 for(const [row,level] of [[sourceRow,1],[adults,2],[sample,3],[columns,4]] as const)await expect(row).toHaveAttribute('aria-level',String(level))
 const menu=await openProjectRowMenu(recipeRow('Adultos'),locale),remove=menu.getByRole('menuitem',{name:t('subset.remove',{},language),exact:true})
 await expect(remove).toBeDisabled()
 await expect(remove).toHaveAccessibleDescription(t('subset.hasDependents.other',{count:2,names:'Muestra estable; Identificador y nota'},locale))
 await page.keyboard.press('Escape')
 const slider=page.getByRole('slider',{name:'Ancho del explorador',exact:true})
 for(let step=0;step<24;step++)await slider.press('ArrowRight')
 await expect(slider).toHaveAttribute('aria-valuenow','420')
 for(const width of [1440,1280])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:width===1440?900:720});await page.getByRole('combobox',{name:'Tema'}).selectOption(theme)
  await expect.poll(()=>page.locator('html').evaluate(html=>html.classList.contains('dark'))).toBe(theme==='dark')
  await projectPanel().getByText('Identificador y nota',{exact:true}).scrollIntoViewIfNeeded()
  await projectPanel().getByText('Adultos',{exact:true}).scrollIntoViewIfNeeded()
  for(const name of ['Adultos','Muestra estable','Identificador y nota'])await expect(projectPanel().getByText(name,{exact:true})).toBeInViewport({ratio:1})
  if(process.env.FREYALAB_PRJ02_EVIDENCE)await page.screenshot({path:info.outputPath(`prj02a-project-chain-${language}-${theme}-${width}x${width===1440?900:720}.png`),animations:'disabled'})
 }
 expect(await page.evaluate(()=>window.freya.documents())).toEqual([])
 expect(await readFile(source)).toEqual(original)
})


function oaxacaRecipe(source:ProjectManifest['sources'][number]):ProjectRecipe{return{
 id:'oaxaca-base',name:'Oaxaca, adultos',sourceId:source.id,sourceSha256:source.sha256,semantics:1,createdAt:'2026-11-16T00:00:00.000Z',steps:[
  {op:'filter',mode:'all',conditions:[{column:{position:2,name:'Entidad'},op:'equals',value:'Oaxaca',caseSensitive:false},{column:{position:3,name:'Edad'},op:'greaterEqual',value:'18',caseSensitive:false}]},
  {op:'order',by:[{column:{position:3,name:'Edad'},numeric:true,descending:true}]},
  {op:'select',columns:[{position:1,name:'ID'},{position:3,name:'Edad'},{position:5,name:'Nota'}]}
 ]}}
const firstChild=(source:ProjectManifest['sources'][number]):ProjectRecipe=>({id:'dos-child',name:'Dos mayores',baseRecipeId:'oaxaca-base',sourceSha256:source.sha256,semantics:1,createdAt:'2026-11-16T00:00:00.000Z',steps:[{op:'sample',method:'first',rows:2}]})

test('PRJ-02a: una transición futura no desbloquea una fuente abierta que deja de reconocerse',async()=>{
 await registerFixture()
 const state=await page.evaluate(()=>window.freya.projectState()),doc=(await page.evaluate(()=>window.freya.documents()))[0],stored=await manifest()
 const future=JSON.stringify({...stored,version:2,sources:stored.sources.map(source=>({...source,futureDialect:'no interpretar'}))})
 await writeFile(join(folder,'proyecto.freyalab'),future)
 await page.evaluate(id=>window.freya.projectRename(id,'No se escribe'),state.project!.id)
 const after=await page.evaluate(()=>window.freya.projectState())
 expect(after.project).toMatchObject({readonly:true,version:2});expect(after.sources).toEqual([])
 expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)).toMatchObject({projectSource:'closed',readonly:true,dirty:false})
 await expect(page.evaluate(id=>window.freya.tableEdit(id,{type:'cell',rowId:'1',column:0,value:'no escribir'}),doc.id)).rejects.toThrow()
 expect(await readFile(source)).toEqual(original);expect(await readFile(join(folder,'proyecto.freyalab'),'utf8')).toBe(future)
})

test('PRJ-02a: encadena dos mayores, equivale a pasos planos y confirma el impacto y la eliminación',async()=>{
 await registerFixture();await seedRecipes(source=>[oaxacaRecipe(source)])
 await chooseProjectAction(await openProjectRowMenu(recipeRow('Oaxaca, adultos'),locale),'subset.newFromThis',locale)
 let panel=subsetPanel();await expect(panel.getByRole('textbox',{name:'Nombre',exact:true})).toBeFocused()
 await panel.getByRole('textbox',{name:'Nombre',exact:true}).fill('Dos mayores')
 await panel.getByRole('checkbox',{name:'Todas las columnas',exact:true}).uncheck()
 await expect(panel.getByRole('checkbox',{name:/^Incluir columna /})).toHaveCount(3)
 for(const position of [1,3,5])await expect(panel.getByRole('checkbox',{name:`Incluir columna ${position}`,exact:true})).toBeVisible()
 await panel.getByRole('checkbox',{name:'Todas las columnas',exact:true}).check()
 await panel.getByRole('combobox',{name:'Quedarme con',exact:true}).selectOption('first')
 await panel.getByRole('spinbutton',{name:'Número de filas',exact:true}).fill('2')
 await panel.getByRole('button',{name:'Probar',exact:true}).press('Enter')
 await expect(panel.getByRole('table',{name:'Vista previa del conjunto',exact:true}).locator('tbody th')).toHaveText(['00128','00126'])
 await expect(panel.locator('.coverage')).toContainText('Las 2 primeras de las 3 filas que cumplen')
 const equivalent=await page.evaluate(async()=>{const state=await window.freya.projectState(),source=state.sources[0],base=state.recipes.find(recipe=>recipe.id==='oaxaca-base')!;return window.freya.projectRecipeTry(state.project!.id,{name:'Equivalencia plana',sourceId:source.id,steps:[...base.steps,{op:'sample',method:'first',rows:2}]},crypto.randomUUID())})
 expect(equivalent.rows.map(row=>row[0])).toEqual(['00128','00126']);expect(equivalent.complete).toBe(true)
 await panel.getByRole('button',{name:'Guardar',exact:true}).press('Enter')
 await expect(projectPanel().getByText('Dos mayores',{exact:true})).toBeVisible()
 const saved=await manifest(),child=saved.recipes.find(recipe=>recipe.name==='Dos mayores')!
 expect(child).toMatchObject({baseRecipeId:'oaxaca-base',steps:[{op:'sample',method:'first',rows:2}]})
 const sourceMenu=await openProjectRowMenu(projectTreeRow(page,'censo.csv',locale),locale)
 await expect(sourceMenu.getByRole('menuitem',{name:'Quitar del proyecto',exact:true})).toBeDisabled()
 await page.keyboard.press('Escape')
 const menu=await openProjectRowMenu(recipeRow('Oaxaca, adultos'),locale),remove=menu.getByRole('menuitem',{name:'Eliminar',exact:true})
 await expect(remove).toBeDisabled()
 await expect(recipeRow('Oaxaca, adultos')).toContainText('Entidad')
 await expect(recipeRow('Oaxaca, adultos')).not.toContainText('Listo')
 await expect(recipeRow('Oaxaca, adultos')).not.toContainText(t('project.source.status.changed',{},locale))
 await expect(recipeRow('Oaxaca, adultos')).not.toContainText(t('project.source.status.missing',{},locale))
 await expect(menu.getByRole('menuitem',{name:'Abrir',exact:true})).toBeEnabled()
 await expect(menu.getByRole('menuitem',{name:'Analizar',exact:true})).toBeEnabled()
 await expect(remove).toHaveAccessibleDescription(t('subset.hasDependents.one',{count:1,names:'Dos mayores'},locale))
 await page.keyboard.press('Escape')
 await openStored('Oaxaca, adultos');panel=subsetPanel()
 await expect(panel.getByRole('combobox',{name:'Partir de',exact:true}).locator('option')).not.toContainText(['Dos mayores'])
 await panel.getByLabel('Valor de condición 2',{exact:true}).fill('20')
 await panel.getByRole('button',{name:'Guardar',exact:true}).press('Enter')
 const impact=page.getByRole('dialog',{name:'Este conjunto es base de otros',exact:true})
 await expect(impact).toContainText('Afecta a 1 conjunto: Dos mayores')
 await impact.getByRole('button',{name:'Guardar',exact:true}).press('Enter')
 await expect(panel).toHaveCount(0)
 await chooseProjectAction(await openProjectRowMenu(recipeRow('Dos mayores'),locale),'subset.remove',locale)
 const confirmation=page.getByRole('dialog',{name:'Eliminar conjunto',exact:true})
 await expect(confirmation).toContainText('Solo se borra su definición del proyecto; la fuente y los archivos no cambian.')
 await confirmation.getByRole('button',{name:'Eliminar',exact:true}).press('Enter')
 await expect(projectPanel().getByText('Dos mayores',{exact:true})).toHaveCount(0)
 expect((await manifest()).recipes.map(recipe=>recipe.id)).toEqual(['oaxaca-base']);expect(await readFile(source)).toEqual(original)
})

test('PRJ-02a: un cambio de esquema marca la base y su hijo hasta reelegir la columna y guardar',async()=>{
 await registerFixture();await seedRecipes(source=>[oaxacaRecipe(source),firstChild(source)])
 const changed=Buffer.from(original.toString('utf8').replace('Edad','Años'));await writeFile(source,changed)
 await expect(projectTreeRow(page,'censo.csv',locale).getByText(t('project.source.status.changed',{},locale),{exact:true})).toBeVisible()
 await expect(projectPanel().getByTitle(t('project.source.protected',{},locale),{exact:true})).toBeVisible()
 await projectTreeRow(page,'censo.csv',locale).getByRole('button',{name:'Volver a registrar',exact:true}).press('Enter')
 for(const name of ['Oaxaca, adultos','Dos mayores'])await expect(recipeRow(name)).toHaveAccessibleDescription(/Las columnas de censo\.csv cambiaron: la columna 3 era «Edad» y ahora es «Años»/)
 await openStored('Oaxaca, adultos');const panel=subsetPanel()
 await expect(panel.getByRole('button',{name:'Probar',exact:true})).toBeDisabled()
 await expect(panel.getByRole('button',{name:'Guardar',exact:true})).toBeDisabled()
 await expect(panel.getByLabel('Columna de condición 2',{exact:true})).toHaveAttribute('aria-invalid','true')
 await expect(panel.getByRole('table',{name:'Vista previa del conjunto',exact:true})).toHaveCount(0)
 await panel.getByLabel('Columna de condición 2',{exact:true}).selectOption('2')
 await expect(panel.getByRole('button',{name:'Probar',exact:true})).toBeEnabled()
 await panel.getByRole('button',{name:'Probar',exact:true}).press('Enter')
 await expect(panel.getByRole('table',{name:'Vista previa del conjunto',exact:true}).locator('tbody th')).toHaveText(['00128','00126','00123'])
 await panel.getByRole('button',{name:'Guardar',exact:true}).press('Enter')
 await page.getByRole('dialog',{name:'Este conjunto es base de otros',exact:true}).getByRole('button',{name:'Guardar',exact:true}).press('Enter')
 await expect(panel).toHaveCount(0)
 await openStored('Dos mayores')
 await expect(subsetPanel().getByRole('table',{name:'Vista previa del conjunto',exact:true}).locator('tbody th')).toHaveText(['00128','00126'])
 expect(await readFile(source)).toEqual(changed)
})

test('PRJ-02a: un cambio de celda exige registrar la fuente y avisa la versión distinta al volver a probar',async()=>{
 await registerFixture();await seedRecipes(source=>[oaxacaRecipe(source)])
 const stored=await manifest(),changed=Buffer.from(original.toString('utf8').replace('00124,Oaxaca,17','00124,Oaxaca,18'));await writeFile(source,changed)
 await expect(projectTreeRow(page,'censo.csv',locale).getByText(t('project.source.status.changed',{},locale),{exact:true})).toBeVisible()
 await expect(projectPanel().getByTitle(t('project.source.protected',{},locale),{exact:true})).toBeVisible()
 const menu=await openProjectRowMenu(recipeRow('Oaxaca, adultos'),locale)
 await expect(menu.getByRole('menuitem',{name:'Abrir',exact:true})).toBeDisabled()
 await page.keyboard.press('Escape')
 await projectTreeRow(page,'censo.csv',locale).getByRole('button',{name:'Volver a registrar',exact:true}).press('Enter')
 await expect(recipeRow('Oaxaca, adultos')).toHaveAttribute('title',/Versión distinta de la fuente/)
 await openStored('Oaxaca, adultos');const panel=subsetPanel()
 await expect(panel.getByRole('table',{name:'Vista previa del conjunto',exact:true}).locator('tbody th')).toHaveText(['00128','00126','00123','00124'])
 await expect(panel.locator('.coverage')).toContainText('«censo.csv» es una versión distinta de la usada al guardar')
 expect((await manifest()).recipes[0].sourceSha256).toBe(stored.sources[0].sha256)
 expect((await manifest()).sources[0].sha256).toBe(createHash('sha256').update(changed).digest('hex'))
 expect(await readFile(source)).toEqual(changed)
})

test('PRJ-02a: un conjunto conocido de proyecto futuro se abre y prueba sin permitir mutaciones',async()=>{
 await registerFixture(false);await seedRecipes(source=>[{id:'future-known',name:'Dos conocidas',sourceId:source.id,sourceSha256:source.sha256,semantics:1,createdAt:'2026-11-16T00:00:00.000Z',steps:[{op:'sample',method:'first',rows:2}]}],2)
 const untouched=await readFile(join(folder,'proyecto.freyalab'),'utf8')
 const sourceMenu=await openProjectRowMenu(projectTreeRow(page,'censo.csv',locale),locale)
 await expect(sourceMenu.getByRole('menuitem',{name:'Nuevo conjunto…',exact:true})).toBeDisabled()
 await expect(sourceMenu.getByRole('menuitem',{name:'Nuevo conjunto…',exact:true})).toHaveAccessibleDescription(t('project.future',{version:2},locale))
 await page.keyboard.press('Escape')
 const menu=await openProjectRowMenu(recipeRow('Dos conocidas'),locale)
 for(const name of ['Renombrar','Eliminar']){
  await expect(menu.getByRole('menuitem',{name,exact:true})).toBeDisabled()
  await expect(menu.getByRole('menuitem',{name,exact:true})).toHaveAccessibleDescription(t('project.future',{version:2},locale))
 }
 await page.keyboard.press('Escape')
 await openStored('Dos conocidas');const panel=subsetPanel()
 await expect(panel.getByRole('textbox',{name:'Nombre',exact:true})).toBeDisabled()
 await expect(panel.getByRole('button',{name:'Guardar',exact:true})).toBeDisabled()
 await expect(panel.getByRole('table',{name:'Vista previa del conjunto',exact:true}).locator('tbody th')).toHaveText(['00123','00124'])
 await panel.getByRole('button',{name:'Probar',exact:true}).press('Enter')
 await expect(panel.getByRole('table',{name:'Vista previa del conjunto',exact:true}).locator('tbody th')).toHaveText(['00123','00124'])
 expect(await readFile(join(folder,'proyecto.freyalab'),'utf8')).toBe(untouched);expect(await readFile(source)).toEqual(original)
 expect(await page.evaluate(()=>window.freya.documents())).toEqual([])
})

test('PRJ-02a: la paleta encuentra los conjuntos con sinónimos y el nombre repetido bloquea guardar',async()=>{
 await registerFixture();await seedRecipes(source=>[oaxacaRecipe(source)])
 let palette=await openCsvCommands(page,app),search=palette.getByRole('searchbox',{name:'Buscar comando CSV',exact:true})
 for(const word of ['conjunto','subconjunto','muestra','muestreo','semilla','subset','sample','dataset','receta']){
  await search.fill(word)
  for(const label of ['Guardar como conjunto…','Nuevo conjunto…'])await expect(palette.getByRole('button',{name:new RegExp('^'+label)})).toBeEnabled()
 }
 await search.fill('nuevo conjunto');await search.press('Enter')
 const panel=subsetPanel();await panel.getByRole('textbox',{name:'Nombre',exact:true}).fill('OAXACA, ADULTOS')
 await expect(panel).toContainText('Ya hay un conjunto con ese nombre')
 await expect(panel.getByRole('button',{name:'Guardar',exact:true})).toBeDisabled()
 expect((await manifest()).recipes).toHaveLength(1);expect(await readFile(source)).toEqual(original)
})


test('PRJ-02a: una columna eliminada permanece pendiente hasta elegir Todas las columnas explícitamente',async()=>{
 await registerFixture();await seedRecipes(source=>[{id:'deleted-column',name:'ID y Nota pendiente',sourceId:source.id,sourceSha256:source.sha256,semantics:1,createdAt:'2026-11-16T00:00:00.000Z',steps:[{op:'select',columns:[{position:1,name:'ID'},{position:5,name:'Nota'}]}]}])
 const changed=Buffer.from('ID,Entidad,Edad,Ingreso\n00123,Oaxaca,34,1200\n00124,Oaxaca,17,0\n9007199254740993,Puebla,45,3400\n00126,Oaxaca,52,\n00127,Chiapas,29,2100\n00128,Oaxaca,61,5000\n00129,Puebla,15,0\n');await writeFile(source,changed)
 await expect(projectTreeRow(page,'censo.csv',locale).getByText(t('project.source.status.changed',{},locale),{exact:true})).toBeVisible()
 await expect(projectPanel().getByTitle(t('project.source.protected',{},locale),{exact:true})).toBeVisible()
 await projectTreeRow(page,'censo.csv',locale).getByRole('button',{name:'Volver a registrar',exact:true}).press('Enter')
 await openStored('ID y Nota pendiente');const panel=subsetPanel()
 await expect(panel.getByRole('button',{name:'Probar',exact:true})).toBeDisabled()
 await expect(panel.getByRole('button',{name:'Guardar',exact:true})).toBeDisabled()
 await expect(panel).toContainText('Revisa la columna 5')
 expect((await manifest()).recipes[0].steps).toEqual([{op:'select',columns:[{position:1,name:'ID'},{position:5,name:'Nota'}]}])
 await panel.getByRole('checkbox',{name:'Todas las columnas',exact:true}).check()
 await expect(panel.getByRole('button',{name:'Guardar',exact:true})).toBeEnabled()
 await panel.getByRole('button',{name:'Guardar',exact:true}).press('Enter')
 await expect(panel).toHaveCount(0)
 expect((await manifest()).recipes[0].steps).toEqual([]);expect(await readFile(source)).toEqual(changed)
})

test('PRJ-02a: la paleta describe por qué no puede guardar como conjunto un CSV sin registrar',async()=>{
 await registerFixture();const other=join(root,'sin-registrar.csv');await writeFile(other,original)
 await page.evaluate(path=>window.freya.openPaths([path]),other)
 await expect(page.getByRole('tab',{name:'sin-registrar.csv',exact:true})).toHaveAttribute('aria-selected','true')
 const palette=await openCsvCommands(page,app);await palette.getByRole('searchbox',{name:'Buscar comando CSV',exact:true}).fill('subset')
 for(const name of ['Guardar como conjunto…','Nuevo conjunto…']){
  const button=palette.getByRole('button',{name,exact:true})
  await expect(button).toBeDisabled()
  await expect(button).toHaveAccessibleDescription(t('subset.addSource'))
  await expect(button.locator('small')).toHaveText(t('subset.addSource'))
 }
 expect((await manifest()).recipes).toEqual([]);expect(await readFile(source)).toEqual(original);expect(await readFile(other)).toEqual(original)
})

test('PRJ-02a: reabrir el proyecto no revierte una columna ya reelegida en el borrador de una receta',async()=>{
 await registerFixture();await seedRecipes(source=>[{id:'repaired-draft',name:'Edad por reparar',sourceId:source.id,sourceSha256:source.sha256,semantics:1,createdAt:'2026-11-16T00:00:00.000Z',steps:[{op:'filter',mode:'all',conditions:[{column:{position:3,name:'Edad'},op:'greaterEqual',value:'18',caseSensitive:false}]}]}])
 const changed=Buffer.from(original.toString('utf8').replace('Edad','Años'));await writeFile(source,changed)
 await expect(projectTreeRow(page,'censo.csv',locale).getByText(t('project.source.status.changed',{},locale),{exact:true})).toBeVisible()
 await expect(projectPanel().getByTitle(t('project.source.protected',{},locale),{exact:true})).toBeVisible()
 await projectTreeRow(page,'censo.csv',locale).getByRole('button',{name:'Volver a registrar',exact:true}).press('Enter')
 await openStored('Edad por reparar');let panel=subsetPanel()
 await expect(panel.getByRole('button',{name:'Probar',exact:true})).toBeDisabled()
 await panel.getByLabel('Columna de condición 1',{exact:true}).selectOption('2')
 await expect(panel.getByRole('button',{name:'Probar',exact:true})).toBeEnabled()
 const path=await page.evaluate(async()=>{const state=await window.freya.projectState();await window.freya.projectClose(state.project!.id);return state.project!.path})
 await expect(panel).toHaveCount(0)
 await page.evaluate(path=>window.freya.projectOpenRecent(path),path)
 await openStored('Edad por reparar');panel=subsetPanel()
 await expect(panel.getByRole('button',{name:'Probar',exact:true})).toBeEnabled()
 await expect(panel.getByLabel('Columna de condición 1',{exact:true})).toHaveAttribute('aria-invalid','false')
 expect((await manifest()).recipes[0].steps).toEqual([{op:'filter',mode:'all',conditions:[{column:{position:3,name:'Edad'},op:'greaterEqual',value:'18',caseSensitive:false}]}])
 expect(await readFile(source)).toEqual(changed)
})

test('PRJ-02a: un borrador restaurado no sobrescribe una definición externa sin confirmarla',async()=>{
 await registerFixture(false)
 await seedRecipes(source=>[{id:'edited-outside',name:'Definición inicial',sourceId:source.id,sourceSha256:source.sha256,semantics:1,createdAt:'2026-11-16T00:00:00.000Z',steps:[]}])
 await openStored('Definición inicial')
 await subsetPanel().getByRole('textbox',{name:'Nombre',exact:true}).fill('Mi borrador conservado')
 const projectPath=(await page.evaluate(()=>window.freya.projectState())).project!.path
 await page.evaluate(async()=>{const state=await window.freya.projectState();await window.freya.projectClose(state.project!.id)})
 const stored=await manifest();stored.recipes[0].name='Versión externa';stored.recipes[0].steps=[{op:'sample',method:'first',rows:2}]
 await writeFile(join(folder,'proyecto.freyalab'),JSON.stringify(stored,null,2)+'\n')
 const external=await readFile(join(folder,'proyecto.freyalab'))
 await page.evaluate(path=>window.freya.projectOpenRecent(path),projectPath)
 await openStored('Versión externa')
 const panel=subsetPanel()
 await expect(panel.getByRole('textbox',{name:'Nombre',exact:true})).toHaveValue('Mi borrador conservado')
 await panel.getByRole('button',{name:'Guardar',exact:true}).press('Enter')
 const conflict=page.getByRole('dialog',{name:'El conjunto cambió',exact:true})
 await expect(conflict).toBeVisible();await expect(conflict).toContainText('reemplazará la definición guardada')
 expect(await readFile(join(folder,'proyecto.freyalab'))).toEqual(external)
 await conflict.getByRole('button',{name:'Cancelar',exact:true}).press('Enter')
 await expect(panel.getByRole('textbox',{name:'Nombre',exact:true})).toHaveValue('Mi borrador conservado')
 expect(await readFile(join(folder,'proyecto.freyalab'))).toEqual(external)
 await panel.getByRole('button',{name:'Guardar',exact:true}).press('Enter')
 await conflict.getByRole('button',{name:'Guardar',exact:true}).press('Enter')
 await expect(projectPanel()).toContainText('Mi borrador conservado')
 expect((await manifest()).recipes[0]).toMatchObject({id:'edited-outside',name:'Mi borrador conservado',steps:[]})
 expect(await readFile(source)).toEqual(original)
})
