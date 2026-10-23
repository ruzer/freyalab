import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
const a = await launch({ open: [join(DATA, 'ventas.csv')], size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
let clicks = 0; const c = s => { clicks++; log(`  [${clicks}] ${s}`) }
const sel = n => page.getByRole('combobox', { name: n })
const controls = () => page.evaluate(() => [...document.querySelectorAll('select')].filter(e => e.offsetParent && /gráfico|Gráfico/.test(e.getAttribute('aria-label') || '')).map(e => `${e.getAttribute('aria-label')} = ${e.options[e.selectedIndex]?.text} [${[...e.options].map(o => o.text).join(' / ').slice(0, 160)}]`))
await page.getByRole('button', { name: 'Gráficos' }).click(); c('open Gráficos')
await sel('Columna X del gráfico').selectOption({ label: '2. Ciudad' }); c('choose X = Ciudad')
await page.getByRole('button', { name: 'Generar gráfico' }).click(); c('Generar (default count)'); await page.waitForTimeout(2500)
await a.shot('13a-count-by-city')
log('result text:', (await page.locator('main').innerText()).split('\n').filter(l => /Conteo|Eje|Resultado|gráfico|Mostrando|filas/.test(l)).slice(0, 12).join(' | '))
await sel('Tipo de medida del gráfico').selectOption({ index: 1 }); c('measure type = Número para calcular')
log('controls after measure=Número:', (await controls()).join('\n   '))
await a.shot('13b-measure-number')
await sel('Resumen del gráfico').selectOption({ label: 'Suma' }); c('Cálculo = Suma')
log('controls after Suma:', (await controls()).filter(x=>/medida|Resumen|Columna/.test(x)).join('\n   '))
const allSel = await page.evaluate(() => [...document.querySelectorAll('select')].filter(e => e.offsetParent).map(e => e.getAttribute('aria-label')))
log('all visible selects:', allSel.join(' ; '))
await a.shot('13c-suma-controls')
await close(a)
