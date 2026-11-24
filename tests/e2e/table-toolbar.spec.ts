import {test,expect,_electron as electron,type ElectronApplication,type Page} from '@playwright/test'
import electronPath from 'electron'
import {copyFile,mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t,type Language} from '../../src/shared/i18n'
import {icons} from '../../src/renderer/lib/icons'
import {closeElectron} from './close-electron'
import {readTableRows} from './csv-rows'

let app:ElectronApplication,page:Page,folder:string,path:string,language:Language,errors:string[]
const headers=['ID','Ciudad','Ingreso','Edad','Grupo','Fecha','Respuesta']
const records=Array.from({length:240},(_,index)=>[
 index===1?'9007199254740993':String(index+1).padStart(5,'0'),
 ['  OaXaCa  ','  Mérida  ','  Puebla  '][index%3],
 index===1?'':String(100+index),String(18+index%35),index%2?'B':'A','2026-01-05',index%2?'sí':'no'
])
const source=[headers.join(','),...records.map(row=>row.join(','))].join('\n')+'\n'
const bar=()=>page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true})
const tr=(key:string)=>t(key,{},language)
const clean=()=>bar().getByLabel(tr('charts.toolbar.clean'),{exact:true})
const cleanMenu=()=>clean().locator('..').locator(':scope>.dropdown')
async function openClean(){if(await clean().locator('..').getAttribute('open')===null)await clean().press('Enter');await expect(cleanMenu()).toBeVisible();return cleanMenu()}
async function closeClean(){if(await clean().locator('..').getAttribute('open')!==null){await clean().press('Escape');await expect(clean()).toBeFocused()}}
async function activeIncome(){await page.getByRole('gridcell',{name:'Fila 1, Ingreso',exact:true}).click()}

