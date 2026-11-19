import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {closeElectron} from './close-electron'

let app:ElectronApplication,page:Page,folder:string,path:string,bytes:Buffer,id:string
const footer=()=>page.locator('footer.statusbar')
const trigger=()=>footer().getByLabel('Formato del archivo:',{exact:false})
const panel=()=>footer().getByRole('group',{name:'Formato del archivo',exact:true})
const info=()=>page.evaluate(async id=>(await window.freya.documents()).find(doc=>doc.id===id),id)
const hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex')
test.beforeEach(async()=>{
 folder=await mkdtemp(join(tmpdir(),'freya-file-format-'));path=join(folder,'datos.csv');bytes=await readFile(resolve('tests/fixtures/csv-file-format.csv'));await writeFile(path,bytes)
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:'es',FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1280,height:720})
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path);id=doc.id
 await expect(page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})).toHaveText('00123')
})
test.afterEach(async()=>{await closeElectron(app);await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})})

test('SIM-1f: un resumen compacto abre los tres controles sin duplicar ni perder recuentos',async()=>{
 await expect(trigger()).toHaveText('UTF-8 · Coma · Con encabezado')
 for(const[width,height]of [[1440,900],[1280,720]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready)
  await expect.poll(()=>trigger().evaluate(button=>{
   const box=button.getBoundingClientRect(),bar=button.closest('footer')!.getBoundingClientRect(),walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT),rects:DOMRect[]=[]
   while(walker.nextNode())if(walker.currentNode.textContent?.trim()){const range=document.createRange();range.selectNodeContents(walker.currentNode);rects.push(...range.getClientRects())}
   return rects.length>0&&rects.every(rect=>rect.left>=box.left-.5&&rect.right<=box.right+.5&&rect.top>=box.top-.5&&rect.bottom<=box.bottom+.5)&&box.left>=0&&box.right<=innerWidth&&box.bottom<=Math.min(bar.bottom,innerHeight)+.5
  })).toBe(true)
 }
 await expect(footer().getByRole('combobox',{name:'Codificación',exact:true})).not.toBeVisible()
 await expect(footer().getByText('Guardado',{exact:true})).toHaveCount(0)
 await expect(footer()).toContainText('2 de 2 filas')
 await trigger().press('Enter');await expect(panel()).toBeVisible()
 await expect(panel().getByRole('combobox',{name:'Codificación',exact:true})).toHaveValue('utf8')
 await expect(panel().getByRole('combobox',{name:'Separador',exact:true})).toHaveValue(',')
 await expect(panel().getByRole('checkbox',{name:'Primera fila como encabezado',exact:true})).toBeChecked()
 for(const[width,height]of [[1440,900],[1280,720]]){
  await page.setViewportSize({width,height})
  await expect.poll(()=>panel().evaluate(group=>{
   const box=group.getBoundingClientRect(),controls=Array.from(group.querySelectorAll('select,input'))
   return box.left>=0&&box.right<=innerWidth+.5&&box.top>=0&&box.bottom<=innerHeight+.5&&controls.every(control=>{const rect=control.getBoundingClientRect();return rect.left>=box.left&&rect.right<=box.right+.5&&rect.top>=box.top&&rect.bottom<=box.bottom+.5})
  })).toBe(true)
 }
 await expect(page.locator('.csv-workspace').getByRole('combobox',{name:'Codificación',exact:true})).toHaveCount(0)
 expect(hash(await readFile(path))).toBe(hash(bytes))
})

test('SIM-1f: los mismos selectores reinterpretan sin cambiar los bytes y actualizan el resumen',async()=>{
 await trigger().click()
 const separator=panel().getByRole('combobox',{name:'Separador',exact:true}),encoding=panel().getByRole('combobox',{name:'Codificación',exact:true}),header=panel().getByRole('checkbox',{name:'Primera fila como encabezado',exact:true})
 await separator.selectOption(';');await expect.poll(info).toMatchObject({delimiter:';',dirty:false});await expect(page.getByRole('columnheader')).toHaveCount(1)
 await expect(trigger()).toHaveText('UTF-8 · Punto y coma · Con encabezado')
 await separator.selectOption(',');await expect(page.getByRole('columnheader')).toHaveCount(3)
 await encoding.selectOption('win1252');await expect.poll(info).toMatchObject({encoding:'win1252',dirty:false});await expect(trigger()).toContainText('Windows-1252')
 await encoding.selectOption('utf8');await expect.poll(info).toMatchObject({encoding:'utf8',dirty:false})
 await header.uncheck();await expect.poll(info).toMatchObject({hasHeader:false,rowCount:3,dirty:false});await expect(trigger()).toContainText('Sin encabezado')
 await header.check();await expect.poll(info).toMatchObject({hasHeader:true,rowCount:2,dirty:false});await expect(trigger()).toHaveText('UTF-8 · Coma · Con encabezado')
 await expect(page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})).toHaveText('00123');await expect(page.getByRole('gridcell',{name:'Fila 2, ID',exact:true})).toHaveText('9007199254740993')
 expect(await readFile(path)).toEqual(bytes)
})

