import {t} from './i18n'
import {quoteIdentifier,sqlColumns} from './sql-helpers'
export const chartKinds={histogram:'Histograma',bar:'Barras',line:'Líneas',scatter:'Dispersión',heatmap:'Mapa de calor',box:'Diagrama de caja'} as const
export type ChartKind=keyof typeof chartKinds
export const chartAggregates={count:'Conteo de filas',distinct:'Valores únicos',sum:'Suma',average:'Promedio',min:'Mínimo',max:'Máximo',median:'Mediana'} as const
export const chartTimeGroups={none:'Sin agrupar fechas',day:'Día',month:'Mes',year:'Año'} as const
export interface ChartOptions {kind:ChartKind;x:number;y:number;bins:number;aggregate:keyof typeof chartAggregates;descending:boolean;measureType:'text'|'number';series?:number;time?:keyof typeof chartTimeGroups;trend?:boolean}
export interface ChartTrend {slope:number|null;intercept:number|null;r2:number|null;r:number|null;n:number;xMin:number|null;xMax:number|null;constantY:boolean}
const trendColumns=['trend_n','trend_slope','trend_intercept','trend_r2','trend_r','trend_x_min','trend_x_max','trend_y_min','trend_y_max']
export const chartSeriesLimit=8
export const chartLimit=(kind:ChartKind)=>kind==='line'||kind==='scatter'?2000:kind==='heatmap'?400:100

