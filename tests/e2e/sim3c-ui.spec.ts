// SIM-3c · Menús, contadores, estado del documento y alineación del explorador.
// Los controles nativos se activan únicamente con fixtures y el modo de prueba.
import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {closeElectron} from './close-electron'
import {traceElectronFailure} from './electron-trace'

let app:ElectronApplication,page:Page,folder:string,files:string,csv:string,stopTrace:(()=>Promise<void>)|undefined
const source='ID,Carrera\r\n00123,Ingeniería\r\n9007199254740993, psicologia \r\n'
const fixture=[['datos.csv',source],['a.txt','Hola\n'],['Nombre largo con á y Unicode Ω.txt','Hola\n'],['apuntes.md','# Apuntes\n'],['diagrama.mmd','flowchart LR\n A --> B\n'],['una.csv','ID,N\n00123,1\n'],['Carpeta/b.txt','Hola\n'],['Carpeta/Otro nombre mucho más largo.txt','Hola\n']] as const
test.beforeEach(async({},info)=>{
 stopTrace=undefined
 folder=await mkdtemp(join(tmpdir(),'freya-sim3c-'));files=join(folder,'archivos');await mkdir(files);await mkdir(join(files,'Carpeta'))
 csv=join(files,'datos.csv');for(const [name,text]of fixture)await writeFile(join(files,name),text)
 const {ELECTRON_RUN_AS_NODE:_,FREYALAB_TEST_OPEN:__,FREYALAB_TEST_FOLDER:___,...env}=process.env
 // pickFolder() solo usa esta ruta con FREYALAB_TEST=1; nunca abre un chooser real.
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_TEST_FOLDER:files,FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();stopTrace=await traceElectronFailure(page.context(),info);await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1280,height:720})
 await page.evaluate(path=>window.freya.openPaths([path]),csv)
 await expect(page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})).toHaveText('00123')
 await expect(page.locator('footer.statusbar')).toContainText('2 de 2 filas')
})
test.afterEach(async()=>{
 try{if(page){for(const [name,text]of fixture)expect(await readFile(join(files,name),'utf8')).toBe(text);const docs=await page.evaluate(()=>window.freya.documents());expect(docs.every(doc=>!doc.dirty)).toBe(true)}}
 finally{try{await stopTrace?.()}finally{try{if(app)await closeElectron(app)}finally{if(folder)await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}}
})
const footer=()=>page.locator('footer.statusbar')
async function hitChecks(actions:Locator){
 const measure=()=>actions.evaluateAll(nodes=>nodes.map(node=>{
  const element=node as HTMLElement,box=element.getBoundingClientRect(),hit=document.elementFromPoint(box.left+box.width/2,box.top+box.height/2)
  return{name:element.textContent?.trim(),inside:box.width>0&&box.height>0&&box.left>=0&&box.top>=0&&box.right<=innerWidth+.5&&box.bottom<=innerHeight+.5,hit:hit?.closest('button,select')===element,actual:hit?.closest('button,select')?.textContent?.trim()??hit?.tagName}
 }))
 await expect.poll(async()=>{const result=await measure();return result.length>0&&result.every(action=>action.inside&&action.hit)}).toBe(true)
}

for(const [width,height]of [[1440,900],[1280,720]] as const)for(const kind of ['Nuevo','Exportar'] as const)test(`SIM-3c: ${kind} recibe el puntero a ${width}×${height}`,async()=>{
 await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready)
 const toolbar=page.locator('header.toolbar'),button=toolbar.getByRole('button',{name:kind,exact:true}),menu=toolbar.locator(kind==='Nuevo'?'.toolbar-left .dropdown':'.export-dropdown')
 await button.click();await expect(menu).toBeVisible()
 await page.screenshot({path:test.info().outputPath(`sim3c-${kind.toLowerCase()}-${width}.png`)});await hitChecks(menu.locator('button,select'))
 if(kind==='Exportar'){
  const label=menu.locator('label').filter({has:page.locator('select')});await expect(label).toHaveCount(1)
  // El centro de label incluye el selector y no detecta una barra dibujada sobre su texto.
  await expect.poll(()=>label.evaluate(node=>{
   const dropdown=node.closest('.export-dropdown')!,walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT),rects:DOMRect[]=[]
   while(walker.nextNode()){
    const text=walker.currentNode
    if(!text.textContent?.trim()||text.parentElement?.closest('select'))continue
    const range=document.createRange();range.selectNodeContents(text);rects.push(...Array.from(range.getClientRects()).filter(rect=>rect.width>0&&rect.height>0))
   }
   return rects.length>0&&rects.every(rect=>dropdown.contains(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)))
  })).toBe(true)
 }
 await button.click();await expect(menu).toHaveCount(0)
})

