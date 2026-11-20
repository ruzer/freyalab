import {test,expect,_electron as electron,type ElectronApplication,type Page,type Locator} from '@playwright/test'
import electronPath from 'electron'
import {createHash} from 'node:crypto'
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {t,plural,type Language,type TranslationParameters} from '../../src/shared/i18n'
import {closeElectron} from './close-electron'
import {traceElectronFailure} from './electron-trace'
import {openAnalysis,showTable,analysisRegion,analysisExportItem,exportAnalysis} from './panel'

let app:ElectronApplication,page:Page,folder:string,fixture:Buffer,language:Language,errors:string[],files:Map<string,Buffer>,stopTrace:(()=>Promise<void>)|undefined
const tr=(key:string,parameters:TranslationParameters={})=>t(key,parameters,language)
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex')
const release=()=>app.evaluate(()=>Reflect.get(globalThis,'informationClarityProbe')?.release?.())
const revisionText=/r[eéë]v[iíï]s[iíï][oóö]n/iu

async function open(name='encuesta.csv',source:Buffer|string=fixture,rows=4){
 const path=join(folder,name),bytes=Buffer.isBuffer(source)?source:Buffer.from(source);files.set(path,bytes);await writeFile(path,bytes)
 const [doc]=await page.evaluate(path=>window.freya.openPaths([path]),path),grid=page.getByRole('grid',{name:'Tabla de datos',exact:true})
 await expect(grid).toBeVisible();await expect(grid.locator('.csv-row')).toHaveCount(rows);return doc
}
async function information(){await openAnalysis(page,'Información');return analysisRegion(page,tr('info.title'))}
async function ready(panel:Locator,count:number){
 await expect(panel.getByRole('button',{name:tr('info.refresh'),exact:true})).toBeEnabled()
 await expect(panel.locator('tbody tr')).toHaveCount(Math.min(count,50))
}
// Un anunciador absoluto de un píxel puede seguir en el árbol accesible sin reservar una línea.
async function flowFootprint(locator:Locator){return locator.evaluateAll(elements=>Math.max(0,...elements.map(element=>{
 const style=getComputedStyle(element)
 if(style.display==='none'||style.visibility==='hidden'||style.position==='absolute'||style.position==='fixed')return 0
 return element.getBoundingClientRect().height+(parseFloat(style.marginTop)||0)+(parseFloat(style.marginBottom)||0)
})))}
async function compactComplete(panel:Locator){
 expect(await flowFootprint(panel.locator(':scope>[role=status]'))).toBeLessThanOrEqual(1)
 expect(await flowFootprint(panel.locator(':scope>.scope'))).toBeLessThanOrEqual(1)
 const gap=await panel.evaluate(element=>{
  const chips=element.querySelector('.type-chips')!,table=element.querySelector('.overview-scroll')!,parent=getComputedStyle(element)
  return{actual:table.getBoundingClientRect().top-chips.getBoundingClientRect().bottom,allowed:(parseFloat(getComputedStyle(chips).marginBottom)||0)+(parseFloat(getComputedStyle(table).marginTop)||0)+(parseFloat(parent.rowGap)||0)+1}
 })
 expect(gap.actual).toBeLessThanOrEqual(gap.allowed)
}
async function trailingChevron(summary:Locator){
 const icon=summary.locator('svg.icon[aria-hidden=true]');await expect(icon).toHaveCount(1)
 const geometry=await summary.evaluate(element=>{
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),rights:number[]=[]
  while(walker.nextNode())if(walker.currentNode.textContent?.trim()&&!walker.currentNode.parentElement?.closest('svg,[aria-hidden=true]')){
   const range=document.createRange();range.selectNodeContents(walker.currentNode);rights.push(range.getBoundingClientRect().right)
  }
  const style=getComputedStyle(element),marker=getComputedStyle(element,'::-webkit-details-marker')
  return{iconLeft:element.querySelector('svg')!.getBoundingClientRect().left,textRight:Math.max(...rights),nativeHidden:style.listStyleType==='none'||style.display!=='list-item'||marker.display==='none'}
 })
 expect(geometry.nativeHidden).toBe(true);expect(geometry.iconLeft).toBeGreaterThanOrEqual(geometry.textRight-1)
}
async function holdSecondProfile(){
 await app.evaluate(({ipcMain})=>{
  type Handler=(event:Electron.IpcMainInvokeEvent,...args:unknown[])=>Promise<unknown>
  const handlers=(ipcMain as Electron.IpcMain&{_invokeHandlers:Map<string,Handler>})._invokeHandlers,original=handlers.get('freya')!
  const state={armed:true,held:false,release:undefined as (()=>void)|undefined};Reflect.set(globalThis,'informationClarityProbe',state)
  handlers.set('freya',async(event,...args)=>{
   if(args[0]==='cancelAnalysis')state.release?.()
   const result=await original(event,...args)
   if(args[0]==='analyzeColumn'&&Reflect.get(args[2] as object,'column')===1&&state.armed){
    state.armed=false;state.held=true
    await new Promise<void>(resolve=>{state.release=()=>{state.held=false;state.release=undefined;resolve()}})
   }
   return result
  })
 })
}