test('SIM-1f: teclado nativo de los selectores, Tab y Escape conservan su función',async()=>{
 await trigger().focus();await trigger().press('Enter');await page.keyboard.press('Tab')
 const encoding=panel().getByRole('combobox',{name:'Codificación',exact:true}),separator=panel().getByRole('combobox',{name:'Separador',exact:true}),header=panel().getByRole('checkbox',{name:'Primera fila como encabezado',exact:true})
 // CDP no acciona el chooser macOS con End/Home/Arrow+Enter; esas elecciones
 // se calibraron antes con teclas reales del SO, sin teclado propio.
 // El caso anterior conserva la equivalencia de datos de los tres controles.
 await expect(encoding).toBeFocused();await page.keyboard.press('Tab');await expect(separator).toBeFocused();await page.keyboard.press('Tab');await expect(header).toBeFocused()
 await header.press('Space');await expect.poll(info).toMatchObject({hasHeader:false,rowCount:3});await expect(header).toBeEnabled()
 await header.press('Space');await expect.poll(info).toMatchObject({hasHeader:true,rowCount:2});await expect(header).toBeEnabled()
 await header.press('Escape');await expect(panel()).not.toBeVisible();await expect(trigger()).toBeFocused()
 await trigger().click();await expect(panel()).toBeVisible();await page.getByRole('gridcell',{name:'Fila 1, ID',exact:true}).click();await expect(panel()).not.toBeVisible()
 expect(await readFile(path)).toEqual(bytes)
})

test('SIM-1f: dirty mantiene el bloqueo UI y el rechazo real de frontera no cambia el resumen',async()=>{
 const cell=page.getByRole('gridcell',{name:'Fila 1, Nombre',exact:true});await cell.dblclick();await page.getByRole('textbox',{name:'Editar celda',exact:true}).fill('Nuevo');await page.getByRole('textbox',{name:'Editar celda',exact:true}).press('Enter')
 await expect.poll(info).toMatchObject({dirty:true,delimiter:','});await expect(footer().getByText('Cambios pendientes',{exact:true})).toBeVisible();await trigger().click()
 const separator=panel().getByRole('combobox',{name:'Separador',exact:true})
 await expect(separator).toBeDisabled();await expect(panel().getByRole('combobox',{name:'Codificación',exact:true})).toBeDisabled();await expect(panel().getByRole('checkbox',{name:'Primera fila como encabezado',exact:true})).toBeDisabled()
 const before=await trigger().innerText()
 // Intento sintético de frontera: no habilita un control que el usuario no puede operar.
 await separator.evaluate(select=>{(select as HTMLSelectElement).value=';';select.dispatchEvent(new Event('change',{bubbles:true}))})
 await expect(page.locator('.toast.error')).toContainText('Guarda los cambios antes de cambiar cómo se interpreta el archivo.')
 await expect(trigger()).toHaveText(before);await expect.poll(info).toMatchObject({dirty:true,delimiter:','});await expect(cell).toHaveText('Nuevo');expect(await readFile(path)).toEqual(bytes)
})

test('SIM-1f: el estado limpio se ve arriba y el footer conserva cambios y documento sin guardar',async()=>{
 for(const [name,source]of [['nota.md','# Nota\n'],['nota.txt','Nota\n'],['nota.mmd','flowchart LR\n A --> B\n']]as const){
  const file=join(folder,name);await writeFile(file,source);await page.evaluate(file=>window.freya.openPaths([file]),file)
  await expect(page.getByRole('tab',{name,exact:true})).toBeVisible();await expect(footer().getByText('Guardado',{exact:true})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Guardar',exact:true})).toHaveAttribute('aria-busy','false');await expect(page.locator('.save-button .button-label .visible')).toHaveText('Guardado');expect(await readFile(file,'utf8')).toBe(source)
 }
 await page.getByRole('button',{name:'Nuevo',exact:true}).click();await page.getByRole('button',{name:'Texto plano',exact:true}).click();await expect(footer().getByText('Sin guardar',{exact:true})).toBeVisible();await expect(footer().getByText('Guardado',{exact:true})).toHaveCount(0)
})
