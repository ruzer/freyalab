import { launch, close, DATA, SHOTS } from './lib.mjs'
import { join } from 'node:path'
const a = await launch({ open: [join(DATA, 'ventas.csv')], size: [1440, 900] }); const { page } = a
await page.waitForSelector('[role=grid] [role=gridcell]')
const log = (...x) => console.log(...x)
let clicks = 0; const c = s => { clicks++; log(`  [${clicks}] ${s}`) }
await page.getByRole('button', { name: 'Análisis', exact: true }).click(); c('Análisis')
const t0 = Date.now(); await page.getByRole('button', { name: 'Ejecutar consulta' }).click(); c('Ejecutar consulta (SELECT * FROM datos)')
await page.waitForFunction(() => /filas|resultado/i.test(document.body.innerText) && !/Ejecutando/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {}); await page.waitForTimeout(1500)
log('first SQL run ms:', Date.now() - t0)
log('result text:', (await page.locator('main').innerText()).split('\n').filter(l => /fila|Resultado|resultado|ms|Columna/.test(l)).slice(0, 6).join(' | '))
await page.getByRole('button', { name: /Asistentes/ }).click(); c('Asistentes: agrupar, pivotar y cruzar'); await page.waitForTimeout(700)
await a.shot('35a-assistants')
log('ASSISTANT controls:', await page.evaluate(() => { const els = [...document.querySelectorAll('main select, main input:not([type=checkbox]), main button, main textarea, main summary, main [role=tab]')].filter(e => e.offsetParent && !e.closest('[role=grid]')); return els.map(e => `${e.tagName.toLowerCase()}:${(e.getAttribute('aria-label') || e.innerText || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 45)}${e.tagName === 'SELECT' ? '=' + [...e.options].map(o => o.text).join('/').slice(0, 100) : ''}`).filter(x => !/Seleccionar|Editar enc|^button:(Fecha|Ciudad|Producto|Cantidad|Precio|Total|Vendedor)$/.test(x)).slice(0, 40).join('\n') }))
await close(a)