test.beforeEach(async({},info)=>{
 language=(info.title.match(/\[(es|en|en-XA)\]$/)?.[1]??'es') as Language;folder=await mkdtemp(join(tmpdir(),'freya-info-clarity-'));fixture=await readFile(resolve('tests/fixtures/analysis-auto-info.csv'));files=new Map();errors=[];stopTrace=undefined
 const {ELECTRON_RUN_AS_NODE:_,...env}=process.env
 app=await electron.launch({chromiumSandbox:true,executablePath:process.env.FREYALAB_EXECUTABLE||electronPath as unknown as string,args:process.env.FREYALAB_EXECUTABLE?[]:[resolve('out/main/index.js')],env:{...env as Record<string,string>,FREYALAB_TEST:'1',FREYALAB_LANG:language,FREYALAB_USER_DATA:join(folder,'profile')}})
 page=await app.firstWindow();stopTrace=await traceElectronFailure(page.context(),info);page.on('pageerror',error=>errors.push(error.message));await page.waitForFunction(()=>!!window.freya);await page.setViewportSize({width:1440,height:900})
})
test.afterEach(async()=>{
 try{
  if(app)await release().catch(()=>{})
  expect(errors).toEqual([])
  for(const[path,bytes]of files){const actual=await readFile(path);expect(actual).toEqual(bytes);expect(digest(actual)).toBe(digest(bytes))}
 }finally{try{await stopTrace?.();if(app)await closeElectron(app)}finally{await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:200})}}
})

for(const locale of ['es','en','en-XA'] as const)test('SIM-2d: resultado completo compacto, alineación y revisión en ayuda ['+locale+']',async()=>{
 const doc=await open(),panel=await information();await ready(panel,6)
 await compactComplete(panel)
 await expect(panel.locator('.file-summary')).toHaveCount(1);await expect(panel.locator('.file-summary')).toContainText(plural('info.count.rows',4,{},language)+' × '+plural('info.count.columns',6,{},language))
 await expect(panel.locator('.file-summary')).toContainText(tr('csvText.encoding.utf8'));await expect(panel.locator('.file-summary')).toContainText(tr('project.source.comma'));await expect(panel.locator('.file-summary')).toContainText(tr('info.withHeader'))
 await expect(panel.locator('.type-chips>span')).toHaveText([plural('info.kind.number',2,{},language),plural('info.kind.date',1,{},language),plural('info.kind.identifier',1,{},language),plural('info.kind.category',2,{},language)])
 const rows=panel.locator('tbody tr');await expect(rows.getByRole('rowheader')).toHaveText(['ID','Ciudad','Edad','Ingreso','Fecha','Opcional']);await expect(rows.locator('.non-empty')).toHaveText(['4','4','4','3','4','2']);await expect(rows.locator('.distinct-detail>summary')).toHaveText(['4','2','4','3','4','1'])
 await expect(panel.locator('thead th')).toHaveText(['#',...['column','type','content','empty','unique','detail'].map(key=>tr('info.header.'+key))])
 for(const index of [1,2]){expect(await panel.locator('thead th').nth(index).evaluate(element=>getComputedStyle(element).textAlign)).toMatch(/^(left|start)$/);expect(await rows.first().locator('th,td').nth(index).evaluate(element=>getComputedStyle(element).textAlign)).toMatch(/^(left|start)$/)}
 for(const index of [0,3,4,5]){expect(await panel.locator('thead th').nth(index).evaluate(element=>getComputedStyle(element).textAlign)).toMatch(/^(right|end)$/);expect(await rows.first().locator('th,td').nth(index).evaluate(element=>getComputedStyle(element).textAlign)).toMatch(/^(right|end)$/)}
 await expect(panel.getByRole('searchbox',{name:tr('info.searchLabel'),exact:true})).toHaveCount(0);await expect(panel.locator('.pagination')).toHaveCount(0);await expect(panel.getByRole('button',{name:tr('info.report'),exact:true})).toHaveCount(0)
 const visibleParagraphs=await panel.locator(':scope>p').evaluateAll(elements=>elements.filter(element=>{const style=getComputedStyle(element);return style.position!=='absolute'&&style.position!=='fixed'&&element.getBoundingClientRect().height>1}).map(element=>element.textContent).join('\n'));expect(visibleParagraphs).not.toMatch(revisionText)
 const help=panel.locator(':scope>details').filter({has:page.locator('summary').filter({hasText:tr('info.how')})});await help.locator(':scope>summary').focus();await help.locator(':scope>summary').press('Enter');await expect(help).toHaveAttribute('open','');await expect(help).toContainText(new RegExp(revisionText.source+'[^0-9]*'+doc.revision,'iu'))
 await expect(await analysisExportItem(page,'info.report')).toHaveAttribute('aria-disabled','false');await page.keyboard.press('Escape')
 expect((await page.evaluate(()=>window.freya.documents())).find(value=>value.id===doc.id)).toMatchObject({dirty:false,revision:doc.revision,rowCount:4})
})

