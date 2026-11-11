import {chartPanel,openAnalysis,showTable,createSuggestedChart} from './panel'
import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import { closeElectron } from './close-electron'
import electronPath from 'electron'
import {mkdtemp,mkdir,writeFile,readFile,rm,truncate} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {runApplicationMenu} from './application-menu'
let app:ElectronApplication,page:Page,folder:string,markdown:string,csv:string,saveTarget:string,saveSequence=0
const text='# Documento de Freya\n\nUna idea **clara**, una lista y un ejemplo.\n\n- Consultar\n- Editar\n- Exportar\n\n## Siguiente paso\n\n```typescript\nconst nombre = "Freya"\n```\n'
const table='Cliente,Ventas\n'+Array.from({length:842},(_,i)=>`C${i},${100+i*3}`).join('\n')+'\n'
test.beforeEach(async()=>{
 saveSequence=0;folder=await mkdtemp(join(tmpdir(),'freya-u0-'));markdown=join(folder,'guia.md');csv=join(folder,'clientes.csv')
 await mkdir(join(folder,'saved'));await writeFile(markdown,text);await writeFile(csv,table)
 const {ELECTRON_RUN_AS_NODE:_,FREYALAB_TEST_SAVE_DIR:__,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:test.info().title.includes('en-XA')?'en-XA':'es',FREYALAB_USER_DATA:join(folder,'profile')}})
 await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file})},join(folder,'saved','nuevo.md'))
 page=await app.firstWindow();await page.waitForFunction(()=>!!window.freya);await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1280,height:720})
})
test.afterEach(async()=>{await closeElectron(app);await rm(folder,{recursive:true,force:true})})
const header=()=>page.locator('header.toolbar')
const save=()=>header().getByRole('button',{name:'Guardar',exact:true})
const exp=()=>header().getByRole('button',{name:'Exportar',exact:true})
async function secondaryFill(button:Locator){return button.evaluate(node=>{const context=document.createElement('canvas').getContext('2d')!;context.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--input');const expected=context.fillStyle;context.fillStyle=getComputedStyle(node).backgroundColor;return context.fillStyle===expected})}
async function open(file:string){await page.evaluate(file=>window.freya.openPaths([file]),file)}
async function theme(value:string){
 const settings=page.getByRole('dialog',{name:'Ajustes',exact:true})
 if(await settings.isVisible()){await settings.getByRole('tab',{name:'Apariencia',exact:true}).click();await settings.locator('select').filter({has:page.locator('option[value=dark]')}).selectOption(value)}
 else await page.getByLabel('Tema',{exact:true}).selectOption(value)
}
async function captures(state:string){
 for(const [width,height]of [[1440,900],[1280,720]])for(const value of ['light','dark']){
  await page.setViewportSize({width,height});await theme(value);await page.mouse.move(0,0)
  await page.screenshot({path:test.info().outputPath(`${process.env.FREYALAB_U0_PHASE||'after'}-${state}-${value}-${width}x${height}.png`)})
 }
}
async function holdSave(){
 saveTarget=join(folder,'saved',`nuevo-${++saveSequence}.md`)
 await app.evaluate(({dialog},file)=>{
  const state=globalThis as typeof globalThis&{u0SavePending?:boolean;u0ReleaseSave?:()=>void}
  dialog.showSaveDialog=()=>new Promise(resolve=>{state.u0SavePending=true;state.u0ReleaseSave=()=>{state.u0SavePending=false;resolve({canceled:false,filePath:file})}})
 },saveTarget)
}
async function releaseSave(){await app.evaluate(()=>{(globalThis as typeof globalThis&{u0ReleaseSave?:()=>void}).u0ReleaseSave?.()});await page.waitForFunction(async file=>{const docs=await window.freya.documents();return docs.some(doc=>doc.path===file&&!doc.dirty)},saveTarget)}
test('U0: capturas de estados existentes y tipografía base sin modificar archivos',async()=>{
 await expect(page.getByRole('heading',{name:'Tu siguiente idea empieza aquí.'})).toBeVisible();await captures('vacio')
 await open(markdown);await expect(page.locator('.markdown-body h1')).toHaveText('Documento de Freya');await captures('markdown')
 const fonts=await page.locator('.cm-content').evaluate(node=>({editorFamily:getComputedStyle(node).fontFamily,editorSize:getComputedStyle(node).fontSize}))
 await open(csv);await expect(page.getByRole('grid',{name:'Tabla de datos'})).toBeVisible();await captures('csv')
 expect(fonts.editorSize).toBe('13px');expect(fonts.editorFamily).toContain('JetBrains Mono')
 const cell=await page.getByRole('gridcell').first().evaluate(node=>({cellFamily:getComputedStyle(node).fontFamily,cellSize:getComputedStyle(node).fontSize}))
 expect(cell.cellSize).toBe('11px');expect(cell.cellFamily).toContain('JetBrains Mono')
 await writeFile(test.info().outputPath('fonts.json'),JSON.stringify({...fonts,...cell},null,2))
 await openAnalysis(page,'Gráficos');await createSuggestedChart(page);await expect(page.locator('.pivot-result')).toBeVisible();await captures('resumen')
 await runApplicationMenu(app,'app.settings');await captures('ajustes');await page.getByRole('dialog',{name:'Ajustes',exact:true}).getByRole('button',{name:'Cerrar',exact:true}).click()
 await showTable(page);await page.getByLabel('Buscar en tabla',{exact:true}).fill('sin-coincidencias-u0');await expect(page.locator('.statusbar')).toContainText('0 de 842 filas');await captures('sin-resultados')
 await runApplicationMenu(app,'file.newMarkdown');await page.waitForFunction(async()=>{const docs=await window.freya.documents();return docs.some(doc=>!doc.path)})
 await holdSave();await save().click();await expect.poll(()=>app.evaluate(()=>(globalThis as typeof globalThis&{u0SavePending?:boolean}).u0SavePending)).toBe(true)
 await captures('guardando');await releaseSave()
 expect(await readFile(markdown,'utf8')).toBe(text);expect(await readFile(csv,'utf8')).toBe(table)
})
test('U0: un primario Guardar/Exportar/Abrir con cajas y nombres estables en ambos temas',async()=>{
 for(const value of ['light','dark']){
  await theme(value);await open(markdown);await expect(page.locator('.markdown-body h1')).toHaveText('Documento de Freya')
  await expect(save()).toBeDisabled();await expect(exp()).toHaveClass(/btn-primary/);expect(await secondaryFill(save())).toBe(true)
  const editor=page.locator('.cm-content');await editor.click();await page.keyboard.press('ControlOrMeta+End');await page.keyboard.insertText('\nNueva idea.\n')
  await expect(save()).toHaveClass(/btn-primary/);await expect(exp()).not.toHaveClass(/btn-primary/);expect(await secondaryFill(exp())).toBe(true)
  await expect(header().locator('button.btn-primary:enabled')).toHaveCount(1)
  const dirty=await save().boundingBox();await save().click();await expect(save()).toBeDisabled();await expect(exp()).toHaveClass(/btn-primary/);expect(await secondaryFill(save())).toBe(true)
  const clean=await save().boundingBox();expect(clean).toEqual(dirty)
  await runApplicationMenu(app,'file.newMarkdown');await expect(save()).toHaveClass(/btn-primary/);await expect(save()).toBeEnabled();await holdSave()
  const before=await save().boundingBox();await save().click();await expect.poll(()=>app.evaluate(()=>(globalThis as typeof globalThis&{u0SavePending?:boolean}).u0SavePending)).toBe(true)
  await expect(save()).toHaveAttribute('aria-busy','true');await expect(save()).toBeDisabled();await expect(save()).toHaveClass(/btn-primary/);await expect(exp()).not.toHaveClass(/btn-primary/);expect(await save().boundingBox()).toEqual(before)
  await expect(save()).toHaveAccessibleName('Guardar');await expect(exp()).toHaveAccessibleName('Exportar');await releaseSave();await expect(exp()).toHaveClass(/btn-primary/)
 }
 const plain=join(folder,'nota.txt');await writeFile(plain,'Solo texto');await open(plain);await expect(save()).toBeDisabled();await expect(exp()).toBeDisabled();await expect(header().getByRole('button',{name:'Abrir',exact:true})).toHaveClass(/btn-primary/)
})

test('U0: los botones deshabilitados visibles explican su motivo con title y descripción accesible',async()=>{
 await open(csv);await expect(page.getByRole('grid')).toBeVisible()
 const rows=await page.locator('button:disabled').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).map(node=>({label:node.getAttribute('aria-label')||node.textContent,title:node.getAttribute('title'),description:(node.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean).map(id=>document.getElementById(id)?.textContent||'').join(' ')})))
 expect(rows.length).toBeGreaterThan(0)
 for(const row of rows){expect(row.title,row.label||'').toBeTruthy();expect(row.description,row.label||'').toBeTruthy()}
})


test('U0: contraste real, foco por teclado, pulsación y movimiento reducido',async()=>{
 for(const value of ['light','dark']){
  await theme(value);await open(markdown);await expect(exp()).toBeEnabled()
  const divider=await page.getByRole('slider',{name:'Ancho del explorador',exact:true}).evaluate(node=>{const r=node.getBoundingClientRect(),pseudo=getComputedStyle(node,'::before');return {visual:r.width,target:r.width-parseFloat(pseudo.left)-parseFloat(pseudo.right),hit:document.elementFromPoint(r.x+10,r.y+100)===node}});expect(divider.visual).toBe(1);expect(divider.target).toBeGreaterThanOrEqual(24);expect(divider.hit).toBe(true)
  const colors=await exp().evaluate(node=>{const s=getComputedStyle(node);return {ink:s.color,background:s.backgroundColor,border:s.borderColor}})
  const lum=(rgb:string)=>rgb.match(/[\d.]+/g)!.slice(0,3).map(Number).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0)
  const a=lum(colors.ink),b=lum(colors.background);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toBeGreaterThanOrEqual(4.5)
  await page.keyboard.press('Tab');await exp().focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');await expect(exp()).toBeFocused()
  const focus=await exp().evaluate(n=>{const s=getComputedStyle(n);return {width:s.outlineWidth,offset:s.outlineOffset,style:s.outlineStyle,font:s.fontSize,height:n.getBoundingClientRect().height}})
  expect(focus).toMatchObject({width:'2px',offset:'2px',style:'solid',font:'13px'});expect(focus.height).toBeGreaterThanOrEqual(24)
  await page.mouse.move(...await exp().evaluate(n=>{const b=n.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2] as [number,number]}));await page.mouse.down()
  expect(await exp().evaluate(n=>getComputedStyle(n).transform)).toBe('matrix(1, 0, 0, 1, 0, 1)');await page.mouse.move(0,0);await page.mouse.up()
  expect(await exp().evaluate(n=>getComputedStyle(n).transitionDuration)).toBe('0s')
 }
 const formatted=join(folder,'formato.md');await writeFile(formatted,'Freya');await open(formatted);await page.locator('.cm-content').focus();await page.keyboard.press('ControlOrMeta+a');await page.keyboard.press('ControlOrMeta+b')
 const bold=page.getByRole('button',{name:'Negrita',exact:true});await expect(bold).toHaveAttribute('aria-pressed','true');expect(await bold.evaluate(n=>getComputedStyle(n).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
 await page.emulateMedia({forcedColors:'active'});const forced=await save().evaluate(n=>{const s=getComputedStyle(n);return {border:s.borderTopWidth,adjust:s.forcedColorAdjust}});expect(forced).toEqual({border:'2px',adjust:'auto'})
})

test('U0: idiomas en-XA y en conservan nombres, motivos y cajas de la barra',async()=>{
 for(const language of ['en-XA','en'] as const){
  if(language==='en')await page.evaluate(()=>window.freya.setLanguage('en'));await expect(page.locator('html')).toHaveAttribute('lang',language)
  for(const value of ['light','dark']){
   await page.locator('select').filter({has:page.locator('option[value=dark]')}).selectOption(value)
   await open(markdown);await expect(page.locator('.cm-content')).toBeVisible()
   const buttons=header().locator('button');expect(await buttons.evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).every(n=>n.scrollWidth<=n.clientWidth))).toBe(true)
   const unavailable=header().locator('button:disabled');expect(await unavailable.count()).toBeGreaterThan(0)
   for(const button of await unavailable.all()){await expect(button).toHaveAttribute('title',/\S/);await expect(button).toHaveAccessibleDescription(/\S/)}
   await page.screenshot({path:test.info().outputPath(`after-${language}-${value}-1280x720.png`)})
  }
 }
 expect(await readFile(markdown,'utf8')).toBe(text)
})


