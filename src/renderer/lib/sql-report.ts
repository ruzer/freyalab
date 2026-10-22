import type {SqlResult} from '../../shared/types'
import {literal,table} from './statistics-report'

export function sqlReport(result:SqlResult,sql:string){
 if(result.offset!==0||result.rows.length!==result.returnedRows||result.rows.some(row=>row.length!==result.columns.length))throw new Error('Faltan filas del resultado. Vuelve a preparar el informe.')
 const fence='`'.repeat((sql.match(/`+/g)??[]).reduce((n,run)=>Math.max(n,run.length+1),3))
 return '# Informe de resultado SQL\n\n'+
  (result.limited?'> **RESULTADO PARCIAL:** solo se conservaron las primeras 10 000 filas de la consulta; este informe incluye todas las filas conservadas. Reduce la consulta para obtener un resultado completo.\n\n':'')+
  'Instantánea del análisis completado. Abrir, editar o exportar este informe no recalcula la consulta ni modifica las fuentes CSV. El alcance de cada fuente se indica abajo; el análisis no cambia el archivo original.\n\n'+
  table([['Análisis','Valor'],['---','---'],['Finalizado (UTC)',literal(result.completedAt)],['DuckDB',literal(result.version)],['Filas conservadas',String(result.returnedRows)]])+
  '## Fuentes\n\n'+table([['Tabla SQL','Archivo','Filas analizadas','Revisión','Origen'],['---','---','---','---','---'],...result.sources.map(source=>[literal(source.table),literal(source.name),String(source.rows),String(source.revision),source.fromDisk?'Archivo completo desde disco; el editor solo muestra una muestra':source.filtered?'Vista filtrada del documento en memoria; incluye cambios pendientes':'Documento en memoria; incluye cambios pendientes'])])+
  '## Consulta ejecutada\n\n'+fence+'sql\n'+sql+'\n'+fence+'\n\n'+
  '## Columnas del resultado\n\n'+table([['Posición','Nombre','Tipo DuckDB'],['---','---','---'],...result.columns.map((column,index)=>[String(index+1),literal(column.name),literal(column.type)])])+
  '## Resultado\n\n'+(result.rows.length?table([result.columns.map(column=>literal(column.name)),result.columns.map(()=>'---'),...result.rows.map(row=>row.map(value=>value===null?'`NULL`':literal(value)))]):'Sin filas de resultado.\n\n')+
  '## Interpretación\n\nNULL sin comillas indica un valor nulo SQL. Los demás valores se conservan como texto entre comillas con escapes JSON: "" es una cadena vacía, y "NULL" es texto. Los escapes distinguen saltos de línea y controles; las cifras conservan la representación entregada por DuckDB, sin convertir identificadores largos a números de JavaScript. El tipo original de cada columna figura arriba.\n'
}
