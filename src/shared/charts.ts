import {quoteIdentifier,sqlColumns} from './sql-helpers'
export const chartKinds={histogram:'Histograma',bar:'Barras',line:'Líneas',scatter:'Dispersión',heatmap:'Mapa de calor',box:'Diagrama de caja'} as const
export type ChartKind=keyof typeof chartKinds
export const chartAggregates={count:'Conteo de filas',distinct:'Valores únicos',sum:'Suma',average:'Promedio',min:'Mínimo',max:'Máximo',median:'Mediana'} as const
export interface ChartOptions {kind:ChartKind;x:number;y:number;bins:number;aggregate:keyof typeof chartAggregates;descending:boolean;measureType:'text'|'number';series?:number}
export const chartSeriesLimit=8
export const chartLimit=(kind:ChartKind)=>kind==='line'||kind==='scatter'?2000:kind==='heatmap'?400:100

// Each query aggregates the full source in DuckDB; only bounded plot rows reach the UI.
export function chartSQL(headers:string[],options:ChartOptions){
 const names=sqlColumns(headers),column=(index:number)=>{if(!Number.isInteger(index)||!names[index])throw new Error('Elige una columna válida.');return quoteIdentifier(names[index].name)}
 if(!Object.hasOwn(chartKinds,options.kind))throw new Error('Elige un tipo de gráfico válido.')
 if(!Number.isInteger(options.bins)||options.bins<1||options.bins>30)throw new Error('Elige entre 1 y 30 intervalos.')
 if(!Object.hasOwn(chartAggregates,options.aggregate))throw new Error('Elige una agregación válida.')
 if(!['text','number'].includes(options.measureType))throw new Error('Elige texto o número para la medida.')
 if(options.kind==='bar'&&!['count','distinct'].includes(options.aggregate)&&options.measureType!=='number')throw new Error('Este cálculo necesita una medida numérica. Elige Número de forma explícita.')
 const split=options.series!==undefined&&options.series!==-1
 if(options.series!==undefined&&(!Number.isInteger(options.series)||options.series< -1))throw new Error('Elige una columna válida para las series.')
 if(split&&!['bar','line','scatter'].includes(options.kind))throw new Error('Este tipo de gráfico no admite series.')
 const series=split?column(options.series!):undefined
 const x=column(options.x),y=options.kind==='bar'&&options.aggregate==='count'?'NULL':column(options.y),direction=options.descending?'DESC':'ASC'
 const number=(name:string)=>`CASE WHEN regexp_full_match(TRIM(${name}), '[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?') AND ABS(TRY_CAST(${name} AS DOUBLE)) <= 9007199254740991 THEN TRY_CAST(${name} AS DOUBLE) END`
 let cte=`raw AS (SELECT row_number() OVER () AS fila, ${x} AS x, ${y} AS y${series?`, ${series} AS series`:''} FROM datos), base AS (SELECT *, ${number('x')} AS nx, ${number('y')} AS ny FROM raw)`
 let points:string,usable:string,order='p.x ASC NULLS FIRST',extra=''
 if(options.kind==='histogram'){
  usable='ny IS NOT NULL'
  cte+=`, bounds AS (SELECT MIN(ny) AS lo, MAX(ny) AS hi FROM base), bins AS (SELECT i, lo+(hi-lo)*i/${options.bins} AS x, lo+(hi-lo)*(i+1)/${options.bins} AS upper FROM bounds, range(${options.bins}) t(i) WHERE lo IS NOT NULL AND (hi<>lo OR i=0)), bucketed AS (SELECT CASE WHEN hi=lo THEN 0 ELSE LEAST(${options.bins-1}, FLOOR((ny-lo)/(hi-lo)*${options.bins})) END AS bucket FROM base, bounds WHERE ny IS NOT NULL)`
  points='SELECT bins.x, bins.upper, COUNT(bucketed.bucket) AS value FROM bins LEFT JOIN bucketed ON bucketed.bucket=bins.i GROUP BY bins.i,bins.x,bins.upper'
  extra=', p.upper'
 }else if(options.kind==='bar'||options.kind==='heatmap'){
  const aggregate=options.kind==='heatmap'?'count':options.aggregate
  usable=aggregate==='count'?'TRUE':aggregate==='distinct'?'y IS NOT NULL':'ny IS NOT NULL'
  const operation={count:'COUNT(*)',distinct:'COUNT(DISTINCT y)',sum:'SUM(ny)',average:'AVG(ny)',min:'MIN(ny)',max:'MAX(ny)',median:'MEDIAN(ny)'}[aggregate]
  points=`SELECT x${options.kind==='heatmap'?', y':''}${series?', series':''}, ${operation} AS value FROM base GROUP BY x${options.kind==='heatmap'?', y':''}${series?', series':''}`
  order=options.kind==='heatmap'?'p.x ASC NULLS FIRST, p.y ASC NULLS FIRST':series?`p.x ${direction} NULLS FIRST, p.series ASC NULLS FIRST`:`p.value ${direction} NULLS LAST, p.x ASC NULLS FIRST`
  if(options.kind==='heatmap')extra=', p.y'
 }else if(options.kind==='line'||options.kind==='scatter'){
  usable='nx IS NOT NULL AND ny IS NOT NULL'
  points=`SELECT nx AS x, ny AS value, fila${series?', series':''} FROM base WHERE nx IS NOT NULL${options.kind==='scatter'?' AND ny IS NOT NULL':''}`
  order=`p.x ${direction}, p.fila ASC`;extra=', p.fila'
 }else{
  usable='ny IS NOT NULL'
  cte+=', quartiles AS (SELECT x, quantile_cont(ny,0.25) AS q1, quantile_cont(ny,0.5) AS median, quantile_cont(ny,0.75) AS q3 FROM base WHERE ny IS NOT NULL GROUP BY x)'
  const outside='b.ny<q.q1-1.5*(q.q3-q.q1) OR b.ny>q.q3+1.5*(q.q3-q.q1)'
  points=`SELECT q.x, q.q1, q.median AS value, q.q3, MIN(b.ny) FILTER (WHERE b.ny>=q.q1-1.5*(q.q3-q.q1)) AS low, MAX(b.ny) FILTER (WHERE b.ny<=q.q3+1.5*(q.q3-q.q1)) AS high, COUNT(*) FILTER (WHERE ${outside}) AS outliers, COUNT(*) AS count, CAST(list_slice(LIST(b.ny ORDER BY b.ny) FILTER (WHERE ${outside}),1,20) AS VARCHAR) AS atypical FROM quartiles q JOIN base b ON b.x IS NOT DISTINCT FROM q.x WHERE b.ny IS NOT NULL GROUP BY q.x,q.q1,q.median,q.q3`
  extra=', p.q1, p.q3, p.low, p.high, p.outliers, p.count, p.atypical'
 }
 return `WITH ${cte}, points AS (${points}), stats AS (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE ${usable}) AS usable FROM base) SELECT stats.total, stats.usable, (SELECT COUNT(*) FROM points) AS points, p.present, p.x, p.value${extra}${series?', p.series, (SELECT COUNT(*) FROM (SELECT DISTINCT series FROM base)) AS series_count':''} FROM stats LEFT JOIN (SELECT *, 1 AS present FROM points) p ON TRUE ORDER BY ${order} LIMIT ${chartLimit(options.kind)+1};`
}

