import {describe,it,expect} from 'vitest'
import {columnOverviewReport,type ReportContext} from '../src/renderer/lib/statistics-report'
import {markdownHTML} from '../src/renderer/lib/render'
import type {ColumnOverviewResult,ColumnOverviewRow,ColumnProfile} from '../src/shared/types'

const context:ReportContext={source:'ventas.csv',revision:12,sample:false,dirty:true,scope:'Documento completo · Todas las columnas',analyzedAt:'2026-10-23T00:00:00.000Z'}
const result:ColumnOverviewResult={revision:12,sample:false,filtered:false,cells:20,empty:7,missing:2,whitespace:3,numeric:13,unique:9,extraDuplicates:4,profile:{kind:'number',dates:0,invalidDates:0,unsafeIntegers:0,identifierZeros:0,headerHint:false,distinctNonEmpty:9}}
const row=(column:number,name:string,value:ColumnOverviewResult=result):ColumnOverviewRow=>({column,name,result:value})

describe('informe de vista general de columnas',()=>{
 it('incluye más de una página y los siete perfiles sin truncar columnas',async()=>{
  const profiles:[ColumnProfile['kind'],string][]=[['empty','Sin datos'],['identifier','Posible identificador'],['number','Numérico'],['date','Fecha ISO'],['category','Categórico'],['text','Texto'],['mixed','Mixto o con valores incompatibles']]
  const rows=Array.from({length:51},(_,column)=>row(column,`Campo ${column+1}`,{...result,profile:{...result.profile,kind:profiles[column%profiles.length][0]}}))
  const text=columnOverviewReport(context,rows),{html}=await markdownHTML(text)
  expect(text).toContain('Columnas solicitadas: 51. Analizadas: 51. No disponibles: 0.')
  expect(text).toContain('independientemente de la búsqueda de nombres o página mostrada')
  for(const [,label] of profiles)expect(text).toContain(`| ${label} |`)
  const body=html.match(/<tbody>[\s\S]*?<\/tbody>/g)![1]
  expect(body.match(/<tr>/g)).toHaveLength(51)
  expect(text).toContain('51. Campo 51')
  expect(text).not.toContain('COBERTURA PARCIAL')
 })

 it('distingue encabezados duplicados y vacíos mediante su posición original',()=>{
  const text=columnOverviewReport(context,[row(0,'Ciudad'),row(1,'Ciudad'),row(3,'')])
  expect(text).toContain('"1. Ciudad"');expect(text).toContain('"2. Ciudad"');expect(text).toContain('"4. Columna 4"')
  expect(text).not.toContain('"3. Columna')
 })

 it('separa campos ausentes, vacíos exactos y espacios sin alterar el total',()=>{
  const text=columnOverviewReport(context,[row(0,'Importe')])
  expect(text).toContain('| Filas | Con contenido | Ausentes | Vacíos exactos | Solo espacios | Distintos exactos | Repeticiones adicionales |')
  expect(text).toContain('| Numérico | 20 | 13 | 2 | 2 | 3 | 9 | 4 |')
  expect(text).toContain('Los 13 valores con contenido son números utilizables')
 })

 it('declara cobertura parcial y conserva errores sin inventar recuentos cero',()=>{
  const text=columnOverviewReport(context,[row(0,'Correcta'),{column:1,name:'Fallida',error:'Se agotó el tiempo de análisis.'}])
  expect(text).toContain('Columnas solicitadas: 2. Analizadas: 1. No disponibles: 1.')
  expect(text).toContain('**COBERTURA PARCIAL:**')
  const failed=text.split('\n').find(line=>line.includes('"2. Fallida"'))!
  expect(failed).toContain('| No disponible | — | — | — | — | — | — | — |')
  expect(failed).toContain('Se agotó el tiempo de análisis.')
  expect(failed).not.toContain('| 0 |')
  const allFailed=columnOverviewReport(context,[{column:2,name:'Tercera',error:'Cancelado'}])
  expect(allFailed).toContain('Columnas solicitadas: 1. Analizadas: 0. No disponibles: 1.')
 })

 it('identifica muestra, filtros, revisión y cambios pendientes de la captura',()=>{
  const text=columnOverviewReport({...context,sample:true,scope:'Vista filtrada de la muestra · Columnas marcadas al iniciar',query:{offset:50,limit:25,requestId:7,search:'Oaxaca',conditions:[{column:2,op:'equals',value:'Pagado'}],filterMode:'all',order:[{column:0,numeric:false,descending:true}]}},[row(2,'Estado',{...result,sample:true,filtered:true})])
  expect(text).toContain('**MUESTRA LIMITADA:** los resultados no describen el archivo completo.')
  expect(text).toContain('| Archivo | ` "ventas.csv" ` |')
  expect(text).toContain('| Revisión de la sesión | 12 |')
  expect(text).toContain('Vista filtrada de la muestra · Columnas marcadas al iniciar')
  expect(text).toContain('| Cambios sin guardar al iniciar | Sí |')
  expect(text).toContain(context.analyzedAt)
  expect(text).toContain('"search": "Oaxaca"');expect(text).toContain('"value": "Pagado"');expect(text).toContain('"descending": true')
  for(const key of ['offset','limit','requestId'])expect(text).not.toContain(`"${key}"`)
  expect(text).toContain('Informe estático del análisis completado. No modifica el CSV')
 })

 it('mantiene encabezados y errores hostiles como texto sin HTML, enlaces ni columnas nuevas',async()=>{
  const hostile='00123 | \\ &amp; &#10; <img src="https://evil.test/x"> <script>alert(1)</script> $x^2$ [clic](https://evil.test/) ![a](x) `cod` `````` a\\|b\r\n\t\u0000'
  const text=columnOverviewReport({...context,source:hostile},[{column:0,name:hostile,error:hostile}]),{html}=await markdownHTML(text)
  expect(html).not.toMatch(/<(a|img|script|iframe|svg)\b/)
  expect(html).not.toContain('class="katex')
  expect(html).toContain('00123 |');expect(html).toContain('&#x26;amp;');expect(html).toContain('&#x3C;img');expect(html).toContain('\\r\\n\\t\\u0000')
  expect(html.match(/<thead>/g)).toHaveLength(2)
  expect(html.match(/<th>/g)).toHaveLength(12)
  const body=html.match(/<tbody>[\s\S]*?<\/tbody>/g)![1]
  expect(body.match(/<tr>/g)).toHaveLength(1)
  expect(body.match(/<td>/g)).toHaveLength(10)
 })

 it('no muta perfiles ni convierte nombres con ceros iniciales o identificadores largos',()=>{
  const identifier:ColumnOverviewResult={...result,numeric:0,profile:{...result.profile,kind:'identifier',identifierZeros:3,unsafeIntegers:2,headerHint:true}}
  const rows=[row(0,'00123',identifier),row(1,'123456789012345678901234567890',identifier)]
  const before=JSON.stringify({context,rows})
  Object.freeze(identifier.profile);Object.freeze(identifier);for(const item of rows)Object.freeze(item);Object.freeze(rows)
  const text=columnOverviewReport(context,rows)
  expect(JSON.stringify({context,rows})).toBe(before)
  expect(text).toContain('"1. 00123"');expect(text).toContain('"2. 123456789012345678901234567890"')
  expect(text).toContain('3 valores numéricos tienen ceros iniciales');expect(text).toContain('2 enteros exceden el rango numérico seguro')
  expect(text).toContain('No se propone como medida automáticamente')
 })
})
