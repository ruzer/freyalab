import {runApplicationMenu} from './application-menu'
import {expect,type Page,type ElectronApplication} from '@playwright/test'
import {t} from '../../src/shared/i18n'
import type {Language} from '../../src/shared/i18n'
const sections={'Información':'info','Gráficos':'charts','Estadísticas':'statistics','Análisis':'sql','SQL':'sql'} as const
const workspace=(page:Page)=>page.locator('.analysis-workspace:not([hidden])')
async function translated(page:Page,key:string){return t(key,{},(await page.locator('html').getAttribute('lang')??'es') as Language)}
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
  else await requestAnalysis(page)
 }
 return selectAnalysis(page,name)
}
export async function selectAnalysis(page:Page,name:keyof typeof sections){
 await expect(workspace(page)).toBeVisible()
 const button=workspace(page).getByRole('group',{name:await translated(page,'analysis.tab.sections'),exact:true}).getByRole('button',{name:await translated(page,'analysis.tab.section.'+sections[name]),exact:true})
 if(await button.getAttribute('aria-pressed')!=='true')await button.click()
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
export const analysisResultExport=(page:Page)=>workspace(page).locator('.header-export')
export const chartPanel=(page:Page)=>workspace(page).locator('.charts-panel')
// El botón manual cubre revisión nueva/archivo grande; en automático se usa el del formulario.
export const chartGenerate=(page:Page)=>chartPanel(page).locator('.manual>button,.more-options form button[type=submit]').first()
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
 }
}
// Abre un menú de la barra de la tabla (Filtrar, Limpiar datos, Filas y columnas) y elige una de sus acciones.
export async function menuItem(page:Page,menu:'Filtrar'|'Limpiar datos'|'Filas y columnas',item:string){
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