export function chartLabels(headers:string[],options:ChartOptions){
 const x=headers[options.x]||`Columna ${options.x+1}`,y=options.y<0?'una columna':headers[options.y]||`Columna ${options.y+1}`
 const split=options.series!==undefined&&options.series>=0?`, separado por ${headers[options.series]||`Columna ${options.series+1}`}`:''
 if(options.kind==='histogram')return{x:`Intervalos de ${y}`,y:'Frecuencia (filas)',summary:`Distribución de ${y}`}
 if(options.kind==='bar'){const value=options.aggregate==='count'?'Conteo de filas':`${chartAggregates[options.aggregate]} de ${y}`;return{x,y:value,summary:`${value} por ${x}${split}`}}
 if(options.kind==='heatmap')return{x,y,summary:`Conteo de filas por ${x} y ${y}`}
 if(options.kind==='box')return{x,y,summary:`Distribución de ${y} por ${x}`}
 return{x,y,summary:`${y} según ${x}${split}`}
}

export interface ChartData {total:number;usable:number;points:number;limited:boolean;rows:(string|null)[][];columns:string[];seriesCount?:number}
export function chartData(kind:ChartKind,columns:string[],rows:(string|null)[][]):ChartData{
 if(!rows.length||columns.slice(0,6).join(',')!=='total,usable,points,present,x,value')throw new Error('El motor no devolvió datos de gráfico válidos.')
 const count=(value:string|null)=>{const n=Number(value);if(value===null||!Number.isSafeInteger(n)||n<0)throw new Error('Recuento no válido.');return n}
 const total=count(rows[0][0]),usable=count(rows[0][1]),points=count(rows[0][2]),limit=chartLimit(kind)
 const split=columns.at(-1)==='series_count',seriesCount=split?count(rows[0].at(-1)!):undefined
 if(seriesCount!==undefined&&seriesCount>chartSeriesLimit)throw new Error(`Hay ${seriesCount} series. Elige una columna con hasta ${chartSeriesLimit} categorías o limita la vista filtrada.`)
 return{total,usable,points,limited:points>limit,...split?{seriesCount}:{},columns:columns.slice(4,split?-1:undefined),rows:rows.filter(row=>row[3]!==null).slice(0,limit).map(row=>row.slice(4,split?-1:undefined))}
}
