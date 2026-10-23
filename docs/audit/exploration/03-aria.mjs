import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
const a = await launch({ open: [join(DATA, 'ventas.csv')] })
const { page } = a
await page.waitForSelector('[role=grid]')
const snap = await page.locator('body').ariaSnapshot()
console.log(snap.split('\n').filter(l => !/Seleccionar fila|gridcell|row "|rowheader/.test(l)).slice(0, 90).join('\n'))
// unnamed interactive elements
const un = await page.evaluate(() => [...document.querySelectorAll('button,input,select')].filter(e => e.offsetParent !== null && !(e.getAttribute('aria-label') || e.innerText.trim() || e.title || (e.labels && e.labels.length) || e.getAttribute('aria-labelledby'))).map(e => e.outerHTML.slice(0, 160)))
console.log('UNNAMED', un.length); un.forEach(x => console.log(x))
await close(a)
