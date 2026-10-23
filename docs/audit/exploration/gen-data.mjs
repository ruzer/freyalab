// Genera los CSV sintéticos de la auditoría en ./data. Con --big crea además grande.csv (~57 MiB).
import { mkdirSync, writeFileSync, createWriteStream, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const D = join(dirname(fileURLToPath(import.meta.url)), 'data'); mkdirSync(D, { recursive: true })
let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296
const pick = a => a[Math.floor(rnd() * a.length)]
const ciudades = ['Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Mérida']
const prods = [['Cuaderno', 45], ['Mochila', 380], ['Lápiz', 8], ['Calculadora', 220], ['Tablet', 3200]]
const vend = ['Ana', 'Beto', 'Carla', 'Diego']
// ventas.csv: limpio; flujos A, C, D.
let rows = ['Fecha,Ciudad,Producto,Cantidad,Precio,Total,Vendedor']
for (let i = 0; i < 240; i++) {
  const d = new Date(Date.UTC(2026, Math.floor(rnd() * 9), 1 + Math.floor(rnd() * 27)))
  const [p, pr] = pick(prods); const q = 1 + Math.floor(rnd() * 9)
  rows.push([d.toISOString().slice(0, 10), pick(ciudades), p, q, pr, q * pr, pick(vend)].join(','))
}
writeFileSync(join(D, 'ventas.csv'), rows.join('\n') + '\n')
// sucio.csv: mayúsculas mezcladas, vacíos, duplicados y un importe con coma sin comillas (fila irregular a propósito); flujo B.
const sucio = ['Fecha,Ciudad,Cliente,Monto,Estado,Código']
const city = ['CDMX', 'cdmx', ' Cdmx ', 'Guadalajara', 'guadalajara ', 'MONTERREY', 'Monterrey', '']
for (let i = 0; i < 60; i++) {
  const amt = rnd() < .15 ? '' : rnd() < .2 ? `$${(1000 + Math.floor(rnd() * 5000)).toLocaleString('en-US')}.00` : String(100 + Math.floor(rnd() * 5000))
  const st = pick(['activo', 'Activo', 'ACTIVO ', 'inactivo', 'Inactivo', ''])
  sucio.push([`2026-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}`, pick(city), `Cliente ${1 + (i % 25)}`, amt, st, String(i).padStart(5, '0')].join(','))
}
sucio.push(sucio[3]); sucio.push(sucio[7])
writeFileSync(join(D, 'sucio.csv'), sucio.join('\n') + '\n')
// Variantes para la comprobación de ida y vuelta (BOM, CRLF, punto y coma, comillas, multilínea).
writeFileSync(join(D, 'crlf-bom.csv'), '﻿Nombre;Monto;Código\r\nAna;1,5;00012\r\n"Beto ""B""";2;00034\r\nCarla;;00056\r\n', 'utf8')
writeFileSync(join(D, 'multilinea.csv'), 'id,nota\n1,"línea 1\nlínea 2"\n2,simple\n3,"con, coma"\n', 'utf8')
if (process.argv.includes('--big')) {
  const out = createWriteStream(join(D, 'grande.csv')); let i = 0, size = 0; out.write('id,ciudad,monto,estado\n')
  const limit = 57 * 1024 * 1024
  const w = () => { let ok = true; while (ok && size < limit) { const l = i + ',Mérida,' + (i % 997) + ',ok\n'; size += Buffer.byteLength(l); i++; ok = out.write(l) } if (size < limit) out.once('drain', w); else out.end() }
  w()
}
console.log('datos en', D)
