// Cuánta tabla se ve con cada panel abierto (y, en Gráficos, antes y después de generar).
import { launch, close, setSize, DATA } from './lib.mjs'
import { join } from 'node:path'
const a = await launch({ open: [join(DATA, 'ventas.csv')], size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const sel = n => page.getByRole('combobox', { name: n })
const tabla = () => page.evaluate(() => {
  const g = document.querySelector('[role=grid]'); const gr = g.getBoundingClientRect()
  const main = document.querySelector('main').getBoundingClientRect(), foot = document.querySelector('footer')?.getBoundingClientRect()
  const clip = Math.min(main.bottom, foot ? foot.top : innerHeight, innerHeight)
  const header = g.querySelector('[role=columnheader]')?.getBoundingClientRect().height ?? 0
  const rows = [...g.querySelectorAll('[role=gridcell][data-column="0"]')].filter(e => { const r = e.getBoundingClientRect(); return r.top >= gr.top + header - 1 && r.bottom <= clip + 1 }).length
  const px = Math.max(0, Math.round(clip - gr.top))
  return { vh: innerHeight, tablaTop: Math.round(gr.top), pxVisiblesDeTabla: px, filasVisibles: rows }
})
const tamanos = [[1920, 1080], [1440, 900], [1366, 768], [1280, 800], [1280, 720], [900, 600]]
for (const [w, h] of tamanos) {
  await setSize(a.app, [w, h]); await page.waitForTimeout(300)
  const fila = { ventana: `${w}x${h}`, sinPanel: await tabla() }
  await page.getByRole('button', { name: 'Gráficos', exact: true }).click(); await page.waitForTimeout(500)
  fila.graficosAbierto = await tabla()
  await sel('Columna X del gráfico').selectOption({ label: '2. Ciudad' }); await page.getByRole('button', { name: 'Generar gráfico' }).click(); await page.waitForTimeout(1800)
  fila.graficoGenerado = await tabla()
  await a.shot(`37-graficos-${w}x${h}`)
  await page.getByRole('button', { name: /Cerrar gráficos/ }).click(); await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Estadísticas', exact: true }).click(); await page.waitForTimeout(500)
  fila.estadisticasAbierto = await tabla()
  await page.getByRole('button', { name: 'Estadísticas', exact: true }).click(); await page.waitForTimeout(300)
  console.log(JSON.stringify(fila))
}
await close(a)
