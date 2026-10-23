import {quoteIdentifier,sqlColumns} from './sql-helpers'
export const chartKinds={histogram:'Histograma',bar:'Barras',line:'Líneas',scatter:'Dispersión',heatmap:'Mapa de calor',box:'Diagrama de caja'} as const
export type ChartKind=keyof typeof chartKinds
export const chartAggregates={count:'Conteo de filas',distinct:'Valores únicos',sum:'Suma',average:'Promedio',min:'Mínimo',max:'Máximo',median:'Mediana'} as const
export const chartTimeGroups={none:'Sin agrupar fechas',day:'Día',month:'Mes',year:'Año'} as const
export interface ChartOptions {kind:ChartKind;x:number;y:number;bins:number;aggregate:keyof typeof chartAggregates;descending:boolean;measureType:'text'|'number';series?:number;time?:keyof typeof chartTimeGroups}
export const chartSeriesLimit=8
export const chartLimit=(kind:ChartKind)=>kind==='line'||kind==='scatter'?2000:kind==='heatmap'?400:100

// Each query aggregates the full source in DuckDB; only bounded plot rows reach the UI.
export function chartSQL(headers:string[],options:ChartOptions){
 const names=sqlColumns(headers),column=(index:number)=>{if(!Number.isInteger(index)||!names[index])throw new Error('Elige una columna válida.');return quoteIdentifier(names[index].name)}
 if(!Object.hasOwn(chartKinds,options.kind))throw new Error('Elige un tipo de gráfico válido.')
 if(!Number.isInteger(options.bins)||options.bins<1||options.bins>30)throw new Error('Elige entre 1 y 30 intervalos.')
 if(!Object.hasOwn(chartAggregates,options.aggregate))throw new Error('Elige una agregación válida.')
 if(!['text','number'].includes(options.measureType))throw new Error('Elige texto o número para la medida.')
 const time=options.time??'none'
 if(!Object.hasOwn(chartTimeGroups,time))throw new Error('Elige una agrupación temporal válida.')
 if(time!=='none'&&!['bar','line'].includes(options.kind))throw new Error('Este tipo de gráfico no admite agrupación temporal.')
 const aggregated=options.kind==='bar'||(options.kind==='line'&&time!=='none')
 if(aggregated&&!['count','distinct'].includes(options.aggregate)&&options.measureType!=='number')throw new Error('Este cálculo necesita una medida numérica. Elige Número de forma explícita.')
 const split=options.series!==undefined&&options.series!==-1
 if(options.series!==undefined&&(!Number.isInteger(options.series)||options.series< -1))throw new Error('Elige una columna válida para las series.')
 if(split&&!['bar','line','scatter'].includes(options.kind))throw new Error('Este tipo de gráfico no admite series.')
 const series=split?column(options.series!):undefined
 const x=column(options.x),y=aggregated&&options.aggregate==='count'?'NULL':column(options.y),direction=options.descending?'DESC':'ASC'
 const number=(name:string)=>`CASE WHEN regexp_full_match(TRIM(${name}), '[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?') AND ABS(TRY_CAST(${name} AS DOUBLE)) <= 9007199254740991 THEN TRY_CAST(${name} AS DOUBLE) END`
 let cte=`raw AS (SELECT row_number() OVER () AS fila, ${x} AS x, ${y} AS y${series?`, ${series} AS series`:''} FROM datos), base AS (SELECT *, ${number('x')} AS nx, ${number('y')} AS ny FROM raw)`
 const aggregate=options.kind==='heatmap'?'count':options.aggregate
 const operation={count:'COUNT(*)',distinct:'COUNT(DISTINCT y)',sum:'SUM(ny)',average:'AVG(ny)',min:'MIN(ny)',max:'MAX(ny)',median:'MEDIAN(ny)'}[aggregate]
 const measureUsable=aggregate==='count'?'TRUE':aggregate==='distinct'?'y IS NOT NULL':'ny IS NOT NULL'
 if(time!=='none'){
  const format={day:'%Y-%m-%d',month:'%Y-%m',year:'%Y'}[time],limit=chartLimit(options.kind)
  cte+=`, dated AS (SELECT *, CASE WHEN regexp_full_match(TRIM(x), '[0-9]{4}-[0-9]{2}-[0-9]{2}') AND TRIM(x)>='0001-01-01' AND TRIM(x)<='9999-12-31' THEN TRY_CAST(TRIM(x) AS DATE) END AS dx FROM base), observed AS (SELECT CAST(date_trunc('${time}',dx) AS DATE) AS period${series?', series':''}, ${operation} AS value FROM dated WHERE dx IS NOT NULL GROUP BY period${series?', series':''}), stats AS (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE dx IS NOT NULL AND ${measureUsable}) AS usable, COUNT(*) FILTER (WHERE dx IS NULL) AS invalid_dates FROM dated)`
  let points=`SELECT strftime(period,'${format}') AS x, value${series?', series':''} FROM observed`,count='(SELECT COUNT(*) FROM points)'
  if(options.kind==='line'){
   cte+=`, bounds AS (SELECT MIN(period) AS lo, MAX(period) AS hi FROM observed), span AS (SELECT lo,hi,COALESCE(date_diff('${time}',lo,hi)+1,0) AS size FROM bounds)${series?`, series_values AS (SELECT DISTINCT series FROM base LIMIT ${chartSeriesLimit+1})`:''}, calendar AS (SELECT CAST(${options.descending?'hi -':'lo +'} i * INTERVAL '1 ${time}' AS DATE) AS period FROM span, range(LEAST(size,${limit+1})) t(i))`
   points=`SELECT strftime(c.period,'${format}') AS x, o.value${series?', s.series':''} FROM calendar c${series?' CROSS JOIN series_values s':''} LEFT JOIN observed o ON o.period=c.period${series?' AND o.series IS NOT DISTINCT FROM s.series':''}`
   count=`(SELECT size${series?' * (SELECT COUNT(*) FROM (SELECT DISTINCT series FROM base))':''} FROM span)`
  }
  return `WITH ${cte}, points AS (${points}) SELECT stats.total,stats.usable,${count} AS points,p.present,p.x,p.value${series?',p.series,(SELECT COUNT(*) FROM (SELECT DISTINCT series FROM base)) AS series_count':''},stats.invalid_dates FROM stats LEFT JOIN (SELECT *,1 AS present FROM points) p ON TRUE ORDER BY p.x ${direction} NULLS FIRST${series?',p.series ASC NULLS FIRST':''} LIMIT ${limit+1};`
 }
 let points:string,usable:string,order='p.x ASC NULLS FIRST',extra=''
 if(options.kind==='histogram'){
  usable='ny IS NOT NULL'
  cte+=`, bounds AS (SELECT MIN(ny) AS lo, MAX(ny) AS hi FROM base), bins AS (SELECT i, lo+(hi-lo)*i/${options.bins} AS x, lo+(hi-lo)*(i+1)/${options.bins} AS upper FROM bounds, range(${options.bins}) t(i) WHERE lo IS NOT NULL AND (hi<>lo OR i=0)), bucketed AS (SELECT CASE WHEN hi=lo THEN 0 ELSE LEAST(${options.bins-1}, FLOOR((ny-lo)/(hi-lo)*${options.bins})) END AS bucket FROM base, bounds WHERE ny IS NOT NULL)`
  points='SELECT bins.x, bins.upper, COUNT(bucketed.bucket) AS value FROM bins LEFT JOIN bucketed ON bucketed.bucket=bins.i GROUP BY bins.i,bins.x,bins.upper'
  extra=', p.upper'
 }else if(options.kind==='bar'||options.kind==='heatmap'){
  usable=measureUsable
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
 if(options.time&&options.time!=='none'){const period=chartTimeGroups[options.time].toLowerCase(),value=options.aggregate==='count'?'Conteo de filas':`${chartAggregates[options.aggregate]} de ${y}`;return{x:`${chartTimeGroups[options.time]} de ${x}`,y:value,summary:`${value} por ${period} de ${x}${split}`}}
 if(options.kind==='histogram')return{x:`Intervalos de ${y}`,y:'Frecuencia (filas)',summary:`Distribución de ${y}`}
 if(options.kind==='bar'){const value=options.aggregate==='count'?'Conteo de filas':`${chartAggregates[options.aggregate]} de ${y}`;return{x,y:value,summary:`${value} por ${x}${split}`}}
 if(options.kind==='heatmap')return{x,y,summary:`Conteo de filas por ${x} y ${y}`}
 if(options.kind==='box')return{x,y,summary:`Distribución de ${y} por ${x}`}
 return{x,y,summary:`${y} según ${x}${split}`}
}

export interface ChartData {total:number;usable:number;points:number;limited:boolean;rows:(string|null)[][];columns:string[];seriesCount?:number;invalidDates?:number}
export function chartData(kind:ChartKind,columns:string[],rows:(string|null)[][]):ChartData{
 if(!rows.length||columns.slice(0,6).join(',')!=='total,usable,points,present,x,value')throw new Error('El motor no devolvió datos de gráfico válidos.')
 const count=(value:string|null)=>{const n=Number(value);if(value===null||!Number.isSafeInteger(n)||n<0)throw new Error('Recuento no válido.');return n}
 const total=count(rows[0][0]),usable=count(rows[0][1]),points=count(rows[0][2]),limit=chartLimit(kind)
 const seriesIndex=columns.indexOf('series_count'),dateIndex=columns.indexOf('invalid_dates'),seriesCount=seriesIndex<0?undefined:count(rows[0][seriesIndex]),invalidDates=dateIndex<0?undefined:count(rows[0][dateIndex])
 if(invalidDates!==undefined&&(invalidDates>total||usable>total-invalidDates))throw new Error('Recuento de fechas no válido.')
 const visible=columns.flatMap((name,i)=>i>=4&&!['series_count','invalid_dates'].includes(name)?[i]:[])
 if(seriesCount!==undefined&&seriesCount>chartSeriesLimit)throw new Error(`Hay ${seriesCount} series. Elige una columna con hasta ${chartSeriesLimit} categorías o limita la vista filtrada.`)
 return{total,usable,points,limited:points>limit,...seriesCount!==undefined?{seriesCount}:{},...invalidDates!==undefined?{invalidDates}:{},columns:visible.map(i=>columns[i]),rows:rows.filter(row=>row[3]!==null).slice(0,limit).map(row=>visible.map(i=>row[i]))}
}