// Each query aggregates the full source in DuckDB; only bounded plot rows reach the UI.
export function chartSQL(headers:string[],options:ChartOptions,limit=chartLimit(options.kind)){return chartQuery(headers,options,limit,false)}
export function chartTotalSQL(headers:string[],options:ChartOptions){return chartQuery(headers,options,chartLimit(options.kind),true)}
function chartQuery(headers:string[],options:ChartOptions,limit:number,totals:boolean):string{
 if(!Number.isInteger(limit)||limit<1||limit>10000)throw new Error('El límite del resultado debe estar entre 1 y 10 000.')
 const names=sqlColumns(headers),column=(index:number)=>{if(!Number.isInteger(index)||!names[index])throw new Error('Elige una columna válida.');return quoteIdentifier(names[index].name)}
 if(!Object.hasOwn(chartKinds,options.kind))throw new Error('Elige un tipo de gráfico válido.')
 if(!Number.isInteger(options.bins)||options.bins<1||options.bins>30)throw new Error('Elige entre 1 y 30 intervalos.')
 if(!Object.hasOwn(chartAggregates,options.aggregate))throw new Error('Elige una agregación válida.')
 if(!['text','number'].includes(options.measureType))throw new Error('Elige texto o número para la medida.')
 if(options.trend!==undefined&&typeof options.trend!=='boolean')throw new Error(t('charts.trend.invalidOption'))
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
 const summary=(from:string,where:string,value:string):string=>{
  if(!aggregated&&!['heatmap','box'].includes(options.kind))return `WITH ${cte} SELECT 1 AS grand, ${value} AS value FROM ${from} WHERE ${where};`
  const key=time==='none'?'x':`strftime(date_trunc('${time}',dx),'${{day:'%Y-%m-%d',month:'%Y-%m',year:'%Y'}[time]}')`,dimension=series?'series':options.kind==='heatmap'?'y':undefined
  const visible=`SELECT * FROM (${chartQuery(headers,options,limit,false).replace(/;\s*$/,'')}) LIMIT ${limit}`
  return `WITH ${cte}, summaries AS (SELECT ${key} AS x, ${dimension?`${dimension} AS series, CASE WHEN GROUPING(${key})=1 AND GROUPING(${dimension})=1 THEN 1 WHEN GROUPING(${key})=1 THEN 0 ELSE 2 END`:`CASE WHEN GROUPING(${key})=1 THEN 1 ELSE 2 END`} AS grand, ${value} AS value FROM ${from} WHERE ${where} GROUP BY GROUPING SETS ((${key}),${dimension?`(${dimension}),`:''}())) SELECT * FROM summaries s WHERE grand=1 OR EXISTS (SELECT 1 FROM (${visible}) v WHERE v.present IS NOT NULL AND ((s.grand=2 AND v.x IS NOT DISTINCT FROM s.x)${dimension?` OR (s.grand=0 AND v.${series?'series':'y'} IS NOT DISTINCT FROM s.series)`:''}));`
 }

 const measureUsable=aggregate==='count'?'TRUE':aggregate==='distinct'?'y IS NOT NULL':'ny IS NOT NULL'
 if(time!=='none'){
  const format={day:'%Y-%m-%d',month:'%Y-%m',year:'%Y'}[time]
  cte+=`, dated AS (SELECT *, CASE WHEN regexp_full_match(TRIM(x), '[0-9]{4}-[0-9]{2}-[0-9]{2}') AND TRIM(x)>='0001-01-01' AND TRIM(x)<='9999-12-31' THEN TRY_CAST(TRIM(x) AS DATE) END AS dx FROM base), observed AS (SELECT CAST(date_trunc('${time}',dx) AS DATE) AS period${series?', series':''}, ${operation} AS value FROM dated WHERE dx IS NOT NULL GROUP BY period${series?', series':''}), stats AS (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE dx IS NOT NULL AND ${measureUsable}) AS usable, COUNT(*) FILTER (WHERE dx IS NULL) AS invalid_dates FROM dated)`
  if(totals)return summary('dated','dx IS NOT NULL',operation)
  let points=`SELECT strftime(period,'${format}') AS x, value${series?', series':''} FROM observed`,count='(SELECT COUNT(*) FROM points)'
  if(options.kind==='line'){
   cte+=`, bounds AS (SELECT MIN(period) AS lo, MAX(period) AS hi FROM observed), span AS (SELECT lo,hi,COALESCE(date_diff('${time}',lo,hi)+1,0) AS size FROM bounds)${series?`, series_values AS (SELECT DISTINCT series FROM base LIMIT ${chartSeriesLimit+1})`:''}, calendar AS (SELECT CAST(${options.descending?'hi -':'lo +'} i * INTERVAL '1 ${time}' AS DATE) AS period FROM span, range(LEAST(size,${limit+1})) t(i))`
   points=`SELECT strftime(c.period,'${format}') AS x, o.value${series?', s.series':''} FROM calendar c${series?' CROSS JOIN series_values s':''} LEFT JOIN observed o ON o.period=c.period${series?' AND o.series IS NOT DISTINCT FROM s.series':''}`
   count=`(SELECT size${series?' * (SELECT COUNT(*) FROM (SELECT DISTINCT series FROM base))':''} FROM span)`
  }
  return `WITH ${cte}, points AS (${points}) SELECT stats.total,stats.usable,${count} AS points,p.present,p.x,p.value${series?',p.series,(SELECT COUNT(*) FROM (SELECT DISTINCT series FROM base)) AS series_count':''},stats.invalid_dates FROM stats LEFT JOIN (SELECT *,1 AS present FROM points) p ON TRUE ORDER BY p.x ${direction} NULLS FIRST${series?',p.series ASC NULLS FIRST':''} LIMIT ${limit+1};`
 }
 if(totals)return summary('base',options.kind==='histogram'||options.kind==='box'?'ny IS NOT NULL':'TRUE',options.kind==='histogram'||options.kind==='heatmap'?'COUNT(*)':options.kind==='box'?'MEDIAN(ny)':aggregated?operation:'MAX(NULL::DOUBLE)')
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
 const trend=options.trend&&options.kind==='scatter'&&!split
 const trendStats=trend?`, regr_count(ny,nx) AS trend_n, regr_slope(ny,nx) AS trend_slope, regr_intercept(ny,nx) AS trend_intercept, regr_r2(ny,nx) AS trend_r2, corr(ny,nx) AS trend_r, MIN(nx) FILTER (WHERE ${usable}) AS trend_x_min, MAX(nx) FILTER (WHERE ${usable}) AS trend_x_max, MIN(ny) FILTER (WHERE ${usable}) AS trend_y_min, MAX(ny) FILTER (WHERE ${usable}) AS trend_y_max`:''
 return `WITH ${cte}, points AS (${points}), stats AS (SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE ${usable}) AS usable${trendStats} FROM base) SELECT stats.total, stats.usable, (SELECT COUNT(*) FROM points) AS points, p.present, p.x, p.value${extra}${series?', p.series, (SELECT COUNT(*) FROM (SELECT DISTINCT series FROM base)) AS series_count':''}${trend?', '+trendColumns.map(column=>'stats.'+column).join(', '):''} FROM stats LEFT JOIN (SELECT *, 1 AS present FROM points) p ON TRUE ORDER BY ${order} LIMIT ${limit+1};`
}