test('U0: solo lectura conserva sus restricciones y Abrir como acción disponible',{tag:'@perf'},async()=>{
 const large=join(folder,'muestra.csv');await writeFile(large,'A,B\n'+'001,2\n'.repeat(250));await truncate(large,50*1024*1024+1);await open(large)
 await expect.poll(()=>page.evaluate(async()=>{const docs=await window.freya.documents();return docs.find(doc=>doc.name==='muestra.csv')?.readonly})).toBe(true)
 for(const value of ['light','dark']){await theme(value);await expect(save()).toBeDisabled();await expect(exp()).toBeDisabled();await expect(header().getByRole('button',{name:'Abrir',exact:true})).toHaveClass(/btn-primary/);await expect(save()).toHaveAccessibleDescription(/lectura/);await expect(exp()).toHaveAccessibleDescription(/lectura/)}
})

test('U0: Más opciones sigue visible con resumen paginado y controles de 13 px',async()=>{
 await open(csv);await openAnalysis(page,'Gráficos');await createSuggestedChart(page);await expect(page.locator('.pivot-result')).toBeVisible()
 for(const width of [1280,1440,800]){
  await page.setViewportSize({width,height:width===1440?900:720})
  const summary=page.locator('.more-options>summary');await test.info().attach('an1b-layout-'+width,{body:JSON.stringify(await page.locator('.analysis-workspace').evaluate(root=>Object.fromEntries([':scope','header','.analysis-sections','h2','.charts-panel','.chart-result','.chart-intro','.result-status','.truncated','.chart-types','.suggestion','.plot-scroll','.pivot-result','.more-options'].map(selector=>{const node=root.querySelector(selector)??root,box=node.getBoundingClientRect();return[selector,{y:box.y,height:box.height,bottom:box.bottom,scroll:node.scrollHeight,client:node.clientHeight}]})))),contentType:'application/json'});await expect(summary).toBeInViewport({ratio:1})
  await summary.focus();await page.keyboard.press('Enter');await expect(page.locator('.more-options')).toHaveAttribute('open','');await page.keyboard.press('Enter')
 }
})

