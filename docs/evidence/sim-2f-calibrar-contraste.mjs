import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const samples=JSON.parse(readFileSync(process.argv[2],'utf8'))
// Paleta oscura actual de style.css, distinta a la clara: se calibra la medición, no se cambia el color.
const dark=samples.find(sample=>sample.theme==='dark')
assert.equal(dark.ink,'rgb(11, 18, 32)','La muestra oscura debe contener los colores oscuros reales')
assert.equal(dark.background,'rgb(48, 139, 255)')
console.log('Calibración correcta: la muestra oscura coincide con la paleta oscura real.')