export function chartLabels(headers:string[],options:ChartOptions){
 const x=headers[options.x]||t('charts.ui.column',{n:options.x+1}),y=options.y<0?t('charts.labels.aColumn'):headers[options.y]||t('charts.ui.column',{n:options.y+1})
 const split=options.series!==undefined&&options.series>=0?t('charts.labels.split',{name:headers[options.series]||t('charts.ui.column',{n:options.series+1})}):''
 const value=options.aggregate==='count'?t('charts.aggregate.count'):t('charts.labels.value',{operation:t('charts.aggregate.'+options.aggregate),column:y})
 if(options.time&&options.time!=='none'){const period=t('charts.time.'+options.time);return{x:t('charts.labels.period',{period,column:x}),y:value,summary:t('charts.labels.temporal',{value,period:period.toLowerCase(),column:x,split})}}
 if(options.kind==='histogram')return{x:t('charts.labels.bins',{column:y}),y:t('charts.labels.frequency'),summary:t('charts.labels.distribution',{column:y})}
 if(options.kind==='bar')return{x,y:value,summary:t('charts.labels.by',{value,column:x,split})}
 if(options.kind==='heatmap')return{x,y,summary:t('charts.labels.pairs',{x,y})}
 if(options.kind==='box')return{x,y,summary:t('charts.labels.groupDistribution',{x,y})}
 return{x,y,summary:t('charts.labels.against',{x,y,split})}
}

export interface ChartData {total:number;usable:number;points:number;limited:boolean;rows:(string|null)[][];columns:string[];seriesCount?:number;invalidDates?:number;trend?:ChartTrend}
export function chartData(kind:ChartKind,columns:string[],rows:(string|null)[][],limit=chartLimit(kind)):ChartData{
 if(!Number.isInteger(limit)||limit<1||limit>10000)throw new Error('Límite de gráfico no válido.')
 if(!rows.length||columns.slice(0,6).join(',')!=='total,usable,points,present,x,value')throw new Error('El motor no devolvió datos de gráfico válidos.')
 const count=(value:string|null)=>{const n=Number(value);if(value===null||!Number.isSafeInteger(n)||n<0)throw new Error('Recuento no válido.');return n}
 const total=count(rows[0][0]),usable=count(rows[0][1]),points=count(rows[0][2])
 const seriesIndex=columns.indexOf('series_count'),dateIndex=columns.indexOf('invalid_dates'),seriesCount=seriesIndex<0?undefined:count(rows[0][seriesIndex]),invalidDates=dateIndex<0?undefined:count(rows[0][dateIndex])
 if(invalidDates!==undefined&&(invalidDates>total||usable>total-invalidDates))throw new Error('Recuento de fechas no válido.')
 let trend:ChartTrend|undefined
 if(columns.includes('trend_n')){
  if(kind!=='scatter'||trendColumns.some(column=>!columns.includes(column)))throw new Error(t('charts.trend.invalidResult'))
  const field=(name:string)=>rows[0][columns.indexOf('trend_'+name)]
  const finite=(value:string|null)=>value===null||!Number.isFinite(Number(value))?null:Number(value)
  const yMin=finite(field('y_min')),yMax=finite(field('y_max')),constantY=yMin!==null&&yMin===yMax
  trend={n:count(field('n')),slope:finite(field('slope')),intercept:finite(field('intercept')),r2:constantY?null:finite(field('r2')),r:finite(field('r')),xMin:finite(field('x_min')),xMax:finite(field('x_max')),constantY}
  if(trend.n!==usable)throw new Error(t('charts.trend.invalidCount'))
 }
 const visible=columns.flatMap((name,i)=>i>=4&&!['series_count','invalid_dates',...trendColumns].includes(name)?[i]:[])
 if(seriesCount!==undefined&&seriesCount>chartSeriesLimit)throw new Error(`Hay ${seriesCount} series. Elige una columna con hasta ${chartSeriesLimit} categorías o limita la vista filtrada.`)
 return{total,usable,points,limited:points>limit,...seriesCount!==undefined?{seriesCount}:{},...invalidDates!==undefined?{invalidDates}:{},...trend?{trend}:{},columns:visible.map(i=>columns[i]),rows:rows.filter(row=>row[3]!==null).slice(0,limit).map(row=>visible.map(i=>row[i]))}
}
