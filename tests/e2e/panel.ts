import {runApplicationMenu} from './application-menu'
import {expect,type Page,type ElectronApplication} from '@playwright/test'
import {t} from '../../src/shared/i18n'
import type {Language,TranslationParameters} from '../../src/shared/i18n'
import type {ChartKind} from '../../src/shared/charts'
import type {ChartConfiguration} from '../../src/shared/chart-presets'
import type {DocumentInfo} from '../../src/shared/types'
const sections={'Información':'info','Gráficos':'charts','Estadísticas':'statistics','Análisis':'sql','SQL':'sql'} as const
const workspace=(page:Page)=>page.locator('.analysis-workspace:not([hidden])')
async function translated(page:Page,key:string,parameters:TranslationParameters={}){return t(key,parameters,(await page.locator('html').getAttribute('lang')??'es') as Language)}
export const analyzeButton=(page:Page)=>page.locator('.csv-toolbar,.csv-text-tools').getByRole('button',{name:/^(Analizar|Analyze|\[Ánályzë~+\])$/})
// Pedir el análisis puede abrir primero el diálogo de cambio desde CSV Texto.
export async function requestAnalysis(page:Page,app?:ElectronApplication){
 if(app){const commands=await openCsvCommands(page,app);const search=commands.getByRole('searchbox',{name:'Buscar comando CSV',exact:true});await search.fill('info');await search.press('Enter')}
 else await analyzeButton(page).click()
}
export async function openCsvCommands(page:Page,app:ElectronApplication){
 await runApplicationMenu(app,'edit.commandPalette')
 const commands=page.getByRole('dialog',{name:'Comandos CSV',exact:true});await expect(commands).toBeVisible();return commands
}
async function sourceAnalysisTab(page:Page){
 const sourceId=(await page.locator('.tabs[role=tablist]').getByRole('tab',{selected:true}).getAttribute('id'))?.replace('workspace-tab-','')
 return page.locator('[id='+JSON.stringify('workspace-tab-analysis:'+sourceId)+']')
}
export async function requestAnalysisTab(page:Page){await (await sourceAnalysisTab(page)).click()}
export async function openAnalysis(page:Page,name:keyof typeof sections='Información'){
 if(!await workspace(page).isVisible()){
  const analysis=await sourceAnalysisTab(page)
  if(await analysis.count())await analysis.click()
  else{
   const toolbar=page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true})
   if(name==='Información'||!await toolbar.isVisible())await requestAnalysis(page)
   else{
    await toolbar.getByRole('button',{name:await translated(page,'charts.toolbar.findAction'),exact:true}).click()
    const search=page.getByRole('searchbox',{name:'Buscar comando CSV',exact:true})
    await search.fill({'Gráficos':'Gráficos','Estadísticas':'Estadísticas y exploración','Análisis':'Análisis SQL y asistentes','SQL':'Análisis SQL y asistentes'}[name]);await search.press('Enter')
   }
  }
 }
 return selectAnalysis(page,name)
}
export async function selectAnalysis(page:Page,name:keyof typeof sections){
 await expect(workspace(page)).toBeVisible()
 const button=workspace(page).getByRole('tablist',{name:await translated(page,'analysis.tab.sections'),exact:true}).getByRole('tab',{name:await translated(page,'analysis.tab.section.'+sections[name]),exact:true})
 if(await button.getAttribute('aria-selected')!=='true')await button.click()
 return workspace(page)
}
export async function showTable(page:Page,name?:string){
 if(name)await page.locator('.tabs[role=tablist]').getByRole('tab',{name,exact:true}).click()
 else if(await workspace(page).isVisible())await workspace(page).getByRole('button',{name:await translated(page,'analysis.tab.return'),exact:true}).click()
 await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
}
export async function closeAnalysis(page:Page){
 const tab=page.locator('.tabs[role=tablist]').getByRole('tab',{selected:true})
 await tab.locator('..').locator('.tab-close').click()
 await expect(workspace(page)).toHaveCount(0)
 await expect(page.getByRole('grid',{name:'Tabla de datos',exact:true})).toBeVisible()
}
// Las comprobaciones de alcance pueden conservar este panel mientras se vuelve al CSV visible.
export async function analysisRegion(page:Page,name:string){
 const id=await workspace(page).getAttribute('id')
 if(!id)throw new Error('No hay una pestaña de análisis activa')
 return page.locator('[id='+JSON.stringify(id)+']').getByRole('region',{name,exact:true,includeHidden:true})
}
export async function openColumnExplorer(page:Page){
 await showPanel(page,'Estadísticas')
 const statistics=await analysisRegion(page,'Estadísticas por columna')
 const explorer=statistics.getByRole('region',{name:'Exploración de columna',exact:true})
 if(!await explorer.isVisible())await statistics.locator('summary').filter({hasText:'Explorar una columna'}).click()
 await expect(explorer).toBeVisible()
 return explorer
}
export const analysisResultExport=(page:Page)=>workspace(page).locator('.result-export-options')
export async function openAnalysisExport(page:Page){
 const label=await translated(page,'analysis.tab.export'),menu=page.getByRole('menu',{name:label,exact:true})
 if(!await menu.isVisible())await workspace(page).locator('header').getByRole('button',{name:label,exact:true}).click()
 return menu
}
export async function analysisExportItem(page:Page,key:string,parameters:TranslationParameters={}){return(await openAnalysisExport(page)).getByRole('menuitem',{name:await translated(page,key,parameters),exact:true})}
export async function exportAnalysis(page:Page,key:string,parameters:TranslationParameters={}){await(await analysisExportItem(page,key,parameters)).click()}
export const chartPanel=(page:Page)=>workspace(page).locator('.charts-panel')
// Solo el botón real: manual, revisión cambiada o reintento de una cancelación.
export const chartGenerate=(page:Page)=>chartPanel(page).locator('.manual>button')
export async function openChartFields(page:Page){
 const panel=chartPanel(page),fields=panel.getByRole('complementary',{name:await translated(page,'charts.fields.panel'),exact:true,includeHidden:true})
 await expect(panel).toBeVisible();await expect(fields).toBeAttached()
 if(!await fields.isVisible())await panel.getByRole('button',{name:await translated(page,'charts.fields.panel'),exact:true}).click()
 await expect(fields).toBeVisible();return fields
}
export async function openChartSettings(page:Page){
 const fields=await openChartFields(page),settings=fields.locator('.chart-settings')
 if(await settings.getAttribute('open')===null)await settings.locator(':scope>summary').click()
 return settings
}
export async function openChartDetails(page:Page){
 const info=chartPanel(page).locator('.chart-info')
 if(await info.getAttribute('open')===null)await info.locator(':scope>summary').click()
 return info
}
export async function openChartData(page:Page){
 const info=await openChartDetails(page),table=info.locator('details').filter({has:page.locator(':scope>summary').filter({hasText:await translated(page,'charts.ui.table')})})
 if(await table.getAttribute('open')===null)await table.locator(':scope>summary').click()
 return table
}
export async function chartAssign(page:Page,field:string,zone:'rows'|'columns'|'values'|'filters'){
 const fields=await openChartFields(page),entry=fields.locator('.field-entry').filter({has:page.getByTitle(field,{exact:true})})
 await expect(fields.locator('.field-list')).toHaveAttribute('aria-busy','false')
 await entry.hover()
 await entry.getByRole('button',{name:await translated(page,'charts.fields.more',{field}),exact:true}).click()
 const zoneLabel=await translated(page,'charts.fields.'+zone),destinations=await Promise.all(['charts.fields.destination','charts.fields.moveDestination'].map(key=>translated(page,key,{zone:zoneLabel}))),recommended=await translated(page,'charts.fields.recommended')
 const escaped=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
 await page.getByRole('menuitem',{name:new RegExp('^(?:'+destinations.map(escaped).join('|')+')(?: '+escaped(recommended)+')?$')}).click()
}
export async function chartSource(page:Page){
 const id=(await page.locator('.tabs[role=tablist]').getByRole('tab',{selected:true}).getAttribute('id'))?.replace('workspace-tab-analysis:','')
 const doc=(await page.evaluate(()=>window.freya.documents())).find(doc=>doc.id===id)
 if(!doc?.headers)throw new Error('No hay una fuente CSV en la pestaña de análisis activa')
 return doc
}
export async function chartAssignColumn(page:Page,column:number,zone:'rows'|'columns'|'values'|'filters'){
 const {headers}=await chartSource(page),name=headers![column]||await translated(page,'charts.fields.emptyHeader',{n:column+1})
 await chartAssign(page,headers!.filter(value=>value===headers![column]).length>1?`${column+1}. ${name}`:name,zone)
}
export async function chartTypeButton(page:Page,kind:ChartKind){
 const name=await translated(page,kind==='box'?'charts.ui.boxButton':'charts.kind.'+kind),recommended=await translated(page,'charts.fields.recommended')
 const escaped=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
 return chartPanel(page).getByRole('group',{name:await translated(page,'charts.ui.chooseType'),exact:true}).getByRole('button',{name:new RegExp('^'+escaped(name)+'(?: ?'+escaped(recommended)+')?$')})
}
export async function chartType(page:Page,kind:ChartKind){
 await(await chartTypeButton(page,kind)).click()
}
export async function chartAggregate(page:Page,field:string){
 await openChartFields(page);return chartPanel(page).getByLabel(await translated(page,'charts.fields.aggregate',{field}),{exact:true})
}
export async function waitChartResult(page:Page){
 const message=await translated(page,'charts.fields.ready',{n:'__COUNT__'}),escaped=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
 await expect(chartPanel(page).locator('.chart-result>.result-announcement')).toHaveText(new RegExp('^'+message.split('__COUNT__').map(escaped).join('.*')+'$'))
}
// Compatibilidad: configuración persistida válida que la UI simplificada no construye hoy.
// El puente estricto guarda el preset real; Aplicar sigue siendo una acción de la interfaz.
export async function applyLegacyChartPreset(page:Page,doc:DocumentInfo,configuration:ChartConfiguration,name:string){
 const preset=await page.evaluate(({id,name,configuration})=>window.freya.saveChartPreset(id,{name,configuration}),{id:doc.id,name,configuration})
 const settings=await openChartSettings(page),library=settings.locator('.presets')
 if(await library.getAttribute('open')===null)await library.locator(':scope>summary').click()
 await library.getByRole('button',{name:await translated(page,'charts.presets.refresh'),exact:true}).click()
 await library.getByLabel(await translated(page,'charts.presets.choice'),{exact:true}).selectOption(preset.id)
 await library.getByRole('button',{name:await translated(page,'charts.presets.apply'),exact:true}).click()
 return preset
}
export const chartSuggestion=(page:Page)=>chartPanel(page).locator('.empty-result button')
export async function createSuggestedChart(page:Page){
 const panel=chartPanel(page)
 await expect(panel.locator('.pivot-result')).toHaveCount(0)
 // El texto del botón incluye la descripción generada, no una etiqueta fija.
 const suggestion=chartSuggestion(page)
 await expect(suggestion).toBeEnabled()
 await suggestion.click()
 return panel
}
export async function showPanel(page:Page,name:'Gráficos'|'Estadísticas'|'Análisis'){
 await openAnalysis(page,name)
 if(name==='Gráficos'){
  const panel=workspace(page).locator('.charts-panel')
  await expect(panel).toBeVisible()
  const title=panel.getByLabel(await translated(page,'charts.ui.config'),{exact:true})
  if(await title.innerText()===await translated(page,'charts.fields.emptyTitle'))await createSuggestedChart(page)
 }else if(name==='Estadísticas'){
  const advanced=workspace(page).locator('.advanced-statistics')
  if(await advanced.getAttribute('open')===null)await advanced.locator(':scope>summary').click()
 }
}
// Abre un menú de la barra de la tabla (Filtrar, Limpiar, Filas y columnas) y elige una de sus acciones.
export async function menuItem(page:Page,menu:'Filtrar'|'Limpiar'|'Filas y columnas',item:string){
 await page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true}).getByLabel(menu,{exact:true}).click()
 await page.getByRole('button',{name:item,exact:true}).click()
}
// Marca «Orden numérico» (está dentro del menú Filtrar) y cierra el menú.
export async function numericOrder(page:Page){
 const bar=page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true})
 await bar.getByLabel('Filtrar',{exact:true}).click()
 await page.getByLabel('Orden numérico',{exact:true}).check()
 await page.keyboard.press('Escape')
}
