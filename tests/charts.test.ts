import {it,expect} from 'vitest'
import {chartSQL,chartData,type ChartOptions} from '../src/shared/charts'
import {chartOption,chartSeries} from '../src/renderer/chart-option'
const options:ChartOptions={kind:'histogram',x:0,y:1,bins:2,aggregate:'count',descending:false,measureType:'number'}
const colors={text:'#222',background:'#fff',accent:'#2671df'}
it('cita encabezados hostiles, valida opciones y limita los resultados después de agregar',()=>{
 const sql=chartSQL(['x";DELETE','Y'],options)
 expect(sql).toContain('"x"";DELETE" AS x');expect(sql).toContain('LIMIT 101');expect(sql).toContain('GROUP BY bins.i')
 expect(()=>chartSQL(['x'],options)).toThrow('columna válida')
 expect(()=>chartSQL(['x','y'],{...options,bins:0})).toThrow('intervalos')
 expect(()=>chartSQL(['x','y'],{...options,kind:'script' as ChartOptions['kind']})).toThrow('tipo')
})
it('distingue un resultado vacío de una vista limitada, sin confundir categorías vacías y ausentes',()=>{
 const columns=['total','usable','points','present','x','value']
 expect(chartData('bar',columns,[['0','0','0',null,null,null]]).rows).toEqual([])
 const data=chartData('bar',columns,[['2','2','101','1','','1'],['2','2','101','1',null,'1']]);expect(data.limited).toBe(true)
 const plot=chartOption(data,{...options,kind:'bar'},colors)
 expect(plot.xAxis).toMatchObject({data:['1. (vacío)','2. (campo ausente)']})
 expect(()=>chartData('bar',columns,[['bad','0','0',null,null,null]])).toThrow('Recuento')
})
it('preserva huecos en líneas y usa texto seguro en tooltips, sin HTML interpretado',()=>{
 const data={total:3,usable:2,points:3,limited:false,columns:['x','value'],rows:[['1','2'],['2',null],['3','4']]}
 const plot=chartOption(data,{...options,kind:'line'},colors)
 expect(plot.series).toEqual([{type:'line',connectNulls:false,showSymbol:true,data:[[1,2],[2,null],[3,4]]}])
 expect(plot.tooltip).toMatchObject({renderMode:'richText'})
 expect(()=>chartOption({...data,rows:[['1','NaN']]},{...options,kind:'scatter'},colors)).toThrow('representar')
})
it('dibuja bigotes observados, cuartiles y atípicos de una distribución conocida',()=>{
 const data={total:5,usable:5,points:1,limited:false,columns:[],rows:[['A','3','2','4','1','4','1','5','[100]']]}
 const plot=chartOption(data,{...options,kind:'box'},colors)
 expect(plot.series).toEqual([{type:'boxplot',data:[[1,2,3,4,4]]},{name:'Atípicos (hasta 20 por grupo)',type:'scatter',symbolSize:6,data:[[0,100]]}])
})
it('mantiene ausencias del mapa de calor sin inventar ceros',()=>{
 const data={total:2,usable:2,points:2,limited:false,columns:[],rows:[['A','1','X'],['B','1','Y']]}
 const plot=chartOption(data,{...options,kind:'heatmap'},colors)
 expect(plot.series).toMatchObject([{data:[[0,0,1],[1,1,1]]}])
})
it('describe ejes reales y alcance también en el gráfico exportable',()=>{
 const data={total:3,usable:3,points:1,limited:false,columns:['x','value'],rows:[['Oaxaca','15']]}
 const plot=chartOption(data,{...options,kind:'bar',aggregate:'sum'},colors,['Ciudad','Total MXN'],'Vista filtrada actual')
 expect(plot.xAxis).toMatchObject({name:'Ciudad'});expect(plot.yAxis).toMatchObject({name:'Suma de Total MXN'})
 expect(plot.title).toMatchObject({text:'Suma de Total MXN por Ciudad',subtext:expect.stringContaining('Vista filtrada actual')})
 const histogram=chartOption(data,options,colors,['Ciudad','Total MXN']);expect(histogram.xAxis).toMatchObject({name:'Intervalos de Total MXN'});expect(histogram.yAxis).toMatchObject({name:'Frecuencia (filas)'})
 for(const [aggregate,sql] of [['distinct','COUNT(DISTINCT y)'],['min','MIN(ny)'],['max','MAX(ny)'],['median','MEDIAN(ny)']] as const)expect(chartSQL(['Ciudad','Total MXN'],{...options,kind:'bar',aggregate})).toContain(sql)
 expect(()=>chartSQL(['Ciudad','Total MXN'],{...options,aggregate:'toString' as ChartOptions['aggregate']})).toThrow('agregación válida')
})
it('rechaza cálculos numéricos para texto y permite contar sin convertir identificadores',()=>{
 for(const aggregate of ['sum','average','min','max','median'] as const)expect(()=>chartSQL(['Ciudad','Código'],{...options,kind:'bar',aggregate,measureType:'text'})).toThrow('medida numérica')
 expect(chartSQL(['Código'],{...options,kind:'bar',x:0,y:-1,measureType:'text'})).toContain('NULL AS y')
 expect(()=>chartSQL(['Ciudad','Código'],{...options,measureType:'date' as never})).toThrow('texto o número')
 expect(()=>chartSQL(['Ciudad','Código'],{...options,y:-1})).toThrow('columna válida')
})