test('SIM-2d: detalles con chevron posterior, acciones y Explorar conservan teclado y datos',async()=>{
 await open();const panel=await information();await ready(panel,6);const rows=panel.locator('tbody tr'),type=rows.first().locator('.type-explanation>summary'),quality=rows.nth(5).locator('.quality-breakdown>summary'),distinct=rows.nth(5).locator('.distinct-detail>summary')
 await trailingChevron(type);await trailingChevron(quality);await trailingChevron(distinct)
 await expect(type).toHaveText(tr('info.type.identifier'));await expect(quality).toHaveAttribute('aria-label',tr('empty.countPercent',{count:'2',percent:'50'})+' · '+tr('info.emptyHelp',{name:'Opcional'}));await expect(distinct).toHaveAttribute('aria-label','1 · '+tr('info.distinctHelp',{name:'Opcional'}))
 await type.focus();await type.press('Enter');await expect(rows.first().locator('.type-explanation')).toHaveAttribute('open','');await expect(rows.first()).toContainText('ceros iniciales')
 await quality.focus();await quality.press('Enter');await expect(rows.nth(5).locator('.quality-breakdown')).toHaveAttribute('open','');await expect(rows.nth(5).locator('.quality-breakdown dd')).toHaveText(['0','1','1'])
 for(const action of ['view','fill','delete'])await expect(rows.nth(5).getByRole('button',{name:tr('empty.'+action),exact:true})).toBeEnabled()
 await distinct.focus();await distinct.press('Enter');await expect(rows.nth(5).locator('.distinct-detail')).toHaveAttribute('open','');await expect(rows.nth(5).locator('.distinct-detail p').nth(1)).toHaveText(tr('info.repetitions',{count:'1'}))
 const inspect=rows.nth(5).getByRole('button',{name:tr('info.inspect',{index:6}),exact:true});await expect(inspect).toHaveText(/^Explorar\s*›?$/)
 expect(await inspect.evaluate(element=>['borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'].map(key=>parseFloat(Reflect.get(getComputedStyle(element),key))))).toEqual([0,0,0,0])
 await inspect.focus();await inspect.press('Enter');const detail=page.getByRole('region',{name:'Exploración de columna',exact:true});await expect(detail.getByLabel('Columna para explorar',{exact:true})).toHaveValue('5');await expect(detail.getByLabel('Filas para explorar',{exact:true})).toHaveValue('all');await expect(page.locator('.analysis-workspace:not([hidden]) header h2')).toBeFocused()
 await detail.getByRole('button',{name:'Explorar columna',exact:true}).click();await expect(detail.getByRole('status')).toHaveText('Exploración completa.')
})

