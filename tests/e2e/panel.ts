import type {Page} from '@playwright/test'
// Los tres paneles de análisis viven en un solo panel lateral con pestañas; el botón «Analizar» de la barra lo abre y lo cierra.
const tabs={'Gráficos':'Gráficos','Estadísticas':'Resumen','Análisis':'SQL'} as const
export const analyzeButton=(page:Page)=>page.getByRole('toolbar',{name:'Herramientas de la tabla',exact:true}).getByRole('button',{name:'Analizar',exact:true})
// Deja el panel abierto en la pestaña indicada (lo abre solo si hace falta; no lo cierra nunca).
export async function showPanel(page:Page,name:keyof typeof tabs){
 const button=analyzeButton(page)
 if(await button.getAttribute('aria-expanded')!=='true')await button.click()
 const tab=page.getByRole('tablist',{name:'Herramientas de análisis'}).getByRole('tab',{name:tabs[name],exact:true})
 if(await tab.getAttribute('aria-selected')!=='true')await tab.click() // si ya está seleccionada no se pulsa: el foco se queda donde lo dejó el panel
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
