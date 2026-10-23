import { launch, close, DATA } from './lib.mjs'
import { join } from 'node:path'
const a = await launch({ open: [join(DATA, 'ventas.csv')], theme: 'light' })
const { page } = a
await page.waitForSelector('[role=grid], table, .csv-table', { timeout: 15000 }).catch(() => console.log('no grid selector'))
await page.waitForTimeout(1000)
await a.shot('02-csv-open-light-1440x900')
const dump = await page.evaluate(() => [...document.querySelectorAll('button,input,select,summary,[role=button],[role=tab],[role=menuitem]')].filter(e => e.offsetParent !== null).map(e => `${e.tagName.toLowerCase()}${e.getAttribute('role') ? '[' + e.getAttribute('role') + ']' : ''}|${(e.getAttribute('aria-label') || e.innerText || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 50)}|title=${e.title || ''}`))
console.log(dump.join('\n'))
console.log('GRID roles', await page.evaluate(() => [...new Set([...document.querySelectorAll('[role]')].map(e => e.getAttribute('role')))].join(',')))
console.log('errors', a.errors)
await close(a)