it('series categóricas: valida columnas/tipos, cita identificadores y limita sin ocultar categorías',()=>{
 const settings={...options,kind:'bar' as const,series:2,aggregate:'sum' as const}
 const sql=chartSQL(['Ciudad','Total','Tipo";DELETE'],settings)
 expect(sql).toContain('"Tipo"";DELETE" AS series');expect(sql).toContain('GROUP BY x, series');expect(sql).toContain('SELECT DISTINCT series FROM base');expect(sql).toContain('p.x ASC NULLS FIRST, p.series ASC NULLS FIRST')
 for(const series of [-2,0.5,99,'0;DELETE' as never])expect(()=>chartSQL(['Ciudad','Total','Tipo'],{...settings,series})).toThrow('columna válida')
 expect(()=>chartSQL(['Ciudad','Total','Tipo'],{...settings,kind:'histogram'})).toThrow('no admite series')
 const columns=['total','usable','points','present','x','value','series','series_count']
 const data=chartData('bar',columns,[['3','3','3','1','A','1',null,'3'],['3','3','3','1','A','1','','3'],['3','3','3','1','B','1','(vacío)','3']])
 expect(data).toMatchObject({seriesCount:3,columns:['x','value','series']});expect(chartSeries(data).map(group=>group.name)).toEqual(['1. (campo ausente)','2. (vacío)','3. (vacío)'])
 const plot=chartOption(data,settings,colors,['Ciudad','Total','Tipo'],'Vista filtrada actual',['2. (vacío)'])
 expect(plot.title).toMatchObject({text:'Suma de Total por Ciudad, separado por Tipo',subtext:expect.stringContaining('1 serie oculta')})
 expect(plot.legend).toMatchObject({selected:{'1. (campo ausente)':true,'2. (vacío)':false,'3. (vacío)':true}})
 expect(plot.series).toMatchObject([{name:'1. (campo ausente)',data:[1,null]},{name:'2. (vacío)',data:[1,null]},{name:'3. (vacío)',data:[null,1]}])
 expect(()=>chartData('bar',columns,[['9','9','9','1','A','1','Tipo','9']])).toThrow('Hay 9 series')
 expect(()=>chartData('bar',columns,[['0','0','0',null,null,null,null,'NaN']])).toThrow('Recuento')
 expect(chartData('bar',columns,[['0','0','0',null,null,null,null,'0']])).toMatchObject({rows:[],seriesCount:0})
})
it('series de líneas y dispersión conservan ejes numéricos, huecos y orden sin agregar filas',()=>{
 const data={total:4,usable:3,points:4,limited:false,columns:['x','value','fila','series'],seriesCount:2,rows:[['1','5','1','A'],['1','7','2','B'],['2',null,'3','A'],['3','9','4','B']]}
 const plot=chartOption(data,{...options,kind:'line',series:2},colors)
 expect(plot.xAxis).toMatchObject({type:'value'});expect(plot.yAxis).toMatchObject({type:'value'})
 expect(plot.series).toMatchObject([{type:'line',name:'1. A',connectNulls:false,data:[[1,5],[2,null]]},{type:'line',name:'2. B',data:[[1,7],[3,9]]}])
 const scatter=chartOption({...data,rows:data.rows.filter(row=>row[1]!==null)},{...options,kind:'scatter',series:2},colors)
 expect(scatter.series).toMatchObject([{type:'scatter',data:[[1,5]]},{type:'scatter',data:[[1,7],[3,9]]}])
})

