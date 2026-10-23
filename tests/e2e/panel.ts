import type {Page} from '@playwright/test'
// El panel de análisis recuerda si estaba abierto: al abrir otro documento o reiniciar sigue abierto, y pulsar el botón de su pestaña activa lo cerraría.
// Esta función lo abre (o cambia a su pestaña) solo si hace falta; las pruebas que cierran el panel siguen usando el botón directamente.
export async function showPanel(page:Page,name:'Gráficos'|'Estadísticas'|'Análisis'){
 const button=page.getByRole('button',{name,exact:true})
 if(await button.getAttribute('aria-expanded')!=='true')await button.click()
}
