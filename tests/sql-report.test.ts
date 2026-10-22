import {describe,it,expect} from 'vitest'
import {sqlReport} from '../src/renderer/lib/sql-report'
import {markdownHTML} from '../src/renderer/lib/render'
import type {SqlResult} from '../src/shared/types'
const result:SqlResult={requestId:'analysis',sources:[{id:'source',name:'datos.csv',revision:7,table:'datos',columns:[],rows:42,fromDisk:false}],version:'v1.5.4',columns:[{name:'ID',type:'VARCHAR'},{name:'Texto',type:'VARCHAR'}],rows:[['00123','9007199254740993'],[null,''],['NULL','á\r\n😀']],returnedRows:3,limited:false,offset:0,completedAt:'2026-10-22T00:00:00.000Z'}
describe('informes de resultados SQL',()=>{
 it('conserva filas, orden, tipos, nulos distintos del texto y procedencia sin mutar el resultado',()=>{
  const before=structuredClone(result),text=sqlReport(result,'SELECT * FROM datos;')
  expect(text).toContain('Revisión');expect(text).toContain('| 42 | 7 | Documento en memoria');expect(text).toContain('v1.5.4');expect(text).toContain('SELECT * FROM datos;');expect(text).toContain('"00123"');expect(text).toContain('"9007199254740993"');expect(text).toContain('| `NULL` | ` "" ` |');expect(text).toContain('"NULL"');expect(text).toContain('á\\r\\n😀');expect(text).not.toContain('RESULTADO PARCIAL');expect(result).toEqual(before)
 })
 it('rechaza una página aislada, filas incompletas y estructura desigual',()=>{
  for(const data of [{...result,offset:100},{...result,rows:result.rows.slice(1)},{...result,rows:[['a'],...result.rows.slice(1)]}])expect(()=>sqlReport(data,'SELECT 1')).toThrow('Faltan filas')
 })
 it('rotula resultados limitados y fuentes completas desde disco; el resultado vacío sigue documentado',()=>{
  const text=sqlReport({...result,limited:true,sources:[{...result.sources[0],fromDisk:true}]},'SELECT * FROM datos')
  expect(text).toContain('RESULTADO PARCIAL');expect(text).toContain('primeras 10 000');expect(text).toContain('Archivo completo desde disco; el editor solo muestra una muestra');expect(text).not.toContain('MUESTRA LIMITADA')
  expect(sqlReport({...result,rows:[],returnedRows:0},'SELECT * FROM datos WHERE false')).toContain('Sin filas de resultado.')
 })
 it('preserva encabezados duplicados y textos hostiles sin generar HTML, enlaces, fórmulas ni columnas falsas',async()=>{
  const hostile='<img src="https://evil.test/x"> | $x$ [clic](https://evil.test/) ```\r\n\u0000',data={...result,columns:[{name:hostile,type:'VARCHAR'},{name:hostile,type:'VARCHAR'}],rows:[[hostile,null]],returnedRows:1},sql="SELECT '```\\n<img src=evil>\\n`````' AS x;"
  const text=sqlReport(data,sql),{html}=await markdownHTML(text)
  expect(text).toContain('``````sql');expect(html).not.toMatch(/<(img|a|script|iframe|svg)\b/);expect(html).not.toContain('class="katex');expect(html).toContain('&#x3C;img');expect(html).toContain('\\r\\n\\u0000');expect(html.match(/<thead>/g)).toHaveLength(4);expect(html.match(/<th>/g)).toHaveLength(12)
 })
})
