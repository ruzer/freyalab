import {expect,test,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {closeElectron} from './close-electron'
import {projectTreeRow,openProjectRowMenu} from './project-panel'
import {t,type Language} from '../../src/shared/i18n'

let app:ElectronApplication,page:Page,root:string,folder:string,source:string,output:string,original:Buffer,pageErrors:string[]=[],locale:Language='es'
const tr=(key:string)=>t(key,{},locale)
const panel=()=>page.getByRole('tabpanel',{name:tr('project.tab'),exact:true})
const row=(name:string)=>projectTreeRow(page,name,locale)
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex')

test.beforeEach(async({},info)=>{
 locale=info.title.endsWith('[en-XA]')?'en-XA':info.title.endsWith('[en]')?'en':'es'
 root=await mkdtemp(join(tmpdir(),'freya-project-exports-'));folder=join(root,'Censo');await mkdir(join(folder,'02_datasets'),{recursive:true})
 source=join(folder,'censo.csv');output=join(folder,'02_datasets','Oaxaca, adultos.csv')
 original=await readFile(resolve('tests/fixtures/prj02-censo.csv'));await writeFile(source,original)
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,
  args:process.env.FREYALAB_EXECUTABLE?[]:[resolve(process.env.FREYALAB_TEST_PROJECT_ENTRY??'out/main/index.js')],
  env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:locale,FREYALAB_USER_DATA:join(root,'profile'),FREYALAB_TEST_FOLDER:folder,FREYALAB_TEST_PROJECT_SOURCE_PATH:source,FREYALAB_TEST_EXTRACT_DIR:join(folder,'02_datasets')}})
 page=await app.firstWindow();pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));await page.waitForFunction(()=>!!window.freya)
 await page.setViewportSize({width:1440,height:900})
 await page.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
 const create=page.getByRole('dialog',{name:tr('project.new'),exact:true})
 await create.getByRole('button',{name:tr('project.pickFolder'),exact:true}).press('Enter');await create.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
 await panel().getByRole('button',{name:tr('project.source.add'),exact:true}).press('Enter')
 const add=page.getByRole('dialog',{name:tr('project.source.add'),exact:true})
 await expect(add.getByRole('listitem')).toHaveText(['ID','Entidad','Edad','Ingreso','Nota'])
 await add.getByRole('button',{name:tr('project.source.register'),exact:true}).press('Enter');await expect(add).toHaveCount(0)
 await page.evaluate(async()=>{
  const {project,sources}=await window.freya.projectState(),source=sources[0]
  await window.freya.projectSaveRecipe(project!.id,{name:'Oaxaca, adultos',sourceId:source.id,steps:[
   {op:'filter',mode:'all',conditions:[{column:{position:2,name:'Entidad'},op:'equals',value:'Oaxaca',caseSensitive:false},{column:{position:3,name:'Edad'},op:'greaterEqual',value:'18',caseSensitive:false}]},
   {op:'order',by:[{column:{position:3,name:'Edad'},descending:true,numeric:true}]},
   {op:'select',columns:[{position:1,name:'ID'},{position:3,name:'Edad'},{position:5,name:'Nota'}]}
  ]})
 })
 await expect(row('Oaxaca, adultos')).toBeVisible()
})
test.afterEach(async()=>{try{expect(pageErrors).toEqual([]);expect(await readFile(source)).toEqual(original)}finally{try{if(app)await closeElectron(app)}finally{await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}})

test('PRJ-03: el menú exporta todas las filas, registra procedencia y abre el resultado editable',async()=>{
 const menu=await openProjectRowMenu(row('Oaxaca, adultos'),locale)
 const action=menu.getByRole('menuitem',{name:'Exportar…',exact:true})
 await expect(action).toBeVisible();await expect(action).not.toHaveAttribute('aria-disabled','true');await action.press('Enter')
 await expect(row('Oaxaca, adultos.csv')).toBeVisible()
 const bytes=Buffer.from('ID,Edad,Nota\n00128,61\n00126,52,ok\n00123,34,"línea 1\nlínea 2"\n')
 expect(await readFile(output)).toEqual(bytes)
 const manifest=JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8'))
 expect(manifest.results).toHaveLength(1)
 const result=manifest.results[0]
 expect(result).toMatchObject({kind:'extract',recipeId:manifest.recipes[0].id,path:'02_datasets/Oaxaca, adultos.csv',bytes:bytes.length,sha256:sha(bytes),createdAt:result.provenance.executedAt,
  provenance:{sourceSha256:sha(original),coverage:{kind:'filtered',matched:3,scanned:7,total:7,complete:true},fidelity:{level:'values'},chain:[manifest.recipes[0].id]}})
 expect(result.provenance.recipeSha256[manifest.recipes[0].id]).toMatch(/^[a-f\d]{64}$/)
 await expect(row('Oaxaca, adultos.csv')).toHaveAttribute('aria-level','3')
 await expect(row('Oaxaca, adultos.csv')).toHaveAttribute('title',/3 de 7/)
 await row('Oaxaca, adultos.csv').press('Enter')
 await expect(page.getByRole('tab',{name:'Oaxaca, adultos.csv',exact:true})).toHaveAttribute('aria-selected','true')
 await expect(page.locator('.project-result-origin')).toContainText('3 de 7')
 const document=await page.evaluate(async()=> (await window.freya.documents()).find(doc=>doc.name==='Oaxaca, adultos.csv'))
 expect(document).toMatchObject({kind:'csv',readonly:false,dirty:false,rowCount:3})
 expect(await readFile(source)).toEqual(original)
})