test.beforeEach(async({},info)=>{
 language=info.title.endsWith('[en-XA]')?'en-XA':'es'
 folder=await mkdtemp(join(tmpdir(),'freya-table-toolbar-'));path=join(folder,'encuesta.csv');await writeFile(path,source)
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:language,FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();errors=[];page.on('pageerror',error=>errors.push(error.message))
 await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
 await page.evaluate(path=>window.freya.openPaths([path]),path)
 await expect(page.getByRole('gridcell',{name:'Fila 1, ID',exact:true})).toBeVisible()
})
test.afterEach(async()=>{
 try{expect(errors).toEqual([]);expect(await readFile(path,'utf8')).toBe(source)}
 finally{try{await closeElectron(app)}finally{await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}
})

async function geometry(){return bar().evaluate(element=>{
 const bounds=element.getBoundingClientRect()
 const controls=[...element.children].map(node=>node.getBoundingClientRect()).filter(box=>box.width>0&&box.height>0)
 const labelVisible=(key:string)=>{const label=element.querySelector<HTMLElement>(`summary[aria-label=${JSON.stringify(key)}] .tool-text`);if(!label)return false;const box=label.getBoundingClientRect();return box.width>0&&box.height>0}
 const summaries=Array.from(element.querySelectorAll('details>summary'))
 const textControls=Array.from(element.querySelectorAll<HTMLElement>('button,summary')).filter(control=>!control.closest('.dropdown,.goto-popover')&&control.getBoundingClientRect().width>0).map(control=>{
  const box=control.getBoundingClientRect(),style=getComputedStyle(control),text=[]
  const walker=document.createTreeWalker(control,NodeFilter.SHOW_TEXT)
  for(let node=walker.nextNode();node;node=walker.nextNode()){
   if(!node.textContent?.trim()||node.parentElement?.closest('.sr-only'))continue
   const range=document.createRange();range.selectNodeContents(node)
   for(const rect of range.getClientRects())if(rect.width>0&&rect.height>0)text.push({value:node.textContent.trim(),left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom})
  }
  return{label:control.getAttribute('aria-label')??control.textContent?.trim(),left:box.left,right:box.right,clientWidth:control.clientWidth,scrollWidth:control.scrollWidth,flexShrink:style.flexShrink,whiteSpace:style.whiteSpace,text}
 })
 const ancestors=[]
 for(let parent:HTMLElement|null=element.parentElement;parent&&ancestors.length<5;parent=parent.parentElement){const box=parent.getBoundingClientRect(),style=getComputedStyle(parent);ancestors.push({className:parent.className,left:box.left,right:box.right,width:box.width,clientWidth:parent.clientWidth,scrollWidth:parent.scrollWidth,overflowX:style.overflowX,minWidth:style.minWidth,display:style.display})}
 return{width:bounds.width,height:bounds.height,left:bounds.left,right:bounds.right,viewportWidth:innerWidth,clientWidth:element.clientWidth,scrollWidth:element.scrollWidth,barInsideViewport:bounds.left>=0&&bounds.right<=innerWidth,controlsInsideViewport:controls.every(box=>box.left>=0&&box.right<=innerWidth),textInsideControls:textControls.every(control=>control.text.every(text=>text.left>=control.left-1&&text.right<=control.right+1)),textInsideViewport:textControls.every(control=>control.text.every(text=>text.left>=0&&text.right<=innerWidth)),inside:controls.every(box=>box.left>=bounds.left-1&&box.right<=bounds.right+1),oneRow:controls.every(box=>Math.abs((box.top+box.bottom-bounds.top-bounds.bottom)/2)<=1),ancestors,textControls,labels:summaries.slice(0,3).map(summary=>({name:summary.getAttribute('aria-label'),text:summary.querySelector('.tool-text')?.textContent?.trim(),visible:labelVisible(summary.getAttribute('aria-label')??'')}))}
})}
async function settledGeometry(){
 let previous=''
 await expect.poll(async()=>{const current=JSON.stringify(await geometry()),stable=current===previous;previous=current;return stable},'la distribución termina de responder al tamaño y al idioma').toBe(true)
 return geometry()
}

// Capturar todos los estados del baseline aunque falten las seis acciones nuevas.
for(const locale of ['es','en-XA'] as const)test(`SIM-1b capturas: barra, orden de ocultación y limpiezas [${locale}]`,async({},info)=>{
 const measured=[]
 await page.getByRole('checkbox',{name:'Seleccionar columna Ciudad',exact:true}).check();await activeIncome()
 for(const [width,height] of [[1440,900],[1280,720]])for(const theme of ['light','dark'] as const){
  await closeClean();await page.setViewportSize({width,height})
  await expect.poll(()=>page.evaluate(()=>({width:innerWidth,height:innerHeight}))).toEqual({width,height})
  await page.evaluate(theme=>window.freya.setSettings({tema:theme}),theme)
  await expect.poll(()=>page.locator('.toolbar').evaluate(element=>getComputedStyle(element).backgroundColor)).toBe(theme==='dark'?'rgb(32, 32, 36)':'rgb(242, 242, 247)')
  await page.evaluate(async()=>{await document.fonts.ready})
  const shape=await settledGeometry(),menu=await openClean(),buttons=menu.getByRole('button')
  const phase=process.env.FREYALAB_SIM1B_PHASE??'check',name=`sim1b-${phase}-${locale}-${theme}-${width}x${height}.png`,capture=info.outputPath(name)
  await page.mouse.move(width-8,height-8);await page.screenshot({path:capture,animations:'disabled'})
  if(process.env.FREYALAB_SIM1B_EVIDENCE){await mkdir(process.env.FREYALAB_SIM1B_EVIDENCE,{recursive:true});await copyFile(capture,join(process.env.FREYALAB_SIM1B_EVIDENCE,name))}
  const actions=await buttons.allTextContents();measured.push({locale,theme,viewport:{width,height},...shape,actions})
  expect.soft(shape.inside,'todos los controles caben dentro de la barra').toBe(true)
  expect.soft(shape.barInsideViewport,'la barra completa cabe en la ventana, no solo en su propia caja').toBe(true)
  expect.soft(shape.controlsInsideViewport,'ningún control queda fuera de la ventana').toBe(true)
  expect.soft(shape.textInsideControls,'los glifos visibles caben dentro de su control').toBe(true)
  expect.soft(shape.textInsideViewport,'ningún texto visible queda cortado por la ventana').toBe(true)
  expect.soft(shape.oneRow,'la barra conserva una sola fila').toBe(true)
  const [filter,cleanLabel,structure]=shape.labels
  if(!cleanLabel.visible)expect.soft(filter.visible,'se oculta Filtrar antes que Limpiar').toBe(false)
  if(!structure.visible)expect.soft(cleanLabel.visible,'se oculta Limpiar antes que Filas y columnas').toBe(false)
  if(locale==='es')expect.soft(cleanLabel.text,'el texto visible nombra Limpiar').toBe('Limpiar')
  expect.soft(actions.length,'seis limpiezas de columna, tres de filas y el asistente').toBe(10)
  expect.soft(actions.slice(0,6).every(label=>label.includes('Ingreso')),'cada limpieza identifica la columna de la celda activa').toBe(true)
  if(locale==='en-XA')for(const index of [2,3,4,5])expect.soft(await buttons.nth(index).getAttribute('title'),'las ayudas nuevas también usan el idioma elegido').toMatch(/^\[.+\]$/)
  expect.soft(await clean().evaluate(node=>getComputedStyle(node,'::after').display),'el tooltip queda oculto al abrir el menú').toBe('none')
 }
 await closeClean();await writeFile(info.outputPath('toolbar-geometry.json'),JSON.stringify(measured,null,2)+'\n')
 expect((await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(false)
})

test('SIM-1b: sin celda activa las seis limpiezas explican el motivo aunque haya una columna marcada',async()=>{
 await page.getByRole('checkbox',{name:'Seleccionar columna Ciudad',exact:true}).check()
 const menu=await openClean(),actions=menu.getByRole('button')
 await expect(actions).toHaveCount(10)
 for(let index=0;index<6;index++){
  await expect(actions.nth(index)).toBeDisabled()
  await expect(actions.nth(index)).toHaveAccessibleDescription('Elige una celda de la columna que quieres limpiar.')
 }
})

test('SIM-1b: las seis limpiezas usan Ingreso activo y no la marca Ciudad ni alteran el archivo',async()=>{
 await page.getByRole('checkbox',{name:'Seleccionar columna Ciudad',exact:true}).check()
 for(let index=0;index<6;index++){
  await activeIncome();const menu=await openClean(),buttons=menu.getByRole('button')
  await expect(buttons).toHaveCount(10);await expect(buttons.nth(index)).toContainText('Ingreso');await expect(buttons.nth(index)).toBeEnabled()
  await buttons.nth(index).press('Enter')
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible()
  if(index===0)await expect(dialog).toHaveAccessibleName('Rellenar vacíos de Ingreso')
  else if(index===1)await expect(dialog.getByRole('combobox',{name:t('empty.where'),exact:true})).toContainText('Ingreso')
  else if(index===2){await expect(dialog.getByRole('combobox',{name:'Transformación CSV',exact:true})).toHaveValue('deduplicate');await expect(dialog.getByLabel('Columnas para transformar',{exact:true})).toHaveValues(['2'])}
  else{
   await expect(dialog).toHaveAccessibleName(`${['Quitar espacios','Mayúsculas','Minúsculas'][index-3]} en la columna «Ingreso»`)
   await expect(dialog).toContainText('Alcance: toda la columna · 240 filas.')
  }
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('checkbox',{name:'Seleccionar columna Ciudad',exact:true})).toBeChecked()
  await expect(page.getByRole('checkbox',{name:'Seleccionar columna Ingreso',exact:true})).not.toBeChecked()
 }
 expect((await page.evaluate(()=>window.freya.documents()))[0].dirty).toBe(false)
})

test('SIM-1b: una celda activa basta sin marcas de encabezado',async()=>{
 await activeIncome();const actions=(await openClean()).getByRole('button')
 await expect(actions).toHaveCount(10)
 for(let index=0;index<6;index++){await expect(actions.nth(index)).toBeEnabled();await expect(actions.nth(index)).toContainText('Ingreso')}
 await actions.first().press('Enter')
 await expect(page.getByRole('dialog',{name:'Rellenar vacíos de Ingreso',exact:true})).toBeVisible()
 await expect(page.getByRole('checkbox',{name:'Seleccionar columna Ingreso',exact:true})).not.toBeChecked()
})

test('las referencias de Limpiar conservan el foco independiente de barra y columna',async()=>{
 const before=await page.evaluate(()=>window.freya.documents()),column=page.getByRole('button',{name:'Acciones de la columna Ciudad',exact:true})
 await column.press('Enter')
 const menu=page.getByRole('menu',{name:'Acciones de columnas',exact:true}),submenu=menu.getByRole('menuitem',{name:'Limpiar',exact:true})
 await submenu.focus();await submenu.press('ArrowRight');await expect(page.getByRole('menu')).toHaveCount(2)
 await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(1);await expect(submenu).toBeFocused()
 await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);await expect(column).toBeFocused()
 await activeIncome();await openClean()
 await cleanMenu().getByRole('button',{name:'Rellenar vacíos de Ingreso…',exact:true}).press('Enter')
 const dialog=page.getByRole('dialog',{name:'Rellenar vacíos de Ingreso',exact:true});await expect(dialog).toBeVisible()
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(clean()).toBeFocused()
 expect(await page.evaluate(()=>window.freya.documents())).toEqual(before)
})

for(const [label,convert] of [
 ['Quitar espacios al inicio y final',(value:string)=>value.trim()],
 ['Convertir a mayúsculas',(value:string)=>value.toUpperCase()],
 ['Convertir a minúsculas',(value:string)=>value.toLowerCase()]
] as const)test(`SIM-1b: «${label}» conserva el alcance de filas y columnas marcadas`,async()=>{
 await page.getByRole('checkbox',{name:'Seleccionar columna Ciudad',exact:true}).check()
 await page.getByRole('button',{name:'Seleccionar fila 1',exact:true}).click()
 await page.getByRole('button',{name:'Seleccionar fila 3',exact:true}).click({modifiers:[process.platform==='darwin'?'Meta':'Control']})
 const menu=await openClean();await menu.getByRole('button',{name:label,exact:true}).press('Enter')
 const expected=records.map((row,index)=>row.map((value,column)=>column===1&&(index===0||index===2)?convert(value):value))
 await expect.poll(()=>readTableRows(page,500)).toEqual(expected)
 await page.getByRole('button',{name:'Deshacer',exact:true}).press('Enter')
 await expect.poll(()=>readTableRows(page,500)).toEqual(records)
})

test('SIM-1b: Ir a la fila conserva su acceso y Buscar acción muestra la tecla real del sistema',async()=>{
 const go=bar().getByRole('button',{name:'Ir a la fila',exact:true}),find=bar().getByRole('button',{name:'Buscar acción',exact:true})
 const hash=(icons as Record<string,string>).hash
 expect(hash,'icono Hash del registro local').toBeTruthy()
 const normalized=await page.evaluate(raw=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.innerHTML=raw;return svg.innerHTML},hash)
 await expect(go.locator('svg')).toHaveJSProperty('innerHTML',normalized)
 const shortcut=process.platform==='darwin'?'⌘K':'Ctrl K'
 await expect(find).toContainText(shortcut);await expect(find).toHaveAttribute('title',new RegExp(shortcut))
 await expect.poll(()=>find.evaluate((button,shortcut)=>{
  const walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT)
  for(let node=walker.nextNode();node;node=walker.nextNode()){
   const start=node.textContent?.indexOf(shortcut)??-1;if(start<0)continue
   const range=document.createRange();range.setStart(node,start);range.setEnd(node,start+shortcut.length)
   const box=range.getBoundingClientRect(),control=button.getBoundingClientRect()
   if(box.width>0&&box.height>0&&box.left>=control.left&&box.right<=control.right)return true
  }
  return false
 },shortcut),'el atajo se dibuja dentro del botón, no solo en texto oculto').toBe(true)
 await go.press('Enter');await expect(page.getByRole('spinbutton',{name:'Número de fila',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(go).toBeFocused()
 await find.press('Enter');await expect(page.getByRole('dialog',{name:'Comandos CSV',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(find).toBeFocused()
})
