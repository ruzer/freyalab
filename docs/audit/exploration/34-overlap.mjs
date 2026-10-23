// Solape entre botones con nombre en la ventana mínima (900×600), sin panel y con cada panel abierto.
import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
const a = await launch({ open: [join(DATA, 'ventas.csv')], size: [900, 600] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const NAMES = ['Filtros', 'Reemplazar', 'Consulta avanzada', 'Análisis', 'Estadísticas', 'Gráficos', 'Comandos', '+ Fila', '+ Columna']
const overlaps = () => page.evaluate(names => {
  const btns = names.map(n => ({ n, e: [...document.querySelectorAll('main button')].find(b => b.offsetParent && b.innerText.trim().replace(/^☷\s*/, '') === n) })).filter(x => x.e)
  const out = []
  for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
    const A = btns[i].e.getBoundingClientRect(), B = btns[j].e.getBoundingClientRect()
    const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left), oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top)
    if (ox > 2 && oy > 2) out.push(`${btns[i].n} × ${btns[j].n} (${Math.round(ox)}×${Math.round(oy)} px)`)
  }
  const grid = document.querySelector('[role=grid]').getBoundingClientRect()
  return { solapes: out, altoVisibleDeLaTabla: Math.max(0, Math.round(Math.min(grid.bottom, innerHeight - 30) - Math.max(grid.top, 0))) }
}, NAMES)
console.log('sin panel:', JSON.stringify(await overlaps()))
for (const name of ['Estadísticas', 'Análisis', 'Gráficos']) {
  await page.getByRole('button', { name, exact: true }).click(); await page.waitForTimeout(600)
  console.log(`${name}:`, JSON.stringify(await overlaps()))
  await a.shot(`34-${name}-900x600`)
  await page.getByRole('button', { name: /^Cerrar|^×$/ }).last().click().catch(() => {}); await page.waitForTimeout(300)
  await page.reload(); await page.waitForSelector('[role=grid] [role=gridcell]')
}
await close(a)
