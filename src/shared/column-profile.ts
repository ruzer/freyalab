import type {ColumnAnalysis} from './types'
const labels={empty:'Sin datos',identifier:'Posible identificador',number:'Numérico',date:'Fecha ISO',category:'Categórico',text:'Texto',mixed:'Mixto o con valores incompatibles'} as const
export function columnSummary(result:Pick<ColumnAnalysis,'profile'|'cells'|'empty'|'missing'|'whitespace'|'numeric'>){
 const p=result.profile,nonEmpty=result.cells-result.empty
 let reason='Los valores se conservan como texto; no se reconoce un tipo uniforme más específico.'
 if(p.kind==='empty')reason='No hay valores con contenido en las filas analizadas.'
 if(p.kind==='identifier'){
  const signals=[p.headerHint?'el nombre de la columna sugiere un identificador':'',p.identifierZeros?`${p.identifierZeros} valores numéricos tienen ceros iniciales`:'',p.unsafeIntegers?`${p.unsafeIntegers} enteros exceden el rango numérico seguro`:''].filter(Boolean)
  reason='Conviene tratar esta columna como identificador: '+signals.join('; ')+'. No se propone como medida automáticamente.'
 }
 if(p.kind==='number')reason=`Los ${nonEmpty} valores con contenido son números utilizables. Esto no confirma que deban sumarse ni cambia su formato.`
 if(p.kind==='date')reason=`Los ${p.dates} valores con contenido son fechas válidas AAAA-MM-DD, sin hora ni zona horaria.`
 if(p.kind==='category')reason=`Hay ${p.distinctNonEmpty} textos distintos en ${nonEmpty} valores con contenido. Se sugieren grupos porque hay repeticiones y hasta 20 valores distintos; repetir una categoría no es un error.`
 if(p.kind==='mixed')reason=`Se observaron ${result.numeric} números utilizables, ${p.dates} fechas ISO y ${nonEmpty-result.numeric-p.dates} valores de otros formatos.`
 if(p.invalidDates)reason+=` ${p.invalidDates} valores tienen forma AAAA-MM-DD pero no son fechas válidas entre los años 0001 y 9999.`
 return{label:labels[p.kind],reason,quality:[['Con contenido',nonEmpty],['Campos ausentes',result.missing],['Campos vacíos exactos',result.empty-result.missing-result.whitespace],['Solo espacios',result.whitespace]] as [string,number][]}
}