test('SIM-3c: una celda, una fila y una columna usan singular sin cambiar datos',async()=>{
 const first=page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})
 await first.click();await expect(footer()).toContainText(/\b1 celda\b/)
 await page.getByRole('gridcell',{name:'Fila 1, Carrera',exact:true}).click({modifiers:['Shift']});await expect(footer()).toContainText(/\b2 celdas\b/)
 await page.getByRole('button',{name:'Seleccionar fila 1',exact:true}).click();await expect(footer()).toContainText(/\b1 fila seleccionada\b/)
 await page.getByRole('button',{name:'Seleccionar fila 2',exact:true}).click({modifiers:[process.platform==='darwin'?'Meta':'Control']});await expect(footer()).toContainText(/\b2 filas seleccionadas\b/)
 await page.getByRole('button',{name:'Seleccionar fila 1',exact:true}).click();await page.getByLabel('Seleccionar columna Carrera',{exact:true}).check()
 await page.getByLabel('Limpiar',{exact:true}).click();await expect(page.locator('.dropdown-note')).toContainText('1 fila × 1 columna')
 await page.keyboard.press('Escape')
 await page.evaluate(path=>window.freya.openPaths([path]),join(files,'una.csv'));await expect(page.getByRole('tab',{name:'una.csv',exact:true})).toHaveAttribute('aria-selected','true');await expect(footer()).toContainText(/\b1 de 1 fila\b/)
})

test('SIM-3c: la barra pertenece al documento activo y vuelve al CSV sin perder el recuento',async()=>{
 const names=['apuntes.md','a.txt','diagrama.mmd']
 for(const name of names){await page.evaluate(path=>window.freya.openPaths([path]),join(files,name));await expect(page.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true')}
 await page.getByRole('tab',{name:'datos.csv',exact:true}).click();await expect(footer()).toContainText('2 de 2 filas')
 // Abrir un archivo publica su propio estado; el defecto está al volver a una pestaña existente.
 for(const name of names){
  await page.getByRole('tab',{name,exact:true}).click();await expect(page.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true')
  await expect(footer()).not.toContainText(/\bfilas\b/)
  await expect(footer().locator('.csv-status')).toHaveCount(0)
  await page.getByRole('tab',{name:'datos.csv',exact:true}).click();await expect(page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})).toHaveText('00123');await expect(footer()).toContainText('2 de 2 filas')
 }
})

test('SIM-3c: los nombres del mismo nivel del explorador empiezan en la misma x',async()=>{
 await page.locator('.toolbar-left').getByRole('button',{name:'Abrir carpeta',exact:true}).click()
 const tree=page.locator('.tree-scroll');await expect(tree.getByRole('button',{name:'Carpeta',exact:true})).toBeVisible();await tree.getByRole('button',{name:'Carpeta',exact:true}).click()
 await expect(tree.getByRole('button',{name:'b.txt',exact:true})).toBeVisible();await page.evaluate(()=>document.fonts.ready)
 const measure=()=>tree.locator('button.tree-item').evaluateAll(nodes=>nodes.map(node=>({name:node.querySelector(':scope>.truncate')?.textContent?.trim(),padding:parseFloat(getComputedStyle(node).paddingLeft),x:node.querySelector(':scope>.truncate')!.getBoundingClientRect().left,icons:node.querySelectorAll('svg').length})))
 await expect.poll(async()=>{const rows=await measure();return [...new Set(rows.map(row=>row.padding))].every(level=>{const names=rows.filter(row=>row.padding===level);return names.length>1&&Math.max(...names.map(row=>row.x))-Math.min(...names.map(row=>row.x))<=.75})}).toBe(true)
 const positions=await measure()
 expect(positions.length).toBeGreaterThan(4);expect(positions.every(item=>item.icons>0)).toBe(true)
 const levels=[...new Set(positions.map(item=>item.padding))].sort((a,b)=>a-b);expect(levels).toHaveLength(2)
 for(const level of levels){const names=positions.filter(item=>item.padding===level);expect(names.length).toBeGreaterThan(1);expect(Math.max(...names.map(item=>item.x))-Math.min(...names.map(item=>item.x))).toBeLessThanOrEqual(.75)}
 expect(positions.find(item=>item.name==='b.txt')!.x).toBeGreaterThan(positions.find(item=>item.name==='a.txt')!.x)
 await tree.getByRole('button',{name:'Carpeta',exact:true}).click();await expect(tree.getByRole('button',{name:'b.txt',exact:true})).toHaveCount(0)
})