test('SIM-2d: buscador desde 21 columnas y páginas desde 51 sin recortar datos',async()=>{
 for(const count of [20,21,50,51]){
  if(count!==20)await showTable(page)
  const headers=Array.from({length:count},(_,index)=>'Campo '+(index+1)),source=[headers.join(','),headers.map((_,index)=>String(index)).join(','),headers.map((_,index)=>String(index+1)).join(',')].join('\n')+'\n'
  await open('ancha-'+count+'.csv',source,2);const panel=await information();await ready(panel,count)
  const search=panel.getByRole('searchbox',{name:tr('info.searchLabel'),exact:true});await expect(search).toHaveCount(count>20?1:0);await expect(panel.locator('.pagination')).toHaveCount(count>50?1:0)
  await expect(panel.locator('tbody tr').first().getByRole('rowheader')).toHaveText('Campo 1');await expect(panel.locator('tbody tr').first().locator('.non-empty')).toHaveText('2')
  if(count===51){await panel.getByRole('button',{name:tr('info.next'),exact:true}).click();await expect(panel.locator('tbody tr')).toHaveCount(1);await expect(panel.locator('tbody tr').first().getByRole('rowheader')).toHaveText('Campo 51');await expect(panel.locator('tbody tr').first().locator('td').first()).toHaveText('51');await search.fill('Campo 51');await expect(panel.locator('tbody tr')).toHaveCount(1);await expect(panel.locator('.pagination')).toHaveCount(0)}
 }
})

test('SIM-2d: ocupado visible, alcance filtrado o marcado e informe mantienen sus recuentos',async()=>{
 await open();await holdSecondProfile();const panel=await information()
 try{
  await expect.poll(()=>app.evaluate(()=>Reflect.get(globalThis,'informationClarityProbe').held)).toBe(true);await expect(panel.getByRole('status')).toHaveText(tr('info.progress',{done:2,total:6}));await expect(panel.locator('tbody tr')).toHaveCount(1)
  expect(await flowFootprint(panel.locator(':scope>[role=status]'))).toBeGreaterThan(1);expect(await flowFootprint(panel.locator(':scope>.scope'))).toBeLessThanOrEqual(1)
  await expect(await analysisExportItem(page,'info.report')).toHaveAttribute('aria-disabled','true');await page.keyboard.press('Escape')
 }finally{await release()}
 await ready(panel,6);await compactComplete(panel)
 await showTable(page);await page.getByLabel('Buscar en tabla',{exact:true}).fill('Oaxaca');await expect(page.locator('footer')).toContainText('2 de 4 filas');await information();await panel.getByLabel(tr('info.scopeLabel'),{exact:true}).selectOption('view');await panel.getByRole('button',{name:tr('info.refresh'),exact:true}).click();await ready(panel,6)
 expect(await flowFootprint(panel.locator(':scope>.scope'))).toBeGreaterThan(1);await expect(panel.locator('.scope')).toContainText(tr('info.scope.view'));await expect(panel.locator('.scope')).not.toContainText(revisionText);await expect(panel.locator('tbody tr').locator('.non-empty')).toHaveText(['2','2','2','2','2','0'])
 await showTable(page);await page.getByLabel('Seleccionar columna ID',{exact:true}).check();await page.getByLabel('Seleccionar columna Ciudad',{exact:true}).check();await information();await panel.getByLabel(tr('info.columnsLabel'),{exact:true}).selectOption('selected');await panel.getByLabel(tr('info.scopeLabel'),{exact:true}).selectOption('all');await panel.getByRole('button',{name:tr('info.refresh'),exact:true}).click();await ready(panel,2)
 expect(await flowFootprint(panel.locator(':scope>.scope'))).toBeGreaterThan(1);await expect(panel.locator('.scope')).toContainText(tr('info.columnsSelectedAtStart'));await expect(panel.locator('tbody tr').getByRole('rowheader')).toHaveText(['ID','Ciudad']);await expect(panel.locator('tbody tr').locator('.non-empty')).toHaveText(['4','4'])
 await exportAnalysis(page,'info.report');await expect.poll(async()=>(await page.evaluate(()=>window.freya.documents())).find(value=>value.kind==='markdown')?.text).toContain('Columnas solicitadas: 2. Analizadas: 2. No disponibles: 0.');const output=(await page.evaluate(()=>window.freya.documents())).find(value=>value.kind==='markdown')!;expect(output.text).toContain('"1. ID"');expect(output.text).toContain('"2. Ciudad"');expect(output.text).not.toContain('"6. Opcional"')
})
