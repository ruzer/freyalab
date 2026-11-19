import {afterEach,expect,it} from 'vitest'
import {describeTable,type DescribeEntry} from '../src/renderer/lib/describe-table'
import {describeReport,type ReportContext} from '../src/renderer/lib/statistics-report'
import {markdownHTML} from '../src/renderer/lib/render'
import {setLanguage,t,type Language} from '../src/shared/i18n'

const columns:DescribeEntry[]=[
 {index:0,name:'Precio',profile:{kind:'number'},stats:{numeric:5,average:30,sampleDeviation:15.811388300841896,min:10,percentile25:20,median:30,percentile75:40,max:50}},
 {index:1,name:'Cantidad',profile:{kind:'number'},stats:{numeric:4,average:2.5,sampleDeviation:1.2909944487358056,min:1,percentile25:1.75,median:2.5,percentile75:3.25,max:4}},
 {index:2,name:'Producto',profile:{kind:'category'},description:{count:6,unique:3,top:'00123',freq:4,dateMin:null,dateMax:null}}
]
const context:ReportContext={source:'encuesta.csv',revision:7,sample:false,dirty:false,scope:'Documento completo',analyzedAt:'2026-11-18T00:00:00Z'}
afterEach(()=>setLanguage('es'))

for(const [language,labels]of [
 ['es',['Número de valores','Valores distintos','Más frecuente','Veces del más frecuente','Media','Desviación estándar','Mínimo','Percentil 25','Mediana','Percentil 75','Máximo']],
 ['en',['Count','Distinct values','Most frequent','Frequency of most frequent','Mean','Standard deviation','Minimum','25th percentile','Median','75th percentile','Maximum']]
] as [Language,string[]][])it(`SIM-2e: el informe localiza las once filas y conserva nombre pandas y precisión (${language})`,async()=>{
 setLanguage(language)
 const before=structuredClone(columns),matrix=describeTable(columns,true),report=describeReport(context,columns,true)
 for(const [index,row]of matrix.rows.entries())expect(report).toContain(`| ${labels[index]} (${row.metric}) |`)
 expect(report).toContain('| 15.811388300841896 | 1.2909944487358056 |')
 expect(report).toContain('` "00123" `')
 const {html}=await markdownHTML(report)
 expect(html).toContain(`${labels[5]} (std)`)
 expect(html).toContain('15.811388300841896')
 expect(columns).toEqual(before)
})

it('SIM-2e: en-XA genera etiquetas de las once filas sin traducir datos ni identificadores pandas',()=>{
 setLanguage('en-XA')
 const matrix=describeTable(columns,true),report=describeReport(context,columns,true)
 for(const row of matrix.rows){
  const label=t('describe.metric.'+row.metric)
  expect(label).toMatch(/^\[.+\]$/)
  expect(report).toContain(`${label} (${row.metric})`)
 }
 expect(report).toContain('encuesta.csv');expect(report).toContain('15.811388300841896');expect(report).toContain('00123')
})