it('agrupa fechas con unidades permitidas y limita el calendario antes de materializar huecos',()=>{
 const settings={...options,kind:'line' as const,x:0,y:1,aggregate:'sum' as const,time:'month' as const}
 const sql=chartSQL(['Fecha','Total'],settings)
 expect(sql).toContain("date_trunc('month',dx)");expect(sql).toContain('TRY_CAST(TRIM(x) AS DATE)');expect(sql).toContain('range(LEAST(size,2001))');expect(sql).toContain('lo + i');expect(sql).not.toContain('generate_series');expect(sql).toContain('stats.invalid_dates')
 expect(chartSQL(['Fecha','Total','Tipo'],{...settings,series:2})).toContain('series_values AS (SELECT DISTINCT series FROM base LIMIT 9)')
 expect(chartSQL(['Fecha','Total'],{...settings,descending:true})).toContain('hi - i')
 for(const time of ['month); DROP TABLE datos','toString'] as never[])expect(()=>chartSQL(['Fecha','Total'],{...settings,time})).toThrow('temporal válida')
 expect(()=>chartSQL(['Fecha','Total'],{...settings,kind:'scatter'})).toThrow('no admite agrupación temporal')
 expect(()=>chartSQL(['Fecha','Total'],{...settings,measureType:'text'})).toThrow('medida numérica')
 expect(chartSQL(['Fecha'],{...settings,aggregate:'count',measureType:'text',y:-1})).toContain('NULL AS y')
 const columns=['total','usable','points','present','x','value','series','series_count','invalid_dates']
 const data=chartData('line',columns,[['5','3','3','1','2026-01','10','A','1','2'],['5','3','3','1','2026-02',null,'A','1','2'],['5','3','3','1','2026-03','20','A','1','2']])
 expect(data).toMatchObject({invalidDates:2,seriesCount:1,columns:['x','value','series']})
 const plot=chartOption(data,{...settings,series:2},colors,['Fecha','Total','Tipo'])
 expect(plot.title).toMatchObject({text:'Suma de Total por mes de Fecha, separado por Tipo',subtext:expect.stringContaining('Fechas no válidas/vacías/ausentes: 2')})
 expect(plot.xAxis).toMatchObject({type:'category',name:'Mes de Fecha',data:['2026-01','2026-02','2026-03']});expect(plot.series).toMatchObject([{type:'line',connectNulls:false,data:[10,null,20]}])
 const solo=chartOption({...data,columns:['x','value'],rows:data.rows.map(row=>row.slice(0,2))},settings,colors,['Fecha','Total'])
 expect(solo.series).toMatchObject([{type:'line',connectNulls:false,data:[10,null,20]}])
 expect(()=>chartData('line',columns,[['5','3','3','1','2026-01','10','A','1','3']])).toThrow('Recuento de fechas')
})
