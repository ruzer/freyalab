// M1: comparador nodejs-polars. El paquete vive en una carpeta externa (argumento 1); no es dependencia del repositorio.
import {createRequire} from 'node:module'
import {join} from 'node:path'
const [dir, task, source, output] = process.argv.slice(2)
const pl = createRequire(join(dir, 'package.json'))('nodejs-polars')
const PROJECT = ['venta_id', 'ciudad', 'producto', 'total_mxn']
// La suma se convierte a texto DENTRO del motor: nodejs-polars devuelve Int64 como `number` de JavaScript y por encima de 2^53 pierde
// precisión sin avisar (medido en M1: 900719925474099501 → 900719925474099500).
// inferSchemaLength: 0 = todo como texto. `inferSchema: false` (nombre de Python) se IGNORA en silencio en esta versión
// y las columnas numéricas pierden ceros a la izquierda; ver `probe_edges` / evidencia M1.
const lazy = pl.scanCSV(source, {inferSchemaLength: 0, hasHeader: true, quoteChar: '"', encoding: 'utf8'})
const where = pl.col('ciudad').eq(pl.lit('Oaxaca')).and(pl.col('estado').eq(pl.lit('entregado')))
const one = frame => Number(frame.select(pl.len().alias('n')).collectSync({streaming: true}).toRecords()[0].n)
let result
if (task === 'T1') result = {count: one(lazy)}
else if (task === 'T2') result = {count: one(lazy.filter(where))}
else if (task === 'T3') { lazy.filter(where).select(...PROJECT.map(name => pl.col(name))).sinkCSV(output, {lineTerminator: '\r\n'}).collectSync(); result = {} }
else if (task === 'T4') {
  const groups = lazy.groupBy('ciudad')
    .agg(pl.len().alias('count'), pl.col('total_mxn').str.replace('.', '', true).cast(pl.Int64).sum().cast(pl.String).alias('s'))
    .sort('ciudad').collectSync({streaming: true}).toRecords()
    .map(r => ({ciudad: r.ciudad, count: Number(r.count), sum_cents: r.s}))
  result = {count: groups.reduce((a, g) => a + g.count, 0), groups}
} else if (task === 'T5') { lazy.withColumns(pl.col('ciudad').str.replaceAll('Mérida', 'Merida', true)).sinkCSV(output, {lineTerminator: '\r\n'}).collectSync(); result = {} }
else if (task === 'T6') result = {count: one(lazy.filter(pl.anyHorizontal(pl.all().str.contains('Primera línea', true))))}
else throw new Error('Tarea desconocida.')
console.log(JSON.stringify(result))