test('U0: la ayuda del gráfico se despliega debajo de su control y permite cerrarla',async()=>{
 await open(csv);await page.setViewportSize({width:1440,height:900});await openAnalysis(page,'Gráficos');await createSuggestedChart(page);await expect(page.locator('.pivot-result')).toBeVisible()
 const summary=page.locator('.chart-info>summary');await summary.click();await expect(page.locator('.chart-info')).toHaveAttribute('open','')
 const [trigger,popup]=await Promise.all([summary.boundingBox(),page.locator('.chart-info .info-content').boundingBox()]);expect(popup!.y).toBeGreaterThanOrEqual(trigger!.y+trigger!.height)
 await summary.click();await expect(page.locator('.chart-info')).not.toHaveAttribute('open')
})

test('U0: Calculando cabe en el botón real con en-XA, inglés y español',async()=>{
 await open(csv);await openAnalysis(page,'Estadísticas');await expect(page.locator('.statistics-panel')).toBeVisible()
 const samples=[]
 for(const language of ['en-XA','en','es'] as const){
  if(language!=='en-XA')await page.evaluate(language=>window.freya.setLanguage(language),language)
  await expect(page.locator('html')).toHaveAttribute('lang',language)
  const button=page.locator('.statistics-panel button[type=submit]')
  const measured=await button.evaluate(async node=>{(node as HTMLButtonElement).click();await Promise.resolve();await Promise.resolve();const label=node.querySelector<HTMLElement>('.busy-label')!,spinner=node.querySelector('.button-spinner')!;const context=document.createElement('canvas').getContext('2d')!,font=getComputedStyle(node);context.font=`${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;return{busy:node.getAttribute('aria-busy'),width:label.getBoundingClientRect().width,needed:context.measureText(label.dataset.loading!).width,spinner:spinner.getBoundingClientRect().width}})
  samples.push({language,...measured});expect(measured.busy).toBe('true');expect(measured.spinner).toBe(12);expect(measured.width+.5).toBeGreaterThanOrEqual(measured.needed)
  await expect(button).toHaveAttribute('aria-busy','false')
 }
 await writeFile(test.info().outputPath('loading-labels.json'),JSON.stringify(samples,null,2));expect(await readFile(csv,'utf8')).toBe(table)
})

for(const locale of ['es','en-XA'] as const)test(`U0.1: campos legibles y orden a 1280 × 720 (${locale})`,async()=>{
 const phase=process.env.FREYALAB_U01_PHASE
 const capture=async(state:string,value:string)=>{
  if(phase){await page.mouse.move(0,0);await page.screenshot({path:test.info().outputPath(`${phase}-${state}-${value}-1280x720.png`)})}
 }
 if(locale==='es')for(const value of ['light','dark'] as const){
  await page.emulateMedia({colorScheme:value})
  await theme('system')
  await expect(header().locator('button.btn-primary:enabled')).toHaveCount(1)
  await capture('inicio',value)
  const themeFits=await page.locator('.sidebar-bottom select').evaluate(node=>{
   const style=getComputedStyle(node),context=document.createElement('canvas').getContext('2d')!
   context.font=style.font
   const width=context.measureText((node as HTMLSelectElement).selectedOptions[0].text).width
   return node.getBoundingClientRect().width>=width+parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+20
  })
  expect.soft(themeFits,value).toBe(true)
  const tabs=await page.locator('.sidebar-tabs button').evaluateAll(nodes=>nodes.map(node=>({
   selected:node.getAttribute('aria-selected')==='true',border:getComputedStyle(node).borderBottomColor
  })))
  expect.soft(tabs.filter(tab=>tab.selected)).toHaveLength(1)
  for(const tab of tabs)expect.soft(tab.border==='rgba(0, 0, 0, 0)').toBe(!tab.selected)
 }
 await open(csv)
 await expect(page.getByRole('gridcell').first()).toBeVisible()
 await expect(header().locator('button.btn-primary:enabled')).toHaveCount(1)
 const sort=page.getByRole('button',{name:'Cliente',exact:true})
 await expect(sort).toBeVisible()
 if(locale==='es')for(const value of ['light','dark']){
  await theme(value)
  await capture('tabla',value)
  const appearance=await sort.evaluate(node=>{
   const style=getComputedStyle(node)
   return {background:style.backgroundColor,border:style.borderTopColor,width:style.borderTopWidth,shadow:style.boxShadow}
  })
  expect.soft(appearance.background,value).toBe('rgba(0, 0, 0, 0)')
  expect.soft(appearance.border==='rgba(0, 0, 0, 0)'||appearance.width==='0px',value).toBe(true)
  expect.soft(appearance.shadow,value).toBe('none')
 }
 await sort.hover()
 expect(await sort.evaluate(node=>getComputedStyle(node).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
 await sort.focus()
 await page.keyboard.press('Shift+Tab')
 await page.keyboard.press('Tab')
 await expect(sort).toBeFocused()
 expect(await sort.evaluate(node=>getComputedStyle(node).outlineStyle)).toBe('solid')
 const wide=join(folder,'campos.csv')
 await writeFile(wide,'Cliente,Ventas,Región,Segmento\n'+Array.from({length:842},(_,i)=>`C${i},${100+i*3},${i%2?'Norte':'Sur'},${i%2?'A':'B'}`).join('\n')+'\n')
 await open(wide)
 await openAnalysis(page,'Gráficos');await createSuggestedChart(page)
 await expect(page.locator('.pivot-result')).toBeVisible()
 if(locale==='es')for(const [field,zone] of [['Cliente','Filas'],['Ventas','Valores']]){
  await page.locator(`.field-entry[title="${field}"] button`).click()
  await page.getByRole('menuitem',{name:new RegExp(`^Añadir a ${zone}(?: |$)`)}).click()
 }
 const entries=page.locator('.field-list .field-entry')
 await expect(entries).toHaveCount(4)
 for(const language of locale==='es'?['es','en']:['en-XA']){
  if(language==='en')await page.evaluate(()=>window.freya.setLanguage('en'))
  await expect(page.locator('html')).toHaveAttribute('lang',language)
  if(language!=='en-XA'){
   const notice=chartPanel(page).locator('.truncated.notice')
   await expect(notice).toBeVisible()
   expect.soft(await notice.innerText()).toContain(language==='es'?'de menor a mayor':'ascending')
  }
  for(const value of ['light','dark']){
   await page.locator('.sidebar-bottom select').selectOption(value)
   await capture(`campos-${language}`,value)
   const boxes=await entries.evaluateAll(rows=>rows.map(row=>{
    const badge=row.querySelector('.field-badge')!,button=row.querySelector('button')!,name=row.querySelector('.field-name')!
    const b=button.getBoundingClientRect(),r=row.getBoundingClientRect(),label=badge.getBoundingClientRect(),title=name.getBoundingClientRect()
    return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,rowRight:r.right,badgeLeft:label.left,badgeRight:label.right,clipped:badge.scrollWidth>badge.clientWidth,nameWidth:title.width,nameRight:title.right,hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===button}
   }))
   for(const [index,box] of boxes.entries()){
    expect.soft(box.clipped,`${language}/${value} badge ${index}`).toBe(false)
    expect.soft(box.nameWidth).toBeGreaterThan(0)
    expect.soft(box.right).toBeLessThanOrEqual(box.rowRight+.5)
    expect.soft(box.nameRight).toBeLessThanOrEqual(box.badgeLeft)
    expect.soft(box.badgeRight).toBeLessThanOrEqual(box.left)
    expect.soft(box.hit).toBe(true)
    if(index)expect.soft(box.top-boxes[index-1].bottom,`${language}/${value} row gap ${index}`).toBeGreaterThanOrEqual(4)
   }
   await expect(header().locator('button.btn-primary:enabled')).toHaveCount(1)
  }
 }
})
