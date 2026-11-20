import {expect,test,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {copyFile,mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {closeElectron} from './close-electron'
import {traceElectronFailure} from './electron-trace'
import {t,type Language} from '../../src/shared/i18n'
import {openProjectMenu,openProjectRowMenu,chooseProjectAction} from './project-panel'

let app:ElectronApplication,page:Page,root:string,folder:string,source:string,original:Buffer,pageErrors:string[]=[],locale:Language='es'
let finishC5=async()=>{}
const tr=(key:string)=>t(key,{},locale)
const projectPanel=()=>page.getByRole('tabpanel',{name:tr('project.tab'),exact:true})
const row=(name:string)=>projectPanel().getByRole('treeitem',{name,exact:true})

test.beforeEach(async({},info)=>{
 finishC5=async()=>{}
 locale=info.title.endsWith('[en-XA]')?'en-XA':'es'
 root=await mkdtemp(join(tmpdir(),'freya-project-tree-'));folder=join(root,'Censo');await mkdir(folder)
 source=join(folder,'prj02-censo.csv');await copyFile(resolve('tests/fixtures/prj02-censo.csv'),source);original=await readFile(source)
 const {ELECTRON_RUN_AS_NODE:_,...environment}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...environment as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:locale,FREYALAB_USER_DATA:join(root,'profile'),FREYALAB_TEST_FOLDER:folder,FREYALAB_TEST_PROJECT_SOURCE_PATH:source}})
 page=await app.firstWindow();pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));await page.waitForFunction(()=>!!window.freya)
 if(info.title==='PRJ-01c C5: el progreso y Cancelar pertenecen a la fuente y liberan la operación'){
  const child=app.process(),output:Buffer[]=[]
  const stdout=(chunk:Buffer)=>output.push(Buffer.from('[stdout] '),chunk),stderr=(chunk:Buffer)=>output.push(Buffer.from('[stderr] '),chunk)
  child.stdout?.on('data',stdout);child.stderr?.on('data',stderr)
  const stop=await traceElectronFailure(app.context(),info)
  finishC5=async()=>{try{await stop();await info.attach('c5-main-output',{body:Buffer.concat(output),contentType:'text/plain'})}finally{child.stdout?.off('data',stdout);child.stderr?.off('data',stderr)}}
  await app.evaluate(({ipcMain})=>{
   const handlers=Reflect.get(ipcMain,'_invokeHandlers') as Map<string,(...args:unknown[])=>unknown>,original=handlers.get('freya')
   if(!original)throw new Error('C5: no se encontró el handler freya para observarlo')
   handlers.set('freya',function(this:unknown,...args:unknown[]){
    const operation=args[1]
    if(operation!=='project:reregisterSource'&&operation!=='project:cancelSource')return original.apply(this,args)
    const started=performance.now(),log=(phase:string)=>console.info('[C5-IPC]',JSON.stringify({operation,phase,wallMs:Date.now(),elapsedMs:performance.now()-started}))
    log('start')
    try{const result=original.apply(this,args);void Promise.resolve(result).then(()=>log('end'),()=>log('error'));return result}
    catch(error){log('error');throw error}
   })
  })
 }
 await page.setViewportSize({width:1440,height:900})
 await page.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
 const create=page.getByRole('dialog',{name:tr('project.new'),exact:true})
 await create.getByRole('button',{name:tr('project.pickFolder'),exact:true}).press('Enter');await create.getByRole('button',{name:tr('project.create'),exact:true}).press('Enter')
 await projectPanel().getByRole('button',{name:tr('project.source.add'),exact:true}).press('Enter')
 const add=page.getByRole('dialog',{name:tr('project.source.add'),exact:true})
 await expect(add.getByRole('listitem')).toHaveText(['ID','Entidad','Edad','Ingreso','Nota'])
 await add.getByRole('button',{name:tr('project.source.register'),exact:true}).press('Enter');await expect(add).toHaveCount(0)
 await page.evaluate(async()=>{
  const {project,sources}=await window.freya.projectState(),source=sources[0]
  await window.freya.projectSaveRecipe(project!.id,{name:'Adultos',sourceId:source.id,steps:[{op:'filter',mode:'all',conditions:[{column:{position:3,name:'Edad'},op:'greaterEqual',value:'18',caseSensitive:false}]}]})
  const adult=(await window.freya.projectState()).recipes.find(value=>value.name==='Adultos')!
  await window.freya.projectSaveRecipe(project!.id,{name:'Muestra estable',baseRecipeId:adult.id,steps:[{op:'sample',method:'random',rows:3,seed:7}]})
  const sample=(await window.freya.projectState()).recipes.find(value=>value.name==='Muestra estable')!
  await window.freya.projectSaveRecipe(project!.id,{name:'Identificador y nota',baseRecipeId:sample.id,steps:[{op:'select',columns:[{position:1,name:'ID'},{position:5,name:'Nota'}]}]})
 })
 await expect(projectPanel().getByText('Identificador y nota',{exact:true})).toBeVisible()
 await page.getByRole('tab',{name:tr('project.tab'),exact:true}).focus();await page.mouse.move(1400,880)
})
test.afterEach(async()=>{try{expect(pageErrors).toEqual([]);expect((await readFile(source)).equals(original)).toBe(true)}finally{try{await finishC5()}finally{try{await closeElectron(app)}finally{await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}}})

test('PRJ-01c C1: en reposo solo hay dos acciones, una protección y ningún estado normal repetido',async()=>{
 await page.screenshot({animations:'disabled',path:test.info().outputPath('project-tree-reposo.png')})
 await expect(projectPanel().getByRole('button')).toHaveCount(2)
 await expect(projectPanel().getByRole('button',{name:'Acciones del proyecto',exact:true})).toBeVisible()
 await expect(projectPanel().getByRole('button',{name:'Añadir fuente…',exact:true})).toBeVisible()
 await expect(projectPanel().getByText('Listo',{exact:true})).toHaveCount(0)
 await expect(projectPanel().getByText('Verificada',{exact:true})).toHaveCount(0)
 await expect(projectPanel().getByText('Protegida',{exact:true})).toHaveCount(1)
 await expect(projectPanel().getByText('FreyaLab no modifica las fuentes.',{exact:false})).toHaveCount(1)
 await expect(projectPanel().getByText('prj02-censo.csv',{exact:true})).toHaveCount(1)
 await expect(projectPanel().getByRole('treeitem')).toHaveCount(4)
 for(const [name,level] of [['prj02-censo.csv','1'],['Adultos','2'],['Muestra estable','3'],['Identificador y nota','4']])await expect(row(name)).toHaveAttribute('aria-level',level)
})

test('PRJ-01c C9: las acciones siguen alcanzables en su menú y los bloqueos no pierden el motivo',async()=>{
 const before=await readFile(join(folder,'proyecto.freyalab'))
 await projectPanel().getByRole('button',{name:'Acciones del proyecto',exact:true}).press('Enter')
 let menu=projectPanel().getByRole('menu')
 await expect(menu.getByRole('menuitem')).toHaveText(['Renombrar proyecto','Mostrar en la carpeta','Cerrar proyecto'])
 await menu.press('Escape')
 await expect(projectPanel().getByRole('button',{name:'Añadir fuente…',exact:true})).toBeEnabled()
 await row('prj02-censo.csv').press('Shift+F10');menu=projectPanel().getByRole('menu')
 await expect(menu.getByRole('menuitem')).toHaveText(['Abrir','Analizar','Nuevo conjunto…','Mostrar en la carpeta','Volver a registrar','Quitar del proyecto'])
 const forget=menu.getByRole('menuitem',{name:'Quitar del proyecto',exact:true})
 await expect(forget).toHaveAttribute('aria-disabled','true');await expect(forget).toHaveAccessibleDescription('No se puede quitar: 3 conjuntos parten de esta fuente.')
 await menu.press('End');await expect(forget).toBeFocused();await forget.press('Enter');await expect(menu).toBeVisible();await menu.press('Escape')
 await expect(row('prj02-censo.csv')).toBeFocused()
 await row('Adultos').press('Shift+F10');menu=projectPanel().getByRole('menu')
 await expect(menu.getByRole('menuitem')).toHaveText(['Abrir','Analizar','Exportar…','Nuevo conjunto a partir de este…','Renombrar','Eliminar'])
 const exportItem=menu.getByRole('menuitem',{name:'Exportar…',exact:true})
 await expect(exportItem).toBeEnabled()
 await menu.press('Home');await expect(menu.getByRole('menuitem',{name:'Abrir',exact:true})).toBeFocused()
 await page.keyboard.press('ArrowDown');await expect(menu.getByRole('menuitem',{name:'Analizar',exact:true})).toBeFocused()
 await page.keyboard.press('ArrowDown');await expect(exportItem).toBeFocused()
 const remove=menu.getByRole('menuitem',{name:'Eliminar',exact:true})
 await expect(remove).toHaveAttribute('aria-disabled','true');await expect(remove).toHaveAccessibleDescription(/Muestra estable/)
 await menu.press('End');await expect(remove).toBeFocused();await remove.press('Enter');await expect(page.getByRole('dialog')).toHaveCount(0)
 await menu.press('Escape');await expect(row('Adultos')).toBeFocused()
 expect(await readFile(join(folder,'proyecto.freyalab'))).toEqual(before)
})


test('PRJ-01c C7: rechazar la sobrescritura externa conserva el borrador del nombre en su fila',async()=>{
 await row('Adultos').press('Shift+F10')
 await projectPanel().getByRole('menuitem',{name:'Renombrar',exact:true}).press('Enter')
 const input=projectPanel().getByRole('textbox',{name:'Nombre',exact:true})
 await input.fill('Mi nombre sin guardar')
 const path=join(folder,'proyecto.freyalab'),stored=JSON.parse(await readFile(path,'utf8'))
 stored.recipes[0].name='Nombre desde otra aplicación'
 await writeFile(path,JSON.stringify(stored,null,2)+'\n')
 const external=await readFile(path)
 await app.evaluate(({dialog})=>{dialog.showMessageBox=(async()=>({response:0,checkboxChecked:false})) as typeof dialog.showMessageBox})
 await input.press('Enter')
 await expect(row('Nombre desde otra aplicación')).toBeVisible()
 await expect(input).toHaveValue('Mi nombre sin guardar')
 await expect(input).toBeFocused()
 expect(await readFile(path)).toEqual(external)
})

test('PRJ-01c C5: un fallo del explorador se anuncia junto a la fuente',async()=>{
 await app.evaluate(({shell})=>{shell.showItemInFolder=()=>{throw new Error('No se pudo mostrar la fuente')}})
 await row('prj02-censo.csv').press('Shift+F10')
 await projectPanel().getByRole('menuitem',{name:'Mostrar en la carpeta',exact:true}).press('Enter')
 await expect(row('prj02-censo.csv').getByRole('alert')).toHaveText(/No se pudo mostrar la fuente/)
})


test('PRJ-01c C2/C3/C6: cuatro aperturas del menú, un punto de tabulación y navegación del árbol',async()=>{
 const adult=row('Adultos'),menu=projectPanel().getByRole('menu'),items=['Abrir','Analizar','Exportar…','Nuevo conjunto a partir de este…','Renombrar','Eliminar']
 for(const method of ['more','context','shift','key']){
  await adult.focus()
  if(method==='more')await adult.getByRole('button',{name:'Más acciones de Adultos',exact:true}).click()
  else if(method==='context')await adult.locator(':scope>.project-tree-row').click({button:'right'})
  else await adult.press(method==='shift'?'Shift+F10':'ContextMenu')
  await expect(menu.getByRole('menuitem')).toHaveText(items)
  await expect(menu.getByRole('menuitem').first()).toBeFocused()
  await menu.press('End');await expect(menu.getByRole('menuitem').last()).toBeFocused()
  await menu.press('Home');await expect(menu.getByRole('menuitem').first()).toBeFocused()
  await menu.press('Escape');await expect(menu).toHaveCount(0);await expect(adult).toBeFocused()
 }
 const tree=projectPanel().getByRole('tree'),sourceRow=row('prj02-censo.csv'),sample=row('Muestra estable'),leaf=row('Identificador y nota')
 await projectPanel().getByRole('button',{name:'Añadir fuente…',exact:true}).focus();await page.keyboard.press('Tab')
 await expect(adult).toBeFocused()
 await expect(tree.locator('[role="treeitem"][tabindex="0"]')).toHaveCount(1)
 await adult.press('Home');await expect(sourceRow).toBeFocused()
 await sourceRow.press('ArrowRight');await expect(adult).toBeFocused()
 await adult.press('ArrowDown');await expect(sample).toBeFocused()
 await sample.press('ArrowDown');await expect(leaf).toBeFocused()
 await leaf.press('ArrowUp');await expect(sample).toBeFocused()
 await sample.press('ArrowLeft');await expect(sample).toHaveAttribute('aria-expanded','false');await expect(leaf).toHaveCount(0)
 await sample.press('ArrowLeft');await expect(adult).toBeFocused()
 await adult.press('ArrowLeft');await expect(adult).toHaveAttribute('aria-expanded','false');await expect(sample).toHaveCount(0)
 await adult.press('ArrowRight');await expect(adult).toHaveAttribute('aria-expanded','true')
 await adult.press('ArrowRight');await expect(sample).toBeFocused()
 await sample.press('ArrowRight');await expect(sample).toHaveAttribute('aria-expanded','true')
 await sample.press('End');await expect(leaf).toBeFocused()
 await leaf.press('Home');await expect(sourceRow).toBeFocused()
 await sourceRow.press('ArrowLeft');await expect(tree.getByRole('treeitem')).toHaveCount(1)
 await sourceRow.press('ArrowRight');await expect(tree.getByRole('treeitem')).toHaveCount(4)
 await sourceRow.press('Enter');await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
 expect((await page.evaluate(()=>window.freya.documents()))[0]).toMatchObject({name:'prj02-censo.csv',projectSource:'protected',readonly:true})
 await adult.getByText('Adultos',{exact:true}).click()
 await expect(page.getByRole('region',{name:'Conjunto',exact:true})).toBeVisible()
})

test('PRJ-01c C7: renombrar guarda con Intro, cancela con Escape o al salir y explica los duplicados',async()=>{
 await chooseProjectAction(await openProjectMenu(page),'project.rename')
 let input=projectPanel().getByRole('textbox',{name:'Nombre',exact:true})
 await expect(input).toBeFocused();await input.fill('Proyecto editado');await input.press('Enter')
 await expect(projectPanel().getByRole('heading',{name:'Proyecto editado',exact:true})).toBeVisible()
 expect(JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8')).name).toBe('Proyecto editado')
 await chooseProjectAction(await openProjectMenu(page),'project.rename');await input.fill('No guardar');await input.press('Escape')
 await expect(input).toHaveCount(0);await expect(projectPanel().getByRole('heading',{name:'Proyecto editado',exact:true})).toBeVisible()
 await chooseProjectAction(await openProjectMenu(page),'project.rename');await input.fill('Tampoco guardar');await projectPanel().getByRole('button',{name:'Acciones del proyecto',exact:true}).focus()
 await expect(input).toHaveCount(0)
 async function expectRenameContained(withError:boolean){
  let snapshot:unknown
  try{await expect.poll(async()=>{
   const ownLine=row('Adultos').locator(':scope>.tree-item')
   const [line,field,detail,next,error]=await Promise.all([ownLine.boundingBox(),input.boundingBox(),ownLine.locator('.node-detail').boundingBox(),row('Muestra estable').locator(':scope>.tree-item').boundingBox(),withError?projectPanel().getByRole('alert').boundingBox():Promise.resolve(null)])
   snapshot={withError,line,field,detail,next,error}
   if(!line||!field||!detail||!next||withError&&!error)return false
   const inside=(box:{y:number;height:number})=>box.y>=line.y&&box.y+box.height<=line.y+line.height
   return inside(field)&&inside(detail)&&(!error||inside(error)&&error.y>=field.y+field.height)&&next.y>=Math.max(line.y+line.height,detail.y+detail.height,error?error.y+error.height:0)
  }).toBe(true)}finally{await test.info().attach(withError?'renombrado-error-cajas':'renombrado-campo-cajas',{body:Buffer.from(JSON.stringify(snapshot,null,2)),contentType:'application/json'})}
 }
 for(const width of [240,420]){
  await page.evaluate(ancho=>window.freya.setSettings({barraLateral:{ancho}}),width)
  await expect.poll(async()=>(await page.locator('.sidebar').boundingBox())?.width).toBe(width)
  await chooseProjectAction(await openProjectRowMenu(row('Adultos')),'subset.rename')
  input=projectPanel().getByRole('textbox',{name:'Nombre',exact:true});await expect(input).toBeFocused()
  await expectRenameContained(false)
  await input.fill('Muestra estable');await input.press('Enter')
  const error=projectPanel().getByRole('alert')
  await expect(error).toHaveText('Ya hay un conjunto con ese nombre. Elige otro nombre.')
  const inputBox=await input.boundingBox(),errorBox=await error.boundingBox()
  expect(inputBox).not.toBeNull();expect(errorBox).not.toBeNull();expect(errorBox!.y).toBeGreaterThanOrEqual(inputBox!.y+inputBox!.height)
  await expectRenameContained(true)
  await input.press('Escape');await expect(input).toHaveCount(0);await expect(row('Adultos')).toBeFocused()
 }
 await chooseProjectAction(await openProjectRowMenu(row('Adultos')),'subset.rename');await input.fill('Personas adultas');await input.press('Enter')
 await expect(row('Personas adultas')).toBeVisible()
 expect(JSON.parse(await readFile(join(folder,'proyecto.freyalab'),'utf8')).recipes[0].name).toBe('Personas adultas')
 await chooseProjectAction(await openProjectRowMenu(row('Personas adultas')),'subset.rename');await input.fill('Borrador cancelado');await projectPanel().getByRole('button',{name:'Acciones del proyecto',exact:true}).focus()
 await expect(input).toHaveCount(0);await expect(row('Personas adultas')).toBeVisible()
})

test('PRJ-01c C11: nombres largos y menús caben con 240 y 420 píxeles de barra lateral',async()=>{
 const longName=('Conjunto con un nombre largo para revisar el recorte y conservar todo el nombre en su título — '+ 'áéíóú '.repeat(12)).trim()
 await page.evaluate(async name=>{const state=await window.freya.projectState();await window.freya.projectRenameRecipe(state.project!.id,state.recipes.find(recipe=>recipe.name==='Identificador y nota')!.id,name)},longName)
 for(const width of [240,420]){
  await page.evaluate(ancho=>window.freya.setSettings({barraLateral:{ancho}}),width)
  await expect.poll(async()=>(await page.locator('.sidebar').boundingBox())?.width).toBe(width)
  await expect.poll(()=>projectPanel().evaluate(panel=>panel.scrollWidth<=panel.clientWidth)).toBe(true)
  const name=row(longName).getByText(longName,{exact:true})
  await expect(name).toHaveAttribute('title',longName)
  await expect.poll(()=>name.evaluate(element=>element.scrollWidth>element.clientWidth&&getComputedStyle(element).textOverflow==='ellipsis')).toBe(true)
  await row(longName).press('Shift+F10');const menu=projectPanel().getByRole('menu')
  await expect.poll(()=>menu.evaluate(element=>{const box=element.getBoundingClientRect();return box.x>=0&&box.y>=0&&box.right<=innerWidth&&box.bottom<=innerHeight})).toBe(true)
  for(const item of await menu.getByRole('menuitem').all())await expect(item).toBeInViewport({ratio:1})
  await menu.press('Escape')
 }
})

for(const language of ['es','en-XA'] as const)test(`PRJ-01c C12: reposo, menú y fuente modificada en dos temas y tamaños [${language}]`,async({},info)=>{
 async function capture(state:string,width:number,height:number,theme:'light'|'dark'){
  await page.setViewportSize({width,height})
  await page.evaluate(({theme,width})=>window.freya.setSettings({tema:theme,barraLateral:{ancho:width===1440?420:240}}),{theme,width})
  await expect.poll(()=>page.locator('html').evaluate(element=>element.classList.contains('dark'))).toBe(theme==='dark')
  await expect.poll(async()=>(await page.locator('.sidebar').boundingBox())?.width).toBe(width===1440?420:240)
  await page.evaluate(()=>document.fonts.ready)
  await expect.poll(()=>projectPanel().evaluate(panel=>panel.scrollWidth<=panel.clientWidth)).toBe(true)
  if(state==='menu'){
   await row('Adultos').press('Shift+F10')
   const menu=projectPanel().getByRole('menu')
   await expect(menu.getByRole('menuitem')).toHaveText(['dialog.open.button','analysis.tab.open','project.export.action','subset.newFromThis','subset.rename','subset.remove'].map(tr))
   await expect.poll(()=>menu.evaluate(element=>{const box=element.getBoundingClientRect();return box.x>=0&&box.y>=0&&box.right<=innerWidth&&box.bottom<=innerHeight})).toBe(true)
  }else{
   await page.getByRole('tab',{name:tr('project.tab'),exact:true}).focus();await page.mouse.move(width-10,height-10)
   if(state==='reposo')await expect(projectPanel().getByRole('button')).toHaveCount(2)
   else{
    const sourceRow=row('prj02-censo.csv')
    await expect(sourceRow.getByText(tr('project.source.status.changed'),{exact:true})).toBeVisible()
    await expect(sourceRow.getByRole('button',{name:tr('project.source.reregister'),exact:true})).toBeInViewport({ratio:1})
   }
  }
  const filename=`prj01c-${state}-${language}-${theme}-${width}x${height}.png`,path=info.outputPath(filename)
  await page.screenshot({path,animations:'disabled'})
  if(process.env.FREYALAB_PRJ01C_EVIDENCE){await mkdir(process.env.FREYALAB_PRJ01C_EVIDENCE,{recursive:true});await copyFile(path,join(process.env.FREYALAB_PRJ01C_EVIDENCE,filename))}
  if(state==='menu')await projectPanel().getByRole('menu').press('Escape')
 }
 try{
  for(const state of ['reposo','menu','cambiada']){
   if(state==='cambiada'){
    await row('prj02-censo.csv').press('Enter');await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
    const changed=Buffer.from(original.toString('utf8').replace('00124,Oaxaca,17','00124,Oaxaca,18'))
    expect(changed.equals(original)).toBe(false);await writeFile(source,changed)
    await expect(row('prj02-censo.csv').getByText(tr('project.source.status.changed'),{exact:true})).toBeVisible()
   }
   for(const [width,height] of [[1440,900],[1280,720]])for(const theme of ['light','dark'] as const)await capture(state,width,height,theme)
  }
 }finally{await writeFile(source,original)}
})


test('PRJ-01c C5: el progreso y Cancelar pertenecen a la fuente y liberan la operación',async({},info)=>{
 await row('prj02-censo.csv').press('Enter');await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
 const changed=Buffer.from(original.toString('utf8').replace('00124,Oaxaca,17','00124,Oaxaca,18'))
 try{
  await writeFile(source,changed)
  const sourceRow=row('prj02-censo.csv')
  await expect(sourceRow.getByText('Cambió desde que se registró',{exact:true})).toBeVisible()
  const owner=await sourceRow.getAttribute('data-project-node')
  // El archivo es pequeño: se comprueba el control real, sin prometer que Cancelar gane a una huella ya terminada.
  const observed=await sourceRow.evaluate(node=>new Promise<{owner:string|null;count:number;role:string|null;live:string|null;cancel:string}>(resolve=>{
   const observer=new MutationObserver(()=>{
    const progress=node.querySelector('.node-progress'),status=progress?.querySelector('[role="status"]'),cancel=progress?.querySelector<HTMLButtonElement>('button')
    if(!progress||!status||!cancel)return
    const snapshot={owner:progress.closest('[role="treeitem"]')?.getAttribute('data-project-node')??null,count:document.querySelectorAll('.node-progress').length,role:status.getAttribute('role'),live:status.getAttribute('aria-live'),cancel:cancel.textContent??''}
    observer.disconnect();cancel.click();resolve(snapshot)
   })
   observer.observe(node,{childList:true,subtree:true})
   const start=[...node.querySelectorAll('button')].find(button=>button.textContent==='Volver a registrar')
   if(!start)throw new Error('No se encontró Volver a registrar en la fuente')
   start.click()
  }))
  expect(observed).toEqual({owner,count:1,role:'status',live:'polite',cancel:'Cancelar'})
  await info.attach('progreso-observado',{body:Buffer.from(JSON.stringify(observed,null,2)),contentType:'application/json'})
  await expect(sourceRow.locator('.node-progress')).toHaveCount(0)
  const menu=await openProjectMenu(page)
  await expect(menu.getByRole('menuitem',{name:'Renombrar proyecto',exact:true})).toBeEnabled();await menu.press('Escape')
  await expect(sourceRow.getByRole('alert')).toHaveCount(0)
  expect(await readFile(source)).toEqual(changed)
 }finally{await writeFile(source,original)}
})
