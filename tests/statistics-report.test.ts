import {describe,it,expect} from 'vitest'
import {statisticsReport,columnReport,STATISTICS_FIELDS,PROFILE_FIELDS,NUMERIC_DETAIL_FIELDS,type ReportContext,type ColumnReportContext,type StatisticsRow} from '../src/renderer/lib/statistics-report'
import {markdownHTML} from '../src/renderer/lib/render'
import type {ColumnAnalysis} from '../src/shared/types'
const context:ReportContext={source:'datos.csv',revision:7,sample:false,dirty:true,scope:'Todas las columnas',analyzedAt:'2026-10-22T00:00:00.000Z'}
const row:StatisticsRow={index:2,name:'Importe',revision:7,sample:false,cells:4,empty:1,unique:4,numeric:3,sum:7,average:7/3,min:1,max:4,median:2,deviation:1.247219128924647,sampleDeviation:1.5275252316519465,variance:14/9,sampleVariance:7/3,percentile10:1.2,percentile25:1.5,percentile75:3,percentile90:3.6,missing:1,whitespace:0,excluded:0}
const column:ColumnAnalysis={...row,profile:{kind:'number',dates:0,invalidDates:0,unsafeIntegers:0,identifierZeros:0,headerHint:false,distinctNonEmpty:3},column:2,filtered:false,leadingZeros:0,duplicateGroups:1,duplicateRows:2,extraDuplicates:1,minLength:0,maxLength:8,frequencies:[{value:'00123',truncated:false,count:2,firstRow:3,rowId:'3'}],frequencyTotal:1,frequencyOffset:0,missingRows:[{row:4,rowId:'4'}],histogram:[{lower:1,upper:2,count:1},{lower:2,upper:4,count:2}],correlation:{column:3,pairs:3,omitted:1,value:1},warnings:[]}
const columnContext:ColumnReportContext={...context,columnName:'Importe',otherColumnName:'Comparación',duplicatesOnly:false}
describe('informes estáticos de estadísticas',()=>{
 it('incluye siempre varianzas y percentiles exactos en informes generales y del perfil',()=>{
  for(const text of [statisticsReport(context,[row]),columnReport(columnContext,column,'profile')]){
   for(const [key,label] of NUMERIC_DETAIL_FIELDS)expect(text).toContain(`| ${label} | ${row[key]} |`)
   expect(text).toContain('| Varianza poblacional (n) | 1.5555555555555556 |')
   expect(text).toContain('| Varianza muestral (n−1) | 2.3333333333333335 |')
   expect(text).toContain('| P10 (percentil 10) | 1.2 |');expect(text).toContain('| P25 (percentil 25) | 1.5 |')
   expect(text).toContain('| P75 (percentil 75) | 3 |');expect(text).toContain('| P90 (percentil 90) | 3.6 |')
   expect(text).toContain('interpolación lineal (tipo 7), posición (n−1)×p con índices desde 0')
   expect(text).toContain('P50 coincide con la mediana');expect(text).toContain('unidades al cuadrado')
   expect(text).toContain('necesita al menos dos números');expect(text).toContain('Vacíos, textos y enteros fuera del rango seguro no participan')
   expect(text).toContain('No modifica el CSV')
  }
 })
 it('conserva resultados no disponibles y límites de muestra sin inventar ceros',()=>{
  const unavailable={variance:null,sampleVariance:null,percentile10:null,percentile25:null,percentile75:null,percentile90:null}
  const before=JSON.stringify({row,column})
  for(const text of [statisticsReport({...context,sample:true},[{...row,...unavailable}]),columnReport({...columnContext,sample:true},{...column,...unavailable},'profile')]){
   for(const [,label] of NUMERIC_DETAIL_FIELDS)expect(text).toContain(`| ${label} | — |`)
   expect(text).toContain('MUESTRA LIMITADA');expect(text).toContain('no describen el archivo completo')
   expect(text).not.toContain('undefined');expect(text).not.toContain('NaN')
  }
  expect(JSON.stringify({row,column})).toBe(before)
 })
 it('distingue varianza poblacional cero de varianza muestral no disponible con un número',()=>{
  const single={...row,cells:1,empty:0,missing:0,numeric:1,variance:0,sampleVariance:null,percentile10:5,percentile25:5,percentile75:5,percentile90:5}
  const text=statisticsReport(context,[single])
  expect(text).toContain('| Varianza poblacional (n) | 0 |');expect(text).toContain('| Varianza muestral (n−1) | — |')
  for(const [key,label] of NUMERIC_DETAIL_FIELDS.filter(([key])=>key.startsWith('percentile')))expect(text).toContain(`| ${label} | ${single[key]} |`)
 })
 it('escapa nombres hostiles también en los informes con las nuevas medidas',async()=>{
  const hostile='00123 | <script>x</script> ![foto](https://evil.test/x) [clic](https://evil.test/) $x^2$ \n# falso'
  for(const text of [statisticsReport({...context,source:hostile},[{...row,name:hostile}]),columnReport({...columnContext,columnName:hostile},column,'profile')]){
   const {html}=await markdownHTML(text)
   expect(html).not.toMatch(/<(a|img|script|iframe|svg)\b/);expect(html).not.toContain('class="katex')
   expect(html).toContain('00123');expect(html).toContain('&#x3C;script')
   const tables=html.match(/<thead>[\s\S]*?<\/thead>/g)!
   expect(tables.every(head=>(head.match(/<th>/g)??[]).length===2)).toBe(true)
   for(const [,label] of NUMERIC_DETAIL_FIELDS)expect(text).toContain(`| ${label} |`)
  }
 })
 it('comparte métricas con la interfaz y conserva precisión, revisión y alcance sin recalcular',()=>{
  const text=statisticsReport(context,[row,{...row,index:-1,name:'Celdas del rango'}]);for(const [key,label] of STATISTICS_FIELDS)expect(text).toContain(`| ${label} | ${row[key]} |`)
  expect(text).toContain('Revisión de la sesión | 7');expect(text).toContain('Cambios sin guardar al iniciar | Sí');expect(text).toContain('## Columna 3');expect(text).toContain('## Celdas del rango');expect(text).not.toContain('MUESTRA LIMITADA');expect(text).toContain(String(7/3))
 })
 it('preserva textos hostiles literalmente sin enlaces, imágenes, fórmulas, HTML ni columnas extra',async()=>{
  const hostile='00123 | \\ &amp; &#10; <img src="https://evil.test/x"> $x^2$ [clic](https://evil.test/) ![a](x) `cod` `````` a\\|b\r\n\t\u0000'
  const text=columnReport({...columnContext,source:hostile,columnName:hostile},{...column,frequencies:[{value:hostile,truncated:false,count:1,firstRow:1,rowId:'1'}],warnings:[hostile]},'frequencies'),{html}=await markdownHTML(text)
  expect(html).not.toMatch(/<(a|img|script|iframe|svg)\b/);expect(html).not.toContain('class="katex');expect(html).toContain('00123 |');expect(html).toContain('&#x26;amp;');expect(html).toContain('&#x3C;img');expect(html).toContain('\\r\\n\\t\\u0000');expect(html.match(/<thead>/g)).toHaveLength(2);expect(html.match(/<th>/g)).toHaveLength(7)
 })
 it('guarda solo la consulta semántica, con una cerca segura ante cadenas de backticks',async()=>{
  const text=statisticsReport({...context,query:{offset:123,limit:50,requestId:19,search:'```\n<script>x</script>\n`````',order:[{column:1,descending:true,numeric:false}]}},[row]),{html}=await markdownHTML(text)
  expect(text).toContain('``````json');expect(text).not.toContain('"offset"');expect(text).not.toContain('"requestId"');expect(text).toContain('"column": 1');expect(html).not.toContain('<script>');expect(html.match(/<pre>/g)).toHaveLength(1)
 })
 it('marca muestras, frecuencias parciales y valores abreviados sin inventar una lista global',()=>{
  const text=columnReport({...columnContext,sample:true,scope:'Vista filtrada de la muestra',duplicatesOnly:true},{...column,sample:true,frequencyOffset:50,frequencyTotal:60,frequencies:[{value:'x'.repeat(256),count:1,firstRow:77,rowId:'77',truncated:true}]},'frequencies')
  expect(text).toContain('MUESTRA LIMITADA');expect(text).toContain('VISTA PARCIAL');expect(text).toContain('51–51 de 60');expect(text).toContain('solo repetidos');expect(text).toContain('Sí, primeros 256 caracteres | 256');expect(text).not.toContain('Lista completa')
  expect(columnReport(columnContext,column,'frequencies')).toContain('Lista completa de valores distintos del alcance analizado')
 })
 it('conserva todas las medidas del perfil y limita ejemplos de filas faltantes',()=>{
  const text=columnReport(columnContext,{...column,sum:null},'profile');for(const [,label] of PROFILE_FIELDS)expect(text).toContain(`| ${label} |`);expect(text).toContain('| Suma | — |');expect(text).toContain('máximo 20; sin encabezado, lista de ejemplos): 4');expect(text).toContain('n−1');expect(text).toContain('Tipo probable: **Numérico**');expect(text).toContain('| Campos ausentes | 1 |');expect(text).toContain('| Campos vacíos exactos | 0 |');expect(text).toContain('Los 3 valores con contenido')
 })
 it('documenta intervalos, empates y una correlación indefinida sin inventar un coeficiente',()=>{
  expect(columnReport(columnContext,column,'distribution')).toContain('| 2 | 4 | Sí | 2 |');const text=columnReport(columnContext,{...column,correlation:{column:3,pairs:1,omitted:3,value:null}},'correlation');expect(text).toContain('| Pearson | — |');expect(text).toContain('columna 4');expect(text).toContain('no demuestra causalidad');expect(()=>columnReport(columnContext,{...column,correlation:undefined},'correlation')).toThrow('comparación')
 })
})
